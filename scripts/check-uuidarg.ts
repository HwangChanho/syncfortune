// scripts/check-uuidarg.ts — 서버가 **uuid** 를 받는 자리에 **로컬 id** 를 넘기지 않는다
// ═══════════════════════════════════════════════════════════════════════════
// ★2026-09-02 사고 (Boss *"합보기 충보기 누르면 튕겨"*)
//   유료 언락이 **한 번도 성립하지 않았다.**
//   · 로컬 명식 id 는 `c_1756…`(`myChart.ts` 의 `c_${Date.now()}`) — **uuid 가 아니다**
//   · 서버 RPC 는 `unlock_chart_feature(p_kind text, p_chart_id **uuid**)`
//   ⇒ Postgres 가 `invalid input syntax for type uuid` 로 던지고 화면엔 「잠시 후 다시 시도」만.
//   ⇒ `isUnlocked` 도 uuid 가 아니면 서버를 안 봐서 **영영 잠긴 상태**로 남는다.
//
// ■ ★★내 웹 테스트가 이걸 **놓쳤다** — 로컬 언락 도장을 심어 두고 눌렀더니
//   `isUnlocked` 가 **로컬 가지에서 true** 로 끝나 uuid 경로를 **아예 안 탔다.**
//   «되는 것을 확인했다» 가 «되는 길로만 걸어 봤다» 였다.
//
// 무엇을 지키나
//   U1 ★uuid 를 받는 RPC 를 부르는 자리에 **로컬 id 로 보이는 것**을 넘기지 않는다
//      (`.id` 로 끝나는 값 금지 — `serverChartId` 를 쓸 것)
//   U2 ★`chartId` 프롭에 로컬 `id` 를 그대로 흘리지 않는다
//   U3 ★로컬 id 형식(`c_` + 숫자)이 uuid 가 아님을 **기록으로 못 박는다**
//      (누가 형식을 바꾸면 여기서 알게 된다)
//
// ★음성 테스트: `npx tsx scripts/check-uuidarg.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIG_DIR = 'supabase/migrations';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
/** 마이그레이션에서 **uuid 인자**를 받는 함수 이름을 모은다. */
export function uuidRpcs(sql: string): string[] {
  const names: string[] = [];
  for (const m of sql.matchAll(/create\s+or\s+replace\s+function\s+public\.(\w+)\s*\(([^)]*)\)/gi)) {
    if (/\buuid\b/i.test(m[2])) names.push(m[1]);
  }
  return names;
}
/**
 * 로컬 id 로 **보이는** 표현인가 — `x.id` · `picked.id` · `item.id`.
 *
 * ■ ⚠️★**맨 이름(`id`)은 안 센다.** 이름은 아무것도 보장하지 않는다 —
 *   `const id = await ensureServerChartId(...)` 처럼 **서버 id** 일 수도 있다.
 *   첫 판에 `^id$` 를 넣었다가 `career.tsx` 를 오탐했다.
 * ■ ★오늘만 **세 번째**로 같은 실수를 했다(`check:sajuarg` 두 번, 여기 한 번):
 *   **하네스는 «이름·자리» 가 아니라 «어디서 왔는가» 로 판정해야 한다.**
 *   member 접근(`무엇.id`)은 그 «무엇» 이 로컬 명식 객체라는 뜻이라 근거가 되지만,
 *   맨 이름은 근거가 되지 않는다.
 */
export function looksLocalId(arg: string): boolean {
  // `?? null` · `!` 같은 꼬리를 떼고 **인자 전체**를 본다
  const a = arg.trim().replace(/\s*\?\?\s*null\s*$/, '').replace(/!$/, '').trim();
  if (/serverChartId/.test(a)) return false;          // 서버 id = 정답
  // ⚠️★«어딘가에 .id 가 들어 있다» 로 보면 **비교식까지** 문다
  //   (`rid === savedChart.id` 는 boolean 이지 id 가 아니다 — 실제로 두 화면을 오탐했다).
  //   ⇒ **인자 전체가 id 표현식일 때만** 센다.
  return /^[A-Za-z_$][\w$]*(\?\.|\.)([\w$]+(\?\.|\.))*id$/.test(a);
}

/**
 * «상태 세터처럼 생겼지만 아닌» 것들 — 부르면 서버/저장소를 바꾸는 **API** 다.
 * ⚠️`setRepresentative(target.id)` 는 **로컬 id 를 받는 것이 맞다**(대표 명식을 고르는 일).
 */
const NOT_STATE = new Set(['setRepresentative', 'setRaw', 'setItem', 'setItemAsync']);

function walk(dir: string, acc: { file: string; text: string }[] = []) {
  let es; try { es = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of es) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push({ file: p.slice(ROOT.length + 1), text: readFileSync(p, 'utf8') });
  }
  return acc;
}

function run() {
  // ① uuid 를 받는 RPC 이름 모으기
  const rpcs = new Set<string>();
  const md = join(ROOT, MIG_DIR);
  if (existsSync(md)) for (const f of readdirSync(md)) {
    if (f.endsWith('.sql')) uuidRpcs(readFileSync(join(md, f), 'utf8')).forEach((n) => rpcs.add(n));
  }
  if (!rpcs.size) { console.log('⏭  uuid RPC 를 못 찾았다(supabase/ 가 없을 수 있다). **못 쟀다**'); return; }

  // ② 부르는 곳에서 넘기는 값 보기
  for (const { file, text: raw } of walk(join(ROOT, 'app/src'))) {
    const text = stripComments(raw);
    for (const name of rpcs) {
      for (const m of text.matchAll(new RegExp(`rpc\\(\\s*'${name}'\\s*,\\s*\\{([^}]*)\\}`, 'g'))) {
        for (const pair of m[1].split(',')) {
          const [k, v] = pair.split(':');
          if (!k || !v) continue;
          if (!/chart|_id/i.test(k)) continue;
          if (looksLocalId(v)) {
            fail('U1', `${file} — \`${name}\` 에 \`${v.trim()}\` 를 넘긴다.\n        `
              + '⚠️로컬 명식 id 는 `c_1756…` 라 **uuid 가 아니다** → 서버가 통째로 거절한다\n        '
              + '  (화면엔 「잠시 후 다시 시도」만 뜨고 **결제가 영영 성립하지 않는다**). `serverChartId` 를 넘겨라');
          }
        }
      }
    }
    // ── U2 — `chartId` 로 흘러가는 값이 로컬 id 인가 ────────────────────
    //   ⚠️★첫 판은 `chartId={…}` **그 자리만** 봤다가 **안 물었다.**
    //     실제 버그는 한 단계 떨어져 있었다: `setShown(picked.id)` → `shownId` → `chartId={shownId}`.
    //     마지막 자리에는 평범한 변수 이름만 있어서 아무 표가 안 났다.
    //   ⇒ 그 자리 + **그 값을 채우는 곳**까지 본다. `chartId` 를 넘기는 파일에서는
    //     상태에 `.id` 를 **집어넣는 것 자체**를 막는다(그 파일은 서버 id 를 다뤄야 하는 파일이다).
    const passesChartId = /chartId=\{/.test(text);
    for (const m of text.matchAll(/chartId=\{([^}]{1,60})\}/g)) {
      if (looksLocalId(m[1])) {
        fail('U2', `${file} — \`chartId={${m[1].trim()}}\` 가 로컬 id 로 보인다. \`serverChartId\` 를 쓸 것`);
      }
    }
    if (passesChartId) {
      for (const m of text.matchAll(/\b(set[A-Z]\w*)\(\s*([^;\n)]{1,60})\)/g)) {
        if (NOT_STATE.has(m[1])) continue;            // 상태가 아니라 API 다(위 주석)
        if (looksLocalId(m[2])) {
          fail('U2', `${file} — \`${m[0].trim()}\` 로 **로컬 id 를 상태에 넣는다**.\n        `
            + '⚠️이 파일은 `chartId`(서버 uuid)를 넘기는 파일이다 — 그 상태에 로컬 id 가 들어가면\n        '
            + '  화면은 멀쩡하고 **결제만 조용히 실패한다**(서버가 uuid 가 아니라고 거절). `serverChartId` 를 넣어라');
        }
      }
    }
  }

  // U3 — 로컬 id 형식이 여전히 uuid 가 아님을 기록으로 못 박는다
  const mc = join(ROOT, 'app/src/lib/engine/myChart.ts');
  if (existsSync(mc)) {
    const t = stripComments(readFileSync(mc, 'utf8'));
    const hasLocalFmt = /const\s+id\s*=\s*`c_\$\{Date\.now\(\)\}`/.test(t);
    if (!hasLocalFmt) {
      fail('U3', '로컬 명식 id 형식이 바뀌었다(`c_${Date.now()}` 가 아니다).\n        '
        + '★uuid 가 됐다면 이 하네스와 `unlocks.ts` 의 `UUID_RE` 분기를 다시 보라 — 전제가 바뀐 것이다');
    }
  }
}

if (process.argv.includes('--selftest')) {
  const cs: { name: string; run: () => boolean }[] = [
    { name: 'uuid RPC 이름을 뽑는다', run: () => uuidRpcs('create or replace function public.unlock_chart_feature(p_kind text, p_chart_id uuid)').includes('unlock_chart_feature') },
    { name: '★uuid 인자가 없으면 안 뽑는다', run: () => uuidRpcs('create or replace function public.spend_coins_fixed(p_kind text)').length === 0 },
    { name: '★로컬 id 를 문다', run: () => looksLocalId('picked.id') && looksLocalId('c.id') && looksLocalId('target.id') },
    { name: '★비교식은 안 문다(오탐이었던 것)', run: () => !looksLocalId('!!savedChart && rid === savedChart.id') },
    { name: '★`?? null` 꼬리는 떼고 본다', run: () => looksLocalId('picked.id ?? null') },
    { name: '★serverChartId 는 안 문다', run: () => !looksLocalId('picked.serverChartId') && !looksLocalId('c?.serverChartId ?? null') },
    { name: '★평범한 변수는 안 문다', run: () => !looksLocalId('chartId') && !looksLocalId('shownId') },
    { name: 'U2 ★한 단계 떨어진 대입도 문다', run: () => looksLocalId('picked.id') },
    { name: 'U2 ★맨 이름 `id` 는 안 문다(서버 id 일 수 있다)', run: () => !looksLocalId('id') },
    { name: 'U2 ★setRepresentative 는 예외', run: () => NOT_STATE.has('setRepresentative') },
    { name: 'U2 ★serverChartId 대입은 안 문다', run: () => !looksLocalId('picked.serverChartId ?? null') },
    { name: '★주석 속 예시는 안 본다', run: () => stripComments("// rpc('x', { p_chart_id: picked.id })").trim() === '' },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cs) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  run();
  if (out.length) {
    console.error(`❌ check:uuidarg — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:uuidarg — uuid 자리에 로컬 id 를 넘기는 곳이 없다');
}
