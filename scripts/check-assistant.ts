// scripts/check-assistant.ts — '팔자 도우미' 안내 트리 하네스
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-30: 코치를 **콘텐츠 안내 전용**(API 0)으로 전환.
//
// ★왜 하네스가 필수인가: 도우미의 유일한 실패 모드는 **존재하지 않는 콘텐츠로 안내하는 것**이다.
//   assistant.ts 의 items 는 그냥 문자열이라 타입 검사에 안 걸린다 — 콘텐츠 키가 바뀌거나
//   카드가 사라지면 도우미가 죽은 링크를 계속 내민다(에러 없이 조용히).
//   그래서 SECTIONS(단일 출처)와 매번 대조한다.
//
// 지키는 것:
//   A1 실재성   — 모든 items 키가 SECTIONS 의 key 또는 creditKey 로 존재
//   A2 라우트   — 그 항목에 route 가 있고 앱 라우트 파일이 실제로 있다
//   A3 도메인   — daniel 지정 3축(사주·타로·자미두수)이 모두 있고 각 도메인에 주제가 1개 이상
//   A4 매칭     — 대표 문장이 의도한 주제로 걸린다(키워드 표가 비어 있지 않다는 실증)
//   A5 이미지   — 안내 카드가 이미지로 뜬다(daniel IMG_8311 "이미지랑 같이 노출")
//                 ★2026-08-19: 항목 그림이 없으면 **섹션 아이콘**이 대신 들어간다.
//                   카드 그리드는 시안대로 사진을 걷어냈지만, 도우미는 한 장씩 보여 주는 자리라
//                   그림이 없으면 **글자 버튼으로 떨어진다** — 그게 IMG_8311 로 지적받은 그 모양이다.
//                   ⇒ 판정은 '항목 그림 **또는** 그 항목이 속한 섹션 아이콘'이 있는가로 본다.
//   A6 비용     — 도우미 화면이 LLM(Edge interpret)을 호출하지 않는다 ★핵심 요구
//
// 실행: npm run check:assistant
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync } from 'node:fs';
import { ASSIST_DOMAINS, ASSIST_TOPICS, assistItemKeys, matchAssist, topicsOf } from '../app/src/lib/content/assistant';

const ROOT = new URL('..', import.meta.url).pathname;
const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

// SECTIONS 를 **소스에서** 읽는다(require 하면 react-native/이미지 require 가 걸린다).
const secSrc = strip(readFileSync(`${ROOT}app/src/lib/content/contentSections.ts`, 'utf8'));
type Item = { key: string; creditKey?: string; route: string; hasImage: boolean; section?: string };
const items: Item[] = [];
// ⚠️블록 정규식(`{ key: ... }`)을 쓰면 **섹션 헤더가 첫 항목을 삼킨다** —
//   `{ key: 'premium', …, items: [ { key: 'saju', …, route: '/reading' … }` 에서
//   비탐욕 `[^}]*?}` 가 헤더~첫 항목의 닫는 중괄호까지 한 덩어리로 잡아 'saju' 가 사라졌다(오탐 3건).
//   이 파일은 **항목 1개 = 1줄** 형식이라 줄 단위로 읽는 게 정확하다. 형식이 바뀌면 아래 개수 가드가 잡는다.
// 섹션 헤더 줄(`{ key: 'love', icon: 'heart', titleKey: …`)을 만나면 현재 섹션을 갈아 끼운다.
let curSection: string | undefined;
for (const ln of secSrc.split('\n')) {
  const sec = /\{\s*key:\s*'([a-z]+)',[^\n]*titleKey:/.exec(ln)?.[1];
  if (sec) { curSection = sec; continue; }            // 헤더 줄은 항목이 아니다
  const key = /\bkey:\s*'([^']+)'/.exec(ln)?.[1];
  const route = /\broute:\s*'([^']+)'/.exec(ln)?.[1];
  if (!key || !route) continue;                             // 섹션 헤더(route 없음)·주석 줄 제외
  items.push({
    key,
    creditKey: /creditKey:\s*'([^']+)'/.exec(ln)?.[1],
    route,
    // ★2026-08-18: 시안 아이콘은 `image: contentIcon('heart')` 형태다(brandAsset 경유).
    //   `A(` 만 보던 규칙이라 **이미지가 있는데도 '없다'** 고 잡았다 — 참조 방식이 늘면 여기도 늘려야 한다.
    // ★이미지 원격화(2026-08-01) 이후 `image: A('icons/x.jpg')` 형태다 — 옛 `require(` 만 보면
    //   "이미지 없음"으로 전부 오탐한다(실제로 그렇게 깨졌다). **두 형태를 모두 인정**한다.
    //   ⚠️여기서 옛 패턴으로 되돌리지 말 것 — 불변식은 '카드에 이미지가 있다'이지 'require 를 쓴다'가 아니다.
    hasImage: /image:\s*(require\(|A\(|contentIcon\(|freeTrioIcon\(|cardArt\()/.test(ln),
    section: curSection,
  });
}
const byKey = new Map<string, Item>();
for (const it of items) { byKey.set(it.key, it); if (it.creditKey && !byKey.has(it.creditKey)) byKey.set(it.creditKey, it); }

console.log(`\n[준비] SECTIONS 항목 ${items.length}개 · 조회 키 ${byKey.size}개 파싱`);
if (items.length < 30) bad(`SECTIONS 파싱이 너무 적다(${items.length}) — 정규식이 형식 변경에 깨졌을 수 있다(빈 통과 방지)`);

// ── A1 실재성 ────────────────────────────────────────────────────────────
console.log('\n[A1] 안내가 가리키는 콘텐츠가 실재한다');
{
  const missing = assistItemKeys().filter((k) => !byKey.has(k));
  if (!missing.length) ok(`${assistItemKeys().length}개 키 전부 SECTIONS 에 존재`);
  else bad(`SECTIONS 에 없는 키: ${missing.join(', ')} — 도우미가 죽은 링크를 내민다`);
}

// ── A2 라우트 ────────────────────────────────────────────────────────────
console.log('\n[A2] 라우트 파일이 실제로 있다');
{
  let miss = 0;
  for (const k of assistItemKeys()) {
    const it = byKey.get(k); if (!it) continue;             // A1 이 이미 보고했다
    const r = it.route.replace(/^\//, '');
    const cands = [`app/src/app/(app)/${r}.tsx`, `app/src/app/(app)/${r}/index.tsx`, `app/src/app/${r}.tsx`];
    if (!cands.some((p) => existsSync(`${ROOT}${p}`))) { bad(`${k} → ${it.route} 라우트 파일 없음`); miss++; }
  }
  if (!miss) ok('모든 안내 대상의 라우트 파일 존재');
}

// ── A3 도메인 ────────────────────────────────────────────────────────────
console.log('\n[A3] daniel 지정 3축이 모두 있고 비어 있지 않다');
{
  const want = ['saju', 'tarot', 'ziwei'];
  const got = ASSIST_DOMAINS.map((d) => d.key);
  if (want.every((w) => got.includes(w as any)) && got.length === 3) ok('사주 · 타로 · 자미두수');
  else bad(`도메인이 ${got.join(',')} — 사주·타로·자미두수 3축이어야 한다`);
  for (const d of want) {
    const n = topicsOf(d as any).length;
    if (n >= 1) ok(`${d}: 주제 ${n}개`);
    else bad(`${d}: 주제가 0개 — 그 축을 고르면 아무것도 안 나온다`);
  }
}

// ── A4 매칭 ──────────────────────────────────────────────────────────────
console.log('\n[A4] 대표 문장이 의도한 주제로 걸린다');
{
  const cases: Array<[string, string]> = [
    ['연애운 보고 싶어', 'love'],
    ['이직 시기 언제가 좋아', 'work'],       // '이직' 이 먼저(work) — 시기보다 구체적
    ['오늘 기운 어때', 'today'],
    ['타로 한 장 뽑을래', 'tarotDaily'],
    ['자미두수 보고 싶어', 'ziweiChart'],
    ['내 성격이 궁금해', 'self'],
    ['전생이 뭐였을까', 'fun'],
  ];
  let off = 0;
  for (const [q, want] of cases) {
    const m = matchAssist(q);
    const got = m.kind === 'topic' ? m.topic.key : m.kind === 'domain' ? `domain:${m.domain}` : 'none';
    if (got !== want) { bad(`"${q}" → ${got}(기대 ${want})`); off++; }
  }
  if (!off) ok(`${cases.length}개 문장 정합`);
  // 아무 말도 안 걸리면 **지어내지 않고** none 이어야 한다
  if (matchAssist('asdfqwer').kind === 'none') ok('모르는 말 → none(선택지 재제시 · 억지 안내 안 함)');
  else bad('모르는 말에도 안내를 만든다 — 엉뚱한 콘텐츠로 보낸다');
}

// ── A5 이미지 ────────────────────────────────────────────────────────────
console.log('\n[A5] 안내 카드가 이미지로 뜬다(daniel IMG_8311)');
{
  // 섹션 아이콘 표 — `{ key: 'love', icon: 'heart', …` 형태
  const secIcon = new Map<string, string>();
  for (const m of secSrc.matchAll(/\{\s*key:\s*'([a-z]+)',\s*icon:\s*'([a-z]+)'/g)) secIcon.set(m[1], m[2]);
  const noImg = assistItemKeys().filter((k) => {
    const it = byKey.get(k);
    if (!it) return false;
    if (it.hasImage) return false;
    return !(it.section && secIcon.has(it.section));   // 섹션 아이콘이 대신 들어간다
  });
  if (!noImg.length) ok(`모든 안내 대상이 그림 보유(항목 그림 또는 섹션 아이콘 ${secIcon.size}종)`);
  else bad(`그림 없는 안내 대상: ${noImg.join(', ')} — 글자 버튼으로 떨어져 눈에 안 띈다(항목 아이콘을 주거나 그 섹션에 icon 을 달 것)`);
}

// ── A6 비용 ──────────────────────────────────────────────────────────────
console.log('\n[A6] 도우미 화면이 LLM 을 호출하지 않는다 ★핵심 요구(API 0)');
{
  const scr = strip(readFileSync(`${ROOT}app/src/app/(app)/coach.tsx`, 'utf8'));
  const llm = [/askCoach/, /functions\.invoke\(\s*'interpret'/, /showRewardedAd/, /ensureCoinsFor/];
  const hit = llm.filter((re) => re.test(scr));
  if (!hit.length) ok('interpret 호출·광고·코인 차감 0건 — 안내는 전부 온디바이스');
  else bad(`화면에 유료·LLM 경로가 남아 있다: ${hit.map((r) => String(r)).join(' ')}`);
}

console.log(fail ? `\n❌ check:assistant 실패 ${fail}건` : '\n✅ check:assistant 통과 — 실재성·라우트·3축·매칭·이미지·API0 OK');
process.exit(fail ? 1 : 0);
