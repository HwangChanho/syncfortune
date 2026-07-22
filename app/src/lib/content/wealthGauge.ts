// app/src/lib/content/wealthGauge.ts — 재물 결 '밑그림' 저울 (온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 무료 퍼널(wealth): 유료 LLM '재물 딥리포트'(kind='wealth') '위'에 결정론 무료 '재물 밑그림'을 먼저
//   보여줘 자연스러운 유료 전환을 만든다(jobfit/career 티저와 같은 결). supabase/Edge 절대 호출 안 함.
//
// ▶ 계량 방식 = careerGauge 와 동일한 십신 활성 가중(투출 1.0 / 본기 0.55 / 지장간 중기·여기 0.25).
//   그 중 **정재·편재·식상만** 분리 집계해 '재물 결 방향'만 산출한다(발명 아님 — 표준 십신 계량 재사용).
// ▶ ★드리프트 방지(핵심): 재물 '그릇 등급(大/中/小)·감당(신강약)·유입 시기·처방'의 *확정 판정*은
//   전적으로 L1 wealthReport.ts(유료 딥리포트)의 몫이다. 이 티저는 그 판정을 **하지 않는다** —
//   오직 '어느 결이 조금 더 강한가'라는 *방향 tilt*(soft)만 보여준다. 등급·부자/가난 단정 절대 금지.
//   (같은 정재>편재라도 유료는 가중 quantifySipseong 로 최종 유형을 확정 — 여긴 방향 밑그림일 뿐.)
// ▶ §4 안전(가드5 재물): 부정 증폭·가난 단정 금지 — 어느 결도 '강점'으로 전향 프레이밍.
//   ★한자·십신 용어는 이 모듈 밖(화면)에 절대 노출 X(neutral key 만) · 일상어 매핑·임계 = daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, TenGod, PillarPos } from '@spec/chart';

// careerGauge 와 동일 활성 가중(자리별 발현 강도) — 투출 > 본기 > 장간. 일관성 유지(드리프트 방지).
const W = { actTou: 1.0, actBon: 0.55, actJi: 0.25 } as const;

// 재물 성향 방향(soft·미판정). '재성약'은 흉이 아니라 '그릇부터 키우는 결'로 전향(§4).
export type WealthTilt = 'stable' | 'expansive' | 'mixed' | 'weak';

export interface WealthSignals {
  jeongjae: number;   // 정재 활성 합(안정·관리·축적 결)
  pyeonjae: number;   // 편재 활성 합(확장·사업·유통 결)
  siksang: number;    // 식상 활성 합('만들어 파는 힘' = 재를 낳는 통로·식상생재)
  jaeTotal: number;   // 재성 총합(정재+편재)
  tilt: WealthTilt;   // 재물 성향 방향(soft — 등급 아님)
  makeForce: boolean; // 재를 '직접 만드는 힘'(식상생재 통로) 유의미 여부
}

/**
 * 대표 명식 사주 → 재물 결 방향 밑그림(결정론·API 0).
 * ★그릇 등급·감당·시기 판정 없음(그건 유료 L1) — 방향 tilt 와 '버는 힘' 유무만.
 * @param saju 원국(+timeUnknown 병합). 시각 미상이면 시주 제외(careerGauge/jobGauge 관례와 동일).
 */
export function computeWealthSignals(saju: SajuChart): WealthSignals {
  const timeUnknown = (saju as any)?.timeUnknown === true;
  // 시각 미상 = 시주(時支) 제외(잘못된 성향 판정 방지) — 코드베이스 관례(careerGauge/jobGauge 동일).
  const posList: PillarPos[] = timeUnknown ? ['년', '월', '일'] : ['년', '월', '일', '시'];

  let jeongjae = 0, pyeonjae = 0, siksang = 0;

  // 한 십신 발현을 재물 3결(정재/편재/식상)에만 활성 가중으로 합산.
  const add = (tg: TenGod | undefined, act: number) => {
    if (tg === '정재') jeongjae += act;
    else if (tg === '편재') pyeonjae += act;
    else if (tg === '식신' || tg === '상관') siksang += act;
  };

  // 자리별 활성: 천간 투출(일간=주체 제외) 1.0 / 지지 본기 0.55 / 지장간 중기·여기 0.25.
  for (const p of posList) {
    const pd = saju.pillars?.[p];
    if (!pd) continue;
    if (p !== '일') add(pd.stemTenGod, W.actTou);                       // 천간 투출(일간 제외)
    add(pd.branchMainTenGod, W.actBon);                                 // 지지 본기
    for (const h of pd.hiddenStems ?? []) if (h.role !== '본기') add(h.tenGod, W.actJi); // 지장간 중기·여기(본기 중복 방지)
  }

  const jaeTotal = jeongjae + pyeonjae;

  // ── 방향 판정(soft·미확정) — 임계 = daniel 검수 슬롯 ─────────────────────────
  //   · 재성 총합이 본기급(0.55)도 안 되면 = 재성약 → 'weak'(그릇부터 키우는 결, 흉 아님).
  //   · 정·편 차이가 총합의 25% 미만 = 비등 → 'mixed'(두 결 겸비).
  //   · 그 외 우세한 쪽으로 tilt(정재우세=안정형 / 편재우세=확장형).
  let tilt: WealthTilt;
  if (jaeTotal < 0.5) tilt = 'weak';
  else if (Math.abs(jeongjae - pyeonjae) / jaeTotal < 0.25) tilt = 'mixed';
  else tilt = jeongjae > pyeonjae ? 'stable' : 'expansive';

  // 식상이 본기급(0.55) 이상이면 '만드는 힘' 유의미(식상생재 통로 존재).
  const makeForce = siksang >= 0.5;

  return { jeongjae, pyeonjae, siksang, jaeTotal, tilt, makeForce };
}
