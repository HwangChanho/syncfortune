// app/src/lib/ui/themeElement.ts — 대표명식 일간 오행 → 테마 강조색 소스 저장
// ─────────────────────────────────────────────────────────────────────────
// theme.ts 는 엔진 의존 없이 저장된 오행 문자열(pref.themeElement)만 읽는다. 그 값을 채우는 쪽.
//   대표명식을 로드→computeChart→일간(dayMaster.stem)→오행(stemElement) 산출 후 storeChartElement.
//   _layout 시작 + 대표명식 변경 시 호출. auto 강조 모드일 때 다음 앱 로드에 일간 색이 반영된다.
//   (theme.ts 는 모듈 로드 시점 결정이라 실시간 아님 — 다음 실행/재시작에 적용. 설정에서 즉시 변경도 가능.)
// ─────────────────────────────────────────────────────────────────────────
import { loadRepChart } from '../engine/myChart';
import { computeChart } from '../engine/engine';
import { stemElement } from '../engine/ohaeng';
import { storeChartElement } from '../theme';

/** 대표명식 일간 오행을 산출해 theme 강조색 소스로 저장. 실패/명식없음=무시. */
export async function syncThemeElement(): Promise<void> {
  try {
    const rep = await loadRepChart();
    if (!rep?.input) return;
    const stem = computeChart(rep.input).saju?.dayMaster?.stem;
    if (stem) storeChartElement(stemElement(stem));
  } catch { /* 무시(테마는 다음 로드에 반영) */ }
}
