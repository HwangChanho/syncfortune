// engine/glyphSwap.ts — **글자 바꿔 보기**: 원국 여덟 글자를 각자의 충(沖)/합(合) 짝으로 통째로 치환한다
// ═══════════════════════════════════════════════════════════════════════════
// ★Boss 2026-09-01: *"만세력에 원국에서 충하는 글자보기 하면 전체 글자별 충하는 글자로 바꾸고
//   거기에 맞게 내용 십신등 변경해줘 합하는글자 보기도 두개를 하나로 묶어서 버튼으로 만들고
//   각각설정해서 볼수있게"*
//
// ■ 무엇을 하나 — 「내 명식의 **거울상**」을 본다.
//   원국 여덟 글자를 전부 짝으로 바꾸면 일간까지 바뀌므로 **십신·지장간·통근·12운성이 전부 따라온다.**
//   그래서 치환은 반드시 `buildPillar` **앞**에서 일어난다(뒤에서 글자만 갈면 속이 안 맞는다).
//
// ■ ⚠️★여기 표들은 **명리 교과서의 확정 짝**이다 — 내가 정한 것이 하나도 없다.
//   문파 갈림이 없는 기본 짝이라 §3.3(명리 발명 금지)에 걸리지 않는다:
//     천간충(四沖) 甲庚·乙辛·丙壬·丁癸        — 戊己는 중앙 土라 충이 **없다**(짝이 없으니 그대로)
//     지지육충     子午·丑未·寅申·卯酉·辰戌·巳亥
//     천간오합     甲己·乙庚·丙辛·丁壬·戊癸    — 열 글자 전부 짝이 있다
//     지지육합     子丑·寅亥·卯戌·辰酉·巳申·午未
//
// ■ ⚠️★`southern.ts` 의 표와 **합치지 말 것**(비슷하게 생겼지만 다른 규칙이다).
//   남반구 표는 Boss 가 *"토를 제외한"* 이라고 못 박아 丑未·辰戌이 **빠져 있다**.
//   여기 충 표는 *"전체 글자별"* 이라 여섯 짝이 **다 있다**. 한쪽으로 합치면
//   남반구 규칙이 조용히 바뀐다(Boss 가 준 문장과 달라진다) → 두 파일은 계속 따로 둔다.
//
// ■ ⚠️적용 범위는 **원국 여덟 글자까지**다. 대운·세운은 안 건드린다 —
//   운까지 뒤집을지는 정해진 바가 없고, 그건 내가 정할 자리가 아니다(§3.3).
//
// ■ ★이 파일은 **의존 0**이다(순수 표 + 순수 함수). 하네스가 앱 런타임 없이 그대로 부른다.
// ═══════════════════════════════════════════════════════════════════════════

/** 보기 모드 — `undefined`(원국 그대로) · `'chung'`(충 짝) · `'hap'`(합 짝). */
export type GlyphSwapMode = 'chung' | 'hap';

/** 천간 충(四沖). ★戊己(중앙 土)는 짝이 **없다** — 표에 안 넣는다(= 그대로 남는다). */
export const CHUNG_STEM_FULL: Readonly<Record<string, string>> = Object.freeze({
  甲: '庚', 庚: '甲',
  乙: '辛', 辛: '乙',
  丙: '壬', 壬: '丙',
  丁: '癸', 癸: '丁',
});

/** 지지 육충(六沖). ★남반구 표와 달리 **丑未·辰戌(土 쌍)도 들어간다** — Boss: "전체 글자별". */
export const CHUNG_BRANCH_FULL: Readonly<Record<string, string>> = Object.freeze({
  子: '午', 午: '子',
  丑: '未', 未: '丑',
  寅: '申', 申: '寅',
  卯: '酉', 酉: '卯',
  辰: '戌', 戌: '辰',
  巳: '亥', 亥: '巳',
});

/** 천간 오합(五合) — 甲己合土 · 乙庚合金 · 丙辛合水 · 丁壬合木 · 戊癸合火. 열 글자 전부 짝이 있다. */
export const HAP_STEM: Readonly<Record<string, string>> = Object.freeze({
  甲: '己', 己: '甲',
  乙: '庚', 庚: '乙',
  丙: '辛', 辛: '丙',
  丁: '壬', 壬: '丁',
  戊: '癸', 癸: '戊',
});

/** 지지 육합(六合) — 子丑 · 寅亥 · 卯戌 · 辰酉 · 巳申 · 午未. 열두 글자 전부 짝이 있다. */
export const HAP_BRANCH: Readonly<Record<string, string>> = Object.freeze({
  子: '丑', 丑: '子',
  寅: '亥', 亥: '寅',
  卯: '戌', 戌: '卯',
  辰: '酉', 酉: '辰',
  巳: '申', 申: '巳',
  午: '未', 未: '午',
});

/**
 * 천간 한 글자를 짝으로 바꾼다.
 * @param s    천간 한 글자(甲~癸)
 * @param mode 보기 모드. `undefined` 면 **아무것도 안 한다**(원국 그대로).
 * @returns    짝. 짝이 없으면(충 모드의 戊己) 들어온 글자 그대로.
 */
export function swapStem(s: string, mode?: GlyphSwapMode): string {
  if (!mode) return s;
  const tbl = mode === 'chung' ? CHUNG_STEM_FULL : HAP_STEM;
  return tbl[s] ?? s;
}

/**
 * 지지 한 글자를 짝으로 바꾼다.
 * @param b    지지 한 글자(子~亥)
 * @param mode 보기 모드. `undefined` 면 원국 그대로.
 * @returns    짝(충·합 모두 열두 글자 전부 짝이 있어 항상 바뀐다).
 */
export function swapBranch(b: string, mode?: GlyphSwapMode): string {
  if (!mode) return b;
  const tbl = mode === 'chung' ? CHUNG_BRANCH_FULL : HAP_BRANCH;
  return tbl[b] ?? b;
}

/**
 * 간지 두 글자('甲子')를 한 번에 바꾼다.
 * @param gz   간지 두 글자
 * @param mode 보기 모드
 * @returns    바뀐 간지. ⚠️두 글자가 아니면 **손대지 않는다**(방어 — 엔진 값이 늘 두 글자란 보장은 없다).
 */
export function swapGz(gz: string, mode?: GlyphSwapMode): string {
  if (!mode || gz.length !== 2) return gz;
  return swapStem(gz[0], mode) + swapBranch(gz[1], mode);
}

/**
 * 짝이 없어 **안 바뀌는** 글자인가 — 화면이 "이 글자는 충이 없어요"라고 알려 줄 때 쓴다.
 * ★충 모드의 戊·己가 유일한 경우다(합은 전부 짝이 있다).
 */
export function isUnpaired(ch: string, mode?: GlyphSwapMode): boolean {
  if (!mode) return false;
  return swapStem(ch, mode) === ch && swapBranch(ch, mode) === ch;
}
