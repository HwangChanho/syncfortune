// scripts/check-admin-gate.ts — 관리자 판정 두 갈래 하네스(정적 검사·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 지키는 경계(daniel 2026-07-26 버그에서 나온 규칙):
//   ① **특권/무료통과·소유 판정 = `isAdminActing()`**(is_admin && admin_mode≠false · Edge god 과 동일 규칙)
//      → 관리자 모드를 끄면 일반 계정처럼 동작해야 한다. daniel: "관리자 모드가 꺼져있으면 일반 계정
//        테스트로 잘 되어야지". 여기서 `isAdmin()` 을 쓰면 **클라는 '이미 열려 있음', Edge 는 needPayment**
//        가 되어 "열렸다면서 구매를 요구"하는 모순이 재발한다(자물쇠 반복도 같은 뿌리).
//   ② **관리자 화면 접근 게이트 = `isAdmin()` 유지**
//      → 여기에 admin_mode 를 섞으면 모드를 끈 동안 관리자 화면이 잠겨 **다시 켤 수 없다**(토글이 그 안에 있음).
//
// 검사 방식: 소스 정적 스캔(RN 런타임 불필요).
//   · 결제·소유·게이트 관련 파일에서 `isAdmin()` 직접 호출이 남아 있으면 실패
//   · settings/admin 화면에서 `isAdmin()` 이 사라지면 실패(자기잠금 회귀)
//
// 실행: npm run check:admin-gate
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };

/** 관리자 화면 접근 경로 — isAdmin() 을 반드시 유지해야 하는 파일(자기잠금 방지). */
const ACCESS_GATE_FILES = ['app/src/app/(app)/settings.tsx', 'app/src/app/(app)/admin.tsx'];

// ── ① 특권 경로에 isAdmin() 잔존 금지 ─────────────────────────────────────
{
  const roots = ['app/src/components', 'app/src/app/(app)', 'app/src/screens', 'app/src/lib'];
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e)) files.push(p);
    }
  };
  roots.forEach((r) => { try { walk(r); } catch { /* 없으면 스킵 */ } });

  const offenders: string[] = [];
  for (const f of files) {
    if (f.endsWith('lib/core/admin.ts')) continue;                 // 정의 파일(두 함수 모두 존재해야 정상)
    if (ACCESS_GATE_FILES.some((a) => f.replace(/\\/g, '/').endsWith(a.replace('app/src/', '')))) continue; // 접근 게이트는 ②에서 별도 검사
    const src = readFileSync(f, 'utf8');
    // 주석 제외한 실제 호출만 — 줄 앞이 //· * 로 시작하면 설명문이다.
    const lines = src.split('\n');
    lines.forEach((ln, i) => {
      const t = ln.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
      if (/\bisAdmin\(\)/.test(ln)) offenders.push(`${f}:${i + 1}`);
    });
  }
  if (offenders.length) {
    bad(`특권 경로에 isAdmin() 잔존 ${offenders.length}곳 — isAdminActing() 으로 바꿔야 함(관리자 모드 OFF 시 일반계정처럼):\n     ${offenders.join('\n     ')}`);
  } else {
    console.log('  특권 경로에 isAdmin() 직접 호출 없음 ✓ (전부 isAdminActing)');
  }
}

// ── ② 관리자 화면 접근 게이트는 isAdmin() 유지 ────────────────────────────
{
  for (const f of ACCESS_GATE_FILES) {
    let src = '';
    try { src = readFileSync(f, 'utf8'); } catch { bad(`${f} 를 읽을 수 없음`); continue; }
    if (!/\bisAdmin\(\)/.test(src)) {
      bad(`${f} 에서 isAdmin() 이 사라짐 — 관리자 모드를 끈 동안 관리자 화면이 잠겨 다시 켤 수 없게 된다(자기잠금)`);
    }
  }
  if (!fail) console.log(`  관리자 화면 접근 게이트 ${ACCESS_GATE_FILES.length}개 isAdmin() 유지 ✓`);
}

// ── ③ 정의 파일에 두 함수가 모두 있고, 규칙 주석이 남아 있는지 ──────────────
{
  const src = readFileSync('app/src/lib/core/admin.ts', 'utf8');
  if (!/export async function isAdmin\(/.test(src)) bad('admin.ts 에 isAdmin() 정의 없음');
  if (!/export async function isAdminActing\(/.test(src)) bad('admin.ts 에 isAdminActing() 정의 없음');
  if (!/is_caller_god/.test(src)) bad('isAdminActing() 이 is_caller_god RPC 를 쓰지 않음 — Edge god 규칙과 어긋남');
}

console.log(fail ? `\n❌ check:admin-gate 실패 ${fail}건` : '\n✅ check:admin-gate 통과 — 특권=isAdminActing / 접근게이트=isAdmin 경계 유지');
process.exit(fail ? 1 : 0);
