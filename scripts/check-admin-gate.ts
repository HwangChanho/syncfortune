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

/**
 * 관리자 화면 접근 경로 — **자기잠금 방지**를 지키는 자리.
 *
 * ★2026-08-12 이관: 관리자 화면이 **앱에서 웹 콘솔로** 옮겨졌다(daniel "앱에서 admin.tsx 빼고").
 *   그래서 앱 파일을 검사하던 이 목록은 **비운다** — 앱엔 관리자 화면이 더 이상 없다.
 *   대신 같은 규칙을 **웹**에서 지킨다(아래 §웹 게이트).
 *
 * ⚠️자기잠금이 왜 없는지(실측): `is_caller_admin()` 은 **`is_admin` 만** 본다(admin.ts:13 주석 —
 *   "화면 진입 노출용"). `admin_mode` 는 **특권 적용**(`isAdminActing`) 판정에만 쓰인다.
 *   ⇒ 관리자 모드를 꺼도 웹 콘솔에는 들어갈 수 있고, 거기서 다시 켤 수 있다.
 *   (만에 하나 잠기면 service_role 로 `profiles.admin_mode` 를 직접 되돌릴 수 있다.)
 */
const ACCESS_GATE_FILES: string[] = [];

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

// ── §웹 게이트 — 관리자 콘솔이 **is_caller_admin** 으로 막는가(자기잠금 방지의 새 위치) ──────
//   `isAdminActing`(admin_mode 포함) 으로 막으면 **모드를 끈 순간 콘솔에 못 들어가** 다시 켤 수 없다.
//   토글이 그 안에 있으므로 이건 되돌릴 수 없는 잠금이 된다 — 앱에서 겪었던 그 함정과 같다.
{
  const WEB = 'docs/admin/index.html';
  try {
    const web = readFileSync(WEB, 'utf8');
    if (!/rpc\(\s*['"]is_caller_admin['"]/.test(web)) {
      bad(`${WEB} 이 is_caller_admin 으로 게이트하지 않습니다 — 관리자 콘솔 접근 판정이 사라졌습니다`);
    }
    if (/rpc\(\s*['"]is_caller_god['"]/.test(web) && !/is_caller_admin/.test(web)) {
      bad(`${WEB} 이 god 판정만 씁니다 — admin_mode 를 끄면 콘솔에 못 들어가 다시 켤 수 없습니다(자기잠금)`);
    }
  } catch {
    bad(`${WEB} 을 읽을 수 없음 — 관리자 콘솔이 사라졌습니다(관리 기능 전체가 접근 불가)`);
  }
}

console.log(fail ? `\n❌ check:admin-gate 실패 ${fail}건` : '\n✅ check:admin-gate 통과 — 특권=isAdminActing / 접근게이트=isAdmin 경계 유지');
process.exit(fail ? 1 : 0);
