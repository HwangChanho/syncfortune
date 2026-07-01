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
import { supabase } from '../supabase';
import { computeChart } from '../engine/engine';
import { setServerChartId, type SavedChart } from '../engine/myChart';
import { appLang } from '../i18n'; // 통변 출력 언어(앱 언어)
import { getDailyFortune } from '../content/dailyFortune'; // H2(daniel): 오늘/내일 daily LLM 프리워밍용 일진
import { logEvent } from './logger'; // 방어: 일시적 불가 시 중단 로깅
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
// ★동시 호출 dedupe(daniel 06-30: charts row 중복발급 race = stale 근본원인 1차 방어) —
//   홈 진입 시 prewarmReadings·ReadingScreen autoGen·prewarmDaily 가 거의 동시에 이 함수를 호출하면
//   셋 다 serverChartId 미존재로 판단(setServerChartId 완료 전)해 insert_chart_enc 를 각자 때린다
//   → 본인 명식 1개에 charts row 가 여러 개 발급(실측: self 33개) → serverChartId 불안정 → 진입 시
//   캐시 미스 → autoGen 재생성 → 또 새 row(악순환·자물쇠+풀이중). 같은 localId 의 진행 중 Promise 를
//   공유해 *한 진입 = 한 발급* 으로 직렬화한다. (서버측 멱등 RPC = 근본 해결, ADR 별도.)
const inflightEnsure = new Map<string, Promise<string | null>>();

export async function ensureServerChartId(
  c: ReturnType<typeof computeChart>, input: ChartInput, session: Session, savedChart: SavedChart,
): Promise<string | null> {
  const lockKey = savedChart.id;
  const pending = inflightEnsure.get(lockKey);
  if (pending) return pending;                            // 이미 발급 진행 중이면 같은 결과를 공유(중복 insert 차단)
  const task = (async (): Promise<string | null> => {
    // ★항상 서버 멱등 RPC로 canonical id 해석(daniel 07-02 자물쇠 근본): 온디바이스에 캐시된 serverChartId를
    //   *그대로 재사용하지 않는다*. 캐시 id가 (계정 동기화 union머지 등으로) readings 적은 stale row를 가리키면
    //   readings(chart_id×category) 캐시 미스 → 프리미엄 자동생성(자물쇠+재생성)이 매 진입 반복되던 것이 근본 원인.
    //   insert_chart_enc는 (owner,relation,*안정 natal 지문*) 기준 **readings 최다 canonical row**를 반환/발급 →
    //   같은 명식은 항상 같은(가장 완성된) row로 수렴 → 캐시 적중 → 자동생성 안 함. 존재 row면 SELECT만(재암호화·재발급 없음=저비용).
    //   birth(ChartInput)는 평문으로 두지 않고 RPC가 서버에서 pgp 암호화 저장(규칙8·ADR-005: 관리자 복호화용 birth_enc).
    const { data, error } = await supabase.rpc('insert_chart_enc', {
      p_relation: 'self',
      p_saju: { ...c.saju, sensitivity: c.sensitivity, timeUnknown: input.timeAccuracy === '미상' }, // R35 예민보스(민감도)·辛金=날카로운 전문성 — 전체 통변 참고(daniel)
      p_ziwei: c.ziwei ?? null,
      p_birth: JSON.stringify(input),     // 서버에서 즉시 암호화 → birth_enc (관리자만 복호화)
      p_label: savedChart.label ?? null,  // 라벨도 동일 키로 암호화 → label_enc
    });
    if (error || !data) return savedChart.serverChartId ?? null; // RPC 실패(오프라인 등) = 기존 매핑 폴백(있으면)
    const newId = data as string;        // RPC 반환 = canonical charts.id(uuid)
    if (newId !== savedChart.serverChartId) await setServerChartId(savedChart.id, newId); // 바뀌었을 때만 온디바이스 매핑 갱신
    return newId;
  })();
  inflightEnsure.set(lockKey, task);
  try { return await task; } finally { inflightEnsure.delete(lockKey); }
}

/** SavedChart 로 서버 charts.id 확보(computeChart 내부 수행) — 프리미엄 명식 지정 등 호출처 편의 래퍼(daniel 07-01). */
export async function ensureServerChartIdForSaved(savedChart: SavedChart, session: Session): Promise<string | null> {
  try { return await ensureServerChartId(computeChart(savedChart.input), savedChart.input, session, savedChart); }
  catch { return null; }
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
          // 자미는 운한(대한 비성사화) 포함 최신 명반을 body 로(저장본 구버전 대비 — Edge 우선 사용).
          const { data } = await supabase.functions.invoke('interpret', { body: { chartId: id, category: m.key, kind: m.kind, tier: 'paid', lang: appLang(), ...(m.kind === 'ziwei' ? { ziwei: c.ziwei } : {}) } });
          // 방어(daniel): 일시적 불가(사용량 한도 등)면 남은 항목(16+)을 계속 때리지 말고 조용히 중단(사용자 노출 없음).
          if ((data as any)?.unavailable) { logEvent('prewarm_unavailable', { category: m.key, retryAt: (data as any)?.retryAt }, 'warn'); return; }
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

let dailyRunning = false; // 세션 내 daily 프리워밍 동시 실행 방지(멱등이지만 호출 낭비 차단)

/**
 * H2(daniel): 앱 진입 시 '오늘·내일 운세'(daily LLM)를 미리 생성해 둔다 — /today를 열면 즉시·정확.
 *   ⚠️ 프로덕션 Edge(LLM) 호출 — *프리미엄에서만* 트리거하라(호출처 책임). 구독료가 비용을 커버.
 *   무료 사용자는 비용(daily≈$0.044/건)을 홈 배너 광고(≈$0.001)로 못 덮으므로 자동 생성하지 않음
 *   → 무료는 /today에서 보상형 광고 1회로 생성(기존 모델 유지). fire-and-forget·멱등(캐시 선확인).
 */
export async function prewarmDaily(savedChart: SavedChart, session: Session): Promise<void> {
  if (dailyRunning) return;
  dailyRunning = true;
  try {
    const c = computeChart(savedChart.input);
    const id = await ensureServerChartId(c, savedChart.input, session, savedChart);
    if (!id) return;
    for (let off = 0; off < 2; off++) {                          // 오늘(0)·내일(1)
      const f = getDailyFortune(off);
      const category = `daily_${f.date.replace(/-/g, '')}`;       // today.tsx와 동일 캐시 키(daily_YYYYMMDD)
      const { data: have } = await supabase.from('readings').select('category').eq('chart_id', id).eq('category', category).eq('lang', appLang()).maybeSingle();
      if (have) continue;                                         // 이미 캐시 — 재생성 안 함(비용 0)
      const { data: res } = await supabase.functions.invoke('interpret', {
        body: { chartId: id, category, kind: 'daily', gz: f.dayGanZhi, tier: 'paid', lang: appLang(), ...(savedChart.context ? { context: savedChart.context } : {}) },
      });
      if ((res as any)?.unavailable) { logEvent('prewarm_daily_unavailable', { category, retryAt: (res as any)?.retryAt }, 'warn'); return; } // 한도 등 = 중단
    }
  } catch { /* 보조 — 실패해도 앱 흐름 무관(/today 생성 버튼이 폴백) */ }
  finally { dailyRunning = false; }
}
