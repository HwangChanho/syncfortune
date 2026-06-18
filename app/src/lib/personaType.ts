// app/src/lib/personaType.ts — 사주 성격유형 64종(6축) 판정. 무료·온디바이스·표준 명리(Claude stance, daniel 검수 슬롯).
// ─────────────────────────────────────────────────────────────────────────
// 6축(각 2값) → 2⁶ = 64유형(daniel 2026-06: 16→64 세분). MBTI류 바이럴 카드(규칙5: 무료=온디바이스, API 0).
//   ① 음양(陽/陰) = 일간 천간 음양 — 드러냄 vs 안으로
//   ② 강약(强/弱) = 신강약(scoreStrength) — 주도 vs 조화
//   ③ 한난(暖/寒) = 월지 계절(조후) — 온정·활발 vs 냉철·집중
//   ④ 동정(動/靜) = 식상·재(발산) vs 비겁·인·관(수렴) — 도전 vs 내실
//   ⑤ 규범(規/由) = 관성 vs 식상 우세 — 책임·질서 vs 자유·유연
//   ⑥ 수완(實/知) = 재성 vs 인성 우세 — 실리·현실 vs 배움·이상
// 별명 8종 = 핵심 3축(음양·강약·동정), 나머지 3축(한난·규범·수완)은 6축 막대 + 조합 설명으로 64 변별.
// ⚠️ stance=표준 명리(통설). 유형명·설명은 Claude 초안 — daniel 명리 검수 슬롯(§3.3). §4: 강점 중심·전향적.
// ─────────────────────────────────────────────────────────────────────────
import { stemElement, branchElement } from './ohaeng';
import { appLang } from './i18n';

type Elem = '木' | '火' | '土' | '金' | '水';
// 오행 상생(A생B)·상극(A극B) — 십신군 환산용
const GEN: Record<Elem, Elem> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CTRL: Record<Elem, Elem> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const YANG_STEMS = new Set(['甲', '丙', '戊', '庚', '壬']);        // 양간 5
const WARM_BRANCHES = new Set(['寅', '卯', '辰', '巳', '午', '未']); // 봄·여름(暖)

type TgGroup = '비겁' | '식상' | '재' | '관' | '인';
// 일간 오행 기준 타 오행 → 십신군
function tenGodGroup(dayElem: Elem, other: Elem): TgGroup {
  if (other === dayElem) return '비겁';      // 동일 = 비겁
  if (GEN[dayElem] === other) return '식상';  // 내가 생 = 식상
  if (CTRL[dayElem] === other) return '재';   // 내가 극 = 재
  if (CTRL[other] === dayElem) return '관';   // 나를 극 = 관
  return '인';                                 // 나를 생 = 인
}

export type PersonaAxes = { ym: '陽' | '陰'; gw: '强' | '弱'; hn: '暖' | '寒'; dj: '動' | '靜'; gx: '規' | '由'; su: '實' | '知' };
export type PersonaResult = { code: string; axes: PersonaAxes; name: string; emoji: string; desc: string };

type Pillar = { stem: string; branch: string } | undefined;

/**
 * 성격유형 64종 판정 — 대표 명식의 일간·월지·강약·십신분포로 6축 결정.
 */
export function classifyPersona(input: {
  dayStem: string;
  monthBranch: string;
  strengthVerdict: '신강' | '중화' | '신약';
  strengthScore: number;
  pillars: Record<string, Pillar>;
}): PersonaResult {
  const { dayStem, monthBranch, strengthVerdict, strengthScore, pillars } = input;

  // ① 음양
  const ym: '陽' | '陰' = YANG_STEMS.has(dayStem) ? '陽' : '陰';
  // ② 강약 (중화는 점수 부호)
  const gw: '强' | '弱' =
    strengthVerdict === '신강' ? '强' : strengthVerdict === '신약' ? '弱' : strengthScore >= 0 ? '强' : '弱';
  // ③ 한난
  const hn: '暖' | '寒' = WARM_BRANCHES.has(monthBranch) ? '暖' : '寒';

  // 십신군 집계 — 일간(일주 천간) 제외 7글자(년월시 천간 + 4지지)
  const dayElem = stemElement(dayStem) as Elem;
  const cnt: Record<TgGroup, number> = { 비겁: 0, 식상: 0, 재: 0, 관: 0, 인: 0 };
  const tally = (e: Elem) => { cnt[tenGodGroup(dayElem, e)]++; };
  (['년', '월', '일', '시'] as const).forEach((p) => {
    const d = pillars[p];
    if (!d) return;
    if (p !== '일') tally(stemElement(d.stem) as Elem); // 일간 천간은 자기 자신 → 제외
    tally(branchElement(d.branch) as Elem);
  });

  // ④ 동정 — 식상+재(발산) vs 비겁+인+관(수렴)
  const dj: '動' | '靜' = (cnt.식상 + cnt.재) > (cnt.비겁 + cnt.인 + cnt.관) ? '動' : '靜';
  // ⑤ 규범 — 관성 ≥ 식상 = 규범·질서 / else 자유
  const gx: '規' | '由' = cnt.관 >= cnt.식상 ? '規' : '由';
  // ⑥ 수완 — 재성 ≥ 인성 = 실리·현실 / else 배움·이상
  const su: '實' | '知' = cnt.재 >= cnt.인 ? '實' : '知';

  const code = `${ym}${gw}${hn}${dj}${gx}${su}`;
  const core = CORE_NAMES[`${ym}${gw}${dj}`] ?? { name: '균형형', emoji: '☯️' };
  const L = appLang();
  // 설명 = 6축 값별 한 문장 합성(64가지 조합 → 개인 맞춤)
  const desc = (['ym', 'gw', 'hn', 'dj', 'gx', 'su'] as const)
    .map((k) => AXIS_DESC[k][(axesObj({ ym, gw, hn, dj, gx, su }))[k]][L])
    .join(' ');
  return { code, axes: { ym, gw, hn, dj, gx, su }, name: core.name, emoji: core.emoji, desc };
}

const axesObj = (a: PersonaAxes) => a as Record<string, string>;

// 핵심 별명(음양·강약·동정 = 2³ → 8종). 한난·규범·수완은 막대·설명으로 변별.
const CORE_NAMES: Record<string, { name: string; emoji: string }> = {
  陽强動: { name: '불꽃 리더', emoji: '🔥' },
  陽强靜: { name: '든든한 대장', emoji: '🦁' },
  陽弱動: { name: '따뜻한 나눔이', emoji: '🌸' },
  陽弱靜: { name: '햇살 조율가', emoji: '🌤️' },
  陰强動: { name: '예리한 기획자', emoji: '🎯' },
  陰强靜: { name: '우아한 전략가', emoji: '🌹' },
  陰弱動: { name: '영민한 여우', emoji: '🦊' },
  陰弱靜: { name: '고요한 달빛', emoji: '🌙' },
};

// 6축 막대(공유 카드) — 좌/우 라벨 + 값
export const AXIS_INFO: { key: keyof PersonaAxes; left: string; right: string; leftVal: string; rightVal: string }[] = [
  { key: 'ym', left: '드러냄', right: '안으로', leftVal: '陽', rightVal: '陰' },
  { key: 'gw', left: '주도', right: '조화', leftVal: '强', rightVal: '弱' },
  { key: 'hn', left: '온정·활발', right: '냉철·집중', leftVal: '暖', rightVal: '寒' },
  { key: 'dj', left: '도전·발산', right: '내실·안정', leftVal: '動', rightVal: '靜' },
  { key: 'gx', left: '규범·책임', right: '자유·유연', leftVal: '規', rightVal: '由' },
  { key: 'su', left: '실리·현실', right: '배움·이상', leftVal: '實', rightVal: '知' },
];

// 축별 값 설명(ko/en/ja) — 6문장 합성으로 64유형 개인 설명 생성. ★Claude stance, daniel 검수 슬롯.
type Lang = 'ko' | 'en' | 'ja';
const AXIS_DESC: Record<keyof PersonaAxes, Record<string, Record<Lang, string>>> = {
  ym: {
    陽: { ko: '감정과 생각을 밖으로 솔직하게 드러내요.', en: 'You express thoughts and feelings openly.', ja: '感情や考えを素直に表に出します。' },
    陰: { ko: '속으로 깊이 헤아리고 차분히 표현해요.', en: 'You reflect inwardly and express calmly.', ja: '内に深く考え、静かに表現します。' },
  },
  gw: {
    强: { ko: '자기 주관이 뚜렷하고 스스로 밀어붙이는 힘이 강해요.', en: 'You have strong conviction and drive things yourself.', ja: '主観がはっきりし、自ら推し進める力が強いです。' },
    弱: { ko: '주변과 조화를 이루며 유연하게 맞춰가요.', en: 'You harmonize with others and adapt flexibly.', ja: '周囲と調和し、柔軟に合わせていきます。' },
  },
  hn: {
    暖: { ko: '따뜻하고 활발해 분위기를 데우는 사람이에요.', en: 'Warm and lively, you brighten the mood.', ja: '温かく活発で、場を温める人です。' },
    寒: { ko: '냉철하고 침착해 판단이 잘 흔들리지 않아요.', en: 'Cool-headed and composed, your judgment stays steady.', ja: '冷静沈着で、判断がぶれにくいです。' },
  },
  dj: {
    動: { ko: '새로운 일을 먼저 벌이고 도전하는 추진형이에요.', en: 'You initiate and take on challenges first.', ja: '新しい事を先に始め、挑戦する推進型です。' },
    靜: { ko: '안정 속에서 내실을 다지는 신중형이에요.', en: 'You build substance steadily, the prudent type.', ja: '安定の中で内実を固める慎重型です。' },
  },
  gx: {
    規: { ko: '책임감이 있고 원칙과 질서를 중요하게 여겨요.', en: 'Responsible, you value principle and order.', ja: '責任感があり、原則と秩序を大切にします。' },
    由: { ko: '틀에 매이지 않고 자유롭게 풀어가요.', en: 'Unbound by rules, you go your own way freely.', ja: '枠にとらわれず、自由に進めます。' },
  },
  su: {
    實: { ko: '현실 감각이 좋고 실리를 야무지게 챙겨요.', en: 'Practical, you secure real results well.', ja: '現実感覚が良く、実利をしっかり取ります。' },
    知: { ko: '배움과 의미를 좇는 이상가 기질이 있어요.', en: 'You chase learning and meaning, an idealist streak.', ja: '学びと意味を追う理想家の気質があります。' },
  },
};
