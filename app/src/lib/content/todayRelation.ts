// src/lib/content/todayRelation.ts — 오늘의 관계(상대 × 나 × 오늘 일진) · 무료·온디바이스·API 0
// ─────────────────────────────────────────────────────────────────────────
// 리텐션 재기획(daniel 2026-07-20 채택) — 궁합은 **한 번 보고 끝**이라 리텐션이 안 된다.
//   같은 두 사람이라도 **오늘 일진이 각자에게 다르게 작용**하므로, "오늘 이 사람과 어떤 날인가"는 매일 달라진다.
//   → 궁합을 1회성 상품에서 **매일 여는 화면**으로 바꾸는 축.
//
// ★적중 회고(사용자 평가) 방식을 폐기하고 이걸로 옮긴 이유: 사용자 입력에 기대지 않아 **데이터 오염이 없다**.
//   전부 결정론이라 API 0이고, 상대를 등록해 둘수록 앱을 떠나기 어려워진다(이탈 비용).
//
// ★★새 관법을 만들지 않는다 — 아래 판정은 전부 기존 엔진 결과의 **조합**이다:
//   ① detectInteractionsAmong: 오늘 지지 ↔ 각자 일지(日支=자기 자리·배우자궁)의 합/충 — R47 궁합 6기준의 ⑥과 같은 축
//   ② dailyEnergy: 오늘 일진이 각자에게 우호적인가(억부) — 이미 검증된 판정
//   ⚠️문구는 Claude Code 초안 = daniel 검수 슬롯(★). 판정이 아니라 '두 결과의 번역'이다.
// ⚠️§4 안전: 관계를 나쁘게 단정하지 않는다. '조심'도 회피가 아니라 **속도 조절·타이밍**으로 쓴다.
//   (사람 사이를 흉하게 못 박으면 실제 관계에 해가 된다 — 진단엔 반드시 처방을 붙인다.)
// ─────────────────────────────────────────────────────────────────────────
import { detectInteractionsAmong } from '@engine/structure';
import { tenGod } from '@engine/saju'; // 오늘 일진 干 → 각자에게 십신(디테일 확장·새 관법 X·기존 엔진)
import { dailyEnergy } from './dailyFortune';
import type { SajuChart, Stem, Branch } from '@spec/chart';

// ── 오늘 일진이 '이 사람'에게 어떤 결인가(십신 → 일상어) — daniel 07-22 디테일 확장·검수 슬롯 ──
const TG_GROUP: Record<string, string> = { 비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상', 정재: '재성', 편재: '재성', 정관: '관살', 편관: '관살', 정인: '인성', 편인: '인성' };
const TG_GYEOL: Record<string, string> = {
  비겁: '자기 페이스가 서는 날 (고집·경쟁심이 올라와요)',
  식상: '표현·활동이 활발한 날 (말이 많아지고 하고 싶은 게 많아요)',
  재성: '실속·현실을 챙기는 날 (돈·성과에 신경 써요)',
  관살: '책임·긴장이 서는 날 (진지하거나 예민해져요)',
  인성: '쉬고 채우고 싶은 날 (혼자 있거나 배우는 걸 찾아요)',
};
/** 오늘 일진 천간이 이 사람(일간)에게 십신으로 어떤 결인지(일상어). 실패 시 빈 문자열. */
export function todayGyeol(dayStem: Stem, todayStem: Stem): string {
  try { return TG_GYEOL[TG_GROUP[tenGod(dayStem, todayStem)]] ?? ''; } catch { return ''; }
}

export type TodayRelation = {
  tone: 'good' | 'mixed' | 'care';  // 카드 색·아이콘용
  title: string;                    // 한 줄 요약
  body: string;                     // 왜 그런지 + 오늘 쓰는 법(처방)
  tip: string;                      // 오늘 구체적으로 해볼 한 가지(daniel 07-20 '내용 더') — 행동 처방
  signals: string[];                // 근거 칩(합/충 등)
};

/** 두 사람의 일지(日支)와 오늘 지지 사이의 합·충을 본다. 오늘이 각자의 '자기 자리'를 건드리는지. */
function branchLink(mine: Branch, today: Branch): '합' | '충' | null {
  try {
    // 위치 라벨은 판정에 쓰이지 않지만(글자쌍만 봄) 타입상 필요 — 일지 vs 오늘.
    const links = detectInteractionsAmong([
      { pos: '일' as any, stem: '甲' as Stem, branch: mine },
      { pos: '일운' as any, stem: '甲' as Stem, branch: today },
    ]).filter((it) => it.level !== '천간');
    if (links.some((l) => l.type === '합')) return '합';
    if (links.some((l) => l.type === '충' || l.type === '형')) return '충';
    return null;
  } catch { return null; }
}

/**
 * 오늘 이 사람과 어떤 날인지(결정론·API 0).
 * @param me     내 명식
 * @param other  상대 명식
 * @param stem   오늘 일진 천간
 * @param branch 오늘 일진 지지
 */
export function todayRelation(me: SajuChart, other: SajuChart, stem: Stem, branch: Branch): TodayRelation {
  const signals: string[] = [];
  // ① 오늘이 각자의 일지(자기 자리)를 건드리는가
  const myLink = branchLink(me.pillars['일'].branch as Branch, branch);
  const otLink = branchLink(other.pillars['일'].branch as Branch, branch);
  if (myLink === '합') signals.push('내 자리와 어우러지는 날');
  if (myLink === '충') signals.push('내 쪽이 흔들리기 쉬운 날');
  if (otLink === '합') signals.push('상대 자리와 어우러지는 날');
  if (otLink === '충') signals.push('상대 쪽이 흔들리기 쉬운 날');

  // ② 오늘 기운이 각자에게 우호적인가(억부) — 이미 검증된 판정 재사용
  let myFavor = true, otFavor = true;
  try { myFavor = dailyEnergy(me, stem, branch).favorGood; } catch { /* 기본값 유지 */ }
  try { otFavor = dailyEnergy(other, stem, branch).favorGood; } catch { /* 기본값 유지 */ }

  const hapCount = (myLink === '합' ? 1 : 0) + (otLink === '합' ? 1 : 0);
  const chungCount = (myLink === '충' ? 1 : 0) + (otLink === '충' ? 1 : 0);
  const favorCount = (myFavor ? 1 : 0) + (otFavor ? 1 : 0);

  // ── 조합 → 톤·문구(★daniel 검수 슬롯) ─────────────────────────────
  // 우선순위: 충(속도 조절이 먼저 쓸모 있다) > 합 > 억부 우호도.
  if (chungCount === 2) {
    return {
      tone: 'care',
      title: '둘 다 예민할 수 있는 날이에요',
      body: '오늘은 서로 자기 일로 신경이 곤두서기 쉬워요. 중요한 얘기는 하루 미루고, 가벼운 안부만 주고받아도 충분한 날이에요.',
      tip: '오늘은 짧은 안부 한 줄이면 충분해요. 진지한 얘기는 내일로 미뤄 두세요.',
      signals,
    };
  }
  if (chungCount === 1) {
    const who = myLink === '충' ? '내' : '상대';
    return {
      tone: 'care',
      title: `오늘은 ${who} 쪽 컨디션을 먼저 살펴 주세요`,
      body: `한쪽이 흔들리는 날이라 말이 평소보다 날카롭게 들릴 수 있어요. 지적보다 확인("무슨 일 있었어?")으로 시작하면 훨씬 매끄러워요.`,
      tip: '지적 대신 "무슨 일 있었어?" 한마디로 먼저 문을 열어 보세요.',
      signals,
    };
  }
  if (hapCount === 2) {
    return {
      tone: 'good',
      title: '오늘은 말이 잘 통하는 날이에요',
      body: '둘 다 오늘 기운과 어우러지는 날이라, 미뤄 뒀던 이야기를 꺼내기 좋아요. 약속을 잡거나 매듭을 지어야 할 일이 있으면 오늘이 수월해요.',
      tip: '미뤄 뒀던 약속이나 하고 싶던 말을 오늘 꺼내 보세요.',
      signals,
    };
  }
  if (hapCount === 1) {
    return {
      tone: 'good',
      title: '한 사람이 먼저 다가가면 잘 풀리는 날',
      body: '오늘 기운이 한쪽에 더 잘 맞아요. 그쪽에서 먼저 연락하거나 자리를 만들면 자연스럽게 흘러갑니다.',
      tip: '여유 있는 쪽이 먼저 연락하거나 자리를 만들면 술술 풀려요.',
      signals,
    };
  }
  // 합·충이 없는 평범한 날 = 각자 기운(억부)으로 결
  if (favorCount === 2) {
    return { tone: 'good', title: '둘 다 컨디션이 무난한 날', body: '특별한 사건은 없지만 서로 여유가 있는 날이에요. 함께 뭔가 시작하기엔 오히려 이런 날이 좋아요.', tip: '새로운 걸 함께 시작하기 좋은 날 — 가벼운 제안을 건네 보세요.', signals };
  }
  if (favorCount === 0) {
    return { tone: 'mixed', title: '각자 자기 일에 바쁜 날', body: '오늘은 둘 다 자기 몫이 무거운 편이에요. 서로 기대를 조금 낮추고, 각자 할 일을 끝낸 뒤에 보는 편이 편합니다.', tip: '기대를 조금 낮추고, 각자 할 일을 끝낸 저녁에 보는 게 편해요.', signals };
  }
  return { tone: 'mixed', title: '한쪽이 여유로운 날', body: '한 사람은 가볍고 한 사람은 바쁜 날이에요. 여유 있는 쪽이 속도를 맞춰 주면 무리 없이 지나갑니다.', tip: '여유로운 쪽이 상대 속도에 맞춰 주면 무리 없이 지나가요.', signals };
}
