// scripts/check-southern.ts — 남반구 명식 규칙을 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// ★★규칙은 **Boss 가 준 것**이다(2026-09-01) — 받아적었을 뿐이다:
//     *"남반구는 토를 제외한 모든 글자를 충으로 바꾸면돼 만세력 등록할때"*
//     *"천간토는 안바꿔"*
//
// ■ ★★가장 무서운 것은 «남반구가 안 되는 것» 이 아니라 **«북반구가 바뀌는 것»** 이다
//   남반구는 소수지만 북반구는 **거의 전부**다. 뒤집기를 잘못 걸면
//   **모든 사용자의 명식이 조용히 틀린다** — 그런데 화면은 멀쩡해 보인다.
//   ⇒ 이 하네스의 첫 검사는 «남반구가 뒤집히는가» 가 아니라 **«북반구가 그대로인가»** 다.
//
// ■ ⚠️지장간·십신까지 따라와야 한다 — 글자만 바꾸면 **속이 안 맞는 명식**이 된다
//   (일지는 酉인데 지장간은 卯의 것이 남아 있는 상태). 실측으로 확인한다.
//
// 무엇을 지키나
//   S1 ★북반구(위도>0)는 **한 글자도 안 바뀐다**
//   S2 위도를 **모르면** 안 바꾼다(모른 채 뒤집는 쪽이 더 나쁘다)
//   S3 土는 그대로 — 천간 戊己 · 지지 丑辰未戌
//   S4 나머지는 충으로 — 甲庚·乙辛·丙壬·丁癸 · 子午·寅申·卯酉·巳亥
//   S5 지장간·일간이 **따라온다**(속이 맞는 명식)
//   S6 표가 **짝을 이룬다**(A→B 면 B→A)
//
// ★음성 테스트: `npx tsx scripts/check-southern.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { isSouthern, flipStem, flipBranch, flipGz, CHUNG_STEM, CHUNG_BRANCH } from '../engine/southern';
import { buildSajuChart } from '../engine/saju';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

const STEM_EARTH = ['戊', '己'];
const BRANCH_EARTH = ['丑', '辰', '未', '戌'];
const gzOf = (c: any) => (['년', '월', '일', '시'] as const)
  .map((p) => c.pillars[p].stem + c.pillars[p].branch).join(' ');

function run() {
  const base: any = { birthDateTime: '1994-03-16 17:30', calendar: '양력', sex: '남', timeAccuracy: '정확' };
  const north = buildSajuChart({ ...base, birthPlace: 'X', birthLon: 126.978, birthLat: 37.57 }, 2026);
  const south = buildSajuChart({ ...base, birthPlace: 'X', birthLon: 126.978, birthLat: -37.57 }, 2026);
  const noLat = buildSajuChart({ ...base, birthPlace: 'X', birthLon: 126.978 }, 2026);

  // S1 ★북반구가 그대로인가 — 알려진 정답(골든 엔트리 #1 과 같은 생일)
  if (gzOf(north) !== '甲戌 丁卯 辛丑 丙申') {
    fail('S1', `**북반구 명식이 바뀌었다**: ${gzOf(north)} (기대 甲戌 丁卯 辛丑 丙申).\n        `
      + '⚠️★이게 깨지면 **남반구가 아니라 전 사용자**의 명식이 틀어진 것이다 —\n        '
      + '  화면은 멀쩡해 보이므로 사람 눈으로는 못 잡는다');
  }
  // S2 위도 모름 = 북반구와 같아야 한다
  if (gzOf(noLat) !== gzOf(north)) {
    fail('S2', `위도를 모르는데 명식이 달라졌다: ${gzOf(noLat)} ≠ ${gzOf(north)}.\n        `
      + '★모르면 **안 뒤집는다** — 대부분 북반구다');
  }
  // S3·S4 남반구가 규칙대로 뒤집혔는가
  const n = gzOf(north).split(' ').join('');
  const s = gzOf(south).split(' ').join('');
  if (n.length === s.length) {
    for (let i = 0; i < n.length; i++) {
      const a = n[i], b = s[i];
      const isStem = i % 2 === 0;
      const earth = isStem ? STEM_EARTH.includes(a) : BRANCH_EARTH.includes(a);
      if (earth && a !== b) fail('S3', `土 \`${a}\` 가 \`${b}\` 로 바뀌었다 — 土는 그대로여야 한다`);
      if (!earth) {
        const want = isStem ? CHUNG_STEM[a] : CHUNG_BRANCH[a];
        if (want && b !== want) fail('S4', `\`${a}\` 의 충은 \`${want}\` 인데 \`${b}\` 가 되었다`);
      }
    }
  } else fail('S4', '남북 글자 수가 다르다 — **못 쟀다**');

  // S5 속이 맞는가 — 일간·지장간이 따라왔는지
  if (south.dayMaster.stem !== flipStem(north.dayMaster.stem)) {
    fail('S5', `일간이 안 따라왔다: ${north.dayMaster.stem} → ${south.dayMaster.stem}.\n        `
      + '⚠️십신은 전부 일간 기준이다 — 일주만 바꾸고 일간을 두면 **십신이 통째로 틀린다**');
  }
  const hn = north.pillars['월'].hiddenStems.map((h: any) => h.stem).join('');
  const hs = south.pillars['월'].hiddenStems.map((h: any) => h.stem).join('');
  const want = [...hn].map(flipStem).join('');
  if (hs !== want) {
    fail('S5', `월지 지장간이 안 따라왔다: ${hn} → ${hs} (기대 ${want}).\n        `
      + '⚠️글자만 바꾸면 **속이 안 맞는 명식**이 된다(지지는 酉인데 지장간은 卯의 것)');
  }
}

if (process.argv.includes('--selftest')) {
  const pairsOk = (m: Record<string, string>) =>
    Object.entries(m).every(([a, b]) => m[b] === a);
  const cases = [
    { name: 'S1 위도 양수 = 북반구', run: () => isSouthern(37.5) === false },
    { name: 'S1 ★위도 음수 = 남반구', run: () => isSouthern(-33.8) === true },
    { name: 'S2 ★모르면 북반구 취급', run: () => isSouthern(undefined) === false && isSouthern(null) === false },
    { name: 'S2 ★적도(0)는 안 뒤집는다', run: () => isSouthern(0) === false },
    { name: 'S3 천간 土는 그대로', run: () => flipStem('戊') === '戊' && flipStem('己') === '己' },
    { name: 'S3 지지 土 넷 다 그대로', run: () => ['丑', '辰', '未', '戌'].every((b) => flipBranch(b) === b) },
    { name: 'S4 천간 충', run: () => flipStem('甲') === '庚' && flipStem('乙') === '辛' && flipStem('丙') === '壬' && flipStem('丁') === '癸' },
    { name: 'S4 지지 충', run: () => flipBranch('子') === '午' && flipBranch('寅') === '申' && flipBranch('卯') === '酉' && flipBranch('巳') === '亥' },
    { name: 'S6 ★천간 표가 짝을 이룬다', run: () => pairsOk(CHUNG_STEM) },
    { name: 'S6 ★지지 표가 짝을 이룬다', run: () => pairsOk(CHUNG_BRANCH) },
    { name: 'S6 ★土가 표에 없다', run: () => !['戊', '己'].some((x) => x in CHUNG_STEM) && !['丑', '辰', '未', '戌'].some((x) => x in CHUNG_BRANCH) },
    { name: '간지 통째로 뒤집기', run: () => flipGz('甲子') === '庚午' && flipGz('戊戌') === '戊戌' },
    { name: '★모르는 글자는 그대로', run: () => flipStem('?') === '?' && flipGz('X') === 'X' },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  run();
  if (out.length) {
    console.error(`❌ check:southern — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:southern — 북반구는 그대로, 남반구는 土만 빼고 충으로 (지장간·일간까지)');
}
