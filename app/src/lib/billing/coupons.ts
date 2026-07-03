// app/src/lib/coupons.ts — 무료 이용권 쿠폰 사용·크레딧 (파트별 무료권 + 1회 올패스)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 코드 입력 → 유료 기능 무료 크레딧 부여. 파트별('reading'·'ziwei'·'compat'·'timeline'·'followup')
//   또는 올패스('all'=각 파트 1씩). 검증·차감은 서버 RPC(SECURITY DEFINER) — 앱은 RPC만 호출.
//   게이트는 결제 전에 useCredit(kind) 로 크레딧 우선 소비(있으면 무료). 비프리미엄 전용(프리미엄은 무게이트).
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase';
import { localGrant, localUse, localCreditsAll } from './localCredits'; // 비로그인 = 디바이스 로컬 크레딧(daniel H)
import { logEvent } from '../backend/logger'; // ★이용권 부여/차감 로그(배포 필수 — daniel 07-02)

// 로그인 세션 유무 — 있으면 서버(RPC/테이블), 없으면 디바이스 로컬(비로그인 구매분, 로그인 시 이관).
async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

export type CreditKind = 'reading' | 'ziwei' | 'compat' | 'timeline' | 'followup' | 'love' | 'newyear' | 'lifegraph' | 'roots' | 'image' | 'mission' | 'career' | 'talent' | 'astrology' | 'dream' | 'gaeun' | 'celeb' | 'timeresolve' | 'future10' | 'child' | 'child_couple';
// price = 건당 가격(원). daniel 확정(2026-06): 원가(opus, 영구캐시 1회)×~3, 소액(타임라인·질문)=₩990, 애정 ₩4,900.
export const CREDIT_KINDS: { key: CreditKind; ko: string; price: number }[] = [
  { key: 'reading', ko: '사주 풀이', price: 19900 }, { key: 'ziwei', ko: '자미두수', price: 14900 }, { key: 'compat', ko: '궁합', price: 4900 }, // 궁합 3900→6900: 사주+자미 2탭 묶음(daniel 06-29, 쌍당 1회로 두 탭·년도 온디맨드). ASC 실가는 fastlane(daniel)
  { key: 'timeline', ko: '인생 타임라인', price: 1900 }, { key: 'followup', ko: '추가 질문', price: 990 }, { key: 'love', ko: '나의 애정흐름', price: 9900 }, // 타임라인 990→1990→1900(daniel 07-02: 1990은 애플 KOR 티어 없어 1900). ASC 실가 1900(fastlane/asc-price.js)
  // 스페셜(고비용 LLM) — 광고 게이트 제거·건당 결제 전환(daniel 2026-06). 오늘/이달은 저비용이라 광고 무료 유지.
  { key: 'newyear', ko: '신년운세', price: 9900 }, { key: 'lifegraph', ko: '인생 그래프', price: 3900 },
  // 심층 콘텐츠(daniel 2026-06): 뿌리(통근·투출)·비치는 나(천간 인상)·나의 사명(격국·용신 + 자미 보조)
  { key: 'roots', ko: '명식의 뿌리', price: 4900 }, { key: 'image', ko: '비치는 나', price: 4900 }, { key: 'mission', ko: '나의 사명', price: 6900 },
  // 신규(daniel 2026-06): 사업가의 나 vs 직장인의 나(명식+대운+세운, 6카테고리)
  { key: 'career', ko: '사업가의 나', price: 4900 },
  // 신규(daniel 2026-06-23): 나의 타고난 재능(월지 축 백본 — 재능·동기·재물)
  { key: 'talent', ko: '나의 타고난 재능', price: 4900 },
  // 신규(daniel 2026-06-23): 수비학(피타고리안)·별자리 운세(서양 네이탈) — 도메인=Claude 표준 레퍼런스 인코딩, 가격=api_usage 실측 후 daniel 확정
  { key: 'astrology', ko: '별자리 운세', price: 4900 },
  // AI 꿈해몽 — 5회 번들 ₩2,500(=₩500/회, daniel 06-28). Apple IAP 번들 판매(ASC credit_dream=2500). price=건당 참조값.
  { key: 'dream', ko: 'AI 꿈해몽', price: 500 },
  // 신규(daniel 2026-06-24): 맞춤 개운법(원국+지금 운 → 구체 처방·살풀이). 가격 daniel 조정 슬롯.
  { key: 'gaeun', ko: '맞춤 개운법', price: 4900 },
  // 신규(daniel 2026-06-24 기획 B): 세계 인물 매칭(유명인 사주 ↔ 나 — 재미·추정, 투자/정치 단정 금지). 1회 결제로 전 인물 열람(인물별 캐시).
  { key: 'celeb', ko: '세계 인물 매칭', price: 1200 }, // 결정론(비용0)·앱스토어 최소가(daniel 06-28)
  // 신규(daniel 2026-06-28): 태어난 시 찾기(TPR — 시 모르는 사용자가 인생 사건으로 시주 역추론). 결정론(비용0)·1회 결제로 도구 영구 해제(재실행 무료, 사건 추가로 정제).
  { key: 'timeresolve', ko: '태어난 시 찾기', price: 990 },
  // 신규(daniel 2026-07-02): 10년 뒤 나의 모습(대운·세운으로 보는 10년 뒤 — 스페셜, 개별 유료).
  { key: 'future10', ko: '10년 뒤 나의 모습', price: 4900 }, // 가격 daniel 확정(API 비용 측정 후)
  // 신규(daniel 2026-07-02): 자식운(원국으로 보는 자녀 인연·기질 — 프리미엄 포함, 비프리미엄은 개별 유료).
  { key: 'child', ko: '자식운', price: 9900 }, // 가격 daniel 확정(07-03: 12900→9900). 부부모드=단일 구매자 반값 업그레이드
  // 신규(daniel 2026-07-03): 자식운 · 부부 = 솔로(child) 소유자 전용 반값 업그레이드(9900의 절반 4950). 별도 kind → 솔로 소유가 부부를 자동 해제하지 않음.
  { key: 'child_couple', ko: '자식운 · 부부', price: 4900 }, // ASC 실가 ₩4,900(Apple KOR에 4950 없어 최근접). RC가 실가 fetch·이건 폴백
];
export const PREMIUM_PRICE = 49900; // 평생 프리미엄(대표명식 전부 무제한). daniel: 사업가 등 헤비유저(궁합 반복) 타겟 — 일반은 건당/쿠폰. 프리미엄은 소수 기대.

export type RedeemResult =
  | { ok: true; kind: string; qty: number }
  | { ok: false; error: string };

/** 쿠폰 코드 사용 → 크레딧/올패스 부여(서버 redeem_coupon RPC). 1인 1쿠폰 1회. */
export async function redeemCoupon(code: string): Promise<RedeemResult> {
  const { data, error } = await supabase.rpc('redeem_coupon', { p_code: code });
  if (error) return { ok: false, error: error.message };
  return data as RedeemResult;
}

/** 보유 크레딧(파트별 잔여 수) — 설정 표시·게이트 사전 확인용(RLS 본인만). */
export async function loadCredits(): Promise<Record<string, number>> {
  if (!(await hasSession())) return localCreditsAll();    // 비로그인 = 디바이스 로컬(H)
  const { data } = await supabase.from('entitlement_credits').select('kind, remaining');
  const out: Record<string, number> = {};
  (data ?? []).forEach((r: any) => { if (r.remaining > 0) out[r.kind] = r.remaining; });
  return out;
}

/** 크레딧 1 소비(use_credit RPC) — 있으면 차감 후 true(무료 진행), 없으면 false(기존 결제 게이트). */
export async function useCredit(kind: CreditKind): Promise<boolean> {
  if (!(await hasSession())) return localUse(kind);        // 비로그인 = 로컬 차감(H)
  const { data, error } = await supabase.rpc('use_credit', { p_kind: kind });
  const ok = !error && data === true;
  logEvent('credit_use', { kind, ok }); // 이용권 차감 로그
  return ok;
}

/**
 * 이용권 구매 성공 시 크레딧 부여(grant_credit RPC). 마켓에서 결제 완료 후 호출 → 잔여 +qty.
 * ⚠️ 결제 검증은 RevenueCat 웹훅이 정식 — 현재는 클라 구매 성공 후 호출(신뢰기반, daniel 슬롯).
 * @returns 부여 후 잔여 수(실패 시 null)
 */
export async function grantCredit(kind: CreditKind, qty = 1): Promise<number | null> {
  if (!(await hasSession())) { await localGrant(kind, qty); return qty; } // 비로그인 = 로컬 적립(로그인 시 이관, H)
  // ⚠️ 로그인 서버 적립(grant_credit)은 migration 0010 으로 authenticated 회수됨(C1 보안) → 이 경로는 실패(null).
  //    결제 후 적립은 RC 웹훅(영수증 검증)이 수행 → 호출처는 grantCredit 대신 waitForCreditGrant 로 반영을 폴링한다.
  //    (남은 grantCredit 호출은 비로그인 localGrant · migrateCredits 안전가드 등 non-minting 경로뿐.)
  const { data, error } = await supabase.rpc('grant_credit', { p_kind: kind, p_qty: qty });
  logEvent('credit_grant', { kind, qty, total: error ? null : data, ok: !error }, error ? 'error' : 'info'); // 이용권 부여 로그(결제→적립)
  return error ? null : (data as number);
}

/**
 * 결제(RevenueCat) 후 웹훅(rc-webhook)이 서버에 이용권을 적립할 때까지 폴링 대기(C1 보안 — daniel 2026-07-03).
 * ─────────────────────────────────────────────────────────────────────────
 * 배경: 클라가 grant_credit 을 직접 호출하던 방식을 폐지(영수증 미검증 결제 우회, migration 0010 회수).
 *   이제 *영수증 검증된 RC 웹훅*만 entitlement_credits 를 적립하므로, 결제 성공 → 서버 반영까지 짧은 지연이 있다.
 *   loadCredits 를 여러 번 조회해 해당 kind 잔여가 baseline 보다 늘면 반영 완료로 본다(비로그인 로컬 적립도 즉시 반영).
 *   타임아웃이면 미반영(granted=false) — 호출처가 '적용 중' 안내 후 재시도를 유도한다.
 * @param kind 기다릴 이용권 종류
 * @param opts.baseline 결제 직전 잔여 수(이 값보다 커지면 반영됨). 결제 게이트는 잔여 0 에서 진입하므로 기본 0.
 * @param opts.tries 최대 조회 횟수(기본 8), opts.intervalMs 조회 간격 ms(기본 800) → 기본 최대 ~6.4s 대기
 * @returns { granted, credits } granted=반영 확인 여부, credits=최신 보유 맵(호출처 setState 용)
 */
export async function waitForCreditGrant(
  kind: CreditKind,
  opts: { baseline?: number; tries?: number; intervalMs?: number } = {},
): Promise<{ granted: boolean; credits: Record<string, number> }> {
  const baseline = opts.baseline ?? 0;
  const tries = opts.tries ?? 8;
  const intervalMs = opts.intervalMs ?? 800;
  let credits = await loadCredits();
  // 아직 미반영이면 간격을 두고 재조회(웹훅 도달 대기). 이미 반영됐으면 루프 없이 즉시 반환.
  for (let i = 0; i < tries && (credits[kind] ?? 0) <= baseline; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    credits = await loadCredits();
  }
  const granted = (credits[kind] ?? 0) > baseline;
  logEvent('credit_wait', { kind, granted }, granted ? 'info' : 'error'); // 웹훅 반영 관측(지연·미반영 추적)
  return { granted, credits };
}
