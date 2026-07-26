// scripts/check-nextstep.ts — 풀이 탭 '다음 단계' 퍼널 하네스(결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 이 퍼널이 지켜야 하는 계약:
//   INV1 결정론 — 같은 보유 상태면 항상 같은 추천(Set 순회 순서·Math.random 에 기대지 않음).
//   INV2 이미 본 걸 다시 권하지 않는다 — 추천 key 가 owned 에 있으면 안 된다(가장 치명적인 실수).
//   INV3 시작점 — 아무것도 없으면 반드시 사주 원국('reading').
//   INV4 종료 — 전부 보면 null(빈 카드·억지 추천 금지).
//   INV5 **저니가 실제로 굴러간다** — 시작점에서 추천을 계속 따라가면 여러 콘텐츠를 거치고 무한루프 없이 끝난다.
//        (RELATED 가 서로를 가리키다 2개만 왕복하면 '타고타고'가 안 되므로 체인 길이를 실측한다.)
//   INV6 큐레이션 정합 — RELATED 의 모든 값이 실제 콘텐츠 키(SECTIONS 의 creditKey/key)로 해석된다.
//        (오타·삭제된 콘텐츠를 가리키면 추천했는데 못 여는 상태가 된다.)
//
// 실행: npm run check:nextstep
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { RELATED } from '../app/src/lib/content/relatedMap';
import { pickNextStep, ownedKeysFrom } from '../app/src/lib/content/nextStep';

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const label = (k: string) => k; // 하네스에선 키를 그대로 라벨로(문구가 아니라 로직 검증)

// INV3 시작점
{
  const s = pickNextStep(new Set(), label);
  if (s?.key !== 'reading') bad(`INV3 시작점이 'reading' 이 아님: ${s?.key}`);
}

// INV1·INV2 — 여러 보유 조합
const CASES: string[][] = [
  [], ['reading'], ['reading', 'love'], ['reading', 'love', 'compat'],
  ['ziwei'], ['career'], ['wealth', 'jobfit'], ['newyear', 'lifegraph'],
  ['reading', 'love', 'career', 'talent'], ['compat', 'crush', 'reunion', 'love'],
];
for (const owned of CASES) {
  const set = new Set(owned);
  const a = pickNextStep(set, label);
  const b = pickNextStep(new Set([...owned].reverse()), label); // 삽입 순서만 다른 동일 집합
  if (JSON.stringify(a) !== JSON.stringify(b)) bad(`INV1 삽입 순서에 따라 추천이 달라짐: [${owned}] → ${a?.key} vs ${b?.key}`);
  if (a && set.has(a.key)) bad(`INV2 이미 본 걸 추천함: [${owned}] → ${a.key}`);
  if (a && !a.reason.trim()) bad(`빈 reason: [${owned}]`);
}

// INV5 저니 — 시작점부터 추천을 따라가며 체인 길이 측정(무한루프 방지 상한)
{
  const owned = new Set<string>();
  const path: string[] = [];
  for (let i = 0; i < 40; i++) {
    const s = pickNextStep(owned, label, path[path.length - 1]);
    if (!s) break;
    if (owned.has(s.key)) { bad(`INV5 저니 중 중복 추천(무한루프): ${s.key}`); break; }
    owned.add(s.key);
    path.push(s.key);
  }
  console.log(`  저니 체인 ${path.length}단계: ${path.join(' → ')}`);
  if (path.length < 4) bad(`INV5 체인이 너무 짧음(${path.length}단계) — '타고타고' 흐름이 안 만들어진다`);
  // INV4 종료 — 위 루프가 끝났으면 더 권할 게 없어야 정상(상한 40 에 걸린 게 아니어야)
  if (path.length >= 40) bad('INV4 40단계에서도 안 끝남 — 종료 조건 이상');
}

// INV6 큐레이션 정합 — RELATED 값이 실제 콘텐츠 키인지(정규식으로 SECTIONS 파싱: RN import 회피)
{
  const src = readFileSync('app/src/lib/content/contentSections.ts', 'utf8');
  const keys = new Set<string>();
  for (const m of src.matchAll(/\bkey:\s*'([^']+)'/g)) keys.add(m[1]);
  for (const m of src.matchAll(/\bcreditKey:\s*'([^']+)'/g)) keys.add(m[1]);
  // ★to(추천 대상)만 엄격 검사한다 — 추천했는데 못 여는 게 진짜 사고다.
  //   from(출발 키)은 **화면 kind** 일 수 있어 콘텐츠 목록에 없어도 정상이다
  //   (예: 오늘의 운세는 목록 키가 'today' 인데 RelatedContent 는 kind="daily" 로 호출한다).
  const unknownTo = new Set<string>();
  const kindOnlyFrom: string[] = [];
  for (const [from, list] of Object.entries(RELATED)) {
    if (!keys.has(from)) kindOnlyFrom.push(from);
    for (const to of list) if (!keys.has(to)) unknownTo.add(`${from}→${to}`);
  }
  if (!keys.size) bad('INV6 SECTIONS 파싱 실패 — 하네스 무력화');
  else if (unknownTo.size) bad(`INV6 존재하지 않는 콘텐츠를 추천함(열 수 없음): ${[...unknownTo].join(', ')}`);
  else console.log(`  RELATED 추천 대상 전부 실제 콘텐츠로 해석됨 ✓${kindOnlyFrom.length ? ` (출발키 중 화면 kind: ${kindOnlyFrom.join(', ')})` : ''}`);
}

// ownedKeysFrom — 접미사 카테고리 처리
{
  const s = ownedKeysFrom(['reading', 'celeb_123', 'compat_친구', '']);
  if (!s.has('reading') || !s.has('celeb') || !s.has('compat')) bad(`ownedKeysFrom 접미사 처리 실패: ${[...s]}`);
  if (s.has('')) bad('ownedKeysFrom 빈 키 유입');
}

console.log(fail ? `\n❌ check:nextstep 실패 ${fail}건` : '\n✅ check:nextstep 통과 — 결정론·중복추천금지·시작점·종료·저니체인·큐레이션정합 OK');
process.exit(fail ? 1 : 0);
