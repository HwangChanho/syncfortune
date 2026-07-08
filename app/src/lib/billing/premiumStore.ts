// app/src/lib/premiumStore.ts — 프리미엄 상태 전역 store(모든 화면 단일 source 구독)
// ─────────────────────────────────────────────────────────────────────────
// 문제(daniel 2026-06-24): useSubscription 이 화면마다 독립 useState 라, 프리미엄↔일반·로그인↔로그아웃
//   전환 시 한 화면만 갱신되고 다른 화면(특히 하단 배너 AdBanner)은 stale → 광고가 안 켜지거나 안 꺼짐.
//   + 로그아웃 시 RC(RevenueCat) 익명화를 안 해 isPremiumActiveRC 가 이전 계정으로 true 유지되는 버그도 겹침.
// 해결: 프리미엄 여부를 *모듈 전역 단일 상태*로 두고 useSyncExternalStore 로 구독 →
//   refreshPremium(userId) 한 번 = 전 구독자(배너·보상형 게이트·콘텐츠 등 21곳) 동시 반영.
//   진실원천 = Supabase profiles.is_premium *만*(단일·서버 권위). 미로그인 = 항상 false.
//   ★07-07(daniel): RC 엔타이틀먼트 폴백 제거 — RC(클라)↔서버 갈라짐이 "앱=프리미엄/관리자·게이트=일반" 불일치 유발.
//     구매 직후 즉시반영은 markPremiumOwnedNow(낙관)+waitForPremium(서버 폴링)이 담당 → 앱=관리자=interpret 게이트 전부 동일 소스.
//   ※ 여기서 Edge LLM 을 호출하지 않는다(유료 통변은 useEntitlement 별도) → ABSOLUTE-0 정합 유지.
// ─────────────────────────────────────────────────────────────────────────
import { AppState } from 'react-native'; // 포그라운드 복귀 시 프리미엄 재평가(daniel 07-03)
import { supabase } from '../supabase';

let _isPremium = false; // 계정레벨 스냅샷(광고 제거·배지) = god || (일반전환 아님 && owns)
let _owns = false;      // 프리미엄 소유(profiles.is_premium OR RC) — 명식별 게이트 원재료
let _isAdmin = false;   // 관리자 계정 여부
let _adminMode = true;  // 관리자 모드(god). false=일반계정 전환(권한·프리미엄 무시, daniel 2026-07-01)
let _premiumChartId: string | null = null; // 프리미엄 지정 명식(charts.id) — 명식별 판정
let _loading = true;    // 최초 1회 평가 전 = 로딩
let _lastUserId: string | null | undefined = null; // 최근 평가한 userId — 포그라운드 복귀 재평가에 재사용
const listeners = new Set<() => void>();

// 앱 포그라운드 복귀(active) 시 프리미엄 재평가(daniel 07-03) — 관리자 선물/해제·결제가 앱 재실행 없이 반영.
//   모듈 1회 등록(idempotent). refreshPremium 최초 호출 시 세팅.
let _fgSub: { remove?: () => void } | null = null;
function ensureForegroundRefresh(): void {
  if (_fgSub) return;
  try { _fgSub = AppState.addEventListener('change', (s) => { if (s === 'active') void refreshPremium(_lastUserId); }) as any; } catch { /* 모듈 문제 시 무시 */ }
}

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

/** 프리미엄 지정 명식(charts.id) 스냅샷 — null=미지정(유예). */
export function getPremiumChartIdSnapshot(): string | null { return _premiumChartId; }
/** 관리자 계정 여부 스냅샷(설정 토글 노출용). */
export function getIsAdminSnapshot(): boolean { return _isAdmin; }
/** 관리자 모드(god) 스냅샷 — false=일반계정 전환. */
export function getAdminModeSnapshot(): boolean { return _adminMode; }

/**
 * 이 명식(serverChartId)에 프리미엄이 유효한가 — 명식별 1슬롯 + 관리자 모드.
 * 서버 게이트(interpret effPrem)와 동일 규칙의 클라 미러(화면 페이월 표시용, 최종 판정은 서버).
 *   god(관리자 모드 ON)=전부 / 일반전환=전부 X / 그 외=소유 && (미지정[유예] || 지정 명식 일치).
 */
export function isPremiumForChart(serverChartId: string | null | undefined): boolean {
  const god = _isAdmin && _adminMode;
  if (god) return true;
  const actingNormal = _isAdmin && !_adminMode;
  if (actingNormal || !_owns) return false;
  return _premiumChartId == null || (serverChartId != null && String(serverChartId) === String(_premiumChartId));
}

/**
 * ★구매 직후 낙관적 즉시 반영(daniel 07-02: 프리미엄 구매하고 바로 적용 안 됨).
 *   purchasePremium()이 throw 없이 끝났으면 결제 확정 — RC 캐시(isPremiumActiveRC)가 즉시 true가 아니어도
 *   먼저 owns=true로 켜 전 화면(배너·배지·페이월)에 바로 반영하고, 이어지는 refreshPremium()이 서버로 재확인한다.
 * @param pcid 이 구매가 지정한 명식(charts.id) — 명식별 프리미엄 즉시 일치. undefined면 지정 미변경.
 */
export function markPremiumOwnedNow(pcid?: string | null): void {
  _owns = true;
  if (pcid !== undefined) _premiumChartId = pcid;
  const actingNormal = _isAdmin && !_adminMode;
  _isPremium = (_isAdmin && _adminMode) || (!actingNormal && _owns); // 계정레벨 재계산
  _loading = false;
  emit();
}

// 빠른 로그인/로그아웃 연속 전환의 레이스 가드 — 마지막 요청 결과만 반영(오래된 응답 폐기).
let _reqSeq = 0;

/**
 * 프리미엄 상태 재평가 → 전역 반영(전 구독자 리렌더).
 * @param userId 로그인 유저 id(없으면 null/undefined = 미로그인 → 항상 false).
 * 로그인/로그아웃(_layout·useAuth)·구매 직후(settings·market refresh) 시점에 호출한다.
 */
export async function refreshPremium(userId: string | null | undefined): Promise<void> {
  _lastUserId = userId; ensureForegroundRefresh(); // 최근 userId 기록 + 포그라운드 재평가 리스너 1회 등록
  const seq = ++_reqSeq;
  // 미로그인/로그아웃 = 즉시 일반(false). RC 조회 불필요(엔타이틀먼트=계정 귀속). RC 익명화는 호출처(로그아웃)에서 logOut.
  if (!userId) {
    if (_isPremium !== false || _owns || _isAdmin || _premiumChartId !== null || _loading) {
      _isPremium = false; _owns = false; _isAdmin = false; _adminMode = true; _premiumChartId = null; _loading = false; emit();
    }
    return;
  }
  // ★단일 소스(daniel 2026-07-07): 프리미엄 판정 = 서버 profiles.is_premium *만*(진실원천 1개).
  //   RC 엔타이틀먼트 폴백을 제거한다 — RC(클라)와 서버가 갈라져(샌드박스·복원·웹훅 지연) "앱=프리미엄 / 관리자 페이지·
  //   interpret effPrem 게이트=일반"으로 불일치했음(cksghdls0316: RC엔 있고 is_premium=false → 유령 프리미엄).
  //   구매 직후 즉시반영은 markPremiumOwnedNow(낙관)+waitForPremium(서버 is_premium 폴링)이 담당 = 서버 권위로 통일.
  const profile = await supabase.from('profiles').select('is_premium, is_admin, admin_mode, premium_chart_id').eq('id', userId).maybeSingle();
  if (seq !== _reqSeq) return; // 더 최신 전환 요청이 들어왔으면 이 응답은 폐기(stale 방지).
  // ★조회 실패 시 이전 프리미엄 상태 보존(daniel 07-07): 네트워크/일시 RLS 오류로 profile.error 면
  //   기존엔 p=null→owns=false 로 *결제한 프리미엄 유저를 즉시 강등*(광고 재노출·콘텐츠 재잠금)했다.
  //   단일소스화로 RC 쿠션이 없어 블립이 그대로 노출 → 오류면 갱신 스킵(다음 성공 refresh 에서 반영). 미로그인(userId 없음)은 위에서 이미 false 처리.
  if (profile.error) return;
  const p: any = profile.data;
  const isAdmin = !!p?.is_admin;
  const adminMode = p?.admin_mode !== false;                 // null/undefined/true → god
  const actingNormal = isAdmin && !adminMode;                // 관리자 모드 OFF = 일반계정 전환
  const god = isAdmin && adminMode;
  const owns = !!p?.is_premium;                              // ★서버 프리미엄만(단일 진실원천 — RC 폴백 제거)
  const next = god || (!actingNormal && owns);               // 계정레벨(광고·배지)
  const pcid = actingNormal ? null : ((p?.premium_chart_id as string | null) ?? null);
  if (_isPremium !== next || _owns !== owns || _isAdmin !== isAdmin || _adminMode !== adminMode || _premiumChartId !== pcid || _loading) {
    _isPremium = next; _owns = owns; _isAdmin = isAdmin; _adminMode = adminMode; _premiumChartId = pcid; _loading = false; emit();
  }
}

/**
 * 프리미엄 결제(RC) 후 rc-webhook 이 *서버* profiles.is_premium 를 세팅할 때까지 폴링 대기(daniel 2026-07-05).
 * ─────────────────────────────────────────────────────────────────────────
 * 배경: 낙관적 즉시표시(markPremiumOwnedNow)는 UX 를 위해 쓰되, *서버가 최종 진실*이라는 원칙은 이 함수가 지킨다.
 *   즉 markPremiumOwnedNow 는 purchasePremium()이 성공(결제 확정)한 *뒤에만* 켜고(#6), 곧바로 이 waitForPremium 이
 *   서버 is_premium 을 폴링해 재확인한다 — 확정되면 유지, 미도달이면 다음 refreshPremium 이 정정. 크레딧의
 *   waitForCreditGrant 와 동일 철학. 여기서는 **profiles.is_premium 을 직접 조회**한다 — RC 캐시(isPremiumActiveRC)는
 *   샌드박스에서 이미 소유한 비소모성 상품을 true 로 오탐할 수 있어, 영수증 검증을 거친 웹훅 결과(is_premium)만 신뢰한다.
 * @returns confirmed — 서버 is_premium 확인 여부(타임아웃이면 false → 호출처가 '반영까지 잠시' 안내). 확인 시 store 도 갱신.
 */
export async function waitForPremium(userId: string, opts: { tries?: number; intervalMs?: number } = {}): Promise<boolean> {
  const tries = opts.tries ?? 12;
  const intervalMs = opts.intervalMs ?? 1000; // 기본 최대 ~12s 대기(웹훅 도달 여유)
  for (let i = 0; i < tries; i++) {
    const { data } = await supabase.from('profiles').select('is_premium').eq('id', userId).maybeSingle();
    if (data?.is_premium) { await refreshPremium(userId); return true; } // 서버 확인 → store 갱신(전 화면 동시 반영)
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false; // 웹훅 미도달(타임아웃) — 이 함수 자체는 표시를 바꾸지 않는다(서버 미확인). 낙관표시 여부는 호출처가 결정(#6 구매/#2 복원)
}

/**
 * 프리미엄(평생) 최초 구매일 조회 — 1주년 30% '갱신' 오퍼 판정용(daniel 2026-07-08 수익구조).
 *   purchases(kind='premium', owner_id=본인·RLS)의 가장 이른 created_at. 여러 건(복원·재구매)이면 최초 구매 기준으로 1년 경과 판정.
 *   ★평생 접근은 유지(is_premium 불변) — 이 날짜는 오직 '갱신 오퍼를 띄울지'(offerPremiumRenewal)에만 쓴다. 만료 강제 아님.
 * @returns ISO 문자열 또는 null(구매 이력 없음/미로그인).
 */
export async function fetchPremiumPurchasedAt(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase.from('purchases')
    .select('created_at').eq('owner_id', userId).eq('kind', 'premium')
    .order('created_at', { ascending: true }).limit(1).maybeSingle();
  return (data?.created_at as string | undefined) ?? null;
}
