// repurchase.validate.ts — 재구매 판정 검증(daniel: 수익구조 테스트까지 확실히). 실행: npx tsx app/src/lib/billing/repurchase.validate.ts
import { categoryYear, needsYearRepurchase, currentYearCategory, offerPremiumRenewal, renewalPrice, discountPercent } from './repurchase';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}  ${detail}`); } }

const now2027 = new Date('2027-03-15T00:00:00Z');

console.log('── categoryYear(연도 파싱) ──');
check('newyear_2027 → 2027', categoryYear('newyear_2027') === 2027);
check('year_2026 → 2026', categoryYear('year_2026') === 2026);
check('compat_abc_y2027 → 2027(y접두)', categoryYear('compat_abc_y2027') === 2027);
check('love(연도무관) → null', categoryYear('love') === null);
check('saju → null', categoryYear('saju') === null);
check('범위밖 x_1999 → null', categoryYear('x_1999') === null);

console.log('── needsYearRepurchase(now=2027) ──');
check('newyear_2026(지난해) → 재구매', needsYearRepurchase('newyear_2026', now2027) === true);
check('newyear_2027(올해) → 재구매 아님', needsYearRepurchase('newyear_2027', now2027) === false);
check('newyear_2028(미래) → 재구매 아님', needsYearRepurchase('newyear_2028', now2027) === false);
check('love(연도무관) → 재구매 아님', needsYearRepurchase('love', now2027) === false);

console.log('── currentYearCategory(재구매 향할 곳) ──');
check('newyear_2026 → newyear_2027(현재)', currentYearCategory('newyear_2026', now2027) === 'newyear_2027');
check('love → love(그대로)', currentYearCategory('love', now2027) === 'love');
check('year_2025 → year_2027', currentYearCategory('year_2025', now2027) === 'year_2027');

console.log('── offerPremiumRenewal(구매 1년 경과) ──');
check('11개월 전(2026-05) → 갱신 아님', offerPremiumRenewal('2026-05-01', now2027) === false);
check('14개월+ 전(2026-01) → 갱신', offerPremiumRenewal('2026-01-01', now2027) === true);
check('정확히 1년(2026-03-15) → 갱신', offerPremiumRenewal('2026-03-15', now2027) === true);
check('null 구매일 → 갱신 아님', offerPremiumRenewal(null, now2027) === false);
check('잘못된 날짜 → 갱신 아님', offerPremiumRenewal('bad-date', now2027) === false);

console.log('── renewalPrice / discountPercent(표시가) ──');
check('49900 × 0.7 → 34900(100원 반올림)', renewalPrice(49900) === 34900, `got ${renewalPrice(49900)}`);
check('9900 × 0.7 → 6900', renewalPrice(9900) === 6900, `got ${renewalPrice(9900)}`);
check('할인율 49900→34900 ≈ 30%', discountPercent(49900, 34900) === 30, `got ${discountPercent(49900, 34900)}`);
check('정가 0 → 0%(0분모 방어)', discountPercent(0, 0) === 0);

console.log(`\n${'='.repeat(38)}\nPASS ${pass} / FAIL ${fail}`);
declare const process: { exit(c?: number): never };
if (fail > 0) process.exit(1);
