// app/src/lib/content/jobGauge.ts — 취업·이직 가능성 게이지 결정론 엔진 (온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 스탠스 인코딩(★ = 핵심 IP · 발명 아님 · LLM 미사용). 엔진 tenGod/HIDDEN/scoreStrength 재사용.
//   재회(lib/love/inyeonGauge)와 같은 결의 '무료 리치' 결정론 엔진의 취업·이직 버전.
//   → 무료 퍼널(jobAsk)의 JobRich 가 이 점수/신호로 '취업 문이 열린 정도' 게이지를 그리고,
//     깊은 통변(유료 /job)은 supabase/Edge(LLM)가 맡는다(규칙5·ABSOLUTE-0: 무료 = 온디바이스만).
//
// ▶ ★daniel 취업 스탠스 — 우선순위 C → A → D → B 로 합성한다(발명 아님 · 지정값 그대로):
//   기본 골격: 취업·합격 = 관성(직장·자리·합격)·인성(자격·서류·시험) 발동. 보조 = 식상(면접·실력)·재성(연봉·결실).
//   그 위에 아래 4계층을 얹어 '오판'을 막는다.
//
//   C. 신강약 게이트(필수·전제) — 관성/인성 발동 강도(act)에 곱수:
//        · 신강/신왕 : 관성 그대로 / 인성 ×0.85(과잉 소폭 감)
//        · 중화       : 그대로(OPEN, 보너스 없음)
//        · 신약       : 정관 ×0.7 · 편관 ×0.6(차등 필수 — 신약에게 정관=자리, 편관=관살 공격) / 인성 ×1.2(살인상생 통로)
//                       + 편관 단독 강발동이면 '취업'보다 '압박·시험대' 뉘앙스로(pressureNuance).
//   A. 상관/식신 분리(핵심 · R2 용신 게이트) — 식상 발동의 방향을 가른다:
//        · 살중용식(원국 편관≥2 + 원국 식상존재) → 운의 식상 = 제살(취업 문 열림) = +10  [상관견관에 우선]
//        · 관성=용신 or 관성 주도발동 → 상관 발동=상관견관 −8 / 식신 발동=중립 0
//        · 식상=용신(상관패인·식상생재) → +7(실력으로 뚫는 타입)
//        · 그 외 → +3(실력이나 주 신호 아님)
//   D. 관인상생 시너지 = 가산 보너스 +8~10(곱연산 아님). 신약이면 더 큼 + C의 신약 관성 감점 해제(D=C의 예외).
//   B. 재생관(마지막 폴리시) — 재성 단독 +7 / 같은 운 관성 동시 +5 추가(재생관 체인). 단 신약+재생살(재+편관 동시)=보너스 제거.
//
// ▶ 결과: score 0~100 + tone(open/warming/quiet) + 하위 신호(neutral key — 컴포넌트가 일상어로 매핑).
//   ★한자·십신 용어는 이 모듈 밖(화면 텍스트)으로 절대 노출하지 않는다 — 여기선 neutral key(boolean)만 반환.
//   ★가중치는 W(기본 타이밍)·S(daniel 스탠스 델타) 블록에 모아 둔다(검수/튜닝 슬롯).
// ─────────────────────────────────────────────────────────────────────────
import { tenGod, HIDDEN } from '@engine/saju';                          // 십신·지장간 표준표(엔진 재사용 — 발명 아님)
import { scoreStrength } from '@engine/structure';                      // 신강약 지표(personaType가 쓰는 것과 동일 소스) — C 게이트 폴백
import { toneFromScore, type GaugeTone } from '../love/inyeonGauge';    // 톤 경계(66/34)·타입 = 재회 게이지와 단일 소스(일관 표시)
import type { SajuChart, Branch, Stem, TenGod, PillarPos, Element } from '@spec/chart';

// ── 십신 그룹/개별(표준 통설). 취업 도메인 매핑 = ★daniel 검수 슬롯. C·A 게이트가 정/편을 차등하므로 개별 상수도 둔다 ──
const JEONGGWAN: TenGod = '정관';              // 정관 = '자리'(신약에도 부담이 상대적으로 적음)
const PYEONGWAN: TenGod = '편관';              // 편관(칠살) = '관살 공격'(신약에 더 큰 부담)
const GWAN: TenGod[] = ['정관', '편관'];        // 관성 = 직장·자리·취업·승진·합격
const INSEONG: TenGod[] = ['정인', '편인'];     // 인성 = 자격·문서·시험·서류·합격(살인상생 통로)
const SANGGWAN: TenGod = '상관';               // 상관 = 관을 직접 극(상관견관 위험) · 실력
const SIKSIN: TenGod = '식신';                 // 식신 = 정관 직접 극 약함(중립) · 제살 주력
const SIKSANG: TenGod[] = ['식신', '상관'];     // 식상 = 면접·실력·실무 발휘
const JAESEONG: TenGod[] = ['정재', '편재'];    // 재성 = 현실 성과·연봉·결실
const GWAN_IN: TenGod[] = [...GWAN, ...INSEONG]; // 취업·합격 핵심(관+인) 합집합 — 유리한 해·원국 바탕 판정용

// 오행 상생상극(lifeGraph.ts와 동일 값 — 모듈 자족 위해 로컬 정의). 용신 오행 → 십신 그룹 환산용.
const ELEMS: Element[] = ['木', '火', '土', '金', '水'];
const GEN: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };  // X 가 생하는 오행
const CTRL: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }; // X 가 극하는 오행

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// ══ ★daniel 검수: 기본 타이밍 가중치(관/인 발동 = 취업 응기). 각 항 부분점수 ══
//   기질(원국)보다 '지금 운'이 크게 움직이도록 배분. 올해 세운을 최대 가중(무료 게이지 = '올해' 기준).
//   합계 86 = 기본 타이밍 만점. 나머지 헤드룸(~14+)은 아래 S(스탠스 델타 A/D/B)가 채우며 최종 0~100 클램프.
const W = {
  natalGwanIn: 14,   // ① 원국 바탕 — 관/인이 자리잡은 그릇
  daeunActive: 22,   // ② 대운(10년 배경)에 관/인 발동
  seunActive: 28,    // ③ 세운(올해)에 관/인 발동 — 올해 트리거(가중 최고)
  goodYears: 22,     // ④ 근미래 '관/인 드는 유리한 해' 수 — 시기 확실성
};

// ══ ★daniel 취업 스탠스 델타(C 곱수 · A 식상 라우팅 · D 관인상생 · B 재생관). 전부 daniel 지정값 = 발명 금지 ══
const S = {
  // C. 신강약 게이트 곱수 (관성/인성 발동 강도 act 에 적용)
  weakJeonggwanMul: 0.7,   // 신약: 정관 = '자리'(부담 상대적 적음)
  weakPyeongwanMul: 0.6,   // 신약: 편관 = '관살 공격'(더 큰 감점) — 정/편 차등 필수(동률이면 편관 세운 과대평가)
  weakInseongMul: 1.2,     // 신약: 인성 = 살인상생 통로 + 나를 생조(가중)
  strongInseongMul: 0.85,  // 신강/신왕: 인성 과잉 소폭 감(기존 stem 인성 0.85 결 유지)
  // A. 상관/식신 라우팅 (R2 용신 게이트)
  saljungYongSik: 10,      // 살중용식(원국 편관≥2 + 식상존재): 제살 = 취업 문 열림(상관견관에 우선)
  sanggwanVsGwan: -8,      // 관성=용신/주도발동: 상관견관(하극상·퇴사·면접 태도 리스크)
  siksinVsGwan: 0,         // 관성=용신/주도발동: 식신은 정관 직접 극 약함 → 중립
  siksangYong: 7,          // 식상=용신(상관패인·식상생재): 실력으로 뚫는 타입
  siksangMild: 3,          // 그 외: 실력이나 주 신호 아님
  // D. 관인상생 시너지 (가산 — 곱연산 아님)
  gwanInSynergy: 8,        // 관→인→일간 체인 성립(같은 운)
  gwanInSynergyWeak: 10,   // 신약이면 더 큼(살인상생으로 관살 부담을 인성이 소화)
  // B. 재생관
  jaeSolo: 7,              // 재성 단독(연봉·결실 유효) — '돈은 벌리는데 자리는 아닌' 기본값
  jaeSaengGwan: 5,         // 같은 운 관성 동시 발동(재생관 체인) 추가
};
// ══════════════════════════════════════════════════════════════════════════════════════════════

const HORIZON = 15;  // 유리한 해 스캔 상한(근미래만). JobTiming 과 동일.

/** 신강약 3분류(C 게이트 전제). daniel: 신강/신왕=강 동일 취급 · 중화=OPEN · 신약=차등 게이트. */
type StrengthClass = 'strong' | 'neutral' | 'weak';
/** A(식상 라우팅) 어느 분기가 점수를 냈나(glass-box·QA용). */
type ABranch = 'saljung' | 'sanggwan_gyeon_gwan' | 'siksin_neutral' | 'siksang_yong' | 'mild' | 'none';
/** 십신 그룹(용신 → 그룹 매핑 결과). */
type SipsinGroup = '관성' | '인성' | '식상' | '재성' | '비겁';

/** computeJobSignals 결과 — 게이지 점수 + 톤 + 하위 신호(neutral key: 컴포넌트가 일상어 카피로 매핑). */
export interface JobSignals {
  score: number;            // 0~100 결정론 점수
  tone: GaugeTone;          // 점수 밴드(색·글로우) — 재회 게이지와 동일 경계(66/34)
  gwanActive: boolean;      // 지금 운(대운·세운)에 '직장·자리(관성)' 기운 발동
  inActive: boolean;        // 지금 운에 '자격·서류·합격(인성)' 기운 발동
  siksangActive: boolean;   // 지금 운에 '면접·실력 발휘(식상)' 기운 발동
  jaeActive: boolean;       // 지금 운에 '결실·연봉(재성)' 기운 발동
  natalGwanIn: boolean;     // 원국에 직장·자격의 바탕(관/인)이 자리잡음
  goodYearCount: number;    // 근미래 유리한 해(관/인 드는 해) 수 — JobTiming 달력과 일치
  primary: 'gwan' | 'in' | 'siksang' | 'jae' | 'none'; // 지금 가장 도드라진 기운(신호 카드 헤드라인용)
  // ── ★daniel C→A 인코딩으로 추가된 세분 신호(JobRich 가 소비 가능) ──
  jeonggwanActive: boolean; // '정관(안정된 자리)' 발동 — 편관과 결이 다름(C 차등)
  pyeongwanActive: boolean; // '편관(도전·압박형 자리)' 발동
  sanggwanActive: boolean;  // '상관(튀는 실력·태도 리스크)' 발동 — 관 있을 때 상관견관 주의
  siksinActive: boolean;    // '식신(꾸준한 실무)' 발동 — 관 있을 때도 비교적 무해
  pressureNuance: boolean;  // ★신약 + 편관 단독 강발동 → '취업'보다 '압박·시험대'의 결(JobRich 문구 전환용)
  // ── glass-box·QA용(화면 미노출). 어느 분기가 점수를 냈는지 투명하게 남긴다(scoreStrength.breakdown 결) ──
  trace?: {
    strengthClass: StrengthClass;      // C 게이트 판정(structure 있으면 그것, 없으면 scoreStrength 폴백)
    usefulGodGroup?: SipsinGroup;      // R2 용신 → 십신 그룹(무료=structure 미채움이면 undefined)
    aBranch: ABranch;                  // A 라우팅 분기
    base: number;                      // 기본 타이밍 점수(natal+daeun+seun+goodYears)
    siksangDelta: number;              // A 델타
    jaeDelta: number;                  // B 델타
    synergyBonus: number;              // D 델타
  };
}

/** sex 는 취업에 무관 — timeUnknown(시각 미상 → 시주 제외)만 받는다. 미전달 시 saju 병합값을 읽음(FreeFunnel 관례). */
type Opts = { timeUnknown?: boolean };

// 한 지지(branch)의 지장간이 품은 십신 목록(본기+중기+여기) — 운 지지의 '숨은 기운' 발동 판정용.
//   대운/세운(LuckCycle/AnnualPillar)엔 stemTenGod 만 있고 지지 십신은 없으므로 HIDDEN+tenGod 로 산출(엔진 재사용).
const branchTenGods = (dm: Stem, b: Branch): TenGod[] => HIDDEN[b].map((h) => tenGod(dm, h.stem));

/** 십신 문자열 → 십신 그룹(용신 value 가 십신일 때). */
function tenGodGroup(tg: string): SipsinGroup {
  if (tg.includes('관') || tg.includes('살')) return '관성';
  if (tg.includes('인')) return '인성';
  if (tg.includes('식') || tg.includes('상')) return '식상';
  if (tg.includes('재')) return '재성';
  return '비겁'; // 비견·겁재
}
/** 오행 → 십신 그룹(용신 value 가 오행일 때, 일간 오행 기준). tenGodToElement(lifeGraph)의 역변환. */
function elementGroup(el: string, dayEl: string): SipsinGroup {
  if (el === dayEl) return '비겁';
  if (GEN[dayEl] === el) return '식상';    // 일간이 생 = 식상
  if (CTRL[dayEl] === el) return '재성';   // 일간이 극 = 재성
  if (CTRL[el] === dayEl) return '관성';   // 그 오행이 일간을 극 = 관성
  if (GEN[el] === dayEl) return '인성';    // 그 오행이 일간을 생 = 인성
  return '비겁';
}
/**
 * R2 용신 → 십신 그룹. lifeGraph L41 과 동일하게 saju.structure.usefulGod.value 를 읽는다.
 *   value 가 오행이면 elementGroup, 십신이면 tenGodGroup. 무료 경로(structure 미채움)면 undefined
 *   → A 게이트의 '관성==용신'·'식상==용신' 절은 발동 안 하고 주도발동/살중 등 원국 기반 절로 폴백(정상 열화).
 */
function usefulGodGroup(saju: SajuChart): SipsinGroup | undefined {
  const v = saju.structure?.usefulGod?.value as string | undefined; // lifeGraph.ts L41 과 동일 읽기
  if (!v) return undefined;
  const dayEl = saju.dayMaster.element as string;
  return (ELEMS as string[]).includes(v) ? elementGroup(v, dayEl) : tenGodGroup(v);
}

/**
 * 신강약 3분류(C 게이트). daniel: 신강/신왕=강 동일 취급.
 *   우선 structure.strength.verdict(서버 인코딩 레이어 = daniel ground truth) → 없으면 온디바이스 scoreStrength 폴백.
 *   (무료 경로 = structure 미채움 → scoreStrength 결정론 지표. personaType 가 c.strength.verdict 쓰는 것과 동일 소스.)
 */
function strengthClass(saju: SajuChart): StrengthClass {
  const v = (saju.structure?.strength?.verdict as string | undefined) ?? scoreStrength(saju).verdict;
  if (v.includes('신약')) return 'weak';
  if (v.includes('신강') || v.includes('신왕')) return 'strong'; // 신강·신왕 모두 강 범주(C 곱수 동일)
  return 'neutral'; // 중화 = OPEN(보너스 없음)
}

/**
 * 한 운 기둥(대운 또는 세운)이 관/인/식/재를 얼마나 '발동'시키는가 + C 게이트(신강약) 적용.
 *   천간(드러남) = 강한 발동 / 지지 장간(숨은 기운) = 약한 발동. 관성이 인성보다 살짝 강(직장 자리 = 취업 직접).
 *   ★C: 신강약(cls)에 따라 정관·편관·인성 발동 강도를 차등 곱한다. D 예외(신약+관인상생)는 여기서 관성 감점을 해제.
 * @param dm 일간, stemTG 운의 천간 십신, branch 운의 지지, cls 신강약 분류
 */
function pillarActivation(dm: Stem, stemTG: TenGod | undefined, branch: Branch | undefined, cls: StrengthClass) {
  const bTGs = branch ? branchTenGods(dm, branch) : [];
  const stemIs = (t: TenGod) => stemTG === t;                                  // 천간이 특정 십신
  const stemIn = (list: TenGod[]) => !!stemTG && list.includes(stemTG);        // 천간(드러난 기운)
  const branchIn = (list: TenGod[]) => bTGs.some((t) => list.includes(t));     // 지장간(숨은 기운)
  const anyIn = (list: TenGod[]) => stemIn(list) || branchIn(list);            // 천간 OR 지장간

  // ── 각 기운 발동 여부(천간·지장간 통합) ──
  const jeonggwan = anyIn([JEONGGWAN]);
  const pyeongwan = anyIn([PYEONGWAN]);
  const inseong = anyIn(INSEONG);
  const sanggwan = anyIn([SANGGWAN]);
  const siksin = anyIn([SIKSIN]);

  // ── 기본 발동 강도(pre-C): 천간=강 / 지지=약. 기존 결(천간 관 1.0·천간 인 0.85·지지 관 0.55·지지 인 0.45) 유지 ──
  const jeonggwanBase = stemIs(JEONGGWAN) ? 1.0 : (branchIn([JEONGGWAN]) ? 0.55 : 0);
  const pyeongwanBase = stemIs(PYEONGWAN) ? 1.0 : (branchIn([PYEONGWAN]) ? 0.55 : 0);
  const inseongBase = stemIn(INSEONG) ? 0.85 : (branchIn(INSEONG) ? 0.45 : 0);

  // ── 관인상생(이 운): 관(정/편) AND 인 동시 발동 = 관→인→일간 통로 성립(D) ──
  const synergyHere = (jeonggwanBase > 0 || pyeongwanBase > 0) && inseongBase > 0;

  // ── ★C 게이트: 신강약별 곱수. D 예외 = 신약 + 관인상생이면 관성 감점 해제(원복) ──
  let jgMul = 1, pgMul = 1, inMul = 1;
  if (cls === 'strong') {
    inMul = S.strongInseongMul;                       // 신강/신왕: 관 그대로, 인 ×0.85
  } else if (cls === 'weak') {
    inMul = S.weakInseongMul;                          // 신약: 인 ×1.2(살인상생 통로)
    if (!synergyHere) { jgMul = S.weakJeonggwanMul; pgMul = S.weakPyeongwanMul; } // 정관×0.7·편관×0.6 (관인상생이면 D예외로 원복)
  } // 중화 = 전부 ×1.0(OPEN)

  const jeonggwanEff = jeonggwanBase * jgMul;
  const pyeongwanEff = pyeongwanBase * pgMul;
  const inseongEff = Math.min(inseongBase * inMul, 1.0);       // 인성 ×1.2 상한 클램프
  const act = Math.max(jeonggwanEff, pyeongwanEff, inseongEff); // 관/인 발동 강도(0~1) — 점수 가중용

  return {
    act,
    gwan: jeonggwan || pyeongwan,                     // 직장·자리 기운(관성) 발동
    jeonggwan, pyeongwan,                             // 정/편 세분(C·A 게이트용)
    inseong,                                          // 자격·서류 기운(인성) 발동
    sanggwan, siksin,                                 // 식상 세분(A 게이트용)
    siksang: sanggwan || siksin,                      // 면접·실력 기운(식상) 발동
    jae: anyIn(JAESEONG),                             // 결실·연봉 기운(재성) 발동
    gwanStem: stemIn(GWAN),                           // 천간(드러난) 관성 발동 = '관성 주도발동'(A 상관견관 트리거)
    pyeongwanStem: stemIs(PYEONGWAN),                 // 천간 편관 강발동(C pressureNuance)
    jeonggwanStem: stemIs(JEONGGWAN),                 // 천간 정관 강발동
    synergyHere,                                      // 관인상생 성립(D)
  };
}

/**
 * 취업·이직 가능성 게이지 신호 산출(결정론·온디바이스). JobRich 가 이 결과로 게이지·신호 카드를 그린다.
 *   합성 순서 = ★daniel C(신강약 게이트·전제) → A(식상 라우팅) → D(관인상생) → B(재생관).
 * @param saju 대표 명식의 사주(원국 + 현재 대운/세운 + 세운 목록 + (있으면) structure). 결정론 산출값.
 * @param opts timeUnknown(시각 미상 → 원국 시주 제외). 미전달 시 saju 병합값을 읽음.
 */
export function computeJobSignals(saju: SajuChart, opts?: Opts): JobSignals {
  // 시각 미상이면 원국 시주(時支) 제외(잘못된 바탕 판정 방지) — 코드베이스 관례(inyeonGauge/JobTiming과 동일).
  const timeUnknown = opts?.timeUnknown ?? (saju as any)?.timeUnknown === true;
  const posList: PillarPos[] = timeUnknown ? ['년', '월', '일'] : ['년', '월', '일', '시'];
  const dm = saju.dayMaster.stem;

  // ══ C 게이트 전제: 신강약 분류 + R2 용신 그룹(A 게이트가 참조) ══
  const cls = strengthClass(saju);               // 'strong'|'neutral'|'weak'
  const isWeak = cls === 'weak';
  const yongGroup = usefulGodGroup(saju);        // 용신 → 십신 그룹(무료=undefined)

  // ── ① 원국 바탕: 4주(시주 제외 옵션)에서 관/인 슬롯 수 + 살중용식 판정 재료(편관 count·식상 존재) ──
  let natalHits = 0;          // 관/인 자리 수(그릇)
  let natalPyeongwan = 0;     // 원국 '드러난' 편관 수(투출 천간 + 지지 본기) — 양투 살중 판정(A)
  let natalHasSiksang = false;// 원국 식상 존재(천간 + 지지 본기 + 지장간) — 무투출이라도 장간 식상이면 제살 통로(daniel: 丑 中 癸)
  posList.forEach((p) => {
    const d = saju.pillars?.[p];
    if (!d) return;
    if (GWAN_IN.includes(d.stemTenGod)) natalHits++;         // 투출(드러난 자리)
    if (GWAN_IN.includes(d.branchMainTenGod)) natalHits++;   // 지지 본기(현실에 자리잡음)
    // 살중용식 재료
    if (d.stemTenGod === PYEONGWAN) natalPyeongwan++;        // 편관 투출
    if (d.branchMainTenGod === PYEONGWAN) natalPyeongwan++;  // 편관 지지 본기
    if (SIKSANG.includes(d.stemTenGod)) natalHasSiksang = true;                       // 식상 투출
    if ((d.hiddenStems ?? []).some((h) => SIKSANG.includes(h.tenGod))) natalHasSiksang = true; // 식상 지장간(본기 포함)
  });
  const sNatal = Math.min(W.natalGwanIn, natalHits * 3);     // 슬롯 1개=3점(운 신호가 곡선을 움직이게 낮게)

  // ── ②③ 대운(10년 배경)·세운(올해) 관/인 발동 강도(C 게이트 적용됨) ──
  const daeun = saju.currentLuck;   // 현재 대운
  const seun = saju.annual;         // 현재 세운(올해)
  const dAct = pillarActivation(dm, daeun?.stemTenGod, daeun?.branch, cls);
  const sAct = pillarActivation(dm, seun?.stemTenGod, seun?.branch, cls);
  const sDaeun = W.daeunActive * dAct.act;
  const sSeun = W.seunActive * sAct.act;

  // ── ④ 유리한 해: 올해~근미래 세운 중 관/인이 천간에 드는 해 수(JobTiming 과 동일 스캔) ──
  const curYear: number | undefined = (saju.annual as any)?.year;
  const goodSet = new Set<number>();
  if (curYear != null) {
    for (const lc of (saju.luckCycles ?? [])) {
      for (const a of (lc.annuals ?? [])) {
        const yr = a?.year;
        if (yr == null || yr < curYear || yr > curYear + HORIZON) continue;  // 올해~근미래만
        if (GWAN_IN.includes(a.stemTenGod)) goodSet.add(yr);
      }
    }
  }
  const goodYearCount = goodSet.size;
  const sGoodYears = Math.min(W.goodYears, goodYearCount * 5);  // 유리한 해 1개=5점(4~5개면 만점)

  // ── 발동 통합 신호(대운 OR 세운) ──
  const gwanActive = dAct.gwan || sAct.gwan;
  const inActive = dAct.inseong || sAct.inseong;
  const jeonggwanActive = dAct.jeonggwan || sAct.jeonggwan;
  const pyeongwanActive = dAct.pyeongwan || sAct.pyeongwan;
  const sanggwanActive = dAct.sanggwan || sAct.sanggwan;
  const siksinActive = dAct.siksin || sAct.siksin;
  const siksangActive = sanggwanActive || siksinActive;
  const jaeActive = dAct.jae || sAct.jae;

  // ══ A. 상관/식신 라우팅(R2 용신 게이트) — 식상 발동의 '방향'을 가른다 ══
  //   ★'관성 주도발동' = 천간(드러난) 관성 발동으로 조작화(daniel "primary 발동 중"): 지장간 배경 관성이 상관견관을
  //     오발동시키지 않도록. 그리고 살중용식(편관≥2 원국)은 상관견관에 우선(살중 원국의 식상=제살(+), 견관(-) 아님).
  const gwanLead = dAct.gwanStem || sAct.gwanStem;      // 관성 주도발동(천간)
  const gwanIsYong = yongGroup === '관성';
  const sikIsYong = yongGroup === '식상';
  const saljung = natalPyeongwan >= 2 && natalHasSiksang; // 살중용식 구조(원국 편관 양투 + 식상 존재)
  let siksangDelta = 0;
  let aBranch: ABranch = siksangActive ? 'mild' : 'none';
  if (siksangActive) {
    if (saljung) {
      siksangDelta = S.saljungYongSik;                 // +10 제살(취업 문 열림) — 상관견관에 우선
      aBranch = 'saljung';
    } else if (gwanIsYong || gwanLead) {
      if (sanggwanActive) { siksangDelta = S.sanggwanVsGwan; aBranch = 'sanggwan_gyeon_gwan'; } // 상관견관 −8
      else { siksangDelta = S.siksinVsGwan; aBranch = 'siksin_neutral'; }                        // 식신 중립 0
    } else if (sikIsYong) {
      siksangDelta = S.siksangYong;                    // +7 실력으로 뚫는 타입
      aBranch = 'siksang_yong';
    } else {
      siksangDelta = S.siksangMild;                    // +3 실력이나 주 신호 아님
      aBranch = 'mild';
    }
  }

  // ══ D. 관인상생 시너지 = 가산 보너스(곱연산 아님). 신약이면 더 큼. C예외(감점 해제)는 pillarActivation 에서 이미 반영 ══
  const synergyAny = dAct.synergyHere || sAct.synergyHere;
  const synergyBonus = synergyAny ? (isWeak ? S.gwanInSynergyWeak : S.gwanInSynergy) : 0;

  // ══ B. 재생관(마지막 폴리시) ══
  let jaeDelta = 0;
  if (jaeActive) {
    jaeDelta = S.jaeSolo;                                                       // 재성 단독 +7
    const jaeGwanChain = (dAct.jae && dAct.gwan) || (sAct.jae && sAct.gwan);    // 같은 운에 재+관성 동시(재생관 체인)
    if (jaeGwanChain) jaeDelta += S.jaeSaengGwan;                              // +5 추가
    const jaeSalChain = (dAct.jae && dAct.pyeongwan) || (sAct.jae && sAct.pyeongwan); // 같은 운에 재+편관 동시(재생살)
    if (isWeak && jaeSalChain) jaeDelta = 0;                                    // 신약 재생살 → 보너스 전부 제거(재가 살을 키움)
  }

  // ══ C(뉘앙스). 신약 + 편관 단독 강발동 → '취업'보다 '압박·시험대'의 결 ══
  //   편관 천간 강발동 · 관인상생(살인상생 해소) 없음 · 정관 강발동 아님(편관 '단독'). 신약 아니면 false.
  const pyeongwanStemAny = dAct.pyeongwanStem || sAct.pyeongwanStem;
  const jeonggwanStemAny = dAct.jeonggwanStem || sAct.jeonggwanStem;
  const pressureNuance = isWeak && pyeongwanStemAny && !synergyAny && !jeonggwanStemAny;

  // ── 합산(기본 타이밍 + 스탠스 델타 A/D/B) → 0~100 클램프 ──
  const base = sNatal + sDaeun + sSeun + sGoodYears;
  const score = clamp(Math.round(base + siksangDelta + synergyBonus + jaeDelta), 0, 100);

  // 지금 가장 도드라진 기운(신호 카드 헤드라인) — 관성 > 인성 > 식상 > 재성 우선(그룹 레벨, 기존 유지).
  const primary: JobSignals['primary'] =
    gwanActive ? 'gwan' : inActive ? 'in' : siksangActive ? 'siksang' : jaeActive ? 'jae' : 'none';

  return {
    score,
    tone: toneFromScore(score),
    gwanActive,
    inActive,
    siksangActive,
    jaeActive,
    natalGwanIn: natalHits > 0,
    goodYearCount,
    primary,
    jeonggwanActive,
    pyeongwanActive,
    sanggwanActive,
    siksinActive,
    pressureNuance,
    trace: {
      strengthClass: cls,
      usefulGodGroup: yongGroup,
      aBranch,
      base: Math.round(base),
      siksangDelta,
      jaeDelta,
      synergyBonus,
    },
  };
}
