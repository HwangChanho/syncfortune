#!/usr/bin/env node
// scripts/play-upload.mjs — AAB 를 Play 에 올린다 (**성공을 사칭하지 않는다**)
// ═══════════════════════════════════════════════════════════════════════════
// ★★2026-08-31 사고를 그대로 겨냥해 만든다
//   vc140~145 를 «플레이스토어에 올렸다» 고 보고했는데 **트랙은 139 에 멈춰 있었다.**
//   · 업로드(`uploads`)와 트랙 배정(`tracks`)은 **성공**한다 — 화면에 ✅ 가 둘 찍힌다.
//   · 그런데 **`commit` 만 403** 이 난다(그때는 구글의 새 사진 권한 요구 때문).
//   ⇒ **«업로드 성공» 뒤에 터지므로 성공처럼 읽힌다.** 이것이 그 사고의 본체다.
//
// 그래서 이 스크립트는:
//   ① 단계마다 **HTTP 코드를 찍는다** — 어디서 죽었는지 로그만 봐도 안다
//   ② commit 이 실패하면 **`exit 1`** — 파이프에 태우지 말 것
//   ③ 끝나고 **트랙을 다시 조회**해 versionCode 를 눈으로 확인시킨다
//      (★`status: completed` 는 «편집 세션 상태» 지 «도달» 이 아니다 — 숫자로 본다)
//   ④ 실패하면 편집 세션을 **버린다**(반쯤 만든 edit 이 다음 시도를 막지 않게)
//
// 쓰기: node scripts/play-upload.mjs [트랙]      기본 internal
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG = 'com.syncfortune.app';
const SA_PATH = process.env.PLAY_SA_JSON || `${os.homedir()}/.playconsole/service-account.json`;
const TRACK = process.argv[2] || 'internal';
const AAB = path.join(ROOT, 'app/android/app/build/outputs/bundle/release/app-release.aab');

const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function token(sa) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sig = b64url(crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), sa.private_key));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${body}.${sig}` }),
  });
  const j = await r.json();
  if (!r.ok) { console.error(`❌ 토큰 발급 실패 ${r.status}: ${JSON.stringify(j).slice(0, 300)}`); process.exit(1); }
  return j.access_token;
}

/** 응답을 **코드까지** 찍는다 — 어디서 죽었는지 로그만 봐도 알게. */
async function step(label, res) {
  const txt = await res.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { /* 본문이 JSON 이 아닐 수 있다 */ }
  const ok = res.ok;
  console.log(`  ${ok ? '✅' : '❌'} ${label} → HTTP ${res.status}`);
  if (!ok) console.error(`     ${txt.slice(0, 400)}`);
  return { ok, status: res.status, json: j, text: txt };
}

if (!fs.existsSync(SA_PATH)) { console.error(`❌ 서비스 계정 키 없음: ${SA_PATH}`); process.exit(1); }
if (!fs.existsSync(AAB)) { console.error(`❌ AAB 없음: ${AAB}\n   먼저 \`npm run build:android\` 를 돌리십시오.`); process.exit(1); }

// ★산출물이 **이번 것**인지 본다(옛 AAB 를 올려 구버전을 배포한 이력이 있다)
const st = fs.statSync(AAB);
const ageMin = Math.round((Date.now() - st.mtimeMs) / 60000);
const gradle = fs.readFileSync(path.join(ROOT, 'app/android/app/build.gradle'), 'utf8');
const myCode = Number((/versionCode\s+(\d+)/.exec(gradle) ?? [])[1]);
console.log(`📦 AAB ${(st.size / 1e6).toFixed(1)}MB · ${ageMin}분 전 · build.gradle versionCode ${myCode}`);
if (ageMin > 180) console.log('   ⚠️세 시간 넘은 산출물입니다 — 이번 빌드가 맞는지 확인하십시오.');

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
const tok = await token(sa);
const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
const H = { Authorization: `Bearer ${tok}` };

const ed = await step('편집 세션 열기', await fetch(`${base}/edits`, { method: 'POST', headers: H }));
if (!ed.ok) process.exit(1);
const EID = ed.json.id;

/** 실패하면 편집 세션을 버리고 종료 — 반쯤 만든 edit 이 다음 시도를 막지 않게. */
async function bail(code = 1) {
  await fetch(`${base}/edits/${EID}`, { method: 'DELETE', headers: H }).catch(() => {});
  console.error('\n❌ 올리지 못했습니다 — **«올렸다» 고 말하지 마십시오.**');
  process.exit(code);
}

/**
 * ★★같은 versionCode 는 **두 번 못 올린다**(`403 Version code N has already been used`).
 *   두 트랙(internal·alpha)에 같은 빌드를 넣으려면 **올리는 건 한 번**이고
 *   나머지는 **이미 올라간 것을 트랙에 배정**만 하면 된다.
 *   ⚠️이걸 모르면 두 번째 트랙에서 403 을 보고 «권한 문제» 로 오해한다(2026-09-01 실측).
 */
const already = await fetch(`${base}/edits/${EID}/bundles`, { headers: H }).then((r) => r.json()).catch(() => null);
const have = (already?.bundles ?? []).map((b) => Number(b.versionCode));
const up = have.includes(myCode)
  ? (console.log(`  ✅ 이미 올라가 있는 versionCode ${myCode} — 업로드는 건너뛰고 트랙에만 배정한다`),
     { ok: true, json: { versionCode: myCode } })
  : await step('AAB 업로드', await fetch(
  `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PKG}/edits/${EID}/bundles?uploadType=media`,
  { method: 'POST', headers: { ...H, 'Content-Type': 'application/octet-stream' }, body: fs.readFileSync(AAB) },
));
if (!up.ok) await bail();
const code = Number(up.json?.versionCode);
console.log(`     올라간 versionCode = ${code}`);
if (code !== myCode) console.log(`     ⚠️build.gradle(${myCode}) 과 다릅니다 — 옛 AAB 일 수 있습니다.`);

const tr = await step(`트랙 배정(${TRACK})`, await fetch(`${base}/edits/${EID}/tracks/${TRACK}`, {
  method: 'PUT', headers: { ...H, 'Content-Type': 'application/json' },
  body: JSON.stringify({ track: TRACK, releases: [{ status: 'completed', versionCodes: [String(code)] }] }),
}));
if (!tr.ok) await bail();

// ★★여기가 **터지던 자리**다 — 위 둘이 ✅ 라도 여기서 403 이 날 수 있다.
const cm = await step('commit (★여기가 2026-08-31 에 403 이 나던 자리)',
  await fetch(`${base}/edits/${EID}:commit`, { method: 'POST', headers: H }));
if (!cm.ok) {
  console.error('\n★이 403 은 대개 **구글이 새로 요구하는 선언**(권한·데이터 안전) 때문입니다.');
  console.error('  Play Console 화면에서 요구 사항을 채운 뒤 다시 시도하십시오.');
  await bail();
}

// ── 끝나고 **다시 조회**해서 도달을 눈으로 확인시킨다 ──────────────────────
const ed2 = await fetch(`${base}/edits`, { method: 'POST', headers: H }).then((r) => r.json());
const t2 = await fetch(`${base}/edits/${ed2.id}/tracks/${TRACK}`, { headers: H }).then((r) => r.json());
const codes = (t2?.releases ?? []).flatMap((r) => r.versionCodes ?? []).map(Number);
const top = codes.length ? Math.max(...codes) : null;
await fetch(`${base}/edits/${ed2.id}`, { method: 'DELETE', headers: H }).catch(() => {});

console.log(`\n🔎 다시 조회한 ${TRACK} 트랙 = ${top ?? '(릴리스 없음)'}`);
if (top !== code) {
  console.error(`❌ 올린 것(${code}) 과 트랙(${top}) 이 다릅니다 — 도달하지 않았습니다.`);
  process.exit(1);
}
console.log(`✅ Play ${TRACK} 도달 확인 — versionCode ${code}`);
console.log('   ⚠️테스터에게 보이는 것은 **관리형 게시** 설정에 달려 있습니다(콘솔의 «최근 게시일» 을 보십시오).');
