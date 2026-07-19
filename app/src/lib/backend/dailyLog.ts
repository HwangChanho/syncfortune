// src/lib/backend/dailyLog.ts — 일별 기록(적중 회고 + 미션 체크) 저장·조회
// ─────────────────────────────────────────────────────────────────────────
// 리텐션 Phase 1(daniel 2026-07-19 승인) — 테이블 `daily_logs`(RLS: 본인 행만).
//   ①적중 기록: 그날 운세를 **박제**해 두고 사용자가 "실제로 어땠는지"(note/hit)를 남긴다.
//      → 사용자에겐 '내 사주가 맞나' 확인하는 재미 / 앱에겐 **적중·miss 데이터 축적**(해자).
//   ③미션 체크: 같은 하루 단위라 한 행을 공유한다.
//
// ★그날 운세(score/headline/energy_group)를 함께 저장하는 이유:
//   되돌아볼 때 "그때 이렇게 나왔다"를 보여줘야 하는데, 엔진 규칙이 개정되면 과거 날짜를 재계산한 값이
//   당시 화면과 달라진다(신뢰 훼손). 그래서 그 시점 값을 박제한다.
// ⚠️로그인 필요(계정 귀속·RLS). 비로그인은 저장하지 않고 화면에서 로그인 유도한다.
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase';

export type DailyLog = {
  log_date: string;            // 'YYYY-MM-DD'
  score: number | null;
  headline: string | null;
  energy_group: string | null;
  note: string | null;
  hit: number | null;          // 1=맞음 / 0=그저그럼 / -1=아님 / null=미평가
  mission_key: string | null;
  mission_done: boolean;
};

/** 그 날짜의 기록 1건(없으면 null). @param chartId 명식별 분리 — 명식을 바꾸면 기록도 분리된다. */
export async function getDailyLog(chartId: string | null, date: string): Promise<DailyLog | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return null;
  let q = supabase
    .from('daily_logs')
    .select('log_date, score, headline, energy_group, note, hit, mission_key, mission_done')
    .eq('user_id', u.user.id)
    .eq('log_date', date);
  // chart_id 는 nullable — 값이 있으면 그 명식으로 좁히고, 없으면 **명식 없이 저장된 행**(is null)을 찾는다.
  //   `.eq('chart_id', null)` 은 SQL 에서 `= NULL` 이라 항상 거짓이므로 반드시 `.is()` 를 써야 한다.
  q = chartId ? q.eq('chart_id', chartId) : q.is('chart_id', null);
  const { data } = await q.maybeSingle();
  return (data as DailyLog) ?? null;
}

/**
 * 기록 저장(upsert) — 같은 (user, chart, date)는 한 행이라 여러 번 저장하면 갱신된다.
 * @param patch 바꿀 필드만. 운세 박제값은 처음 저장 때만 채워 보내면 된다.
 */
export async function saveDailyLog(
  chartId: string | null,
  date: string,
  patch: Partial<Omit<DailyLog, 'log_date'>>,
): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return false;                       // 비로그인 = 저장 안 함(화면이 로그인 유도)
  const { error } = await supabase.from('daily_logs').upsert(
    { user_id: u.user.id, chart_id: chartId, log_date: date, updated_at: new Date().toISOString(), ...patch },
    { onConflict: 'user_id,chart_id,log_date' },
  );
  return !error;
}

/** 되돌아보기용 최근 기록(최신순). @param limit 기본 30일 */
export async function listDailyLogs(chartId: string | null, limit = 30): Promise<DailyLog[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return [];
  let q = supabase
    .from('daily_logs')
    .select('log_date, score, headline, energy_group, note, hit, mission_key, mission_done')
    .eq('user_id', u.user.id)
    .order('log_date', { ascending: false })
    .limit(limit);
  if (chartId) q = q.eq('chart_id', chartId);
  const { data } = await q;
  return (data ?? []) as DailyLog[];
}

/** 적중 요약 — "최근 N일 중 맞다고 한 날". 되돌아보기 화면 상단 한 줄에 쓴다. */
export function summarizeHits(logs: DailyLog[]): { rated: number; hit: number; ratio: number } {
  const rated = logs.filter((l) => l.hit !== null && l.hit !== undefined);
  const hit = rated.filter((l) => (l.hit ?? 0) > 0).length;
  return { rated: rated.length, hit, ratio: rated.length ? Math.round((hit / rated.length) * 100) : 0 };
}
