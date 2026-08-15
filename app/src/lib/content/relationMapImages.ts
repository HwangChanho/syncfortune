// app/src/lib/content/relationMapImages.ts — 관계 지도 이미지 표
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-08-15: 관계 지도 **"디자인 — 이미지 사용"**.
//
// ★그림은 장식이 아니라 **문구의 비유 그 자체**다 — `relationMapPhrases` 의 `image` 한 줄
//   ("마른 흙에 물이 스미듯", "쇠를 두드리는 망치처럼")을 그대로 그린 것이다.
//   그래서 역할이 바뀌면 그림도 바뀌고, 사용자는 글을 읽기 전에 이미 무슨 사이인지 본다.
//
// 생성 = 로컬 Draw Things(`scripts/gen-relmap-images.py` · API 0원) · 톤은 기존 카드아트와 동일.
// 배달 = Storage(`assets/img/icons/relmap/*.jpg`) — 번들에 넣지 않는다([[app-size-remote-images]]).
// ─────────────────────────────────────────────────────────────────────────
import { A, type RemoteSource } from '../ui/remoteAsset';
import type { RelationRole } from '@engine/relationMap';

/**
 * 역할 5분류 → 그림. 파일명 slug 는 **기존 코퍼스와 같은 표기**를 쓴다
 * (lovestyle·bok·pastlife 가 이미 `inseong`·`bigeop`·`siksang`·`jaeseong`·`gwanseong`).
 * ⚠️'비견'의 slug 가 `bigeop`(비겁)인 것은 기존 표기를 따른 것 — 새 표기를 만들면 표가 또 갈린다.
 */
export const ROLE_IMG: Record<RelationRole, RemoteSource> = {
  인성: A('icons/relmap/inseong.jpg'),
  비견: A('icons/relmap/bigeop.jpg'),
  식상: A('icons/relmap/siksang.jpg'),
  재성: A('icons/relmap/jaeseong.jpg'),
  관성: A('icons/relmap/gwanseong.jpg'),
};

/** 지도 화면 최상단 히어로 — 가운데 나, 둘레의 사람들, 금실로 이어진 성좌도. */
export const RELMAP_HERO: RemoteSource = A('icons/relmap/hero.jpg');
