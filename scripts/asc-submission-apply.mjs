// scripts/asc-submission-apply.mjs — 제출물의 **빌드·심사 노트·데모 계정**을 바꾼다
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️쓰기(PATCH) 스크립트. 단, **심사 제출(submit)은 하지 않는다** — 그건 되돌릴 수 없고 Boss 몫이다.
//
// 왜: 2026-08-14 리젝의 직접 원인이 **노트와 앱의 불일치**였다.
//   · 노트 = *"purchase WITHOUT signing in"* / 앱 = 로그인 강제 → 심사자가 노트대로 해 보고 막혔다.
//   · 노트 = *"This account has premium unlocked"* / 실제 = `effPrem` 하드코딩 false + 계정 `is_premium=false`.
//   · 데모 계정 = ASC 칸이 **비어 있고**, 노트에 적힌 계정은 **로그인이 안 되는 상태**였다(실측).
//   ⇒ 이번 노트는 문장마다 코드·DB로 확인한 것만 적는다. 확인 못 한 문장은 넣지 않는다.
//
// 실행: node scripts/asc-submission-apply.mjs            (미리보기)
//       node scripts/asc-submission-apply.mjs --apply    (반영)
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';

const KEY_ID = 'L7GWWF9WVF';
const ISSUER = process.env.ASC_ISSUER_ID || '5f89581a-d0c6-46c2-9461-78d5c08448fa';
const P8 = `${os.homedir()}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`;
const APP_ID = '6779321930';
const APPLY = process.argv.includes('--apply');

/** 붙일 빌드 = 오늘 올린 것(관계 지도 3건 + 5.1.1 수정). 번호는 분 epoch 라 시각이 복원된다. */
const BUILD_VERSION = '29779455';

const DEMO_EMAIL = 'applereview@syncfortune.app';
const DEMO_PASSWORD = 'WooniReview2026!';

/** 심사 노트 — `docs/appstore-review-notes.md` §5 와 같은 원문(문서가 정본, 여기는 사본). */
const NOTES = `Wooni ("니운내운") — App Review Notes (Aug 15, 2026)

DEMO ACCOUNT
On the sign-in screen, press and hold the app title for 1 second to reveal the email/password fields.
    email: ${DEMO_EMAIL}
    password: ${DEMO_PASSWORD}
This account is pre-loaded with in-app credits, so every paid analysis can be opened WITHOUT any
purchase. (Sign-in is optional for the app itself — see section 1.)

1. GUIDELINE 5.1.1(v) — FIXED IN BUILD ${BUILD_VERSION}
You reported that registration was still required before purchasing non-account-based IAP. That was
correct. We had opened this path in July and then narrowed it again by mistake in late July, which is
why the previous note and the app disagreed. In this build:
 - An anonymous session is created on launch; coin packs are purchasable with NO sign-in at all.
 - The purchase attaches to that anonymous user id and unlocks content immediately.
 - AFTER the purchase we show a dismissible notice explaining that signing in lets the purchased
   content open on another device, and sign-in remains available in Settings at any time.
 - Signing in later links the same user id, so nothing is lost.
To verify: fresh install, do not sign in, open the store and buy any coin pack.
An automated check in our build pipeline now fails if this gate is ever narrowed again.

2. GUIDELINE 4.3(b) — WHAT WE CHANGED
We are not asking you to re-weigh a saturated category, and we are not arguing that our version of a
horoscope is better. We changed what the app leads with, because our own metadata described the app
as a fortune-telling bundle while its core is a computation and relationship tool:
 - The subtitle, keywords, description and screenshots have been rewritten around the two things that
   are not horoscope content: the Relationship Map and the perpetual-calendar engine.
 - RELATIONSHIP MAP (absent from build 29763243, present here): every person the user registers is
   placed on one map relative to the user's own chart. Each is classified into one of five structural
   roles derived from the interaction between the two charts, adjusted by the elemental distribution
   of that person's full chart - not by birth year or sign. Tapping a person opens the computed
   compatibility together with the reasons behind the number. The map also reports what the user's
   network lacks. It is free and computed entirely on-device.
   Where: Home > "관계 지도" card.
 - ENGINE: charts are derived from an exact birth moment using true solar time by birth longitude
   (24 domestic + 25 overseas cities), the equation of time, historical standard-meridian changes
   (Korea used 127.5E in 1954-1961) and historical daylight-saving periods. Two births 8 minutes
   apart in different cities produce different charts, and the app shows that difference. There are
   no twelve zodiac buckets and no shared text: two users never receive the same output.

3. HOW TO EVALUATE IN TWO MINUTES (no account, no purchase)
 1) Home > register a birth profile (date + time + city). Enter the same time for two different
    cities - the hour pillar changes.
 2) Home > "관계 지도" - add a second profile; roles and chemistry appear. Tap any dot.
 3) Readings tab - most items are computed on-device and free.
 4) Perpetual Calendar tab - raw chart, luck cycles, detected interactions.

4. SAFETY
No medical, diagnostic or disease-prediction language. No investment or legal advice. No gambling.
Birth data is encrypted at rest; the server cannot read chart contents.

Thank you for the time already spent on this app.
Chanho Hwang / SyncFortune`;

if (!fs.existsSync(P8)) { console.error(`❌ ASC 키 없음: ${P8}`); process.exit(1); }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const t0 = Math.floor(Date.now() / 1000);
const head = `${b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })}.${b64({ iss: ISSUER, iat: t0, exp: t0 + 1200, aud: 'appstoreconnect-v1' })}`;
const JWT = `${head}.${crypto.createSign('SHA256').update(head).sign({ key: fs.readFileSync(P8, 'utf8'), dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;

async function api(method, path, body) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${JWT}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await r.text();
  if (!r.ok) { console.error(`❌ ${method} ${path} → ${r.status}\n${text.slice(0, 500)}`); process.exit(1); }
  return text ? JSON.parse(text) : {};
}

// ── 대상 ────────────────────────────────────────────────────────────────────
const ver = (await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=1&include=build`)).data[0];
console.log(`대상 버전: ${ver.attributes.versionString} (${ver.attributes.appStoreState})`);
const curBuildId = ver.relationships?.build?.data?.id ?? null;

// 붙일 빌드 찾기 — 번호로 조회한다(id 를 코드에 박지 않는다)
const builds = (await api('GET', `/v1/builds?filter[app]=${APP_ID}&filter[version]=${BUILD_VERSION}&limit=1`)).data;
if (!builds.length) { console.error(`❌ 빌드 ${BUILD_VERSION} 를 못 찾았다`); process.exit(1); }
const build = builds[0];
console.log(`붙일 빌드: ${build.attributes.version} · ${build.attributes.processingState} · 업로드 ${new Date(build.attributes.uploadedDate).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })} KST`);
if (build.attributes.processingState !== 'VALID') { console.error('❌ 아직 VALID 가 아니다 — 처리 끝나고 다시'); process.exit(1); }
console.log(`현재 붙은 빌드 id: ${curBuildId ?? '(없음)'} → ${build.id}`);

const rd = (await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`)).data;
console.log(`심사정보: 데모 필요=${rd.attributes.demoAccountRequired} · 데모ID="${rd.attributes.demoAccountName || '(비어 있음)'}" · 노트 ${(rd.attributes.notes || '').length}자`);

// 되돌릴 수 있게 현재 노트를 남긴다
fs.writeFileSync('docs/release/asc-reviewnotes-backup.json', JSON.stringify({
  savedAt: new Date().toISOString(),
  buildId: curBuildId,
  demoAccountRequired: rd.attributes.demoAccountRequired,
  demoAccountName: rd.attributes.demoAccountName,
  notes: rd.attributes.notes,
}, null, 2));
console.log('백업: docs/release/asc-reviewnotes-backup.json');

if (!APPLY) { console.log('\n(미리보기 — 아무것도 바꾸지 않았다. 반영하려면 --apply)'); process.exit(0); }

// ── 반영 ────────────────────────────────────────────────────────────────────
await api('PATCH', `/v1/appStoreVersions/${ver.id}`, {
  data: { type: 'appStoreVersions', id: ver.id, relationships: { build: { data: { type: 'builds', id: build.id } } } },
});
await api('PATCH', `/v1/appStoreReviewDetails/${rd.id}`, {
  data: { type: 'appStoreReviewDetails', id: rd.id,
    attributes: { demoAccountRequired: true, demoAccountName: DEMO_EMAIL, demoAccountPassword: DEMO_PASSWORD, notes: NOTES } },
});

// ── 검증(다시 읽는다) ───────────────────────────────────────────────────────
const v2 = (await api('GET', `/v1/appStoreVersions/${ver.id}?include=build`));
const b2 = v2.included?.find((x) => x.type === 'builds');
const r2 = (await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreReviewDetail`)).data.attributes;
console.log('\n── 반영 후 실측 ──');
console.log(`  붙은 빌드   : ${b2?.attributes?.version ?? '(없음)'} ${b2?.attributes?.version === BUILD_VERSION ? '✅' : '❌'}`);
console.log(`  데모 필요   : ${r2.demoAccountRequired} ${r2.demoAccountRequired ? '✅' : '❌'}`);
console.log(`  데모 ID     : ${r2.demoAccountName} ${r2.demoAccountName === DEMO_EMAIL ? '✅' : '❌'}`);
console.log(`  노트        : ${(r2.notes || '').length}자 ${((r2.notes || '').includes(BUILD_VERSION)) ? '✅ 새 노트' : '❌ 옛 노트'}`);
console.log('\n※ 심사 제출(Submit)은 하지 않았다 — 되돌릴 수 없는 행동이라 Boss 가 누른다.');
