// app/src/lib/prewarmReadings.ts — 프로 구독자 풀이 캐시 선생성(프리워밍)
// ─────────────────────────────────────────────────────────────────────────
// daniel: "프로 구독하면 내부적으로 프리미엄 통변 1회는 돌아가게 — 유저가 최대한 빨리 보게."
// 구독 상태로 앱에 들어오면 대표 명식의 전 영역(사주 16 + 자미 12궁)을 백그라운드로 미리
// 생성해 둔다 → 풀이 화면을 열면 전부 캐시 적중 = 즉시 표시.
//   · 이미 캐시된 영역은 건너뜀(서버 readings 조회) → 재실행해도 중복 과금 없음(멱등).
//   · (chart_id×category) DB 유니크 + Edge upsert 라 화면 생성과 경합해도 행 중복 없음.
//   · 실패 영역은 조용히 건너뜀 — 풀이 화면의 생성 버튼이 자연 폴백.
// ⚠️ 프로덕션 Edge(LLM) 호출 경로 — 프리미엄 계정에서만 트리거하라(호출처 책임).
// ─────────────────────────────────────────────────────────────────────────
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { computeChart } from './engine';
import { setServerChartId, type SavedChart } from './myChart';
import { appLang } from './i18n'; // 통변 출력 언어(앱 언어)
import type { ChartInput, CategoryKey } from '@spec/chart';

// 사주 16영역 — 풀이 캐시 category 키(단일 출처: ReadingScreen·프리워밍 공용)
export const SAJU_READING_CATEGORIES: CategoryKey[] = [
  '성격내면', '취업운', '직장운', '사업운', '금전소득운', '투자편재운', '재물손재', '연애운',
  '결혼배우자운', '대인사회성', '부모운', '형제운', '자식운', '건강', '학업자기계발', '이동환경',
];

/**
 * 서버 charts row 확보 — savedChart.serverChartId 있으면 재사용, 없으면 insert 후 매핑 저장(1회).
 * 풀이 캐시 chart_id 안정화의 단일 구현(ReadingScreen·프리워밍 공용, ADR-052).
 * @returns 서버 charts.id (실패 시 null)
 */
export async function ensureServerChartId(
  c: ReturnType<typeof computeChart>, input: ChartInput, session: Session, savedChart: SavedChart,
): Promise<string | null> {
  if (savedChart.serverChartId) return savedChart.serverChartId;
  const { data, error } = await supabase.from('charts')
    .insert({ owner_id: session.user.id, relation: 'self', saju: { ...c.saju, timeUnknown: input.timeAccuracy === '미상' }, ziwei: c.ziwei, consent: true })
    .select('id').single();
  if (error || !data) return null;
  await setServerChartId(savedChart.id, data.id); // 온디바이스 매핑 저장 → 다음부터 재사용
  return data.id;
}

let running = false; // 세션 내 동시 실행 방지(홈 재진입 등) — 멱등이지만 호출 낭비 차단

/**
 * 대표 명식의 풀이 전 영역을 백그라운드 선생성. fire-and-forget 으로 호출(await 불필요).
 * 멱등: 이미 생성된 영역은 서버 캐시 조회로 건너뛴다(LLM 0).
 */
export async function prewarmReadings(savedChart: SavedChart, session: Session): Promise<void> {
  if (running) return;
  running = true;
  try {
    const c = computeChart(savedChart.input);
    const id = await ensureServerChartId(c, savedChart.input, session, savedChart);
    if (!id) return;
    // 전 영역 = 사주 16 + 자미 12궁(명반 궁명 = 캐시 category)
    const all: { key: string; kind: 'saju' | 'ziwei' }[] = [
      ...SAJU_READING_CATEGORIES.map((k) => ({ key: k as string, kind: 'saju' as const })),
      ...((c.ziwei?.palaces as any[]) ?? []).map((p) => ({ key: p.name as string, kind: 'ziwei' as const })),
    ];
    // 이미 캐시된 영역 제외(멱등 — 비용 방어. Edge 도 요청마다 캐시 선확인 = 이중 생성 없음)
    const { data } = await supabase.from('readings').select('category').eq('chart_id', id).eq('lang', appLang());
    const have = new Set((data ?? []).map((r: any) => r.category));
    const missing = all.filter((x) => !have.has(x.key));
    // 사주·자미 *병렬* 두 체인(각 체인은 순차) — 자미가 사주 16개 뒤로 밀려 한쪽 화면이
    //   통째로 미생성 상태가 되는 것 방지(daniel: 자미 화면 열었더니 그제야 풀고 있음).
    const runChain = async (items: typeof missing) => {
      for (const m of items) {
        try {
          await supabase.functions.invoke('interpret', { body: { chartId: id, category: m.key, kind: m.kind, tier: 'paid', lang: appLang() } });
        } catch { /* 개별 실패 무시 — 풀이 화면 생성 버튼이 폴백 */ }
      }
    };
    await Promise.all([
      runChain(missing.filter((m) => m.kind === 'saju')),
      runChain(missing.filter((m) => m.kind === 'ziwei')),
    ]);
  } catch { /* 프리워밍은 보조 — 어떤 실패도 앱 흐름을 막지 않는다 */ }
  finally { running = false; }
}
