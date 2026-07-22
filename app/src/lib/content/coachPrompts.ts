// app/src/lib/content/coachPrompts.ts — AI 자기이해 코치 추천 질문(프리셋) · 온디바이스 정적 · API 0
// ─────────────────────────────────────────────────────────────────────────
// 2026-07-22. 코치 대화 시작 문턱↓ = "무엇을 물어야 할지 모르는" 첫 화면 문제를 푼다.
//   기존: 평평한 4개 고정 질문(i18n coach.q1~q4). → 주제별로 묶은 프리셋 뱅크로 확장해
//   ①코치가 답해 주는 '범위'(자기이해·관계·일·시기)를 한눈에 보여주고 ②탭 한 번으로 전송.
//
// ★전부 온디바이스 정적 텍스트(LLM 0) — 탭하면 그 문장을 그대로 send() 로 보낼 뿐,
//   질문 자체를 여기서 생성/개인화하지 않는다(개발 중 API 호출 절대 금지 준수).
// ★범위 정합: 모든 질문은 COACH_SYSTEM(prompts.ts) '범위 판정'이 답하는 것 = *본인 삶*에 한정한다
//   (자기이해·성격·강점/약점·관계·연애·일·적성·지금과 앞으로의 시기 흐름). 남 캐기·투자 단정·잡담은 넣지 않는다.
// ⚠️문구 = Claude Code 초안 = ★daniel 검수 슬롯(질문 어휘·톤). 명리 stance 아님(사용자가 던지는 질문일 뿐).
// ─────────────────────────────────────────────────────────────────────────
import { appLang } from '../i18n';

type L = 'ko' | 'en' | 'ja';

/** 추천 질문 카테고리 — 코치가 답하는 '범위'를 사용자에게 보여주는 축. */
export type CoachPromptCat = 'self' | 'love' | 'work' | 'timing';

/** 카테고리 라벨(다국어). */
const CAT_LABEL: Record<CoachPromptCat, Record<L, string>> = {
  self: { ko: '자기이해', en: 'About me', ja: '自分' },
  love: { ko: '관계·연애', en: 'Relationships', ja: '関係·恋愛' },
  work: { ko: '일·적성', en: 'Work & fit', ja: '仕事·適性' },
  timing: { ko: '시기·흐름', en: 'Timing', ja: '時期·流れ' },
};

/** 카테고리별 추천 질문(다국어). 각 3~4개 — 너무 많으면 첫 화면이 길어져 4개 이내로. */
const PROMPTS: Record<CoachPromptCat, Record<L, string[]>> = {
  // 자기이해 — 기존 coach.q1~q4 의 결을 잇되 강점/약점/시선차로 확장.
  self: {
    ko: ['나는 어떤 사람인가요?', '내 타고난 강점은 뭔가요?', '내가 자주 놓치는 약점은 뭘까요?', '남들이 보는 나와 진짜 나는 어떻게 다를까요?'],
    en: ['What kind of person am I?', 'What are my natural strengths?', 'What weak spot do I often miss?', 'How does the me others see differ from the real me?'],
    ja: ['私はどんな人ですか？', '私の生まれ持った強みは？', '私が見落としがちな弱みは？', '人から見た私と本当の私はどう違う？'],
  },
  // 관계·연애 — '반복되는 관계'(기존 q2) + 궁합 결·연애 습관.
  love: {
    ko: ['왜 제 관계는 비슷하게 반복될까요?', '저는 어떤 사람과 잘 맞을까요?', '연애할 때 제가 조심할 점은 뭔가요?', '가까운 사람과 더 잘 지내려면요?'],
    en: ['Why do my relationships keep repeating?', 'What kind of person suits me?', 'What should I watch for in love?', 'How can I get along better with those close to me?'],
    ja: ['なぜ私の関係は似たように繰り返す？', '私はどんな人と合う？', '恋愛で気をつける点は？', '身近な人ともっとうまく付き合うには？'],
  },
  // 일·적성 — 강점 활용(기존 q3) + 적성 결·환경.
  work: {
    ko: ['제 강점을 어떻게 살리면 좋을까요?', '저에게 맞는 일의 결은 어떤 건가요?', '저는 어떤 환경에서 빛날까요?', '지금 하는 일이 저와 잘 맞을까요?'],
    en: ['How can I make the most of my strengths?', 'What kind of work fits me?', 'In what environment do I shine?', 'Does my current work suit me?'],
    ja: ['私の強みをどう活かせばいい？', '私に合う仕事の質は？', '私はどんな環境で輝く？', '今の仕事は私に合っている？'],
  },
  // 시기·흐름 — '요즘 흐름'(기존 q4) + 올해 초점·나아갈 때/다질 때. (COACH_SYSTEM #2: 경향·흐름으로 답함)
  timing: {
    ko: ['요즘 제 흐름은 어떤가요?', '올해 제가 집중하면 좋은 건 뭔가요?', '지금은 나아갈 때인가요, 다질 때인가요?', '앞으로 어떤 변화가 기다리고 있을까요?'],
    en: ["How's my current flow?", 'What should I focus on this year?', 'Is now a time to push forward or to build?', 'What changes lie ahead for me?'],
    ja: ['最近の私の流れは？', '今年は何に集中すると良い？', '今は進む時？それとも固める時？', 'これからどんな変化が待っている？'],
  },
};

/** 카테고리 순서(화면 노출 순) — 자기이해 먼저(가장 보편적 진입). */
export const COACH_PROMPT_CATS: CoachPromptCat[] = ['self', 'love', 'work', 'timing'];

/**
 * 코치 추천 질문 그룹 — 현재 앱 언어로 해석해 반환(카테고리 라벨 + 질문 목록).
 * @returns [{ key, label, questions }] — coach.tsx 가 카테고리 칩 + 질문 칩으로 렌더.
 */
export function coachSuggestionGroups(): { key: CoachPromptCat; label: string; questions: string[] }[] {
  const L = (appLang() as L) ?? 'ko';
  return COACH_PROMPT_CATS.map((key) => ({
    key,
    label: CAT_LABEL[key][L] ?? CAT_LABEL[key].ko,
    questions: PROMPTS[key][L] ?? PROMPTS[key].ko,
  }));
}
