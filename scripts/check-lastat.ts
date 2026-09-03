// scripts/check-lastat.ts — 「마지막 대화 시각」을 **한 곳(서버)** 에서만 올린다
// ═══════════════════════════════════════════════════════════════════════════
// ★Boss 2026-09-03: *"메세지 갱신 일자가 안 맞는거 같아"* · *"신규 채팅이 있는데
//   채팅리스트 상단에 안뜨는데?"*
//
// ■ ★두 증상이 **한 원인**이었다 — 목록은 `last_at` 으로 **날짜를 적고** `last_at` 으로 **정렬한다.**
//   그 값이 낡으면 날짜도 틀리고 새 채팅도 위로 안 온다.
// ■ 실측 — 79 세션 중 **32개**가 최신 메시지보다 뒤처졌고 최대 **43시간**이었다.
//   원인: 올리는 곳이 **앱 코드 두 곳뿐**이라 «내가 보낼 때만» 올라갔다.
//   상대가 보낸 말·AI 답은 아무도 안 올렸다. 게다가 `void` 호출이라 실패해도 조용했다.
// ■ ⇒ 트리거 하나로 모았다. 이 하네스는 **그게 다시 갈리는 것**을 막는다.
//
// 무엇을 지키나
//   L1 ★트리거가 있다(`trg_touch_last_at` · `touch_session_last_at`)
//   L2 ★시계를 **되감지 않는다**(`greatest`)
//   L3 ★트리거 함수는 **아무도 직접 못 부른다**(revoke)
//   L4 ★★앱이 `last_at` 을 **직접 안 올린다** — 두 곳이 같은 일을 하면 반드시 갈린다
//   L5 ★뒤처진 것을 **백필**했다(안 하면 «오늘부터만 맞는» 목록이 된다)
//
// ★음성 테스트: `npx tsx scripts/check-lastat.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIG = 'supabase/migrations/20260903b_touch_last_at.sql';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 주석을 걷는다 — 주석에 남은 낱말에 속지 않게(오늘 세 번 당한 자리다). */
export function strip(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** 앱 코드가 `talk_sessions` 의 `last_at` 을 **직접 쓰는가**. */
export function writesLastAt(src: string): boolean {
  const t = strip(src);
  return /from\(\s*'talk_sessions'\s*\)[\s\S]{0,120}?\.update\(\s*\{[^}]*last_at/.test(t);
}

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
  const abs = join(ROOT, MIG);
  if (!existsSync(abs)) { fail('L1', `${MIG} 가 없다 — **못 쟀다**`); return; }
  const sql = strip(readFileSync(abs, 'utf8'));

  if (!/create trigger trg_touch_last_at/i.test(sql)) fail('L1', '트리거 `trg_touch_last_at` 이 없다');
  if (!/after insert on public\.talk_messages/i.test(sql)) fail('L1', '메시지 INSERT 에 안 걸려 있다');
  if (!/greatest\(/i.test(sql)) fail('L2', '★`greatest` 가 없다 — 옛 메시지를 넣으면 시계가 **되감긴다**');
  if (!/revoke all on function public\.touch_session_last_at/i.test(sql)) {
    fail('L3', '★트리거 함수를 안 닫았다 — Supabase 는 새 함수에 기본으로 EXECUTE 를 준다');
  }
  if (!/update public\.talk_sessions s[\s\S]{0,300}max\(sent_at\)/i.test(sql)) {
    fail('L5', '★백필이 없다 — 오늘부터만 맞고 어제까지는 틀린 목록이 된다');
  }

  // L4 — 앱이 직접 올리면 안 된다
  for (const { file, text } of walk(join(ROOT, 'app/src'))) {
    if (writesLastAt(text)) {
      fail('L4', `${file} 가 \`last_at\` 을 **직접 올린다**.\n        `
        + '⚠️앱이 올리면 «내가 보낼 때만» 맞는다 — 상대의 말·AI 답은 안 올라가\n        '
        + '  목록의 **날짜와 정렬이 같이** 틀어진다(2026-09-03 실측: 32/79 세션이 뒤처짐).');
    }
  }
}

if (process.argv.includes('--selftest')) {
  const cs: { name: string; run: () => boolean }[] = [
    { name: 'L4 직접 쓰기를 문다', run: () => writesLastAt("supabase.from('talk_sessions').update({ last_at: x }).eq('id', s)") },
    { name: 'L4 ★줄이 갈려도 문다', run: () => writesLastAt("from('talk_sessions')\n  .update({\n    last_at: x,\n  })") },
    { name: 'L4 ★주석 속은 안 센다', run: () => !writesLastAt("// from('talk_sessions').update({ last_at: x })") },
    { name: 'L4 ★다른 표는 안 센다', run: () => !writesLastAt("from('talk_members').update({ last_at: x })") },
    { name: 'L4 ★읽기만 하는 것은 안 센다', run: () => !writesLastAt("from('talk_sessions').select('last_at')") },
    { name: '주석 걷기', run: () => strip('/* a */ b // c').trim() === 'b' },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cs) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  run();
  if (out.length) {
    console.error(`❌ check:lastat — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:lastat — 마지막 대화 시각을 서버 트리거 한 곳에서만 올린다');
}
