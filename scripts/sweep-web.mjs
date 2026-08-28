/**
 * scripts/sweep-web.mjs — 배포된 웹의 **모든 화면을 한 번씩 열어** 크래시·빈 화면·콘솔 오류를 잡는다.
 * ═════════════════════════════════════════════════════════════════════════
 * ■ ★왜 필요한가 — 2026-08-28. 배포만 하고 «될 것» 이라 보고했다가 Boss 에게 지적받았다.
 *   눌러 보니 **네 가지**가 안 됐다(스토리지 403 · 안내자 사주 누수 · 인사 중복 구현 · 명식 카드).
 * ■ ⚠️브라우저 안에서 `pushState` 로 도는 방법은 **못 쓴다** — SPA 가 따라오지 않아
 *   길이가 앞 화면 것으로 남고, 멀쩡한 화면이 «BLANK» 로 잡혔다(실측: /taro 오탐).
 *   ⇒ **진짜 이동**(goto)만 신뢰한다.
 * ■ 판정: ①에러 바운더리 문구 ②본문이 거의 빈 것 ③콘솔 error / pageerror
 *   ⚠️로그인 게이트·«없음» 안내는 정상이라 **문구로** 가려낸다(빈 화면과 다르다).
 */
import { chromium } from 'playwright';

const BASE = process.env.SWEEP_BASE || 'https://niwoon2.pages.dev';
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : [
  '', 'my', 'talk', 'chats', 'friends', 'community', 'myeongsik', 'charts', 'today', 'month',
  'coins', 'settings', 'notifications', 'contents', 'market', 'favorites', 'relationmap', 'compat',
  'taro', 'ziwei', 'astrology', 'numerology', 'dayPillar', 'sinsal', 'gaeun', 'healing', 'luck',
  'biorhythm', 'taegil', 'personal', 'personatype', 'mbti', 'egenteto', 'traits', 'zodiac', 'pet',
  'dream', 'taemong', 'wealth', 'career', 'jobfit', 'talent', 'love', 'lovestyle', 'crush',
  'reunion', 'sokgunghap', 'lifegraph', 'timeline', 'roots', 'selfanalysis', 'analyzed', 'attach',
  'bok', 'bugreport', 'child', 'coach', 'coinhistory', 'country', 'crisis', 'future10', 'gem',
  'impression', 'job', 'joseonjob', 'light', 'mission', 'moment', 'mycard', 'mycomments',
  'myposts', 'myreadings', 'myteachers', 'name', 'newyear', 'pastlife', 'register',
  'relationpattern', 'rooms', 'timeResolve', 'typematch',
];

const CRASH = /문제가 생겼어요|Text strings must be|Rendered more hooks|Minified React error/;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ko-KR' });
const page = await ctx.newPage();

const bad = [];
for (const r of ROUTES) {
  const errs = [];
  const onC = (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); };
  const onE = (e) => errs.push('pageerror: ' + String(e.message).slice(0, 140));
  page.on('console', onC); page.on('pageerror', onE);
  let txt = '', status = 0;
  try {
    const res = await page.goto(`${BASE}/${r}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    status = res?.status() ?? 0;
    await page.waitForTimeout(2600);
    txt = (await page.evaluate(() => (document.body.innerText || '').trim())) || '';
  } catch (e) { errs.push('goto: ' + String(e).slice(0, 120)); }
  page.off('console', onC); page.off('pageerror', onE);

  const crash = CRASH.test(txt);
  // ★«빈 화면» 은 **본문이 거의 없는 것**이다. 로그인 안내·목록 없음은 글이 있으므로 안 걸린다.
  const blank = txt.replace(/니운내운|운친구|운광장|내 운|다섯 기운이 이어|오늘의 나를 읽다/g, '').trim().length < 40;
  const real = errs.filter((e) => !/favicon|manifest|401|Failed to load resource/.test(e));
  const mark = crash ? 'CRASH' : blank ? 'BLANK' : real.length ? 'ERR' : 'ok';
  if (mark !== 'ok') bad.push({ r: r || '(home)', mark, status, len: txt.length, e: real[0] || '' });
  console.log(`  ${mark === 'ok' ? '✅' : '❌'} /${r.padEnd(16)} ${String(status).padEnd(4)} ${String(txt.length).padStart(5)}자  ${mark === 'ok' ? '' : (real[0] || mark)}`);
}
await browser.close();
console.log(`\n${bad.length ? `❌ 문제 ${bad.length}건 / ${ROUTES.length}` : `✅ 전 화면 통과 (${ROUTES.length}개)`}`);
for (const b of bad) console.log(`   · /${b.r} — ${b.mark} ${b.e}`);
process.exit(bad.length ? 1 : 0);
