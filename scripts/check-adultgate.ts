// scripts/check-adultgate.ts — 성인 게이트를 **클라가 선언하지 못하게** 강제한다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-08-31 *"성인대화도 그걸(PASS) 기준으로 성인만"*)
//   실측: `talk` Edge 가 요청 body 의 `adult` 를 **그대로 믿고** 말투를 열었다.
//   즉 아무나 `adult: true` 를 보내면 열렸다 — 기기의 «자기 확인» 이지 신분 확인이 아닌데,
//   그마저도 서버가 검증하지 않았다.
//
// ★이 저장소는 **같은 병을 이미 앓았다** — 결제의 `paid: true` 위변조(2026-06-15).
//   그때 내린 결론이 그대로 적용된다: **서버가 진실의 원천이다.**
//   결론을 사람이 기억하는 대신 규칙으로 옮긴다 — 그래야 다음 리팩터링에서 안 되돌아온다.
//
// 무엇을 지키나
//   A1 성인 말투를 여는 판단이 **요청에서 온 값**으로 이뤄지지 않는가
//      (= body 에서 꺼낸 이름을 그대로 조건에 쓰지 않는가)
//   A2 서버가 **DB 의 확인 기록**(`adult_verified_at`)을 실제로 읽는가
//   A3 «성인이라고 표시하는» RPC 가 클라(authenticated/anon)에 열려 있지 않은가
//      — 열려 있으면 인증을 붙여도 «스스로 성인 선언» 이라 똑같아진다
//
// ★판정은 «뜻» 으로 — 변수 이름을 고정하지 않는다. body 에서 꺼낸 **그 이름**을 따라간다.
// ★음성 테스트: `npx tsx scripts/check-adultgate.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string): string | null => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return null; } };
export const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

// ── 판정기(음성 테스트가 같은 것을 쓴다) ────────────────────────────────────

/**
 * 요청 body 구조분해에서 **`adult` 자리에 붙은 이름**을 돌려준다.
 *
 * `adult = false`        → 'adult'      (그 이름 그대로 쓰면 위험)
 * `adult: adultWanted`   → 'adultWanted'(이름을 갈라 둔 것 — 그래도 조건에 쓰면 위험)
 * 없으면 null.
 */
export function adultBinding(src: string): string | null {
  const s = strip(src);
  const m = s.match(/\badult\s*:\s*(\w+)\s*=/) ?? s.match(/\badult\s*=\s*(?:false|true)/);
  if (!m) return null;
  return m[1] ?? 'adult';
}

/**
 * 성인 말투 지시문을 여는 **조건에 쓰인 이름**을 돌려준다.
 * (`const xxxLine = <이름> ? '…성인…' : ''` 형태를 찾는다)
 */
export function adultGateVar(src: string): string | null {
  const s = strip(src);
  // 「성인 확인을 마쳤다」가 든 삼항의 **조건부**를 잡는다
  const m = s.match(/=\s*(\w+)\s*\n?\s*\?\s*['"`][^'"`]*성인 확인을 마쳤다/);
  return m?.[1] ?? null;
}

/** 서버가 DB 의 확인 기록을 읽는가. */
export function readsVerification(src: string): boolean {
  return /adult_verified_at|is_adult_verified/.test(strip(src));
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const TALK = 'supabase/functions/talk/index.ts';
  const src = read(TALK);
  if (!src) fail('A0', `${TALK} 를 못 읽었다`);
  else {
    const fromBody = adultBinding(src);
    const gate = adultGateVar(src);

    // A1 — 게이트 조건이 body 에서 온 그 이름이면 실패
    if (gate && fromBody && gate === fromBody) {
      fail('A1', `성인 말투를 **요청에서 온 값**(\`${gate}\`)으로 연다.\n        `
        + '아무나 그 값을 보내면 열린다 — 결제의 `paid: true` 위변조와 같은 부류다.\n        '
        + '⇒ body 값은 «원하는가»(선호)로만 쓰고, «허용되는가»는 서버가 DB 에서 읽을 것');
    }
    if (!gate) {
      fail('A1', '성인 말투 지시문을 여는 조건을 못 찾았다 — 문구가 바뀌었나(하네스가 눈이 멀 수 있다)');
    }
    // A2 — DB 확인 기록을 실제로 읽는가
    if (!readsVerification(src)) {
      fail('A2', `${TALK} 가 \`adult_verified_at\`(또는 \`is_adult_verified\`)를 **한 번도 읽지 않는다**.\n        `
        + '서버가 확인 기록을 안 보면 무엇을 근거로 여는지 알 수 없다');
    }
  }

  // A3 — 「성인이라고 표시」가 클라에 열려 있으면 인증을 붙여도 소용없다
  // ★★파일 이름을 박지 않는다 — 정의가 다른 마이그레이션으로 옮겨가면 하네스가 **지워진 함수**를
  //   검사하며 초록불을 낸다(실제로 `…b_adult_verified.sql` → `…c_adult_di.sql` 로 옮겨졌다).
  //   ⇒ **가장 마지막에 그 함수를 만든 파일**을 찾아, 그 파일이 회수까지 했는지 본다.
  //   Supabase 는 CREATE 때마다 anon·authenticated 에 EXECUTE 를 다시 달아 주므로,
  //   «만든 파일이 곧 회수해야» 맞다.
  const migDir = 'supabase/migrations';
  const names = (() => { try { return readdirSync(join(ROOT, migDir)).filter((n) => n.endsWith('.sql')).sort(); } catch { return []; } })();
  const creators = names.filter((n) => /create\s+(or\s+replace\s+)?function\s+(public\.)?mark_adult_verified/i.test(strip(read(`${migDir}/${n}`) ?? '')));
  const last = creators.at(-1);
  if (!last) fail('A3', '`mark_adult_verified` 를 만드는 마이그레이션을 못 찾았다');
  else {
    const mig = strip(read(`${migDir}/${last}`) ?? '');
    const revokes = mig.split(';').filter((x) => /revoke/i.test(x) && /mark_adult_verified/i.test(x)).join(' ');
    const anon = /\banon\b/i.test(revokes);
    const authed = /\bauthenticated\b/i.test(revokes);
    if (!anon || !authed) {
      fail('A3', `\`mark_adult_verified\` 권한 회수가 부족하다 — 마지막 정의 \`${last}\`(anon=${anon ? 'ok' : '없음'} · authenticated=${authed ? 'ok' : '없음'}).\n        `
        + '⚠️`revoke … from public` 만으로는 안 뺏긴다 — Supabase 가 새 함수마다 그 롤들에 EXECUTE 를 **직접** 준다.\n        '
        + '클라가 이걸 부를 수 있으면 «스스로 성인 선언» 이라 본인인증을 붙인 의미가 사라진다');
    }
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const GATE = (v: string) => `const adultLine = ${v}\n ? '[★이 회원은 성인 확인을 마쳤다. …]' : '';`;
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'body 이름을 그대로 읽는다', run: () => adultBinding('const { a, adult = false, b } = body;') === 'adult' },
    { name: '이름을 갈라 둔 것도 읽는다', run: () => adultBinding('const { adult: adultWanted = false } = body;') === 'adultWanted' },
    { name: 'adult 가 없으면 null', run: () => adultBinding('const { lang = "ko" } = body;') === null },
    { name: '게이트 조건 변수를 찾는다', run: () => adultGateVar(GATE('adultOk')) === 'adultOk' },
    { name: '게이트 문구가 없으면 null', run: () => adultGateVar("const x = y ? 'hello' : '';") === null },
    { name: '★body 값으로 여는 형태를 문다',
      run: () => { const src = 'const { adult = false } = body;\n' + GATE('adult');
        return adultGateVar(src) === adultBinding(src); } },
    { name: '★서버 값으로 여는 형태는 통과',
      run: () => { const src = 'const { adult: adultWanted = false } = body;\nlet adultOk = false;\n' + GATE('adultOk');
        return adultGateVar(src) !== adultBinding(src); } },
    { name: 'DB 확인 기록을 읽는지 본다',
      run: () => readsVerification('select("adult_verified_at")') === true && readsVerification('const x = 1;') === false },
    { name: '주석 속 코드에 안 속는다',
      run: () => adultBinding('// const { adult = false } = body;\nconst y = 1;') === null },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:adultgate — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:adultgate — 성인 여부는 서버가 DB 에서 판정하고, 클라는 스스로 선언할 수 없다');
