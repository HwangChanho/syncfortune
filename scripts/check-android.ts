// scripts/check-android.ts — 안드로이드 출시 준비 상태 하네스
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-28: "실제 결제랑 다 돼야해 완성시키고 올려"
//
// ★왜 하네스인가(실제로 이렇게 될 뻔했다): iOS 는 다 되는데 안드로이드만 **반쪽인 채로 올라간다.**
//   그리고 그 반쪽은 **크래시가 아니라 '조용한 비활성'** 으로 나타난다 —
//   · RC 안드로이드 키가 비면 `purchasesEnabled()` 가 false → **결제 UI 가 통째로 사라진다**(에러 없음)
//   · google-services.json 이 없으면 푸시 토큰만 안 잡힌다(에러 없음)
//   · 코인 팩이 Play 에 없으면 결제창만 안 뜬다(에러 없음)
//   지인 테스트를 돌려 놓고 "왜 충전이 안 보이지"를 나중에 알게 되는 상황을 막는다.
//
// 지키는 것(안드로이드 배포 전 필수):
//   A1 서명 — 업로드 키스토어 + gradle.properties 자격
//   A2 결제 — RevenueCat 안드로이드 키가 .env 에 **주석 아닌 실값**으로 있다
//   A3 푸시 — google-services.json 존재
//   A4 광고 — AdMob 안드로이드 앱ID
//   A5 상품 — 코인 팩 4종이 Play 등록 스크립트에도 있다(iOS 와 동수)
//   A6 패키지 — app.json android.package 와 gradle applicationId 일치
//   A7 EAS 빌드 환경 — EXPO_PUBLIC_* 가 eas.json 또는 EAS 환경변수에 있다
//      (★로컬 .env 는 **EAS 클라우드 빌드에 자동으로 안 들어간다** — 실측으로 확인.
//       그대로 두면 빌드는 성공하는데 앱에서 결제·백엔드가 통째로 죽는다)
//
// 실행: npm run check:android
// ⚠️이 하네스는 **안드로이드 빌드 전에만** 의미가 있다 — iOS 전용 릴리스에서는 실패해도 무방하도록
//   preflight 에 넣지 않고 별도로 돌린다(A2/A3 는 daniel 콘솔 작업에 달려 있다).
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => { try { return readFileSync(`${ROOT}${p}`, 'utf8'); } catch { return null; } };
const has = (p: string) => existsSync(`${ROOT}${p}`);

let fail = 0, warn = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const wrn = (m: string) => { console.warn(`  ⚠️ ${m}`); warn++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

// ── A1 서명 ──────────────────────────────────────────────────────────────
console.log('\n[A1] 업로드 서명');
{
  if (has('app/android/app/upload.keystore')) ok('upload.keystore 존재');
  else bad('upload.keystore 없음 — 릴리스 AAB 를 서명할 수 없다');
  const gp = read('app/android/gradle.properties') ?? '';
  const keys = ['MYAPP_UPLOAD_STORE_FILE', 'MYAPP_UPLOAD_KEY_ALIAS', 'MYAPP_UPLOAD_STORE_PASSWORD', 'MYAPP_UPLOAD_KEY_PASSWORD'];
  const miss = keys.filter((k) => !new RegExp(`^${k}=.+`, 'm').test(gp));
  if (miss.length) bad(`gradle.properties 에 서명 자격 누락: ${miss.join(', ')}`);
  else ok('서명 자격 4개 설정됨');
}

// ── A2 결제(가장 조용히 죽는 곳) ──────────────────────────────────────────
console.log('\n[A2] 결제 — RevenueCat 안드로이드 키');
{
  const env = read('app/.env') ?? '';
  const line = env.split('\n').find((l) => l.includes('EXPO_PUBLIC_RC_ANDROID_KEY'));
  if (!line) bad('EXPO_PUBLIC_RC_ANDROID_KEY 가 .env 에 아예 없다 — 안드로이드 결제 전부 비활성');
  else if (line.trim().startsWith('#')) bad('EXPO_PUBLIC_RC_ANDROID_KEY 가 **주석 처리**돼 있다 — purchasesEnabled()=false 라 결제 UI 가 통째로 사라진다(에러 없음)');
  else if (!/=\s*\S+/.test(line)) bad('EXPO_PUBLIC_RC_ANDROID_KEY 값이 비어 있다 — 결제 비활성');
  else ok('RC 안드로이드 키 설정됨');

  // 코드가 플랫폼별 키를 실제로 갈라 쓰는지(한쪽만 쓰면 안드로이드가 iOS 키로 붙는다)
  const pur = read('app/src/lib/billing/purchases.ts') ?? '';
  if (/Platform\.OS === 'ios'[\s\S]{0,120}RC_ANDROID_KEY/.test(pur)) ok('플랫폼별 키 분기 확인');
  else bad('purchases.ts 가 플랫폼별 RC 키를 가르지 않는다');
}

// ── A3 푸시 ──────────────────────────────────────────────────────────────
console.log('\n[A3] 푸시 — google-services.json');
{
  const paths = ['app/android/app/google-services.json', 'app/google-services.json'];
  if (paths.some(has)) ok('google-services.json 존재');
  else wrn('google-services.json 없음 — 안드로이드 푸시 토큰이 안 잡힌다(결제·풀이는 정상). 지인 테스트가 UI 확인이면 무시 가능');
}

// ── A4 광고 ──────────────────────────────────────────────────────────────
console.log('\n[A4] 광고 — AdMob 안드로이드');
{
  const aj = read('app/app.json') ?? '';
  if (/"androidAppId":\s*"ca-app-pub-[\d~]+"/.test(aj)) ok('AdMob 안드로이드 앱ID 설정됨');
  else bad('app.json 에 AdMob androidAppId 없음 — 광고 초기화 실패');
  const banner = read('app/src/components/AdBanner.tsx') ?? '';
  if (/android:\s*'ca-app-pub-/.test(banner)) ok('배너 안드로이드 unitId 설정됨');
  else bad('AdBanner 에 안드로이드 배너 unitId 없음');
}

// ── A5 상품 — 코인 팩이 Play 쪽에도 있나 ──────────────────────────────────
console.log('\n[A5] 상품 — 코인 팩 Play 등록');
{
  const coinIds = [...(read('app/src/lib/billing/coinPrices.ts') ?? '').matchAll(/id:\s*'(coin_\d+)'/g)].map((m) => m[1]);
  if (coinIds.length < 2) bad(`앱 COIN_PACKS 를 ${coinIds.length}개밖에 못 읽었다 — 하네스가 헛돈다`);
  const play = read('app/fastlane/play-iap.js');
  if (!play) bad('play-iap.js 가 없다 — Play 콘솔에 코인 팩을 등록할 방법이 없다(iOS 만 등록됨)');
  // ★목록을 **앱 단일 출처에서 동적으로 읽으면** 드리프트가 원천 차단된다 — 리터럴 하드코딩보다 낫다.
  //   (첫 판정이 리터럴 존재만 봐서 더 나은 설계를 실패로 읽었다 — 하네스가 설계를 벌하면 안 된다.)
  else if (/coinPrices\.ts/.test(play) && /COIN_PACKS/.test(play)) ok(`코인 팩을 앱 단일 출처에서 동적으로 읽는다(${coinIds.length}종)`);
  else {
    const inPlay = coinIds.filter((id) => play.includes(`'${id}'`));
    if (inPlay.length !== coinIds.length) bad(`Play 등록 목록에 빠진 코인 팩: ${coinIds.filter((i) => !inPlay.includes(i)).join(', ')}`);
    else ok(`코인 팩 ${coinIds.length}종 Play 등록 목록에 포함(하드코딩)`);
  }
}

// ── A6 패키지 일치 ────────────────────────────────────────────────────────
console.log('\n[A6] 패키지명 일치');
{
  const aj = read('app/app.json') ?? '';
  const pkgJson = aj.match(/"package":\s*"([^"]+)"/)?.[1];
  const gradle = read('app/android/app/build.gradle') ?? '';
  const appId = gradle.match(/applicationId\s+'([^']+)'/)?.[1];
  if (!pkgJson || !appId) bad(`패키지명을 읽지 못했다(app.json=${pkgJson} · gradle=${appId})`);
  else if (pkgJson !== appId) bad(`불일치: app.json ${pkgJson} ≠ gradle ${appId} — RC·Play 상품이 붙지 않는다`);
  else ok(`일치(${appId})`);
}

// ── A7 EAS 빌드 환경변수 ──────────────────────────────────────────────────
// ★실측 사고 직전(2026-07-28): EAS 빌드 로그에
//   "No environment variables with visibility Plain text and Sensitive found for the production environment"
//   → 로컬 .env 는 클라우드 빌드에 **자동 반영되지 않는다.** 그대로 빌드했으면
//   RC 키·Supabase URL 이 빈 채로 나와 결제도 백엔드도 죽은 앱이 지인 손에 갔을 것이다(에러 없이).
console.log('\n[A7] EAS 빌드 환경변수');
{
  const NEEDED = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_RC_IOS_KEY', 'EXPO_PUBLIC_RC_ANDROID_KEY'];
  const eas = read('app/eas.json') ?? '';
  const inEasJson = NEEDED.filter((k) => eas.includes(k));
  // eas.json 에 없으면 **EAS 서버 환경변수**에 있어야 한다 — 이건 오프라인에서 확인 불가라 안내만 한다.
  if (inEasJson.length === NEEDED.length) ok('eas.json 에 4종 전부 선언');
  else {
    wrn(`eas.json 에 없음(${NEEDED.length - inEasJson.length}종) — EAS 서버 환경변수(production)에 등록돼 있어야 한다.`
      + ' 확인: npx eas-cli env:list --environment production');
  }
}

console.log(fail
  ? `\n❌ check:android 실패 ${fail}건${warn ? ` · 경고 ${warn}건` : ''} — 이대로 올리면 해당 기능이 **조용히 비활성**된다`
  : `\n✅ check:android 통과${warn ? ` (경고 ${warn}건)` : ''}`);
process.exit(fail ? 1 : 0);
