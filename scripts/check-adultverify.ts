// scripts/check-adultverify.ts — **PASS 본인인증**이 자기 신고로 무너지지 않게
// ═══════════════════════════════════════════════════════════════════════════
// ★Boss 2026-09-03: *"pass를 붙여야지"* · *"성인 대화는 무조건 돼야해"*
//
// ■ 이 게이트가 틀리면 **미성년이 통과한다.** 그래서 «되는가» 보다 «안 되는 길이 막혔는가» 를 본다.
//
// 무엇을 지키나
//   V1 ★앱이 보내는 것은 `imp_uid` **하나뿐**이다
//      — 이름·생년월일·성인여부를 앱이 보내면 그건 자기 신고다(게이트가 아니다)
//   V2 ★나이를 **서버가** 센다(`ageFrom`) — 그리고 **19 미만이면 막는다**
//   V3 ★DI 원문을 저장하지 않는다 — `sha256(pepper + DI)` 만 넘긴다
//   V4 ★키가 없으면 **아무것도 안 한다**(`not_configured`) — «붙은 척» 이 가장 나쁘다
//   V5 ★인증 페이지가 **아무 데로나 돌려보내지 않는다**(열린 리다이렉터 금지)
//   V6 ★만 나이 셈이 맞다 — 생일 전이면 한 살 어리다
//
// ★음성 테스트: `npx tsx scripts/check-adultverify.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const EDGE = 'supabase/functions/adult-verify/index.ts';
const PAGE = 'app/public/pass.html';
const CLIENT = 'app/src/lib/talk/adultVerify.ts';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });
const read = (f: string) => (existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f), 'utf8') : null);
/**
 * ★주석을 걷는다. ⚠️안 걷었다가 **두 규칙이 안 물었다**(V3·V4):
 *   해시를 안 쓰게 바꿔도 `hashDi` 라는 **함수 선언**이 남아 통과했고,
 *   키 검사를 지워도 `not_configured` 가 **파일 머리 주석**에 남아 통과했다.
 * ★오늘만 세 번째 같은 실수다 — 하네스는 «글자가 있나» 가 아니라 **«그 길로 도는가»** 를 봐야 한다.
 */
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** 만 나이 — Edge 의 `ageFrom` 과 **같은 규칙**(여기서 따로 세면 두 셈이 갈린다). */
export function ageFrom(birth: string, today: Date): number | null {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(String(birth ?? '').trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!y || !mo || !d) return null;
  let age = today.getFullYear() - y;
  const past = today.getMonth() + 1 > mo || (today.getMonth() + 1 === mo && today.getDate() >= d);
  if (!past) age -= 1;
  return age;
}

function run() {
  const raw = read(EDGE);
  if (!raw) { fail('V1', `${EDGE} 가 없다 — **못 쟀다**`); return; }
  const edge = strip(raw);          // ★주석은 코드가 아니다(위 주석)

  // V1 — 앱이 보내는 값
  if (!/const \{ impUid \} = await req\.json\(\)/.test(edge)) {
    fail('V1', 'Edge 가 요청에서 `impUid` 만 꺼내지 않는다 — 앱이 보낸 다른 값을 쓰면 자기 신고가 된다');
  }
  for (const bad of ['body.birthday', 'body.name', 'body.adult', 'body.age']) {
    if (edge.includes(bad)) fail('V1', `Edge 가 앱이 보낸 \`${bad}\` 를 쓴다 — **믿으면 안 되는 값**이다`);
  }
  const client = read(CLIENT);
  if (client && /invoke\('adult-verify'[^)]*body:\s*\{([^}]*)\}/.test(client)) {
    const body = /invoke\('adult-verify'[^)]*body:\s*\{([^}]*)\}/.exec(client)![1];
    if (/birth|name|age|adult/i.test(body)) {
      fail('V1', `앱이 [${body.trim()}] 를 보낸다 — **impUid 하나만** 보내야 한다`);
    }
  }

  // V2 — 서버가 나이를 세고 19 미만을 막는다
  if (!/ageFrom\(/.test(edge)) fail('V2', 'Edge 가 나이를 세지 않는다');
  if (!/age\s*<\s*19/.test(edge)) fail('V2', "★19 미만을 막는 줄이 없다 — 이 한 줄이 게이트의 전부다");
  if (!/info\.birthday/.test(edge)) fail('V2', '나이의 근거가 **제공사가 준 생년월일**이 아니다');

  // V3 — DI 해시
  {
    // ★«해시 함수가 있나» 가 아니라 **«넘기는 값이 해시에서 왔나»** 를 본다.
    const m = /p_di_hash:\s*([A-Za-z_$][\w$]*)/.exec(edge);
    const varName = m?.[1];
    const fromHash = varName
      ? new RegExp(`(const|let)\\s+${varName}\\s*=\\s*await\\s+hashDi\\(`).test(edge)
      : false;
    if (!fromHash) {
      fail('V3', `★\`mark_adult_verified\` 에 넘기는 값(${varName ?? '못 찾음'})이 **해시에서 오지 않는다** — DI 원문을 저장하면 안 된다`);
    }
  }
  if (!/SHA-256/.test(edge)) fail('V3', 'sha256 을 안 쓴다');
  if (!/ADULT_DI_PEPPER/.test(edge)) fail('V3', '★pepper 가 없다 — DI 는 짧아서 해시만으로는 되찾을 수 있다');

  // V4 — 키 없으면 무동작
  // ★주석이 아니라 **되돌리는 줄**이 있는지 본다(주석에 낱말만 남아도 통과하면 안 된다)
  if (!/return json\(\{[^}]*not_configured[^}]*\}/.test(edge)) {
    fail('V4', '★키가 없을 때 **아무것도 안 하고 되돌리는** 줄이 없다');
  }

  // V5 — 열린 리다이렉터 금지
  const page = read(PAGE) ? strip(read(PAGE)!) : null;
  if (!page) fail('V5', `${PAGE} 가 없다 — **못 쟀다**`);
  else if (!/function allowed\(/.test(page) || !/hostname === location\.hostname/.test(page)) {
    fail('V5', '★인증 페이지가 돌아갈 곳을 **가리지 않는다** — 남의 사이트로 결과를 흘려보낼 수 있다');
  }
}

if (process.argv.includes('--selftest')) {
  const D = (s: string) => new Date(s + 'T12:00:00Z');
  const cs: { name: string; run: () => boolean }[] = [
    { name: 'V6 만 나이 — 생일 지남', run: () => ageFrom('20000301', D('2026-09-03')) === 26 },
    { name: 'V6 ★생일 전이면 한 살 어리다', run: () => ageFrom('20001201', D('2026-09-03')) === 25 },
    { name: 'V6 ★생일 당일은 센다', run: () => ageFrom('20000903', D('2026-09-03')) === 26 },
    { name: 'V6 하이픈도 읽는다', run: () => ageFrom('2000-03-01', D('2026-09-03')) === 26 },
    { name: 'V6 ★이상한 값은 null', run: () => ageFrom('', D('2026-09-03')) === null && ageFrom('20261', D('2026-09-03')) === null },
    { name: 'V6 ★★열여덟은 19 미만이다', run: () => (ageFrom('20080101', D('2026-09-03')) ?? 0) < 19 },
    { name: 'V6 ★열아홉은 통과다', run: () => (ageFrom('20070101', D('2026-09-03')) ?? 0) >= 19 },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cs) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  run();
  if (out.length) {
    console.error(`❌ check:adultverify — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:adultverify — 앱은 imp_uid 만 보내고, 나이·DI 판정은 서버가 한다');
}
