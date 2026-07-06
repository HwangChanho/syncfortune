// app/src/lib/nameReading.ts — 한글 이름 발음오행 풀이. 무료·온디바이스(API 0)·전통 발음오행(통설).
// ─────────────────────────────────────────────────────────────────────────
// 한글 초성의 발음오행(훈민정음 오성): ㄱㅋㄲ=목 / ㄴㄷㄹㅌ=화 / ㅇㅎ=토 / ㅅㅈㅊ=금 / ㅁㅂㅍ=수.
//   이름 글자 초성의 오행 흐름(상생=순·상극=역)으로 결을 본다. ★발음오행은 작명계 통설(이설 존재) — daniel 검수 슬롯.
// §4: 가벼운 콘텐츠 — 흉 단정 없이 전향적(부딪힘도 '개성·추진력'으로).
//
// ── B6(daniel 2026-07-06): 발음오행 기준 = 훈민정음 후음(喉音) ㅇ·ㅎ = 土 (다수설), 순음(脣音) ㅁ·ㅂ·ㅍ = 水 ──
//   성명학은 학파마다 ㅇ·ㅎ의 오행이 갈린다(土설 ↔ 水설). 유저(성명학 관심층)는 이 논쟁을 알기에
//   *어느 기준을 쓰는지 명시*해야 신뢰가 생긴다 → 결과 화면에 기준 한 줄(CRITERION_NOTE)을 노출.
//   ※ 아래 CHO_ELEM 맵은 이미 ㅇ·ㅎ=土 로 올바르게 세팅돼 있음(변경 불필요, 기준 표기만 추가).
// ─────────────────────────────────────────────────────────────────────────
import { appLang } from '../i18n';

type Elem = '木' | '火' | '土' | '金' | '水';
type L = 'ko' | 'en' | 'ja';
const lang = (): L => (appLang() as L) ?? 'ko';

const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const CHO_ELEM: Record<string, Elem> = {
  ㄱ: '木', ㄲ: '木', ㅋ: '木',
  ㄴ: '火', ㄷ: '火', ㄸ: '火', ㄹ: '火', ㅌ: '火',
  ㅇ: '土', ㅎ: '土',
  ㅅ: '金', ㅆ: '金', ㅈ: '金', ㅉ: '金', ㅊ: '金',
  ㅁ: '水', ㅂ: '水', ㅃ: '水', ㅍ: '水',
};
const ELEM_LABEL: Record<Elem, Record<L, string>> = {
  木: { ko: '나무', en: 'Wood', ja: '木' }, 火: { ko: '불', en: 'Fire', ja: '火' }, 土: { ko: '흙', en: 'Earth', ja: '土' },
  金: { ko: '쇠', en: 'Metal', ja: '金' }, 水: { ko: '물', en: 'Water', ja: '水' },
};
const GEN: Record<Elem, Elem> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };

/** 한글 한 글자의 초성 → 오행(완성형 한글만, 그 외 null). */
function elemOfChar(ch: string): Elem | null {
  const c = ch.charCodeAt(0);
  if (c < 0xac00 || c > 0xd7a3) return null;
  const cho = CHO[Math.floor((c - 0xac00) / 588)];
  return CHO_ELEM[cho] ?? null;
}

export type NameElem = { ch: string; elem: Elem; elemLabel: string; hex: string };
// B6(daniel): criterionNote = 발음오행 기준 표기(결과 화면에 한 줄 노출). 학파 논쟁(ㅇㅎ의 土/水) 속 어느 기준인지 밝혀 신뢰 확보.
export type NameResult = { chars: NameElem[]; flow: 'good' | 'mixed' | 'tough'; summary: string; criterionNote: string };

// B6(daniel): 발음오행 기준 = 훈민정음 후음(喉音) ㅇ·ㅎ = 土 (다수설). 3개국어(모듈이 ko/en/ja 지원).
const CRITERION_NOTE: Record<L, string> = {
  ko: '훈민정음 후음(ㅇ·ㅎ=土) 기준',
  en: 'Based on Hunminjeongeum guttural sounds (ㅇ·ㅎ = Earth)',
  ja: '訓民正音の喉音(ㅇ・ㅎ=土)基準',
};

const HEX: Record<Elem, string> = { 木: '#3E8E5A', 火: '#C0392B', 土: '#B8860B', 金: '#C9A14A', 水: '#3A6EA5' };

const SUMMARY: Record<NameResult['flow'], Record<L, string>> = {
  good: {
    ko: '글자들의 기운이 자연스럽게 이어지는, 흐름이 부드러운 이름이에요. 사람들과의 인연과 하는 일이 막힘없이 풀리는 결이 있어요.',
    en: 'The energies of the syllables flow into one another — a smooth name. Relationships and work tend to move without blockage.',
    ja: '文字の気が自然につながる、流れの良い名前です。人との縁や物事が滞りなく運びやすいです。',
  },
  mixed: {
    ko: '여러 기운이 고루 섞인 다채로운 이름이에요. 어떤 상황에도 두루 적응하는 유연함과 균형이 있어요.',
    en: 'A varied name with a mix of energies. It carries flexibility and balance that adapt to any situation.',
    ja: '様々な気がほどよく混ざる多彩な名前です。どんな状況にも適応する柔軟さと均衡があります。',
  },
  tough: {
    ko: '기운이 서로 맞부딪히는 면이 있는 이름이에요. 그만큼 개성과 추진력이 또렷하게 드러나는 결이기도 해요.',
    en: 'A name where energies push against each other — which also makes individuality and drive stand out clearly.',
    ja: '気が互いにぶつかる面のある名前です。その分、個性と推進力がはっきり表れます。',
  },
};

/** 이름(한글) 발음오행 풀이 — 글자별 오행 + 상생/상극 흐름 + 조언. 한글 글자 없으면 null. */
export function analyzeName(name: string): NameResult | null {
  const L = lang();
  const chars: NameElem[] = [];
  for (const ch of name.trim()) {
    const e = elemOfChar(ch);
    if (e) chars.push({ ch, elem: e, elemLabel: ELEM_LABEL[e][L], hex: HEX[e] });
  }
  if (chars.length < 1) return null;

  // 인접 글자 상생/상극 — 상생(順)이 많으면 good, 상극 위주면 tough, 섞이면 mixed
  let gen = 0, ctrl = 0;
  for (let i = 0; i < chars.length - 1; i++) {
    const a = chars[i].elem, b = chars[i + 1].elem;
    if (a === b) continue;                          // 비화(같은 오행)는 중립
    if (GEN[a] === b || GEN[b] === a) gen++;         // 상생(양방향)
    else ctrl++;                                     // 상극
  }
  const flow: NameResult['flow'] = gen > 0 && ctrl === 0 ? 'good' : ctrl > gen ? 'tough' : 'mixed';
  return { chars, flow, summary: SUMMARY[flow][L], criterionNote: CRITERION_NOTE[L] }; // B6: 기준 표기 동봉
}
