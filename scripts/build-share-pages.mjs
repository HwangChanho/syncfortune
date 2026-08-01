// scripts/build-share-pages.mjs — 성격유형 공유 페이지 정적 생성(GitHub Pages)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-29 "검증부터해" → 실측 결과 **공유 링크가 통째로 깨져 있었다.**
//
// ★근본 원인: Supabase 는 Edge Functions·Storage 어디서도 HTML 을 렌더링시키지 않는다
//   (`content-type: text/plain` + `CSP: default-src 'none'; sandbox` 강제 · 2026-07-29 실측).
//   → ①`?p=` 성격유형 공유 = HTML 소스가 **글자로** 보인다  ②`?id=` 앱 게이트 = JS 리다이렉트가
//     **실행조차 안 돼** 스토어로도 못 간다. 둘 다 에러가 없어 여태 몰랐다.
//
// ★왜 정적 생성인가: 카톡·메신저 미리보기는 **크롤러가 OG 태그를 읽어** 만든다.
//   크롤러는 JS 를 실행하지 않으므로, JS 로 그리는 페이지는 미리보기가 **비어 있다**.
//   유형마다 다른 그림·제목이 뜨려면 유형별 **정적 HTML**이 있어야 한다(일간10 × 월지12 × 성별2 = 240).
//
// ★단일 출처: 문구·이미지·CSS 를 여기 다시 쓰지 않는다 — `_shared/personaShare.ts`(표)와
//   `functions/share/index.ts`(CSS·템플릿)에서 **읽어서** 만든다. 한쪽만 고쳐지는 드리프트를 막는다.
//
// 실행: node scripts/build-share-pages.mjs   (docs/s/p/*.html 생성)
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const shareSrc = read('supabase/functions/share/index.ts');
const personaSrc = read('supabase/functions/_shared/personaShare.ts');

// ── 단일 출처에서 읽기 ────────────────────────────────────────────────────
const CSS = shareSrc.match(/const CSS = `([\s\S]*?)`;/)?.[1];
if (!CSS) throw new Error('share/index.ts 에서 CSS 를 읽지 못했습니다 — 템플릿 구조가 바뀌었는지 확인하세요.');

const APP_STORE = shareSrc.match(/const APP_STORE = '([^']+)'/)?.[1];
const IMG_BASE = shareSrc.match(/const IMG_BASE = '([^']+)'/)?.[1];
if (!APP_STORE || !IMG_BASE) throw new Error('APP_STORE / IMG_BASE 상수를 읽지 못했습니다.');

const romaOf = (name) => {
  const line = personaSrc.match(new RegExp(`${name}[^=]*=\\s*\\{([^}]+)\\}`))?.[1] ?? '';
  const out = {};
  for (const m of line.matchAll(/'([^']+)':\s*'([^']+)'/g)) out[m[1]] = m[2];
  return out;
};
const GAN_ROMA = romaOf('GAN_ROMA');
const JI_ROMA = romaOf('JI_ROMA');

// PERSONA_SHARE 표 파싱 — '甲子': { n: "...", k: [...], s: "..." },
const PERSONA = {};
for (const m of personaSrc.matchAll(/'([^']{2})':\s*\{\s*n:\s*"([^"]*)",\s*k:\s*\[([^\]]*)\],\s*s:\s*"([^"]*)"\s*\}/g)) {
  PERSONA[m[1]] = { n: m[2], k: [...m[3].matchAll(/"([^"]*)"/g)].map((x) => x[1]), s: m[4] };
}
const keys = Object.keys(PERSONA);
if (keys.length < 100) throw new Error(`PERSONA_SHARE 를 ${keys.length}종만 읽었습니다 — 120종이어야 합니다(파서 확인).`);

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** share/index.ts 의 personaPage 와 **같은 마크업**을 정적으로 만든다. */
function personaPage(key, sex) {
  const row = PERSONA[key];
  const g = GAN_ROMA[key[0]], j = JI_ROMA[key[1]];
  const img = g && j ? `${IMG_BASE}${g}-${j}-${sex}.jpg` : null;
  const head = `
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(row.n)}">
<meta property="og:description" content="${esc(row.s)}">
<meta property="og:site_name" content="운이">
${img ? `<meta property="og:image" content="${img}"><meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}`;
  const body = `<div class="brand">운이</div>
<div class="card">
${img ? `<img class="hero" src="${img}" alt="${esc(row.n)}">` : ''}
<div class="hair"></div>
<div class="body">
<p class="kicker">성격유형</p>
<h1>${esc(row.n)}</h1>
<div class="chips">${row.k.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
<p class="sum">${esc(row.s)}</p>
<a class="cta" href="${APP_STORE}">내 유형도 보기 ›</a>
<p class="note">생년월일만 넣으면 바로 나와요. 가입도, 저장도 안 해요.</p>
</div></div>`;
  // ⚠️noindex 유지 — '친구에게 보낸 링크'이지 '웹 게시'가 아니다(원본 설계 그대로).
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(row.n)} — 운이</title><style>${CSS}</style>${head}</head>
<body><div class="wrap">${body}</div></body></html>`;
}

// ── 생성 ─────────────────────────────────────────────────────────────────
const outDir = join(ROOT, 'docs/s/p');
rmSync(outDir, { recursive: true, force: true });   // 옛 유형이 남지 않게 통째로 다시 만든다
mkdirSync(outDir, { recursive: true });

let n = 0, skipped = [];
for (const key of keys) {
  const g = GAN_ROMA[key[0]], j = JI_ROMA[key[1]];
  if (!g || !j) { skipped.push(key); continue; }
  for (const sex of ['m', 'f']) {
    writeFileSync(join(outDir, `${g}-${j}-${sex}.html`), personaPage(key, sex), 'utf8');
    n++;
  }
}
console.log(`✅ 성격유형 공유 페이지 ${n}종 생성 (docs/s/p/) — 유형 ${keys.length} × 성별 2`);
if (skipped.length) console.warn(`⚠️ 로마자 매핑이 없어 건너뜀: ${skipped.join(', ')}`);
