// scripts/serve-web.mjs — 웹 빌드 산출물을 **SPA 폴백과 함께** 띄운다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 필요한가 (2026-08-15 실사고):
//   `python3 -m http.server` 로 띄웠더니 **소셜 로그인이 전부 실패**했다.
//   원인은 로그인이 아니라 **돌아오는 길**이었다 —
//   구글 인증은 정상으로 끝나고 `…/auth-callback?code=…` 로 되돌아오는데,
//   정적 서버엔 그 파일이 없어서 **404**. 앱은 뜨지도 못하니 코드 교환이 일어날 수 없다.
//   (같은 이유로 `/contents` 직접 접근·새로고침·링크 공유도 전부 404였다.)
//
//   ★교훈: SPA 는 **모든 경로를 index.html 로** 내려줘야 한다. 이건 앱 코드가 아니라 **호스팅 설정**이다.
//     운영 배포에서도 같은 규칙이 필요하다 — Cloudflare Pages: `_redirects` 에 `/* /index.html 200`.
//
// 실행: node scripts/serve-web.mjs [포트] [디렉터리]
//        기본 8899 · /tmp/wooni-web-out
// ═══════════════════════════════════════════════════════════════════════════
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.argv[2]) || 8899;
const ROOT = process.argv[3] || '/tmp/wooni-web-out';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', '.map': 'application/json',
};

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  // ★경로 탈출 차단 — 정적 서버의 기본 안전장치(`../../etc/passwd` 류)
  const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(ROOT, rel);

  // 디렉터리면 index.html
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');

  // ★SPA 폴백 — 파일이 없으면 index.html 을 내려준다(라우팅은 브라우저에서 한다).
  //   단 실제 자산(확장자 있는 요청)은 그냥 404 — 없는 이미지를 index.html 로 주면 진단이 어려워진다.
  if (!fs.existsSync(file)) {
    if (path.extname(rel)) { res.writeHead(404); res.end('Not found'); return; }
    file = path.join(ROOT, 'index.html');
  }

  const body = fs.readFileSync(file);
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',   // 개발 중엔 항상 새 번들을 받게(옛 화면 보고 오판 방지)
  });
  res.end(body);
}).listen(PORT, () => {
  console.log(`▶ ${ROOT} → http://127.0.0.1:${PORT}  (SPA 폴백 켜짐)`);
});
