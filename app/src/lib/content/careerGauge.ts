// app/src/lib/content/careerGauge.ts — 사업가↔직장인 성향 저울 결정론 엔진 (온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// ★★★ daniel 검수 필요 — NEW DEFAULT STANCE(십신 → 적성 기여 행렬) ★★★ ────────────────────────
//   아래 '십신 → 사업가/직장인 기여 행렬(MATRIX)'과 두 보정(신강약·파격)은 daniel 이 이번에 확정한
//   스탠스를 인코딩한 것 — 취업(jobGauge)처럼 앞으로 검수/튜닝 대상이다(가중치 = W·MATRIX 슬롯).
//   발명 아님 — 표준 십신 통설을 '축 소속(binary)'이 아니라 '양축 기여(matrix)'로 표현했을 뿐.
//
// ▶ 왜 binary 축배정이 아니라 기여 행렬인가(daniel 확정):
//   · 정재 = 고정수입·관리·안정 지향 → 실은 '직장인' 지표(사업가 아님). 사업가 본류는 편재.
//   · 편관 ≠ 안정·규범 — 승부사·권력·특수직. 편관+양인/겁재 = 자기사업·무관 카리스마.
//   · 식신(꾸준한 생산·전문성=자영/전문직) vs 상관(비정형·독립=확실히 사업가)은 결이 다르다.
//   → 그래서 각 십신이 두 축에 '동시에·다른 무게로' 기여한다. '편성↑=모험 / 정성↑=안정'은
//     축배정이 아니라 이 가중치에서 자연히 창발한다(별도 편/정 보정 레이어 없음).
// ─────────────────────────────────────────────────────────────────────────
// 무료 퍼널(career): 유료 LLM 풀이(사업가의 나 vs 직장인의 나, kind='career') '위'에 결정론 무료
//   '성향 저울'을 먼저 보여줘 자연스러운 유료 전환을 만든다(재회 ReunionRich / 취업 JobRich 와 같은 결).
//   · 무료 = 타고난 기운이 '내 사업' 쪽인지 '조직' 쪽인지 양팔저울 + 4유형 — 온디바이스·API 0.
//   · 유료 = 맞는 직종·창업 타이밍·조직 적응 전략(LLM).
//
// ▶ 결정론 근거: 엔진 십신(stemTenGod/branchMainTenGod/hiddenStems)·scoreStrength·classifyStrength·
//   analyzeTenGods 재사용(발명 아님·룰 산출만). ★한자·십신 용어는 이 모듈 밖(화면)에 절대 노출 X — neutral key 만.
//   §4(가드4 직업): 어느 쪽도 '더 낫다' 아님 — 성향 차이일 뿐(전향적). 파격도 '보완 필요'로 전향 프레이밍.
// ─────────────────────────────────────────────────────────────────────────
import { scoreStrength, classifyStrength, analyzeTenGods } from '@engine/structure'; // 신강약·왕쇠·분포 = 엔진 결정론 재사용
import type { SajuChart, TenGod, PillarPos } from '@spec/chart';

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// ══ ★daniel 확정: 십신 → (사업가, 직장인) 기여 행렬. 각 십신이 두 축에 다른 무게로 기여 ══════════════
//   상관·편재 = 사업가 본류(1.0) / 겁재(0.8)·비견(0.6) = 독립·경쟁 / 식신 = 자영·전문(사업가 0.6·직장 0.2)
//   편관 = 승부·특수직(사업가 0.3·직장 0.5) / 편인 = 전문자격 프리랜서(0.4·0.4)
//   정재 = 고정수입·관리(사업가 0.2·직장 0.6=직장 지표) / 정관·정인 = 조직·안정 순수 직장(0·1.0)
const MATRIX: Record<TenGod, { biz: number; org: number }> = {
  상관: { biz: 1.0, org: 0.0 },
  편재: { biz: 1.0, org: 0.0 },
  겁재: { biz: 0.8, org: 0.0 },  // + 동업·파재 리스크 신호(partnerRisk)로 별도 표면화
  비견: { biz: 0.6, org: 0.0 },
  식신: { biz: 0.6, org: 0.2 },
  편관: { biz: 0.3, org: 0.5 },
  편인: { biz: 0.4, org: 0.4 },
  정재: { biz: 0.2, org: 0.6 },
  정관: { biz: 0.0, org: 1.0 },
  정인: { biz: 0.0, org: 1.0 },
};
// 십신 → 5그룹(최강 신호 집계용 — 화면 일상어 매핑의 근거).
const GROUP: Record<TenGod, '비겁' | '인성' | '식상' | '재성' | '관성'> = {
  비견: '비겁', 겁재: '비겁', 정인: '인성', 편인: '인성', 식신: '식상',
  상관: '식상', 정재: '재성', 편재: '재성', 정관: '관성', 편관: '관성',
};

// ══ ★daniel 검수: 활성 강도·보정 가중치(전부 튜닝 슬롯) ══════════════════════════════════════════
//   · 활성 강도(자리별 발현) — 취업 게이지와 같은 결(투출 > 본기 > 장간): 천간 투출 1.0 / 지지 본기 0.55 / 지장간 중기·여기 0.25.
//   · 신강약 보정(±5 MAX) — 신강약은 '감당력'이지 '성향'이 아니므로 작게. 크게 걸면 성향진단이 체력진단으로 변질.
//   · 파격 디스카운트 — 격국 실패(실행 리스크) 시 저울 점수만 하향(라벨=그릇은 유지). bounded.
const W = {
  actTou: 1.0,          // 천간 투출(드러난 자리)
  actBon: 0.55,         // 지지 본기(현실에 자리잡음)
  actJi: 0.25,          // 지장간 중기·여기(숨은 기운)
  strengthTilt: 5,      // ① 신강 → 사업가 +5 / 신약 → 직장인 −5 (중화 0) · ±5 MAX
  patternDiscount: 8,   // ② 파격(군겁쟁재 등 실행 리스크) 시 사업가 저울 점수 하향폭(라벨 유지)
  partnerRiskMin: 0.55, // 겁재 활성 합이 이 값 이상이면 동업·파재 리스크 신호(본기급 이상 발현)
};
// ══════════════════════════════════════════════════════════════════════════════════════════════

export type CareerBand = 'org' | 'hybrid' | 'pro' | 'independent'; // 4유형 — 컴포넌트가 조직형/하이브리드/전문가·프리랜서형/독립사업형으로 매핑
export type CareerTilt = 'biz' | 'balanced' | 'org';               // 하이라이트 보조 3분류(band 파생)
export type BizSignal = 'creative' | 'wealth' | 'independent' | 'none'; // 사업가 축 최강 신호(neutral key)
export type OrgSignal = 'structure' | 'stability' | 'none';            // 직장인 축 최강 신호

/** computeCareerSignals 결과 — 저울 점수 + 4유형 + 양쪽 % + 최강 신호 + 리스크 플래그(neutral key: 화면에 한자/십신 없음). */
export interface CareerSignals {
  score: number;           // 0~100, 100=사업가 극. ★파격 디스카운트가 반영된 '저울 표시' 점수(= bizPct).
  grewScore: number;       // 파격 디스카운트 前 '그릇' 점수 — band(라벨) 기준. keep-the-label 근거.
  band: CareerBand;        // 4유형(그릇 기준): org < 35 ≤ hybrid < 50 ≤ pro < 70 ≤ independent
  tilt: CareerTilt;        // band 파생(하이라이트 문구용): org→org / hybrid→balanced / pro·independent→biz
  bizPct: number;          // 사업가 성향 %(= score)
  orgPct: number;          // 직장인 성향 %(= 100 − score)
  topBizSignal: BizSignal; // 사업가 축에서 가장 도드라진 결
  topOrgSignal: OrgSignal; // 직장인 축에서 가장 도드라진 결
  partnerRisk: boolean;    // 겁재 발현 → 동업·파재 리스크(공동투자·지분 주의)
  riskFlag: boolean;       // 파격(실행 리스크) → '그릇은 사업가형이나 구조 보완 필요' 뉘앙스
}

// 점수 → 4유형 밴드(daniel 확정). 경계는 포함 규칙: 35→hybrid, 50→pro, 70→independent.
function bandOf(score: number): CareerBand {
  if (score < 35) return 'org';         // 0–35 조직형
  if (score < 50) return 'hybrid';      // 35–50 하이브리드(사내벤처·조직 내 사업가)
  if (score < 70) return 'pro';         // 50–70 전문가·프리랜서형
  return 'independent';                 // 70–100 독립사업형
}

/**
 * 사업가↔직장인 성향 저울 신호 산출(결정론·온디바이스). CareerTeaser 가 이 결과로 저울·유형·플래그를 그린다.
 * @param saju 대표 명식의 사주(원국 + timeUnknown 병합). 십신 자리별 활성 × MATRIX 로 두 축 합산.
 * @returns 저울 점수(파격 반영)·그릇 점수·4유형·양쪽 %·최강 신호·리스크 플래그(문구는 컴포넌트가 일상어로 얹음).
 * ※ 재발명 금지 — 십신 배정은 엔진 필드(stemTenGod/branchMainTenGod/hiddenStems.tenGod)를 그대로 읽고
 *   '자리 가중(투출/본기/장간)'만 얹는다. analyzeTenGods 는 자리 tier 를 구분하지 않아(분포만) 파격 프록시에만 재사용.
 */
export function computeCareerSignals(saju: SajuChart): CareerSignals {
  const timeUnknown = (saju as any)?.timeUnknown === true;
  // 시각 미상이면 원국 시주(時支) 제외(잘못된 성향 판정 방지) — 코드베이스 관례(jobGauge/inyeonGauge와 동일).
  const posList: PillarPos[] = timeUnknown ? ['년', '월', '일'] : ['년', '월', '일', '시'];

  let bizSum = 0, orgSum = 0;      // 두 축 활성×기여 합
  let geobjaeAct = 0;             // 겁재 활성 합(동업·파재 리스크)
  const bizGroup: Record<string, number> = { 식상: 0, 재성: 0, 비겁: 0 }; // 사업가 축 최강 신호 집계
  const orgGroup: Record<string, number> = { 관성: 0, 인성: 0 };          // 직장인 축 최강 신호 집계

  // 한 십신 활성 발현을 두 축에 기여 합산(+ 신호 그룹 집계 + 겁재 추적).
  const add = (tg: TenGod | undefined, act: number) => {
    if (!tg) return;
    const m = MATRIX[tg];
    if (!m) return;
    bizSum += act * m.biz;
    orgSum += act * m.org;
    const grp = GROUP[tg];
    if (grp === '식상' || grp === '재성' || grp === '비겁') bizGroup[grp] += act * m.biz; // 사업가 신호는 이 세 그룹만
    if (grp === '관성' || grp === '인성') orgGroup[grp] += act * m.org;                    // 직장인 신호는 이 두 그룹만
    if (tg === '겁재') geobjaeAct += act;
  };

  // 자리별 활성: 천간 투출(일간 제외) 1.0 / 지지 본기 0.55 / 지장간 중기·여기 0.25.
  for (const p of posList) {
    const pd = saju.pillars?.[p];
    if (!pd) continue;
    if (p !== '일') add(pd.stemTenGod, W.actTou);                 // 천간 투출(일간=주체는 제외)
    add(pd.branchMainTenGod, W.actBon);                           // 지지 본기
    for (const h of pd.hiddenStems) if (h.role !== '본기') add(h.tenGod, W.actJi); // 지장간 중기·여기(본기 중복 방지)
  }

  // ── 정규화: 100 = 사업가 극 (사업가합 / (사업가합+직장인합)) ──
  const total = bizSum + orgSum;
  const normScore = total > 0 ? (100 * bizSum) / total : 50;

  // ── 보정 ① 신강약(±5 MAX): 신강=자기주도 감당→사업가 / 신약=조직 의존→직장인. saju.structure 있으면 그 verdict, 없으면 결정론 산출 ──
  const verdict = saju.structure?.strength?.verdict ?? scoreStrength(saju).verdict;
  const strengthAdj = verdict === '신강' ? W.strengthTilt : verdict === '신약' ? -W.strengthTilt : 0;
  const grewScore = clamp(Math.round(normScore + strengthAdj), 5, 95); // 그릇 점수 = 라벨(band) 기준(keep the label)
  const band = bandOf(grewScore);

  // ── 보정 ② 격국 성패(파격) 실행 리스크 디스카운트 — 라벨(band)은 그대로, 저울 점수만 하향 + 플래그 표면화 ──
  //   격국 성패는 stance(LLM·daniel) 영역이고 saju.structure.pattern 엔 성패 boolean 이 없다(on-device 는 아예 빔).
  //   → 가장 흔한 파격 '군겁쟁재'(재격인데 비겁 강 + 무식상 통관 부재)를 결정론 프록시로 잡는다(★daniel 검수 default).
  const { distribution } = analyzeTenGods(saju);
  const jaePresent = (distribution['재성'] ?? 0) > 0;  // 재성 그릇(투출·본기)
  const sikPresent = (distribution['식상'] ?? 0) > 0;  // 식상 통관(투출·본기 — 지장간만이면 통관 미약 = 없음 취급)
  const cls = classifyStrength(saju);
  const biStrong = cls.type === '신왕' || cls.driver === '비겁'; // 비겁 결집(신왕/비겁 driver)
  const riskFlag = jaePresent && biStrong && !sikPresent;        // 군겁쟁재 프록시 = 실행 리스크

  const score = clamp(Math.round(grewScore - (riskFlag ? W.patternDiscount : 0)), 5, 95);
  const bizPct = score;
  const orgPct = 100 - score;

  const partnerRisk = geobjaeAct >= W.partnerRiskMin;
  const tilt: CareerTilt = band === 'org' ? 'org' : band === 'hybrid' ? 'balanced' : 'biz';

  // 최강 신호(neutral key) — 사업가 3그룹·직장인 2그룹 중 기여 최대(동점은 정의 순서 우선).
  const topBizSignal = pickTop<BizSignal>([['creative', bizGroup['식상']], ['wealth', bizGroup['재성']], ['independent', bizGroup['비겁']]], 'none');
  const topOrgSignal = pickTop<OrgSignal>([['structure', orgGroup['관성']], ['stability', orgGroup['인성']]], 'none');

  return { score, grewScore, band, tilt, bizPct, orgPct, topBizSignal, topOrgSignal, partnerRisk, riskFlag };
}

/** [key, weight] 목록에서 weight 최대 key 반환(전부 0 이면 fallback). 동점은 배열 앞선 것 우선(안정). */
function pickTop<T extends string>(arr: [T, number][], fallback: T): T {
  let best = arr[0];
  for (const it of arr) if (it[1] > best[1]) best = it; // > 이므로 동점 시 먼저 나온 것 유지
  return best[1] > 0 ? best[0] : fallback;
}
