// app/src/lib/notifications.ts — 매일 아침 9시 '오늘의 운세' 로컬 알림
// ─────────────────────────────────────────────────────────────────────────
// daniel: 매일 9시에 그날 운세를 푸시로 보내준다. 운세는 일진×대표명식 결정론 → 미래 날짜도 미리 계산
//   가능 → 향후 N일치를 각 날짜 9시에 로컬 알림으로 스케줄(내용=그날 통합 운세 한 줄). 진입마다 재스케줄.
// ⚠️ expo-notifications 는 *네이티브 모듈* — 미포함 빌드(재빌드 전 dev client)엔 없으므로 lazy 가드(no-op).
//   *로컬* 알림 — 서버 푸시·토큰 불필요(무료·온디바이스, 절대0 정합). 재빌드 후 작동(ads.ts·network.ts 패턴).
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import { router } from 'expo-router'; // 알림 탭 딥링크(컴포넌트 밖 전역 navigate)
import { loadRepChart } from './myChart';
import { getDailyFortune, dailyChartReadings } from './dailyFortune';
import { buildSajuChart } from '@engine/saju';
import { appLang } from './i18n';
import type { Stem, Branch } from '@spec/chart';

// 네이티브 모듈 lazy require — 미포함 빌드에서 import-time 크래시 방지.
let Notif: any = null;
try { Notif = require('expo-notifications'); } catch { Notif = null; }

const HOUR = 9;          // 알림 시각(매일 아침 9시)
const DAYS_AHEAD = 14;   // 미리 스케줄할 일수(운세=결정론이라 미래도 계산 가능). iOS 64개 한도 내.
const TITLE: Record<string, string> = { ko: '오늘의 기운', en: "Today's Energy", ja: '今日の気運' };

/** 알림 권한이 켜져 있는지(설정 토글 표시용). 모듈 없으면 false. */
export async function notificationsEnabled(): Promise<boolean> {
  if (!Notif || Platform.OS === 'web') return false;
  try { return (await Notif.getPermissionsAsync()).granted; } catch { return false; }
}

/**
 * 매일 9시 '오늘의 운세' 알림 — 향후 DAYS_AHEAD일치 각 날짜에 그날 운세 요약으로 스케줄.
 *   대표 명식 없으면 개인화 불가 → 스케줄 안 함. 모듈 없으면 no-op(재빌드 후 작동).
 *   앱 진입마다 호출: 기존 취소 후 재생성 = 멱등·갱신. 권한 없으면 1회 요청.
 */
export async function scheduleDailyFortune(): Promise<void> {
  if (!Notif || Platform.OS === 'web') return;
  try {
    const perm = await Notif.getPermissionsAsync();
    const granted = perm.granted || (perm.canAskAgain && (await Notif.requestPermissionsAsync()).granted);
    if (!granted) return;

    const rep = await loadRepChart();
    if (!rep) return;                                    // 대표 명식 없으면 개인화 불가 → 스케줄 안 함
    const saju = buildSajuChart(rep.input);

    await Notif.cancelAllScheduledNotificationsAsync();  // 재스케줄(갱신) — 멱등
    const title = TITLE[appLang()] ?? TITLE.ko;
    const now = new Date();
    const DATE = Notif.SchedulableTriggerInputTypes?.DATE ?? 'date';
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const when = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, HOUR, 0, 0);
      if (when.getTime() <= now.getTime()) continue;     // 이미 지난 (오늘) 9시는 건너뜀
      const f = getDailyFortune(i);
      const r = dailyChartReadings(saju, f.dayGanZhi[0] as Stem, f.dayGanZhi[1] as Branch);
      const body = (r.find((x) => x.key === 'general')?.paragraphs?.[0] ?? '').slice(0, 140);
      if (!body) continue;
      await Notif.scheduleNotificationAsync({
        content: { title, body, data: { route: '/today' } },   // 탭 시 오늘의 운세로(라우팅은 추후 리스너)
        trigger: { type: DATE, date: when },
      });
    }
  } catch { /* 권한·모듈 문제 시 조용히 무시(앱 흐름 무관) */ }
}

/** 알림 전체 취소(설정에서 끄기 등). 모듈 없으면 no-op. */
export async function cancelDailyFortune(): Promise<void> {
  if (!Notif) return;
  try { await Notif.cancelAllScheduledNotificationsAsync(); } catch { /* ignore */ }
}

/**
 * 풀이 생성 완료 즉시 로컬 알림 — daniel: 풀이 생성 중 다른 작업을 하다가 완료되면 푸시로 알림.
 *   생성은 서버 캐시되므로 화면을 떠나도 진행·보관됨 → 완료 시 이 알림으로 통지(탭하면 route 로 복귀).
 *   모듈/권한 없으면 no-op(재빌드 후 작동·무료 로컬 알림).
 */
export async function notifyReadingDone(title: string, body: string, route?: string): Promise<void> {
  if (!Notif || Platform.OS === 'web') return;
  try {
    const perm = await Notif.getPermissionsAsync();
    if (!(perm.granted || (perm.canAskAgain && (await Notif.requestPermissionsAsync()).granted))) return;
    await Notif.scheduleNotificationAsync({
      content: { title, body: (body || '').slice(0, 140), data: route ? { route } : {} },
      trigger: null,   // 즉시 발송
    });
  } catch { /* 권한·모듈 문제 시 조용히 무시 */ }
}

/** 알림 탭 → data.route 로 이동(딥링크: 풀이 완료 알림 클릭 시 그 화면으로). 앱 루트에서 1회 설정·해제. */
export function setupNotificationTapListener(): () => void {
  if (!Notif || Platform.OS === 'web') return () => {};
  try {
    const sub = Notif.addNotificationResponseReceivedListener((resp: any) => {
      const route = resp?.notification?.request?.content?.data?.route;
      if (route) { try { router.push(route); } catch { /* 라우팅 실패 무시 */ } }
    });
    return () => { try { sub.remove(); } catch { /* ignore */ } };
  } catch { return () => {}; }
}
