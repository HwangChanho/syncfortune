// engine/johuSatisfied.ts — **조후가 요구하는 오행이 이미 충족됐는가** (결정론 · API 0)
// ─────────────────────────────────────────────────────────────────────────
// 근거: Boss 2026-08-26 **직접 판정** (되물은 것이 아니라 먼저 주신 것) → `R74`
//   > "巳月은 화왕절이고 壬水는 巳에서 絶地라, 궁통보감 조후표상 «巳月 壬水 → 壬水 우선»으로 고정돼 있음.
//   >  **어떤 壬水든 巳月에 오면 동일하게 水가 나옴.**"
//   > "조후 조건이 **충족된 이상 주도권은 억부·격국으로 넘어감.**"
//   > 충족 트리거: **월지 외 동일 오행 2개 이상 + 합국 + 천간 투출**
//
// ■ ★왜 이 파일이 따로 있나 — 「룩업」과 「충족」은 **다른 단계**다
//   조후 룩업(궁통보감)은 **월령만** 본다. 원국 상태를 안 본다.
//   ⇒ 그 표만 읽으면 **이미 그 오행으로 넘치는 원국에도 같은 답**을 낸다.
//     Boss 사례가 정확히 그것이다 — 丙子 癸巳 壬子 甲辰(女)는 수기가 압도적인데
//     룩업은 그대로 «水» 를 낸다. 그러면 «수기로 넘치는데 水가 용신» 이라는 답이 나온다.
//   ★R56(쏠림 게이트)과 **층이 다르다**: R56 은 «조후를 **볼지**», 여기는 «보고 나서 **이미 채워졌는지**».
//
// ■ ★★임의의 숫자를 만들지 않는다
//   Boss 가 준 트리거는 **세 조건의 나열**이다. 그 셋을 **각각 따로** 산출하고,
//   합성은 «셋 다» 일 때만 충족으로 본다(원문에 가장 가까운 읽기).
//   ⚠️부분 충족(둘만 참 등)은 **판정하지 않고 그대로 돌려준다** — 여기서 «2개면 충족» 같은
//     선을 내가 그으면 그건 명리 발명이고, 나중에 사후 변명 장치가 된다
//     (`johu2.ts` 가 가중치를 안 합친 것과 같은 이유 · [[attach-indicators-r-attach]]).
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, PillarPos, Element, Branch } from '../spec/chart';
// ★지지→오행 표를 **새로 만들지 않는다** — `BRANCH_MAIN`(지지 본기 천간)을 거쳐 `STEM_ELEM` 으로 얻는다.
//   표를 하나 더 두면 «두 갈래» 가 되고, 언젠가 한쪽만 고쳐진다([[duplicate-ui-single-source]] 와 같은 종류).
import { BRANCH_MAIN, STEM_ELEM } from './saju';

/** 월지가 속한 계절이 요구하는 조후 오행. **문서에 적힌 원칙만** 쓴다. */
const SUMMER: Branch[] = ['巳', '午', '未'];
const WINTER: Branch[] = ['亥', '子', '丑'];

/**
 * 월령이 요구하는 조후 오행.
 *
 * @returns 여름生 → `水` · 겨울生 → `火` · **봄·가을 → `null`**
 *
 * ⚠️`Element` 는 **한자**다(`'水'`·`'火'`). 화면에 뜨는 한글 라벨('물'·'불')과 다른 값이니
 *   여기서 한글을 쓰면 비교가 조용히 전부 거짓이 된다([[ohaeng-label-geum]] 과 같은 함정).
 *
 * ★`knowledge/classics/궁통보감_조후.md` §0 의 원칙 그대로다:
 *   *"겨울生(亥·子·丑月) → 火 조후가 급선 / 여름生(巳·午·未月) → 水 조후가 급선
 *     봄·가을(寅卯辰·申酉戌) → **한난 참작(월령 심천에 따라 가변)**"*
 * ⚠️봄·가을에 임의의 답을 넣지 않는다 — 문서가 «가변» 이라고 했고, 일간별 표는 아직
 *   辛金 한 줄뿐이다(나머지는 Boss 와 축적 중). **모르면 null 로 두고 판정을 멈춘다.**
 */
export function johuDemand(chart: SajuChart): Element | null {
  const m = chart?.pillars?.['월']?.branch as Branch | undefined;
  if (!m) return null;
  if (SUMMER.includes(m)) return '水';
  if (WINTER.includes(m)) return '火';
  return null;   // 봄·가을 = 참작 가변 → 여기서 정하지 않는다
}

/** 조후 충족 판정 결과 — **세 신호를 따로** 돌려준다(합쳐서 숨기지 않는다). */
export type JohuSatisfaction = {
  /** 월령이 요구하는 오행. null 이면 아래 판정 전부 무의미(`known: false`) */
  demand: Element | null;
  /** 판정할 수 있는가(= 요구 오행을 아는가) */
  known: boolean;
  /** ①월지 **외** 지지에 같은 오행이 몇 개인가(본기 기준) */
  branchCount: number;
  /** ②그 오행으로 가는 **합국**이 있는가(반합·삼합국·방합 포함) */
  hasCombine: boolean;
  /** ③**천간 투출**이 있는가 */
  hasStem: boolean;
  /** ★셋 다 참 — Boss 원문의 트리거를 그대로 읽은 것 */
  satisfied: boolean;
  /** 근거 문자열(사람이 읽는 용도 · 프롬프트에 그대로 실을 수 있다) */
  detail: string;
};

/**
 * 조후가 요구하는 오행이 **원국 안에서 이미 충족됐는가**.
 *
 * @param chart 원국
 * @returns 세 신호 + 합성(`satisfied`). 요구 오행을 모르면 `known: false`
 *
 * ★`satisfied === true` 면 **주도권이 억부·격국으로 넘어간다**(R74).
 *   이 함수는 «넘어갔다» 는 사실만 알린다 — 그다음 무엇을 용신으로 삼을지는 억부·격국의 몫이다.
 */
export function johuSatisfied(chart: SajuChart): JohuSatisfaction {
  const demand = johuDemand(chart);
  if (!demand) {
    return { demand: null, known: false, branchCount: 0, hasCombine: false, hasStem: false, satisfied: false,
      detail: '월령이 봄·가을이라 조후 요구가 «참작 가변» — 판정하지 않는다(궁통보감 §0).' };
  }

  // ① 월지 **외** 지지에서 같은 오행(본기 기준)이 몇 개인가
  const others: PillarPos[] = ['년', '일', '시'];
  const hits = others.filter((p) => {
    const b = chart.pillars?.[p]?.branch as Branch | undefined;
    return !!b && STEM_ELEM[BRANCH_MAIN[b]] === demand;
  });
  const branchCount = hits.length;

  // ② 그 오행으로 가는 합(반합·삼합국·방합) — `transformsTo` 가 곧 결과 오행이다
  const combines = (chart.interactions ?? []).filter(
    (i) => i.type === '합' && i.transformsTo === demand,
  );
  const hasCombine = combines.length > 0;

  // ③ 천간 투출 — 네 기둥의 천간 중 그 오행이 있는가
  const stems = (['년', '월', '일', '시'] as PillarPos[])
    .map((p) => chart.pillars?.[p]?.stem)
    .filter(Boolean) as (keyof typeof STEM_ELEM)[];
  const revealed = stems.filter((st) => STEM_ELEM[st] === demand);
  const hasStem = revealed.length > 0;

  const satisfied = branchCount >= 2 && hasCombine && hasStem;
  const detail = [
    `조후 요구 ${demand}`,
    `월지 외 ${demand} 지지 ${branchCount}개${hits.length ? `(${hits.map((p) => chart.pillars[p].branch).join('·')})` : ''}`,
    hasCombine ? `합국 ${combines.map((c) => c.detail).join('·')}` : '합국 없음',
    hasStem ? `천간 투출 ${revealed.join('·')}` : '천간 투출 없음',
    satisfied ? '⇒ **조후 득**(주도권이 억부·격국으로)' : '⇒ 조후 미충족(룩업대로 조후를 본다)',
  ].join(' · ');

  return { demand, known: true, branchCount, hasCombine, hasStem, satisfied, detail };
}
