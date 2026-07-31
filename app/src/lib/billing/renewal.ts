// app/src/lib/billing/renewal.ts — 재통변 흐름(코인 결제 · daniel 2026-07-30)
// ─────────────────────────────────────────────────────────────────────────
// 배경: Edge interpret 재통변 게이트가 `renewRequired{kind, coins}`(운세형 & 생성 1년 경과 & refresh)를
//   돌려주면 이 흐름을 호출한다. 사용자에게 **코인가를 보여주고 동의를 받아** 재시도하면,
//   그 재시도(`renewConfirm:true`)에서 서버가 코인을 빼고 최신 모델·현재 운으로 다시 생성한다.
//
// ★★무엇이 바뀌었나(daniel "재통변은 코인으로 바꿔"):
//   종전: 할인 SKU(`credit_<kind>_r30/_r10`)를 **스토어에서 구매** → 웹훅 적립 대기 → 재시도.
//     · 그 SKU 는 **Play 에 등록조차 없었다**(07-30 코인 단일화폐로 확정) → 안드로이드에선 100% 실패.
//     · 할인율이 프리미엄 티어(30%/10%)로 갈렸는데 프리미엄은 07-28 폐지됐다.
//     · 웹훅 적립 폴링(waitForCreditGrant)이라는 취약한 대기 구간도 있었다.
//   지금: **코인 확인·동의 → 서버가 생성 직전 차감.** 스토어 왕복 0 · 웹훅 0 · 폴링 0.
//
// ★차감은 여기서 하지 않는다 — 클라 선차감은 과차감·우회 위험(coinGate 와 같은 원칙).
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { Alert } from '../ui/alert'; // 커스텀 알림(큐 기반 크래시 방지)
import { coinBalanceOrNull, coinPriceOf } from './coins';
import { renewalCoinCost, RENEWAL_COIN_DISCOUNT_PCT } from './repurchase';
import { notifyNetworkError } from '../backend/network';

/**
 * 재통변 유도 → 코인 확인·동의 → onDone(동의 플래그를 실어 재생성 재시도).
 *
 * @param opts.kind     interpret 가 알려준 재통변 kind(운세형: reading·ziwei·compat·love·newyear·reunion·crush·job·jobfit·timeline·lifegraph·future10)
 * @param opts.coins    서버가 계산한 재통변 코인가(**권위**). 없으면 앱이 같은 식으로 파생(구버전 서버 호환).
 * @param opts.t        i18n
 * @param opts.goCharge 코인 충전 화면으로 이동
 * @param opts.onDone   동의 완료 → **renewConfirm:true 로** 재생성 재시도(여기서 서버가 차감한다)
 *
 * 사용자가 취소하거나 잔액을 확인할 수 없으면 조용히 no-op(재통변 안 함).
 */
export async function runContentRenewal(opts: {
  kind: string;
  coins?: number;
  t: (k: any, d?: any) => string;
  goCharge: () => void;
  onDone: () => void;
}): Promise<void> {
  const { kind, t, goCharge, onDone } = opts;
  // 가격은 **서버 값이 권위**다. 서버가 안 줬을 때만 같은 식으로 파생한다.
  const cost = opts.coins ?? renewalCoinCost(coinPriceOf(kind) ?? 0);
  if (!(cost > 0)) return;   // 운가 미등록(check:coins 가 잡는다) — 사용자를 막지 않고 조용히 종료

  // ★잔액 '0'과 '조회 실패'를 구분한다 — 실패를 부족으로 읽으면 이미 충전한 사용자에게 재충전을 유도한다.
  const bal = await coinBalanceOrNull();
  if (bal === null) {
    notifyNetworkError(`${kind}.renewalBalance`, new Error('balance unavailable'), t);
    return;
  }

  if (bal < cost) {
    Alert.alert(
      t('renewal.needTitle', 'woon이 부족해요'),
      t('renewal.needMsg', { need: cost, have: bal, defaultValue: '재통변에는 {{need}} woon이 필요해요. 지금 {{have}} woon 있어요.' }),
      [
        { text: t('common.cancel', '취소'), style: 'cancel' },
        { text: t('coins.charge', '충전하기'), onPress: goCharge },
      ],
    );
    return;
  }

  const ok = await new Promise<boolean>((resolve) => {
    Alert.alert(
      t('renewal.title', '최신 통변으로 다시 받기'),
      t('renewal.msg', {
        pct: RENEWAL_COIN_DISCOUNT_PCT, coins: cost, have: bal,
        defaultValue: '이 풀이를 받은 지 1년이 지났어요.\n\n{{pct}}% 할인된 {{coins}} woon으로 지금 시점 기준으로 다시 풀어 드려요. (보유 {{have}} woon)',
      }),
      [
        { text: t('renewal.later', '다음에'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('renewal.go', '재통변하기'), onPress: () => resolve(true) },
      ],
    );
  });
  if (!ok) return;
  onDone();   // ★재시도는 반드시 renewConfirm:true 로 — 서버가 이 플래그가 있을 때만 청구한다
}
