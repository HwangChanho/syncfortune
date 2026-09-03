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
// ★사업자 정보는 **단일 출처**에서 읽는다(문서·하네스와 같은 값).
//   ⚠️여기 다시 적으면 `docs/legal/refund-*.md` 와 갈린다 — 그래서 갈렸던 것을 고친 것이다.
import { BIZ, mailOrderLabel, webPacks } from './biz-info.mjs';

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

// ⚠️★2026-09-04: 종전엔 여기서 `og:image` 만 보고 **스크립트 전체를 끝냈다.**
//   그러면 법정 고지 주입(`#legal-static`)이 **og 주입에 얹혀 있게** 된다 —
//   훗날 og 태그가 다른 경로로 들어오는 순간 고지는 조용히 사라지고, 아무도 모른다.
//   ⇒ 둘은 **서로 다른 관심사**다. 각자 «이미 있으면 건너뛴다»로 멱등하게 두고,
//     **둘 다** 있을 때만 일찍 끝낸다.
const hasOg = html.includes('og:image');
const hasLegal = html.includes('id="legal-static"');
if (hasOg && hasLegal) {
  console.log('  이미 들어 있습니다(og·법정고지 둘 다) — 건너뜁니다.');
  process.exit(0);
}

const meta = `
    <meta name="description" content="${DESC}" />
    <meta name="theme-color" content="#1B5FE0" />   <!-- ★브랜드색 단일 출처: app.json · +html.tsx · 여기 셋이 같아야 한다(check:appicon B1) -->
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
    <!--
      한국어 줄바꿈 — 어절 단위로만 끊는다 (Boss 2026-08-28 "웹에서 자꾸 이상한곳에서 줄바꿈")
      브라우저 기본(word-break: normal)은 한글을 음절 사이 아무 데나 끊는다.
      실측: 「직장이 맞는 구 / 조야」 · 「책임지는 자 / 리가」 · 「전문성으로 꽃 / 을」.
      웹에서만 나는 문제다 — 네이티브 텍스트 레이아웃은 어절에서 끊는다.
      overflow-wrap: break-word 를 짝으로 둔다(안 두면 긴 주소가 칸을 넘친다).
    -->
    <style>body, body * { word-break: keep-all; overflow-wrap: break-word; }</style>
    <link rel="apple-touch-icon" href="/icon-192.png" />

    <!-- ★PWA — 홈 화면에 추가하면 **주소창 없이** 뜬다(Boss 2026-08-27 *"모바일 브라우저에서
         볼땐 앱처럼 나오지?"* → 실측 결과 아니었다: manifest 도 apple 메타도 없었다).
         ⚠️Service Worker 는 **넣지 않았다** — 캐시가 한 겹 더 생기면 «고쳤는데 옛 화면» 이 난다
           ([[media-cache-version]] 계열). iOS 는 SW 없이도 전체화면이 되고,
           Android 도 «홈 화면에 추가» 는 된다(Chrome 의 자동 설치 배너만 SW 를 요구한다). -->
    <link rel="manifest" href="/manifest.json" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="니운내운" />
    <meta name="mobile-web-app-capable" content="yes" />
`;

// ★노치 폰에서 배경이 **끝까지 차게** — 없으면 위아래에 흰 띠가 남는다.
//   ⚠️expo 가 만든 viewport 에는 이 값이 없다(실측). 이미 있으면 건드리지 않는다.
if (!/viewport-fit=cover/.test(html)) {
  html = html.replace(
    /(<meta name="viewport" content="[^"]*)"/,
    '$1, viewport-fit=cover"',
  );
}

// ★`<title>` 도 갈아 끼운다 — 북마크·검색 결과에 뜨는 이름이다(`app.json` 의 name 은 너무 짧다)
// ★문서 언어 — 기본은 한국어다(`og:locale` 이 ko_KR 인데 `lang="en"` 이었다).
//   ⚠️여기는 **정적 기본값**일 뿐이다. 회원이 언어를 바꾸면 앱이 `documentElement.lang` 을 갱신한다
//     (`lib/i18n.ts`) — 이 줄만 바꾸면 영어 회원에게도 ko 가 남는다.
// ═══════════════════════════════════════════════════════════════════════════
// ★★사업자·약관·가격을 **초기 HTML 에 정적으로** 심는다 (2026-09-04)
//
// ■ 왜 — PG(결제대행사) 심사 봇이 우리 사이트를 열고 **글자 46자**만 봤다.
//   포트원 사전 점검 6건이 전부 «확인 필요» 로 떴다:
//     사업자 정보 / 이용약관 / 개인정보처리방침 / 환불 정책 / 상품 등록.
//   문서는 **다 있었다**(GitHub Pages · 3종 200 OK). 없던 건 «봇이 읽을 수 있는 형태» 였다.
//   ⇒ SPA(`web.output: "single"`)라 JS 를 안 돌리면 body 가 비어 있다. 봇은 JS 를 안 돈다.
//
// ■ ⚠️전자상거래법 필수 고지이기도 하다 — 상호·대표자·주소·연락처·사업자번호.
//   ★가격은 **코드에서 읽는다**(`coinPrices.ts` 단일 출처) — 손으로 적으면 갈린다
//   ([[duplicate-ui-single-source]] 의 그 병).
//
// ■ SPA 가 뜨면 이 푸터는 화면 밖으로 밀린다(`#legal-static`). 사람 눈에는 안 걸리고
//   봇·검색엔진에는 읽힌다. 접근성을 위해 `hidden` 은 쓰지 않는다.
// ═══════════════════════════════════════════════════════════════════════════
const LEGAL = 'https://hwangchanho.github.io/syncfortune/legal';

// 가격표는 **웹 채널 가격**으로 뽑는다(`biz-info.mjs` 가 `coinPrices.ts` 를 읽는다).
//   ⚠️★여기가 스토어 정가를 실으면 «고지 9,900원 · 청구 7,200원» 이 된다(2026-09-04 실측으로 갈렸다).
//     이 푸터는 **웹 산출물**에 들어간다 — 이 사이트가 실제로 받는 값을 적어야 한다.
const packs = webPacks();
const won = (n) => n.toLocaleString('ko-KR');
const rows = packs.map((p) => `<li>운 ${won(p.coins)}개 — ${won(p.won)}원</li>`).join('');

const footer = `
  <footer id="legal-static" style="position:absolute;left:-99999px;top:auto;width:1px;height:1px;overflow:hidden">
    <h2>판매 상품 및 가격</h2>
    <p>디지털 콘텐츠(사주·자미두수·타로 운세 풀이) 및 AI 상담 대화 서비스. 앱 내 재화 「운」으로 이용합니다.</p>
    <ul>${rows}</ul>
    <h2>사업자 정보</h2>
    <ul>
      <li>상호: ${BIZ.name}</li>
      <li>대표자명: ${BIZ.owner}</li>
      <li>사업자등록번호: ${BIZ.regNo}</li>
      <li>통신판매업 신고번호: ${mailOrderLabel('ko')}</li>
      <li>사업장 주소: ${BIZ.addr}</li>
      <li>전화번호: <a href="tel:${BIZ.tel.replace(/-/g, '')}">${BIZ.tel}</a></li>
      <li>이메일: <a href="mailto:${BIZ.email}">${BIZ.email}</a></li>
    </ul>
    <h2>약관 및 정책</h2>
    <ul>
      <li><a href="${LEGAL}/terms-ko.html">이용약관</a></li>
      <li><a href="${LEGAL}/privacy-ko.html">개인정보처리방침</a></li>
      <li><a href="${LEGAL}/refund-ko.html">환불 및 청약철회 정책</a></li>
    </ul>
    <h2>환불·취소·청약철회</h2>
    <p>구매한 「운」은 사용하지 않은 경우 결제일로부터 7일 이내에 청약철회(전액 환불)가 가능합니다.
       이미 사용한 콘텐츠는 디지털 콘텐츠의 특성상 환불이 제한될 수 있으며, 자세한 기준은
       <a href="${LEGAL}/refund-ko.html">환불 및 청약철회 정책</a>을 따릅니다.
       문의: <a href="mailto:${BIZ.email}">${BIZ.email}</a></p>
  </footer>
`;
if (!html.includes('id="legal-static"')) {
  html = html.replace('</body>', `${footer}</body>`);
  console.log(`  ✅ ${FILE} — 사업자·약관·환불·상품(${packs.length}종) 정적 고지 주입`);
}

html = html.replace(/<html lang="[^"]*"/, '<html lang="ko"');
html = html.replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`);
// ⚠️`</head>` **바로 앞**에 넣는다 — 앞쪽에 끼우면 charset 선언보다 먼저 와서 한글이 깨질 수 있다
if (!hasOg) html = html.replace('</head>', `${meta}  </head>`);
writeFileSync(FILE, html);

const n = (html.match(/og:|twitter:/g) ?? []).length;
console.log(`  ✅ ${FILE} — 메타 주입(og·twitter ${n}개) · title「${TITLE}」`);
