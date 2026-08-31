#!/usr/bin/env node
// scripts/verify-release.mjs — 배포가 **정말 도달했는지** 세 면을 조회한다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (2026-08-31 사고)
//   vc140~145 를 «플레이스토어에 올렸다» 고 보고했는데 **트랙은 139 에 멈춰 있었다.**
//   업로드 스크립트는 정직하게 `exit 1` 을 냈다 — **내가 종료코드를 안 읽었다.**
//   원인은 구글의 새 요구(사진 권한 선언)였고, 그 403 은 `commit` 단계에서만 났다.
//   ⇒ ★«올렸다» 는 명령의 결과가 아니라 **가게에 가서 확인한 값**이어야 한다.
//
// 무엇을 조회하나 (전부 **읽기 전용**)
//   ① 웹  — 실제 URL 의 번들 해시가 `app/dist` 의 것과 같은가
//   ② Play — internal·alpha 트랙의 versionCode 가 `APP_BUILD` 와 같은가
//   ③ iOS — (조회 불가) TestFlight 는 처리 지연이 있어 여기서 단정하지 않는다
//
// 실행: npm run verify:release
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB_URL = 'https://niwoon2.pages.dev/';
const PKG = 'com.syncfortune.app';
const SA_PATH = process.env.PLAY_SA_JSON || `${os.homedir()}/.playconsole/service-account.json`;

const rows = [];
const add = (surface, ok, detail) => rows.push({ surface, ok, detail });

/** 로컬 빌드번호(단일 출처). */
function localBuild() {
  const js = fs.readFileSync(path.join(ROOT, 'app/src/lib/core/buildInfo.ts'), 'utf8');
  const m = /export const APP_BUILD\s*=\s*(\d+)/.exec(js);
  return m ? Number(m[1]) : null;
}

// ── ① 웹 ────────────────────────────────────────────────────────────────────
async function checkWeb() {
  const dir = path.join(ROOT, 'app/dist/_expo/static/js/web');
  let local = null;
  try { local = fs.readdirSync(dir).find((f) => f.startsWith('entry-')) ?? null; } catch { /* 내보내기 전 */ }
  if (!local) { add('웹', null, 'app/dist 가 없다 — 이번에 웹을 안 내보냈다면 정상'); return; }
  try {
    const html = await fetch(WEB_URL, { cache: 'no-store' }).then((r) => r.text());
    const live = (html.match(/entry-[a-f0-9]+\.js/) ?? [])[0] ?? null;
    add('웹', live === local, live === local ? `번들 ${local}` : `살아 있는 것=${live} · 내 것=${local}`);
  } catch (e) {
    add('웹', false, `조회 실패 ${String(e?.message ?? e)}`);
  }
}

// ── ② Play ──────────────────────────────────────────────────────────────────
function b64url(b) { return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

async function playToken(sa) {
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
  if (!r.ok) throw new Error(`토큰 발급 실패: ${JSON.stringify(j)}`);
  return j.access_token;
}

async function checkPlay(build) {
  if (!fs.existsSync(SA_PATH)) { add('Play', null, `서비스 계정 키 없음(${SA_PATH}) — 조회 못 함`); return; }
  try {
    const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
    const tok = await playToken(sa);
    const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
    const ed = await fetch(`${base}/edits`, { method: 'POST', headers: { Authorization: `Bearer ${tok}` } }).then((r) => r.json());
    for (const track of ['internal', 'alpha']) {
      const t = await fetch(`${base}/edits/${ed.id}/tracks/${track}`, { headers: { Authorization: `Bearer ${tok}` } }).then((r) => r.json());
      // ★★`status: completed` 는 «편집 세션의 상태» 지 «테스터에게 도달» 이 아니다 —
      //    그래서 versionCode 를 **숫자로** 비교한다(2026-08-09 교훈).
      const codes = (t?.releases ?? []).flatMap((r) => r.versionCodes ?? []).map(Number);
      const top = codes.length ? Math.max(...codes) : null;
      add(`Play ${track}`, top === build, top === null ? '릴리스 없음' : `트랙 ${top} · 내 빌드 ${build}`);
    }
    // 편집 세션은 커밋하지 않는다(읽기 전용) — 그냥 버린다
    await fetch(`${base}/edits/${ed.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } }).catch(() => {});
  } catch (e) {
    add('Play', false, `조회 실패 ${String(e?.message ?? e)}`);
  }
}

// ── 실행 ────────────────────────────────────────────────────────────────────
const build = localBuild();
console.log(`\n🔎 배포 도달 확인 — 내 빌드번호 ${build ?? '?'}\n`);
await checkWeb();
if (build) await checkPlay(build);
add('iOS', null, 'TestFlight 는 처리 지연이 있어 여기서 단정하지 않는다(ASC 에서 확인)');

let bad = 0;
for (const r of rows) {
  const mark = r.ok === true ? '✅' : r.ok === false ? '❌' : '⏸';
  if (r.ok === false) bad++;
  console.log(`  ${mark} ${r.surface.padEnd(14)} ${r.detail}`);
}
console.log('');
if (bad) {
  console.error(`❌ ${bad}개 면이 아직 도달하지 않았다 — «올렸다» 고 말하지 말 것.\n`);
  process.exit(1);
}
console.log('✅ 조회한 면은 모두 도달했다\n');
