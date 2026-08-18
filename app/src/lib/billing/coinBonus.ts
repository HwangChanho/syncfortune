// app/src/lib/billing/coinBonus.ts — 운 충전 보너스 쿠폰 (시안 홈의 할인 티켓)
// ═══════════════════════════════════════════════════════════════════════════
// ■ '할인'이 아니라 '보너스'인 이유 (기술 제약)
//   충전은 스토어 인앱결제라 **가격을 앱이 바꿀 수 없다.** 그래서 정가로 결제하고 운을 더 얹는다.
//   자세한 판단 근거는 `supabase/migrations/0025_coin_bonus_coupons.sql` 머리말.
//
// ■ 앱이 하는 일은 '불러 주는 것'뿐
//   금액·비율을 **넘기지 않는다.** 서버 RPC(`claim_coin_bonus`)가 내 원장과 쿠폰만 보고 계산한다.
//   앱이 숫자를 넘기면 그건 곧 무한 충전 취약점이다([[payment-gate-security]]).
//
// ■ 언제 부르나 — 아무 때나 불러도 안전하다(멱등)
//   ① 충전 성공 직후 ② 앱이 충전 화면·마이페이지에 들어올 때
//   결제 직후 앱이 죽어도 다음에 부르면 붙는다. 이중 지급은 `coin_ledger.ref` 유니크가 막는다.
//   실측(2026-08-18): 같은 상태에서 3번 호출 → 40 / 0 / 0.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';
import { logEvent } from '../backend/logger';

/** 보유 쿠폰 한 장. */
export type BonusCoupon = { id: number; bonusPct: number; label: string | null; expiresAt: string | null };

/**
 * 아직 안 쓴 보너스 쿠폰(큰 것부터).
 * @returns 쿠폰들. 조회 실패·비로그인이면 빈 배열(없는 것과 같이 다룬다 — 쿠폰은 '있으면 좋은 것'이라
 *          실패를 굳이 화면에 알리지 않는다. 잔액과 달리 오해로 돈을 쓰게 만들지 않는다)
 */
export async function listBonusCoupons(): Promise<BonusCoupon[]> {
  try {
    const r = await withTimeout(
      supabase.from('coin_coupons').select('id, bonus_pct, label, expires_at')
        .is('used_at', null).order('bonus_pct', { ascending: false }),
      8000,
    );
    if (!r || r.error || !r.data) return [];
    const now = Date.now();
    return (r.data as any[])
      .filter((c) => !c.expires_at || new Date(c.expires_at).getTime() > now)   // 만료분은 보여 주지 않는다
      .map((c) => ({ id: c.id, bonusPct: c.bonus_pct, label: c.label ?? null, expiresAt: c.expires_at ?? null }));
  } catch { return []; }
}

/**
 * 아직 보너스가 안 붙은 충전에 쿠폰을 붙인다.
 *
 * @returns 이번에 얹어 준 운(0 = 붙일 게 없었다). 실패해도 0 — 다음 호출에서 다시 시도된다.
 * ★멱등이라 화면 진입마다 불러도 된다.
 */
export async function claimCoinBonus(): Promise<number> {
  try {
    // ★`withTimeout` 은 타임아웃 시 undefined 를 준다 → 구조분해를 쓸 수 없다. 변수로 받아 `.error` 를 본다.
    const r = await withTimeout(supabase.rpc('claim_coin_bonus'), 8000);
    if (!r || r.error) {
      // 조용히 넘기되 **기록은 남긴다** — 보너스가 안 붙었다는 문의가 오면 이 로그가 근거다.
      logEvent('coin_bonus_failed', { err: String(r?.error?.message ?? 'timeout') });
      return 0;
    }
    const granted = Number(r.data ?? 0) || 0;
    if (granted > 0) logEvent('coin_bonus_claimed', { granted });   // 지급은 반드시 기록(분쟁 근거)
    return granted;
  } catch { return 0; }
}

/**
 * 첫 충전 보너스 쿠폰을 (자격이 되면) 받아 둔다.
 *
 * @returns 이번에 새로 받았는가
 * ★조건 판정은 **전부 서버**가 한다 — 앱은 부르기만 한다. 충전 이력 유무·중복 발급 모두 서버 데이터로 본다.
 *   (앱이 "나 신규야"라고 말할 수 있으면 그건 무한 발급이다.)
 * ★멱등 — 화면 진입마다 불러도 한 장뿐이다. 실측(2026-08-18): 3회 호출 → true / false / false.
 */
export async function claimWelcomeCoupon(): Promise<boolean> {
  try {
    const r = await withTimeout(supabase.rpc('claim_welcome_coupon'), 8000);
    if (!r || r.error) {
      logEvent('welcome_coupon_failed', { err: String(r?.error?.message ?? 'timeout') });
      return false;
    }
    const got = r.data === true;
    if (got) logEvent('welcome_coupon_granted', {});
    return got;
  } catch { return false; }
}
