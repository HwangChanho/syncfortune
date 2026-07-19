// src/lib/backend/luckAlerts.ts — 시기 예고 알림(대운 교체 · 세운 전환)
// ─────────────────────────────────────────────────────────────────────────
// 리텐션 Phase 2(daniel 2026-07-19 승인) ② — "명리의 핵심은 '언제'인데 지금 알림은 매일 운세뿐"이라
//   개인에게 **의미 있는 시점이 오기 전에 미리** 알려 준다. 나만을 위한 알림이라 일괄 발송과 열람률이 다르다.
//
// ★서버 푸시가 아니라 **로컬 알림**으로 한 이유(설계 판단):
//   서버에서 시점을 계산하려면 서버에 생년월일시가 있어야 하는데, 그건 PII 경계(ADR-005:
//   ChartInput=온디바이스 전용 / 서버는 PII 없는 NormalizedChart)를 깨는 일이다.
//   시점 계산은 **완전한 결정론**이라 기기에서 미리 뽑아 예약하면 된다 → PII 유출 0 · 서버 비용 0.
//   기존 scheduleDailyFortune 이 쓰는 것과 같은 인프라(expo-notifications 로컬 예약)를 재사용한다.
//
// ★빈도 설계(스팸 방지): 대운은 10년에 한 번, 세운은 1년에 한 번뿐인 사건이라 **연 1~2회**만 울린다.
//   자주 울리는 알림은 꺼진다 — 희소해야 열어 본다.
// ⚠️§4 안전: 예고는 '경고'가 아니라 '준비'로 쓴다. 공포·단정 금지(무엇이 나빠진다고 말하지 않는다).
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart } from '@spec/chart';

// ⚠️expo-notifications 는 *네이티브 모듈* — 미포함 빌드(재빌드 전 dev client)엔 없다.
//   ★전역에서 정적 import 하면 앱이 켜지자마자 죽는다(런치 크래시 전례) → notifications.ts 와 동일하게 lazy require + no-op 가드.
let Notif: any = null;
try { Notif = require('expo-notifications'); } catch { Notif = null; }

// 알림 식별 태그 — 재예약 시 이전 것을 지우기 위해(중복 알림 방지). data.tag 로 구분한다.
const TAG = 'luckAlert';

/** 입춘(세운 전환) 근사일 — 매년 2월 4일. ★실제 절입 시각은 해마다 3~5일로 흔들리지만
 *  '며칠 전 예고' 용도라 근사로 충분하다(정확한 세운 계산은 엔진이 별도로 한다). */
function ipchun(year: number): Date {
  return new Date(year, 1, 4, 9, 0, 0); // 2월 4일 09:00
}

/** 만 나이(대운 교체 시점 계산용) — 생일 기준. */
function ageAt(birth: Date, at: Date): number {
  let a = at.getFullYear() - birth.getFullYear();
  const m = at.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birth.getDate())) a--;
  return a;
}

export type LuckAlert = { when: Date; title: string; body: string };

/**
 * 앞으로 1년 안에 울릴 시기 예고를 계산한다(결정론·순수 함수라 테스트 가능).
 * @param saju  대표 명식(대운 목록 luckCycles 사용)
 * @param birth 생년월일(대운 교체 나이를 날짜로 환산)
 * @param now   기준 시각(테스트 주입용)
 */
export function buildLuckAlerts(saju: SajuChart, birth: Date, now = new Date()): LuckAlert[] {
  const out: LuckAlert[] = [];
  const horizon = new Date(now.getTime() + 370 * 24 * 3600 * 1000); // 약 1년(로컬 예약은 무한정 못 쌓는다)

  // ① 대운 교체 — 10년에 한 번뿐인 큰 전환. **1개월 전**에 한 번.
  try {
    const cycles = saju.luckCycles ?? [];
    const curAge = ageAt(birth, now);
    const next = cycles.find((c) => c.startAge > curAge);          // 다음 대운
    if (next) {
      // 교체일 = 생일 기준 그 나이가 되는 날(대운수는 이미 startAge 에 반영돼 있다)
      const changeAt = new Date(birth.getFullYear() + next.startAge, birth.getMonth(), birth.getDate(), 9, 0, 0);
      const notifyAt = new Date(changeAt.getTime() - 30 * 24 * 3600 * 1000); // 한 달 전
      if (notifyAt > now && notifyAt < horizon) {
        out.push({
          when: notifyAt,
          title: '큰 흐름이 바뀌는 시기가 다가와요',
          // §4: 무엇이 나빠진다고 하지 않는다. '준비'로 서술.
          body: `다음 달부터 10년 단위의 큰 운이 ${next.stem}${next.branch}(${next.stemTenGod})로 바뀝니다. 어떤 흐름인지 미리 봐 두면 좋아요.`,
        });
      }
    }
  } catch { /* 대운 없으면 건너뜀 */ }

  // ② 세운 전환(입춘) — 해가 바뀌는 지점. **3일 전**에 한 번.
  for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
    const at = ipchun(y);
    const notifyAt = new Date(at.getTime() - 3 * 24 * 3600 * 1000);
    if (notifyAt > now && notifyAt < horizon) {
      out.push({
        when: notifyAt,
        title: '올해의 기운이 바뀌어요',
        body: `이번 주에 ${y}년의 운으로 넘어갑니다. 새 해 흐름을 미리 확인해 보세요.`,
      });
    }
  }

  return out.sort((a, b) => a.when.getTime() - b.when.getTime());
}

/**
 * 시기 예고를 로컬 알림으로 예약한다(앱 진입 시 호출·멱등).
 * ⚠️네이티브 모듈/권한이 없으면 조용히 no-op(앱 흐름과 무관해야 한다 — 기존 알림과 동일 정책).
 */
export async function scheduleLuckAlerts(saju: SajuChart, birth: Date): Promise<void> {
  try {
    if (!Notif) return;                                            // 네이티브 모듈 없는 빌드 = no-op
    const perm = await Notif.getPermissionsAsync?.();
    if (perm && perm.status !== 'granted') return;                 // 권한 없으면 요청하지 않는다(오늘의 운세 쪽에서 이미 다룸)

    // 이전에 예약한 시기 예고만 취소(오늘의 운세 알림은 건드리지 않는다 — tag 로 구분).
    const scheduled = (await Notif.getAllScheduledNotificationsAsync?.()) ?? [];
    for (const s of scheduled) {
      if (s?.content?.data?.tag === TAG) await Notif.cancelScheduledNotificationAsync?.(s.identifier);
    }

    const DATE = Notif.SchedulableTriggerInputTypes?.DATE ?? 'date';
    for (const a of buildLuckAlerts(saju, birth)) {
      await Notif.scheduleNotificationAsync({
        content: { title: a.title, body: a.body, data: { route: '/timeline', tag: TAG } }, // 탭 → 타임라인(시간층 화면)
        trigger: { type: DATE, date: a.when },
      });
    }
  } catch { /* 모듈 없음·권한 문제 = 무시 */ }
}
