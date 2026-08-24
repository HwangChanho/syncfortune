/**
 * scripts/check-case003.ts — 골든 003(궁합 교차 케이스) 하네스
 * ═════════════════════════════════════════════════════════════════════════
 * 출처: 전문가 케이스 노트 2026-08-24 (`golden/entry-003-compat-crossmatch.md`)
 *
 * ■ 두 가지를 **갈라서** 본다
 *   ①**맞는 것** — 지금 엔진이 전문가와 일치하는 값. 어긋나면 **빨간불**(회귀).
 *   ②**아직 못 하는 것** — 전문가가 지적한 미구현 6건. 여기는 **빨간불이 아니다.**
 *     ⚠️미구현을 실패로 찍으면 이 하네스가 **상시 빨간불**이 되고, 그러면 초록불이 의미를 잃어
 *       진짜 회귀도 같이 묻힌다([[verify-gate-pending-stance]] 교훈).
 *     대신 **구현되면 알린다** — 못 하던 것이 되기 시작하면 그때 골든을 갱신하라고 말해 준다.
 *
 * ■ ★왜 이 케이스가 값진가
 *   시간 보정이 **시주를 갈랐고**(申→未) 당사자 확인까지 끝났다. 사주·자미두수가 독립적으로
 *   8개 항목에서 수렴했다. 궁합 감점이 **단일 변수에 수렴**하는 고분산 사례다.
 *
 * 실행: npm run check:case003   (preflight 에 포함)
 */
import { buildSajuChart } from '../engine/saju';
import { analyzeCompatibility } from '../engine/compatibility';
import { compatScoreOf } from '../engine/compatScore';
import type { ChartInput } from '../spec/chart';

const A: ChartInput = {
  birthDateTime: '1995-08-06 16:00', calendar: '양', sex: '여',
  birthPlace: '밀라노, 롬바르디아, 이탈리아', birthLon: 9.1896346, birthLat: 45.4641943,
  timeAccuracy: '정확',
} as ChartInput;
const B: ChartInput = {
  birthDateTime: '1994-03-16 17:50', calendar: '양', sex: '남',
  birthPlace: '여수시, 전라남도, 대한민국', birthLon: 127.659859,
  timeAccuracy: '정확',
} as ChartInput;

let fail = 0, pass = 0, todo = 0, done = 0;
const bad = (m: string) => { fail++; console.log(`  ❌ ${m}`); };
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };
/** 아직 못 하는 것 — 실패가 아니다. 되기 시작하면 알린다. */
const gap = (label: string, nowDone: boolean, note: string) => {
  if (nowDone) { done++; console.log(`  ✅ ${label} (${note})`); }
  else { todo++; console.log(`  ⏳ ${label} — **아직 못 한다** (${note})`); }
};

const gz = (c: any) => ['년', '월', '일', '시'].map((p) => `${c.pillars[p].stem}${c.pillars[p].branch}`).join(' ');

console.log('\n🔗 골든 003 — 궁합 교차 케이스\n');

const ca = buildSajuChart(A, 2026);
const cb = buildSajuChart(B, 2026);

// ── ① 팔자 · 대운 (당사자 확인 완료 = 가장 단단한 값) ────────────────────
console.log('=== ① 팔자·대운 — 전문가 확인본과 같은가 ===');
{
  const a = gz(ca), b = gz(cb);
  if (a === '乙亥 癸未 己巳 辛未') ok(`A 팔자 ${a}`);
  else bad(`A 팔자 ${a} ≠ 乙亥 癸未 己巳 辛未 — ★시간 보정을 의심할 것(申시로 새면 壬申이 된다)`);
  if (b === '甲戌 丁卯 辛丑 丁酉') ok(`B 팔자 ${b}`);
  else bad(`B 팔자 ${b} ≠ 甲戌 丁卯 辛丑 丁酉`);

  const six = ca.luckCycles.slice(0, 6).map((l: any) => `${l.stem}${l.branch}`).join(' ');
  if (six === '甲申 乙酉 丙戌 丁亥 戊子 己丑') ok(`A 대운 순행 ${six}`);
  else bad(`A 대운 ${six} ≠ 甲申 乙酉 丙戌 丁亥 戊子 己丑`);

  const cur = ca.luckCycles.find((l: any) => l.isCurrent);
  const curGz = cur ? `${cur.stem}${cur.branch}` : '없음';
  if (curGz === '丁亥') ok(`A 현재 대운 丁亥 (시작 나이 ${cur!.startAge} = 세는나이 규약)`);
  else bad(`A 현재 대운 ${curGz} ≠ 丁亥`);
}

// ── ② 전문가가 지목한 글자를 실제로 잡는가 ──────────────────────────────
console.log('\n=== ② 전문가가 지목한 충·합을 엔진이 잡는가 ===');
{
  const dx = analyzeCompatibility(ca, cb, '여');
  const all = [...dx.tension, ...dx.harmony].join(' | ');
  const need: [string, string][] = [
    ['乙辛', '식신제살 · 배우자성 감점 근거'],
    ['癸丁', '★핵심 단일 변수 — B 편관 양투가 A 조후용신 직격'],
    ['未丑', '배우자궁 상호작용 감점'],
  ];
  for (const [ch, why] of need) {
    if (all.includes(ch)) ok(`${ch} 검출 (${why})`);
    else bad(`${ch} 를 못 잡는다 — ${why}`);
  }
  // 癸丁沖·未丑沖 은 **두 건씩** 이어야 한다(노트: ×2)
  const cnt = (ch: string) => (all.match(new RegExp(ch, 'g')) ?? []).length;
  if (cnt('癸丁') >= 2) ok('癸丁沖 2건 이상(편관 양투)');
  else bad(`癸丁沖 ${cnt('癸丁')}건 — 노트는 2건(양투)`);
  if (cnt('未丑') >= 2) ok('未丑沖 2건 이상');
  else bad(`未丑沖 ${cnt('未丑')}건 — 노트는 2건`);
}

// ── ③ 전문가가 지적했던 항목들 (실패로 찍지 않는다 — 상태만 보여 준다) ────
console.log('\n=== ③ 전문가가 지적한 항목 — 구현 상태 ===');
{
  const dx = analyzeCompatibility(ca, cb, '여');
  const s = compatScoreOf(dx);
  const s2 = compatScoreOf(analyzeCompatibility(cb, ca, '남'));
  const cross = dx.crossInteractions.map((c: any) => String(c.kind)).join(' ');

  gap('G1 용신 오행 특정', dx.usefulGodSupply.element != null,
    dx.usefulGodSupply.element != null ? dx.usefulGodSupply.detail
      : '용신을 못 정하면 용신 호환(전문가 95점)이 계산되지 않는다');
  gap('G2 교차 삼합 검출', dx.crossSanhe.length >= 2,
    dx.crossSanhe.length
      ? dx.crossSanhe.map((c: any) => c.detail).join(' / ')
      : '亥卯未·巳酉丑 쌍방 완성 — 노트의 배우자성 90점 근거');
  gap('G3 삼형 검출', dx.crossSamhyeong.length >= 1,
    dx.crossSamhyeong.length ? dx.crossSamhyeong.map((c: any) => c.detail).join(' / ') : '丑戌未 — 갈등 구조가 과소평가된다');
  gap('G4 무근 천간의 상대 통근', dx.crossRooting.length >= 1,
    dx.crossRooting.length ? dx.crossRooting.map((r: any) => r.detail).join(' / ') : 'A 의 乙(무근) → B 의 卯');
  gap('G5 미러 비대칭', s.score !== s2.score,
    s.score !== s2.score ? `A기준 ${s.score} / B기준 ${s2.score}`
      : `A기준 ${s.score} = B기준 ${s2.score} — R48 양방향이 안 갈린다`);
  gap('G6 분산 지표', s.weakest != null,
    s.weakest ? `가장 약한 항목 = ${s.weakest.item} ${Math.round(s.weakest.ratio * 100)}점` : '고분산/저분산을 구분할 보조 출력이 없다');

  // ★★2026-08-24 부터는 **전문가 기준에 맞춘 상태를 잠근다**(Boss *"전문가 기준으로해"*).
  //   ⚠️다만 **±15 까지 허용**한다. 케이스가 하나뿐이라 더 조이면 그건 과적합이다(CLAUDE.md §3.2 n=1).
  //     큰 드리프트만 잡고, 미세 조정은 막지 않는다.
  console.log(`\n  · 엔진 종합 A기준 ${s.score} / B기준 ${s2.score}  (전문가 수동 R46 = 82)`);
  // ★★항목별로 나란히 놓는다 — 어디가 어긋나는지 **숫자로** 보여야 고칠 곳이 정해진다.
  const EXPERT: Record<string, number> = {
    yongsin: 95, spouseStar: 90, spousePalace: 75, dayMaster: 85, conflict: 55, timing: 80,
  };
  console.log('\n  ── 항목 대조 (엔진 vs 전문가) ──');
  for (const it of s.items) {
    const e = EXPERT[it.key];
    const d = it.score - e;
    const mark = Math.abs(d) <= 10 ? '≈' : d > 0 ? '↑' : '↓';
    console.log(`    ${mark} ${it.label.padEnd(12)} 엔진 ${String(it.score).padStart(3)} · 전문가 ${e}  (${d >= 0 ? '+' : ''}${d})`);
  }

  // ── ④ ★전문가 기준 게이트 (Boss 2026-08-24 *"전문가 기준으로해"*) ──────
  //   여기부터는 **실패로 찍는다** — 전문가 판정에서 벗어나면 빨간불이다.
  //   ⚠️허용폭 ±15. 케이스가 **하나뿐**이라 더 조이면 그건 과적합이다(CLAUDE.md §3.2 n=1).
  //     큰 드리프트만 잡고 미세 조정은 막지 않는다. 케이스가 늘면 그때 조인다.
  console.log('\n=== ④ 전문가 기준 게이트 ===');
  const off = s.items.filter((it) => Math.abs(it.score - EXPERT[it.key]) > 15);
  if (off.length) off.forEach((it) => bad(`${it.label}: 엔진 ${it.score} vs 전문가 ${EXPERT[it.key]} — 15점 초과 이탈`));
  else ok('여섯 항목 전부 전문가 판정 ±15 안쪽');

  if (Math.abs(s.score - 82) > 10) bad(`종합 ${s.score} 이 전문가 82 에서 10점 넘게 벗어났다`);
  else ok(`종합 ${s.score} ≈ 전문가 82`);

  // ⚠️B 기준(미러)에는 전문가 판정이 없다 → **비대칭이 살아 있는지만** 본다(값은 고정하지 않는다).
  if (s.score === s2.score) bad('미러가 대칭이다 — 양방향이 갈리지 않는다(R48)');
  else ok(`미러 비대칭 유지 — A ${s.score} / B ${s2.score}`);
}

console.log(`\n   통과 ${pass} · 실패 ${fail} · 전문가 지적 ${done}건 구현 · 미구현 ${todo}건`);
if (fail) {
  console.log('\n   ⚠️ 전문가 확인본과 어긋난다. 시간 보정(check:solartime)·합충 검출을 먼저 본다.\n');
  process.exit(1);
}
console.log(`   🎯 통과 — 확인된 값 회귀 없음${todo ? ` · 남은 미구현 ${todo}건은 골든 003 §3 에` : ' · 전문가 지적 전건 구현'}\n`);
