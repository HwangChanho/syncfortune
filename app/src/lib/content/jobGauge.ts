// app/src/lib/content/jobGauge.ts — 취업·이직 가능성 게이지 결정론 엔진 (온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 스탠스 인코딩(★검수 슬롯 — 발명 아님, 표준 십신 통설 + 엔진 tenGod/HIDDEN 재사용, LLM 미사용).
//   재회(lib/love/inyeonGauge)와 같은 결의 '무료 리치' 결정론 엔진의 취업·이직 버전.
//   → 무료 퍼널(jobAsk)의 JobRich 가 이 점수/신호로 '취업 문이 열린 정도' 게이지를 그리고,
//     깊은 통변(유료 /job)은 supabase/Edge(LLM)가 맡는다(규칙5·ABSOLUTE-0: 무료 = 온디바이스만).
//
// ▶ ★daniel 취업 스탠스(FLAG=검수 필요, 아래는 sensible default):
//   취업·이직·합격이 유리한 때 = 지금 운(대운·세운)에 **관성(직장·자리·합격)** 또는 **인성(자격·서류·시험)**이
//     발동할 때 강하다. 보조로 **식상(면접·실력 발휘)**·**재성(결실·연봉)**이 힘을 보탠다.
//   이는 interpret 의 buildJobPrompt / 컴포넌트 JobTiming 이 이미 쓰는 매핑과 동일한 결(관성·인성=취업 응기)을
//     '점수(0~100)'로 합산한 것 — 그 위에 대운/세운/유리한 해/원국 바탕을 가중 합성한다.
//
// ▶ 게이지가 합산하는 신호(전부 결정론):
//   ① 원국 바탕      — 원국 4주에 관성·인성이 자리잡은 정도(직장·자격의 태생적 그릇).
//   ② 대운(10년)     — 현재 대운 천간/지장간에 관성·인성 발동(큰 배경 흐름).
//   ③ 세운(올해)     — 올해 세운 천간/지장간에 관성·인성 발동(올해 트리거 = 가중 최고).
//   ④ 유리한 해 수   — 근미래 세운(관/인이 드는 해) 개수(시기가 콕 잡히는 확실성 — JobTiming 과 동일 스캔).
//   ⑤ 보조(식상·재성)— 면접·실력(식상)·결실·연봉(재성) 발동 보너스.
//
// ▶ 결과: score 0~100 + tone(open/warming/quiet) + 하위 신호(neutral key — 컴포넌트가 일상어로 매핑).
//   ★한자·십신 용어는 이 모듈 밖(화면 텍스트)으로 절대 노출하지 않는다 — 여기선 neutral key 만 반환.
//   ★가중치는 아래 W 블록(daniel 검수/튜닝 슬롯)에 모아 둔다.
// ─────────────────────────────────────────────────────────────────────────
import { tenGod, HIDDEN } from '@engine/saju';                          // 십신·지장간 표준표(엔진 재사용 — 발명 아님)
import { toneFromScore, type GaugeTone } from '../love/inyeonGauge';    // 톤 경계(66/34)·타입 = 재회 게이지와 단일 소스(일관 표시)
import type { SajuChart, Branch, Stem, TenGod, PillarPos } from '@spec/chart';

// ── 표준 십신 그룹(정/편 묶음 = 표준 통설). 취업 도메인 매핑은 ★daniel 검수 슬롯 ──
const GWAN: TenGod[] = ['정관', '편관'];       // 관성 = 직장·자리·취업·승진·합격
const INSEONG: TenGod[] = ['정인', '편인'];    // 인성 = 자격·문서·시험·서류·합격
const SIKSANG: TenGod[] = ['식신', '상관'];    // 식상 = 면접·실력·실무 발휘
const JAESEONG: TenGod[] = ['정재', '편재'];   // 재성 = 현실 성과·연봉·결실
const GWAN_IN: TenGod[] = [...GWAN, ...INSEONG]; // 취업·합격 핵심(관+인) 합집합 — 유리한 해·원국 바탕 판정용

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// ══ ★daniel 검수: 취업 게이지 가중치(스탠스 · 전부 튜닝 슬롯). 각 항의 만점(부분점수). 합계 = 100 ══
//   기질(원국)보다 '지금 운'이 크게 움직이도록 배분(무료 훅 = "지금 열려요"가 살아있게).
//   올해 세운(seunActive)을 최대 가중 = 무료 게이지가 '올해' 기준이므로 올해 트리거를 가장 무겁게.
const W = {
  natalGwanIn: 14,   // ① 원국 바탕 — 관/인이 자리잡은 그릇(있으면 취업의 문이 태생적으로 조금 더 열림)
  daeunActive: 22,   // ② 대운(10년 배경)에 관/인 발동 — 큰 흐름
  seunActive: 28,    // ③ 세운(올해)에 관/인 발동 — 올해 트리거(가중 최고)
  goodYears: 22,     // ④ 근미래 '관/인이 드는 유리한 해' 수 — 시기가 콕 잡히는 확실성
  boost: 14,         // ⑤ 식상(면접·실력)·재성(결실·연봉) 보조 발동
};
// 합계 = 100. 순수 표시 코드(JobRich)는 이 값을 몰라도 되게 하위 신호(boolean)만 소비한다.
// ══════════════════════════════════════════════════════════════════════════════════════════════

const HORIZON = 15;  // 유리한 해 스캔 상한(근미래만 — 노년까지 세지 않도록). JobTiming 과 동일.

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
}

/** sex 는 취업에 무관 — timeUnknown(시각 미상 → 시주 제외)만 받는다. 미전달 시 saju 병합값을 읽음(FreeFunnel 관례). */
type Opts = { timeUnknown?: boolean };

// 한 지지(branch)의 지장간이 품은 십신 목록(본기+중기+여기) — 운 지지의 '숨은 기운' 발동 판정용.
//   대운/세운(LuckCycle/AnnualPillar)엔 stemTenGod 만 있고 지지 십신은 없으므로 HIDDEN+tenGod 로 산출(엔진 재사용).
const branchTenGods = (dm: Stem, b: Branch): TenGod[] => HIDDEN[b].map((h) => tenGod(dm, h.stem));

/**
 * 한 운 기둥(대운 또는 세운)이 관/인/식/재를 얼마나 '발동'시키는가.
 *   천간(드러남) = 강한 발동 / 지지 장간(숨은 기운) = 약한 발동. 관성이 인성보다 살짝 강(직장 자리 = 취업 직접).
 * @param dm 일간, stemTG 운의 천간 십신, branch 운의 지지
 * @returns act(관/인 발동 강도 0~1) + 각 기운(관/인/식/재) 발동 여부(천간·지장간 통합)
 */
function pillarActivation(dm: Stem, stemTG: TenGod | undefined, branch: Branch | undefined) {
  const bTGs = branch ? branchTenGods(dm, branch) : [];
  const stemIn = (list: TenGod[]) => !!stemTG && list.includes(stemTG);      // 천간(드러난 기운)
  const anyIn = (list: TenGod[]) => stemIn(list) || bTGs.some((t) => list.includes(t)); // 천간 OR 지장간

  // 관/인 발동 강도(0~1): 천간이면 강, 장간만이면 약. (관성 > 인성 = 취업 직접 > 자격 뒷받침)
  let act = 0;
  if (stemIn(GWAN)) act = Math.max(act, 1.0);
  else if (stemIn(INSEONG)) act = Math.max(act, 0.85);
  if (act < 0.55 && bTGs.some((t) => GWAN.includes(t))) act = Math.max(act, 0.55);   // 지지 속 관성(숨은 자리)
  if (act < 0.45 && bTGs.some((t) => INSEONG.includes(t))) act = Math.max(act, 0.45); // 지지 속 인성(숨은 자격)

  return {
    act,                          // 관/인 발동 강도(0~1) — 점수 가중용
    gwan: anyIn(GWAN),            // 직장·자리 기운(관성) 발동
    inseong: anyIn(INSEONG),      // 자격·서류 기운(인성) 발동
    siksang: anyIn(SIKSANG),      // 면접·실력 기운(식상) 발동
    jae: anyIn(JAESEONG),         // 결실·연봉 기운(재성) 발동
  };
}

/**
 * 취업·이직 가능성 게이지 신호 산출(결정론·온디바이스). JobRich 가 이 결과로 게이지·신호 카드를 그린다.
 * @param saju 대표 명식의 사주(원국 + 현재 대운/세운 + 세운 목록). 결정론 산출값(FreeFunnel 병합: timeUnknown).
 * @param opts timeUnknown(시각 미상 → 원국 시주 제외). 미전달 시 saju 병합값을 읽음.
 * @returns 점수·톤 + 하위 신호(문구는 컴포넌트가 일상어로 얹음 — 여기서 한자/십신 카피 하드코딩하지 않음).
 */
export function computeJobSignals(saju: SajuChart, opts?: Opts): JobSignals {
  // 시각 미상이면 원국 시주(時支) 제외(잘못된 바탕 판정 방지) — 코드베이스 관례(inyeonGauge/JobTiming과 동일).
  const timeUnknown = opts?.timeUnknown ?? (saju as any)?.timeUnknown === true;
  const posList: PillarPos[] = timeUnknown ? ['년', '월', '일'] : ['년', '월', '일', '시'];
  const dm = saju.dayMaster.stem;

  // ── ① 원국 바탕: 4주(시주 제외 옵션)에서 관/인이 자리잡은 슬롯 수(천간+지지 본기). 그릇의 태생적 바탕 ──
  let natalHits = 0;
  posList.forEach((p) => {
    const d = saju.pillars?.[p];
    if (!d) return;
    if (GWAN_IN.includes(d.stemTenGod)) natalHits++;         // 투출(드러난 자리)
    if (GWAN_IN.includes(d.branchMainTenGod)) natalHits++;   // 지지 본기(현실에 자리잡음)
  });
  const sNatal = Math.min(W.natalGwanIn, natalHits * 3);     // 슬롯 1개=3점(대개 2~3 → 운 신호가 곡선을 움직이게 낮게)

  // ── ②③ 대운(10년 배경)·세운(올해) 관/인 발동 강도 ──
  const daeun = saju.currentLuck;   // 현재 대운(엔진 산출, 폴백 포함)
  const seun = saju.annual;         // 현재 세운(올해)
  const dAct = pillarActivation(dm, daeun?.stemTenGod, daeun?.branch);
  const sAct = pillarActivation(dm, seun?.stemTenGod, seun?.branch);
  const sDaeun = W.daeunActive * dAct.act;
  const sSeun = W.seunActive * sAct.act;

  // ── ④ 유리한 해: 올해~근미래 세운 중 관/인이 천간에 드는 해 수(연 단위 timing — JobTiming 과 동일 스캔) ──
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

  // ── ⑤ 보조: 식상(면접·실력)·재성(결실·연봉)이 대운·세운에 발동하면 소폭 가산 ──
  const siksangActive = dAct.siksang || sAct.siksang;
  const jaeActive = dAct.jae || sAct.jae;
  let boost = 0;
  if (siksangActive) boost += 7;
  if (jaeActive) boost += 7;
  const sBoost = Math.min(W.boost, boost);

  // ── 합산(각 항 부분점수 → 0~100 클램프) ──
  const score = clamp(Math.round(sNatal + sDaeun + sSeun + sGoodYears + sBoost), 0, 100);

  // ── 하위 신호(neutral key) ──
  const gwanActive = dAct.gwan || sAct.gwan;
  const inActive = dAct.inseong || sAct.inseong;
  // 지금 가장 도드라진 기운(신호 카드 헤드라인) — 관성 > 인성 > 식상 > 재성 우선.
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
  };
}
