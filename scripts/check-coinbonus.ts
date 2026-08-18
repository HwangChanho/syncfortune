// scripts/check-coinbonus.ts — 「보너스 운이 조작될 수 있는가」를 코드에서 막는다
// ─────────────────────────────────────────────────────────────────────────
// 왜: 2026-08-18 운 충전 보너스(쿠폰)를 붙였다. 이건 **돈이 늘어나는 경로**다.
//   우리는 이 근처에서 이미 사고를 두 번 겪었다([[double-charge-unlock-claim]]·[[alert-double-fire-crash]]).
//   그래서 "지금 코드가 맞다"가 아니라 **"앞으로도 이렇게만 쓰이게"** 를 검사한다.
//
// [B1] 앱이 보너스 **금액·비율을 서버로 넘기지 않는다**
//      `claim_coin_bonus` 는 인자가 없다. 인자를 넣는 순간 클라가 액수를 정하게 된다 = 무한 충전.
// [B2] 앱이 `coin_coupons` 에 **쓰지 않는다**(insert/update/upsert/delete)
//      쿠폰을 스스로 발급할 수 있으면 그것도 무한 충전이다. 발급은 관리자 RPC 만.
// [B3] 앱이 `grant_coins` 를 직접 부르지 않는다(적립은 웹훅·서버 함수만)
// [B4] 보너스 지급이 **로깅된다** — 분쟁이 나면 근거가 필요하다
//
// ★음성 테스트(`--selftest`)로 규칙이 실제 문자열을 잡는지 확인한다
//   (규칙을 고쳐 놓고 아무것도 안 잡는 초록불이 되는 게 이 프로젝트의 반복 함정이다).
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

/** 검사 규칙 — [이름, 잡아야 할 정규식, 설명] */
const RULES: Array<[string, RegExp, string]> = [
  ['B1', /rpc\(\s*['"]claim_coin_bonus['"]\s*,/,
    "앱이 `claim_coin_bonus` 에 **인자를 넘긴다** — 액수를 클라가 정하면 무한 충전이 된다"],
  ['B2', /from\(\s*['"]coin_coupons['"]\s*\)\s*\.\s*(insert|update|upsert|delete)/,
    '앱이 `coin_coupons` 에 쓴다 — 쿠폰을 스스로 발급할 수 있으면 무한 충전이다(발급은 관리자 RPC 만)'],
  ['B3', /rpc\(\s*['"]grant_coins['"]/,
    '앱이 `grant_coins` 를 직접 부른다 — 적립은 결제 웹훅·서버 함수만 한다'],
  // ★2026-08-18 첫 충전 쿠폰 — 자격 판정(충전 이력 유무)은 **전부 서버**다.
  //   앱이 인자를 넘기는 순간 "나 신규야"라고 말할 수 있게 되고, 그건 무한 발급이다.
  ['B5', /rpc\(\s*['"]claim_welcome_coupon['"]\s*,/,
    "앱이 `claim_welcome_coupon` 에 **인자를 넘긴다** — 자격을 클라가 주장하면 무한 발급이 된다"],
];

const files = walk('app/src');
const bad: string[] = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  src.split('\n').forEach((ln, i) => {
    if (/^\s*(\/\/|\*)/.test(ln)) return;                    // 주석 줄은 건너뛴다
    for (const [id, re, why] of RULES) {
      if (re.test(ln)) bad.push(`[${id}] ${f}:${i + 1}  ${why}\n         ${ln.trim().slice(0, 110)}`);
    }
  });
}

// [B4] 지급 로깅 — 값으로 확인(주석이 아니라 코드에 있는지)
const bonusSrc = (() => { try { return readFileSync('app/src/lib/billing/coinBonus.ts', 'utf8'); } catch { return ''; } })();
if (bonusSrc && !/logEvent\(\s*['"]coin_bonus_claimed['"]/.test(bonusSrc)) {
  bad.push('[B4] app/src/lib/billing/coinBonus.ts — 보너스 지급이 로깅되지 않는다(분쟁 시 근거가 없다)');
}

if (process.argv.includes('--selftest')) {
  // 규칙이 실제로 무엇을 잡는지 — 양성/음성 양쪽
  const cases: Array<[string, string, boolean]> = [
    ['B1', "await supabase.rpc('claim_coin_bonus', { p_amount: 999 })", true],
    ['B1', "await supabase.rpc('claim_coin_bonus')", false],
    ['B2', "supabase.from('coin_coupons').insert({ bonus_pct: 100 })", true],
    ['B2', "supabase.from('coin_coupons').select('id, bonus_pct')", false],
    ['B3', "supabase.rpc('grant_coins', { p_amount: 9999 })", true],
    ['B3', "supabase.rpc('claim_coin_bonus')", false],
    ['B5', "supabase.rpc('claim_welcome_coupon', { p_owner: id })", true],
    ['B5', "await supabase.rpc('claim_welcome_coupon')", false],
  ];
  let n = 0;
  for (const [id, line, want] of cases) {
    const re = RULES.find(([r]) => r === id)![1];
    const got = re.test(line);
    if (got !== want) { n++; console.error(`   ✗ [${id}] "${line}" — 기대 ${want ? '적발' : '통과'} / 실제 ${got ? '적발' : '통과'}`); }
  }
  console.log(n ? `\n❌ 자가 테스트 ${n}건 실패\n` : `\n✅ 자가 테스트 ${cases.length}건 통과\n`);
  process.exit(n ? 1 : 0);
}

console.log(`\n🎫 보너스 운이 조작될 수 있는가 (${files.length}파일)`);
if (bad.length) {
  console.error(`\n❌ 위반 ${bad.length}건 — 돈이 늘어나는 경로다\n`);
  bad.forEach((b) => console.error('   ' + b));
  console.error('');
  process.exit(1);
}
console.log('   ✅ 앱은 보너스를 **청구만** 한다 — 금액·쿠폰 발급은 전부 서버가 정한다.\n');
