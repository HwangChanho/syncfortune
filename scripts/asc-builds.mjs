// scripts/asc-builds.mjs — TestFlight 빌드 목록 실측 (App Store Connect API · 읽기 전용)
// ═══════════════════════════════════════════════════════════════════════════
// 왜 필요한가:
//   `app/fastlane/report.xml` 은 **lane 이 끝날 때** 쓰이므로 "끝까지 갔다"는 것만 말해 주고
//   **Apple 이 그 바이너리를 받았는지**는 말해 주지 않는다. 실제로 그 차이를 오판해 "성공"이라
//   보고한 적이 있다(2026-08-06). ⇒ 빌드 판정의 정본은 **여기(ASC 조회)** 다.
//
// ★★타임존 함정(2026-08-10 실제 오판):
//   `uploadedDate` 는 `2026-08-08T13:27:12**-07:00**` 형식이다 — **미국 서부(PDT)** 시각이다.
//   문자열을 `.slice(0,19)` 로 잘라 쓰면 타임존이 사라져 **UTC 처럼 읽힌다.**
//   그래서 KST 08-09 05:27 에 올라간 빌드를 "08-08 것"으로 보고, 어제 빌드가 업로드에 실패한
//   줄 알았다(실제로는 정상이었다). ⇒ 여기서는 **반드시 Date 로 파싱해 KST 로 변환**한다.
//   (CLAUDE.md §5.5 — API 응답 필드의 의미를 넘겨짚지 말 것.)
//
// ★빌드번호는 분 단위 epoch(`Time.now.to_i/60`)라 **번호만으로 시작 시각을 복원**할 수 있다.
//   그래서 "이번에 돌린 빌드가 맞는지"를 업로드 시각과 별개로 대조할 수 있다.
//
// 실행: npm run asc:builds            (기본 8건)
//       npm run asc:builds -- 20      (건수 지정)
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';

const KEY_ID = 'L7GWWF9WVF';
const ISSUER = process.env.ASC_ISSUER_ID || '5f89581a-d0c6-46c2-9461-78d5c08448fa';
const P8 = `${os.homedir()}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`;
const APP_ID = '6779321930';
// ⚠️★`--check <빌드번호>` 의 값을 개수로 삼키면 안 된다 — ASC 는 limit 상한이 200 이라
//   `--check 29791782` 가 곧바로 PARAMETER_ERROR 로 죽었다(2026-08-24, 실제로 당함).
const ARGV = process.argv.slice(2);
const CHECK_AT = ARGV.indexOf('--check');
const LIMIT = Number(ARGV.find((a, i) => /^\d+$/.test(a) && i !== CHECK_AT + 1)) || 8;
const TIMEOUT_MS = 20_000;

if (!fs.existsSync(P8)) {
  console.error(`❌ ASC 키가 없습니다: ${P8}`);
  process.exit(1);
}

/** ES256 JWT — `dsaEncoding: 'ieee-p1363'` 이 **필수**다(기본 DER 이면 Apple 이 401 을 준다). */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const payload = `${b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })}.${b64({ iss: ISSUER, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })}`;
const sig = crypto.createSign('SHA256')
  .update(payload)
  .sign({ key: fs.readFileSync(P8, 'utf8'), dsaEncoding: 'ieee-p1363' })
  .toString('base64url');
const JWT = `${payload}.${sig}`;

const ac = new AbortController();
const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);   // 네트워크는 기본 타임아웃이 없다
let j;
try {
  const r = await fetch(
    `https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=${LIMIT}&include=preReleaseVersion`,
    { headers: { Authorization: `Bearer ${JWT}` }, signal: ac.signal },
  );
  if (!r.ok) { console.error('❌ ASC 조회 실패', r.status, (await r.text()).slice(0, 300)); process.exit(1); }
  j = await r.json();
} catch (e) {
  console.error('❌ ASC 조회 실패 —', e.message);
  process.exit(1);
} finally { clearTimeout(timer); }

const kst = (iso) => new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });   // sv-SE = YYYY-MM-DD HH:mm:ss
const vers = Object.fromEntries((j.included ?? []).map((x) => [x.id, x.attributes?.version]));

console.log('\n🍎 TestFlight 빌드 (ASC 실측 · 시각은 전부 KST)\n');
console.log('빌드번호      버전     업로드(KST)           빌드시작(번호에서 복원)  처리상태   만료');
for (const b of j.data) {
  const a = b.attributes;
  const v = vers[b.relationships?.preReleaseVersion?.data?.id] ?? '?';
  // 빌드번호 = 분 epoch → 시작 시각 복원. 업로드와 몇 분 차이가 나는 게 정상(archive+upload 시간).
  const started = /^\d{8}$/.test(String(a.version)) ? kst(new Date(Number(a.version) * 60_000).toISOString()) : '—';
  console.log(
    String(a.version).padEnd(13),
    String(v).padEnd(8),
    kst(a.uploadedDate).padEnd(21),
    started.padEnd(24),
    String(a.processingState ?? '').padEnd(10),
    a.expired ? '만료' : '',
  );
}
console.log('\n※ processingState VALID = Apple 이 바이너리를 받아 처리 완료. report.xml 은 이걸 말해 주지 않는다.\n');

// ── `--check <빌드번호>` — **기계가 읽을 창구** ──────────────────────────────
//   ⚠️★위 표는 **사람 보라고** 만든 것이다. 기계가 `awk` 로 칸을 세게 하면 안 된다 —
//     날짜에 공백이 있어 `processingState` 는 5번째가 아니라 **7번째 칸**이고,
//     실제로 그걸 5번째로 읽은 감시가 45분 내내 "아직"이라고 찍었다(2026-08-24).
//     빌드는 그때 이미 VALID 였다. **거짓 신호가 완료를 덮었다.**
//   ⇒ 판정이 필요하면 이 모드를 쓴다. 그 번호보다 **큰** 빌드가 VALID 면 0, 아니면 1 로 끝난다.
if (CHECK_AT >= 0) {
  const base = Number(ARGV[CHECK_AT + 1] ?? 0);
  const hit = j.data.map((b) => b.attributes)
    .find((a) => Number(a.version) > base && String(a.processingState) === 'VALID');
  if (hit) {
    console.log(`✅ ${hit.version} VALID — 기준선 ${base} 초과. 테스터가 설치할 수 있습니다.`);
    process.exit(0);
  }
  const pend = j.data.map((b) => b.attributes).find((a) => Number(a.version) > base);
  console.log(pend
    ? `⏳ ${pend.version} 업로드됨 · 처리상태 ${pend.processingState}`
    : `⏳ 기준선 ${base} 초과 빌드가 아직 ASC 에 없습니다.`);
  process.exit(1);
}
