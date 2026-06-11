// app/src/lib/compatReadings.ts — 궁합 카테고리별 LLM 통변 호출·캐시 (프리미엄)
// ─────────────────────────────────────────────────────────────────────────
// 두 사람(나·상대)을 관계 유형(친구·동업·투자·연애·결혼)별로 일반인용 통변(Edge kind='compat').
//   캐시 = readings(chart_id=내 서버차트, category=compat_{rel}_{sig}). 같은 상대=같은 서명 → 재분석 시 적중.
//   교차작용(cross)·일간관계(dayRel)는 온디바이스(engine)에서 계산해 body로 전달(Edge는 engine 미보유).
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';
import { appLang } from './i18n'; // 궁합 통변 언어(앱 언어)

// 관계 유형(궁합 카테고리, daniel) — key=Edge 분기·캐시 / ko=표시
export const COMPAT_RELS: { key: string; ko: string }[] = [
  { key: 'friend', ko: '지인·친구' },
  { key: 'business', ko: '동업' },
  { key: 'invest', ko: '투자 파트너' },
  { key: 'love', ko: '연애' },
  { key: 'marriage', ko: '결혼' },
];

export type CompatReading = { core?: string; base?: string; overlay?: string; remedy?: string; error?: string };

// Edge 궁합 응답: 통변 or 게이트(프리미엄 유도·건당 결제 필요)
export type CompatResult =
  | { kind: 'answer'; reading: CompatReading }
  | { kind: 'needPremium' }
  | { kind: 'needPayment'; used: number; freeLimit: number }
  | { kind: 'error' };

/** 상대 차트 서명(캐시 키 일부) — 4기둥 간지 결합. 같은 상대 = 같은 서명 → 캐시 적중. */
export function otherSig(otherSaju: any): string {
  const p = otherSaju?.pillars ?? {};
  return (['년', '월', '일', '시'].map((k) => `${p[k]?.stem ?? ''}${p[k]?.branch ?? ''}`).join('') || 'x');
}

/** 이 상대(sig)에 대해 이미 생성된 관계별 통변 로드 → rel 별 맵. */
export async function loadCompatReadings(chartId: string, sig: string): Promise<Record<string, CompatReading>> {
  const { data } = await supabase.from('readings').select('category, content').eq('chart_id', chartId).like('category', 'compat_%').eq('lang', appLang());
  const out: Record<string, CompatReading> = {};
  (data ?? []).forEach((r: any) => {
    if (!String(r.category).endsWith(`_${sig}`)) return;       // 이 상대 것만(category=compat_{rel}_{sig})
    out[String(r.category).split('_')[1]] = r.content;         // rel → content
  });
  return out;
}

/**
 * 한 관계 유형 통변 생성(Edge kind='compat', 캐시 적중 시 재생성 0). cross/dayRel = 온디바이스 계산값.
 * 게이트: 비프리미엄=needPremium / 무료 5쌍 초과=needPayment(paid 로 우회). 서버가 판정.
 */
export async function genCompatReading(
  chartId: string, rel: string, sig: string, otherSaju: any, cross: string[], dayRel: string, paid = false,
): Promise<CompatResult> {
  const { data, error } = await supabase.functions.invoke('interpret', {
    body: { chartId, category: `compat_${rel}_${sig}`, kind: 'compat', tier: 'paid', otherSaju, cross, dayRel, paid, lang: appLang() },
  });
  if (error) return { kind: 'error' };
  if (data?.needPremium) return { kind: 'needPremium' };
  if (data?.needPayment) return { kind: 'needPayment', used: data.used, freeLimit: data.freeLimit };
  if (data?.reading) return { kind: 'answer', reading: data.reading as CompatReading };
  return { kind: 'error' };
}
