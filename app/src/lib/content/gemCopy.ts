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

/** 탄생석(서양 월별) 풀이 3요소 — 상징 키워드 + 전통 의미 + 내 사주 보석과의 대조.
 *  daniel 지시("탄생석 어느정도 풀이가 있어야지") 반영: 이름만 있던 생일 보석에 '어느정도 풀이'를 얹는다.
 *  전부 온디바이스 결정론(API 0). 전통 의미는 일반 상식(보석학·전통)이고, 대조는 기존 용신 로직만 사용(명리 발명 없음). */
export interface BirthstoneReading {
  symbol: string;    // 상징 키워드(강조 표시용). 예: '변함없는 마음·보호'
  tradition: string; // 전통적 의미 1~2문장(자기완결·"전통적으로/예로부터 ~로 여겨져 왔어요" 프레임 = 효능 단정 아님)
  contrast: string;  // 내 사주 보석과의 대조 1문장(match=통함/debunk=내 보석이 더 힘). 용신 로직 재사용(발명 없음)
}

/** 카드 4요소(hook·insight·basis·cta) + 탄생석 풀이(birthstone). */
export interface GemCopy {
  hook: string;    // 훅(스크롤 멈추게)
  insight: string; // debunk=디벙킹 한 줄 / match=희소성 한 줄
  basis: string;   // 원국 1줄 근거(일간+주보석 조합·결정론)
  cta: string;     // 유료 심층분석 유도
  birthstone: BirthstoneReading; // 생일 보석(서양 탄생석) 풀이 — 전통 의미 + 내 보석 대조
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

// ══ ★daniel 검수 슬롯: 서양 탄생석(월별 12종) 전통 의미 풀이 ═════════════════
//   생일 보석(gemMapping.WESTERN_BIRTHSTONE)이 화면에 '이름'만 뜨던 걸 보강 — 각 월 보석의 '전통적 상징'을
//   1~2문장으로 얹는다. 여기 내용은 보석학·전통의 '일반 상식'이라 작성 가능(명리 판정 아님) —
//   ⚠️ 탄생석↔오행 배정(gemMapping)은 daniel 검수 대상이라 손대지 않는다. 여긴 '설명 텍스트'만.
//   ▶ 톤 가드(§4): 의료/재물 '효능 단정' 금지 → "전통적으로/예로부터 ~로 여겨져 왔어요" 프레임까지만.
//   ▶ 문구 가드: 조사(이/가·은/는)가 보석명 뒤에 붙지 않게(받침 무관) 고정 어미로 마무리(gemCopy와 동일 원칙).
//   ▶ 작대기(—) 지양(daniel 07-20) — 문장부호는 마침표·쉼표·가운뎃점(·)만.
interface BirthstoneLore {
  symbol: string;    // 상징 키워드(강조 표시). 예: '변함없는 마음·보호'
  tradition: string; // 전통적 의미 1~2문장(보석명 포함·자기완결). 변수 조사 문제 회피 위해 하드코딩 문장.
}
export const BIRTHSTONE_LORE: Record<number, BirthstoneLore> = {
  1:  { symbol: '변함없는 마음·보호', tradition: '1월 가넷은 붉은빛만큼 뜨거운 진심을 담아, 예로부터 변치 않는 우정과 여행길의 안전을 지켜준다고 여겨져 왔어요.' },
  2:  { symbol: '평정심·맑은 정신',   tradition: '2월 자수정은 흔들리는 마음을 가라앉히는 돌로, 전통적으로 과함을 다스리고 정신을 맑게 지켜준다고 전해져요.' },
  3:  { symbol: '평온·용기',         tradition: '3월 아쿠아마린은 바닷빛을 닮은 항해의 수호석으로, 마음의 평온과 맑은 소통, 나아갈 용기를 상징해요.' },
  4:  { symbol: '영원·순수',         tradition: '4월 다이아몬드는 가장 단단한 돌답게, 변하지 않는 사랑과 흔들림 없는 의지, 순수함을 상징해 왔어요.' },
  5:  { symbol: '재생·풍요',         tradition: '5월 에메랄드는 봄의 초록을 담아, 전통적으로 새로운 시작과 풍요, 사랑과 희망의 돌로 여겨졌어요.' },
  6:  { symbol: '순수·직관',         tradition: '6월 진주·문스톤은 은은한 빛의 돌로, 진주는 순수와 지혜를, 문스톤은 직관과 새 출발을 상징해요.' },
  7:  { symbol: '열정·생명력',       tradition: '7월 루비는 보석의 왕으로 불릴 만큼 강렬한 붉은빛으로, 사랑과 용기, 넘치는 생명력을 상징해요.' },
  8:  { symbol: '위안·행운',         tradition: '8월 페리도트는 어둠을 밝히는 연둣빛 돌로, 예로부터 마음의 짐을 덜고 행운을 부른다고 전해져요.' },
  9:  { symbol: '지혜·신의',         tradition: '9월 사파이어는 깊은 청색만큼 진중한 돌로, 지혜와 진실, 흔들리지 않는 충직함을 상징해요.' },
  10: { symbol: '영감·창조',         tradition: '10월 오팔·투르말린은 여러 빛을 머금은 돌로, 오팔은 상상력과 영감을, 투르말린은 지켜주는 힘을 상징해요.' },
  11: { symbol: '풍요·자신감',       tradition: '11월 토파즈·시트린은 따뜻한 황금빛으로, 상인의 돌이라 불리며 번영과 긍정, 자신감을 상징해요.' },
  12: { symbol: '보호·통찰',         tradition: '12월 터콰이즈·탄자나이트는 청록빛 부적 같은 돌로, 터콰이즈는 보호와 행운을, 탄자나이트는 통찰과 변화를 상징해요.' },
};
// ════════════════════════════════════════════════════════════════════════════

/**
 * 탄생석(서양 월별) 풀이 생성(결정론·API 0) — 전통 의미 + 내 사주 보석과의 대조.
 *   전통 의미 = BIRTHSTONE_LORE(일반 상식). 대조 = 기존 판정값(primaryEl·primaryGemKo·matchType)만 재사용(명리 발명 없음).
 * @param inp gemCopy 입력과 동일(birthMonth·westernKo·primaryEl·primaryGemKo·matchType 사용).
 * @returns {symbol, tradition, contrast} — 카드의 '탄생석 풀이' 섹션에 렌더.
 */
export function birthstoneReading(inp: GemCopyInput): BirthstoneReading {
  const el = `${inp.primaryEl}(${EL_KO[inp.primaryEl]})`;          // 예 '土(토)' — 내 보석 오행(용신/조후)
  const g = inp.primaryGemKo;                                       // 예 '시트린' — 내 사주 보석(대표석)
  const lore = BIRTHSTONE_LORE[inp.birthMonth];                     // 생월 전통 의미(1~12 밖이면 undefined)
  // 대조 1문장 — 조사 회피 위해 보석명 뒤는 '처럼'(불변)·'쪽이'(받침 있는 고정 명사)로만 마무리한다.
  const contrast = inp.matchType === 'match'
    ? `게다가 이 보석은 당신을 살리는 ${el} 기운과도 통해서, ${g}처럼 당신 편이 되어주는 드문 경우예요.`
    : `다만 사주에서 당신을 살리는 건 ${el} 기운이라, 생일 보석보다 ${g} 쪽이 당신에게 힘을 더 실어줘요.`;
  // 정상 경로는 항상 lore 존재(생월 1~12 보장). 방어적 폴백(범위 밖 월)만 서양 이름으로 최소 문구 생성.
  if (!lore) {
    return { symbol: '나의 돌', tradition: `${inp.westernKo}, 당신의 생일 보석이에요.`, contrast };
  }
  return { symbol: lore.symbol, tradition: lore.tradition, contrast };
}

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
    birthstone: birthstoneReading(inp), // 생일 보석 풀이(전통 의미 + 내 보석 대조·결정론)
  };
}

/** 카드 4요소(hook·insight·basis·cta) 총 글자 수(공백 제외) — 120자 가드·하네스 검증용.
 *  ※birthstone(탄생석 풀이)은 별도 섹션이라 이 120자 공유 카피 예산에 포함하지 않는다. */
export function gemCopyLength(c: GemCopy): number {
  return (c.hook + c.insight + c.basis + c.cta).replace(/\s/g, '').length;
}
