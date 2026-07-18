// app/src/lib/ui/themeElement.ts — 대표명식 일간 오행 → 테마 강조색 소스 저장
// ─────────────────────────────────────────────────────────────────────────
// theme.ts 는 엔진 의존 없이 저장된 오행 문자열(pref.themeElement)만 읽는다. 그 값을 채우는 쪽.
//   대표명식을 로드→computeChart→일간(dayMaster.stem)→오행(stemElement) 산출 후 storeChartElement.
//   _layout 시작 + 대표명식 변경 시 호출. auto 강조 모드일 때 다음 앱 로드에 일간 색이 반영된다.
//   (theme.ts 는 모듈 로드 시점 결정이라 실시간 아님 — 다음 실행/재시작에 적용. 설정에서 즉시 변경도 가능.)
// ─────────────────────────────────────────────────────────────────────────
import { loadRepChart, listCharts } from '../engine/myChart';
import { computeChart } from '../engine/engine';
import { stemElement } from '../engine/ohaeng';
import { storeChartElement } from '../theme';

/** 대표명식 일간 오행을 산출해 theme 강조색 소스로 저장.
 *  @param reload true=대표명식을 실제로 *변경*했을 때만(즉시 리로드로 색 반영). 앱시작·포그라운드 복귀는 false(저장만·리로드 없음).
 *  실패/명식없음=무시. */
export async function syncThemeElement(reload = false): Promise<void> {
  try {
    // ★테마 소스 = '본인(self)' 명식 오행 고정(daniel 2026-07-18). 이유: loadRepChart(대표)는 만세력 '보기'
    //   (viewManse → setRepresentative)로 **마지막 본 명식**으로 오염된다 → 앱 시작 테마가 대표명식(본인)이
    //   아니라 마지막 본 명식 색이 됐다. self 명식은 안 바뀌므로 ELEMENT_KEY 가 항상 본인 오행 → 앱 시작 colors 가
    //   대표(본인) 테마. self 가 없으면(타인만 등록) 대표로 폴백.
    const charts = await listCharts();
    const src = charts.find((c) => c.relation === 'self') ?? (await loadRepChart());
    if (!src?.input) return;
    const stem = computeChart(src.input).saju?.dayMaster?.stem;
    if (stem) storeChartElement(stemElement(stem), reload);
  } catch { /* 무시(테마는 다음 로드에 반영) */ }
}
