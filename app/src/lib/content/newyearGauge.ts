// app/src/lib/content/newyearGauge.ts — 내년 신수(新數) 3층 산식 + 복/악삼재 크로스 (온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 스탠스 인코딩(★검수 슬롯 — 발명 아님. R2 오행 생극 + 엔진 detectInteractionsAmong 재사용, LLM 미사용).
//   무료 퍼널(신년운세 유료 위에 얹는 결정론 티저)의 '내년 한 해가 나와 맞는 정도'를 0~100 + 톤 + 키워드로 산출.
//   깊은 통변(유료 /newyear·kind='newyear')은 supabase/Edge(LLM)가 맡는다(규칙5·ABSOLUTE-0: 무료 = 온디바이스만).
//
// ▶ ★핵심 = daniel 3층 곱연산 산식 (방향 × 강도 + 보정):
//     신수 = 방향(용신층) × 강도(응기층) + 보정(구조층)
//   ① 용신층(방향) : 내년 세운 천간·지지 각각을 억부용신 5단(용신/희신/한신/구신/기신)으로 대조 →
//                    용신 +2 / 희신 +1 / 한신 0 / 구신 −1 / 기신 −2. 천간+지지 합 = 방향(−4~+4).
//   ② 응기층(강도) : 원국 ↔ 내년 세운 합충형해 강도합(충=강·합=중·형해파=약) → 배율(조용=낮음·시끄러움=높음).
//   ③ 구조층(보정) : 천간·지지 희기 '괴리'(겉 좋고 속 시끄러움 등) 시 혼합 라벨 + 소폭 보정.
//   → 방향과 강도의 *분리(곱연산)*가 핵심: 기신운+강한 충 = 대흉 / **용신운+강한 충 = "변동 크나 결과 좋은 해"(흉 아님)**.
//     선형 합산으론 이 구분이 안 나온다 — 곱연산이라야 자연히 갈린다.
//
// ▶ 삼재는 *산식에 0%*(②③ 참고) — 띠 12분법 민속 관법을 개인 사주 정밀 산식에 섞으면 방법론 오염 + "삼재인데 대길?" 컴플레인.
//   대신 삼재는 별도 트랙(큰 배지·검색 유입 훅)으로 두고, 신수 '방향'과 크로스해 복삼재/악삼재를 판정한다(③).
//   ★복/악 판정은 반환하되 무료 화면은 '들/눌/날'까지만 노출 = 유료 유도(NewyearTeaser 참고).
//
// ⚠️ 온디바이스 한계(★daniel 검수 필수): computeChart 는 saju.structure(용신)를 채우지 않는다(엔진 주석: WS3/골든 영역).
//    → 용신 오행은 경량 억부용신(computeYongsinApprox·억부근사)으로 산출한다(daniel 2026-07-06 배선. 과거 lifeGraph 인성 폴백 교체).
//    억부는 Edge R2(조후·통관·병약 포함)의 부분집합이라, 유료(Edge)/골든 용신과 갈릴 수 있다(divergence — 유료에서 서술).
//    hasUseful=false = 억부가 판정 보류(극신약 종격 후보) = 방향 신뢰도 낮음.
//
// ▶ 화면 텍스트엔 한자·십신 노출 금지 = 일상어. 이 모듈은 neutral key + 최소 일상어 키워드만 반환(컴포넌트가 카피를 얹음).
//   §4 웰빙: 흉년·삼재 단정 금지 — 낮은 점수도 '다지는 해'로 전향적. 처방·관리축은 컴포넌트/유료가 담당.
// ─────────────────────────────────────────────────────────────────────────
import { detectInteractionsAmong } from '@engine/structure'; // 합충형해 검출(엔진 재사용) — MyeongsikScreen 확장명식과 동일 로직
import { stemElement, branchElement } from '../engine/ohaeng'; // 천간·지지 → 오행(木火土金水)
import { samjaeStatus } from '../engine/samjae';               // 삼재(띠 삼합국 3년) L1 룩업 — 재사용(발명 아님)
import { computeYongsinApprox, yongsinToClass5, type HuiGiClass } from './yongsinApprox'; // ★용신층 방향 소스 = 경량 억부용신(daniel 2026-07-06). structure.usefulGod 온디바이스 공란 → 억부 근사(lifeGraph 인성 폴백 교체)
import { toneFromScore, type GaugeTone } from '../love/inyeonGauge'; // 톤 경계(66/34)·타입 = 재회/애정/취업 게이지와 단일 소스(일관 표시)
import type { SajuChart, Element, Stem, Branch, ChartPosition } from '@spec/chart';

// (오행 생극·희기신 도출은 억부 모듈 yongsinApprox 가 소유 — 여기 로컬 생극표는 제거하고 5단 결론만 소비, daniel 2026-07-06)

// ══ ★daniel 검수: 신수 산식 가중치·표(스탠스 · 전부 튜닝 슬롯) ══════════════════════════════════
const W = {
  // ① 용신층(방향) — 세운 천간·지지 각각 5단 희기신 점수(합 = −4~+4)
  yong: 2, hee: 1, han: 0, gu: -1, gi: -2,     // 용신+2 / 희신+1 / 한신0 / 구신−1 / 기신−2
  // ② 응기층(강도) — 원국↔내년 세운 상호작용 강도합 → 배율. 조용한 해=multBase ~ 시끄러운 해=multBase+strCap*strPerUnit.
  strPerUnit: 0.12,   // 강도 1점당 배율 증가
  strCap: 10,         // 강도합 상한(이 이상은 동일 최대 배율) — 충 2개(=10)에서 최대 배율 도달
  multBase: 1.0,      // 조용한 해(상호작용 없음) 기본 배율
  loudAt: 5,          // 강도합 ≥ 이 값(≈충 1개)이면 '시끄러운 해'(키워드 매트릭스 분기)
  // ③ 구조층(보정) — 천간·지지 희기 괴리 시 소폭 보정
  mismatch: 1.0,      // 괴리(겉/속 엇갈림) 보정 폭
  // 정규화(0~100) — 방향 0(중립)이면 base(무난). §4: 대흉도 절대 0 아님(scoreLo/Hi 여백).
  base: 50, gain: 4.6, scoreLo: 8, scoreHi: 96,
  // 길월 — 그 달 干支 방향점수 ≥ goodMonthMin 이면 길월(최대 goodMonthCap 개 표시)
  goodMonthMin: 2, goodMonthCap: 6,
};
// 합충형해 강도 tier — MyeongsikScreen '강도 순'과 동일(충·합=강 / 형·극=중 / 해·파=약). ★daniel 검수 슬롯.
const STRENGTH: Record<string, number> = { 충: 5, 합: 4, 형: 3, 극: 3, 해: 2, 파: 1 };
// ══════════════════════════════════════════════════════════════════════════════════════════════

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 억부 5단(용신/희신/한신/구신/기신) → newyear 고유 점수 스케일(±2/±1).
//   ★daniel 2026-07-06 억부배선: 희기신 '분류'는 억부용신(computeYongsinApprox)이 결론짓고,
//   여기선 yongsinToClass5 로 임의 오행을 그 5단에 대조한 뒤 이 표로 점수만 환산한다.
//   lifegraph 는 ±3 대칭이지만 newyear 는 방향×강도 곱연산 튜닝값 보존 위해 ±2/±1 유지(W 값 그대로).
const CLASS_SCORE: Record<HuiGiClass, number> = { 용신: W.yong, 희신: W.hee, 한신: W.han, 구신: W.gu, 기신: W.gi };

// ── 반환 타입(neutral key — 컴포넌트가 일상어 카피로 매핑) ──────────────────────────────────────
export type SamjaeLabel = 'deul' | 'nul' | 'nal' | 'none';           // 들/눌/날/삼재아님(전원 노출)
export type BokAk = 'bok' | 'normal' | 'ak' | null;                   // 복삼재/표준/악삼재(삼재 아니면 null) — free 미표시(유료 유도)
export type NewyearTheme =
  | 'breakthrough' | 'ripen' | 'shift' | 'steady' | 'manage' | 'build' // 방향×강도 매트릭스
  | 'outGoodInHard' | 'outHardInGood';                                 // 구조층 괴리(혼합)

export interface NewyearSinsu {
  nextYear: number;         // 내년(= 올해 세운 연도 + 1)
  score: number;            // 0~100 신수 점수(3층 곱연산)
  tone: GaugeTone;          // 점수 밴드(색·글로우) — 재회/애정 게이지와 동일 경계(66/34)
  keyword: string;          // 올해의 키워드 미리보기(일상어·§4·no 한자/십신)
  topTheme: NewyearTheme;   // 키워드의 neutral key
  samjae: SamjaeLabel;      // 삼재 3단계(들/눌/날) or none — 전원 노출(큰 배지)
  bokAk: BokAk;             // 복/악삼재 크로스(방향층 재사용) — ★free 미표시, 유료 유도용 반환
  goodMonths: number[];     // 1~12 중 길월(내년 월운 干支가 용신·희신에 부합)
  monthScores: number[];    // 1~12 월별 방향점수(−4~+4) — '좋은 달' 그래프용. 월운 없으면 빈 배열(그래프 생략)
  // ── 검수/유료용(화면 미표시) ──
  dir: number;              // 방향 값(−4~+4)
  dirStem: number;          // 세운 천간 희기 점수
  dirBranch: number;        // 세운 지지 희기 점수
  strength: number;         // 응기 강도합(원국↔세운 상호작용)
  mult: number;             // 강도 배율
  mismatch: 'outGoodInHard' | 'outHardInGood' | 'aligned'; // 구조층 괴리
  usefulEl: Element;        // 쓴 용신 오행(억부근사) — 검수용, 화면 미표시(한자)
  hasUseful: boolean;       // 억부 신뢰도(false = 극신약 종격 후보 판정 보류 → Edge 위임)
  interactions: string[];   // 원국↔세운 상호작용 라벨(검수용)
}

/** timeUnknown = 시각 미상(원국 시주 제외) — saju 병합값(FreeFunnel 관례) 또는 명시 전달. */
type Opts = { timeUnknown?: boolean };

/**
 * 내년 신수 3층 산식 + 삼재/복악 크로스 산출(결정론·온디바이스). NewyearTeaser 가 이 결과로 게이지·배지·달력·키워드를 그린다.
 * @param saju 대표 명식의 사주(원국 + 현재 세운 + 대운별 세운 목록 luckCycles). computeChart 산출값.
 * @param opts timeUnknown(시각 미상 → 원국 시주 제외, 강도 판정에서만 반영). 미전달 시 saju 병합값을 읽음.
 * @returns 신수 점수·톤·키워드 + 삼재/복악 + 길월 + 검수용 하위값.
 */
export function newyearSinsu(saju: SajuChart, opts?: Opts): NewyearSinsu {
  const timeUnknown = opts?.timeUnknown ?? (saju as any)?.timeUnknown === true;

  // ── 내년(curYear+1) 세운 확정 ────────────────────────────────────────────────
  //   saju.annual = 올해 세운(월운 없음). 내년 세운(월운 포함)은 luckCycles[].annuals[] 에서 year=내년 을 찾는다.
  const curYear = (saju.annual as any)?.year ?? new Date().getFullYear();
  const nextYear = curYear + 1;
  let nextAnnual: { stem: Stem; branch: Branch; months?: { stem: Stem; branch: Branch }[] } | undefined;
  for (const lc of saju.luckCycles ?? []) {
    const a = (lc.annuals ?? []).find((x) => x.year === nextYear);
    if (a) { nextAnnual = a; break; }
  }
  // 폴백: luckCycles 에 내년이 없으면(더미 대운 등) 올해 세운 干支에서 60갑자 +1 로 유도(월운은 없음 → 길월 생략).
  const cur = saju.annual;
  const nextStem: Stem = nextAnnual?.stem ?? STEMS[(STEMS.indexOf(cur.stem) + 1) % 10];
  const nextBranch: Branch = nextAnnual?.branch ?? BRANCHES[(BRANCHES.indexOf(cur.branch) + 1) % 12];

  // ── ★억부 배선(daniel 2026-07-06): 용신층 방향 소스 = 경량 억부용신 ──
  //   과거: lifeGraph().usefulElement(structure.usefulGod 없으면 인성 폴백). 온디바이스는 늘 폴백이라 방향이 근사였다.
  //   교체: computeYongsinApprox 로 억부 용신/희신/기신/구신/한신을 직접 산출 → yongsinToClass5 로 오행별 5단 점수.
  //   ※ amplitudeScale(중화=×0.5)은 lifeGraph 처럼 '곡선' 진폭 조절용 — newyear 는 단일 게이지(곡선 아님)라 미적용(기존 동작 보존).
  //   ※ opts.timeUnknown 을 억부에 그대로 전달(FreeFunnel 이 saju 객체 밖으로 넘긴 값도 원국 그룹강도에 반영되도록).
  const ya = computeYongsinApprox(saju, { timeUnknown });
  const usefulEl = ya.yongsin;
  const scoreOf = (el: Element) => CLASS_SCORE[yongsinToClass5(el, ya)];

  // ── ① 용신층(방향) : 내년 세운 천간·지지 각각 5단 희기신 → 합 ───────────────
  const dirStem = scoreOf(stemElement(nextStem) as Element);
  const dirBranch = scoreOf(branchElement(nextBranch) as Element);
  const dir = dirStem + dirBranch; // −4 ~ +4

  // ── ② 응기층(강도) : 원국 ↔ 내년 세운 상호작용 강도합 → 배율 ─────────────────
  //   원국 4주(시각 미상이면 시주 제외) + 내년 세운(pos='세운')을 detectInteractionsAmong 에 넣고,
  //   '세운' 이 연루된 작용만 추려 강도(STRENGTH) 를 합산한다(원국끼리 작용은 제외).
  const natalPos: ChartPosition[] = timeUnknown ? ['년', '월', '일'] : ['년', '월', '일', '시'];
  const items = natalPos
    .map((p) => saju.pillars?.[p as '년' | '월' | '일' | '시'])
    .filter(Boolean)
    .map((d) => ({ pos: (d!.position as ChartPosition), stem: d!.stem, branch: d!.branch }));
  items.push({ pos: '세운' as ChartPosition, stem: nextStem, branch: nextBranch });
  const links = detectInteractionsAmong(items).filter((it) => it.members.includes('세운' as ChartPosition));
  const strength = links.reduce((s, it) => s + (STRENGTH[it.type] ?? 0), 0);
  const mult = W.multBase + Math.min(strength, W.strCap) * W.strPerUnit; // 조용=1.0 ~ 시끄러움=2.2
  const loud = strength >= W.loudAt;

  // ── ③ 구조층(보정) : 천간·지지 희기 괴리(겉/속 엇갈림) ──────────────────────
  let mismatch: NewyearSinsu['mismatch'] = 'aligned';
  let adj = 0;
  if (dirStem > 0 && dirBranch < 0) { mismatch = 'outGoodInHard'; adj = -W.mismatch; }       // 겉(천간) 좋고 속(지지) 시끄러움
  else if (dirStem < 0 && dirBranch > 0) { mismatch = 'outHardInGood'; adj = +W.mismatch; }  // 겉 어수선해도 속 단단(지지=본질 소폭 우위)

  // ── 곱연산 → 정규화(0~100) + 톤 ────────────────────────────────────────────
  const raw = dir * mult + adj; // 방향 × 강도 + 보정
  const score = clamp(Math.round(W.base + raw * W.gain), W.scoreLo, W.scoreHi);
  const tone = toneFromScore(score);

  // ── free 키워드(방향×강도 매트릭스, 괴리 우선) — neutral key + 일상어(§4·전향적) ──
  const { topTheme, keyword } = pickTheme(dir, loud, mismatch);

  // ── 삼재(별도 트랙·산식 0%) + 복/악 크로스(방향 재사용) ──────────────────────
  const natalYearBranch = saju.pillars['년'].branch;
  const sj = samjaeStatus(natalYearBranch, nextBranch);
  const samjae: SamjaeLabel = !sj.isSamjae ? 'none'
    : sj.phase === '들삼재' ? 'deul' : sj.phase === '눌삼재' ? 'nul' : 'nal';
  //   복삼재 = 이름만 삼재(내년 방향이 용신·희신) / 악삼재 = 실제 관리 필요(기신·구신) / 표준 = 한신. free 미표시.
  const bokAk: BokAk = samjae === 'none' ? null : dir > 0 ? 'bok' : dir < 0 ? 'ak' : 'normal';

  // ── 길월 : 내년 12 월운 중 干支 방향점수 ≥ goodMonthMin 인 달(1~12) ──────────
  const goodMonths: number[] = [];
  const monthScores: number[] = [];
  (nextAnnual?.months ?? []).forEach((m, i) => {
    const md = scoreOf(stemElement(m.stem) as Element) + scoreOf(branchElement(m.branch) as Element);
    monthScores.push(md); // −4~+4 원값 보존(그래프에서 정규화). 길월과 별개로 12개 전부 수집
    if (md >= W.goodMonthMin && goodMonths.length < W.goodMonthCap) goodMonths.push(i + 1);
  });

  return {
    nextYear, score, tone, keyword, topTheme, samjae, bokAk, goodMonths, monthScores,
    dir, dirStem, dirBranch, strength, mult, mismatch, usefulEl, hasUseful: !ya.jonggyeokHold,
    interactions: links.map((it) => it.detail ?? it.type),
  };
}

/**
 * 방향(부호)·강도(시끄러움)·괴리 → 내년 키워드(neutral key + 일상어). 괴리(혼합)면 그걸 우선 라벨.
 *   §4 전향적: 낮은 방향도 '관리·다지기'로(흉 단정 금지). 화면 노출 = 일상어(한자/십신 없음).
 */
function pickTheme(dir: number, loud: boolean, mismatch: NewyearSinsu['mismatch']): { topTheme: NewyearTheme; keyword: string } {
  if (mismatch === 'outGoodInHard') return { topTheme: 'outGoodInHard', keyword: '겉은 순조롭고 속은 분주한 해' };
  if (mismatch === 'outHardInGood') return { topTheme: 'outHardInGood', keyword: '겉은 소란해도 속이 단단한 해' };
  const sign = dir > 0 ? 'good' : dir < 0 ? 'hard' : 'neutral';
  if (sign === 'good') return loud
    ? { topTheme: 'breakthrough', keyword: '격변 속 기회의 해' }
    : { topTheme: 'ripen', keyword: '무르익는 해' };
  if (sign === 'hard') return loud
    ? { topTheme: 'manage', keyword: '찬찬히 관리하는 해' }
    : { topTheme: 'build', keyword: '안으로 다지는 해' };
  return loud
    ? { topTheme: 'shift', keyword: '방향을 정하는 해' }
    : { topTheme: 'steady', keyword: '잔잔히 흐르는 해' };
}
