// app/src/lib/ui/confirmChart.ts
// ─────────────────────────────────────────────────────────────────────────
// 풀이 생성 전 '적용 명식 확인' + 보유 이용권 안내(daniel 07-02).
//   ★확인창에서 드롭다운으로 *명식 변경*까지 가능(daniel) → 실제 UI는 전역 모달 ChartConfirmHost(lib/ui/chartConfirm).
//   여기선 그 모달을 호출하고, 확인 시에만 onConfirm(기존 결제/생성 로직) 실행한다(호출부 시그니처 유지 — 화면 변경 없음).
//   명식 변경 시 모달이 대표를 전환하므로, onConfirm의 생성은 (전환된) 현재 대표 명식 기준으로 진행된다.
//   프리미엄 자동생성(무버튼)엔 쓰지 않는다 — 사용자가 직접 '보기'를 누른 수동 생성에만.
// ─────────────────────────────────────────────────────────────────────────
import { requestChartConfirm } from './chartConfirm';
import type { CreditKind } from '../billing/coupons';

/**
 * 풀이 생성 전 명식 확인 모달(드롭다운 변경 가능). 확인 시 onConfirm() 실행.
 * @param creditKind 이 풀이의 이용권 종류(있으면 보유 개수 표시)
 * @param chartless  명식 무관 콘텐츠(꿈해몽 등)=목록 없이 확인만
 * @param onConfirm  확인 시 진행할 콜백(기존 결제/생성 로직)
 * (chartLabel·t 는 하위호환 인자 — 모달이 자체적으로 목록·문구를 렌더하므로 미사용)
 */
export async function confirmReadingChart(opts: {
  chartLabel?: string | null;
  creditKind?: CreditKind;
  chartless?: boolean;
  t?: unknown;
  onConfirm: () => void;
}): Promise<void> {
  const ok = await requestChartConfirm({ creditKind: opts.creditKind, chartless: opts.chartless });
  if (ok) opts.onConfirm();
}
