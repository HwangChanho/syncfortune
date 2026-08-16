/**
 * 오행(五行) 이름표 — **단일 소스**.
 *
 * ★왜 이 파일이 생겼나 (daniel 2026-08-16 *"관계지도나 다른곳에서 쇠라고 쓰는데 금이라고 정정해"*)
 *   같은 표(`{ 木:'나무', 火:'불', 土:'흙', 金:'…', 水:'물' }`)가 **11벌 복붙**돼 있었다.
 *   그래서 한 곳을 고쳐도 나머지 열 곳이 옛말을 계속 뿌렸고, 심지어 계열이 갈려 있었다
 *   — 어떤 화면은 '쇠', 어떤 화면(설정·보석)은 '금'. 같은 앱에서 같은 오행이 다른 이름으로 불린 것이다.
 *   ⇒ 이름표는 여기 **한 벌만** 둔다. 새로 만들지 말고 여기서 가져다 쓴다.
 *   ⇒ 되돌아가지 않게 하네스가 지킨다: `npm run check:elemlabel` ([[duplicate-ui-single-source]])
 *
 * ★'쇠'가 아니라 '금'인 이유 — 오행의 이름은 **목·화·토·금·수**다. '쇠'는 금속 재료를 가리키는 낱말이라
 *   오행 이름 자리에 쓰면 틀린 말이 된다(daniel 판정).
 *
 * ⚠️ **여기서 말하는 '금'은 오행 金 뿐이다.** 아래 '쇠'들은 전혀 다른 낱말이라 바꾸면 안 된다:
 *   · 십이운성 **쇠(衰)** — 기운이 꺾인 단계(`myeongriGlossary`·`dailyFortune`·`LoveFlowGraph`)
 *   · **무쇠**(庚의 물상 — "무쇠 도끼") · **왕쇠**(旺衰) · 자물쇠·열쇠
 */

/** 오행 다섯 글자. */
export type OhaengEl = '木' | '火' | '土' | '金' | '水';
/** 지원 언어. */
export type OhaengLang = 'ko' | 'en' | 'ja';

/**
 * 오행 **일상어** 이름표(다국어).
 *
 * ko 는 한자를 모르는 사람도 읽히게 일상어로 쓴다(daniel 2026-08-14 *"일반인도 알수있는 용어로해"*).
 * ja 는 한자가 그대로 통용되고, en 은 Wood/Fire/… 가 표준 역어다.
 *
 * ★`Record<string, …>` 로 느슨하게 잡은 것은 의도다 — 호출부의 `el` 타입이 파일마다
 *   `Element`·`Elem`·`string` 으로 제각각이라, 좁게 잡으면 열한 곳에서 타입 캐스팅이 필요해진다.
 *   조회 실패는 `elemLabelOf()` 의 폴백이 받는다.
 */
export const ELEM_LABEL: Record<string, Record<string, string>> = {
  木: { ko: '나무', en: 'Wood', ja: '木' },
  火: { ko: '불', en: 'Fire', ja: '火' },
  土: { ko: '흙', en: 'Earth', ja: '土' },
  金: { ko: '금', en: 'Metal', ja: '金' },   // ★'쇠' 아님 — 오행 이름은 '금'
  水: { ko: '물', en: 'Water', ja: '水' },
};

/**
 * 한국어 일상어 이름만 뽑은 표 — 기존 각 파일의 `EL_KO` 자리를 그대로 대체한다.
 * 예: `EL_KO['金']` → `'금'`
 */
export const EL_KO: Record<string, string> = {
  木: ELEM_LABEL.木.ko, 火: ELEM_LABEL.火.ko, 土: ELEM_LABEL.土.ko,
  金: ELEM_LABEL.金.ko, 水: ELEM_LABEL.水.ko,
};

/**
 * 오행 **음독** 한 글자표 — '목·화·토·금·수'.
 * 일상어(나무·불)가 아니라 한자 독음이 필요한 자리에 쓴다(예: 보석 카드의 `土(토)`, 설정 화면).
 */
export const EL_KO_SHORT: Record<string, string> = { 木: '목', 火: '화', 土: '토', 金: '금', 水: '수' };

/**
 * 오행 이름을 그 언어의 말로 옮긴다.
 *
 * @param el    오행 한 글자(`木`·`火`·`土`·`金`·`水`). 그 밖의 값이 오면 입력을 그대로 돌려준다.
 * @param lang  `'ko'`(기본) · `'en'` · `'ja'`. 모르는 언어 코드는 ko 로 떨어진다.
 * @returns     예) `elemLabelOf('金')` → `'금'` · `elemLabelOf('金','en')` → `'Metal'`
 *
 * ⚠️ 화면 노드처럼 **한 글자만 들어가는 자리**에는 ko 가 '나무'(두 글자)라 넘칠 수 있다.
 *    그런 자리는 `EL_KO_SHORT` 를 쓰거나 호출부에서 폭을 확인할 것.
 */
export function elemLabelOf(el: string, lang: OhaengLang = 'ko'): string {
  const row = ELEM_LABEL[el];
  if (!row) return el;               // 오행이 아닌 값 — 그대로 통과시킨다(문장이 깨지지 않게)
  return row[lang] ?? row.ko ?? el;  // 모르는 언어는 ko 로 폴백
}
