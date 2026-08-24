// app/src/lib/content/gaeun.ts — **개운 방향**(만세력 오행·강약 탭 · 무료 · 온디바이스 · API 0)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-24 *"오행강약해 약한 기운을 보완하는 개운법을 간략하게 · 목화토금수에 매핑되는
//   십성별로 세분화 · 어떤 부분을 보완하면 가장 좋을지도 알맞게 판단해야"*
//
// ■ ★★"약한 기운을 보완한다"를 **글자 그대로 구현하면 틀린다**
//   제일 적은 오행을 채우는 것이 개운이 아니다. **약한 기신을 채우면 해롭다.**
//   이 프로젝트가 이미 답을 갖고 있다:
//     · R59 (`knowledge/명리_지식레이어.md`) — *"힘의 균형·**개운**=억부"*
//     · `knowledge/rules/spouse_reading_methodology.md` §7 — *"**용신 보강이 곧 개운.**"*
//     · `healingMethod.ts` 머리말(daniel B7 2026-07-06) — *"과거 '채움=최소오행'은 **명리 오류**였다"*
//   ⇒ 축은 **용신**이다. 최소 오행은 *참고*로만 곁들인다(강등·주 처방 아님 — B7 판정 그대로).
//
// ■ 무엇이 이 파일의 몫인가
//   용신·희신·기신은 **정하지 않는다** — `computeYongsinApprox`(canonical 위임)가 정한 것을 받는다.
//   ★여기서 용신을 다시 계산하면 [[yongsin-app-engine-drift]] 사고가 재발한다
//     (앱이 水, 엔진이 土 를 내던 그 사고 — 두 개의 다른 구현이 원인이었다).
//   이 파일은 그 결론을 **십신 축으로 옮기고 순서를 매길** 뿐이다.
//
// ■ 십신별 행위 문구의 근거 (★발명하지 않았다 — 출처를 각 항목에 적어 둔다)
//   비겁 R58·R19 / 식상 §7·R18 / 관성·인성 지식레이어 취업운·§7 / **재성은 근거가 얇다 → 검수 대기**
// ═══════════════════════════════════════════════════════════════════════════
import type { SajuChart, PillarPos } from '@spec/chart';
import { sipsinGroupOf, type Elem5, type SipsinGroup } from '@engine/sipsinGroup';
import { appLang } from '../i18n';
import { stemElement, branchElement } from '../engine/ohaeng';
import { computeYongsinApprox } from './yongsinApprox';
import { ELEM_LABEL } from './ohaengLabel';   // ★오행 이름표 단일 소스(사본 만들지 말 것 — 金='금')

// ★오행→십신 표는 **엔진이 단일 원본**이다(`@engine/sipsinGroup`).
//   여기 사본을 두면 만세력 안에서 같은 오행이 용신 카드와 개운 블록에서 **다르게** 보일 수 있다.
type Elem = Elem5;
export type { SipsinGroup };

/** 십신별 개운 행위 — 한 줄 요약 + 실천 셋. ★출처를 `src` 에 적는다(검수 때 근거를 되짚을 수 있게). */
const ACT: Record<SipsinGroup, { head: string; todo: string[]; src: string; review?: true }> = {
  비겁: {
    head: '내 힘으로 밀어붙일 자리를 만든다',
    todo: ['혼자 끝까지 해내는 일 하나를 붙든다', '또래·동료와 나란히 하는 활동(운동·모임)', '남에게 맡기던 결정을 직접 내려 본다'],
    src: 'R58 비겁=배기량(순간 출력) · R19 비겁결집형=자력본위·경쟁·독립',
  },
  식상: {
    head: '안에 있는 것을 밖으로 내보낸다',
    todo: ['말·글·영상으로 내 생각을 꺼내 놓는다', '손으로 만들어 결과물을 남긴다', '아는 것을 남에게 가르쳐 본다'],
    src: '배우자 방법론 §7 "표현·발신" · R18 비겁多+식상弱=발산 막혀 울체',
  },
  재성: {
    head: '실물과 숫자를 직접 다룬다',
    todo: ['수입·지출을 직접 세어 관리한다', '몸을 써서 눈에 보이는 결과를 만든다', '사람을 만나 실제로 오가는 일을 벌인다'],
    src: '⚠️근거가 얇다 — 재성 개운 행위는 문헌 앵커 없이 확장한 것',
    review: true,
  },
  관성: {
    head: '규칙과 책임이 있는 자리에 선다',
    todo: ['맡은 일을 기한 안에 끝내 신뢰를 쌓는다', '직함·역할이 분명한 자리를 맡는다', '스스로 지킬 규칙을 정해 지킨다'],
    src: '지식레이어 "취업운 = 관성 획득"',
  },
  인성: {
    head: '배우고 자격을 갖춰 받침을 만든다',
    todo: ['자격·시험·문서로 남는 공부를 한다', '한 분야를 깊게 파 전문성을 쌓는다', '조언을 구할 어른·스승을 곁에 둔다'],
    src: '배우자 방법론 §7 "자격·문서·전문성·후원" · 지식레이어 "인성=문서·합격·시험" · R58 인성=연료(지속) · R19 수용·학습·후원',
  },
};

/** 보완 대상 하나. */
export type GaeunTarget = {
  /** 1 = 최우선(용신) · 2 = 보조(희신) */
  rank: 1 | 2;
  element: Elem;
  elementLabel: string;
  sipsin: SipsinGroup;
  /** 원국에서 이 오행이 차지하는 비율(%) — 얼마나 비어 있는지 보여 주는 값 */
  share: number;
  /** 원국 지지에 뿌리가 있는가 = **타고났는가** */
  rooted: boolean;
  head: string;
  todo: string[];
  /** ★문구 근거(검수용). 화면에는 안 쓴다 */
  src: string;
  /** 근거가 얇아 검수가 필요한 항목 */
  needsReview: boolean;
};

export type GaeunResult = {
  targets: GaeunTarget[];                 // 우선순위 순(용신 → 희신)
  /** 채우면 **안 되는** 기운 — "약한 걸 다 채우면 된다"는 오해를 여기서 끊는다 */
  avoid: { element: Elem; elementLabel: string; sipsin: SipsinGroup };
  /** 판단 축(억부/병약/조후/종격/통관) — 무엇을 근거로 골랐는지 밝힌다 */
  method: string;
  /** 원국에서 제일 적은 오행 — **참고만**(주 처방 아님. healingMethod B7 판정과 같은 결) */
  scarcest: { element: Elem; elementLabel: string; sipsin: SipsinGroup; share: number };
  /** 용신을 타고나지 못했을 때의 경고(통근 없음) */
  caution: string | null;
};

/**
 * 개운 방향 산출.
 *
 * @param saju 원국(`computeChart(input).saju`)
 * @returns 명식이 없으면 null. 있으면 용신→희신 순의 보완 대상 + 피할 기운 + 참고용 최소 오행
 */
export function gaeunGuide(saju: SajuChart): GaeunResult | null {
  if (!saju?.dayMaster?.stem || !saju.pillars) return null;
  const dayEl = stemElement(saju.dayMaster.stem) as Elem;
  // ★`ELEM_LABEL` 은 **언어별 이중 맵**이다(`ELEM_LABEL.金.ko`). 사본을 만들지 말고 여기서 언어를 고른다.
  const L = appLang();
  const elLabel = (e: Elem) => ELEM_LABEL[e]?.[L] ?? ELEM_LABEL[e]?.ko ?? e;
  const ys = computeYongsinApprox(saju);
  if (!ys?.yongsin) return null;

  // ── 원국 오행 비율 — 천간 + 지지(본기). 지장간까지 세지 않는다(간략 표시라 개수 기준으로 충분) ──
  const timeUnknown = (saju as { timeUnknown?: boolean }).timeUnknown === true;
  const POS: PillarPos[] = timeUnknown ? ['년', '월', '일'] : ['년', '월', '일', '시'];
  const cnt: Record<Elem, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const branches: Elem[] = [];
  for (const p of POS) {
    const pil = saju.pillars[p];
    if (!pil) continue;
    cnt[stemElement(pil.stem) as Elem]++;
    const be = branchElement(pil.branch) as Elem;
    cnt[be]++;
    branches.push(be);
  }
  const total = Object.values(cnt).reduce((a, b) => a + b, 0) || 1;
  const share = (e: Elem) => Math.round((cnt[e] / total) * 100);

  /** 오행 하나를 보완 대상으로 만든다. */
  const mk = (el: Elem, rank: 1 | 2): GaeunTarget => {
    const sip = sipsinGroupOf(dayEl, el);
    const a = ACT[sip];
    return {
      rank, element: el, elementLabel: elLabel(el), sipsin: sip,
      share: share(el),
      // ★통근 = 원국 **지지**에 그 오행이 있는가. 천간만 있으면 뿌리 없는 것이다(R58).
      rooted: branches.includes(el),
      head: a.head, todo: a.todo, src: a.src, needsReview: !!a.review,
    };
  };

  const targets: GaeunTarget[] = [mk(ys.yongsin as Elem, 1)];
  // 희신이 용신과 다를 때만 둘째로 둔다(같으면 같은 말을 두 번 하는 셈)
  if (ys.huisin && ys.huisin !== ys.yongsin) targets.push(mk(ys.huisin as Elem, 2));

  const gi = ys.gisin as Elem;
  const scarceEl = (Object.keys(cnt) as Elem[]).reduce((a, b) => (cnt[a] <= cnt[b] ? a : b));

  // ★용신을 지지에 못 타고났으면 밝힌다 — 지식레이어: *"용신을 애초에 타고나지 못했거나
  //   기신운이 오면 못 쓴다. 용신 못 타고난 사람 = 삶의 방향성 변화가 크다."*
  //   있는 걸 쓰는 것과 없는 걸 만드는 것은 **다른 노력**이라, 같은 문구로 말하면 안 된다.
  const caution = targets[0].rooted
    ? null
    : `${targets[0].elementLabel} 기운을 지지에 타고나지 않았어요. 원래 있던 걸 꺼내 쓰는 게 아니라 **새로 만들어 가는** 쪽이라, 한 번에 되기보다 오래 붙들수록 쌓여요.`;

  return {
    targets,
    avoid: { element: gi, elementLabel: elLabel(gi), sipsin: sipsinGroupOf(dayEl, gi) },
    method: ys.method,
    scarcest: { element: scarceEl, elementLabel: elLabel(scarceEl), sipsin: sipsinGroupOf(dayEl, scarceEl), share: share(scarceEl) },
    caution,
  };
}
