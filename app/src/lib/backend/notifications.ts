// app/src/lib/notifications.ts — 하루 3회(9·12·18시) '운세 확인' 티저 로컬 알림
// ─────────────────────────────────────────────────────────────────────────
// daniel 07-03: 매일 아침·점심·저녁 3회, '오늘의 운세 확인해 볼까요' 후킹 티저를 푸시로 보낸다(실제 운세 X — 앱 진입 유도).
//   슬롯(시각)별 티저 풀을 날짜별로 로테이션(pool[i % len]) → 문구가 매번 달라 식상함↓. 향후 N일치를 미리 스케줄, 진입마다 재스케줄.
// ⚠️ expo-notifications 는 *네이티브 모듈* — 미포함 빌드(재빌드 전 dev client)엔 없으므로 lazy 가드(no-op).
//   *로컬* 알림 — 서버 푸시·토큰 불필요(무료·온디바이스, 절대0 정합). 재빌드 후 작동(ads.ts·network.ts 패턴).
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import Constants from 'expo-constants'; // EAS projectId(Expo 푸시 토큰 발급)
import { supabase } from '../supabase'; // push_token 저장(set_push_token RPC)
import { dailyEnergy } from '../content/dailyFortune';            // 12·18시 티저 개인화(홈 모먼트와 동일 출처)
import { momentFromEnergy, decisionFromEnergy } from '../content/decisionToday';
import { router } from 'expo-router'; // 알림 탭 딥링크(컴포넌트 밖 전역 navigate)
import { loadRepChart } from '../engine/myChart';
import { computeChart } from '../engine/engine'; // 대표 명식 saju 산출(아침 개인화 팁용)
import { getDailyFortune, dailyAlarmTip } from '../content/dailyFortune'; // 그날 일진 + 개인화 일운 한 줄 팁(결정론)
import { appLang } from '../i18n'; // 티저 문구 언어 선택(ko/en/ja)

// 네이티브 모듈 lazy require — 미포함 빌드에서 import-time 크래시 방지.
let Notif: any = null;
try { Notif = require('expo-notifications'); } catch { Notif = null; }

// ★포그라운드 알림 표시 핸들러(daniel M: 앱 켜둔 채 풀이 완료 시 푸시가 안 뜨던 원인 — 핸들러 없으면 iOS가 포그라운드 알림을 숨김).
//   완료 푸시(notifyReadingDone)는 보통 앱 사용 중 도착하므로 이게 필수. (구·신 SDK 키 모두 지정)
/**
 * ★★지금 **열어 놓은 대화방**(상담가 id). 없으면 null.
 *
 * Boss 2026-08-28: *"ai 가 답장하는것도 내가 해당 화면에 있는 상태가 아니면 알림이 와야하고"*
 *
 * ■ ★왜 **앱이** 판정하나
 *   서버는 회원이 무슨 화면을 보는지 모른다. 알게 하려면 presence(하트비트) 표가 필요하고,
 *   그건 «끊긴 하트비트» 라는 새 고장 종류를 만든다. ⇒ 서버는 **항상 보내고**,
 *   띄울지는 여기서 정한다. 앱이 꺼져 있으면 이 함수가 아예 안 불리므로 OS 가 그대로 띄운다.
 * ■ ⚠️모듈 변수인 이유 — 알림 핸들러는 **앱 전역 1개**라 React state 를 못 읽는다.
 */
let openTalkConsultant: string | null = null;

/**
 * 지금 보고 있는 대화방을 알린다(화면이 부른다).
 * @param consultantId 열려 있는 상담가 id · 방을 닫거나 화면을 떠나면 `null`
 */
export function setOpenTalk(consultantId: string | null): void {
  openTalkConsultant = consultantId || null;
}

/**
 * 앱 아이콘 **배지 숫자**를 서버 값으로 다시 맞춘다.
 *
 * Boss 2026-08-28: *"카운트 기준은 텍스트 갯수고 그부분을 확인하면 카운트는 해당 만큼 줄어들고"*
 *
 * ■ ★수를 **여기서 세지 않는다.** `talk_unread_total` 이 정본이다 —
 *   서버 푸시의 `badge` 필드도 같은 함수를 쓴다. 두 곳이 각자 세면 반드시 갈린다
 *   (실제로 지도 65 ↔ 궁합 76 이 그렇게 갈렸다).
 * ■ 부를 곳: ①대화를 **읽었을 때**(읽자마자 줄어야 한다) ②앱이 앞으로 나올 때
 *   ③로그아웃(0으로 지운다).
 * ■ ⚠️실패해도 **조용히 넘어간다** — 배지는 곁다리다. 다만 상한(`withTimeout` 대신 여기서는
 *   Supabase 기본 동작에 맡긴다)보다 중요한 건 **화면을 막지 않는 것**이라 await 를 강요하지 않는다.
 * @param force 로그아웃처럼 **0 으로 지워야** 할 때 사용(서버에 묻지 않는다)
 */
export async function refreshTalkBadge(force?: 0): Promise<void> {
  if (!Notif?.setBadgeCountAsync || Platform.OS === 'web') return;   // 웹은 아이콘 배지가 없다
  try {
    if (force === 0) { await Notif.setBadgeCountAsync(0); return; }
    const { data, error } = await supabase.rpc('talk_unread_total');
    if (error) { console.warn('[badge] talk_unread_total 실패', error.message); return; }
    await Notif.setBadgeCountAsync(Math.max(0, Number(data) || 0));
  } catch { /* 배지 실패가 화면을 막지 않는다 */ }
}

// ★포그라운드 알림 표시 핸들러(daniel M: 앱 켜둔 채 풀이 완료 시 푸시가 안 뜨던 원인 — 핸들러 없으면 iOS가 포그라운드 알림을 숨김).
//   완료 푸시(notifyReadingDone)는 보통 앱 사용 중 도착하므로 이게 필수. (구·신 SDK 키 모두 지정)
//   ★2026-08-28 — **보고 있는 방의 답장은 안 띄운다.** 그 말풍선은 화면에 이미 떨어졌다.
//     ⚠️배지는 **끄지 않는다**(`shouldSetBadge: true`) — 안 보이는 곳에 쌓인 수는 그대로 세야 한다.
if (Notif?.setNotificationHandler) {
  try {
    Notif.setNotificationHandler({
      handleNotification: async (n: any) => {
        const data = n?.request?.content?.data ?? {};
        // ★route 를 파싱하지 않는다 — 형식이 바뀌면 조용히 어긋난다. 서버가 준 id 로 견준다.
        const sameRoom = !!data?.talkConsultant && data.talkConsultant === openTalkConsultant;
        return {
          shouldShowAlert: !sameRoom, shouldShowBanner: !sameRoom, shouldShowList: !sameRoom,
          shouldPlaySound: !sameRoom, shouldSetBadge: true,
        };
      },
    });
  } catch { /* 핸들러 설정 실패 무시 */ }
}

const SLOTS = [9, 12, 18] as const;  // 하루 3회 티저 알림 시각(아침 9시·점심 12시·저녁 18시)
const DAYS_AHEAD = 14;               // 미리 스케줄할 일수. 3슬롯 × 14일 = 42개(iOS 64개 한도 내). 진입마다 재스케줄.
// ★아침(9시) 개인화 일운 알림 제목(daniel 기획서② 2026-07-14) — 본문은 dailyAlarmTip(그날 일진 오행 액션).
const MORNING_TITLE: Record<string, string> = { ko: '오늘의 기운 ☀️', en: 'Today’s energy ☀️', ja: '今日の運気 ☀️' };

// 티저 문구 1건(제목·본문). 실제 운세가 아니라 '확인해 볼까요' 후킹 — 앱 진입 유도용.
type Teaser = { title: string; body: string };
// 슬롯(시각)별 티저 풀 — 언어(ko/en/ja) × 시간대(morning 9시 / noon 12시 / evening 18시).
//   날짜 index로 pool[i % len] 로테이션 → 14일간 문구가 돌아가며 바뀐다. 숫자 없이 따뜻·호기심 자극(daniel 07-03 '여러개 만들어서 돌려서').
const TEASERS: Record<string, { morning: Teaser[]; noon: Teaser[]; evening: Teaser[] }> = {
  ko: {
    morning: [
      { title: '오늘의 기운이 도착했어요', body: '지금 나의 하루 흐름, 확인해 볼까요?' },
      { title: '좋은 아침이에요 ☀️', body: '오늘 나에게 흐르는 기운을 살짝 알려드릴게요' },
      { title: '오늘 하루, 어떤 기운일까요?', body: '명식이 말해주는 오늘의 조언을 확인해 보세요' },
      { title: '하루를 시작하기 전에', body: '오늘 유리한 시간·방향을 알고 가면 달라져요' },
      { title: '새로운 하루가 열렸어요', body: '오늘 나에게 흐르는 기운을 지금 만나보세요' },
    ],
    noon: [
      { title: '점심 무렵, 잠깐 ✨', body: '오늘 나의 운세, 아직 안 보셨죠?' },
      { title: '오늘 절반이 지났어요', body: '남은 하루, 나에게 흐르는 기운을 확인해 볼까요?' },
      { title: '식사 후 잠깐 볼까요?', body: '재물·애정·건강… 오늘 나의 흐름' },
      { title: '오늘 나에게 유리한 시간은?', body: '지금 확인하고 오후를 준비해 보세요' },
      { title: '오후를 준비하는 시간', body: '오늘 나의 운세를 보고 리듬을 맞춰볼까요?' },
    ],
    evening: [
      { title: '하루를 마무리하며 🌙', body: '오늘 나의 운세는 어땠을까요? 확인해 보세요' },
      { title: '저녁이 왔어요', body: '내일의 기운도 미리 살펴볼까요?' },
      { title: '오늘 하루 수고했어요', body: '명식이 전하는 오늘의 한 마디를 확인해 보세요' },
      { title: '퇴근길에 잠깐', body: '오늘·내일 나의 흐름을 확인해 보세요' },
      { title: '하루를 돌아보며', body: '오늘은 어땠는지, 내일은 어떨지 살펴보세요' },
    ],
  },
  en: {
    morning: [
      { title: 'Today’s energy has arrived', body: 'Curious how your day is shaping up? Take a peek.' },
      { title: 'Good morning ☀️', body: 'Here’s a glimpse of the energy flowing your way today.' },
      { title: 'What kind of day awaits?', body: 'See what your chart has to say for you today.' },
      { title: 'Before your day begins', body: 'Knowing your best hours and directions changes everything.' },
      { title: 'A brand-new day', body: 'Meet the energy flowing your way this morning.' },
    ],
    noon: [
      { title: 'A quick midday pause ✨', body: 'Haven’t checked your fortune yet today?' },
      { title: 'Halfway through the day', body: 'See what energy carries you through the rest of it.' },
      { title: 'A moment after lunch?', body: 'Wealth, love, health… your flow for today.' },
      { title: 'When’s your best hour today?', body: 'Check now and get ready for the afternoon.' },
      { title: 'Time to set up your afternoon', body: 'A quick look at today’s fortune to find your rhythm.' },
    ],
    evening: [
      { title: 'Winding down the day 🌙', body: 'How did your fortune play out? Take a look.' },
      { title: 'Evening is here', body: 'Want a sneak peek at tomorrow’s energy too?' },
      { title: 'You made it through today', body: 'See the words your chart has for you tonight.' },
      { title: 'On your way home', body: 'A quick look at your flow for today and tomorrow.' },
      { title: 'Looking back on the day', body: 'See how today went and what tomorrow holds.' },
    ],
  },
  ja: {
    morning: [
      { title: '今日の運気が届きました', body: '今の一日の流れ、のぞいてみませんか？' },
      { title: 'おはようございます ☀️', body: '今日あなたに流れる運気を少しお知らせします' },
      { title: '今日はどんな一日？', body: '命式が伝える今日のアドバイスをご確認ください' },
      { title: '一日を始める前に', body: '今日有利な時間・方角を知っておくと変わります' },
      { title: '新しい一日の始まり', body: '今朝あなたに流れる運気に出会ってみて' },
    ],
    noon: [
      { title: 'お昼どき、ちょっと一息 ✨', body: '今日の運勢、まだ見ていませんよね？' },
      { title: '一日の半分が過ぎました', body: '残りの一日、あなたに流れる運気を確認しませんか？' },
      { title: '食後にちょっと見ませんか？', body: '金運・恋愛・健康… 今日のあなたの流れ' },
      { title: '今日あなたに有利な時間は？', body: '今すぐ確認して午後の準備を' },
      { title: '午後を整える時間', body: '今日の運勢を見てリズムを合わせませんか？' },
    ],
    evening: [
      { title: '一日の締めくくりに 🌙', body: '今日のあなたの運勢はどうでしたか？ ご確認ください' },
      { title: '夜になりました', body: '明日の運気も先に見てみませんか？' },
      { title: '今日も一日おつかれさま', body: '命式が伝える今日の一言をご確認ください' },
      { title: '帰り道にちょっと', body: '今日・明日のあなたの流れをご確認ください' },
      { title: '一日を振り返って', body: '今日はどうだったか、明日はどうかを見てみて' },
    ],
  },
};

/** 알림 권한이 켜져 있는지(설정 토글 표시용). 모듈 없으면 false. */
export async function notificationsEnabled(): Promise<boolean> {
  if (!Notif || Platform.OS === 'web') return false;
  try { return (await Notif.getPermissionsAsync()).granted; } catch { return false; }
}

export type NotifStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/**
 * ★알림 권한 확보(중앙화) — 이전엔 scheduleDailyFortune/notifyReadingDone/registerPushToken 3곳에 중복돼
 *   있고 iOS 옵션도 없었다(daniel 07-02). 한 곳에서 iOS 옵션 명시 + 미결정 시에만 시스템 프롬프트 1회.
 *   granted면 true. 이미 거부(canAskAgain=false)면 프롬프트 안 뜸 → false(설정 화면이 iOS 설정으로 유도).
 */
async function ensurePermission(): Promise<boolean> {
  try {
    const perm = await Notif.getPermissionsAsync();
    if (perm.granted) return true;
    if (!perm.canAskAgain) return false;                 // iOS: 한 번 거부하면 재프롬프트 불가 → 기기 설정에서만
    const req = await Notif.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
    return !!req.granted;
  } catch { return false; }
}

/** 설정 화면용 — 현재 알림 권한 상태(행 라벨·동작 분기). 모듈/웹 없으면 'unavailable'. */
export async function getNotifStatus(): Promise<NotifStatus> {
  if (!Notif || Platform.OS === 'web') return 'unavailable';
  try {
    const p = await Notif.getPermissionsAsync();
    if (p.granted) return 'granted';
    return p.canAskAgain ? 'undetermined' : 'denied';    // 미결정=프롬프트 가능 / 거부=iOS 설정 필요
  } catch { return 'unavailable'; }
}

/**
 * 설정 화면용 — 알림 켜기 시도. 미결정이면 시스템 프롬프트를 띄우고, 켜지면 오늘의 운세 알림도 재스케줄.
 *   반환 = 시도 후 상태('granted'면 성공, 'denied'면 이미 거부라 프롬프트 불가 → 호출부가 iOS 설정 유도).
 */
export async function requestNotifPermission(): Promise<NotifStatus> {
  if (!Notif || Platform.OS === 'web') return 'unavailable';
  const ok = await ensurePermission();
  if (ok) { scheduleDailyFortune().catch(() => {}); return 'granted'; }
  return getNotifStatus();                                // 'undetermined'(취소) 또는 'denied'
}

/**
 * 하루 3회(9·12·18시) '운세 확인' 티저 알림 — 향후 DAYS_AHEAD일치 각 날짜×슬롯에 시간대별 티저 문구로 스케줄.
 *   실제 운세가 아니라 후킹 문구(탭 → /today 로 그날 운세 확인). 슬롯 풀을 날짜별 로테이션해 문구가 매번 바뀐다.
 *   대표 명식 없으면 개인화 앱 특성상 스케줄 안 함. 모듈 없으면 no-op(재빌드 후 작동).
 *   앱 진입마다 호출: 기존 취소 후 재생성 = 멱등·갱신. 권한 없으면 1회 요청.
 */
/** 티저 꼬리 — '내용은 앱에서'로 궁금증을 남긴다(daniel: 내용 일부만 궁금하게). */
const TEASER_TAIL: Record<string, string> = {
  ko: '눌러서 오늘 흐름을 확인해 보세요.',
  en: 'Tap to see today’s flow.',
  ja: 'タップして今日の流れを確認。',
};

export async function scheduleDailyFortune(): Promise<void> {
  if (!Notif || Platform.OS === 'web') return;
  try {
    if (!(await ensurePermission())) return;             // 권한 확보(중앙화·iOS 옵션·미결정 시 1회 프롬프트)

    const rep = await loadRepChart();
    if (!rep) return;                                    // 대표 명식 없으면 개인화 앱 특성상 스케줄 안 함
    let saju: any = null;
    try { saju = computeChart(rep.input).saju; } catch { saju = null; } // 아침 개인화 팁용(실패 시 일반 티저로 폴백)

    await Notif.cancelAllScheduledNotificationsAsync();  // 재스케줄(갱신) — 멱등
    const pools = TEASERS[appLang()] ?? TEASERS.ko;      // 언어별 티저 풀
    const slotPool: Record<number, Teaser[]> = { 9: pools.morning, 12: pools.noon, 18: pools.evening }; // 시각 → 시간대 풀
    const now = new Date();
    const DATE = Notif.SchedulableTriggerInputTypes?.DATE ?? 'date';
    for (let i = 0; i < DAYS_AHEAD; i++) {
      for (const hour of SLOTS) {                         // 하루 3슬롯(9·12·18시)
        const when = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, 0, 0);
        if (when.getTime() <= now.getTime()) continue;   // 이미 지난 시각(오늘의 지난 슬롯)은 건너뜀
        // ★아침(9시) = 개인화 일운 팁(그날 일진 오행 액션·결정론) / 점심·저녁 = 일반 후킹 티저.
        let title: string, body: string;
        if (hour === 9 && saju) {
          const f = getDailyFortune(i);                  // i일 뒤 일진(干支)
          title = MORNING_TITLE[appLang()] ?? MORNING_TITLE.ko;
          try { body = dailyAlarmTip(saju, f.dayGanZhi[0] as any, f.dayGanZhi[1] as any); }
          catch { const p = slotPool[hour]; const tt = p[i % p.length]; title = tt.title; body = tt.body; }
        } else if (saju) {
          // ★12·18시도 **대표 명식 기준**(daniel 2026-07-26 "시간별로 가는 알림은 홈에 있는 대표명식 기준으로
          //   랜덤으로 내용 일부를 궁금하게"). 예전엔 고정 티저 풀이라 누구에게나 같은 문구였다.
          //   ★새 명리 판정 0 — 홈 '모먼트' 카드와 **같은 함수**(dailyEnergy → momentFromEnergy / decisionFromEnergy)를
          //     쓴다. 알림에서 본 문구와 앱에서 보는 카드가 어긋날 수 없다.
          //   '랜덤'은 Math.random 이 아니라 **날짜·슬롯 시드**로 고른다(결정론 — 같은 날 같은 슬롯이면 같은 문구,
          //   날마다 바뀜. 재스케줄해도 흔들리지 않아야 하므로).
          const f = getDailyFortune(i);
          const e = dailyEnergy(saju, f.dayGanZhi[0] as any, f.dayGanZhi[1] as any);
          if (hour === 12) {
            const m = momentFromEnergy(e);               // 설레는 제안 — 제목만 보여 궁금하게
            title = m.title;
            body = TEASER_TAIL[appLang()] ?? TEASER_TAIL.ko;
          } else {
            const d = decisionFromEnergy(e);
            // 신호가 있으면 그중 하나를 시드로 골라 '무슨 신호가 왔는지'만(내용은 앱에서)
            const sig = d.signals.length ? d.signals[(i + hour) % d.signals.length] : null;
            title = d.title;                              // 오늘 결정 한 줄(판정)
            body = sig ? `${sig.label.split(' — ')[0]} 신호가 들어왔어요. ${TEASER_TAIL[appLang()] ?? TEASER_TAIL.ko}`
                       : (TEASER_TAIL[appLang()] ?? TEASER_TAIL.ko);
          }
        } else {
          const pool = slotPool[hour];
          const tt = pool[i % pool.length];              // 명식 없음 → 일반 티저 폴백
          title = tt.title; body = tt.body;
        }
        await Notif.scheduleNotificationAsync({
          content: { title, body, data: { route: '/today' } }, // 탭 시 오늘의 운세로(라우팅은 리스너)
          trigger: { type: DATE, date: when },
        });
      }
    }
  } catch { /* 권한·모듈 문제 시 조용히 무시(앱 흐름 무관) */ }
}

/** 알림 전체 취소(설정에서 끄기 등). 모듈 없으면 no-op. */
export async function cancelDailyFortune(): Promise<void> {
  if (!Notif) return;
  try { await Notif.cancelAllScheduledNotificationsAsync(); } catch { /* ignore */ }
}

/**
 * ★관리자 테스트(daniel 2026-07-14) — 오늘의 '일운 아침 팁'을 지금 즉시 발송(9시 예약 대기 없이 바로 확인).
 *   실제 아침 알림(scheduleDailyFortune 9시 슬롯)과 *동일 로직*(dailyAlarmTip)으로 만들어 발송. 탭→오늘운세.
 *   반환: 'sent' | 'no-chart'(대표명식 없음) | 'no-perm'(권한 없음) | 'unavailable'(모듈/웹).
 */
export async function sendDailyTipNow(): Promise<'sent' | 'no-chart' | 'no-perm' | 'unavailable'> {
  if (!Notif || Platform.OS === 'web') return 'unavailable';
  if (!(await ensurePermission())) return 'no-perm';
  const rep = await loadRepChart();
  if (!rep) return 'no-chart';
  let body = '';
  try {
    const saju = computeChart(rep.input).saju;
    const f = getDailyFortune(0);                        // 오늘 일진
    body = dailyAlarmTip(saju, f.dayGanZhi[0] as any, f.dayGanZhi[1] as any);
  } catch { return 'unavailable'; }
  try {
    await Notif.scheduleNotificationAsync({
      content: { title: MORNING_TITLE[appLang()] ?? MORNING_TITLE.ko, body, data: { route: '/today' } },
      trigger: null,                                     // 즉시 발송
    });
    return 'sent';
  } catch { return 'unavailable'; }
}

/**
 * 풀이 생성 완료 즉시 로컬 알림 — daniel: 풀이 생성 중 다른 작업을 하다가 완료되면 푸시로 알림.
 *   생성은 서버 캐시되므로 화면을 떠나도 진행·보관됨 → 완료 시 이 알림으로 통지(탭하면 route 로 복귀).
 *   모듈/권한 없으면 no-op(재빌드 후 작동·무료 로컬 알림).
 */
// ★완료 푸시 직렬화 체인 — 동시에 풀이 2개가 끝나면 즉시(trigger:null) 알림이 겹쳐 iOS가 하나를
//   코얼레싱/드롭(씹힘)하던 문제(daniel) 방지. 한 번에 하나씩 ~700ms 간격으로 순차 발송한다.
let notifChain: Promise<void> = Promise.resolve();
export async function notifyReadingDone(title: string, body: string, route?: string): Promise<void> {
  if (!Notif || Platform.OS === 'web') return;
  notifChain = notifChain.then(async () => {
    try {
      if (!(await ensurePermission())) return;           // 권한 확보(중앙화)
      await Notif.scheduleNotificationAsync({
        content: { title, body: (body || '').slice(0, 140), data: route ? { route } : {} },
        trigger: null,   // 즉시 발송
      });
      await new Promise((r) => setTimeout(r, 700)); // 다음 완료 알림과 간격 → 겹침(씹힘) 방지
    } catch { /* 권한·모듈 문제 시 조용히 무시 */ }
  });
  return notifChain;
}

/** 알림 탭 → data.route 로 이동(딥링크: 풀이 완료 알림 클릭 시 그 화면으로). ★앱 전역 1회만 등록. */
let lastHandledNotifId: string | null = null; // 같은 알림 응답 재전달 시 1회만 처리
let tapSub: any = null;                        // 전역 단일 리스너(useAuth 40개 마운트돼도 1개만 — 리스너 40개=push 40개가 뷰쌓임 주범, daniel 07-01)
export function setupNotificationTapListener(): () => void {
  if (!Notif || Platform.OS === 'web' || tapSub) return () => {}; // 이미 등록됨 → 중복 등록 차단
  try {
    tapSub = Notif.addNotificationResponseReceivedListener((resp: any) => {
      const id = resp?.notification?.request?.identifier ?? String(resp?.notification?.date ?? '');
      if (id && id === lastHandledNotifId) return; // 재전달 dedup
      lastHandledNotifId = id;
      const route = resp?.notification?.request?.content?.data?.route;
      // navigate = 정적 route(/reading 등) 중복 스택 dedup. ★push 폴백 제거(콜드스타트 push가 스택 쌓던 원인).
      if (route) { try { (router as any).navigate ? (router as any).navigate(route) : router.push(route); } catch { /* 실패 시 스택 방지 위해 push 폴백 안 함 */ } }
    });
  } catch { /* ignore */ }
  // ★★콜드스타트 — 앱이 **꺼져 있을 때** 탭한 알림은 위 리스너가 못 받는다.
  //   응답이 이미 전달된 뒤에 리스너가 붙기 때문이다 ⇒ 그래서 **홈으로 떨어졌다**
  //   (Boss 2026-08-27 *"탭하니깐 그냥 홈으로 들어가져"*).
  //   `getLastNotificationResponseAsync()` 로 **마지막 응답을 한 번 확인**한다.
  //   ⚠️같은 id 는 위 dedup 이 잡으므로 두 번 이동하지 않는다.
  try {
    void Notif.getLastNotificationResponseAsync?.().then((resp: any) => {
      if (!resp) return;
      const id = resp?.notification?.request?.identifier ?? String(resp?.notification?.date ?? '');
      if (id && id === lastHandledNotifId) return;
      lastHandledNotifId = id;
      const route = resp?.notification?.request?.content?.data?.route;
      // ⚠️한 틱 미룬다 — 라우터가 아직 안 붙었을 수 있다(콜드스타트라 화면이 그려지는 중이다)
      if (route) setTimeout(() => { try { (router as any).navigate?.(route); } catch { /* 무시 */ } }, 400);
    }).catch(() => { /* 모듈이 없으면 무시 */ });
  } catch { /* ignore */ }

  return () => {}; // ★컴포넌트 언마운트로 제거하지 않음 — 딥링크 전역 핸들러라 앱 수명 내내 1개 유지
}

/**
 * Expo 푸시 토큰 등록(로그인 시 1회) — 강제종료 중 서버생성(generate_set) 완료 시 푸시 발송 대상.
 *   profiles.push_token 에 set_push_token RPC 로 저장(profiles 는 서버관리·UPDATE 정책 없음 → RPC 경유).
 *   ⚠️ EAS projectId 없으면 ExpoPushToken 발급 불가 → no-op(서버생성·재오픈 확인은 토큰과 무관하게 작동).
 *   네이티브 모듈 미포함 빌드·권한 거부도 no-op(앱 흐름 무관).
 */
export async function registerPushToken(): Promise<void> {
  if (!Notif || Platform.OS === 'web') return;
  try {
    if (!(await ensurePermission())) return;             // 권한 확보(중앙화)
    // projectId: app.json extra.eas.projectId 또는 런타임 easConfig. 없으면 토큰 발급 불가 → 가드.
    const projectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId ?? (Constants as any)?.easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notif.getExpoPushTokenAsync({ projectId });
    // ⚠️rpc 는 실패해도 throw 하지 않는다 → error 를 안 보면 **푸시 토큰이 저장 안 된 채 조용히 지나간다**.
    if (token) {
      const { error } = await supabase.rpc('set_push_token', { p_token: token }); // 본인 row 갱신(security definer)
      if (error) throw error;
    }
  } catch { /* 권한·모듈·네트워크 문제 시 조용히 무시 */ }
}

// ─────────────────────────────────────────────────────────────────────────
// ★관리자 확인 수단(daniel 2026-07-26 "2번은 어떻게 확인해") — 시간별 알림은 **미리 예약된 로컬 알림**이라
//   9·12·18시가 되기 전에는 확인할 방법이 없었다(관리자 테스트 버튼은 9시 아침 팁 1종뿐).
//   ① 실제 예약 목록을 그대로 읽어 보여준다(시각·제목·본문) → 스케줄이 걸렸는지·문구가 뭔지 즉시 확인
//   ② 슬롯 문구를 지금 즉시 발송 → 실물 알림으로 문구 확인(예약 시각까지 기다리지 않고)
// ─────────────────────────────────────────────────────────────────────────

/** 예약된 알림 1건(관리자 표시용). */
export type ScheduledPeek = { when: string; title: string; body: string };

/**
 * 지금 예약돼 있는 로컬 알림 목록(시각 오름차순). 관리자 화면에서 스케줄 실재 여부·문구 확인용.
 * @param limit 최대 개수(기본 12 — 앞으로 4일치 정도)
 */
export async function listScheduledNotifications(limit = 12): Promise<ScheduledPeek[]> {
  if (!Notif || Platform.OS === 'web') return [];
  try {
    const all = await Notif.getAllScheduledNotificationsAsync();
    const rows: ScheduledPeek[] = (all ?? []).map((n: any) => {
      const d = n?.trigger?.date ?? n?.trigger?.value;   // DATE 트리거(플랫폼별 형태 차이 방어)
      const dt = d ? new Date(typeof d === 'number' ? d : String(d)) : null;
      const when = dt && !isNaN(dt.getTime())
        ? `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
        : '(시각 미확인)';
      return { when, title: String(n?.content?.title ?? ''), body: String(n?.content?.body ?? '') };
    });
    rows.sort((a, b) => a.when.localeCompare(b.when));
    return rows.slice(0, limit);
  } catch { return []; }
}

/**
 * 슬롯 티저를 **지금 즉시** 발송(관리자 테스트) — 예약 시각까지 기다리지 않고 실물 문구를 확인한다.
 *   실제 스케줄과 **같은 로직**(9=일운 팁 / 12=모먼트 / 18=오늘 결정+신호)으로 만든다.
 * @param hour 9 | 12 | 18
 */
export async function sendSlotTeaserNow(hour: 9 | 12 | 18): Promise<'sent' | 'no-chart' | 'no-perm' | 'unavailable'> {
  if (!Notif || Platform.OS === 'web') return 'unavailable';
  if (!(await ensurePermission())) return 'no-perm';
  const rep = await loadRepChart();
  if (!rep) return 'no-chart';
  try {
    const saju = computeChart(rep.input).saju;
    const f = getDailyFortune(0);
    let title = '', body = '';
    if (hour === 9) {
      title = MORNING_TITLE[appLang()] ?? MORNING_TITLE.ko;
      body = dailyAlarmTip(saju, f.dayGanZhi[0] as any, f.dayGanZhi[1] as any);
    } else {
      const e = dailyEnergy(saju, f.dayGanZhi[0] as any, f.dayGanZhi[1] as any);
      if (hour === 12) {
        title = momentFromEnergy(e).title;
        body = TEASER_TAIL[appLang()] ?? TEASER_TAIL.ko;
      } else {
        const d = decisionFromEnergy(e);
        const sig = d.signals.length ? d.signals[hour % d.signals.length] : null;
        title = d.title;
        body = sig ? `${sig.label.split(' — ')[0]} 신호가 들어왔어요. ${TEASER_TAIL[appLang()] ?? TEASER_TAIL.ko}`
                   : (TEASER_TAIL[appLang()] ?? TEASER_TAIL.ko);
      }
    }
    await Notif.scheduleNotificationAsync({ content: { title, body, data: { route: '/today' } }, trigger: null });
    return 'sent';
  } catch { return 'unavailable'; }
}
