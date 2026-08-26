// scripts/check-rpcambig.ts — plpgsql 함수가 **자기 반환 이름에 걸려 넘어지는지** 본다
// ═══════════════════════════════════════════════════════════════════════════
// 2026-08-26 실측에서 나옴: 관리자 콘솔의 커뮤니티 신고 대기열이
// **만들어진 이후 한 번도 열린 적이 없었다.** app_logs 에 이렇게 쌓여 있었다:
//     42702 column reference "id" is ambiguous
//
// ■ 함정의 정체 — 「반환 표의 칸 이름은 본문 전체에서 변수다」
//   plpgsql 의 `returns table(kind text, id uuid, ...)` 은 단순한 결과 모양이 아니라
//   **본문 어디서나 살아 있는 변수 선언**이다. 그래서 본문 첫 줄이
//       select is_admin into v_admin from profiles where id = auth.uid();
//   처럼 `id` 를 접두어 없이 쓰면, PostgreSQL 이
//   「OUT 변수 id」와 「profiles.id」 중 어느 쪽인지 정하지 못해 **즉시 예외**를 던진다.
//
// ■ ★왜 눈에 안 띄었나 — **권한 판정 줄에서 터진다**
//   충돌이 관리자 확인 줄에 있으면 관리자든 아니든 100% 실패한다.
//   그런데 화면에는 「목록이 비었다」로 보인다 ⇒ *"내가 관리자가 아닌가 보다"* 로 오해하기 딱 좋다.
//   실패가 **권한 문제처럼 위장**되는 것이 이 버그의 진짜 위험이다.
//
// ■ 무엇을 검사하나
//   DB 에 실제로 올라가 있는 plpgsql 함수를 읽어(= repo 가 아니라 **서버가 진실**),
//   `returns table(...)` 의 칸 이름이 본문에서 **접두어 없이 비교식에 쓰이는지** 본다.
//   `#variable_conflict` 를 선언한 함수는 면제 — 그 선언이 곧 「겹치면 컬럼이 이긴다」는 답이다.
//
// ⚠️이 검사가 **못 보는 것**(정직하게 남긴다):
//   · 동적 SQL(`execute format(...)`) 안의 충돌 — 문자열이라 실행 전엔 알 수 없다
//   · plpgsql 이 아닌 sql 함수 — 애초에 이 함정이 없다(변수가 없다)
//
// 실행: npm run check:rpcambig   (네트워크 필요 — Management API)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

/** 비교식에서 쓰이는 연산자들 — 이 앞에 오는 홑이름만 위험하다(select 목록의 컬럼명은 안 걸린다) */
const CMP = String.raw`(?:=|<>|!=|<=|>=|<|>|\bis\b|\bin\b|\blike\b|\bilike\b)`;

/**
 * plpgsql 함수 정의 한 덩어리를 보고 «반환 칸 이름 ↔ 접두어 없는 비교» 충돌을 찾는다.
 *
 * @param def `pg_get_functiondef()` 이 돌려준 전체 정의(헤더 + 본문)
 * @returns 충돌한 이름 목록. 빈 배열이면 안전.
 *
 * 주의: 정적 검사다. 아래 순서로 오탐을 걷어낸다 —
 *   ① 주석 제거 → ② 문자열 리터럴 제거 → ③ 본문만 잘라내기(헤더의 returns table 자체가 걸리지 않게)
 *   ④ `#variable_conflict` 있으면 면제
 */
export function ambiguousNames(def: string): string[] {
  // ── 반환 칸 이름 뽑기: returns table( kind text, id uuid, ... )
  const m = /returns\s+table\s*\(([\s\S]*?)\)\s*(?:language|as|security|set|stable|immutable|volatile)/i.exec(def);
  if (!m) return [];
  const outs = m[1]
    .split(',')
    .map((s) => s.trim().split(/\s+/)[0])          // 「id uuid」 → 「id」
    .filter((s) => /^[a-z_][a-z0-9_]*$/i.test(s))
    .map((s) => s.toLowerCase());
  if (!outs.length) return [];

  // ── 본문만: 달러 인용 블록 안쪽 ($function$ ... $function$ / $$ ... $$)
  const body = /\$([a-z_]*)\$([\s\S]*)\$\1\$/i.exec(def);
  if (!body) return [];
  let src = body[2];

  // ── ★면제: 「겹치면 컬럼이 이긴다」를 선언해 둔 함수 (예외 자체가 안 난다)
  if (/#variable_conflict\s+use_column/i.test(src)) return [];

  // ── 오탐 제거 ①주석 ②문자열 리터럴
  src = src.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/'(?:[^']|'')*'/g, "''");

  const hit: string[] = [];
  for (const name of outs) {
    // 앞에 점·글자·따옴표가 없는 홑이름 + 비교연산자  →  「where id = ...」 같은 것만 잡힌다.
    //   · 「p.id = ...」  : 앞에 점이 있어 안 걸림(정상)
    //   · 「select p.id, ...」: 뒤에 비교연산자가 없어 안 걸림(정상)
    const re = new RegExp(String.raw`(?:^|[^.\w"'])${name}\s*${CMP}`, 'im');
    if (re.test(src)) hit.push(name);
  }
  return hit;
}

// ── 자기 검사(음성 테스트) — 하네스가 진짜 잡는지부터 증명한다 ──────────────
// ★[[harness-judge-expression-not-name]]: 하네스를 만들면 **반드시 음성 테스트**.
//   초록불이 「검사를 안 해서」 초록인 경우를 여기서 걸러낸다.
const SELF_BROKEN = `CREATE OR REPLACE FUNCTION public.x()
 RETURNS TABLE(kind text, id uuid)
 LANGUAGE plpgsql
AS $function$
declare v boolean;
begin
  select is_admin into v from profiles where id = auth.uid();   -- ★여기가 터진다
  return query select 'post'::text, p.id from posts p;
end $function$`;
const SELF_OK = `CREATE OR REPLACE FUNCTION public.x()
 RETURNS TABLE(kind text, id uuid)
 LANGUAGE plpgsql
AS $function$
declare v boolean;
begin
  select p.is_admin into v from profiles p where p.id = auth.uid();  -- 한정돼 있다
  return query select 'post'::text, q.id from posts q where q.hidden = false;
end $function$`;
const SELF_EXEMPT = SELF_BROKEN.replace('declare v boolean;', '#variable_conflict use_column\ndeclare v boolean;');

function selftest(): boolean {
  const a = ambiguousNames(SELF_BROKEN);      // 잡아야 한다
  const b = ambiguousNames(SELF_OK);          // 잡으면 안 된다
  const c = ambiguousNames(SELF_EXEMPT);      // 면제라 잡으면 안 된다
  const ok = a.includes('id') && b.length === 0 && c.length === 0;
  console.log(`   ${ok ? '✅' : '❌'} 자기검사 — 깨진 것 [${a}] · 멀쩡한 것 [${b}] · 면제 [${c}]`);
  return ok;
}

// ── main ──────────────────────────────────────────────────────────────────
const isMain = process.argv[1]?.includes('check-rpcambig');
if (isMain) {
  console.log('\n🧪 plpgsql 반환 칸 이름 충돌 — 서버에 올라가 있는 함수를 직접 읽는다\n');
  let bad = 0;
  if (!selftest()) { console.log('\n❌ 하네스 자신이 고장났습니다 — 검사 결과를 믿지 마세요\n'); process.exit(1); }

  let token = '';
  try { token = readFileSync(`${homedir()}/.supabase/access-token`, 'utf8').trim(); } catch { /* 아래에서 건너뜀 */ }
  const ref = (() => {
    try {
      const u = /SUPABASE_URL=https:\/\/([a-z0-9]+)\.supabase\.co/.exec(readFileSync('.env', 'utf8'));
      return u?.[1] ?? '';
    } catch { return ''; }
  })();
  if (!token || !ref) { console.log('\n⏭  건너뜀 — ~/.supabase/access-token 또는 .env 의 SUPABASE_URL 이 없습니다\n'); process.exit(0); }

  const sql = `select p.proname, pg_get_functiondef(p.oid) as def
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
      and pg_get_function_result(p.oid) like 'TABLE%'
    order by 1`;
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const rows = await res.json().catch(() => null);
  if (!Array.isArray(rows)) { console.log(`\n⏭  건너뜀 — 조회 실패(${res.status})\n`); process.exit(0); }

  console.log(`\n  반환 표를 돌려주는 plpgsql 함수 ${rows.length}개\n`);
  for (const r of rows as Array<{ proname: string; def: string }>) {
    const hit = ambiguousNames(r.def);
    if (hit.length) { bad++; console.log(`   ❌ ${r.proname.padEnd(30)} 「${hit.join(', ')}」 가 접두어 없이 비교식에 쓰였습니다`); }
    else console.log(`   ✅ ${r.proname}`);
  }

  if (bad) {
    console.log(`\n❌ ${bad}개 — 이 함수들은 **권한과 무관하게 100% 실패**합니다.`);
    console.log('   처방: 그 줄을 「테이블별칭.컬럼」 으로 한정하거나, 본문 첫 줄에 `#variable_conflict use_column` 을 넣으세요.\n');
    process.exit(1);
  }
  console.log('\n✅ 반환 칸 이름에 걸려 넘어지는 함수 없음\n');
}
