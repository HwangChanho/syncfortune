// scripts/check-glyphswap.ts — 「충/합 글자 바꿔 보기」 렌즈를 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// ★Boss 2026-09-01: *"만세력에 원국에서 충하는 글자보기 하면 전체 글자별 충하는 글자로 바꾸고
//   거기에 맞게 내용 십신등 변경해줘 합하는글자 보기도 두개를 하나로 묶어서 버튼으로 만들고
//   각각설정해서 볼수있게"* / *"이기능은 9900원에 해당하는 운 사용해야 언락할수 있게"*
//
// ■ ★★가장 무서운 것은 «렌즈가 안 켜지는 것» 이 아니라 **«렌즈가 안 꺼지는 것»** 이다.
//   렌즈는 소수가 가끔 켜지만, 원국은 **모든 사람이 늘 본다**. 기본값이 새면
//   모두의 명식이 조용히 남의 것이 된다 — 그런데 화면은 멀쩡해 보인다.
//   ⇒ 첫 검사는 «충이 도는가» 가 아니라 **«안 걸었을 때 한 글자도 안 바뀌는가»** 다.
//
// ■ ⚠️표를 **다시 적어 대조하지 않는다**(그러면 같은 오타를 두 번 쓴다).
//   구조로 판정한다 — 충은 «십간에서 6칸 / 십이지에서 6칸», 합은 «십간 5칸 / 십이지 합이 1(mod 12)».
//   표가 틀리면 이 산식이 문다.
//
// 무엇을 지키나
//   G1 ★모드 없으면 **한 글자도 안 바뀐다**(원국 불변 — 가장 중요)
//   G2 충 표: 짝을 이루고(A→B→A) · 천간은 6칸 · 지지는 6칸 · **戊己만** 짝이 없다
//   G3 합 표: 짝을 이루고 · 천간은 5칸 · 지지는 합이 1(mod 12) · **빠진 글자 없다**
//   G4 ★★남반구 표와 **갈라져 있다** — 남반구는 土가 빠지고(Boss 문면) 여기는 土가 있다
//   G5 실측: 십신·일간이 **따라온다**(속이 맞는 명식)
//   G6 실측: 대운·세운의 **간지는 안 바뀐다**(렌즈는 원국만 건드린다)
//   G7 ★`glyphSwap` 이 **저장 경로에 없다**(보는 방식이지 명식의 신원이 아니다)
//   G8 값: 앱 표기(FEATURE_UNLOCKS)와 서버 RPC 의 금액이 **같다** · ₩ = 운 × WON_PER_COIN
//   G9 ★서버 RPC 가 **허용목록**이다(이걸로 비싼 통변을 열 수 없다)
//
// ★음성 테스트: `npx tsx scripts/check-glyphswap.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import {
  swapStem, swapBranch, swapGz, isUnpaired,
  CHUNG_STEM_FULL, CHUNG_BRANCH_FULL, HAP_STEM, HAP_BRANCH,
} from '../engine/glyphSwap';
import { CHUNG_STEM as S_STEM, CHUNG_BRANCH as S_BRANCH } from '../engine/southern';
import { buildSajuChart } from '../engine/saju';
import { FEATURE_UNLOCKS, WON_PER_COIN } from '../app/src/lib/billing/coinPrices';

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ROOT = process.cwd();

/** 천간 오행 — 甲乙木 丙丁火 戊己土 庚辛金 壬癸水. */
const STEM_ELEM = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
/** 상극 — 木克土 · 土克水 · 水克火 · 火克金 · 金克木. */
const KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
/** 양간은 짝수 자리(甲丙戊庚壬) · 음간은 홀수 자리. */
const sameYinYang = (a: string, b: string) => STEMS.indexOf(a) % 2 === STEMS.indexOf(b) % 2;
/** 두 천간의 오행이 **어느 방향으로든** 극인가. */
const isKe = (a: string, b: string) => {
  const ea = STEM_ELEM[STEMS.indexOf(a)], eb = STEM_ELEM[STEMS.indexOf(b)];
  return KE[ea] === eb || KE[eb] === ea;
};   // 하네스는 저장소 루트에서 돈다(preflight 규약). ESM 이라 __dirname 이 없다.

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 골든 픽스처와 같은 입력(entry-001-self) — 실측의 기준점. */
const BASE = {
  birthDateTime: '1994-03-16 17:55', calendar: '양', timeAccuracy: '정확',
  sex: '남', birthPlace: '전라남도 여수',
} as any;
const pillarsOf = (mode?: 'chung' | 'hap') => {
  const c: any = buildSajuChart(mode ? { ...BASE, glyphSwap: mode } : BASE);
  return { c, gz: ['년', '월', '일', '시'].map((p) => c.pillars[p].stem + c.pillars[p].branch) };
};

function run() {
  // ── G1 모드 없으면 아무것도 안 바뀐다 ──────────────────────────────────
  for (const x of [...STEMS, ...BRANCHES]) {
    if (swapStem(x) !== x || swapBranch(x) !== x) fail('G1', `모드 없이 ${x} 가 바뀐다`);
  }
  if (swapGz('甲子') !== '甲子') fail('G1', '모드 없이 간지가 바뀐다');
  if (isUnpaired('戊')) fail('G1', '모드 없이 짝없음 판정이 뜬다');
  const plain = pillarsOf().gz.join(' ');
  if (plain !== '甲戌 丁卯 辛丑 丁酉') fail('G1', `★원국이 골든과 다르다: ${plain}`);

  // ── G2 충 표 ───────────────────────────────────────────────────────────
  for (const s of STEMS) {
    const p = CHUNG_STEM_FULL[s];
    if (s === '戊' || s === '己') { if (p) fail('G2', `천간 土 ${s} 에 충 짝이 붙었다(중앙 土는 충이 없다)`); continue; }
    if (!p) { fail('G2', `천간 ${s} 의 충 짝이 없다`); continue; }
    if (CHUNG_STEM_FULL[p] !== s) fail('G2', `짝이 안 맞는다: ${s}→${p}→${CHUNG_STEM_FULL[p]}`);
    // ★칸 수로 재지 않는다 — 십간은 **열 칸**이라 +6 의 반대가 −6 이 아니라 +4 다(비대칭).
    //   처음엔 «6칸» 으로 썼다가 庚·辛·壬·癸에서 전부 빨간불이 났다. **표가 아니라 산식이 틀렸다.**
    //   진짜 불변식은 «같은 음양(양간끼리·음간끼리) + 오행이 서로 극(克)» 이다.
    if (!sameYinYang(s, p)) fail('G2', `${s}↔${p} 는 음양이 다르다 — 천간충은 양↔양·음↔음이다`);
    if (!isKe(s, p)) fail('G2', `${s}↔${p} 는 오행 극(克) 관계가 아니다 — 충이 아니다`);
  }
  for (const b of BRANCHES) {
    const p = CHUNG_BRANCH_FULL[b];
    if (!p) { fail('G2', `지지 ${b} 의 충 짝이 없다(육충은 열두 글자 전부에 있다)`); continue; }
    if (CHUNG_BRANCH_FULL[p] !== b) fail('G2', `짝이 안 맞는다: ${b}→${p}→${CHUNG_BRANCH_FULL[p]}`);
    const d = (BRANCHES.indexOf(p) - BRANCHES.indexOf(b) + 12) % 12;
    if (d !== 6) fail('G2', `${b}↔${p} 는 십이지에서 ${d}칸 — 충은 6칸이다`);
  }

  // ── G3 합 표 ───────────────────────────────────────────────────────────
  for (const s of STEMS) {
    const p = HAP_STEM[s];
    if (!p) { fail('G3', `천간 ${s} 의 합 짝이 없다(오합은 열 글자 전부에 있다)`); continue; }
    if (HAP_STEM[p] !== s) fail('G3', `짝이 안 맞는다: ${s}→${p}→${HAP_STEM[p]}`);
    const d = (STEMS.indexOf(p) - STEMS.indexOf(s) + 10) % 10;
    if (d !== 5) fail('G3', `${s}↔${p} 는 십간에서 ${d}칸 — 오합은 5칸이다`);
  }
  for (const b of BRANCHES) {
    const p = HAP_BRANCH[b];
    if (!p) { fail('G3', `지지 ${b} 의 합 짝이 없다(육합은 열두 글자 전부에 있다)`); continue; }
    if (HAP_BRANCH[p] !== b) fail('G3', `짝이 안 맞는다: ${b}→${p}→${HAP_BRANCH[p]}`);
    const sum = (BRANCHES.indexOf(b) + BRANCHES.indexOf(p)) % 12;
    if (sum !== 1) fail('G3', `${b}↔${p} 의 합이 ${sum} — 육합은 1(mod 12)이다`);
  }

  // ── G4 ★남반구 표와 갈라져 있다 ────────────────────────────────────────
  //   남반구는 Boss 가 "토를 제외한" 이라고 못 박았다. 여기는 "전체 글자별" 이다.
  //   한쪽으로 합치면 **Boss 가 준 남반구 규칙이 조용히 바뀐다**.
  for (const e of ['丑', '辰', '未', '戌']) {
    if (e in S_BRANCH) fail('G4', `★남반구 표에 土 지지 ${e} 가 들어갔다 — Boss 문면("토를 제외한")과 다르다`);
    if (!(e in CHUNG_BRANCH_FULL)) fail('G4', `★충 보기 표에 土 지지 ${e} 가 빠졌다 — Boss 문면("전체 글자별")과 다르다`);
  }
  for (const e of ['戊', '己']) {
    if (e in S_STEM || e in CHUNG_STEM_FULL) fail('G4', `천간 土 ${e} 에 충 짝이 붙었다(양쪽 표 모두 있으면 안 된다)`);
  }

  // ── G5 실측: 십신·일간이 따라온다 ──────────────────────────────────────
  for (const [mode, want, wantDay] of [
    ['chung', '庚辰 癸酉 乙未 癸卯', '乙'],
    ['hap', '己卯 壬戌 丙子 壬辰', '丙'],
  ] as const) {
    const { c, gz } = pillarsOf(mode);
    if (gz.join(' ') !== want) fail('G5', `${mode}: 명식이 ${gz.join(' ')} — 기대 ${want}`);
    if (c.dayMaster?.stem !== wantDay) fail('G5', `${mode}: 일간이 ${c.dayMaster?.stem} — 기대 ${wantDay}(십신 축이 안 따라오면 전부 틀린다)`);
    // 십신이 **새 일간 기준**인가 — 일지는 늘 비견이어야 한다(일간과 같은 자리에서 뽑으므로)
    if (c.pillars['일'].stem !== wantDay) fail('G5', `${mode}: 일주 천간과 일간이 어긋난다`);
    // 지장간이 **새 지지**의 것인가 — 옛 지지의 지장간이 남으면 속이 안 맞는 명식이다
    const jj = (c.pillars['월'] as any).hiddenStems ?? (c.pillars['월'] as any).jijanggan ?? null;
    if (jj && Array.isArray(jj) && jj.length === 0) fail('G5', `${mode}: 월지 지장간이 비었다`);
  }

  // ── G6 대운·세운 간지는 안 바뀐다 ──────────────────────────────────────
  const key = (c: any) => JSON.stringify((c.luckCycles ?? []).map((l: any) => `${l.startAge}${l.stem}${l.branch}`))
    + '|' + `${c.annual?.year}${c.annual?.stem}${c.annual?.branch}`;
  const k0 = key(pillarsOf().c);
  for (const m of ['chung', 'hap'] as const) {
    if (key(pillarsOf(m).c) !== k0) fail('G6', `${m}: 대운·세운 간지가 바뀌었다 — 렌즈는 원국만 건드려야 한다`);
  }

  // ── G7 ★저장 경로에 glyphSwap 이 없다 ──────────────────────────────────
  //   «보는 방식» 이 명식의 신원으로 굳으면, 그 사람의 사주가 통째로 남의 것이 되어 저장된다.
  const savers = ['app/src/lib/engine/myChart.ts', 'app/src/lib/backend/charts.ts', 'app/src/screens/ChartRegisterScreen.tsx'];
  for (const f of savers) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) continue;
    if (/glyphSwap/.test(fs.readFileSync(abs, 'utf8'))) fail('G7', `★${f} 가 glyphSwap 을 만진다 — 저장 경로에 렌즈가 새어 들어갔다`);
  }

  // ── G8 값 ──────────────────────────────────────────────────────────────
  const fee = FEATURE_UNLOCKS.find((f) => f.kind === 'chunghap');
  if (!fee) fail('G8', 'FEATURE_UNLOCKS 에 chunghap 이 없다');
  else {
    // ★환산 규약은 «원화 ÷ WON_PER_COIN 을 **10단위로 반올림**»이다(coinPrices.ts COIN_PRICE 주석).
    //   그래서 ₩9,900 은 99 가 아니라 **100 운**이다 — 같은 값의 기존 상품 `love`(₩9,900 → 100운)와 같다.
    //   ⚠️정확히 나누어떨어지길 요구하면 이 규약을 쓰는 **모든 항목**이 빨간불이 된다(첫 판에 내가 그렇게 썼다).
    const want = Math.round(fee.won / WON_PER_COIN / 10) * 10;
    if (fee.coins !== want) fail('G8', `₩${fee.won} → 규약상 ${want}운인데 ${fee.coins}운으로 적혀 있다`);
    if (fee.won !== 9900) fail('G8', `Boss 가 정한 값은 ₩9,900 인데 ${fee.won} 이다`);
    const sql = path.join(ROOT, 'supabase/migrations/20260901s_unlock_chart_feature.sql');
    if (!fs.existsSync(sql)) fail('G8', '서버 RPC 마이그레이션이 없다');
    else {
      const body = fs.readFileSync(sql, 'utf8');
      const m = body.match(/p_kind\s*=\s*'chunghap'\s*then\s*v_cost\s*:=\s*(\d+)/);
      if (!m) fail('G8', '서버 RPC 에서 chunghap 가격을 못 찾았다');
      else if (Number(m[1]) !== fee.coins) fail('G8', `★서버 ${m[1]}운 ≠ 앱 표기 ${fee.coins}운 — 화면이 거짓말한다`);
      // ── G9 허용목록 ──
      if (!/return jsonb_build_object\('ok', false, 'error', 'kind'\)/.test(body)) {
        fail('G9', '★서버 RPC 에 허용목록 거절이 없다 — 아무 kind 나 100운에 열린다');
      }
      if (/p_kind\s*=\s*'(reading|ziwei|timeline|compat)'/.test(body)) {
        fail('G9', '★이 RPC 로 LLM 통변 kind 를 열 수 있다 — Edge 결제 게이트 우회 구멍');
      }
      if (!/from charts where id = p_chart_id and owner_id = v_owner/.test(body)) {
        fail('G9', '★차트 소유 확인이 없다 — 남의 chart_id 로 열면 진짜 주인이 영영 못 연다');
      }
    }
  }
}

if (process.argv.includes('--selftest')) {
  const cases: { name: string; run: () => boolean }[] = [
    { name: 'G1 ★모드 없으면 그대로', run: () => swapStem('甲') === '甲' && swapBranch('子') === '子' && swapGz('甲子') === '甲子' },
    { name: 'G2 충 천간(음양+극)', run: () => swapStem('甲', 'chung') === '庚' && swapStem('丁', 'chung') === '癸' && sameYinYang('甲', '庚') && isKe('甲', '庚') },
    { name: '★음양 다른 짝을 문다', run: () => !sameYinYang('甲', '辛') },
    { name: '★극 아닌 짝을 문다', run: () => !isKe('甲', '丙') },
    { name: 'G2 ★천간 土는 짝이 없다', run: () => swapStem('戊', 'chung') === '戊' && isUnpaired('戊', 'chung') },
    { name: 'G2 ★지지 土도 충은 있다', run: () => swapBranch('丑', 'chung') === '未' && swapBranch('戌', 'chung') === '辰' },
    { name: 'G3 합 천간 5칸', run: () => swapStem('甲', 'hap') === '己' && swapStem('戊', 'hap') === '癸' },
    { name: 'G3 합 지지', run: () => swapBranch('子', 'hap') === '丑' && swapBranch('午', 'hap') === '未' },
    { name: 'G3 ★합엔 짝없는 글자가 없다', run: () => [...STEMS, ...BRANCHES].every((x) => !isUnpaired(x, 'hap')) },
    { name: 'G4 ★남반구 표엔 土 지지가 없다', run: () => !['丑', '辰', '未', '戌'].some((x) => x in S_BRANCH) },
    { name: 'G4 ★충 보기 표엔 土 지지가 있다', run: () => ['丑', '辰', '未', '戌'].every((x) => x in CHUNG_BRANCH_FULL) },
    { name: 'G5 실측 충', run: () => pillarsOf('chung').gz.join(' ') === '庚辰 癸酉 乙未 癸卯' },
    { name: 'G5 실측 합', run: () => pillarsOf('hap').gz.join(' ') === '己卯 壬戌 丙子 壬辰' },
    { name: 'G5 ★일간이 따라온다', run: () => pillarsOf('chung').c.dayMaster?.stem === '乙' && pillarsOf('hap').c.dayMaster?.stem === '丙' },
    { name: 'G6 대운 간지 불변', run: () => pillarsOf('chung').c.luckCycles?.[0]?.stem === pillarsOf().c.luckCycles?.[0]?.stem },
    { name: '★모르는 글자는 그대로', run: () => swapStem('?', 'chung') === '?' && swapGz('X', 'hap') === 'X' },
    { name: 'G8 환산 규약(10단위 반올림)', run: () => { const f = FEATURE_UNLOCKS.find((x) => x.kind === 'chunghap')!; return f.coins === Math.round(f.won / WON_PER_COIN / 10) * 10 && f.won === 9900; } },
    { name: '★잘못 적힌 값(50운)을 문다', run: () => 50 !== Math.round(9900 / WON_PER_COIN / 10) * 10 },
    // ★깨진 표를 실제로 무는가 — 표를 일부러 틀리게 만든 사본으로 산식을 태운다
    { name: '★깨진 충 표(5칸)를 문다', run: () => { const bad: Record<string, string> = { 甲: '己' }; const d = (STEMS.indexOf(bad['甲']) - STEMS.indexOf('甲') + 10) % 10; return d !== 6; } },
    { name: '★깨진 합 표(짝 안 맞음)를 문다', run: () => { const bad: Record<string, string> = { 子: '寅', 寅: '亥' }; return bad[bad['子']] !== '子'; } },
  ];
  let badN = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) badN++; }
  if (badN) { console.error(`\n❌ 음성 테스트 ${badN}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  run();
  if (out.length) {
    console.error(`❌ check:glyphswap — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:glyphswap — 원국 불변 · 충/합 표 구조 정합 · 십신·일간 따라옴 · 값 앱=서버 · 허용목록');
}
