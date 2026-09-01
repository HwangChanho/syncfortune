// app/src/lib/color/personalColor.ts — **퍼스널 컬러 판정** (한봄 전용 · 결정론)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-09-01 — 규칙 **전문을 Boss 가 적었다.** 여기는 받아적은 것이다(★발명 금지).
//
//   퍼스널 컬러는 크게 웜톤·쿨톤이 있고,
//   웜톤에는 **봄 웜톤 · 가을 웜톤**, 쿨톤에는 **여름 쿨톤 · 겨울 쿨톤** 이 있다.
//   ① 월지가 卯·辰·巳·午·未·申 이면 **웜톤**
//        · 목화가 많으면 **봄 웜톤** → 정반대인 **가을 웜톤** 을 몇 개 추가 추천
//        · 금수가 많으면 **가을 웜톤** → 정반대인 **봄 웜톤** 을 몇 개 추가 추천
//   ② 월지가 酉·戌·亥·子·丑·寅 이면 **쿨톤**
//        · 목화가 많으면 **여름 쿨톤** → 정반대인 **겨울 쿨톤** 을 몇 개 추가 추천
//        · 금수가 많으면 **겨울 쿨톤** → 정반대인 **여름 쿨톤** 을 몇 개 추가 추천
//   ③ 판단은 만세력으로 하되 **사주 용어는 한 마디도 꺼내지 않는다.**
//
// ■ ★★왜 «엔진» 인가 — 불변규칙 #1(계산은 룰, LLM 은 해석만)
//   톤을 말로 시키면 실행마다 갈린다. **여기서 정하고** 한봄에게는 «결론» 을 준다.
//   ⇒ 같은 사람은 언제 물어도 같은 톤이 나온다.
//
// ■ ★두 갈래는 **정반대가 같은 계열 안**이다(Boss 문면 그대로)
//   봄웜 ↔ 가을웜 · 여름쿨 ↔ 겨울쿨. 웜과 쿨을 가로지르지 않는다.
//
// ■ ⚠️土 는 **어느 쪽도 아니다** — Boss 는 «목화» 와 «금수» 만 말했다. 土 는 안 센다.
//   (임의로 한쪽에 붙이면 그건 내가 만든 규칙이 된다.)
//
// ■ ⚠️★시각 미상이면 **시주를 빼고** 센다
//   시각을 모르면 엔진이 유령 子시를 만든다(`spec/chart.ts` §timeUnknown).
//   그 가짜 두 글자가 8글자 중 2개다 — **봄↔가을을 뒤집을 수 있다.**
//
// ■ ⚠️동수(목화 = 금수)는 **Boss 가 정하지 않았다** → 발명하지 않는다.
//   `tie: true` 로 표시하고, 한봄이 **눈에 보이는 것**을 되물어 좁힌다(원래 그의 말버릇이다).
// ═══════════════════════════════════════════════════════════════════════════

/** 네 갈래. 화면·프롬프트에 그대로 쓰는 말이다. */
export type Tone = '봄 웜톤' | '여름 쿨톤' | '가을 웜톤' | '겨울 쿨톤';

/** 월지가 이 여섯이면 **웜톤**. */
export const WARM_BRANCHES = ['卯', '辰', '巳', '午', '未', '申'] as const;
/** 월지가 이 여섯이면 **쿨톤**. */
export const COOL_BRANCHES = ['酉', '戌', '亥', '子', '丑', '寅'] as const;

/** 「많다」를 재는 쪽. ★土 는 어느 쪽에도 없다(Boss 문면). */
export const GROWTH = ['木', '火'] as const;   // 목화
export const HARVEST = ['金', '水'] as const;  // 금수

/** 같은 계열 안의 정반대. */
export const OPPOSITE: Record<Tone, Tone> = {
  '봄 웜톤': '가을 웜톤',
  '가을 웜톤': '봄 웜톤',
  '여름 쿨톤': '겨울 쿨톤',
  '겨울 쿨톤': '여름 쿨톤',
};

export type ColorVerdict = {
  /** 진단된 톤. */
  tone: Tone;
  /** 계열 — 화면 문구용. */
  family: '웜톤' | '쿨톤';
  /** 정반대(추가로 몇 개 곁들일 쪽). */
  opposite: Tone;
  /** 목화 개수 · 금수 개수 — 근거를 남긴다(사람에게 보일 말은 아니다). */
  growth: number;
  harvest: number;
  /** 목화 = 금수 라 **한쪽으로 못 정했다**. 되물어 좁혀야 한다. */
  tie: boolean;
  /** 시각 미상이라 시주를 빼고 셌다. */
  usedTimePillar: boolean;
};

/** 한 기둥의 글자 두 개를 **오행으로** 준 모양. */
export type PillarElements = { stem: string; branch: string };

/**
 * 퍼스널 컬러를 정한다.
 *
 * @param monthBranch 월지 한 글자(卯·子 …). 이 한 글자가 **웜/쿨을 혼자 가른다.**
 * @param pillars     년·월·일(+시) 기둥의 **오행**. `[{stem:'木',branch:'火'}, …]`
 *                    ★8글자를 «천간 1 · 지지 1» 로 센다 — 화면의 「나를 이루는 다섯 기운」과 **같은 규칙**이다
 *                      (다른 규칙으로 세면 한봄이 말하는 근거와 회원이 보는 숫자가 갈린다).
 * @param timeUnknown 출생 시각 미상이면 true — **시주를 빼고** 센다
 * @returns 판정. 월지가 열둘 중 하나가 아니면 `null`(모르면 모른다고 한다)
 */
export function personalColor(
  monthBranch: string,
  pillars: PillarElements[],
  timeUnknown = false,
): ColorVerdict | null {
  const warm = (WARM_BRANCHES as readonly string[]).includes(monthBranch);
  const cool = (COOL_BRANCHES as readonly string[]).includes(monthBranch);
  if (!warm && !cool) return null;                    // 글자를 못 알아봤다 — 지어내지 않는다

  // ★시각 미상이면 마지막(시주)을 뺀다. 유령 子시 두 글자가 결론을 뒤집는다.
  const used = timeUnknown ? pillars.slice(0, 3) : pillars;

  let growth = 0, harvest = 0;
  for (const p of used) {
    for (const el of [p.stem, p.branch]) {
      if ((GROWTH as readonly string[]).includes(el)) growth++;
      else if ((HARVEST as readonly string[]).includes(el)) harvest++;
      // 土 는 세지 않는다(Boss 문면 — 목화·금수만 말했다)
    }
  }

  const tie = growth === harvest;
  // 동수면 **일단** 목화 쪽으로 두되 `tie` 를 세운다 — 한봄이 되물어 좁힌다(발명하지 않는다).
  const growthWins = growth >= harvest;
  const tone: Tone = warm
    ? (growthWins ? '봄 웜톤' : '가을 웜톤')
    : (growthWins ? '여름 쿨톤' : '겨울 쿨톤');

  return {
    tone,
    family: warm ? '웜톤' : '쿨톤',
    opposite: OPPOSITE[tone],
    growth,
    harvest,
    tie,
    usedTimePillar: !timeUnknown,
  };
}
