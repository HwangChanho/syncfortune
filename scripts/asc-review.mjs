// scripts/asc-review.mjs — App Store 제출물 전수 점검 (ASC API · **읽기 전용**)
// ═══════════════════════════════════════════════════════════════════════════
// 왜 필요한가 (2026-08-15 · 두 번째 리젝 뒤):
//   리젝은 코드만 보고 못 막는다. 심사자가 실제로 보는 것은 **스크린샷 → 설명 → 심사 노트 →
//   데모 계정 → 빌드** 순이다. 그중 어디 하나라도 앱과 어긋나면 그게 리젝 사유가 된다
//   (5.1.1 재리젝의 원인이 정확히 그것 — 노트엔 "로그인 없이 구매 가능"인데 앱은 막혀 있었다).
//   ⇒ 제출 전에 **콘솔에 실제로 들어 있는 값**을 여기서 통째로 읽어 눈으로 대조한다.
//
// ★이 스크립트는 아무것도 바꾸지 않는다(GET 만). 값 수정은 Boss 가 콘솔에서.
//
// 실행: node scripts/asc-review.mjs            (요약)
//       node scripts/asc-review.mjs --shots    (스크린샷을 /scratchpad 로 내려받아 눈으로 확인)
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KEY_ID = 'L7GWWF9WVF';
const ISSUER = process.env.ASC_ISSUER_ID || '5f89581a-d0c6-46c2-9461-78d5c08448fa';
const P8 = `${os.homedir()}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`;
const APP_ID = '6779321930';
const WANT_SHOTS = process.argv.includes('--shots');
const SHOT_DIR = process.argv.find((a) => a.startsWith('--dir='))?.slice(6)
  || '/private/tmp/claude-501/-Users-danielhwang-Desktop-Projects-syncfortune/shots';

if (!fs.existsSync(P8)) { console.error(`❌ ASC 키 없음: ${P8}`); process.exit(1); }

/** ES256 JWT — `dsaEncoding:'ieee-p1363'` 필수(기본 DER 이면 401). */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const t0 = Math.floor(Date.now() / 1000);
const head = `${b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })}.${b64({ iss: ISSUER, iat: t0, exp: t0 + 1200, aud: 'appstoreconnect-v1' })}`;
const JWT = `${head}.${crypto.createSign('SHA256').update(head).sign({ key: fs.readFileSync(P8, 'utf8'), dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;

/** GET 한 번 — 네트워크는 기본 타임아웃이 없다(20초로 못박는다). */
async function api(pathname) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20_000);
  try {
    const r = await fetch(`https://api.appstoreconnect.apple.com${pathname}`,
      { headers: { Authorization: `Bearer ${JWT}` }, signal: ac.signal });
    if (!r.ok) { console.error(`  ⚠️ ${pathname} → ${r.status} ${(await r.text()).slice(0, 200)}`); return null; }
    return await r.json();
  } catch (e) { console.error(`  ⚠️ ${pathname} → ${e.message}`); return null; }
  finally { clearTimeout(timer); }
}

const kst = (iso) => (iso ? new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }) : '—');
const line = (s = '') => console.log(s);

// ── 1. 앱 기본 + 버전 상태 ────────────────────────────────────────────────
const app = await api(`/v1/apps/${APP_ID}`);
line(`\n🍎 ${app?.data?.attributes?.name} (${app?.data?.attributes?.bundleId}) · ${app?.data?.attributes?.primaryLocale}`);

const versions = await api(`/v1/apps/${APP_ID}/appStoreVersions?limit=5&include=build`);
line('\n── 버전 상태 ──────────────────────────────────────────────');
const builds = Object.fromEntries((versions?.included ?? []).map((b) => [b.id, b.attributes?.version]));
for (const v of versions?.data ?? []) {
  const a = v.attributes;
  line(`  ${a.versionString.padEnd(8)} ${String(a.appStoreState).padEnd(24)} 빌드 ${builds[v.relationships?.build?.data?.id] ?? '(없음)'}  생성 ${kst(a.createdDate)}`);
}
const cur = versions?.data?.[0];
if (!cur) { console.error('❌ 버전을 못 읽었다'); process.exit(1); }
line(`\n▶ 점검 대상 = ${cur.attributes.versionString} (${cur.attributes.appStoreState}) · 릴리스 ${cur.attributes.releaseType}`);

// ── 2. 심사 정보(데모 계정·연락처·노트) ──────────────────────────────────
const rd = await api(`/v1/appStoreVersions/${cur.id}/appStoreReviewDetail`);
line('\n── 심사 정보(App Review Information) ─────────────────────');
if (!rd?.data) line('  (없음)');
else {
  const a = rd.data.attributes;
  line(`  데모 계정 필요: ${a.demoAccountRequired}`);
  line(`  데모 ID  : ${a.demoAccountName || '❌ 비어 있음'}`);
  line(`  데모 PW  : ${a.demoAccountPassword ? '(설정됨)' : '❌ 비어 있음'}`);
  line(`  연락처   : ${a.contactFirstName ?? ''} ${a.contactLastName ?? ''} · ${a.contactEmail ?? ''} · ${a.contactPhone ?? ''}`);
  line(`  노트 길이: ${(a.notes || '').length}자`);
  line('  ── 노트 원문 ──');
  line((a.notes || '(비어 있음)').split('\n').map((l) => `    ${l}`).join('\n'));
}

// ── 3. 스토어 문구(설명·키워드·프로모·새소식) ────────────────────────────
const locs = await api(`/v1/appStoreVersions/${cur.id}/appStoreVersionLocalizations`);
line('\n── 스토어 문구 ────────────────────────────────────────────');
for (const l of locs?.data ?? []) {
  const a = l.attributes;
  line(`\n  [${a.locale}]`);
  line(`   키워드(${(a.keywords || '').length}/100): ${a.keywords || '(없음)'}`);
  line(`   프로모: ${(a.promotionalText || '(없음)').slice(0, 170)}`);
  line(`   새소식: ${(a.whatsNew || '(없음)').slice(0, 200)}`);
  line(`   설명(${(a.description || '').length}자):`);
  line((a.description || '(없음)').split('\n').map((x) => `     ${x}`).join('\n'));
  line(`   지원URL: ${a.supportUrl} · 마케팅URL: ${a.marketingUrl || '(없음)'}`);
}

// ── 4. 스크린샷 ───────────────────────────────────────────────────────────
line('\n── 스크린샷 ───────────────────────────────────────────────');
if (WANT_SHOTS) fs.mkdirSync(SHOT_DIR, { recursive: true });
for (const l of locs?.data ?? []) {
  const sets = await api(`/v1/appStoreVersionLocalizations/${l.id}/appScreenshotSets`);
  for (const s of sets?.data ?? []) {
    const type = s.attributes.screenshotDisplayType;
    const shots = await api(`/v1/appScreenshotSets/${s.id}/appScreenshots`);
    line(`  [${l.attributes.locale}] ${type} — ${shots?.data?.length ?? 0}장`);
    let i = 0;
    for (const sc of shots?.data ?? []) {
      i++;
      const a = sc.attributes;
      const st = a.assetDeliveryState?.state;
      line(`     ${String(i).padStart(2)}. ${a.fileName} ${a.imageAsset ? `${a.imageAsset.width}×${a.imageAsset.height}` : ''} ${st === 'COMPLETE' ? '' : `[${st}]`}`);
      if (WANT_SHOTS && a.imageAsset?.templateUrl) {
        // templateUrl = `…/{w}x{h}bb.{f}` — 자리표시자를 실제 값으로 바꿔야 받아진다
        const url = a.imageAsset.templateUrl
          .replace('{w}', a.imageAsset.width).replace('{h}', a.imageAsset.height).replace('{f}', 'png');
        const dest = path.join(SHOT_DIR, `${l.attributes.locale}_${type}_${String(i).padStart(2, '0')}.png`);
        try {
          const r = await fetch(url);
          if (r.ok) { fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); line(`         ↳ ${dest}`); }
          else line(`         ↳ 다운로드 실패 ${r.status}`);
        } catch (e) { line(`         ↳ 다운로드 실패 ${e.message}`); }
      }
    }
  }
}

// ── 5. 연령 등급 ─────────────────────────────────────────────────────────
const infos = await api(`/v1/apps/${APP_ID}/appInfos?include=ageRatingDeclaration,appInfoLocalizations`);
line('\n── 앱 정보 / 연령 등급 ────────────────────────────────────');
for (const inc of infos?.included ?? []) {
  if (inc.type === 'appInfoLocalizations') {
    const a = inc.attributes;
    line(`  [${a.locale}] 이름 "${a.name}" · 부제 "${a.subtitle || '(없음)'}"`);
    line(`      개인정보 URL: ${a.privacyPolicyUrl || '(없음)'}`);
  }
  if (inc.type === 'ageRatingDeclarations') {
    const a = inc.attributes;
    const on = Object.entries(a).filter(([, v]) => v && v !== 'NONE' && v !== false);
    line(`  연령등급 선언: ${on.length ? on.map(([k, v]) => `${k}=${v}`).join(' · ') : '전부 없음/NONE'}`);
  }
}
for (const i of infos?.data ?? []) {
  line(`  앱정보 상태: ${i.attributes?.appStoreState} · 등급 ${i.attributes?.brazilAgeRating ?? ''}`);
}

line('\n※ 이 스크립트는 GET 만 한다 — 값 수정은 콘솔에서 Boss 가.\n');
