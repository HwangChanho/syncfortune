// scripts/play-listing.mjs — Play 스토어 등록정보(제목·짧은 설명·전체 설명) 조회/수정
// ═══════════════════════════════════════════════════════════════════════════
// 왜: Play 는 앱 제목 **바로 아래**에 「짧은 설명(80자)」이 붙는다 — 사실상 광고 한 줄이다.
//   Boss 2026-08-15: *"니운내운 타이틀 아래에 사주와 자미두수를 결합한 복합적인 해석 서비스라는
//   광고문구가 들어가야 할 것 같아"* → 그 자리가 바로 여기다.
//   ★App Store 부제와 달리 **Play 에는 4.3(b) 같은 포화 조항이 없다** → 여기서는 이 문구를 그대로 쓴다.
//
// 안전장치: 바꾸기 전 현재 값을 백업 출력하고, PATCH 후 **다시 GET** 해서 저장값을 찍는다.
// 실행: node scripts/play-listing.mjs            (조회)
//       node scripts/play-listing.mjs --apply    (반영)
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';

const PKG = 'com.syncfortune.app';
const LANG = 'ko-KR';
const SA_PATH = process.env.PLAY_SA_JSON || `${os.homedir()}/.playconsole/service-account.json`;
const APPLY = process.argv.includes('--apply');
const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;

/** 제목 바로 아래 한 줄(80자). 이 자리가 광고 문구다. */
const SHORT = '사주와 자미두수를 결합한 복합적인 해석 서비스 — 나와 내 사람들을 함께 봅니다';

if (!fs.existsSync(SA_PATH)) { console.error(`❌ 서비스 계정 없음: ${SA_PATH}`); process.exit(1); }
const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));

/** 서비스 계정 → OAuth 액세스 토큰(play-upload.js 와 동일 방식). */
async function accessToken() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const data = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claim)}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(data), sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${data}.${sig}` }),
  });
  const j = await r.json();
  if (!j.access_token) { console.error('❌ 토큰 실패', j); process.exit(1); }
  return j.access_token;
}

const token = await accessToken();
const api = async (method, p, body) => {
  const r = await fetch(`${BASE}${p}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const t = await r.text();
  if (!r.ok) { console.error(`❌ ${method} ${p} → ${r.status}\n${t.slice(0, 400)}`); process.exit(1); }
  return t ? JSON.parse(t) : {};
};

// ── 편집 세션 ────────────────────────────────────────────────────────────────
const edit = await api('POST', '/edits');
const cur = await api('GET', `/edits/${edit.id}/listings/${LANG}`);
console.log(`\n📱 Play 등록정보 (${LANG})`);
console.log(`  제목      : ${cur.title}`);
console.log(`  짧은 설명 : ${cur.shortDescription || '(없음)'}  [${[...(cur.shortDescription || '')].length}/80]`);
console.log(`  전체 설명 : ${[...(cur.fullDescription || '')].length}자`);
console.log(`\n  ▶ 바꿀 짧은 설명: ${SHORT}  [${[...SHORT].length}/80]`);
if ([...SHORT].length > 80) { console.error('❌ 80자 초과'); process.exit(1); }

if (!APPLY) { console.log('\n(조회만 — 반영하려면 --apply)'); process.exit(0); }

fs.writeFileSync('docs/release/play-listing-backup.json', JSON.stringify({ savedAt: new Date().toISOString(), ...cur }, null, 2));
await api('PATCH', `/edits/${edit.id}/listings/${LANG}`, { language: LANG, shortDescription: SHORT });
await api('POST', `/edits/${edit.id}:commit`);

// ── 검증: 새 편집 세션으로 다시 읽는다(커밋된 값인지 확인) ───────────────────
const e2 = await api('POST', '/edits');
const after = await api('GET', `/edits/${e2.id}/listings/${LANG}`);
console.log('\n── 반영 후 실측 ──');
console.log(`  짧은 설명 : ${after.shortDescription}  ${after.shortDescription === SHORT ? '✅' : '❌ 불일치'}`);
