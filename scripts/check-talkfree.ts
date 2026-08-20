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
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const P_VT = 'app/src/lib/talk/virtualTalk.ts';
const P_CS = 'app/src/lib/talk/consultants.ts';
// ⚠️★단일 파일을 보면 안 된다(2026-08-20에 잡힘) — 상담사 시드는 **여러 마이그레이션에 흩어진다**.
//   `0026` 만 보다가 `0028` 에서 추가한 「노쎔」을 못 읽어 '씨앗 불일치'로 잘못 실패했다.
//   ⇒ `consultants` 에 insert 하는 마이그레이션을 전부 모아서 본다(다음에 0029 가 생겨도 자동).
const MIG_DIR = 'supabase/migrations';

type Fail = { rule: string; msg: string };

/**
 * 주석을 걷어낸 소스 — '주석에 그렇게 적혀 있다'는 근거가 아니다.
 *
 * ⚠️★줄 **끝** 주석도 지운다. 처음엔 줄 맨앞 슬래시둘만(줄 전체 주석) 지웠는데,
 * (그 정규식을 여기 그대로 적으면 별+슬래시가 이 주석 블록을 닫아 버려서 풀어 썼다)
 *   실제 파일 역테스트에서 이게 하네스를 통째로 무력화하는 것이 잡혔다 —
 *   `import … // ★cache_control.ttl:'1h' 가 0.100 부터 …` 라고 **설명해 둔 주석**이 코드로 읽혀서,
 *   진짜 코드를 5m 으로 바꿔도 검사가 통과했다. 자가테스트는 멀쩡히 초록불이었다.
 *   ⇒ 하네스를 자기가 지키는 파일의 주석이 속일 수 있다. 반드시 **역테스트**로 확인할 것.
 * ⚠️`https://` 의 `//` 는 남긴다(`(?<!:)`) — 안 그러면 import 줄이 잘려 엉뚱한 판정이 된다.
 */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');

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

  // F5 — 준비 중(enabled=false)인 상담사가 목록에 뜨면 안 된다
  //   ★RLS 만 믿으면 안 된다: 관리자 정책이 `for all` 이라 관리자에겐 비활성 행도 보인다(정책은 OR).
  //     실제로 말투 검수 전인 「노쎔」이 친구목록에 떠 있었다 — 첫인상은 두 번 오지 않는다.
  if (!/\.eq\('enabled',\s*true\)/.test(code(cs))) {
    out.push({ rule: 'F5', msg: `${P_CS} 가 enabled=true 로 거르지 않는다 — 준비 중인 상담사가 관리자 화면에 노출된다(RLS 로는 안 막힌다)` });
  }

  // F4 — 씨앗이 같은가
  const appIds = [...code(cs).matchAll(/id:\s*'([a-z_]+)',\s*kind:/g)].map((m) => m[1]).sort();
  // ⚠️`insert … values` 블록 안에서만 찾는다 — 그러지 않으면
  //   `check (kind in ('virtual','live'))` 같은 **제약 조건**이 씨앗으로 잡힌다(실제로 그랬다).
  //   ★insert 가 **여러 개**일 수 있으므로 전부 모은다(matchAll) — 하나만 보면 나중에 추가한 상담사를 놓친다.
  const blocks = [...mig.matchAll(/insert into public\.consultants[\s\S]*?;/g)].map((m) => m[0]).join('\n');
  const sqlIds = [...new Set([...blocks.matchAll(/\('([a-z_]+)',\s*'(virtual|live)'/g)].map((m) => m[1]))].sort();
  // ★★비교는 **부분집합**이다(2026-08-20에 규칙을 고쳤다).
  //   종전엔 두 집합이 **완전히 같아야** 했는데, 그 뒤 「상담가를 끈다」는 개념이 생겼다
  //   (다섯으로 압축하며 옛 넷을 `enabled=false` 로 두었다 — 지우면 대화 이력이 함께 사라진다).
  //   그러면 SQL 에는 남고 앱 씨앗에는 없는 id 가 정상인데, 옛 규칙은 그걸 실패로 봤다.
  //   ⇒ 진짜 위험은 **반대 방향**이다: 앱에만 있고 서버에 없는 id =
  //     앱이 서버에 없는 상담가를 만들어낸 것(오프라인에서 다른 앱이 된다).
  //   ⚠️[[harness-can-enforce-wrong-rule]] — 상황이 바뀌면 코드보다 하네스를 먼저 본다.
  const sqlSet = new Set(sqlIds);
  const ghosts = appIds.filter((id) => !sqlSet.has(id));
  if (!appIds.length || !sqlIds.length) {
    out.push({ rule: 'F4', msg: `씨앗을 못 읽었다 (앱 ${appIds.length} · SQL ${sqlIds.length})` });
  } else if (ghosts.length) {
    out.push({ rule: 'F4', msg: `앱 씨앗에만 있는 상담가: ${ghosts.join(',')} — 서버에 없는 사람을 앱이 만들어냈다(오프라인에서 다른 앱이 된다)` });
  }
  return out;
}

// ── 자가테스트 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const vtOk = `export function greet(){ return { bubbles: [], links: [], source: 'script' }; }
export function todayFlow(){ return { bubbles: [], links: [], source: 'engine' }; }`;
  const csOk = `.eq('enabled', true)
kind: r.kind === 'live' ? 'live' : 'virtual',
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
    // ⚠️이 케이스는 F3 만 보려는 것이므로 다른 규칙(F5 enabled 필터)은 만족시켜 둔다 —
    //   안 그러면 무엇이 걸렸는지가 흐려진다(자가테스트가 먼저 알려 줬다).
    ['앱이 kind 를 지어냄', audit(vtOk, `.eq('enabled', true)\nkind: 'live',\nconst SEED = [ { id: 'wealth_guide', kind: 'virtual' }, { id: 'myeongun', kind: 'live' } ];`, migOk).length],
    // ⚠️이 케이스는 **기대값이 바뀌었다** — SQL 쪽 id 가 달라도 앱 씨앗이 그 부분집합이 아니면
    //   잡힌다. 여기선 앱에 `myeongun` 이 있고 SQL 엔 `other` 뿐이라 여전히 유령으로 잡힌다.
    ['앱 씨앗이 SQL 에 없음', audit(vtOk, csOk, migOk.replace("('myeongun', 'live'", "('other', 'live'")).length],
    // ★주석에만 fetch 가 적힌 경우 — 오탐이면 안 된다
    ['주석 속 fetch(정상)', audit(`// fetch 를 쓰지 않는다\n` + vtOk, csOk, migOk).length],
    ['enabled 필터 없음', audit(vtOk, csOk.replace(".eq('enabled', true)", ''), migOk).length],
    // ★★이번에 하네스가 틀린 모양 — 시드가 **두 마이그레이션에 나뉘어** 있다.
    //   합쳐서 보면 앱 씨앗과 같으므로 통과해야 한다(예전 코드는 첫 insert 만 보고 실패시켰다).
    // ★끈 상담가는 SQL 에만 남는다 — **정상**이다(옛 규칙은 이걸 실패로 봤다)
    ['SQL 에만 있는 옛 상담가(정상)', audit(
      vtOk, csOk,
      migOk + `\ninsert into public.consultants (id, kind) values\n  ('old_guide', 'virtual', …);`,
    ).length],
    // 반대 방향은 여전히 잡아야 한다 — 앱이 서버에 없는 사람을 만들어낸 경우
    ['앱에만 있는 유령 상담가', audit(
      vtOk, csOk + `\n{ id: 'ghost_guide', kind: 'virtual' }`, migOk,
    ).length],
    ['시드가 두 파일에 나뉨(정상)', audit(
      vtOk,
      csOk + `\n{ id: 'nossem', kind: 'live' }`,
      migOk + `\ninsert into public.consultants (id, kind) values\n  ('nossem', 'live', …);`,
    ).length],
  ];
  const want = [0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0];
  let bad = 0;
  cases.forEach(([n, got], i) => {
    const ok = got === want[i];
    console.log(`  ${ok ? '✓' : '❌'} ${n} → ${got}건 (기대 ${want[i]})`);
    if (!ok) bad++;
  });
  console.log(bad ? `\n❌ 자가테스트 ${bad}건 실패` : '\n✅ check:talkfree 자가테스트 통과 (11케이스)');
  process.exit(bad ? 1 : 0);
}

// 상담사 시드가 든 마이그레이션을 **전부** 읽어 합친다
const migAll = readdirSync(join(ROOT, MIG_DIR))
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(ROOT, MIG_DIR, f), 'utf8'))
  .filter((t) => /insert into public\.consultants/.test(t))
  .join('\n');
const fails = audit(
  readFileSync(join(ROOT, P_VT), 'utf8'),
  readFileSync(join(ROOT, P_CS), 'utf8'),
  migAll,
);
if (fails.length) {
  console.error(`❌ check:talkfree — ${fails.length}건 · 가상 상담사의 원가 0 전제가 깨진다`);
  for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:talkfree — 가상 상담사는 LLM 을 부르지 않는다(원가 0)');
