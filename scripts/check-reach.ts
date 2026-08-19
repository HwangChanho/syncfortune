#!/usr/bin/env tsx
/**
 * check:reach — 탭에서 뺀 화면에 **다른 진입로가 있는가**.
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜 생겼나 (2026-08-19 · 3탭 전환)
 *   Boss 가 하단탭을 「연락처·커뮤니티·설정」 3개로 줄였다. 그러면 종전 탭이던
 *   `/contents`(콘텐츠 55종)·`/myreadings`(내 풀이) 는 **탭에서 사라진다.**
 *
 *   ★도달 불가는 삭제보다 나쁘다 — 화면은 멀쩡히 살아 있고 코드도 유지보수되는데
 *     아무도 들어갈 수 없다. 그리고 **아무 오류도 나지 않아서** 한참 뒤에야 발견된다.
 *     이 저장소는 같은 실패를 이미 겪었다: 홈 블록을 접을 때 바이오리듬만 상세 화면이 없어서
 *     도달 불가가 될 뻔했고, 그래서 `/biorhythm` 을 **먼저 만들고** 접었다.
 *   ⇒ "옮길 곳을 먼저 만들고 뺀다"를 코드가 지키게 한다.
 *
 * 규칙
 *   R1 탭에서 빠진 주요 화면은 설정(또는 다른 상시 화면)에 진입로가 있어야 한다
 *   R2 탭 정의에 있는 route 는 실제 파일이 있어야 한다(오타 = 빈 탭)
 *   R3 진입로 목록 자체가 비면 안 된다(하네스가 아무것도 안 지키는 상태 방지)
 *
 * 사용: npm run check:reach · 자가테스트: npx tsx scripts/check-reach.ts --selftest
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const P_NAV = 'app/src/components/BottomNav.tsx';
const APP_DIR = 'app/src/app/(app)';

/**
 * 탭에서 빠졌지만 **반드시 도달 가능해야 하는** 화면.
 * ★여기에 줄을 더할 때는 진입로를 먼저 만들어라 — 순서가 반대면 이 하네스가 바로 빨간불이 된다.
 */
const MUST_REACH: Array<{ route: string; why: string; from: string[] }> = [
  { route: '/contents',   why: '콘텐츠 55종 목록',  from: ['app/src/app/(app)/settings.tsx'] },
  { route: '/myreadings', why: '내가 만든 풀이',    from: ['app/src/app/(app)/settings.tsx'] },
  { route: '/charts',     why: '만세력·명식 관리',  from: ['app/src/app/(app)/settings.tsx', 'app/src/app/(app)/talk.tsx'] },
];

type Fail = { rule: string; msg: string };

/**
 * 도달 가능성을 검사한다.
 * @param nav    `BottomNav.tsx` 원문
 * @param reader 파일 읽기(자가테스트가 가짜 파일을 넣는다)
 * @param exists 파일 존재 확인
 */
export function audit(
  nav: string,
  reader: (p: string) => string,
  exists: (p: string) => boolean,
  mustReach = MUST_REACH,
): Fail[] {
  const out: Fail[] = [];
  if (!mustReach.length) {
    out.push({ rule: 'R3', msg: 'MUST_REACH 가 비었다 — 이 하네스가 아무것도 지키지 않는다' });
    return out;
  }

  // 탭에 남아 있는 route 는 이 검사에서 면제(탭이 곧 진입로다)
  const tabRoutes = new Set([...nav.matchAll(/route:\s*'([^']+)'/g)].map((m) => m[1]));

  for (const t of mustReach) {
    if (tabRoutes.has(t.route)) continue;                  // 아직 탭에 있으면 OK
    const found = t.from.some((f) => {
      try { return reader(f).includes(`'${t.route}'`) || reader(f).includes(`"${t.route}"`); }
      catch { return false; }
    });
    if (!found) {
      out.push({ rule: 'R1', msg: `${t.route}(${t.why}) 가 탭에서 빠졌는데 진입로가 없다 — 화면은 살아 있는데 아무도 못 들어간다. ${t.from.join(' 또는 ')} 에 링크를 두어라` });
    }
  }

  // R2 — 탭 route 에 해당하는 화면 파일이 실제로 있는가
  for (const r of tabRoutes) {
    if (r === '/') continue;                                // index.tsx
    const p = `${APP_DIR}${r}.tsx`;
    if (!exists(p)) out.push({ rule: 'R2', msg: `탭이 ${r} 을 가리키는데 ${p} 가 없다 — 눌러도 빈 화면이다` });
  }
  return out;
}

// ── 자가테스트 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const navNew = `export const ALL_TABS = [
    { key: 'home', route: '/', match: '' },
    { key: 'community', route: '/community', match: '/community' },
    { key: 'my', route: '/settings', match: '/settings' },
  ] as const;`;
  const navOld = navNew.replace("route: '/community'", "route: '/contents'");
  const withLinks = `router.push('/contents'); router.push('/myreadings'); router.push('/charts');`;
  const okRead = () => withLinks;
  const badRead = () => `아무 링크도 없다`;
  const allExist = () => true;
  const cases: Array<[string, number]> = [
    ['정상(설정에 진입로 있음)', audit(navNew, okRead, allExist).length],
    ['진입로 없음 → 3건 도달불가', audit(navNew, badRead, allExist).length],
    ['탭에 남아 있으면 면제', audit(navOld, () => `router.push('/myreadings'); router.push('/charts');`, allExist).length],
    ['탭이 없는 화면을 가리킴', audit(navNew, okRead, (p) => !p.includes('community')).length],
    ['MUST_REACH 가 빔(하네스 무력화)', audit(navNew, okRead, allExist, []).length],
  ];
  const want = [0, 3, 0, 1, 1];
  let bad = 0;
  cases.forEach(([n, got], i) => {
    const ok = got === want[i];
    console.log(`  ${ok ? '✓' : '❌'} ${n} → ${got}건 (기대 ${want[i]})`);
    if (!ok) bad++;
  });
  console.log(bad ? `\n❌ 자가테스트 ${bad}건 실패` : `\n✅ check:reach 자가테스트 통과 (${cases.length}케이스)`);
  process.exit(bad ? 1 : 0);
}

const fails = audit(
  readFileSync(join(ROOT, P_NAV), 'utf8'),
  (p) => readFileSync(join(ROOT, p), 'utf8'),
  (p) => existsSync(join(ROOT, p)),
);
if (fails.length) {
  console.error(`❌ check:reach — ${fails.length}건 · 도달 불가 화면이 생긴다(오류는 안 난다)`);
  for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log(`✅ check:reach — 탭에서 뺀 화면 ${MUST_REACH.length}개 모두 다른 진입로가 있다`);
