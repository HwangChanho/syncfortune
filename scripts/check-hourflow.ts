// scripts/check-hourflow.ts — 「오늘의 시간대」(12시진) 골든
// ═══════════════════════════════════════════════════════════════════════════
// 실행: npm run check:hourflow
//
// 이 하네스가 지키는 것 (세 갈래를 섞지 않는다)
//   ① **만세력 정합** — 시주 干支가 오자둔법과 맞는가(라이브러리에 맡긴 부분의 교차검증)
//   ② **명리 정합** — 억부 우호도가 신약/신강에서 **반대로** 나오는가(대조군)
//   ③ **기획 단서** — 시각 미상 명식에서도 서는가(기획서 §4 C안이 명시한 조건)
// ★①이 없으면 "라이브러리가 주니까 맞겠지"가 되고, ②가 없으면 "늘 같은 점수"를 못 잡는다.
// ═══════════════════════════════════════════════════════════════════════════
import { hourFlow, hourPeaks } from '../app/src/lib/content/hourFlow';
import { buildSajuChart } from '../engine/saju';
import type { ChartInput, SajuChart } from '../spec/chart';

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}  ${detail}`); }
};

const mkChart = (dt: string, sex: '남' | '여' = '남'): SajuChart =>
  buildSajuChart({ birthDateTime: dt, calendar: '양', timeAccuracy: '정확', sex, birthPlace: '부산', birthLon: 129.03 } as ChartInput, 2026);

console.log('\n🕛 오늘의 시간대(12시진) 골든\n');

// 신약 명식(乙木 · 재다신약) · 신강 명식 두 개를 대조군으로 쓴다
const weak = mkChart('1994-07-08 14:20');          // 乙木 신약
const strongish = mkChart('1988-06-21 09:30', '여'); // 丁火 중화

// ── ① 형태 ────────────────────────────────────────────────────────────────
{
  const s = hourFlow(weak, '2026-08-10', 19);
  check('12시진이 나온다', s.length === 12, `len=${s.length}`);
  check('子시부터 순서대로', s[0].gz === '子' && s[11].gz === '亥', `${s[0].gz}…${s[11].gz}`);
  check("'지금' 배지는 정확히 하나", s.filter((x) => x.now).length === 1, s.filter((x) => x.now).map((x) => x.ko).join(','));
  check("19시는 술시(19–21시)", s.find((x) => x.now)?.gz === '戌', s.find((x) => x.now)?.ko);
  // 子시 경계(23~01시)는 날짜를 걸쳐 있어 따로 처리한다 — 양끝을 다 본다
  check('23시는 자시', hourFlow(weak, '2026-08-10', 23).find((x) => x.now)?.gz === '子');
  check('0시도 자시', hourFlow(weak, '2026-08-10', 0).find((x) => x.now)?.gz === '子');
  check('nowHour 를 안 주면 배지가 없다', hourFlow(weak, '2026-08-10').every((x) => !x.now));
}

// ── ② 만세력 정합 — 오자둔법(시두법) 교차검증 ──────────────────────────────
//   甲·己 일 → 甲子시부터 / 乙·庚 → 丙子 / 丙·辛 → 戊子 / 丁·壬 → 庚子 / 戊·癸 → 壬子
//   ★라이브러리가 낸 값을 **명리 표준값과 대조**한다. 안 하면 라이브러리 실수를 그대로 싣는다.
{
  const START: Record<string, string> = { 甲: '甲', 己: '甲', 乙: '丙', 庚: '丙', 丙: '戊', 辛: '戊', 丁: '庚', 壬: '庚', 戊: '壬', 癸: '壬' };
  const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  let ok = true; const seen: string[] = [];
  // 연속 10일을 훑으면 일간 10종이 전부 나온다
  for (let i = 0; i < 10; i++) {
    const day = new Date(Date.UTC(2026, 7, 10 + i));
    const iso = day.toISOString().slice(0, 10);
    const s = hourFlow(weak, iso);
    const jaStem = s[0].stem;                       // 그날 子시의 천간
    // 그날의 일간은 子시 천간에서 역산할 수 없으니, 대신 **12시진 천간이 연속**인지로 본다
    for (let k = 1; k < 12; k++) {
      const expect = STEMS[(STEMS.indexOf(s[k - 1].stem) + 1) % 10];
      if (s[k].stem !== expect) { ok = false; }
    }
    seen.push(`${iso.slice(5)}:${jaStem}子`);
  }
  check('12시진 천간이 갑→을→병… 순으로 이어진다(시두법 불변식)', ok, seen.join(' '));
  // 子시 천간은 반드시 甲·丙·戊·庚·壬(양간) 중 하나 — 오자둔법상 음간은 子시에 올 수 없다
  const jaStems = new Set(Array.from({ length: 10 }, (_, i) =>
    hourFlow(weak, new Date(Date.UTC(2026, 7, 10 + i)).toISOString().slice(0, 10))[0].stem));
  check('子시 천간은 양간(甲丙戊庚壬)뿐 — 오자둔법 불변식',
    [...jaStems].every((x) => Object.values(START).includes(x)), [...jaStems].join(','));
  check('대조군: 열흘이면 子시 천간 다섯 종이 다 나온다', jaStems.size === 5, `${jaStems.size}종`);
}

// ── ③ 명리 정합 — 억부가 신약/신강에서 반대로 서는가 ────────────────────────
{
  const w = hourFlow(weak, '2026-08-10');
  // 신약(乙木)이면 나를 돕는 인성·비겁 시간대가 우호, 나를 쓰는 식상·재성·관성은 비우호
  check('신약 명식: 인성·비겁 시간대는 우호',
    w.filter((x) => x.group === '인성' || x.group === '비겁').every((x) => x.favorGood));
  check('신약 명식: 재성·관성·식상 시간대는 비우호',
    w.filter((x) => ['재성', '관성', '식상'].includes(x.group)).every((x) => !x.favorGood));
  // ★대조군이 없으면 "전부 우호" 같은 상수 반환을 못 잡는다
  check('대조군: 우호/비우호가 둘 다 존재한다(상수 아님)',
    w.some((x) => x.favorGood) && w.some((x) => !x.favorGood));
  check('대조군: 점수가 시진마다 갈린다(상수 아님)', new Set(w.map((x) => x.score)).size >= 3,
    [...new Set(w.map((x) => x.score))].join(','));
  // 다른 명식이면 다른 그림이어야 한다(같은 날인데 사람이 달라도 같으면 원국을 안 보는 것)
  const o = hourFlow(strongish, '2026-08-10');
  check('★같은 날이라도 명식이 다르면 점수 배열이 다르다',
    w.map((x) => x.score).join(',') !== o.map((x) => x.score).join(','));
  // 시진 干支는 날짜에만 달렸으니 두 사람이 같아야 한다(원국이 干支를 흔들면 버그)
  check('대조군: 시진 干支 자체는 사람과 무관(날짜에만 달렸다)',
    w.map((x) => x.stem + x.branch).join() === o.map((x) => x.stem + x.branch).join());
}

// ── ④ 기획 단서 — 시각 미상 명식에서도 선다 ────────────────────────────────
{
  const unknown = buildSajuChart({
    birthDateTime: '1994-07-08 14:20', calendar: '양', timeAccuracy: '미상', sex: '남', birthPlace: '부산', birthLon: 129.03,
  } as ChartInput, 2026);
  const s = hourFlow(unknown, '2026-08-10', 13);
  check('시각 미상 명식에서도 12시진이 나온다(기획서 §4 C안 단서)', s.length === 12);
  check('시각 미상에서도 점수가 갈린다', new Set(s.map((x) => x.score)).size >= 2);
}

// ── ⑤ 최고·최저 ───────────────────────────────────────────────────────────
{
  const s = hourFlow(weak, '2026-08-10');
  const { best, care } = hourPeaks(s);
  check('best 는 실제 최고점', best.score === Math.max(...s.map((x) => x.score)));
  check('care 는 실제 최저점', care.score === Math.min(...s.map((x) => x.score)));
  check('best 와 care 는 서로 다른 시진', best.gz !== care.gz, `${best.ko}/${care.ko}`);
}

console.log(`\n오늘의 시간대 골든  PASS ${pass} / FAIL ${fail}`);
if (fail) process.exitCode = 1;
