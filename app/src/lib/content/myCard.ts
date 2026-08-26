// app/src/lib/content/myCard.ts — 「나의 카드」: 흩어진 유형을 **한 장에 모으고 저장한다**
// ═══════════════════════════════════════════════════════════════════════════
// 「자기·타인 탐색 기획」(2026-08-25) §2-A · Boss 2026-08-27
//   *"유형은 입구, 계산은 깊이 기획서 대로 진행해"*
//
// ■ ★기획서가 짚은 «빠진 것 셋» 중 ②를 메운다
//   MBTI 가 도구로 작동하는 이유는 내용이 깊어서가 아니라 **기억되고 저장되기** 때문이다.
//   실측(08-27): 유형 결과를 담는 표가 **없었다** — 전부 열어 보고 끝났다.
//   자기 유형을 모르면 남에게 말할 수 없고, 말할 수 없으면 퍼지지 않는다.
//
// ■ ★**새로 계산하지 않는다** — 각 화면의 산출을 그대로 읽어 온다
//   기획서: *"새 계산 없음 — 각 화면의 산출을 읽어 온다."*
//   여기서 따로 계산하면 «카드의 나» 와 «상세 화면의 나» 가 갈린다. 그건 유형이 아니라 오류다.
//
// ■ ★저장은 **사본**이지 정본이 아니다
//   유형은 명식에서 결정론으로 나온다(API 0). 지우면 다시 계산하면 그만이다.
//   저장하는 이유는 ①다시 안 계산하고 ②남에게 보여 주고 ③**시간이 지나 바뀐 걸 아는 것**.
//   ⇒ `computed_at` 을 남긴다 — 에겐/테토처럼 **대운이 바뀌면 값이 바뀌는 축**이 있다.
//
// ■ ⚠️애착유형은 **안 넣는다**
//   그건 명식만으로 안 나오고 **설문 답**이 있어야 한다. 설문을 안 한 사람에게 빈 칸을 보이면
//   «카드가 미완성» 으로 읽힌다. 한 사람이 답했으면 그 화면에서 보면 된다.
//   ⚠️그리고 기획서 §5: **판정 대기 중인 민감 분류는 카드에 안 올린다.**
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';
import { computeChart } from '../engine/engine';
import { personaOf } from '../engine/personaType';
import { DAY_PILLAR, dayPillarKey } from '../engine/dayPillar';
import { bokType } from './bokType';
import { sajuMbti } from './sajuMbti';
import { egenTeto } from './egenTeto';
import type { ChartInput } from '@spec/chart';

/** 카드 한 칸. ★`route` 가 있어야 «입구» 가 된다 — 눌러서 깊이로 들어간다. */
export type CardSlot = {
  kind: 'dayPillar' | 'persona' | 'mbti' | 'egenteto' | 'bok';
  /** 칸 제목(무엇의 유형인가) */
  label: string;
  /** ★한 마디로 말할 수 있는 값 — 이게 «남에게 말하는 단위» 다 */
  value: string;
  /** 한 줄 설명 */
  sub: string;
  /** 눌렀을 때 갈 곳(깊이) */
  route: string;
};

/**
 * 명식 하나에서 카드 다섯 칸을 만든다.
 *
 * ★각 값은 **그 화면이 쓰는 함수 그대로**다(`personaOf`·`sajuMbti`…). 여기서 새 판단을 하지 않는다.
 * @param input 명식 입력(대표 명식)
 */
export function buildMyCard(input: ChartInput): CardSlot[] {
  const saju = computeChart(input).saju;
  const out: CardSlot[] = [];

  // ① 일주 — 명리의 정통 축(60갑자)
  const d = saju?.pillars?.['일'];
  const k = dayPillarKey(d?.stem, d?.branch);
  if (k && DAY_PILLAR[k]) {
    out.push({
      kind: 'dayPillar', label: '일주', value: k,
      sub: DAY_PILLAR[k].keywords.slice(0, 3).join(' · '),
      route: '/dayPillar',
    });
  }

  // ② 성격유형 — 일간 × 월지(120종)
  try {
    const m = saju?.pillars?.['월']?.branch;
    if (d?.stem && m) {
      const p = personaOf(d.stem as never, m as never);
      out.push({ kind: 'persona', label: '성격유형', value: p.name, sub: p.keywords.slice(0, 3).join(' · '), route: '/personatype' });
    }
  } catch (e) { console.warn('[myCard] 성격유형 실패', e); }

  // ③ MBTI — 말하기 가장 쉬운 축(16)
  try {
    const r = sajuMbti(saju);
    out.push({ kind: 'mbti', label: 'MBTI', value: r.type, sub: r.nickname, route: '/mbti' });
  } catch (e) { console.warn('[myCard] MBTI 실패', e); }

  // ④ 에겐/테토 — ⚠️**운에 따라 바뀌는 축**(원국 + 현재 대운·세운)
  try {
    const r = egenTeto(saju);
    const name = r.type === 'teto' ? '테토' : r.type === 'egen' ? '에겐' : '반반';
    out.push({ kind: 'egenteto', label: '에겐·테토', value: name, sub: `테토 ${r.tetoScore}점`, route: '/egenteto' });
  } catch (e) { console.warn('[myCard] 에겐테토 실패', e); }

  // ⑤ 타고난 복
  try {
    const r = bokType(saju);
    out.push({ kind: 'bok', label: '타고난 복', value: `${r.emoji} ${r.bok}`, sub: r.desc, route: '/bok' });
  } catch (e) { console.warn('[myCard] 복 실패', e); }

  return out;
}

/**
 * 카드를 저장한다(`user_types`).
 *
 * ⚠️★**원시 생년월일시를 넣지 않는다** — 공유 카드로 새어 나간다.
 *   저장하는 것은 «유형 결과» 뿐이다(`value` = 한 마디 · `sub` = 한 줄).
 * @returns 저장한 칸 수. 실패하면 0(화면은 계속 보인다 — 저장은 부가다)
 */
export async function saveMyCard(chartId: string, slots: CardSlot[]): Promise<number> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid || !chartId || !slots.length) return 0;
  const rows = slots.map((s) => ({
    user_id: uid, chart_id: chartId, kind: s.kind,
    value: { value: s.value, sub: s.sub, label: s.label },   // ★결과만
    computed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }));
  const r = await withTimeout(supabase.from('user_types').upsert(rows, { onConflict: 'user_id,chart_id,kind' }), 8000);
  if (!r || r.error) { console.warn('[myCard] 저장 실패', r?.error?.message); return 0; }
  return rows.length;
}

/** 저장된 카드가 **언제 계산된 것인지**. 없으면 null. */
export async function savedAt(chartId: string): Promise<string | null> {
  const r = await withTimeout(
    supabase.from('user_types').select('computed_at').eq('chart_id', chartId)
      .order('computed_at', { ascending: false }).limit(1).maybeSingle(), 8000);
  if (!r || r.error) return null;
  return (r.data as any)?.computed_at ?? null;
}
