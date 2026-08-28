/**
 * scripts/check-interaction.mts — **`runAfterInteractions` 는 웹에서 안 온다** (`check:interaction`)
 * ═════════════════════════════════════════════════════════════════════════
 * ■ ★왜 만들었나 — **같은 함정에 두 번 빠졌다**
 *   · 2026-08-16: 만세력·내 명식이 **44초를 기다려도 스켈레톤**이었다
 *     → `useDeferredReady` 에 웹 분기를 넣어 고쳤다(그 주석에 경고까지 적어 뒀다).
 *   · 2026-08-28: `/dayPillar` 이 **영영 스켈레톤**. 원인 동일 —
 *     그 훅을 **안 쓰고 직접** `InteractionManager.runAfterInteractions` 를 부르고 있었다.
 *     ★고친 버그는 **형제를 찾아야 끝난다**([[session-2026-08-27-handoff-4]] 의 그 교훈).
 *
 * ■ 무엇을 잡나 — `runAfterInteractions` 를 부르는 **모든 자리**가
 *   같은 파일 안에서 `Platform.OS === 'web'` 분기를 갖고 있는지.
 *   ⚠️증상이 **조용하다**(오류 0·글자 0) → 사람 눈으로는 «명식이 없나 보다» 로 넘어간다.
 *
 * ■ ★면제: `useDeferredReady.ts` 자신(거기가 정본이다).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const EXEMPT = new Set(['app/src/lib/ui/useDeferredReady.ts']);
const files: string[] = [];
function walk(d: string) {
  for (const e of readdirSync(d)) {
    if (e === 'node_modules' || e === '.expo' || e === 'dist' || e.startsWith('.')) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(p)) files.push(p);
  }
}
walk('app/src');

type Hit = { file: string; line: number; why: string };
const hits: Hit[] = [];
for (const f of files) {
  if (EXEMPT.has(f)) continue;
  const raw = readFileSync(f, 'utf8');
  /**
   * ⚠️★**주석을 먼저 걷어낸다.** 안 그러면 «이 함정을 조심하라» 고 적은 **내 주석**에 하네스가 걸린다
   *   — 이 저장소에서 여러 번 겪은 패턴이다([[session-2026-08-27-handoff-4]]).
   *   ★블록 주석을 **먼저** 지운다 — 줄 주석부터 지우면 블록의 닫는 기호가 남아
   *     파일 끝까지 먹힌다(`check:myeongtabs` 가 그렇게 통째로 헛돌았다).
   *   ⚠️그리고 이 주석 안에 **닫는 기호를 글자로 적지 마라** — 방금 그렇게 적었다가
   *     주석이 거기서 끝나 스크립트가 깨졌다(설명하던 함정에 스스로 빠졌다).
   */
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  if (!/runAfterInteractions/.test(src)) continue;
  // ★«같은 파일에 웹 분기가 있는가» 로 본다 — 어느 변수명을 쓰든 상관없다
  const hasWebBranch = /Platform\.OS\s*===\s*['"]web['"]/.test(src);
  if (hasWebBranch) continue;
  const line = raw.slice(0, raw.indexOf('runAfterInteractions')).split('\n').length;
  hits.push({ file: f, line, why: '웹 분기가 없다 — 웹에서는 콜백이 **영영 안 온다**(조용한 스켈레톤)' });
}

if (process.argv.includes('--selftest')) {
  const neg = `import { InteractionManager } from 'react-native';\nInteractionManager.runAfterInteractions(() => setReady(true));`;
  const pos = `import { InteractionManager, Platform } from 'react-native';\nif (Platform.OS === 'web') { setReady(true); return; }\nInteractionManager.runAfterInteractions(() => setReady(true));`;
  const judge = (s: string) => /runAfterInteractions/.test(s) && !/Platform\.OS\s*===\s*['"]web['"]/.test(s);
  const ok = judge(neg) === true && judge(pos) === false;
  console.log(ok ? '✅ 자가테스트 통과(분기 없음=잡고, 있음=통과)' : '❌ 자가테스트 실패');
  process.exit(ok ? 0 : 1);
}

if (!hits.length) { console.log('✅ check:interaction — runAfterInteractions 를 쓰는 곳마다 웹 분기가 있다'); process.exit(0); }
console.log(`❌ check:interaction — ${hits.length}건 (웹에서 화면이 **조용히** 스켈레톤에 갇힌다)`);
for (const h of hits) console.log(`  ${h.file}:${h.line}\n      ${h.why}`);
process.exit(1);
