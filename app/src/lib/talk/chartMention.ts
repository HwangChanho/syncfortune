// app/src/lib/talk/chartMention.ts — 대화에서 **다른 사람의 명식을 불러온다** (`@이름`)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"대화할때 선생님들이 명식 목록에도 접근 가능해야해 예를들어 내 명식목록의
//   누구랑 잘 맞는지 물어보기 편하게 채팅창에서 만세력이 등록된 인물이나 추가된 다른 인물을
//   간편하게 골라서 탭해서 @누구 이런식으로 불러올수 있으면 좋겠어"*
//
// ■ 왜 필요했나 — 대화는 **한 사람 것만** 보고 있었다
//   `askLive` 는 대표 명식 하나(`chartId`)와 그 판정(`verdict`)만 보냈다.
//   "○○이랑 잘 맞아요?" 를 물으면 상담가는 **상대의 명식을 모른 채** 답했다 —
//   즉 궁합을 **모델의 일반 지식**으로 지어내고 있었다(해자가 비는 자리다, CLAUDE.md §0).
//
// ■ ★왜 **앱에서** 계산해 보내나 (Edge 에서 안 하고)
//   ①명식은 **온디바이스 저장**이다(ADR-005 · SecureStore/localStorage). 서버에 없는 것이 많다.
//   ②강약·격국·신살은 Edge `_shared` 에 **없다.** 옮기면 canonical ↔ Edge 사본이 또 늘고,
//     그 드리프트가 2026-07-16 사고(앱 水 ↔ 엔진 土)의 원인이었다.
//   ⇒ `buildChartVerdict` 와 **같은 취급**이다: 보안 경계가 아니라 **해석 재료**다.
//     (과금은 서버가 `consultants.coin_cost` 로 정한다 — 여기서 값을 만들지 않는다.)
//   [[dev-llm-via-claude-not-api]] · `chartVerdict.ts` 머리말과 같은 근거.
//
// ■ ⚠️★차트를 **태그로 압축하지 않는다** (CLAUDE.md §1-3 절대 규칙)
//   글자·자리·지장간·충합·통근을 날것으로 싣는다. "재성 강함" 같은 요약만 보내면
//   모델이 그 요약을 근거 삼아 되짚고, 우리 엔진이 준 사실은 사라진다.
//
// ■ ⚠️시각 미상은 **말해 준다**
//   `timeUnknown` 이면 `pillars['시']` 는 엔진이 만든 **유령 子시**다(spec/chart.ts).
//   숨기면 모델이 없는 시주로 궁합을 본다 ⇒ 자리 자체를 빼고 «모른다»를 명시한다.
// ═══════════════════════════════════════════════════════════════════════════
import type { SajuChart, PillarPos } from '@spec/chart';
import { buildChartVerdict } from './chartVerdict';
// ★`@이름` 판정은 **의존성 0 모듈**에 있다 — 하네스가 진짜 함수를 돌릴 수 있게(mentionParse 머리말)
import { MAX_MENTIONS } from './mentionParse';
export { MAX_MENTIONS, parseMentions, type MentionTarget } from './mentionParse';

/** 한 기둥을 **날것으로** 한 줄. 지장간·통근을 지우지 않는다(§1-3). */
function pillarLine(saju: SajuChart, pos: PillarPos): string | null {
  const p = saju.pillars?.[pos];
  if (!p) return null;
  const hidden = (p.hiddenStems ?? []).map((h: any) => h?.stem ?? h).filter(Boolean).join('');
  return `${pos}주 ${p.stem}${p.branch}`
    + ` (천간 ${p.stemTenGod} · 지지본기 ${p.branchMainTenGod}`
    + `${hidden ? ` · 지장간 ${hidden}` : ''}`
    + `${p.isRoot ? ' · 통근' : ''})`;
}

/**
 * 불러온 사람 하나를 **모델이 읽을 재료**로 만든다.
 *
 * @param name     화면에 뜬 이름(= `@` 뒤 글자)
 * @param relation 관계 라벨(본인·친구·배우자 …). 궁합 판단의 맥락이라 같이 싣는다
 * @param saju     이 사람의 원국(앱이 `computeChart` 로 계산한 것 — 만세력 화면과 같은 함수)
 * @returns 여러 줄 문자열. 계산이 비면 빈 문자열(호출부가 안 붙인다)
 */
export function buildMentionBlock(name: string, relation: string, saju: SajuChart): string {
  if (!saju?.pillars || !saju.dayMaster?.stem) return '';
  const unknownTime = saju.timeUnknown === true;
  // ⚠️시각 미상이면 시주를 **싣지 않는다** — 유령 子시를 실재처럼 쓰게 된다
  const positions: PillarPos[] = unknownTime ? ['년', '월', '일'] : ['년', '월', '일', '시'];

  const lines: string[] = [];
  for (const pos of positions) {
    const l = pillarLine(saju, pos);
    if (l) lines.push(`- ${l}`);
  }
  lines.push(`- 일간: ${saju.dayMaster.stem}(${saju.dayMaster.element})`);
  if (unknownTime) lines.push('- ⚠️출생 시각 **미상** — 시주가 없다. 시주가 필요한 판단은 "모른다"고 말해라.');

  // 원국 내 합충형해 — 궁합에서 실제로 쓰는 신호다
  const inter = (saju.interactions ?? [])
    .map((i: any) => `${i.type}(${(i.members ?? []).join('·')})`).filter(Boolean);
  if (inter.length) lines.push(`- 원국 합충: ${inter.slice(0, 12).join(' · ')}`);

  // 현재 대운·세운 — "지금 어떤가"를 물을 때 필요하다
  try {
    const lc: any = saju.currentLuck;
    if (lc?.stem && lc?.branch) lines.push(`- 현재 대운: ${lc.stem}${lc.branch}${lc.startAge != null ? ` (${lc.startAge}세~)` : ''}`);
    const an: any = saju.annual;
    if (an?.stem && an?.branch) lines.push(`- 현재 세운: ${an.stem}${an.branch}`);
  } catch { /* 없으면 안 적는다 */ }

  // 판정 — **같은 함수**를 쓴다(대표 명식과 다른 잣대를 쓰면 궁합이 성립하지 않는다)
  const verdict = buildChartVerdict(saju);

  return [
    `## @${name}${relation ? ` (관계: ${relation})` : ''}`,
    ...lines,
    verdict ? verdict.split('\n').map((l) => (l.startsWith('[판정]') ? l : l)).join('\n') : '',
  ].filter(Boolean).join('\n');
}

/**
 * 여러 명을 한 덩이로.
 *
 * @param people 이름·관계·원국
 * @returns Edge `talk` 의 `mentions` 로 보낼 문자열 배열(사람당 하나)
 */
export function buildMentionBlocks(
  people: { name: string; relation: string; saju: SajuChart }[],
): string[] {
  return people
    .slice(0, MAX_MENTIONS)
    .map((p) => buildMentionBlock(p.name, p.relation, p.saju))
    .filter((s) => s.length > 0);
}
