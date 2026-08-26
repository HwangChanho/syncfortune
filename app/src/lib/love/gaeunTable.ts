// app/src/lib/love/gaeunTable.ts — 인연 개운(방위·색·요일) **단일 출처**
// ═══════════════════════════════════════════════════════════════════════════
// ★왜 뺐나 — 같은 표가 **두 곳에** 있었다.
//   `ReunionRich`(재회)와 `CrushRich`(짝사랑)가 각자 `ELEM_GAEUN` 을 들고 있었고,
//   `CrushRich` 주석에는 *"ReunionRich ELEM_GAEUN과 동일 결·값"* 이라고 **적혀만** 있었다.
//   주석의 «같다» 는 보장이 아니다([[duplicate-ui-single-source]]) — 한쪽만 고치면 조용히 갈린다.
//
// ⚠️★값이 아니라 **문구 키**다. 모듈 상수라 `t()` 를 여기서 못 부른다 —
//   화면이 `t(GAEUN[el].color)` 처럼 그릴 때 푼다(Boss 2026-08-27 다국어).
// ═══════════════════════════════════════════════════════════════════════════
import type { Element } from '@spec/chart';

/** 오행 → 인연 개운(방위·색·요일)의 **문구 키**. 배우자성(인연星) 오행 기준. */
export const GAEUN: Record<Element, { dir: string; color: string; day: string }> = {
  木: { dir: 'rr.dirE', color: 'rr.colorWood', day: 'rr.dowThu' },
  火: { dir: 'rr.dirS', color: 'rr.colorFire', day: 'rr.dowTue' },
  土: { dir: 'rr.dirNear', color: 'rr.colorEarth', day: 'rr.dowSat' },
  金: { dir: 'rr.dirW', color: 'rr.colorMetal', day: 'rr.dowFri' },
  水: { dir: 'rr.dirN', color: 'rr.colorWater', day: 'rr.dowWed' },
};
