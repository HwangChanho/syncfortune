// scripts/check-rpcerror.ts — `supabase.rpc()` 의 **error 를 안 보는 호출**을 막는다
// ═══════════════════════════════════════════════════════════════════════════
// 2026-08-11 실측 사고: 관리자 화면에서 콘텐츠 NEW 를 토글했더니 **UI 는 켜졌는데 DB 는 그대로**였다.
//   원인 = `supabase.rpc()` 는 실패해도 **throw 하지 않는다.** `{ data, error }` 를 돌려줄 뿐이다.
//   그래서 `await supabase.rpc(...)` 만 쓰고 `try/catch` 로 감싸면 **catch 가 영원히 안 탄다** —
//   실패가 성공처럼 보이고, 그 위에 얹은 캐시·UI 가 거짓말을 한다.
//
// ★같은 모양이 앱 전체에 **13곳** 있었다. 데이터가 조용히 사라지는 두 곳(명식 동기화·푸시 토큰)을
//   고치고, 나머지(의도적 fire-and-forget)는 아래 화이트리스트에 **이유와 함께** 남긴다.
//   ⇒ 새로 생기는 무점검 호출은 여기서 막힌다.
//
// 판정 방법(★이름이 아니라 표현식으로 — [[harness-judge-expression-not-name]]):
//   `supabase.rpc(` 가 있는 줄에서, 같은 문(statement) 안에 `error` 를 받는 구조분해가 있는지 본다.
//   `.then(...)` 로 명시적으로 흘려보내는 것은 **의도**로 인정한다(콜백 두 개를 다 준 경우).
// 실행: npm run check:rpcerror
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const ROOT = 'app/src';

/** 의도적으로 결과를 안 보는 호출 — `파일:함수` 와 **이유**를 함께 적는다. 이유 없이 추가 금지. */
const ALLOW: { file: string; rpc: string; why: string }[] = [
  { file: 'lib/backend/contentVisit.ts', rpc: 'log_content_visit', why: '조회 집계 — 실패해도 사용자 흐름과 무관(.then(noop,noop) 로 명시)' },
  { file: 'lib/backend/logger.ts', rpc: 'log_event', why: '로거 자신 — 실패를 로깅하면 재귀. withTimeout + 자체 실패 처리 있음' },
  { file: 'lib/core/admin.ts', rpc: 'is_caller_god', why: '읽기 전용 판정 — 실패 시 false 로 안전하게 떨어진다(withTimeout)' },
  { file: 'app/(app)/coststable.tsx', rpc: 'usage_cost_by_kind', why: '읽기 전용 통계 — 없으면 빈 표' },
  { file: 'app/(app)/coststable.tsx', rpc: 'usage_cost_by_category', why: '읽기 전용 통계 — 없으면 빈 표' },
  { file: 'lib/backend/community.ts', rpc: 'bump_post_view', why: '조회수 집계 — error 를 읽어 경고만 남기고 던지지 않는다(조회수 때문에 글이 안 열리면 안 된다)' },
  { file: 'lib/engine/myChart.ts', rpc: 'recover_my_charts', why: '읽기 전용 복구 조회 — 실패 시 복구 없음으로 진행' },
  { file: 'app/(app)/admin.tsx', rpc: 'set_my_test_mode', why: '반환 data 로 성공을 판정한다(관리자 전용·즉시 화면 반영)' },
  { file: 'app/(app)/admin.tsx', rpc: 'set_global_test_mode', why: '동상' },
  { file: 'app/(app)/admin.tsx', rpc: 'set_my_admin_mode', why: '동상' },
];

const files: string[] = [];
(function walk(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
})(ROOT);

let bad = 0, checked = 0, allowed = 0;
console.log('\n🔌 supabase.rpc 결과 확인 검사\n');

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = f.replace(`${ROOT}/`, '');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (!line.includes('supabase.rpc(')) return;
    if (/^\s*(\/\/|\*)/.test(line)) return;                 // 주석 줄
    checked++;
    const rpcName = /supabase\.rpc\(\s*['"]([^'"]+)/.exec(line)?.[1] ?? '?';

    // ★한 줄만 보면 멀티라인 호출을 놓친다 — 앞 2줄까지 같이 본다(구조분해가 위에 있는 경우).
    const window = [lines[i - 2] ?? '', lines[i - 1] ?? '', line].join(' ');
    // ① 구조분해로 받는 형태 — `const { error } = await supabase.rpc(...)`
    const destructured = /\{\s*[^}]*\berror\b[^}]*\}\s*=/.test(window);
    // ② 변수에 담고 `.error` 를 보는 형태 — `const r = await withTimeout(supabase.rpc(...)); if (!r || r.error)`
    //    ★`withTimeout` 은 타임아웃 시 **undefined** 를 준다. 구조분해를 쓰면 그 순간 TypeError 라
    //      이 패턴을 쓸 수밖에 없다(2026-08-18 coinBonus 에서 실제로 걸렸다).
    //      뒤 3줄 안에서 그 변수의 `.error` 를 보는지 확인한다.
    const assigned = /(?:const|let)\s+(\w+)\s*=\s*await\s+[^;]*supabase\.rpc\(/.exec(window)?.[1];
    const laterLines = [line, lines[i + 1] ?? '', lines[i + 2] ?? '', lines[i + 3] ?? ''].join(' ');
    const checksViaVar = !!assigned && new RegExp(`\\b${assigned}\\.error\\b`).test(laterLines);
    const checksError = destructured || checksViaVar;
    // `.then(a, b)` 로 두 콜백을 다 준 경우 = 실패를 **명시적으로** 흘려보낸 것
    const explicitThen = /\.then\([^)]*,[^)]*\)/.test(line) || /\.then\([^)]*,[^)]*\)/.test(lines[i + 1] ?? '');
    if (checksError || explicitThen) return;

    const wl = ALLOW.find((a) => a.file === rel && a.rpc === rpcName);
    if (wl) { allowed++; console.log(`   ⏭  ${rel}:${i + 1} ${rpcName} — ${wl.why}`); return; }

    bad++;
    console.log(`   ❌ ${rel}:${i + 1} — \`${rpcName}\` 의 error 를 안 봅니다.`);
    console.log(`      rpc 는 실패해도 throw 하지 않습니다 → try/catch 로는 못 잡습니다.`);
    console.log(`      \`const { error } = await supabase.rpc(...); if (error) throw error;\` 로 고치거나,`);
    console.log(`      의도적이라면 scripts/check-rpcerror.ts 의 ALLOW 에 **이유와 함께** 추가하세요.`);
  });
}

console.log(`\n   호출 ${checked}건 · 허용 ${allowed}건 · 미점검 ${bad}건`);
console.log(bad ? '\n❌ check:rpcerror 실패\n' : '\n✅ check:rpcerror 통과 — rpc 실패가 조용히 지나가는 경로 없음\n');
if (bad) process.exitCode = 1;
