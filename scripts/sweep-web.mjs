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
  /**
   * ★«빈 화면» 판정 — ⚠️**글자 수로만 세면 안 된다**(2026-08-28 내가 그렇게 만들었다가 틀렸다).
   *   「내 명식을 먼저 등록해 주세요 · 명식 등록」은 **22자**지만 **정상적인 빈 상태**다 —
   *   할 일과 버튼이 있으니 막다른 길이 아니다. 그걸 26건이나 «BLANK» 로 세어 놓고 «문제» 라 보고했다.
   * ⇒ **안내 문구가 있으면 통과**시킨다. 진짜 문제는 «아무 말도 없는» 화면뿐이다.
   */
  const body = txt.replace(/니운내운|운친구|운광장|내 운|다섯 기운이 이어|오늘의 나를 읽다/g, '').trim();
  /**
   * ⚠️★★판정을 **두 번** 고쳤다. 글자 수로 «빈 화면» 을 세면 계속 오판한다:
   *   ①「내 명식을 먼저 등록해 주세요 · 명식 등록」(22자) — 버튼이 있는 **정상** 빈 상태
   *   ②「찜한 선생님 · 노쌤 · 사주 · 명리 공부 · ★」(38자) — **내용이 있는** 목록
   *   두 번 다 «문제» 로 보고했다가 눈으로 보고 틀린 걸 알았다.
   * ⇒ 진짜 문제는 **아무 말도 없는** 화면뿐이다. 그 하나만 잡는다.
   *   ★대신 짧은 화면은 **본문을 함께 찍어** 사람이 훑을 수 있게 한다(숨기지 않는다).
   */
  const blank = body.length < 12;
  const real = errs.filter((e) => !/favicon|manifest|401|Failed to load resource/.test(e));
  const mark = crash ? 'CRASH' : blank ? 'BLANK' : real.length ? 'ERR' : 'ok';
  if (mark !== 'ok') bad.push({ r: r || '(home)', mark, status, len: txt.length, e: real[0] || JSON.stringify(body.slice(0, 60)) });
  // ★짧은 화면은 내용을 같이 찍는다 — «통과» 라고만 하면 사람이 확인할 길이 없다
  const peek = mark === 'ok' && body.length < 60 ? `  ${JSON.stringify(body.slice(0, 50))}` : '';
  console.log(`  ${mark === 'ok' ? '✅' : '❌'} /${r.padEnd(16)} ${String(status).padEnd(4)} ${String(txt.length).padStart(5)}자${peek}  ${mark === 'ok' ? '' : (real[0] || mark)}`);
}
await browser.close();
console.log(`\n${bad.length ? `❌ 문제 ${bad.length}건 / ${ROUTES.length}` : `✅ 전 화면 통과 (${ROUTES.length}개)`}`);
for (const b of bad) console.log(`   · /${b.r} — ${b.mark} ${b.e}`);
process.exit(bad.length ? 1 : 0);
