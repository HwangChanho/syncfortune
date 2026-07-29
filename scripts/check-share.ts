// scripts/check-share.ts — 공유 링크가 실제로 열리는 형태인가
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-29 "검증부터해" → 공유 링크가 **통째로 깨져 있었다**(에러 없이).
//
// ★근본: Supabase 는 Edge·Storage 어디서도 HTML 을 렌더링시키지 않는다
//   (`content-type: text/plain` + `CSP sandbox` 강제) →
//   ①`?p=` 성격유형 = HTML 이 **글자로** 보임  ②`?id=` 앱게이트 = JS 리다이렉트 **미실행**.
//   ⇒ 공유 페이지는 **GitHub Pages 정적**으로 서빙한다.
//
// ★그리고 미리보기(카톡·메신저)는 **크롤러가 OG 태그를 읽어** 만든다. 크롤러는 JS 를 실행하지 않으므로
//   유형별 그림·이름이 뜨려면 유형마다 **정적 HTML + 정적 OG** 가 있어야 한다.
//
// 지키는 것: ①앱이 Pages 링크를 만든다 ②240종이 생성돼 있다 ③OG 3종이 정적으로 박혀 있다
//   ④로마자 표가 서버와 일치한다(파일명이 어긋나면 404)
//
// 실행: npm run check:share
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => readFileSync(`${ROOT}${p}`, 'utf8');
const strip = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

console.log('\n🔎 공유 링크\n');

const shareTs = strip(read('app/src/lib/ui/share.ts'));

// ── ① 앱이 Pages 링크를 만드는가 ────────────────────────────────────────
if (/PAGES_BASE\}\/s\/p\//.test(shareTs)) ok('① 성격유형 공유 → Pages 정적 페이지');
else bad('① 성격유형 공유가 아직 Edge(share?p=) 로 간다 — 브라우저에서 HTML 이 글자로 보인다');
if (/PAGES_BASE\}\/s\/\?id=/.test(shareTs)) ok('① 앱게이트 공유 → Pages stub');
else bad('① 앱게이트 공유가 아직 Edge(share?id=) 로 간다 — JS 리다이렉트가 실행되지 않아 스토어로도 못 간다');

// ── ② 정적 페이지가 생성돼 있는가 ───────────────────────────────────────
{
  const dir = `${ROOT}docs/s/p`;
  if (!existsSync(dir)) bad('② docs/s/p 가 없다 — node scripts/build-share-pages.mjs 를 돌려야 한다');
  else {
    const files = readdirSync(dir).filter((f) => f.endsWith('.html'));
    if (files.length === 240) ok(`② 정적 페이지 ${files.length}종(유형 120 × 성별 2)`);
    else bad(`② 정적 페이지가 ${files.length}종 — 240 이어야 한다(생성 누락 시 그 유형은 404)`);
  }
  if (existsSync(`${ROOT}docs/s/index.html`)) ok('② 앱게이트 stub 존재');
  else bad('② docs/s/index.html(앱게이트 stub)이 없다');
}

// ── ③ OG 태그가 **정적으로** 박혀 있는가(크롤러는 JS 를 실행하지 않는다) ──
{
  const sample = 'docs/s/p/sin-chuk-m.html';
  try {
    const h = read(sample);
    const need = ['og:title', 'og:description', 'og:image'];
    const miss = need.filter((k) => !h.includes(k));
    if (!miss.length) ok('③ OG 3종이 정적으로 포함(미리보기에 그림·유형명이 뜬다)');
    else bad(`③ OG 누락: ${miss.join(', ')} — 미리보기가 비어 보인다`);
    if (/<script/.test(h)) bad('③ 공유 페이지에 script 가 있다 — 크롤러가 못 읽는 내용이 생길 수 있다');
    else ok('③ script 없음(순수 정적)');
  } catch { bad(`③ 샘플(${sample})을 읽지 못했다`); }
}

// ── ④ 로마자 표가 서버와 일치하는가(어긋나면 파일명이 안 맞아 404) ───────
{
  const server = read('supabase/functions/_shared/personaShare.ts');
  const pick = (src: string, name: string) => {
    const body = src.match(new RegExp(`${name}[^=]*=\\s*\\{([^}]+)\\}`))?.[1] ?? '';
    return [...body.matchAll(/'([^']+)':\s*'([^']+)'/g)].map((m) => `${m[1]}=${m[2]}`).sort().join(',');
  };
  let same = true;
  for (const n of ['GAN_ROMA', 'JI_ROMA']) {
    const a = pick(server, n), b = pick(shareTs, n);
    if (!a || !b) { bad(`④ ${n} 를 한쪽에서 읽지 못했다`); same = false; }
    else if (a !== b) { bad(`④ ${n} 가 앱↔서버 불일치 — 공유 파일명이 어긋나 404 가 난다`); same = false; }
  }
  if (same) ok('④ 로마자 표 앱↔서버 일치');
}

console.log(fail ? `\n❌ check:share 실패 ${fail}건` : '\n✅ check:share 통과');
process.exit(fail ? 1 : 0);
