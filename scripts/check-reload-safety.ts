// scripts/check-reload-safety.ts — 앱 전체 리로드(새로고침) 안전 가드 (정적·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 왜 하네스인가(daniel 2026-07-18 사건): 테마 리로드 조건을 넓히자, _layout 이 포그라운드 복귀
//   (AppState 'active')마다 부르는 syncThemeElement → storeChartElement 가 SecureStore 동기 getItem
//   실패 시 오판해 **매 복귀 앱을 리로드**("백그라운드 갔다오면 새로고침")했다. 정적 타입체크로 안 잡히고
//   시뮬 재현도 실패해 빌드에 들어갔다. 근본 = **자동/생명주기 경로에서 앱 전체 리로드**.
//
// 규칙(이 하네스가 강제):
//   R1. DevSettings.reload()/Updates.reloadAsync() **실제 호출**은 `app/src/lib/theme.ts` 에만 존재해야 한다.
//       (테마·설정 변경이라는 명시적 사용자 액션 지점. 다른 파일 = AppState·useEffect·주기 sync 등
//        자동 경로일 위험이 크다 → 새로고침 회귀.)
//   R2. theme.ts 의 storeChartElement(대표명식 오행 저장 — 앱시작·포그라운드 복귀마다 호출됨) 안의 리로드는
//       반드시 `if (reload)` 인자 가드 뒤에 있어야 한다. 가드 없이 리로드하면 자동 경로에서 새로고침.
//
// 실행: npm run check:reload  (preflight 에 포함)
// ─────────────────────────────────────────────────────────────────────────
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ROOT = process.cwd();
let failed = 0;
const fail = (m: string) => { console.error(`  ❌ ${m}`); failed++; };
const pass = (m: string) => console.log(`  ✅ ${m}`);

const THEME = 'app/src/lib/theme.ts';

console.log('■ check:reload — 앱 전체 리로드(새로고침) 안전 가드');

// ── R1: 리로드 실제 호출은 theme.ts 에만 ─────────────────────────────
console.log('\n[R1] 앱 리로드 호출은 theme.ts 에만(자동/생명주기 경로 리로드 = 새로고침 회귀)');
let grepOut = '';
try {
  // 실제 호출부(뒤에 '(') 만 — 주석/설명은 reload( 형태가 아니라 제외됨
  grepOut = execSync(
    `git grep -nE "DevSettings\\.reload\\(|reloadAsync\\(" -- 'app/src/**/*.ts' 'app/src/**/*.tsx'`,
    { cwd: ROOT },
  ).toString();
} catch (e: any) {
  // git grep 은 매치 0건이면 exit 1 → 그 경우 stdout 은 비어 있음
  grepOut = e?.stdout?.toString() ?? '';
}
const hits = grepOut.trim() ? grepOut.trim().split('\n') : [];
// 라인 파싱: "path:line:code" — code 가 주석(//·*)으로 시작하면 실제 호출 아님(설명)
const realCalls = hits.filter((l) => {
  const code = l.split(':').slice(2).join(':').trimStart();
  return code !== '' && !code.startsWith('//') && !code.startsWith('*');
});
const stray = realCalls.filter((l) => !l.startsWith(THEME + ':'));
if (stray.length) {
  fail(`리로드 호출이 ${THEME} 밖에 있음 — 자동 경로면 새로고침 회귀:`);
  stray.forEach((l) => console.error(`       ${l}`));
} else {
  pass(`리로드 실제 호출 ${realCalls.length}건 모두 theme.ts (명시적 설정 변경 지점)`);
}

// ── R2: storeChartElement 리로드는 reload 인자 가드 뒤 ───────────────
console.log('\n[R2] storeChartElement(앱시작·포그라운드마다 호출) 리로드는 reload 인자 가드 안이어야');
const src = readFileSync(`${ROOT}/${THEME}`, 'utf8');
const fnIdx = src.indexOf('export function storeChartElement');
if (fnIdx < 0) {
  fail('storeChartElement 를 찾지 못함(함수명 변경?) — 하네스 갱신 필요');
} else {
  // 함수 본문 대략 추출(다음 export function 전까지)
  const after = src.slice(fnIdx);
  const nextExport = after.indexOf('\nexport function', 1);
  const body = nextExport > 0 ? after.slice(0, nextExport) : after;
  const reloadPos = body.search(/DevSettings\.reload\(|reloadAsync\(/);
  if (reloadPos < 0) {
    pass('storeChartElement 안에 리로드 호출 없음(더 안전)');
  } else {
    const guardPos = body.indexOf('if (reload)');
    if (guardPos >= 0 && guardPos < reloadPos) {
      pass('storeChartElement 리로드는 `if (reload)` 가드 안(포그라운드/자동 경로에선 reload=false → 리로드 안 함)');
    } else {
      fail('storeChartElement 가 `if (reload)` 가드 없이 리로드 — 포그라운드 복귀마다 새로고침 위험(daniel 07-18 재발)');
    }
  }
}

// ── 역검증: 하네스가 실제로 뭔가를 보고 있는지(리로드 호출이 최소 1건은 있어야) ──
console.log('\n[역검증] 리로드 호출이 최소 1건 존재(하네스가 헛돌지 않음)');
realCalls.length > 0 ? pass(`리로드 호출 ${realCalls.length}건 감지 — 가드가 실재를 검사`) : fail('리로드 호출 0건 = 패턴이 바뀌어 하네스가 아무것도 안 보고 있음');

console.log(failed ? `\n❌ check:reload 실패 ${failed}건` : '\n✅ check:reload 통과');
process.exit(failed ? 1 : 0);
