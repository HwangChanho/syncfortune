// app/src/lib/ui/confirmChart.ts
// ─────────────────────────────────────────────────────────────────────────
// 풀이 생성 전 '적용 명식 확인' + '보유 이용권 개수' 안내(daniel 07-02).
//   ★모든 유료 풀이는 생성(결제·차감) 직전에 "이 명식으로 풀이할지"를 사용자에게 확인시킨다
//   (엉뚱한 명식으로 결제·생성되는 사고 방지). 이용권(쿠폰)을 보유 중이면 몇 개인지도 함께 보여준다.
//   각 화면의 onStart는 이 헬퍼로 감싼다: confirmReadingChart({...onConfirm: 기존 생성/결제 로직}).
//   프리미엄 자동생성(무버튼)에는 쓰지 않는다 — 사용자가 직접 '보기'를 누른 수동 생성에만.
// ─────────────────────────────────────────────────────────────────────────
import { Alert } from './alert';
import { loadCredits, type CreditKind } from '../billing/coupons';
import type { TFunction } from 'i18next';

/**
 * 풀이 생성 전 확인 다이얼로그. 확인 시 onConfirm() 실행.
 * @param chartLabel 적용 명식 이름(savedChart.label) — 없으면 '현재 명식'
 * @param creditKind 이 풀이의 이용권 종류(있으면 보유 개수 표시) — 프리미엄/세트 등 이용권 무관이면 생략
 * @param t i18n
 * @param onConfirm 확인 시 진행할 콜백(기존 결제/생성 로직)
 */
export async function confirmReadingChart(opts: {
  chartLabel?: string | null;
  creditKind?: CreditKind;
  chartless?: boolean; // true = 명식 기반 아님(꿈해몽 등) → '명식' 문구 없이 이용권 개수만 확인
  t: TFunction;
  onConfirm: () => void;
}): Promise<void> {
  const { chartLabel, creditKind, chartless, t, onConfirm } = opts;
  let couponLine = '';
  if (creditKind) {
    try {
      const n = (await loadCredits())[creditKind] ?? 0;         // 보유 이용권 개수(없으면 0)
      if (n > 0) couponLine = '\n\n' + t('confirmChart.credits', { n, defaultValue: `보유 이용권: ${n}개` });
    } catch { /* 조회 실패 시 개수 생략(확인은 그대로 진행) */ }
  }
  const name = chartLabel && chartLabel.trim() ? chartLabel : t('confirmChart.thisChart', '현재 명식');
  const body = chartless
    ? t('confirmChart.msgNoChart', '풀이를 만들게요. 계속할까요?')                                   // 명식 무관(꿈해몽 등)
    : t('confirmChart.msg', { name, defaultValue: `'${name}' 명식으로 풀이를 만들게요. 계속할까요?` }); // 명식 기반
  Alert.alert(
    chartless ? t('confirmChart.titleNoChart', '풀이 확인') : t('confirmChart.title', '풀이 명식 확인'),
    body + couponLine,
    [
      { text: t('common.cancel', '취소'), style: 'cancel' },
      { text: t('confirmChart.ok', '네, 볼게요'), onPress: onConfirm },
    ],
  );
}
