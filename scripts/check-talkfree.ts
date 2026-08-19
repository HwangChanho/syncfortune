#!/usr/bin/env tsx
/**
 * check:talkfree — 가상 상담사가 **정말로 원가 0인가**.
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜 생겼나 (Boss 2026-08-19 *"가상의 상담사들도 있을꺼야 실제 상담사는 1명만있어"*)
 *   이 설계의 경제성은 통째로 **“가상은 LLM 을 안 부른다”**에 걸려 있다.
 *   실측: 하루 10턴을 '가상 8 + 실제 2' 로 나누면 하루 ₩45 → ₩17 로 61% 절감된다.
 *   그런데 이건 **코드가 지켜야 성립하는 약속**이다 — 누군가 가상 경로에 LLM 한 줄만 넣어도
 *   MAU 10만 기준 월 ₩5,202만이 ₩1억 3,438만으로 뛴다. **그리고 화면상으로는 아무 차이가 없다.**
 *
 * 규칙
 *   F1 `virtualTalk.ts` 가 LLM 을 부르지 않는다 — supabase.functions / anthropic / fetch 금지
 *   F2 가상 답의 `source` 는 언제나 `script` 또는 `engine`(= 원가 0)
 *   F3 `consultants.ts` 가 서버의 `kind` 를 그대로 옮긴다 — 앱이 `live` 를 만들어내지 않는다
 *   F4 마이그레이션의 씨앗과 앱의 `SEED` 가 **같은 상담사 id 집합**이다
 *      (갈리면 오프라인에서 다른 앱이 된다)
 *
 * 사용: npm run check:talkfree · 자가테스트: npx tsx scripts/check-talkfree.ts --selftest
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const P_VT = 'app/src/lib/talk/virtualTalk.ts';
const P_CS = 'app/src/lib/talk/consultants.ts';
const P_MIG = 'supabase/migrations/0026_consultant_talk.sql';

type Fail = { rule: string; msg: string };

/** 주석을 걷어낸 소스 — '주석에 적힌 말'이 아니라 코드로 판정한다. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * 가상 경로가 원가 0을 지키는지 검사한다.
 *
 * @param vt  `virtualTalk.ts` 원문
 * @param cs  `consultants.ts` 원문
 * @param mig 마이그레이션 SQL 원문
 * @returns 위반 목록
 */
export function audit(vt: string, cs: string, mig: string): Fail[] {
  const out: Fail[] = [];
  const v = code(vt);

  // F1 — LLM 을 부를 수 있는 통로가 아예 없어야 한다
  for (const [pat, what] of [
    [/functions\.invoke/, 'supabase.functions.invoke'],
    [/anthropic|claude-/i, 'Anthropic 직접 호출'],
    [/\bfetch\s*\(/, 'fetch'],
  ] as Array<[RegExp, string]>) {
    if (pat.test(v)) out.push({ rule: 'F1', msg: `${P_VT} 에 ${what} 가 있다 — 가상 상담사는 LLM 을 부르면 안 된다(원가 0 전제가 깨진다)` });
  }

  // F2 — source 는 script|engine 만
  const sources = [...v.matchAll(/source:\s*'([a-z]+)'/g)].map((m) => m[1]);
  if (!sources.length) out.push({ rule: 'F2', msg: `${P_VT} 에서 source 를 못 읽었다 — 계측이 끊긴다` });
  for (const s of new Set(sources)) {
    if (s !== 'script' && s !== 'engine') {
      out.push({ rule: 'F2', msg: `${P_VT} 가 source '${s}' 를 낸다 — 가상 답은 script|engine 뿐이어야 한다` });
    }
  }

  // F3 — 앱이 kind 를 지어내지 않는다(서버 값을 옮기기만)
  if (!/r\.kind === 'live' \? 'live' : 'virtual'/.test(code(cs))) {
    out.push({ rule: 'F3', msg: `${P_CS} 가 서버 kind 를 그대로 옮기지 않는다 — 앱이 과금 경로를 정하면 안 된다` });
  }

  // F4 — 씨앗이 같은가
  const appIds = [...code(cs).matchAll(/id:\s*'([a-z_]+)',\s*kind:/g)].map((m) => m[1]).sort();
  // ⚠️`insert … values` 블록 안에서만 찾는다 — 그러지 않으면
  //   `check (kind in ('virtual','live'))` 같은 **제약 조건**이 씨앗으로 잡힌다(실제로 그랬다).
  const valuesBlock = mig.match(/insert into public\.consultants[\s\S]*?;/)?.[0] ?? '';
  const sqlIds = [...valuesBlock.matchAll(/\('([a-z_]+)',\s*'(virtual|live)'/g)].map((m) => m[1]).sort();
  if (!appIds.length || !sqlIds.length) {
    out.push({ rule: 'F4', msg: `씨앗을 못 읽었다 (앱 ${appIds.length} · SQL ${sqlIds.length})` });
  } else if (appIds.join(',') !== sqlIds.join(',')) {
    out.push({ rule: 'F4', msg: `씨앗이 다르다 — 앱[${appIds.join(',')}] vs SQL[${sqlIds.join(',')}]. 오프라인에서 다른 앱이 된다` });
  }
  return out;
}

// ── 자가테스트 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const vtOk = `export function greet(){ return { bubbles: [], links: [], source: 'script' }; }
export function todayFlow(){ return { bubbles: [], links: [], source: 'engine' }; }`;
  const csOk = `kind: r.kind === 'live' ? 'live' : 'virtual',
const SEED = [ { id: 'wealth_guide', kind: 'virtual' }, { id: 'myeongun', kind: 'live' } ];`;
  const migOk = `create table consultants ( kind text check (kind in ('virtual','live')) );
insert into public.consultants (id, kind) values
  ('wealth_guide', 'virtual', …),
  ('myeongun', 'live', …);`;
  const cases: Array<[string, number]> = [
    ['정상', audit(vtOk, csOk, migOk).length],
    ['가상이 Edge 를 부름', audit(vtOk + `\nsupabase.functions.invoke('talk')`, csOk, migOk).length],
    ['가상이 fetch 를 씀', audit(vtOk + `\nawait fetch(url)`, csOk, migOk).length],
    ['source 가 llm', audit(vtOk.replace("'script'", "'llm'"), csOk, migOk).length],
    ['앱이 kind 를 지어냄', audit(vtOk, `kind: 'live',\nconst SEED = [ { id: 'wealth_guide', kind: 'virtual' }, { id: 'myeongun', kind: 'live' } ];`, migOk).length],
    ['씨앗 불일치', audit(vtOk, csOk, migOk.replace("('myeongun', 'live'", "('other', 'live'")).length],
    // ★주석에만 fetch 가 적힌 경우 — 오탐이면 안 된다
    ['주석 속 fetch(정상)', audit(`// fetch 를 쓰지 않는다\n` + vtOk, csOk, migOk).length],
  ];
  const want = [0, 1, 1, 1, 1, 1, 0];
  let bad = 0;
  cases.forEach(([n, got], i) => {
    const ok = got === want[i];
    console.log(`  ${ok ? '✓' : '❌'} ${n} → ${got}건 (기대 ${want[i]})`);
    if (!ok) bad++;
  });
  console.log(bad ? `\n❌ 자가테스트 ${bad}건 실패` : '\n✅ check:talkfree 자가테스트 통과 (7케이스)');
  process.exit(bad ? 1 : 0);
}

const fails = audit(
  readFileSync(join(ROOT, P_VT), 'utf8'),
  readFileSync(join(ROOT, P_CS), 'utf8'),
  readFileSync(join(ROOT, P_MIG), 'utf8'),
);
if (fails.length) {
  console.error(`❌ check:talkfree — ${fails.length}건 · 가상 상담사의 원가 0 전제가 깨진다`);
  for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:talkfree — 가상 상담사는 LLM 을 부르지 않는다(원가 0)');
