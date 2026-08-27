/**
 * app/src/app/+html.tsx — 웹 **문서 껍데기**(expo-router)
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-27 *"링크 보낼때 url 링크 보낼때 로고랑 이미지 뜨면 좋겠어 북마크 같이"*
 *
 * ■ ★왜 필요했나 — **메타 태그가 하나도 없었다**
 *   실측: 배포된 HTML 에 `og:` 가 **0개**였다. 그래서 카카오톡·슬랙·문자에 주소를 붙이면
 *   **제목도 그림도 없는 맨 주소**만 떴다. 공유가 곧 유입인데 그 첫 인상이 비어 있었다.
 *
 * ■ ⚠️여기서 «화면» 을 그리지 않는다
 *   이 파일은 **`<head>` 를 정하는 자리**다. 앱 화면은 `_layout` 아래가 그린다.
 *   `children` 자리에 다른 것을 얹으면 모든 화면 위에 그게 붙는다.
 *
 * ■ 그림은 `app/public/` 에 둔다
 *   `assets/` 는 번들러가 **해시 붙은 경로**로 옮겨서 주소를 미리 못 적는다.
 *   `public/` 은 그대로 복사되므로 `/og.png` 로 고정 주소를 쓸 수 있다.
 *   ⚠️OG 이미지는 **절대 주소**여야 한다 — 크롤러는 상대 경로를 못 푼다.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/** 공유 카드에 뜨는 주소. ⚠️커스텀 도메인이 생기면 **여기만** 바꾸면 된다. */
const SITE = 'https://niwoon2.pages.dev';
const TITLE = '니운내운 — 사주·자미두수·타로 운세';
const DESC = '사주와 자미두수를 함께 읽어 오늘의 나를 봅니다. 명식 등록부터 상담까지.';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* ⚠️`viewport-fit=cover` — 노치 있는 폰에서 배경이 끝까지 차게 */}
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />

        <title>{TITLE}</title>
        <meta name="description" content={DESC} />
        {/* ★브라우저 탭·주소창 색 — 링크 카드가 아니라 **앱처럼** 보이게 */}
        <meta name="theme-color" content="#39609D" />

        {/* ── Open Graph (카카오톡·슬랙·페이스북) ── */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="니운내운" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESC} />
        <meta property="og:url" content={SITE} />
        <meta property="og:image" content={`${SITE}/og.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content="ko_KR" />

        {/* ── 트위터 카드 — `summary_large_image` 라야 그림이 크게 뜬다 ── */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESC} />
        <meta name="twitter:image" content={`${SITE}/og.png`} />

        {/* ★북마크·홈 화면 아이콘 (Boss: *"북마크 같이"*) */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.png" />

        {/*
          ⚠️`ScrollViewStyleReset` — RN Web 의 ScrollView 가 웹에서 제대로 스크롤되게 하는
            expo-router 기본 리셋이다. 빼면 **화면이 스크롤되지 않는다**.
        */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
