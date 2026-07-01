// scripts/test-reading-gate.ts — 풀이 게이트 시나리오 회귀 테스트 (daniel 07-02 하네스)
// ─────────────────────────────────────────────────────────────────────────
// 목적: 자물쇠(잠금)·권한 판정이 컴포넌트에 임베드돼 실기기에서만 버그를 발견하던 것을,
//   순수함수(app/src/lib/billing/readingGate)로 빼서 *빌드 전* `tsx`로 시나리오를 검증한다.
//   ★반복되던 자물쇠 버그를 첫 seed로 박아 재발을 원천 차단한다.
// 실행: npm run test:flows  (실패 시 exit 1 → preflight/빌드 중단)
// ─────────────────────────────────────────────────────────────────────────
import { computeEntitled, computeLocked, showUnlockOverlay, computeShouldAutoGen } from '../app/src/lib/billing/readingGate';

let fail = 0;
function eq(name: string, got: unknown, exp: unknown) {
  if (got !== exp) { console.error(`❌ ${name}\n   got=${JSON.stringify(got)} expected=${JSON.stringify(exp)}`); fail++; }
}
const L = (o: Partial<Parameters<typeof computeLocked>[0]>) => computeLocked({
  cacheLoaded: true, unlockedLoaded: true, entitled: false, hasProgress: false, readingsCount: 0, ...o,
});

// ── 권한(entitled) ──
eq('전역 프리미엄 = 권한', computeEntitled(true, false, false), true);
eq('이 명식 프리미엄 지정 = 권한', computeEntitled(false, true, false), true);
eq('결제 언락 = 권한', computeEntitled(false, false, true), true);
eq('전부 아님 = 미권한', computeEntitled(false, false, false), false);

// ── ★자물쇠 반복 버그 회귀(핵심) ──
eq('완료 풀이(캐시 16) + 미권한 진입 → 페이월 없음(캐시 있으니 절대 안 가림)', L({ readingsCount: 16 }), false);
eq('완료 풀이(캐시 16) → 생성 자물쇠(UnlockOverlay)도 없음', showUnlockOverlay(false, 16), false);
eq('부분 캐시(1) 미권한 → 페이월 없음(있는 건 보여줌)', L({ readingsCount: 1 }), false);

// ── 프리미엄/관리자 = 어떤 상태든 잠금 X ──
eq('프리미엄인데 빈 캐시라도 잠금 X', L({ entitled: computeEntitled(true, false, false), readingsCount: 0 }), false);

// ── 언락 로드 race(깜빡임 방지) ──
eq('언락 조회 전 = 잠금 보류(false)', L({ unlockedLoaded: false }), false);
eq('캐시 로드 전 = 잠금 보류(false)', L({ cacheLoaded: false }), false);

// ── 생성 중 ──
eq('생성 중 + 빈 캐시 = UnlockOverlay(자물쇠) O', showUnlockOverlay(true, 0), true);
eq('생성 중 = 페이월(locked)은 아님(생성 자물쇠가 담당)', L({ hasProgress: true }), false);

// ── 진짜 신규 미권한(빈 캐시) = 페이월로 결제 유도 ──
eq('미권한 + 빈 캐시 + 언락조회끝 = 페이월 O', L({}), true);

// ── ★자동생성 가드(자물쇠 반복 근본 방어) — stale/미스매치 로드로 재생성 금지 ──
const G = (o: Partial<Parameters<typeof computeShouldAutoGen>[0]>) => computeShouldAutoGen({
  premiumForChart: true, isRep: true, cacheLoaded: true, hasProgress: false, autoRan: false,
  online: true, hasSession: true, readingsChartId: 'A', currentChartId: 'A', missingCount: 5, ...o,
});
eq('프리미엄 대표 + 현재명식 기준 빈 캐시 = 자동생성 O', G({}), true);
eq('★로드된 캐시가 다른 명식(stale/race) = 자동생성 X(잘못된 명식 재생성=자물쇠 방지)', G({ readingsChartId: 'B', currentChartId: 'A' }), false);
eq('현재 chartId 미해결(null) = 자동생성 X', G({ currentChartId: null, readingsChartId: null }), false);
eq('미생성 영역 0(이미 완료) = 자동생성 X(재생성 안 함)', G({ missingCount: 0 }), false);
eq('생성 진행 중 = 자동생성 X', G({ hasProgress: true }), false);
eq('이미 1회 자동실행됨 = X', G({ autoRan: true }), false);
eq('비지정(비프리미엄) 명식 = X(수동 버튼)', G({ premiumForChart: false }), false);
eq('대표 명식 아님 = X(비용통제)', G({ isRep: false }), false);
eq('오프라인 = X(보류)', G({ online: false }), false);

if (fail) { console.error(`\n❌ 풀이 게이트 테스트 ${fail}건 실패`); process.exit(1); }
console.log('✅ 풀이 게이트 시나리오 전부 통과');
