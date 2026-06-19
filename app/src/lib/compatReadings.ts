// app/src/lib/compatReadings.ts — 궁합 카테고리별 LLM 통변 호출·캐시 (프리미엄)
// ─────────────────────────────────────────────────────────────────────────
// 두 사람(나·상대)을 관계 유형(친구·동업·투자·연애·결혼)별로 일반인용 통변(Edge kind='compat').
//   캐시 = readings(chart_id=내 서버차트, category=compat_{rel}_{sig}). 같은 상대=같은 서명 → 재분석 시 적중.
//   교차작용(cross)·일간관계(dayRel)는 온디바이스(engine)에서 계산해 body로 전달(Edge는 engine 미보유).
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';
import { appLang } from './i18n'; // 궁합 통변 언어(앱 언어)

// 관계 유형(궁합 카테고리, daniel) — key=Edge 분기·캐시 / tk=i18n 라벨 키(compat.rel.*)
//   관계를 폭넓게: 정서(친구·가족·썸·연애·결혼) + 일/이해관계(직장·윗사람·동업·투자).
// daniel 2026-06: 썸·짝사랑→연애(love) 하위 섹션 흡수 / 투자→동업(business) 하위 섹션 흡수. crush·invest 독립 관계 제거.
export const COMPAT_RELS: { key: string; tk: string }[] = [
  { key: 'friend', tk: 'compat.rel.friend' },
  { key: 'family', tk: 'compat.rel.family' },
  { key: 'love', tk: 'compat.rel.love' },
  { key: 'marriage', tk: 'compat.rel.marriage' },
  { key: 'coworker', tk: 'compat.rel.coworker' },
  { key: 'senior', tk: 'compat.rel.senior' },
  { key: 'staff', tk: 'compat.rel.staff' },
  { key: 'business', tk: 'compat.rel.business' },
];

// 통변 = 관계별 동적 섹션(Edge 출력 키와 1:1). 연애·결혼은 속궁합+디테일, 동업은 투자 분리.
export type CompatReading = { [section: string]: string | undefined; error?: string };

export type CompatSection = { key: string; ko: string; en: string; ja: string };
const DEFAULT_SECTIONS: CompatSection[] = [
  { key: 'core', ko: '핵심', en: 'Core', ja: '核心' },
  { key: 'base', ko: '기본 맞물림', en: 'How you fit', ja: '基本の噛み合い' },
  { key: 'overlay', ko: '잘 맞고 부딪힘', en: 'Fit & friction', ja: '相性と摩擦' },
  { key: 'remedy', ko: '잘 가꾸는 법', en: 'How to nurture', ja: '育て方' },
];
// ★관계별 섹션 — 연애(속궁합·썸·짝사랑 포함)·결혼(속궁합 포함)·동업(투자 분리). 그 외는 기본 4항목.
export const COMPAT_SECTIONS: Record<string, CompatSection[]> = {
  love: [
    { key: 'core', ko: '핵심', en: 'Core', ja: '核心' },
    { key: 'attraction', ko: '첫인상·끌림', en: 'First draw', ja: '第一印象' },
    { key: 'chemistry', ko: '속궁합', en: 'Intimacy', ja: '相性(親密)' },
    { key: 'sseom', ko: '썸·초반', en: 'Early spark', ja: '初期' },
    { key: 'crush', ko: '짝사랑', en: 'One-sided', ja: '片思い' },
    { key: 'style', ko: '연애 스타일', en: 'Dating style', ja: '恋愛スタイル' },
    { key: 'good', ko: '잘 맞는 점', en: 'Strengths', ja: '合う点' },
    { key: 'friction', ko: '부딪히는 점', en: 'Friction', ja: 'ぶつかる点' },
    { key: 'crisis', ko: '권태·위기', en: 'Slumps', ja: '倦怠·危機' },
    { key: 'future', ko: '발전·미래', en: 'Future', ja: '発展·未来' },
    { key: 'advice', ko: '조언', en: 'Advice', ja: 'アドバイス' },
  ],
  marriage: [
    { key: 'core', ko: '핵심', en: 'Core', ja: '核心' },
    { key: 'chemistry', ko: '속궁합', en: 'Intimacy', ja: '相性(親密)' },
    { key: 'life', ko: '생활 습관', en: 'Daily life', ja: '生活習慣' },
    { key: 'values', ko: '가치관·돈', en: 'Values & money', ja: '価値観·お金' },
    { key: 'inlaws', ko: '시댁·처가', en: 'In-laws', ja: '両家' },
    { key: 'children', ko: '자녀', en: 'Children', ja: '子供' },
    { key: 'friction', ko: '갈등', en: 'Friction', ja: '葛藤' },
    { key: 'longterm', ko: '장기 안정', en: 'Long-term', ja: '長期安定' },
    { key: 'advice', ko: '조언', en: 'Advice', ja: 'アドバイス' },
  ],
  business: [
    { key: 'core', ko: '핵심', en: 'Core', ja: '核心' },
    { key: 'roles', ko: '역할 분담', en: 'Roles', ja: '役割分担' },
    { key: 'trust', ko: '신뢰', en: 'Trust', ja: '信頼' },
    { key: 'invest', ko: '투자 파트너', en: 'Investing', ja: '投資' },
    { key: 'friction', ko: '갈등 지점', en: 'Friction', ja: '葛藤点' },
    { key: 'profit', ko: '이익 분배', en: 'Profit split', ja: '利益配分' },
    { key: 'advice', ko: '조언', en: 'Advice', ja: 'アドバイス' },
  ],
  // 직원 관리(daniel 2026-06): 사업가가 직원·부하의 성향을 보고 강점·동기부여·소통·갈등을 세분 — 관리 관점.
  staff: [
    { key: 'core', ko: '핵심', en: 'Core', ja: '核心' },
    { key: 'nature', ko: '직원의 성향', en: 'Their nature', ja: '社員の性向' },
    { key: 'strength', ko: '강점·맡길 일', en: 'Strengths & roles', ja: '強み·任せる仕事' },
    { key: 'motivate', ko: '동기부여·이끄는 법', en: 'Motivating & leading', ja: '動機づけ·導き方' },
    { key: 'communication', ko: '소통·피드백', en: 'Communication', ja: 'コミュニケーション' },
    { key: 'friction', ko: '주의·갈등', en: 'Caution', ja: '注意·葛藤' },
    { key: 'advice', ko: '관리 조언', en: 'Advice', ja: 'アドバイス' },
  ],
  friend: [
    { key: 'core', ko: '핵심', en: 'Core', ja: '核心' },
    { key: 'vibe', ko: '함께일 때', en: 'Together vibe', ja: '一緒の空気' },
    { key: 'trust', ko: '신뢰·의리', en: 'Trust & loyalty', ja: '信頼·義理' },
    { key: 'fun', ko: '즐거움·시너지', en: 'Fun & synergy', ja: '楽しさ' },
    { key: 'friction', ko: '부딪히는 점', en: 'Friction', ja: 'ぶつかる点' },
    { key: 'longevity', ko: '오래가는 법', en: 'Lasting', ja: '長続き' },
    { key: 'advice', ko: '조언', en: 'Advice', ja: 'アドバイス' },
  ],
  family: [
    { key: 'core', ko: '핵심', en: 'Core', ja: '核心' },
    { key: 'bond', ko: '정서적 유대', en: 'Bond', ja: '絆' },
    { key: 'roles', ko: '역할·기대', en: 'Roles', ja: '役割·期待' },
    { key: 'support', ko: '서로 기댐', en: 'Support', ja: '支え合い' },
    { key: 'friction', ko: '갈등', en: 'Friction', ja: '葛藤' },
    { key: 'heal', ko: '관계 회복', en: 'Healing', ja: '関係回復' },
    { key: 'advice', ko: '조언', en: 'Advice', ja: 'アドバイス' },
  ],
  coworker: [
    { key: 'core', ko: '핵심', en: 'Core', ja: '核心' },
    { key: 'workstyle', ko: '일 스타일', en: 'Work style', ja: '仕事スタイル' },
    { key: 'synergy', ko: '협업·시너지', en: 'Synergy', ja: '協業' },
    { key: 'communication', ko: '소통', en: 'Communication', ja: 'コミュニケーション' },
    { key: 'friction', ko: '마찰', en: 'Friction', ja: '摩擦' },
    { key: 'distance', ko: '적정 거리', en: 'Boundaries', ja: '適度な距離' },
    { key: 'advice', ko: '조언', en: 'Advice', ja: 'アドバイス' },
  ],
  senior: [
    { key: 'core', ko: '핵심', en: 'Core', ja: '核心' },
    { key: 'dynamic', ko: '권위 관계', en: 'Dynamic', ja: '上下関係' },
    { key: 'read', ko: '상사 성향 읽기', en: 'Read them', ja: '上司の性向' },
    { key: 'getalong', ko: '잘 지내는 법', en: 'Getting along', ja: 'うまくやる' },
    { key: 'friction', ko: '주의·갈등', en: 'Caution', ja: '注意·葛藤' },
    { key: 'grow', ko: '성장·기회', en: 'Growth', ja: '成長·機会' },
    { key: 'advice', ko: '조언', en: 'Advice', ja: 'アドバイス' },
  ],
};
/** 관계(rel)의 통변 섹션 목록 — 없으면 기본 4항목. 연도별(hasYear)은 기본 4항목 사용(특정 해 흐름). */
export function compatSections(rel: string, hasYear = false): CompatSection[] {
  return hasYear ? DEFAULT_SECTIONS : (COMPAT_SECTIONS[rel] ?? DEFAULT_SECTIONS);
}
export function compatSectionLabel(s: CompatSection): string {
  return (s as any)[appLang()] ?? s.ko;
}

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
    const parts = String(r.category).split('_');               // compat _ rel _ sig [_ y{YYYY}=연도별]
    if (parts[2] !== sig) return;                              // 이 상대(sig) 것만
    const key = parts[3] ? `${parts[1]}_${parts[3]}` : parts[1]; // 원국=rel / 연도별=rel_y{YYYY}
    out[key] = r.content;
  });
  return out;
}

/**
 * 한 관계 유형 통변 생성(Edge kind='compat', 캐시 적중 시 재생성 0). cross/dayRel = 온디바이스 계산값.
 * 게이트: 비프리미엄=needPremium / 무료 5쌍 초과=needPayment(paid 로 우회). 서버가 판정.
 */
export async function genCompatReading(
  chartId: string, rel: string, sig: string, otherSaju: any, cross: string[], dayRel: string,
  meZiwei?: any, otherZiwei?: any, // 자미 교차(나=최신명반, 상대=상대 명반) — 사주 주축 + 자미 보조
  year?: string, yearGz?: string,  // year 있으면 연도별(그 해 흐름). yearGz=그 해 간지(클라 계산)
  meContext?: any,                  // 본인 명식 기본정보(context: 하는일·관계상태 등) grounding — R25 현재 배우자 유무가 궁합 해석 좌우(daniel)
): Promise<CompatResult> {
  const category = year ? `compat_${rel}_${sig}_y${year}` : `compat_${rel}_${sig}`;
  const { data, error } = await supabase.functions.invoke('interpret', {
    body: { chartId, category, kind: 'compat', tier: 'paid', otherSaju, otherZiwei, cross, dayRel, yearGz, ziwei: meZiwei, lang: appLang(), ...(meContext ? { context: meContext } : {}) }, // paid 제거(서버가 크레딧/프리미엄 판정) + context grounding
  });
  if (error) return { kind: 'error' };
  if (data?.needPremium) return { kind: 'needPremium' };
  if (data?.needPayment) return { kind: 'needPayment', used: data.used, freeLimit: data.freeLimit };
  if (data?.reading) return { kind: 'answer', reading: data.reading as CompatReading };
  return { kind: 'error' };
}
