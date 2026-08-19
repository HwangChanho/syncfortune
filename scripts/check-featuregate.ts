#!/usr/bin/env tsx
/**
 * check:featuregate — 같은 기능을 **여러 곳에서 같은 판정**으로 가리는가.
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜 생겼나 (2026-08-19 · 내가 낸 회귀)
 *   하단탭을 3개로 재편하면서 커뮤니티 탭에 **원격 플래그 게이트를 빠뜨렸다.**
 *   `my.tsx` 에는 *"커뮤니티 노출 = 원격 플래그(BottomNav 와 같은 판정)"* 라고
 *   주석까지 적혀 있었는데, 정작 `BottomNav` 에는 그 판정이 없었다.
 *
 *   ★그 순간 플래그가 켜져 있어서 **아무 증상도 없었다.** 끄는 순간에야
 *     "메뉴에선 사라졌는데 탭에는 남아 있다"로 드러난다 — 그때는 원인이 멀리 있다.
 *   ⇒ **주석이 '같다'고 말하는 것은 보장이 아니다.** 코드가 지키게 한다.
 *
 * 규칙
 *   G1 한 기능을 게이트하는 곳이 둘 이상이면, 전부 `useFeatureOn('<key>')` 을 써야 한다
 *      (한 곳이라도 빠지면 플래그를 껐을 때 화면마다 다르게 보인다)
 *
 * 사용: npm run check:featuregate · 자가테스트: npx tsx scripts/check-featuregate.ts --selftest
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

/**
 * 같은 플래그를 봐야 하는 파일 묶음.
 * ★"이 화면들은 함께 켜지고 함께 꺼진다"는 약속을 여기 적는다.
 */
const GATED: Array<{ key: string; why: string; files: string[] }> = [
  {
    key: 'community',
    why: '커뮤니티 진입로 — 탭과 마이페이지 메뉴가 함께 켜지고 함께 꺼져야 한다',
    files: ['app/src/components/BottomNav.tsx', 'app/src/app/(app)/my.tsx'],
  },
];

type Fail = { rule: string; msg: string };
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');

/**
 * 게이트 일관성을 검사한다.
 * @param reader 파일 읽기(자가테스트가 가짜 파일을 넣는다)
 */
export function audit(reader: (p: string) => string, gated = GATED): Fail[] {
  const out: Fail[] = [];
  for (const g of gated) {
    const missing = g.files.filter((f) => {
      try { return !new RegExp(`useFeatureOn\\(\\s*'${g.key}'\\s*\\)`).test(code(reader(f))); }
      catch { return true; }   // 못 읽는 파일 = 빠진 것으로 본다(조용한 통과 금지)
    });
    if (missing.length && missing.length < g.files.length) {
      out.push({ rule: 'G1', msg: `'${g.key}' 게이트가 일부에만 있다 — 빠진 곳: ${missing.join(', ')}. ${g.why}. 플래그를 **끄는 순간** 화면마다 다르게 보인다(켜져 있으면 증상이 없다)` });
    } else if (missing.length === g.files.length) {
      out.push({ rule: 'G1', msg: `'${g.key}' 게이트가 **어디에도 없다**(${g.files.join(', ')}) — 플래그가 아무것도 못 끈다` });
    }
  }
  return out;
}

// ── 자가테스트 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const G = [{ key: 'community', why: 'w', files: ['a.tsx', 'b.tsx'] }];
  const both = (_: string) => `const on = useFeatureOn('community');`;
  const onlyA = (p: string) => (p === 'a.tsx' ? `useFeatureOn('community')` : `아무것도 없다`);
  const none = () => `아무것도 없다`;
  // ★주석에만 적힌 경우 — 이번 사고의 정확한 모양이다(주석은 있고 코드는 없다)
  const commentOnly = (p: string) => (p === 'a.tsx' ? `useFeatureOn('community')` : `// BottomNav 와 같은 판정: useFeatureOn('community')`);
  const cases: Array<[string, number]> = [
    ['둘 다 게이트 있음', audit(both, G).length],
    ['한 곳만 있음(이번 사고)', audit(onlyA, G).length],
    ['어디에도 없음', audit(none, G).length],
    ['★주석에만 있음 → 잡아야 한다', audit(commentOnly, G).length],
    ['읽을 수 없는 파일 = 빠진 것으로', audit((p) => { if (p === 'b.tsx') throw new Error('no'); return `useFeatureOn('community')`; }, G).length],
  ];
  const want = [0, 1, 1, 1, 1];
  let bad = 0;
  cases.forEach(([n, got], i) => {
    const ok = got === want[i];
    console.log(`  ${ok ? '✓' : '❌'} ${n} → ${got}건 (기대 ${want[i]})`);
    if (!ok) bad++;
  });
  console.log(bad ? `\n❌ 자가테스트 ${bad}건 실패` : `\n✅ check:featuregate 자가테스트 통과 (${cases.length}케이스)`);
  process.exit(bad ? 1 : 0);
}

const fails = audit((p) => readFileSync(join(ROOT, p), 'utf8'));
if (fails.length) {
  console.error(`❌ check:featuregate — ${fails.length}건 · 플래그를 끄면 화면마다 다르게 보인다`);
  for (const f of fails) console.error(`  [G1] ${f.msg}`);
  process.exit(1);
}
console.log(`✅ check:featuregate — 플래그 ${GATED.length}종이 모든 진입로에서 같은 판정을 쓴다`);
