// scripts/check-coachroute.ts — 코치 → 콘텐츠 안내 계약 하네스
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-27 "코치가 컨텐츠로 안내하고 이런 건?" 로 만든 라우팅의 계약을 지킨다.
//
// ★왜 필요한가: 이 기능의 최악 실패는 **없는 콘텐츠로 안내하는 것**이다(탭했는데 아무 데도 안 가거나 죽은 화면).
//   콘텐츠 키는 앞으로도 계속 추가·개명되는데, 그때 이 표만 조용히 낡는다. 사람이 기억할 수 없으니 기계가 잡는다.
//
// 지키는 것:
//   C1 실재성 — RULES 의 모든 key 가 contentSections 에 **실재**한다(item.key 또는 creditKey).
//   C2 결정론 — 같은 질문이면 같은 안내(Math.random 혼입 방지).
//   C3 선제 제안 금지 — 질문에 그 말이 없으면 **아무것도 안 뜬다**(§4: 안 꺼낸 민감 주제를 먼저 들추지 않는다).
//   C4 우선순위 — 구체적인 주제가 포괄적인 주제보다 앞에 온다(재회가 '연애'에 먹히면 안 된다).
//   C5 보유 반영 — 이미 본 콘텐츠는 owned=true 로 나와 문구가 '이어서 보기'가 된다.
//   C6 안전 — 의료·투자 단정으로 이어질 트리거 어휘를 쓰지 않는다.
//   C7 중복 없음 — 같은 key 가 두 번 등록되지 않는다(어느 규칙이 이겼는지 알 수 없게 된다).
//
// 실행: npm run check:coachroute
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { pickCoachRoute, routeKeys } from '../app/src/lib/content/coachRoute';

const ROOT = new URL('..', import.meta.url).pathname;
let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

// ── C1 실재성 ────────────────────────────────────────────────────────────
// contentSections 를 런타임 import 하면 RN(require 이미지)에 걸리므로 **소스에서 키를 긁는다**.
console.log('\n[C1] 안내하는 콘텐츠 키가 실재한다');
{
  const src = readFileSync(`${ROOT}app/src/lib/content/contentSections.ts`, 'utf8');
  const keys = new Set<string>();
  for (const m of src.matchAll(/\bkey:\s*'([a-zA-Z_][a-zA-Z0-9_]*)'/g)) keys.add(m[1]);
  for (const m of src.matchAll(/\bcreditKey:\s*'([a-zA-Z_][a-zA-Z0-9_]*)'/g)) keys.add(m[1]);
  if (keys.size < 20) bad(`contentSections 에서 키를 ${keys.size}개밖에 못 읽었다 — 패턴이 바뀌어 하네스가 헛돈다(역검증 실패)`);
  else ok(`contentSections 키 ${keys.size}개 인식`);
  const missing = routeKeys().filter((k) => !keys.has(k));
  if (missing.length) bad(`실재하지 않는 키로 안내함: ${missing.join(', ')} — 탭하면 죽은 링크가 된다`);
  else ok(`안내 키 ${routeKeys().length}개 전부 실재`);
}

// ── C7 중복 ──────────────────────────────────────────────────────────────
console.log('\n[C7] 같은 콘텐츠가 두 번 등록되지 않는다');
{
  const ks = routeKeys();
  const dup = ks.filter((k, i) => ks.indexOf(k) !== i);
  if (dup.length) bad(`중복 키: ${[...new Set(dup)].join(', ')}`);
  else ok(`중복 없음(${ks.length}종)`);
}

// ── C2·C3·C4·C5 동작 ─────────────────────────────────────────────────────
const NONE = new Set<string>();
console.log('\n[C2] 결정론 — 같은 질문이면 같은 안내');
{
  const q = '올해 이직해도 될까요?';
  const a = pickCoachRoute(q, NONE), b = pickCoachRoute(q, NONE);
  if (JSON.stringify(a) !== JSON.stringify(b)) bad('같은 질문에 다른 안내가 나온다');
  else ok('동일 입력 → 동일 출력');
}

console.log('\n[C3] 선제 제안 금지 — 안 꺼낸 주제는 안 뜬다');
{
  const quiet = ['안녕하세요', '오늘 기분이 좀 그래요', '고마워요', '', '   '];
  let hit = 0;
  for (const q of quiet) if (pickCoachRoute(q, NONE)) { bad(`"${q}" 에 안내가 떴다 — 사용자가 안 꺼낸 주제를 먼저 들추면 안 된다`); hit++; }
  if (!hit) ok(`무관한 질문 ${quiet.length}건 전부 안내 없음`);
}

console.log('\n[C4] 우선순위 — 구체적인 주제가 포괄적인 주제를 이긴다');
{
  const cases: Array<[string, string]> = [
    ['헤어진 사람과 다시 만날 수 있을까요', 'reunion'],   // '연애'(love)보다 재회가 먼저
    ['짝사랑하는 사람에게 고백해도 될까요', 'crush'],
    ['이 사람과 궁합이 잘 맞나요', 'compat'],
    ['제 적성에 맞는 일이 뭘까요', 'jobfit'],             // 'career'보다 적성이 먼저
    ['이직 시기가 언제일까요', 'job'],                     // '언제'(timeline)보다 이직이 먼저
    ['돈이 언제쯤 모일까요', 'wealth'],
    // ★아래는 **실제로 어휘가 겹치는** 쌍 — 순서가 뒤집히면 반드시 깨진다.
    //   (역검증 중 발견: 겹치지 않는 케이스만 있으면 순서를 바꿔도 하네스가 통과해 버린다.)
    ['결혼할 사람과 궁합이 맞을까요', 'compat'],        // '결혼'(love) ∩ '궁합'(compat) → compat 우선
    ['연애 시기가 언제쯤일까요', 'love'],                // '연애'(love) ∩ '언제·시기'(timeline) → love 우선
    ['이 사람과 결혼해도 될까요', 'compat'],            // '이 사람과'(compat) ∩ '결혼'(love)
    ['사업 재물이 어떤가요', 'career'],                  // '사업'(career) ∩ '재물'(wealth) → career 우선
  ];
  let miss = 0;
  for (const [q, want] of cases) {
    const got = pickCoachRoute(q, NONE);
    if (got?.key !== want) { bad(`"${q}" → ${got?.key ?? '없음'} (기대 ${want})`); miss++; }
  }
  if (!miss) ok(`${cases.length}건 전부 기대한 콘텐츠로`);
}

console.log('\n[C5] 보유 반영 — 이미 본 콘텐츠는 owned=true');
{
  const q = '재물운이 어떤가요';
  const no = pickCoachRoute(q, NONE);
  const yes = pickCoachRoute(q, new Set(['wealth']));
  if (no?.owned !== false) bad('미보유인데 owned=true');
  else if (yes?.owned !== true) bad('보유인데 owned=false — 안 산 것처럼 안내한다');
  else ok('보유/미보유 구분됨');
}

// ── C6 안전 ──────────────────────────────────────────────────────────────
console.log('\n[C6] 안전 — 의료·투자 단정 유발 어휘를 트리거로 쓰지 않는다');
{
  const src = readFileSync(`${ROOT}app/src/lib/content/coachRoute.ts`, 'utf8');
  const trig = src.slice(src.indexOf('const RULES'), src.indexOf('export function pickCoachRoute'));
  const BANNED = ['암', '질병', '진단', '수술', '약을', '주식', '코인', '비트코인', '로또', '투자처', '종목'];
  let hit = 0;
  for (const w of BANNED) if (new RegExp(`'[^']*${w}[^']*'`).test(trig)) { bad(`트리거에 '${w}' 포함 — §4 의료·투자 경계 위반`); hit++; }
  if (!hit) ok(`금지 어휘 ${BANNED.length}종 미사용`);
}

console.log(fail ? `\n❌ check:coachroute 실패 ${fail}건` : '\n✅ check:coachroute 통과 — 실재성·중복·결정론·선제금지·우선순위·보유반영·안전 OK');
process.exit(fail ? 1 : 0);
