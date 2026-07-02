// app/src/lib/notifications.ts — 매일 아침 9시 '오늘의 운세' 로컬 알림
// ─────────────────────────────────────────────────────────────────────────
// daniel: 매일 9시에 그날 운세를 푸시로 보내준다. 운세는 일진×대표명식 결정론 → 미래 날짜도 미리 계산
//   가능 → 향후 N일치를 각 날짜 9시에 로컬 알림으로 스케줄(내용=그날 통합 운세 한 줄). 진입마다 재스케줄.
// ⚠️ expo-notifications 는 *네이티브 모듈* — 미포함 빌드(재빌드 전 dev client)엔 없으므로 lazy 가드(no-op).
//   *로컬* 알림 — 서버 푸시·토큰 불필요(무료·온디바이스, 절대0 정합). 재빌드 후 작동(ads.ts·network.ts 패턴).
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import Constants from 'expo-constants'; // EAS projectId(Expo 푸시 토큰 발급)
import { supabase } from '../supabase'; // push_token 저장(set_push_token RPC)
import { router } from 'expo-router'; // 알림 탭 딥링크(컴포넌트 밖 전역 navigate)
import { loadRepChart } from '../engine/myChart';
import { getDailyFortune, dailyChartReadings } from '../content/dailyFortune';
import { buildSajuChart } from '@engine/saju';
import { appLang } from '../i18n';
import type { Stem, Branch } from '@spec/chart';

// 네이티브 모듈 lazy require — 미포함 빌드에서 import-time 크래시 방지.
let Notif: any = null;
try { Notif = require('expo-notifications'); } catch { Notif = null; }

// ★포그라운드 알림 표시 핸들러(daniel M: 앱 켜둔 채 풀이 완료 시 푸시가 안 뜨던 원인 — 핸들러 없으면 iOS가 포그라운드 알림을 숨김).
//   완료 푸시(notifyReadingDone)는 보통 앱 사용 중 도착하므로 이게 필수. (구·신 SDK 키 모두 지정)
if (Notif?.setNotificationHandler) {
  try {
    Notif.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
      }),
    });
  } catch { /* 핸들러 설정 실패 무시 */ }
}

const HOUR = 9;          // 알림 시각(매일 아침 9시)
const DAYS_AHEAD = 14;   // 미리 스케줄할 일수(운세=결정론이라 미래도 계산 가능). iOS 64개 한도 내.
const TITLE: Record<string, string> = { ko: '오늘의 운세', en: "Today's Fortune", ja: '今日の運勢' }; // daniel 07-02: '기운'→'운세'

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
 * 매일 9시 '오늘의 운세' 알림 — 향후 DAYS_AHEAD일치 각 날짜에 그날 운세 요약으로 스케줄.
 *   대표 명식 없으면 개인화 불가 → 스케줄 안 함. 모듈 없으면 no-op(재빌드 후 작동).
 *   앱 진입마다 호출: 기존 취소 후 재생성 = 멱등·갱신. 권한 없으면 1회 요청.
 */
export async function scheduleDailyFortune(): Promise<void> {
  if (!Notif || Platform.OS === 'web') return;
  try {
    if (!(await ensurePermission())) return;             // 권한 확보(중앙화·iOS 옵션·미결정 시 1회 프롬프트)

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
    if (token) await supabase.rpc('set_push_token', { p_token: token }); // 본인 row 갱신(security definer)
  } catch { /* 권한·모듈·네트워크 문제 시 조용히 무시 */ }
}
