#!/usr/bin/env tsx
/**
 * check:friendgate — 친구에게 명식을 여는 **두 조건**이 코드에 남아 있는가.
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜 생겼나 (2026-08-20 · 친구 기능)
 *   Boss 결정으로 친구에게 **명식 전체**를 공개한다. 그런데 원국 여덟 글자만 있으면
 *   **생년월일이 역산된다**(연주=60갑자 · 월일시주로 날짜 특정). 이 앱 코드가 이미 적어 둔 사실이다.
 *   ⇒ 친구에게 명식을 여는 것은 **생년월일을 주는 것과 같다.**
 *
 *   그래서 조건이 **둘 다** 필요하다:
 *     ① `friends.status = 'accepted'`  — 양방이 동의한 친구인가
 *     ② `profiles.share_consent`       — 명식 공개에 따로 동의했나
 *   ★하나만 남아도 새어 나간다 — "친구지만 동의 안 한 사람" 또는 "동의했지만 친구 아닌 사람".
 *   ★그리고 **화면에서 안 그리는 건 방어가 아니다** — RLS 가 막아야 REST 로도 안 샌다.
 *
 * 규칙
 *   F1 `charts` 의 친구 읽기 정책에 **accepted** 조건이 있다
 *   F2 같은 정책에 **share_consent** 조건이 있다
 *   F3 `friends` 에 직접 insert 하는 앱 코드가 없다(신청은 RPC 로만 — 아니면 남을 임의로 친구로 만든다)
 *   F4 `share_consent` 기본값이 **false** 다(켜져 있으면 아무도 모르는 사이 열린다)
 *
 * 사용: npm run check:friendgate · 자가테스트: npx tsx scripts/check-friendgate.ts --selftest
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const MIG_DIR = 'supabase/migrations';
const APP_DIR = 'app/src';

type Fail = { rule: string; msg: string };
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');

/**
 * 친구 게이트를 검사한다.
 * @param sql 상담가·친구 마이그레이션을 합친 SQL
 * @param app `friends` 를 건드리는 앱 소스를 합친 것
 */
export function audit(sql: string, app: string): Fail[] {
  const out: Fail[] = [];
  // 정책 본문만 떼어 본다 — 파일 어딘가에 낱말이 있는 것과 **정책 안에 있는 것**은 다르다
  const pol = sql.match(/create policy charts_friend_read[\s\S]*?;/)?.[0] ?? '';
  if (!pol) {
    out.push({ rule: 'F1', msg: 'charts 의 친구 읽기 정책(charts_friend_read)이 없다 — 친구가 명식을 못 보거나, 다른 곳에서 열고 있다' });
  } else {
    if (!/status\s*=\s*'accepted'/.test(pol)) {
      out.push({ rule: 'F1', msg: "charts_friend_read 에 status='accepted' 가 없다 — **신청만 해도** 남의 명식이 열린다" });
    }
    if (!/share_consent/.test(pol)) {
      out.push({ rule: 'F2', msg: 'charts_friend_read 에 share_consent 가 없다 — 동의하지 않은 사람의 명식이 열린다(= 생년월일이 역산된다)' });
    }
  }
  // F4 — 기본값 false
  if (!/share_consent\s+boolean\s+not null\s+default\s+false/.test(sql)) {
    out.push({ rule: 'F4', msg: 'share_consent 기본값이 false 가 아니다 — 아무도 모르는 사이에 명식이 공개된다' });
  }
  // F3 — 앱이 friends 에 직접 쓰지 않는다
  const a = code(app);
  if (/from\(['"]friends['"]\)\s*\.\s*(insert|upsert|update|delete)/.test(a)) {
    out.push({ rule: 'F3', msg: "앱이 friends 에 직접 쓴다 — 신청·수락은 RPC 로만 해야 한다(직접 쓰면 남을 임의로 친구로 만들 수 있다)" });
  }
  return out;
}

// ── 자가테스트 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const okSql = `
    add column if not exists share_consent boolean not null default false,
    create policy charts_friend_read on public.charts for select to authenticated
      using (relation='self'
        and exists (select 1 from public.friends f where f.status = 'accepted' and f.a = auth.uid())
        and exists (select 1 from public.profiles p where p.share_consent));`;
  const okApp = `supabase.rpc('friend_request', { p_code: code });`;
  const cases: Array<[string, number]> = [
    ['정상', audit(okSql, okApp).length],
    ['accepted 조건 없음', audit(okSql.replace("f.status = 'accepted'", 'true'), okApp).length],
    ['share_consent 조건 없음', audit(okSql.replace('p.share_consent', 'true'), okApp).length],
    ['정책 자체가 없음', audit(okSql.replace(/create policy charts_friend_read[\s\S]*?;/, ''), okApp).length],
    ['기본값이 true', audit(okSql.replace('default false', 'default true'), okApp).length],
    ['앱이 friends 에 직접 insert', audit(okSql, `supabase.from('friends').insert({ a, b })`).length],
    // ★주석에만 있는 경우는 오탐이면 안 된다
    ['주석 속 insert(정상)', audit(okSql, `// from('friends').insert 는 금지\n` + okApp).length],
  ];
  // ★'정책 없음'은 **F1 하나**다 — 정책이 없으면 그 안의 조건(F2)은 검사할 대상 자체가 없다.
  //   (처음에 2로 적었다가 자가테스트가 잡았다.)
  const want = [0, 1, 1, 1, 1, 1, 0];
  let bad = 0;
  cases.forEach(([n, got], i) => {
    const ok = got === want[i];
    console.log(`  ${ok ? '✓' : '❌'} ${n} → ${got}건 (기대 ${want[i]})`);
    if (!ok) bad++;
  });
  console.log(bad ? `\n❌ 자가테스트 ${bad}건 실패` : `\n✅ check:friendgate 자가테스트 통과 (${cases.length}케이스)`);
  process.exit(bad ? 1 : 0);
}

if (!existsSync(join(ROOT, MIG_DIR))) {
  console.log('⚠️  supabase/migrations 없음 — 스킵(이 저장소에서 Edge/DB 는 gitignore 대상)');
  process.exit(0);
}
const sql = readdirSync(join(ROOT, MIG_DIR)).filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(ROOT, MIG_DIR, f), 'utf8')).join('\n');
/** `friends` 를 언급하는 앱 소스만 모은다(전부 읽으면 느리고 오탐이 는다). */
function collectApp(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) collectApp(p, acc);
    else if (/\.tsx?$/.test(e.name)) {
      const t = readFileSync(join(ROOT, p), 'utf8');
      if (t.includes("'friends'") || t.includes('"friends"')) acc.push(t);
    }
  }
  return acc;
}
const fails = audit(sql, collectApp(APP_DIR).join('\n'));
if (fails.length) {
  console.error(`❌ check:friendgate — ${fails.length}건 · 남의 **생년월일**이 새어 나갈 수 있다`);
  for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:friendgate — 친구 명식 공개는 accepted + share_consent 둘 다 필요(기본 비공개)');
