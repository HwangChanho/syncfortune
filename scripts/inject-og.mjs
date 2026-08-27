#!/usr/bin/env node
// scripts/inject-og.mjs — 웹 산출물(`app/dist/index.html`)에 **링크 미리보기 메타**를 넣는다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27 *"링크 보낼때 url 링크 보낼때 로고랑 이미지 뜨면 좋겠어 북마크 같이"*
//
// ■ ⚠️★왜 `+html.tsx` 로 안 되나 — **실측으로 확인했다**
//   `app/src/app/+html.tsx` 를 만들었는데 산출물에 `og:` 가 **0개**였고 `<title>` 도
//   `app.json` 의 `name`(「니운내운」) 그대로였다. 이 프로젝트는 `web.output: "single"`(SPA)이라
//   expo-router 가 그 파일을 **문서 껍데기로 쓰지 않는다.**
//   ⇒ «되는 줄 알고» 두면 링크는 계속 맨 주소로 뜬다. 산출물에 **직접** 넣는다.
//
// ■ ★멱등하다 — 이미 있으면 다시 넣지 않는다(배포를 두 번 해도 태그가 겹치지 않는다)
//
// 사용: npm run build:web  (export 뒤에 자동으로 돈다)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const FILE = 'app/dist/index.html';
/** 공유 카드에 뜨는 주소. ⚠️커스텀 도메인이 생기면 **여기만** 바꾼다. */
const SITE = 'https://niwoon2.pages.dev';
const TITLE = '니운내운 — 사주·자미두수·타로 운세';
const DESC = '사주와 자미두수를 함께 읽어 오늘의 나를 봅니다. 명식 등록부터 상담까지.';

if (!existsSync(FILE)) {
  console.error(`❌ ${FILE} 가 없습니다 — 먼저 expo export 를 하세요.`);
  process.exit(1);
}
let html = readFileSync(FILE, 'utf8');

if (html.includes('og:image')) {
  console.log('  이미 들어 있습니다 — 건너뜁니다.');
  process.exit(0);
}

const meta = `
    <meta name="description" content="${DESC}" />
    <meta name="theme-color" content="#39609D" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="니운내운" />
    <meta property="og:title" content="${TITLE}" />
    <meta property="og:description" content="${DESC}" />
    <meta property="og:url" content="${SITE}" />
    <meta property="og:image" content="${SITE}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="ko_KR" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${TITLE}" />
    <meta name="twitter:description" content="${DESC}" />
    <meta name="twitter:image" content="${SITE}/og.png" />
    <link rel="apple-touch-icon" href="/favicon.png" />
`;

// ★`<title>` 도 갈아 끼운다 — 북마크·검색 결과에 뜨는 이름이다(`app.json` 의 name 은 너무 짧다)
html = html.replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`);
// ⚠️`</head>` **바로 앞**에 넣는다 — 앞쪽에 끼우면 charset 선언보다 먼저 와서 한글이 깨질 수 있다
html = html.replace('</head>', `${meta}  </head>`);
writeFileSync(FILE, html);

const n = (html.match(/og:|twitter:/g) ?? []).length;
console.log(`  ✅ ${FILE} — 메타 주입(og·twitter ${n}개) · title「${TITLE}」`);
