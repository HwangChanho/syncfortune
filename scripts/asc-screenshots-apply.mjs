// scripts/asc-screenshots-apply.mjs — App Store 스크린샷 6장을 **교체한다**
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️쓰기 스크립트(기존 스크린샷 삭제 + 새 업로드). 심사 제출(submit)은 하지 않는다.
//
// 왜: 올라가 있던 6장이 하단에 **`팔자 八字`**(옛 브랜드)를 달고 있었고 감청·골드였다.
//   앱 이름은 **니운내운**, 앱 화면은 08-10 부터 **라벤더**다. 심사자가 가장 먼저 보는 것이
//   앱과 다른 그림이면 그 자체로 문제(2.3.3)이고, 4.3(b) 판단도 여기서 굳는다.
//
// 안전장치
//   · 지우기 전에 **원본을 내려받아 repo 에 백업**한다(`docs/release/screenshots-live-backup/`).
//   · 업로드는 예약(POST) → 조각 전송(uploadOperations) → 커밋(PATCH uploaded:true + md5) 3단.
//     ★커밋 단계의 `sourceFileChecksum` 이 틀리면 Apple 이 조용히 `FAILED` 로 둔다 → 마지막에 상태를 확인한다.
//   · 순서는 업로드 순이 아니라 **관계 PATCH** 로 못박는다(1~2번이 관계 지도여야 한다).
//
// 실행: node scripts/asc-screenshots-apply.mjs            (미리보기)
//       node scripts/asc-screenshots-apply.mjs --apply    (교체)
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KEY_ID = 'L7GWWF9WVF';
const ISSUER = process.env.ASC_ISSUER_ID || '5f89581a-d0c6-46c2-9461-78d5c08448fa';
const P8 = `${os.homedir()}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`;
const APP_ID = '6779321930';
const APPLY = process.argv.includes('--apply');

const SRC_DIR = 'docs/release/screenshots-2026-08';
const BACKUP_DIR = 'docs/release/screenshots-live-backup';
const LOCALE = 'ko';
const DISPLAY = 'APP_IPHONE_65';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const t0 = Math.floor(Date.now() / 1000);
// ⚠️exp 는 **20분(1200초)을 넘기면 안 된다** — 넘기면 Apple 이 401 NOT_AUTHORIZED 를 준다.
//   여기서 3600 을 줬다가 그대로 물렸다(토큰이 아니라 '만료 정책'이 문제였다).
const head = `${b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })}.${b64({ iss: ISSUER, iat: t0, exp: t0 + 1200, aud: 'appstoreconnect-v1' })}`;
const JWT = `${head}.${crypto.createSign('SHA256').update(head).sign({ key: fs.readFileSync(P8, 'utf8'), dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;

async function api(method, p, body) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${p}`, {
    method,
    headers: { Authorization: `Bearer ${JWT}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await r.text();
  if (!r.ok) { console.error(`❌ ${method} ${p} → ${r.status}\n${text.slice(0, 400)}`); process.exit(1); }
  return text ? JSON.parse(text) : {};
}

// ── 대상 세트 찾기 ──────────────────────────────────────────────────────────
const ver = (await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=1`)).data[0];
const vLoc = (await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`)).data.find((l) => l.attributes.locale === LOCALE);
const sets = (await api('GET', `/v1/appStoreVersionLocalizations/${vLoc.id}/appScreenshotSets`)).data;
const set = sets.find((s) => s.attributes.screenshotDisplayType === DISPLAY);
if (!set) { console.error(`❌ ${DISPLAY} 세트가 없다`); process.exit(1); }
const existing = (await api('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`)).data;
console.log(`버전 ${ver.attributes.versionString} (${ver.attributes.appStoreState}) · ${LOCALE}/${DISPLAY} · 기존 ${existing.length}장`);
for (const s of existing) console.log(`   - ${s.attributes.fileName} ${s.attributes.assetDeliveryState?.state ?? ''}`);

const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.png')).sort();
console.log(`\n새 파일 ${files.length}장: ${files.join(', ')}`);
if (files.length !== 6) { console.error('❌ 6장이 아니다'); process.exit(1); }

if (!APPLY) { console.log('\n(미리보기 — 아무것도 바꾸지 않았다. 교체하려면 --apply)'); process.exit(0); }

// ── 1) 기존 원본 백업(지우기 전에) ──────────────────────────────────────────
fs.mkdirSync(BACKUP_DIR, { recursive: true });
for (const s of existing) {
  const a = s.attributes;
  if (!a.imageAsset?.templateUrl) continue;
  const url = a.imageAsset.templateUrl.replace('{w}', a.imageAsset.width).replace('{h}', a.imageAsset.height).replace('{f}', 'png');
  const r = await fetch(url);
  if (r.ok) {
    fs.writeFileSync(path.join(BACKUP_DIR, a.fileName), Buffer.from(await r.arrayBuffer()));
    console.log(`  백업 ${a.fileName}`);
  } else console.log(`  ⚠️백업 실패 ${a.fileName} (${r.status})`);
}

// ── 2) 기존 삭제 ────────────────────────────────────────────────────────────
for (const s of existing) { await api('DELETE', `/v1/appScreenshots/${s.id}`); console.log(`  삭제 ${s.attributes.fileName}`); }

// ── 3) 새 6장 업로드 ────────────────────────────────────────────────────────
const uploaded = [];
for (const f of files) {
  const buf = fs.readFileSync(path.join(SRC_DIR, f));
  const reserved = await api('POST', '/v1/appScreenshots', {
    data: {
      type: 'appScreenshots',
      attributes: { fileSize: buf.length, fileName: `wooni-ko-65-${f}` },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } },
    },
  });
  const id = reserved.data.id;
  // 조각 전송 — Apple 이 준 오퍼레이션을 그대로 따른다(보통 1개지만 여러 개일 수 있다)
  for (const op of reserved.data.attributes.uploadOperations ?? []) {
    const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
    const r = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
    if (!r.ok) { console.error(`❌ 업로드 실패 ${f} → ${r.status}`); process.exit(1); }
  }
  // 커밋 — ★체크섬이 틀리면 Apple 이 조용히 FAILED 로 둔다
  const md5 = crypto.createHash('md5').update(buf).digest('hex');
  await api('PATCH', `/v1/appScreenshots/${id}`, {
    data: { type: 'appScreenshots', id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
  });
  uploaded.push(id);
  console.log(`  올림 ${f} (${buf.length} bytes)`);
}

// ── 4) 순서 못박기 — 1~2번이 관계 지도여야 한다 ─────────────────────────────
await api('PATCH', `/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, {
  data: uploaded.map((id) => ({ type: 'appScreenshots', id })),
});

// ── 5) 검증 — 상태가 COMPLETE 인지까지 본다 ─────────────────────────────────
const after = (await api('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`)).data;
console.log('\n── 반영 후 실측 ──');
let bad = 0;
after.forEach((s, i) => {
  const a = s.attributes;
  const st = a.assetDeliveryState?.state;
  if (st !== 'COMPLETE') bad++;
  console.log(`  ${String(i + 1).padStart(2)}. ${a.fileName} ${a.imageAsset ? `${a.imageAsset.width}×${a.imageAsset.height}` : ''} ${st === 'COMPLETE' ? '✅' : `❌ ${st}`}`);
});
console.log(bad ? `\n⚠️ ${bad}장이 아직 처리 중이거나 실패다 — 잠시 후 asc-review.mjs 로 다시 확인할 것`
                : '\n✅ 6장 교체 완료 · 심사 제출(Submit)은 하지 않았다(Boss 몫)');
