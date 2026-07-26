// scripts/check-prose.ts — 풀이 본문 가독성 후처리 하네스(가시성 P0)
// ─────────────────────────────────────────────────────────────────────────
// 왜 하네스인가([[error-harness-prebuild-check]]): 문단화·강조는 **정규식**이라 조용히 틀리기 쉽다
//   (원문 글자 유실·무한루프·과밀 강조). 눈으로 보는 QA로는 재발을 못 막으므로 불변식을 기계로 고정한다.
//
// 불변식 4가지:
//   INV1 무손실 — 강조 세그먼트를 이어 붙이면 원문과 **완전히 동일**해야 한다(글자 하나도 잃지 않음).
//   INV2 문단 무손실 — 문단을 합치면 공백 차이 외에 원문과 같아야 하고, 문장 중간에서 끊기지 않아야 한다.
//   INV3 과밀 금지 — 같은 표현이 두 번 이상 강조되지 않는다(첫 등장만).
//   INV4 강조 적정 — 강조된 글자 수가 본문의 25%를 넘지 않는다(온 화면 볼드 방지).
//
// 실행: npx tsx scripts/check-prose.ts   (결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
import { toParagraphs, emphasize } from '../app/src/lib/ui/readingEmphasis';

// 실제 저장된 통변 본문(2026-07-26 DB 실측 샘플 — 줄바꿈 0·통짜라는 특성을 그대로 반영).
const SAMPLES: { name: string; text: string }[] = [
  {
    name: '직장운/base(실측·460자급)',
    text: "이 사람의 타고난 직장 결은 '규칙과 책임감이 강한 사람'이다. 직장 내 규율·역할·평가를 중시하는 기운이 두 곳에서 동시에 투출돼 있어, 맡은 자리에 대한 책임감이 남다르고 조직의 기대를 받는 편이다. 문제는 그 기운과 정반대 방향의 에너지도 강하다는 점이다. '내 방식대로 해야겠다'는 기운이 년간과 월지 두 곳에 걸쳐 강하게 깔려 있고, 이 두 기운이 서로를 밀어낸다. 회의에서 윗사람의 지시가 자신의 판단과 다를 때, 말은 참아도 표정이나 태도에서 불편함이 새어 나오는 식이다. 오래 누르다 보면 어느 순간 한 번에 터지기도 한다. 상사가 두 명인 구조(정관이 두 곳에 투출)도 독특하다. 지시 계통이 하나가 아니라 두 방향에서 오는 환경에 자주 놓이고, 그 사이에서 조율해야 하는 역할을 맡게 된다. 이것이 스트레스이기도 하지만, 반대로 여러 방향의 기대를 동시에 소화하는 능력이 길러지는 구조이기도 하다.",
  },
  {
    name: '재물/timing(실측·시기 표현 다수)',
    text: '재물의 창고가 열리는 구간은 두 번이다. 첫 번째는 7세부터 시작해 대략 36세까지 이어지는 구간으로, 재물 환경이 본격적으로 열리고 돈이 드나드는 무대가 갖춰지는 시기다. 두 번째는 37세부터 66세까지로, 다시 한 번 창고가 열리며 이 구간이 인생에서 가장 실질적인 재물 축적의 기회 구간이다. 67세 이후에도 좋은 흐름이 오지만 에너지 소모가 함께 따라오므로, 40~60대에 쌓인 것을 잘 지키는 것이 후반을 결정한다.',
  },
  {
    name: '시기·명리어 혼합(강조 경계 검증)',
    text: '올 가을 9~10월 무렵부터 흐름이 열린다. 2026년 9월에는 정인이 힘을 받고, 이번 대운 후반에 재성이 다시 살아난다. 내년 봄 즈음 용신이 뚜렷해지니 9월 이후를 노려라. 정인은 다시 언급해도 강조되지 않아야 한다.',
  },
  { name: '짧은 한 문장', text: '평생 기본 결이 안정적이다.' },
  { name: '빈 문자열', text: '' },
];

let fail = 0;
const bad = (msg: string) => { console.error(`  ✗ ${msg}`); fail++; };

for (const { name, text } of SAMPLES) {
  console.log(`\n▸ ${name}`);
  const paras = toParagraphs(text);

  // INV2 — 문단 합치기 = 원문(공백 정규화 후 동일)
  const joined = paras.join(' ').replace(/\s+/g, ' ').trim();
  const norm = text.replace(/\s+/g, ' ').trim();
  if (joined !== norm) bad(`INV2 문단 무손실 위반: 재조립이 원문과 다름\n    원문: ${norm.slice(0, 80)}…\n    조립: ${joined.slice(0, 80)}…`);

  // 문장 중간 절단 검사 — 마지막 문단 외 모든 문단은 종결부호로 끝나야 한다
  paras.slice(0, -1).forEach((p, i) => {
    if (!/[.!?…]$/.test(p.trim())) bad(`INV2 문단 ${i + 1}이 문장 중간에서 끊김: "…${p.slice(-25)}"`);
  });

  // 강조
  const seen = new Set<string>();
  const segsPerPara = paras.map((p) => emphasize(p, seen));

  // INV1 — 세그먼트 재조립 = 문단 원문
  segsPerPara.forEach((segs, i) => {
    const rebuilt = segs.map((s) => s.t).join('');
    if (rebuilt !== paras[i]) bad(`INV1 무손실 위반(문단 ${i + 1}): 세그먼트 재조립 불일치`);
  });

  // INV3 — 같은 표현 중복 강조 없음
  const emphasized = segsPerPara.flat().filter((s) => s.em).map((s) => s.t);
  const dupes = emphasized.filter((v, i) => emphasized.indexOf(v) !== i);
  if (dupes.length) bad(`INV3 과밀: 같은 표현 중복 강조 ${JSON.stringify([...new Set(dupes)])}`);

  // INV4 — 강조 비율 25% 이하
  const emChars = emphasized.join('').length;
  const ratio = text.length ? emChars / text.length : 0;
  if (ratio > 0.25) bad(`INV4 강조 과다: ${(ratio * 100).toFixed(1)}% (> 25%)`);

  console.log(`  문단 ${paras.length}개 · 문단길이 [${paras.map((p) => p.length).join(', ')}] · 강조 ${emphasized.length}개 ${JSON.stringify(emphasized)} (${(ratio * 100).toFixed(1)}%)`);
}

// ── INV5 용어 커버리지(가독성 P2) ────────────────────────────────────────────
// 풀이 본문에서 강조되는 **명리 용어는 전부 탭하면 뜻이 나와야** 한다.
//   강조만 되고 설명이 없으면 "굵게 칠해놓고 무슨 말인지 안 알려주는" 상태라 P2 목적(용어 장벽 제거)에 역행한다.
//   TERM_WORDS 에 새 용어를 추가하고 사전을 빠뜨리면 여기서 잡힌다.
// ※ 사전 파일은 순수 데이터라 RN 의존이 없어 정규식 파싱 없이 그대로 읽어 대조한다.
{
  console.log('\n▸ 용어 커버리지(P2) — 강조 용어 ↔ 글로서리');
  const fs = await import('node:fs');
  const emSrc = fs.readFileSync('app/src/lib/ui/readingEmphasis.ts', 'utf8');
  const m = emSrc.match(/const TERM_WORDS: string\[\] = \[([\s\S]*?)\];/);
  const terms = m ? (m[1].match(/'([^']+)'/g) ?? []).map((s) => s.replace(/'/g, '')) : [];
  const gSrc = fs.readFileSync('app/src/lib/content/myeongriGlossary.ts', 'utf8');
  const keys = new Set<string>();
  for (const b of gSrc.matchAll(/export const \w+_GLOSSARY[^=]*=\s*\{([\s\S]*?)\n\};/g)) {
    for (const k of b[1].matchAll(/^\s{2}([가-힣A-Za-z]+):\s*\{/gm)) keys.add(k[1]);
  }
  if (!terms.length) bad('INV5 TERM_WORDS 파싱 실패 — 하네스가 무력화됨');
  const missing = terms.filter((t) => !keys.has(t));
  if (missing.length) bad(`INV5 강조되는데 설명이 없는 용어 ${missing.length}개: ${missing.join(', ')} — myeongriGlossary 에 추가 필요`);
  else console.log(`  강조 용어 ${terms.length}개 전부 글로서리에 존재 ✓`);
}

console.log(fail ? `\n❌ check:prose 실패 ${fail}건` : '\n✅ check:prose 통과 — 무손실·문장경계·과밀·용어커버리지 OK');
process.exit(fail ? 1 : 0);
