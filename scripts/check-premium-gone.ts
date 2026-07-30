// scripts/check-premium-gone.ts — 폐지된 '프리미엄'이 사용자 문구에 남아 있는가
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-30 (IMG_8307): "여기도 프리미엄 빠졌으니깐 바꿔야지 … 전수조사해"
//
// ★배경: 프리미엄 구독은 07-28 에 폐지되고 **코인 단일화폐**로 갔다. 결제 경로도 코인이다
//   (추가 질문은 이미 `ensureCoinsFor('followup')` 로 10코인을 쓴다).
//   그런데 **문구만 프리미엄으로 남아** "프리미엄으로 더 물어보기" 버튼이 보였다.
//   기능과 문구가 어긋나면 사용자는 없는 상품을 찾게 된다.
//
// ⚠️예외(의도적으로 남기는 것):
//   · admin.tsx — 관리자 화면. 구 데이터(프리미엄 유저 수 등)를 봐야 한다.
//   · *.validate.ts — 과거 가격 정책 회귀 픽스처.
//   · GemCard 의 '프리미엄' — **보석 가격대 티어**(프리미엄/스탠다드/합리적)라 구독과 무관하다.
//
// 실행: npm run check:premium-gone
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const files: string[] = [];
const walk = (d: string) => {
  let ents: any[]; try { ents = readdirSync(`${ROOT}${d}`, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = `${d}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
};
walk('app/src');

const EXEMPT = [/\/admin\.tsx$/, /\.validate\.ts$/, /\/GemCard\.tsx$/];

let fail = 0;
console.log('\n🔎 폐지된 프리미엄 문구 잔존\n');
const hits: string[] = [];
for (const f of files) {
  if (EXEMPT.some((re) => re.test(f))) continue;
  const src = readFileSync(`${ROOT}${f}`, 'utf8');
  src.split('\n').forEach((line, i) => {
    const code = line.split('//')[0];
    if (!code.includes('프리미엄')) return;
    for (const m of code.matchAll(/(['"`])([^'"`]*프리미엄[^'"`]*)\1/g)) {
      hits.push(`${f.replace('/app/src/', '')}:${i + 1} 「${m[2].slice(0, 46)}」`);
    }
  });
}
if (!hits.length) console.log('  ✓ 사용자 노출 문구에 프리미엄 없음(결제는 코인 단일 경로)');
else { hits.forEach((h) => console.error(`  ✗ ${h}`)); fail = hits.length; }

console.log(fail ? `\n❌ check:premium-gone 실패 ${fail}건 — 기능은 코인인데 문구가 프리미엄이면 없는 상품을 찾게 된다` : '\n✅ check:premium-gone 통과');
process.exit(fail ? 1 : 0);
