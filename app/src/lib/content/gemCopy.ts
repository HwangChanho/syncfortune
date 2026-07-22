// app/src/lib/content/gemCopy.ts — R-GEM v0.1 온디바이스 카피 템플릿 (결정론·LLM 아님·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 보석 추천 카드의 문구를 '결정론 템플릿'으로 생성한다(LLM 호출 0). 원국 값(일간·용신)을 끼워 넣어
//   base-rate(누구에게나 참) 문구가 아니라 '당신 사주' 문구가 되게 한다(예 "辛金 일간").
//
// ▶ 출력 = 카드 4요소: hook(훅) · insight(디벙킹/희소성) · basis(원국 1줄 근거) · cta(유료 유도).
// ▶ 총 120자 이내(4요소 합) — 공유 카드에 얹히므로 짧게. 아래 조합은 daniel 案 기준 ~75자.
// ▶ 톤 가드(§4 안전):
//     · 보일러플레이트 금지 → 원국 구체(일간 글자) 삽입.
//     · 의료/재물 '효능 단정' 금지 → "힘이 되는 기운"(오행 상성) 수준까지만. 필요 시 "전통적으로 ~로 여겨져 왔다" 프레임 허용.
//     · '피하는 보석(기신)'은 카피에서 겁주지 않음 — 여긴 주보석/보조석만 다룬다.
// ★★★ 이 파일의 모든 문구 = daniel 검수 슬롯(초안). 아래 TEMPLATES 를 검수·교체한다. ★★★
// ─────────────────────────────────────────────────────────────────────────
import type { Element } from '@spec/chart';
import type { GemBasis } from './gemRecommend';

/** 오행 글자 → 한글 독음(문구 보조용). */
export const EL_KO: Record<Element, string> = { 木: '목', 火: '화', 土: '토', 金: '금', 水: '수' };

/** gemCopy 입력 — 카드 문구에 필요한 원국 요약 + 판정 결과. */
export interface GemCopyInput {
  dayStem: string;               // 일간 천간 글자(예 '辛') — 원국 구체 삽입용
  dayEl: Element;                // 일간 오행(예 '金')
  monthBranch: string;           // 월지(예 '卯') — 조후 맥락(확장 대비, 현재 문구엔 미사용)
  primaryEl: Element;            // 주보석 오행(용신 또는 조후 오버라이드)
  basis: GemBasis;               // 'eokbu' | 'johu_override' — 근거 문구 분기
  birthMonth: number;            // 양력 생월(1~12) — 훅에 사용
  westernKo: string;             // 서양탄생석 한글(예 '아쿠아마린')
  primaryGemKo: string;          // 주보석 대표석(standard) 한글(예 '시트린')
  matchType: 'match' | 'debunk'; // 훅/디벙킹 분기
}

/** 카드 4요소 — hook·insight·basis·cta. */
export interface GemCopy {
  hook: string;    // 훅(스크롤 멈추게)
  insight: string; // debunk=디벙킹 한 줄 / match=희소성 한 줄
  basis: string;   // 원국 1줄 근거(일간+주보석 조합·결정론)
  cta: string;     // 유료 심층분석 유도
}

// ══ ★daniel 검수 슬롯: 문구 템플릿 ══════════════════════════════════════════
//   {n}=생월, {w}=서양탄생석, {dm}=일간(辛金), {g}=주보석(시트린) 치환.
const T = {
  debunk: {
    hook: (n: number, w: string) => `${n}월생이라 ${w}? 잠깐만요.`,
    insight: () => `서양 탄생석은 생일 달력이 정한 것일 뿐이에요.`,
    cta: () => `내게 맞는 진짜 보석 보기 →`,
  },
  match: {
    hook: (n: number, w: string) => `${n}월생 ${w}, 우연이 아니에요.`,
    insight: () => `드물게도 생일 보석이 당신 사주와 맞아떨어져요.`,
    cta: () => `이 인연 같은 보석 더 보기 →`,
  },
  // 근거 1줄(공통) — 일간+주보석 조합. basis 에 따라 억부/조후 프레이밍.
  //   ※보석명(변수) 뒤에 조사(이에요/가)를 붙이면 받침 유무로 문법이 틀어진다 → 보석명은 쉼표로 떼고
  //     문장 끝은 고정 어미(기운이에요/잡아줘요)로 마무리해 어떤 보석명이 와도 항상 자연스럽게 한다.
  basisEokbu: (dm: string, g: string) => `${g}, ${dm} 일간에게 힘이 되는 기운이에요.`,
  basisJohu: (dm: string, g: string) => `${g}, 한난이 치우친 ${dm} 일간의 균형을 잡아줘요.`,
} as const;
// ════════════════════════════════════════════════════════════════════════════

/**
 * 보석 카드 4요소 문구 생성(결정론). matchType·basis 로 분기하고 원국 값을 끼워 넣는다.
 * @param inp 원국 요약 + 판정 결과(recommendGem 산출 + 일간 정보).
 * @returns {hook, insight, basis, cta} — 합 120자 이내(daniel 案 기준).
 */
export function gemCopy(inp: GemCopyInput): GemCopy {
  const dm = `${inp.dayStem}${inp.dayEl}`;                 // 예 '辛金'(원국 구체)
  const g = inp.primaryGemKo;                              // 예 '시트린'
  const tpl = inp.matchType === 'match' ? T.match : T.debunk;
  const basis = inp.basis === 'johu_override'
    ? T.basisJohu(dm, g)
    : T.basisEokbu(dm, g);
  return {
    hook: tpl.hook(inp.birthMonth, inp.westernKo),
    insight: tpl.insight(),
    basis,
    cta: tpl.cta(),
  };
}

/** 카드 4요소 총 글자 수(공백 제외) — 120자 가드·하네스 검증용. */
export function gemCopyLength(c: GemCopy): number {
  return (c.hook + c.insight + c.basis + c.cta).replace(/\s/g, '').length;
}
