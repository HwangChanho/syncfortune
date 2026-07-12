// app/src/lib/ui/confirmChart.ts
// ─────────────────────────────────────────────────────────────────────────
// 풀이 생성 전 '적용 명식 확인' + 보유 이용권 안내(daniel 07-02).
//   ★확인창에서 드롭다운으로 *명식 변경*까지 가능(daniel) → 실제 UI는 전역 모달 ChartConfirmHost(lib/ui/chartConfirm).
//   여기선 그 모달을 호출하고, 확인 시에만 onConfirm(기존 결제/생성 로직) 실행한다(호출부 시그니처 유지 — 화면 변경 없음).
//   명식 변경 시 모달이 대표를 전환하므로, onConfirm의 생성은 (전환된) 현재 대표 명식 기준으로 진행된다.
//   ★수동 생성 = confirmReadingChart(항상 확인). 자동생성(프리미엄/관리자 진입 즉시) = autoGenWithChartConfirm
//     (명식 2개 이상일 때만 확인 — daniel 2026-07-13: 자동생성이 '어느 명식?'을 안 묻고 로딩영상부터 뜨던 것 수정).
// ─────────────────────────────────────────────────────────────────────────
import { requestChartConfirm } from './chartConfirm';
import { listCharts } from '../engine/myChart';
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
  // ★확인 모달이 완전히 닫힌 뒤 생성 시작(daniel 07-11 '애정흐름 자물쇠 안 나와'): 생성이 곧바로 setBusy→UnlockOverlay(Modal)를 띄우는데,
  //   확인 모달(Modal)이 아직 dismiss 애니 중이면 iOS는 한 번에 하나만 present → 자물쇠 오버레이가 표시 안 됨. dismiss 완료 후 시작.
  if (ok) setTimeout(() => opts.onConfirm(), 380);
}

/**
 * 자동생성(프리미엄/관리자 진입 즉시 생성) 전 명식 확인 — **명식이 2개 이상일 때만** 확인모달을 먼저 띄운다.
 *   ★daniel 2026-07-13: 명식이 여러 개면 자동생성이 '어느 명식?'을 안 묻고 로딩영상부터 뜨던 것 수정.
 *   명식 1개(또는 조회 실패) = 모호함 없음 → 바로 생성(기존 seamless 유지). 취소하면 생성 안 함.
 * @param creditKind 이 풀이의 이용권 종류(모달에 보유 개수 표시용, 무료 콘텐츠는 생략)
 * @param onConfirm  확인(또는 단일 명식) 시 진행할 생성 콜백
 */
let _autoConfirmPending = false; // 확인모달 진행 중 가드 — 모달에서 명식 변경 시 화면 재로드로 auto-gen 이 재발동해도 모달 재오픈/루프 방지.
export async function autoGenWithChartConfirm(opts: { creditKind?: CreditKind; onConfirm: () => void }): Promise<void> {
  if (_autoConfirmPending) return; // 이미 확인 진행 중(재발동) = 무시. 사용자가 닫으면 그 확인의 onConfirm 이 생성 담당.
  let count = 1;
  try { count = (await listCharts()).length; } catch { /* 조회 실패 = 단일로 간주(바로 생성) */ }
  if (count > 1) {
    _autoConfirmPending = true;
    try { await confirmReadingChart({ creditKind: opts.creditKind, onConfirm: opts.onConfirm }); } // 여러 개 → 확인 먼저(내부 380ms 후 생성)
    finally { _autoConfirmPending = false; }
  } else {
    opts.onConfirm(); // 1개 → 모호함 없음, 바로 생성
  }
}
