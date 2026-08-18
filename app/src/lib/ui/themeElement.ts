// app/src/lib/ui/themeElement.ts — **지금 적용된 명식**의 일간 오행 → 테마 색 소스 저장
// ─────────────────────────────────────────────────────────────────────────
// theme.ts 는 엔진 의존 없이 저장된 오행 문자열(pref.themeElement)만 읽는다. 그 값을 채우는 쪽.
//   적용 명식을 로드→computeChart→일간(dayMaster.stem)→오행(stemElement) 산출 후 storeChartElement.
//   _layout 시작 + **명식 변경 시**(subscribeRepChange) 호출. auto 모드면 그 오행 세트로 화면이 간다.
//   (theme.ts 는 모듈 로드 시점 결정이라 실시간 아님 — 다음 실행/재시작에 적용. 설정에서 즉시 변경도 가능.)
// ─────────────────────────────────────────────────────────────────────────
import { loadRepChart, listCharts } from '../engine/myChart';
import { computeChart } from '../engine/engine';
import { stemElement } from '../engine/ohaeng';
import { storeChartElement, hasChartElement } from '../theme';

/**
 * 지금 적용된 명식의 일간 오행을 산출해 테마 색 소스로 저장한다.
 *
 * @returns **화면에 지금 반영해야 하는가** — 오행이 실제로 바뀌었고 강조 모드가 `auto` 일 때만 true.
 *   ★리로드는 여기서 하지 않는다. 화면 경로를 아는 쪽(`_layout`)이 `applyThemeNow(경로)` 를 부른다
 *     — 그래야 리로드 뒤 **있던 화면으로 돌아온다**(daniel 2026-07-18 "홈으로 튕겨서").
 * 실패/명식없음 = false(아무 일도 하지 않는다).
 */
export async function syncThemeElement(_reload = false): Promise<boolean> {
  try {
    // ★★테마 소스 = **지금 적용된 명식**(Boss 2026-08-18 *"앱 배경테마는 대표명식말고 현재 적용된 명식 기준으로"*).
    //
    //   ⚠️이건 **2026-07-18 판단을 뒤집는 것**이다. 그때는 정반대였다:
    //     "loadRepChart(대표)는 만세력 '보기'로 **마지막 본 명식**으로 오염된다 → 앱 시작 테마가
    //      본인이 아니라 마지막 본 명식 색이 됐다" → 그래서 self 고정으로 바꿨었다.
    //   ⇒ 그 '오염'이 이제는 **의도한 동작**이다. 07-18 엔 오행이 배경 톤만 바꿨고, 지금은 시안이
    //     오행 5색 세트라 **화면 전체**가 바뀐다 — 누구를 보고 있는지가 색으로 드러나는 편이 맞다.
    //   ★그래서 self 폴백을 남긴다: 아직 아무 명식도 안 고른 상태에서는 본인 색으로 시작한다.
    const src = (await loadRepChart()) ?? (await listCharts()).find((c) => c.relation === 'self');
    if (!src?.input) return false;
    const stem = computeChart(src.input).saju?.dayMaster?.stem;
    if (!stem) return false;
    return storeChartElement(stemElement(stem));
  } catch { return false; }   /* 무시(테마는 다음 로드에 반영) */
}

/**
 * 테마 오행이 **아직 한 번도 정해지지 않았을 때만** 본인 명식으로 초기화한다.
 *
 * ★앱 실행마다 부르지만, 저장값이 있으면 아무것도 하지 않는다 —
 *   `preferSelfAsRep()` 이 대표를 본인으로 되돌려도 **마지막으로 고른 명식의 색이 유지**되도록
 *   (Boss 2026-08-18 ②안: 테마 소스를 대표와 분리).
 */
export async function ensureThemeElement(): Promise<void> {
  if (hasChartElement()) return;   // 이미 정해져 있다 — 사용자의 선택을 덮지 않는다
  await syncThemeElement();
}
