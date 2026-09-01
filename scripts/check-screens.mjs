// scripts/check-screens.mjs — **화면이 실제로 그려지는지** 배포 전에 본다
// ═══════════════════════════════════════════════════════════════════════════
// ★2026-09-02 사고의 구조적 원인 (Boss *"다시는 이런일 없어야 하지 않을까?"*)
//
//   실측해 보니 이랬다:
//     · preflight = **165단계**, 전부 **소스를 읽는** 검사
//     · 화면을 실제로 그려 보는 하네스는 `sweep:web` **하나뿐**
//     · 그런데 그 하나가 **preflight 에 없었다**
//   ⇒ 「preflight 1367 ✅」 이 «화면이 열린다» 를 **한 번도 보장한 적이 없다.**
//      그 초록불을 보고 만세력이 죽은 채로 **vc156·157 두 번** 출시됐다.
//   ⇒ 게다가 `sweep:web` 은 **이미 배포된 웹**을 본다 — 잡아도 «이미 나간 뒤» 다.
//
// ■ 그래서 이것을 만든다: **로컬 산출물**을 띄워 **배포 전에** 화면을 그려 본다.
//     ① 산출물이 소스보다 낡았으면 다시 빌드한다(낡은 것을 재면 거짓 초록불이다)
//     ② `serve-web.mjs` 로 SPA 폴백과 함께 띄운다
//     ③ `sweep-web.mjs` 를 **localhost** 로 돌린다(명식을 심고 도는 그 스윕)
//   ⇒ 이제 preflight 가 «코드가 말이 되나» 뿐 아니라 **«화면이 열리나»** 까지 본다.
//
// ⚠️느리다(웹 빌드가 붙는다). 그래도 **죽은 화면을 두 번 출시한 값**보다 싸다.
//   급할 때 건너뛰려면 `SKIP_SCREENS=1` — ★그러면 이 검사는 **큰 소리로 건너뛰었다고** 말한다.
// ═══════════════════════════════════════════════════════════════════════════
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'app/dist');
const PORT = 8901;

if (process.env.SKIP_SCREENS === '1') {
  console.log('⏭  check:screens 건너뜀 — SKIP_SCREENS=1. **화면은 안 쟀다.**');
  process.exit(0);
}

/** 가장 최근에 고쳐진 소스 시각(ms) — 산출물이 이보다 낡았으면 다시 빌드한다. */
function newestSource(dir, best = 0) {
  let es; try { es = readdirSync(dir, { withFileTypes: true }); } catch { return best; }
  for (const e of es) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) best = newestSource(p, best);
    else if (/\.(ts|tsx|json)$/.test(e.name)) { const m = statSync(p).mtimeMs; if (m > best) best = m; }
  }
  return best;
}

const distAt = existsSync(join(DIST, 'index.html')) ? statSync(join(DIST, 'index.html')).mtimeMs : 0;
const srcAt = Math.max(newestSource(join(ROOT, 'app/src')), newestSource(join(ROOT, 'engine')));
if (distAt < srcAt) {
  console.log('   산출물이 소스보다 낡았다 → 다시 빌드한다(낡은 것을 재면 거짓 초록불이다)');
  const b = spawnSync('npm', ['run', 'build:web'], { cwd: ROOT, stdio: 'ignore' });
  if (b.status !== 0) { console.error('❌ check:screens — 웹 빌드 실패. **화면을 못 쟀다.**'); process.exit(1); }
} else {
  console.log('   산출물이 소스보다 새것이다 → 그대로 쓴다');
}

const srv = spawn('node', ['scripts/serve-web.mjs', String(PORT), DIST], { cwd: ROOT, stdio: 'ignore' });   // ★세 번째 인자 = 띄울 폴더(기본값은 /tmp 라 반드시 넘긴다)
const stop = () => { try { srv.kill(); } catch { /* 이미 죽었다 */ } };
process.on('exit', stop); process.on('SIGINT', () => { stop(); process.exit(130); });

// 서버가 뜰 때까지 기다린다(최대 10초)
let up = false;
for (let i = 0; i < 40; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/`); if (r.ok) { up = true; break; } } catch { /* 아직 */ }
  await new Promise((r) => setTimeout(r, 250));
}
if (!up) { stop(); console.error(`❌ check:screens — 로컬 서버가 안 떴다(:${PORT}). **화면을 못 쟀다.**`); process.exit(1); }

const sw = spawnSync('node', ['scripts/sweep-web.mjs'], {
  cwd: ROOT, stdio: 'inherit', env: { ...process.env, SWEEP_BASE: `http://127.0.0.1:${PORT}` },
});
stop();
if (sw.status !== 0) {
  console.error('\n❌ check:screens — **화면이 안 그려지는 곳이 있다**(위 목록). 배포하지 말 것.');
  process.exit(1);
}
console.log('✅ check:screens — 배포 전 로컬 산출물에서 전 화면이 그려진다');
