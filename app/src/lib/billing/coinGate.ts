// app/src/lib/billing/coinGate.ts — 유료 콘텐츠 진입 게이트(코인 단일 경로)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-28: "기존 단건 결제는 다 없애. 결제 프로세스 바꿔야지 코인으로 하니깐"
//
// ★공용 함수 하나로 만든 이유: 종전에는 화면마다 결제 흐름을 각자 구현했다(6곳).
//   그래서 오늘 하루에만 **같은 결함이 화면마다 따로** 드러났다 —
//   로딩 표시 없음 / 조회 실패를 '없음'으로 오해해 재결제 유도 / 적립 폴링이 앱 상태에 의존.
//   흐름을 한 곳에 모으면 고칠 곳도 한 곳이 된다.
//
// 흐름: 코인가 조회 → 잔액 조회 → ①부족: 충전 화면 유도 ②충분: 사용 확인 → true
//   ★차감은 여기서 하지 않는다. **서버(Edge interpret)가 생성 직전에 원자적으로 뺀다**
//     (클라 선차감은 과차감·우회 위험 — 보안 P3 결정 유지).
//   ★잔액 '0'과 '조회 실패'를 반드시 구분한다 — 실패를 부족으로 읽으면 이미 충전한 사용자에게
//     재충전을 유도하게 된다(2026-07-28 재결제 사고와 같은 유형).
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { Alert } from '../ui/alert';
import { coinPriceOf, coinBalanceOrNull } from './coins';
import { notifyNetworkError } from '../backend/network';

export type CoinGateResult = 'ok' | 'insufficient' | 'cancel' | 'error' | 'noprice';

/**
 * 유료 콘텐츠를 열기 전 코인 확인·동의를 받는다.
 * @param kind 콘텐츠 kind(reading·compat·dream…)
 * @param opts title=알림 제목 · t=i18n · goCharge=충전 화면 이동
 * @returns 'ok'면 호출측이 생성을 진행한다(차감은 서버). 그 외는 진행하지 않는다.
 *
 * ⚠️'noprice'(코인가 미등록)는 **신규 콘텐츠 등록 누락** 신호다 — check:coins 가 잡지만,
 *   런타임에서는 막지 말고 호출측이 종전 경로로 폴백하게 둔다(사용자가 갇히지 않도록).
 */
export async function ensureCoinsFor(
  kind: string,
  opts: { title: string; t: (k: any, d?: any) => string; goCharge: () => void },
): Promise<CoinGateResult> {
  const { title, t, goCharge } = opts;
  const cost = coinPriceOf(kind);
  if (cost == null) return 'noprice';

  const bal = await coinBalanceOrNull();
  if (bal === null) {
    // ★확인 불가 ≠ 부족. 충전을 권하면 안 된다.
    notifyNetworkError(`${kind}.coinBalance`, new Error('balance unavailable'), t);
    return 'error';
  }

  if (bal < cost) {
    return await new Promise<CoinGateResult>((resolve) => {
      Alert.alert(
        t('coins.needTitle', '운이 부족해요'),
        t('coins.needMsg', { need: cost, have: bal, defaultValue: '이 풀이는 {{need}}운이 필요해요. 지금 {{have}}운 있어요.' }),
        [
          { text: t('common.cancel'), style: 'cancel', onPress: () => resolve('cancel') },
          { text: t('coins.charge', '충전하기'), onPress: () => { goCharge(); resolve('insufficient'); } },
        ],
      );
    });
  }

  return await new Promise<CoinGateResult>((resolve) => {
    Alert.alert(
      title,
      t('coins.spendMsg', { cost, have: bal, defaultValue: '{{cost}}운을 사용해 풀이를 시작할까요? (보유 {{have}}운)' }),
      [
        { text: t('coins.spend', '운 사용'), onPress: () => resolve('ok') },
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve('cancel') },
      ],
    );
  });
}
