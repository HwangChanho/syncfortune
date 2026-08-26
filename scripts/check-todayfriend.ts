// scripts/check-todayfriend.ts — 「오늘의 운세」는 **한 곳에만** 있다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"오늘의 운세 내일의 운세 이달의 운세는 채팅 친구중에 오늘의 운세 라고 만들고
//                    거기서 접근하게 하자 기존에 다른 선생님한테 있던건 다 빼자"*
//
// 왜 하네스가 필요한가
//   · 상담가 `blocks`·`routes` 는 **관리자 콘솔에서도 바뀐다.** 누가 성태현에게 `today` 를
//     다시 붙이면 같은 화면이 두 곳에서 열리고, 그때부턴 «어디서 보는 건지»가 사람마다 달라진다.
//   · 반대로 **떼기만 하고 안 붙이면 도달 불가**가 된다 — 종전에 «홈 블록을 친구목록에서 뺐다가
//     오늘의 운세가 사라질 뻔한» 일이 이미 있었다(`talk.tsx` 주석).
//   ⇒ 그래서 «하나만 있다»와 «그 하나가 살아 있다»를 **둘 다** 본다.
//
// ⚠️★이 검사는 **씨앗(SEED)과 마이그레이션**을 본다. 라이브 DB 는 여기서 못 본다
//   (자격증명이 필요하다). DB 는 바꾼 뒤 PostgREST 로 직접 확인한다 — 이 파일은
//   «코드가 서버와 같은 말을 하는가»를 지킨다. [[verify-facts-not-memory]]
//
// ★음성 테스트: `npx tsx scripts/check-todayfriend.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';

const SEED_FILE = 'app/src/lib/talk/consultants.ts';
const BLOCK_FILE = 'app/src/components/home/TodayFortuneBlock.tsx';
const REGISTRY = 'app/src/components/talk/blockRegistry.tsx';
const MIGRATION = 'supabase/migrations/0043_fortune_today_friend.sql';

const FRIEND_ID = 'fortune_today';
const OWNED = ['today', 'month'] as const;   // 이 친구만 가질 수 있는 블록/경로

type Row = { id: string; blocks: string[]; routes: string[]; kind: string; group: string };

/** 주석을 지운 '코드만' — 주석에 적힌 예시에 걸리는 오탐을 없앤다. */
export function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/**
 * SEED 배열에서 각 상담가의 id·kind·group·blocks·routes 를 뽑는다.
 * ★AST 대신 줄 단위로 읽는 이유: SEED 는 **한 줄에 한 명**이라는 형식이 고정돼 있고,
 *   여기서 보고 싶은 건 구조가 아니라 «어느 줄이 무엇을 들고 있나»다.
 */
export function parseSeed(src: string): Row[] {
  const out: Row[] = [];
  for (const line of codeOnly(src).split('\n')) {
    const id = line.match(/\bid:\s*'([^']+)'/)?.[1];
    if (!id || !/\bblocks:\s*\[/.test(line)) continue;
    const arr = (k: string): string[] => {
      const m = line.match(new RegExp(`\\b${k}:\\s*\\[([^\\]]*)\\]`));
      return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
    };
    out.push({
      id,
      blocks: arr('blocks'),
      routes: arr('routes'),
      kind: line.match(/\bkind:\s*'([^']+)'/)?.[1] ?? '',
      group: line.match(/\bgroup:\s*'([^']+)'/)?.[1] ?? '',
    });
  }
  return out;
}

export type Fail = { rule: string; msg: string };

/** SEED 만으로 판정할 수 있는 것(T1·T2) — 음성 테스트가 이 함수를 직접 부른다. */
export function judgeSeed(src: string): Fail[] {
  const f: Fail[] = [];
  const rows = parseSeed(src);
  const me = rows.find((r) => r.id === FRIEND_ID);

  // ── T1. 「오늘의 운세」 친구가 있고, 오늘·이달을 **들고 있다** ────────────────
  if (!me) {
    f.push({ rule: 'T1', msg: `${SEED_FILE} — 씨앗에 '${FRIEND_ID}' 가 없다. 네트워크가 없으면 오늘의 운세가 도달 불가가 된다` });
  } else {
    for (const k of OWNED) {
      if (!me.blocks.includes(k)) f.push({ rule: 'T1', msg: `'${FRIEND_ID}' 의 blocks 에 '${k}' 가 없다 — 그 화면으로 갈 길이 없어진다` });
    }
    if (me.kind !== 'virtual') f.push({ rule: 'T1', msg: `'${FRIEND_ID}' 는 kind='virtual' 이어야 한다(두 블록 다 온디바이스 = 원가 ₩0). 지금은 '${me.kind}'` });
    if (me.group !== 'friend') f.push({ rule: 'T1', msg: `'${FRIEND_ID}' 는 group='friend' 여야 한다(선생님 AI 가 아니다). 지금은 '${me.group}'` });
  }

  // ── T2. 다른 누구도 오늘·이달을 들고 있지 않다 ──────────────────────────────
  //   ⚠️`blocks` 만 보면 안 된다 — `routes`(콘텐츠 안내 카드)로도 같은 화면에 닿는다
  for (const r of rows) {
    if (r.id === FRIEND_ID) continue;
    for (const k of OWNED) {
      if (r.blocks.includes(k)) f.push({ rule: 'T2', msg: `'${r.id}' 의 blocks 에 '${k}' 가 남아 있다 — 같은 화면이 두 곳에서 열린다` });
      if (r.routes.includes(k)) f.push({ rule: 'T2', msg: `'${r.id}' 의 routes 에 '${k}' 가 남아 있다 — 안내 카드로 여전히 도달한다(«뺐는데 아직 뜬다»)` });
    }
  }
  return f;
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const good = `const SEED = [
  { id: 'astro_taehyun', kind: 'live', routes: ['astrology'], blocks: ['decision'], group: 'teacher', sortOrder: 70 },
  { id: 'fortune_today', kind: 'virtual', routes: ['today', 'month'], blocks: ['today', 'month'], group: 'friend', sortOrder: 100 },
];`;
  // ① 다른 선생님이 today 를 다시 집어 갔다  ② routes 로만 남은 경우  ③ 친구가 통째로 없다
  const bad1 = good.replace("blocks: ['decision']", "blocks: ['decision', 'today']");
  const bad2 = good.replace("routes: ['astrology']", "routes: ['astrology', 'month']");
  const bad3 = good.split('\n').filter((l) => !l.includes('fortune_today')).join('\n');

  const cases = [
    ['정상', good, 0],
    ['blocks 재발', bad1, 1],
    ['routes 재발', bad2, 1],
    ['친구 소실', bad3, 3],   // T1 셋: 친구 없음(1) — 실제론 1건이지만 아래에서 개수 대신 '잡혔나'로 본다
  ] as const;

  let ok = true;
  for (const [label, src, wantAtLeast] of cases) {
    const got = judgeSeed(src as string);
    const hit = wantAtLeast === 0 ? got.length === 0 : got.length > 0;
    if (!hit) ok = false;
    console.log(`  ${hit ? '✅' : '❌'} ${label} — ${got.length}건 ${got.map((x) => x.rule).join(',')}`);
  }
  console.log(ok ? '✅ selftest 통과 — 정상은 통과시키고, 재발·소실은 셋 다 잡는다'
    : '❌ selftest 실패 — 위 표를 볼 것');
  process.exit(ok ? 0 : 1);
}

// ── 본검사 ──────────────────────────────────────────────────────────────────
const read = (p: string): string | null => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
const fails: Fail[] = [];

const seed = read(SEED_FILE);
if (seed == null) fails.push({ rule: 'T0', msg: `${SEED_FILE} 이 없다 — 경로가 바뀌었으면 이 하네스를 고칠 것` });
else fails.push(...judgeSeed(seed));

// ── T3. 「내일」 로 가는 길이 살아 있는가 ─────────────────────────────────────
//   ★내일의 운세는 **별도 블록이 아니다** — 오늘 블록 안의 토글이다.
//     그 토글이 사라지면 Boss 가 말한 셋 중 하나가 조용히 도달 불가가 된다.
{
  const raw = read(BLOCK_FILE);
  if (raw == null) fails.push({ rule: 'T3', msg: `${BLOCK_FILE} 이 없다 — 오늘/내일 블록이 사라졌다` });
  else {
    const code = codeOnly(raw);
    if (!/\/today\?offset=/.test(code)) {
      fails.push({ rule: 'T3', msg: `${BLOCK_FILE} — '/today?offset=' 로 가는 길이 없다. **내일의 운세가 도달 불가**다` });
    }
    if (!/dayOffset/.test(code)) {
      fails.push({ rule: 'T3', msg: `${BLOCK_FILE} — 오늘/내일 토글(dayOffset)이 없다. 내일을 볼 수 없다` });
    }
  }
}

// ── T4. 두 블록이 실제로 그려지는가 ─────────────────────────────────────────
{
  const raw = read(REGISTRY);
  if (raw == null) fails.push({ rule: 'T4', msg: `${REGISTRY} 이 없다` });
  else {
    const code = codeOnly(raw);
    for (const k of OWNED) {
      if (!new RegExp(`\\b${k}\\s*:\\s*\\(?`).test(code)) {
        fails.push({ rule: 'T4', msg: `${REGISTRY} — '${k}' 블록을 그리지 않는다. 친구가 빈 대화가 된다` });
      }
    }
  }
}

// ── T5. 새 환경에도 반영되는가(마이그레이션) ────────────────────────────────
if (!fs.existsSync(MIGRATION)) {
  fails.push({ rule: 'T5', msg: `${MIGRATION} 이 없다 — 새 DB 에는 이 친구가 안 생긴다(라이브만 고치면 재현이 안 된다)` });
}

if (!fails.length) {
  console.log("✅ check:todayfriend — 「오늘의 운세」가 한 곳에만 있고(T1·T2), 내일 토글·두 블록·마이그레이션 모두 살아 있다");
  process.exit(0);
}
console.error(`❌ check:todayfriend — ${fails.length}건\n`);
for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
process.exit(1);
