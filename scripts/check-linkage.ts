#!/usr/bin/env tsx
/**
 * check:linkage — "한 곳을 바꾸면 **같이 바뀌어야 하는 곳**" 불변식.
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜 만드나(daniel 2026-08-02):
 *   "한 부분을 변경하면 연관되는 다른 부분들을 너가 기억을 못하는데 그걸 보완할 수 없나.
 *    코드를 수정하면 비즈니스 로직이나 플로우상 연관되는 부분들이 나올 텐데 그 부분을 고려 안 하네"
 *
 *   맞는 지적이고, 실제로 돈이 샜다. 대표 사례:
 *     · 07-28 **프리미엄 폐지**를 "분기를 지우지 않고 근원에서 false" 로 처리했다.
 *       그런데 `isPremium` 은 **두 가지 뜻을 겸하고 있었다** — ①무료 이용 권한 ②광고 없음.
 *       ①은 코인으로 옮겼지만 **②를 `adFree` 로 다시 연결한 사람이 없었다.**
 *       → 100 운 내고 '영구 광고 제거'를 산 사용자가 **계속 광고를 봤다**(08-02 발견).
 *     · 격국을 월지 본기로 고치며 강약은 같이 했지만 **신살을 놓쳤다**(나중에 따로).
 *
 * ★이 하네스가 할 수 있는 것 / 없는 것 (정직하게)
 *   할 수 있다 — **이미 알아낸 연결**을 영구히 고정한다. 한 번 데인 곳은 두 번 데지 않는다.
 *   할 수 없다 — 아직 아무도 모르는 연결은 못 찾는다. 그건 사고가 나야 알 수 있고,
 *                나면 **여기에 규칙 한 줄을 추가**해서 다시는 안 나게 하는 게 이 파일의 용도다.
 *
 * ★판정은 '이름' 아닌 **표현식**으로(08-01 교훈) · 규칙마다 **음성 테스트** 필수.
 *
 * 사용: npm run check:linkage
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const APP = join(ROOT, 'app/src');
const ENGINE = join(ROOT, 'engine');

/** 주석 제거 — '주석에 단어가 있다'고 통과시키지 않는다. */
function strip(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (n === 'node_modules' || n.startsWith('.')) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}
const read = (p: string) => strip(readFileSync(p, 'utf8'));
const rel = (p: string) => relative(ROOT, p);

type Result = { ok: boolean; msg: string };
type Rule = { id: string; title: string; why: string; run: () => Result[] };

const RULES: Rule[] = [
  // ── L1 ────────────────────────────────────────────────────────────────
  {
    id: 'L1',
    title: '광고를 띄우는 모든 지점은 `adFree`(광고 제거 구매)를 통과한다',
    why: '광고 제거는 돈 받고 파는 약속이다. 지점마다 분기를 달면 한 곳만 빠져도 약속이 깨진다 → 길목에서 판정.',
    run: () => {
      const out: Result[] = [];
      const ads = read(join(APP, 'lib/core/ads.ts'));
      // 보상형은 showRewardedAd 안에서 스냅샷을 보고 **먼저** 빠져나가야 한다(SDK 호출 전).
      const m = ads.match(/export async function showRewardedAd[\s\S]*?\n\}/);
      const body = m ? m[0] : '';
      const gate = body.search(/if\s*\(\s*getAdFreeSnapshot\(\)\s*\)\s*return\s+true/);
      const sdk = body.indexOf('Ads?.RewardedAd');
      out.push({
        ok: gate >= 0 && (sdk < 0 || gate < sdk),
        msg: `showRewardedAd 가 SDK 를 건드리기 전에 adFree 로 빠져나간다 ${gate >= 0 ? '' : '(가드 없음)'}`,
      });
      // 배너도 같은 개념을 본다.
      const banner = read(join(APP, 'components/AdBanner.tsx'));
      out.push({
        ok: /const\s+\w+\s*=\s*useAdFree\(\)/.test(banner) && /if\s*\(\s*adFree\s*\)\s*return\s+null/.test(banner),
        msg: 'AdBanner 가 useAdFree 로 판정하고 숨긴다',
      });
      return out;
    },
  },
  // ── L2 ────────────────────────────────────────────────────────────────
  {
    id: 'L2',
    title: '폐지된 `isPremium` 으로 **광고**를 판정하는 곳이 남아 있지 않다',
    why: 'isPremium 은 07-28 부터 항상 false 다. 광고 판정에 쓰면 그 분기는 영원히 안 타 = 조용히 죽은 게이트. 08-02 사고의 정확한 근인.',
    run: () => {
      // ★'토큰이 같은 파일에 있다'로 판정하지 않는다(08-01 교훈: 이름 아닌 표현식).
      //   register.tsx 는 isPremium 을 **명식 한도(isPro)** 로 쓰고 광고는 한도 우회용이라 무관하다 —
      //   co-occurrence 로 판정하면 이런 게 오탐으로 잡힌다.
      //   진짜로 잡아야 하는 건 "isPremium 이 든 **조건**이 광고 호출을 막고 있는" 경우다.
      const bad: string[] = [];
      for (const f of walk(APP)) {
        if (/lib\/billing\/subscription/.test(f)) continue;
        const lines = read(f).split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // isPremium 이 **조건절 안에** 있는가(`if (...)` 또는 삼항 `... ? ... :`)
          const inCondition = /if\s*\([^)]*isPremium/.test(line) || /isPremium[^\n]*\?\s*$/.test(line);
          if (!inCondition) continue;
          // 그 조건이 지키는 범위(다음 6줄)에 광고 호출이 있는가
          const scope = lines.slice(i, i + 6).join('\n');
          if (!/showRewardedAd\s*\(|showInterstitial\w*\s*\(/.test(scope)) continue;
          // 그러면서 그 조건이 adFree 를 함께 보지 않으면 = 죽은 게이트
          if (!/adFree/i.test(line)) bad.push(`${rel(f)}:${i + 1}`);
        }
      }
      return [{
        ok: bad.length === 0,
        msg: bad.length ? `광고를 폐지된 isPremium 으로 막는 조건: ${bad.join(', ')}` : '없음',
      }];
    },
  },
  // ── L3 ────────────────────────────────────────────────────────────────
  {
    id: 'L3',
    title: '자리(년월일시)를 순회하는 엔진은 `timeUnknown`(시각 미상)을 함께 본다',
    why: '시각 미상이면 엔진이 유령 子시를 채운다. 순회하며 그걸 그대로 태우면 없는 기둥에 판정이 붙는다. 격국·강약·신살이 각각 따로 걸렸다(하나 고치고 하나 놓침).',
    run: () => {
      const out: Result[] = [];
      for (const name of ['structure.ts', 'sinsal.ts']) {
        const s = read(join(ENGINE, name));
        const iterates = /\[\s*'년'\s*,\s*'월'\s*,\s*'일'\s*,\s*'시'\s*\]/.test(s);
        const aware = /timeUnknown/.test(s);
        out.push({ ok: !iterates || aware, msg: `engine/${name} — 4주 순회${iterates ? ' 있음' : ' 없음'} · timeUnknown ${aware ? '반영' : '★미반영'}` });
      }
      return out;
    },
  },
  // ── L4 ────────────────────────────────────────────────────────────────
  {
    id: 'L4',
    title: '폐지된 개념 참조는 **늘어나지 않는다**(래칫)',
    why: '한꺼번에 지우는 건 위험해서 근원 false 로 뒀다. 그렇다면 최소한 새로 늘지는 않아야 한다 — 늘면 죽은 분기를 또 심는 것이다.',
    run: () => {
      let n = 0;
      for (const f of walk(APP)) {
        if (/lib\/billing\/subscription/.test(f)) continue;
        n += (read(f).match(/isPremium/g) ?? []).length;
      }
      // 2026-08-02 실측 기준선. 줄이는 건 환영, 늘리면 실패.
      const BASELINE = 101;
      return [{ ok: n <= BASELINE, msg: `isPremium 참조 ${n}건 (기준선 ${BASELINE} 이하 유지${n < BASELINE ? ' · 줄었으면 기준선을 낮추십시오' : ''})` }];
    },
  },
];

console.log('\n🔗 check:linkage — 바꾸면 같이 바뀌어야 하는 곳\n');
let failed = 0;
for (const r of RULES) {
  console.log(`  [${r.id}] ${r.title}`);
  for (const res of r.run()) {
    console.log(`     ${res.ok ? '✓' : '✗'} ${res.msg}`);
    if (!res.ok) { failed++; console.log(`        └ 왜: ${r.why}`); }
  }
}

// ── 음성 테스트: 규칙이 실제로 무는지(안 물면 없느니만 못하다) ────────────
console.log('\n  ── 음성 테스트 ──');
let neg = 0;
const negCases: { name: string; bites: boolean }[] = [];

// L1: 가드를 뺀 showRewardedAd 를 흉내
{
  const broken = `export async function showRewardedAd(): Promise<boolean> {
  if (!Ads?.RewardedAd) return false;
  return new Promise(() => {});
}`;
  const m = broken.match(/export async function showRewardedAd[\s\S]*?\n\}/)![0];
  const gate = m.search(/if\s*\(\s*getAdFreeSnapshot\(\)\s*\)\s*return\s+true/);
  negCases.push({ name: 'L1 adFree 가드 없는 showRewardedAd', bites: gate < 0 });
}
// L1: 가드가 SDK 호출 **뒤**에 있는 경우(순서가 틀리면 이미 광고가 뜬다)
{
  const broken = `export async function showRewardedAd(): Promise<boolean> {
  if (!Ads?.RewardedAd) return false;
  if (getAdFreeSnapshot()) return true;
}`;
  const m = broken.match(/export async function showRewardedAd[\s\S]*?\n\}/)![0];
  const gate = m.search(/if\s*\(\s*getAdFreeSnapshot\(\)\s*\)\s*return\s+true/);
  const sdk = m.indexOf('Ads?.RewardedAd');
  negCases.push({ name: 'L1 가드가 SDK 뒤에 있는 경우', bites: !(gate >= 0 && gate < sdk) });
}
// L2: isPremium 조건이 광고 호출을 막는 경우 → 물어야 한다
{
  const lines = strip(`if (!isPremium && ok) {\n  await showRewardedAd();\n}`).split('\n');
  const l = lines[0];
  const bites = /if\s*\([^)]*isPremium/.test(l)
    && /showRewardedAd\s*\(/.test(lines.slice(0, 6).join('\n'))
    && !/adFree/i.test(l);
  negCases.push({ name: 'L2 isPremium 조건이 광고를 막는 경우', bites });
}
// L2 오탐 방지(음성의 반대): isPremium 이 **광고와 무관**하면 잡지 말아야 한다
{
  const lines = strip(`if (isPremium) { setLimit(999); }\n// ...\nawait saveChart();`).split('\n');
  const l = lines[0];
  const flags = /if\s*\([^)]*isPremium/.test(l) && /showRewardedAd\s*\(/.test(lines.slice(0, 6).join('\n'));
  negCases.push({ name: 'L2 광고와 무관한 isPremium 은 잡지 않는다', bites: !flags });
}
// L3: 4주를 순회하면서 timeUnknown 을 안 보는 엔진
{
  const s = strip(`const POS = ['년','월','일','시']; for (const p of POS) {}`);
  const iterates = /\[\s*'년'\s*,\s*'월'\s*,\s*'일'\s*,\s*'시'\s*\]/.test(s);
  negCases.push({ name: 'L3 timeUnknown 무시한 4주 순회', bites: iterates && !/timeUnknown/.test(s) });
}
for (const c of negCases) {
  console.log(`  ${c.bites ? '✓' : '✗'} ${c.name} → ${c.bites ? '잡는다' : '★못 잡는다'}`);
  if (!c.bites) neg++;
}

if (failed || neg) {
  console.error(`\n❌ check:linkage 실패 — 규칙 ${failed}건 · 음성테스트 ${neg}건\n`);
  process.exit(1);
}
console.log('\n✅ check:linkage 통과 — 알려진 연결이 전부 살아 있다\n');
console.log('   ※ 새 연결을 알게 되면 **여기에 규칙 한 줄을 추가**하십시오. 그게 이 파일의 용도입니다.\n');
