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

/**
 * ★**화면에 새면 안 되는 값** (2026-09-02 신설).
 *   크래시가 아니라 «그려지긴 했는데 값이 새는» 것들이다 — 사용자에게 그대로 보인다.
 * ⚠️첫 판에 «번역키(a.b.c)» 규칙을 넣었다가 `apps.apple.com` 을 **16화면에서 오탐**했다.
 *   ⇒ URL·도메인은 빼고 본다. 규칙은 **오탐이 나면 그 자리에서 좁힌다**(거짓 빨간불이 더 나쁘다).
 */
const LEAKS = [
  ['undefined 노출', /\bundefined\b/],
  ['NaN 노출', /\bNaN\b/],
  ['[object Object] 노출', /\[object Object\]/],
  ['미치환 {{키}}', /\{\{\s*\w+\s*\}\}/],
  // ⚠️★처음엔 `(?![\s]*[가-힣])` 를 붙였다가 **절대 발동할 수 없는 규칙**이 됐다 —
  //   한국어 화면이라 R번호 뒤에는 늘 한글이 온다. 죽은 규칙은 없느니만 못하다(가짜 안전감).
  //   ⇒ 뺐다. 프롬프트 규약상 내부 표지(R1~)는 **사용자 화면에 한 글자도 안 된다**.
  ['내부표지 R번호', /\bR\d{1,2}\b/],
];
/** URL·도메인·이메일은 판정에서 뺀다(정상적으로 화면에 있을 수 있다). */
const deUrl = (t) => t.replace(/https?:\/\/\S+/g, ' ').replace(/\b[\w.-]+\.(com|net|org|io|kr|dev|app)\b/g, ' ');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ko-KR' });
const page = await ctx.newPage();

/**
 * ★★**명식을 하나 심고 돈다** (2026-09-02).
 *
 * ■ 왜 — 2026-09-02 에 만세력이 **통째로 안 열리는** 버그(`johu2` 에 전체 차트를 넘김)가
 *   **이 스윕을 그대로 통과**했다. 스윕이 «명식 없는 사람» 으로만 돌아서, `/charts` 가
 *   「내 명식을 먼저 등록해 주세요」 빈 상태만 보고 **크래시 나는 코드에 닿지도 않았다.**
 *   ⇒ 그 사이 vc156·157 **두 빌드가 그대로 출시됐다.**
 * ■ ⇒ 로그인 없이도 되는 **로컬 명식**(`my_charts_v2`)을 심어, 데이터가 있어야 도는
 *   화면(만세력·오행·용신·신살…)을 실제로 그리게 한다.
 * ■ ⚠️서버 자료는 안 건드린다 — 브라우저 localStorage 뿐이고 컨텍스트는 매번 새로 만든다.
 * ■ ⚠️생년월일은 **골든 픽스처와 같은 값**을 쓴다(엔진 검증에서 쓰는 그 명식).
 */
const SEED = [{
  id: 'sweep-seed', label: '스윕', relation: 'self',
  input: {
    birthDateTime: '1994-03-16 17:55', calendar: '양', timeAccuracy: '정확',
    sex: '남', birthPlace: '전라남도 여수',
  },
}];
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
await page.evaluate(([charts, id]) => {
  try {
    localStorage.setItem('my_charts_v2', JSON.stringify(charts));
    localStorage.setItem('my_rep_v2', id);
  } catch { /* 저장 못 하면 종전처럼 빈 상태로 돈다 */ }
}, [SEED, 'sweep-seed']);

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
  // ★새는 값 — 크래시는 아니지만 사용자에게 그대로 보인다
  const clean = deUrl(txt);
  const leaks = LEAKS.filter(([, re]) => re.test(clean)).map(([n, re]) => `${n}(${JSON.stringify((clean.match(re) || [''])[0])})`);
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
  const mark = crash ? 'CRASH' : blank ? 'BLANK' : leaks.length ? 'LEAK' : real.length ? 'ERR' : 'ok';
  if (mark !== 'ok') bad.push({ r: r || '(home)', mark, status, len: txt.length, e: leaks[0] || real[0] || JSON.stringify(body.slice(0, 60)) });
  // ★짧은 화면은 내용을 같이 찍는다 — «통과» 라고만 하면 사람이 확인할 길이 없다
  const peek = mark === 'ok' && body.length < 60 ? `  ${JSON.stringify(body.slice(0, 50))}` : '';
  console.log(`  ${mark === 'ok' ? '✅' : '❌'} /${r.padEnd(16)} ${String(status).padEnd(4)} ${String(txt.length).padStart(5)}자${peek}  ${mark === 'ok' ? '' : (leaks[0] || real[0] || mark)}`);
}
await browser.close();
console.log(`\n${bad.length ? `❌ 문제 ${bad.length}건 / ${ROUTES.length}` : `✅ 전 화면 통과 (${ROUTES.length}개)`}`);
for (const b of bad) console.log(`   · /${b.r} — ${b.mark} ${b.e}`);
process.exit(bad.length ? 1 : 0);
