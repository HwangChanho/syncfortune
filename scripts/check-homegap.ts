#!/usr/bin/env tsx
/**
 * check:homegap — 홈 블록이 **자기 아래 여백**을 갖는가.
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜 생겼나 — 같은 실수가 **두 번** 났다(둘 다 daniel 이 실기기에서 잡았다)
 *   · 2026-08-19 *"자미두수 타로 사주 아래 여백도 없어"* → `TrioCards` 에 `marginBottom` 이 없었다
 *   · 2026-08-19 *"오늘의 행운이랑 관계지도 사이도 붙어있잖아"* → `RelationMapCard` 도 없었다
 *
 * 구조가 이 실수를 부른다: 홈은 블록을 그냥 세로로 쌓기만 하고(`renderBlock`),
 *   **간격은 각 블록이 스스로** 갖는다. 그래서 새 블록을 만들 때 빠뜨리면 아무도 모른다 —
 *   화면은 멀쩡히 뜨고, 두 카드가 딱 붙어 있을 뿐이다(코드만 봐선 안 보인다).
 *
 * 규칙
 *   H1 `homeOrder.ts` 의 모든 블록 키가 `index.tsx` 에서 어떤 컴포넌트로 렌더된다
 *   H2 그 컴포넌트 파일이 **아래 여백**(`marginBottom` 또는 `marginVertical`)을 갖는다
 *
 * 한계(정직하게)
 *   · 파일 안 어딘가에 `marginBottom` 이 있으면 통과한다 — 그게 **루트 스타일인지**까지는 안 본다.
 *     (스타일 이름이 제각각이라 루트를 특정할 방법이 없다. 0건인 경우만 확실히 잡는다 —
 *      실제로 두 사고 다 **0건**이었다.)
 *   · 진짜 확인은 실기기·시뮬 화면이다. 이건 '빠뜨림'만 막는 그물이다.
 *
 * 사용: npm run check:homegap · 자가테스트: npx tsx scripts/check-homegap.ts --selftest
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const P_ORDER = 'app/src/lib/ui/homeOrder.ts';
const P_HOME = 'app/src/app/(app)/index.tsx';

type Fail = { rule: string; msg: string };

/** 소스에서 컴포넌트 파일을 찾는다(폴더가 여럿이라 이름으로 훑는다). */
function findComponent(dir: string, name: string): string | null {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { const hit = findComponent(p, name); if (hit) return hit; }
    else if (f === `${name}.tsx`) return p;
  }
  return null;
}

/**
 * 홈 블록의 아래 여백을 검사한다.
 *
 * @param orderSrc `homeOrder.ts` 원문
 * @param homeSrc  `index.tsx` 원문
 * @param readComp 컴포넌트 이름 → 소스(없으면 null). 자가테스트가 갈아 끼운다
 * @returns 위반 목록
 */
export function audit(
  orderSrc: string,
  homeSrc: string,
  readComp: (name: string) => string | null,
): Fail[] {
  const out: Fail[] = [];

  // 블록 키 = `HomeBlockKey` 유니온
  const keys = (orderSrc.match(/export type HomeBlockKey =([^;]*);/)?.[1] ?? '')
    .match(/'([a-z0-9]+)'/g)?.map((x) => x.replace(/'/g, '')) ?? [];
  if (!keys.length) { out.push({ rule: 'H1', msg: `${P_ORDER} 에서 HomeBlockKey 를 못 읽었다` }); return out; }

  // 키 → 컴포넌트: `if (k === 'relmap') return <RelationMapCard …`
  const map = new Map<string, string>();
  for (const m of homeSrc.matchAll(/k === '([a-z0-9]+)'\)\s*return\s*<([A-Z]\w*)/g)) map.set(m[1], m[2]);

  for (const k of keys) {
    const comp = map.get(k);
    if (!comp) {
      // 'today' 처럼 홈 파일 안에서 직접 그리는 블록은 컴포넌트가 없다 — 그건 이 검사 대상이 아니다
      continue;
    }
    const src = readComp(comp);
    if (src === null) { out.push({ rule: 'H1', msg: `블록 '${k}' 의 컴포넌트 ${comp}.tsx 를 못 찾았다` }); continue; }
    // ★여백을 **자기가 갖거나, 여백을 가진 자식에게 넘긴다**.
    //   `FreeTrioBlock` 은 스타일이 아예 없고 `<TrioCards>` 가 여백을 갖는다 — 그것도 통과다.
    //   ⇒ 그 파일이 렌더하는 자식 컴포넌트까지 한 겹 따라가 본다(한 겹이면 충분했다).
    const own = /margin(Bottom|Vertical)\s*:/.test(src);
    const children = [...src.matchAll(/<([A-Z]\w*)[\s/>]/g)].map((m) => m[1]);
    const viaChild = children.some((cn) => {
      const cs = readComp(cn);
      return !!cs && /margin(Bottom|Vertical)\s*:/.test(cs);
    });
    if (!own && !viaChild) {
      out.push({ rule: 'H2', msg: `블록 '${k}'(${comp})에 **아래 여백이 없다** — 다음 블록이 딱 붙는다. 루트 스타일에 marginBottom 을 줄 것` });
    }
  }
  return out;
}

// ── 자가테스트 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const order = `export type HomeBlockKey = 'today' | 'banner' | 'relmap';`;
  const home = `
    if (k === 'banner') return <HouseAdBanner />;
    if (k === 'relmap') return <RelationMapCard reloadKey={reloadKey} />;`;
  const good = (n: string) => (n === 'HouseAdBanner' ? 'wrap: { marginBottom: space(5) }' : 'card: { marginBottom: space(5) }');
  // relmap 은 자기도 없고 자식(<Foo/>)도 없다 → 진짜 누락
  const missing = (n: string) => (n === 'RelationMapCard' ? 'card: { padding: 8 }' : 'wrap: { marginBottom: space(5) }');
  // 자기 여백은 없지만 **자식**이 갖는 경우 — 통과해야 한다(FreeTrioBlock 모양)
  const viaChild = (n: string) => (n === 'RelationMapCard' ? 'return <Inner />;' : n === 'Inner' ? 'row: { marginBottom: 20 }' : 'wrap: { marginBottom: space(5) }');
  const cases: Array<[string, number]> = [
    ['정상(둘 다 여백 있음)', audit(order, home, good).length],
    ['relmap 여백 없음', audit(order, home, missing).length],
    ['컴포넌트 파일 없음', audit(order, home, () => null).length],
    ['marginVertical 도 인정', audit(order, home, () => 'x: { marginVertical: 8 }').length],
    ['블록 키를 못 읽음', audit('export const X = 1;', home, good).length],
    ['자식이 여백을 가짐(FreeTrioBlock 모양)', audit(order, home, viaChild).length],
  ];
  const want = [0, 1, 2, 0, 1, 0];
  let bad = 0;
  cases.forEach(([n, got], i) => {
    const ok = got === want[i];
    console.log(`  ${ok ? '✓' : '❌'} ${n} → ${got}건 (기대 ${want[i]})`);
    if (!ok) bad++;
  });
  console.log(bad ? `\n❌ 자가테스트 ${bad}건 실패` : '\n✅ check:homegap 자가테스트 통과 (6케이스)');
  process.exit(bad ? 1 : 0);
}

const fails = audit(
  readFileSync(join(ROOT, P_ORDER), 'utf8'),
  readFileSync(join(ROOT, P_HOME), 'utf8'),
  (name) => {
    const p = findComponent(join(ROOT, 'app/src'), name);
    return p && existsSync(p) ? readFileSync(p, 'utf8') : null;
  },
);
if (fails.length) {
  console.error(`❌ check:homegap — ${fails.length}건`);
  for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:homegap — 홈 블록이 저마다 아래 여백을 갖는다');
