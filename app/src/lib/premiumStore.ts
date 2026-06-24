// app/src/lib/premiumStore.ts — 프리미엄 상태 전역 store(모든 화면 단일 source 구독)
// ─────────────────────────────────────────────────────────────────────────
// 문제(daniel 2026-06-24): useSubscription 이 화면마다 독립 useState 라, 프리미엄↔일반·로그인↔로그아웃
//   전환 시 한 화면만 갱신되고 다른 화면(특히 하단 배너 AdBanner)은 stale → 광고가 안 켜지거나 안 꺼짐.
//   + 로그아웃 시 RC(RevenueCat) 익명화를 안 해 isPremiumActiveRC 가 이전 계정으로 true 유지되는 버그도 겹침.
// 해결: 프리미엄 여부를 *모듈 전역 단일 상태*로 두고 useSyncExternalStore 로 구독 →
//   refreshPremium(userId) 한 번 = 전 구독자(배너·보상형 게이트·콘텐츠 등 21곳) 동시 반영.
//   진실원천 = Supabase profiles.is_premium OR RC entitlement(구매 직후 즉시). 미로그인 = 항상 false.
//   ※ 여기서 Edge LLM 을 호출하지 않는다(유료 통변은 useEntitlement 별도) → ABSOLUTE-0 정합 유지.
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';
import { isPremiumActiveRC } from './purchases';

let _isPremium = false; // 전역 프리미엄 여부(스냅샷)
let _loading = true;    // 최초 1회 평가 전 = 로딩
const listeners = new Set<() => void>();

function emit(): void { for (const l of listeners) l(); }

/** useSyncExternalStore 구독 등록 — 상태 변경 시 콜백 호출. 해제 함수 반환. */
export function subscribePremium(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** 현재 프리미엄 스냅샷(원시 boolean — useSyncExternalStore 동일성 안정). */
export function getPremiumSnapshot(): boolean { return _isPremium; }

/** 최초 평가 전 로딩 여부 스냅샷. */
export function getPremiumLoadingSnapshot(): boolean { return _loading; }

// 빠른 로그인/로그아웃 연속 전환의 레이스 가드 — 마지막 요청 결과만 반영(오래된 응답 폐기).
let _reqSeq = 0;

/**
 * 프리미엄 상태 재평가 → 전역 반영(전 구독자 리렌더).
 * @param userId 로그인 유저 id(없으면 null/undefined = 미로그인 → 항상 false).
 * 로그인/로그아웃(_layout·useAuth)·구매 직후(settings·market refresh) 시점에 호출한다.
 */
export async function refreshPremium(userId: string | null | undefined): Promise<void> {
  const seq = ++_reqSeq;
  // 미로그인/로그아웃 = 즉시 일반(false). RC 조회 불필요(엔타이틀먼트=계정 귀속). RC 익명화는 호출처(로그아웃)에서 logOut.
  if (!userId) {
    if (_isPremium !== false || _loading) { _isPremium = false; _loading = false; emit(); }
    return;
  }
  // 서버(웹훅이 갱신) OR RC(구매 직후 즉시) — 둘 중 하나라도 활성이면 프리미엄.
  const [profile, rc] = await Promise.all([
    supabase.from('profiles').select('is_premium').eq('id', userId).maybeSingle(),
    isPremiumActiveRC(),
  ]);
  if (seq !== _reqSeq) return; // 더 최신 전환 요청이 들어왔으면 이 응답은 폐기(stale 방지).
  const next = (!profile.error && !!profile.data?.is_premium) || rc;
  if (_isPremium !== next || _loading) { _isPremium = next; _loading = false; emit(); }
}
