// scripts/check-edge.mjs — Edge Function(Deno) 타입체크 게이트
// ─────────────────────────────────────────────────────────────────────────
// ★왜 생겼나(2026-07-28 실제 사고):
//   rc-webhook 의 코인 적립 분기가 `return json({...})` 라는 **존재하지 않는 함수**를 부르고 있었다
//   (`Response.json` 오타). 앱 코드는 preflight 의 tsc 가 잡지만, **Edge 함수는 아무도 타입체크하지 않아서**
//   그대로 배포됐다. 결과: 코인 결제마다 ReferenceError → 500 → RC 웹훅 재전송.
//   적립 자체는 멱등이라 이중 지급은 없었지만, "결제했는데 실패로 뜬다"가 될 수 있었다.
//   → 돈이 오가는 코드가 타입체크 밖에 있던 게 진짜 결함이다. 여기서 막는다.
//
// 무엇을 하나: supabase/functions/*/index.ts 를 전부 `deno check` 한다(_shared 는 import 로 따라감).
//   · deno 가 없으면 **경고 후 스킵**(차단 안 함) — 하네스가 개발 환경 때문에 전체를 막으면 안 된다.
//   · 원격 의존(esm.sh)은 첫 실행만 다운로드, 이후 캐시. Anthropic API 호출은 없다(비용 0).
//
// 실행: npm run check:edge
// ─────────────────────────────────────────────────────────────────────────
import { readdirSync, existsSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const FN_DIR = `${ROOT}supabase/functions`;

// deno 가 있는지 — 없으면 스킵(개발 환경 차이로 전체 preflight 를 막지 않는다)
try {
  execSync('deno --version', { stdio: 'ignore' });
} catch {
  console.log('\n⚠️  deno 미설치 — Edge 타입체크 스킵(차단 아님). 설치: brew install deno');
  process.exit(0);
}

if (!existsSync(FN_DIR)) {
  console.log('\n⚠️  supabase/functions 없음 — 스킵(이 저장소에서 Edge 는 gitignore 대상).');
  process.exit(0);
}

// 엔트리포인트 = 각 함수 폴더의 index.ts. _shared 는 라이브러리라 직접 체크하지 않는다(각 함수가 import 로 끌어옴).
const entries = readdirSync(FN_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => `supabase/functions/${d.name}/index.ts`)
  .filter((p) => existsSync(`${ROOT}${p}`));

console.log(`\n🔎 Edge 타입체크(deno check) — 함수 ${entries.length}개`);

let fail = 0;
for (const rel of entries) {
  try {
    execFileSync('deno', ['check', rel], { cwd: ROOT, stdio: 'pipe' });
    console.log(`  ✓ ${rel}`);
  } catch (e) {
    fail++;
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.toString();
    console.error(`  ✗ ${rel}`);
    // 에러 본문만 추려서(Download 로그 제외) 보여 준다
    for (const line of out.split('\n').filter((l) => !/^\s*(Download|Check)\b/.test(l) && l.trim())) {
      console.error(`      ${line}`);
    }
  }
}

console.log(fail
  ? `\n❌ check:edge 실패 ${fail}개 함수 — 배포하면 런타임에서 터진다(위 rc-webhook 사고와 동일 유형).`
  : '\n✅ check:edge 통과 — 모든 Edge 함수 타입체크 OK');
process.exit(fail ? 1 : 0);
