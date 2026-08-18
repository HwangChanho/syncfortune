// app/src/lib/ui/brandAsset.ts — 시안 브랜드 자산의 **경로 단일 출처** (Boss 제공 · 2026-08-18)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 가 준 원본 시트를 잘라 Storage `img/brand/` 로 올렸다. 화면은 여기서만 경로를 얻는다 —
// 문자열을 화면마다 적으면 오타 하나가 **빈 이미지**로 조용히 나간다([[duplicate-ui-single-source]]).
//
// ★오행 세트는 `activeElement` 를 그대로 받는다. 테마가 바뀌면 아이콘도 같이 바뀐다 —
//   같은 화면에서 색이 따로 노는 일이 없다.
// ═══════════════════════════════════════════════════════════════════════════
import { A } from './remoteAsset';
import { activeElement } from '../theme';
import type { ThemeElement } from '../theme/elementPalette';

/** 오행 → 파일명 조각(영문). 한자를 파일명에 쓰면 URL 인코딩에서 문제가 잦다. */
const EL_SLUG: Record<ThemeElement, string> = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };

/** 브랜드 로고(심볼만). */
export const brandMark = () => A('brand/mark.png');
/** 로고 + 워드마크. */
export const brandWordmark = () => A('brand/wordmark.png');
/** 운 심볼(금화) — 원본의 검은 배경을 지운 투명 PNG. */
export const coinIcon = () => A('brand/coin.png');

/**
 * 오행 아바타(마이페이지 프로필).
 * @param el 오행. 생략하면 지금 테마 오행
 */
export const elementAvatar = (el: ThemeElement = activeElement) => A(`brand/av-${EL_SLUG[el]}.png`);

/** 홈 「무료로 체험해보세요!」 3열이 쓰는 아이콘 종류. */
export type FreeTrioKind = 'ziwei' | 'taro' | 'astro';

/**
 * 무료 3열 아이콘 — 오행별 색이 따로 있다.
 * @param kind 자미두수 / 타로 / 점성술
 * @param el   오행. 생략하면 지금 테마 오행
 */
export const freeTrioIcon = (kind: FreeTrioKind, el: ThemeElement = activeElement) =>
  A(`brand/f3-${kind}-${EL_SLUG[el]}.png`);

/** 콘텐츠 아이콘(투명 PNG) — 카드·목록에서 쓴다. */
export const contentIcon = (name:
  'heart' | 'ring' | 'coin' | 'moneybag' | 'briefcase' |
  'book' | 'idcard' | 'health' | 'family' | 'crystal') => A(`brand/ic-${name}.png`);

/** 카드 배경(가로형 일러스트). */
export const cardArt = (name:
  'balloon' | 'couple' | 'clover' | 'door' | 'compass' | 'stairs' |
  'candle' | 'tree' | 'moonlake' | 'sunrise' | 'forest' | 'butterfly' | 'pen') => A(`brand/cd-${name}.jpg`);
