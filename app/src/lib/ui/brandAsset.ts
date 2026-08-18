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

/** 배너 일러스트 이름 — Storage `brand/bn-<name>.jpg`. */
export type BannerArt =
  | 'balloon' | 'couple' | 'compass' | 'moonlake' | 'forest'    // 水 계열(라벤더·블루)
  | 'door' | 'sunrise' | 'pen'                                   // 土 계열(피치·탠)
  | 'clover' | 'tree'                                            // 木 계열(그린)
  | 'stairs' | 'butterfly'                                       // 火 계열(로즈)
  | 'candle';                                                    // 중성(라벤더그레이)

/**
 * 홈 추천 배너의 배경 일러스트.
 * @param name 그림 이름
 *
 * ★가로형이고 **왼쪽이 비어 있다** — 원본부터 배너용으로 그려진 것이라 글자가 그 자리에 앉는다.
 *   (다만 왼쪽이 늘 밝지는 않다 — pen·compass·forest 는 어두운 그림이 글자 자리를 파고든다.
 *    그래서 `PromoBanner` 가 **밝은 스크림**을 깔고 글자를 올린다. `check:bannerart` 가 그 스크림을 지킨다.)
 */
export const bannerArt = (name: BannerArt) => A(`brand/bn-${name}.jpg`);

/**
 * 오행별 배너 그림 풀. 배너가 페이지 색과 **같은 계열**로 보이게 한다.
 *
 * ★시안 실측(p04 水=풍선 · p13 土=문 · p21 木=클로버 · p29 火=계단 · p37 金=풍선)
 *   — 같은 배너 문구인데 오행마다 **그림이 다르다**. 즉 그림은 슬라이드가 아니라 **테마**를 따른다.
 * ⚠️金 은 전용 그림이 없다 — 시안도 金 페이지에서 **水의 풍선을 회색으로 눌러** 썼다.
 *   여기서는 차선으로 가장 차분한 것들(초·달호수·나침반)을 빌려 쓴다. 전용 그림이 오면 갈아 끼운다.
 */
export const BANNER_POOL: Record<ThemeElement, readonly BannerArt[]> = {
  水: ['balloon', 'couple', 'compass', 'moonlake', 'forest'],
  土: ['door', 'sunrise', 'pen'],
  木: ['clover', 'tree'],
  火: ['stairs', 'butterfly'],
  金: ['candle', 'moonlake', 'compass', 'balloon', 'couple'],
};

/**
 * 배너 한 장이 쓸 그림 — 슬라이드 번호로 풀을 돌린다.
 * @param slide 캐러셀 몇 번째 장인가(0부터)
 * @param el    오행. 생략하면 지금 테마 오행
 * ★풀보다 슬라이드가 많으면 다시 처음으로 돈다(木·火 는 2장뿐이라 번갈아 나온다).
 */
export const bannerArtFor = (slide: number, el: ThemeElement = activeElement) => {
  const pool = BANNER_POOL[el];
  return bannerArt(pool[slide % pool.length]);
};
