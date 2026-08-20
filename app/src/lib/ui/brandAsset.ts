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

/**
 * 브랜드 자산 폴더의 **버전**.
 *
 * ⚠️왜 버전이 붙나: Storage 업로드는 `cache-control: 1년` 이라 **같은 이름으로 덮으면
 *   낡은 파일이 계속 나간다**(CDN·앱 디스크 캐시 둘 다). 실제로 두 번 당했다 —
 *   ①어긋난 크롭(`cd-*`) ②흰 배경이 남아 **흰 사각형**으로 보이던 아바타·무료3열 아이콘 20장
 *   ③v2→v3: 무료3열 아이콘 15장이 **셀 격자로 잘려** 내용이 제각각 치우치고 타로는 아래가 잘렸다.
 * ⇒ 그림을 **다시 자르거나 고치면 이 숫자를 올린다**. 이름은 그대로 두고 폴더만 바꾼다.
 */
const BRAND_DIR = 'brand/v3';

/** 오행 → 파일명 조각(영문). 한자를 파일명에 쓰면 URL 인코딩에서 문제가 잦다. */
const EL_SLUG: Record<ThemeElement, string> = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };

/** 브랜드 로고(심볼만). */
export const brandMark = () => A(`${BRAND_DIR}/mark.png`);
/** 로고 + 워드마크. */
export const brandWordmark = () => A(`${BRAND_DIR}/wordmark.png`);
/** 운 심볼(금화) — 원본의 검은 배경을 지운 투명 PNG. */
export const coinIcon = () => A(`${BRAND_DIR}/coin.png`);

/**
 * 오행 아바타(마이페이지 프로필).
 * @param el 오행. 생략하면 지금 테마 오행
 */
export const elementAvatar = (el: ThemeElement = activeElement) => A(`${BRAND_DIR}/av-${EL_SLUG[el]}.png`);

/** 홈 「무료로 체험해보세요!」 3열이 쓰는 아이콘 종류. */
export type FreeTrioKind = 'ziwei' | 'taro' | 'astro';

/**
 * 무료 3열 아이콘 — 오행별 색이 따로 있다.
 * @param kind 자미두수 / 타로 / 점성술
 * @param el   오행. 생략하면 지금 테마 오행
 */
export const freeTrioIcon = (kind: FreeTrioKind, el: ThemeElement = activeElement) =>
  A(`${BRAND_DIR}/f3-${kind}-${EL_SLUG[el]}.png`);

/** 콘텐츠 아이콘(투명 PNG) — 카드·목록에서 쓴다. */
/** 콘텐츠 아이콘 이름 — ★열 종뿐이다. 없는 이름을 쓰면 빈 자리가 뜨므로 타입으로 막는다. */
export type ContentIcon =
  | 'heart' | 'ring' | 'coin' | 'moneybag' | 'briefcase'
  | 'book' | 'idcard' | 'health' | 'family' | 'crystal';

export const contentIcon = (name: ContentIcon) => A(`${BRAND_DIR}/ic-${name}.png`);

/** 배너 일러스트 이름 — Storage `brand/bn-<name>.jpg`. */
export type BannerArt =
  | 'balloon' | 'couple' | 'moonlake'      // 水 계열(라벤더·블루)
  | 'door' | 'sunrise'                     // 土 계열(피치·탠)
  | 'clover' | 'tree'                      // 木 계열(그린)
  | 'stairs' | 'butterfly'                 // 火 계열(로즈)
  | 'candle'                               // 중성(라벤더그레이)
  // ★아래 셋은 Storage 에는 있었지만 타입에 빠져 있었다(2026-08-20 대화 그림을 붙이다 타입체커가 잡았다).
  //   배너 회전(`BANNER_POOL`)에는 넣지 않았다 — 거긴 오행별로 색이 맞아야 하고,
  //   이 셋은 **대화에서 주제로 고르는 용도**라 색 계열을 따지지 않는다.
  | 'compass' | 'forest' | 'pen';

/**
 * 그림의 **바탕색**(왼쪽 빈 면의 색) — 배너 배경을 이 값으로 칠한다.
 *
 * ★왜 이 값을 데이터로 갖고 있나: 그림은 알파가 없는 JPEG 라, 배너 배경이 다르면
 *   그림 자리에 **밝은 사각형**이 뜬다. 배경을 그림의 바탕색과 같게 맞추면 이음매가 사라져
 *   시안처럼 "색면 위에 그림이 얹힌" 한 장으로 보인다(시안 p13 土가 정확히 그 모양이다).
 * ⚠️눈으로 고른 값이 아니라 각 그림 좌상단 1/4 의 **중앙값을 계산**한 것이다.
 *   `check:bannerart` 가 파일을 다시 읽어 이 값과 맞는지 검증한다.
 */
// ⚠️`Record<BannerArt, …>` 라 새 이름을 추가하면 여기도 채워야 한다(타입이 강제한다).
//   대화용 셋은 배너로 쓰이지 않지만, 값을 비워 둘 수 없으므로 계열이 가까운 색을 준다.
export const BANNER_FIELD: Record<BannerArt, string> = {
  balloon: '#E7E8FD', couple: '#E9ECFF', moonlake: '#DADEFC',
  door: '#FFEEDB', sunrise: '#FEE8C9',
  clover: '#F0F0E4', tree: '#F1F1E7',
  stairs: '#FCDDDD', butterfly: '#FCDEDE',
  candle: '#EDE9F7',
  // 대화용 셋(2026-08-20) — ★기존 값과 **같은 방법**으로 뽑았다(그림 좌상단 1/4 의 중앙값).
  //   눈으로 고르지 않는다 — 배경이 그림 바탕색과 어긋나면 그림 자리에 밝은 사각형이 뜬다.
  compass: '#ECE8F6', forest: '#B1BBF9', pen: '#FFE6C7',
};

/**
 * 배너 일러스트.
 * @param name 그림 이름
 *
 * ★가로형이고 **왼쪽 절반이 비어 있다** — 그 자리에 글자가 앉는다.
 * ⚠️`pen`·`forest`·`compass` 는 여기에 **없다**. 그림이 화면을 가득 채워 왼쪽이 비지 않는 종류라
 *   글자를 얹으면 대비가 1.09·3.00·3.65 로 떨어진다(실측). 배너용이 아니다.
 */
export const bannerArt = (name: BannerArt) => A(`${BRAND_DIR}/bn-${name}.jpg`);

/**
 * 오행별 배너 그림 풀. 배너가 페이지 색과 **같은 계열**로 보이게 한다.
 *
 * ★시안 실측(p04 水=풍선 · p13 土=문 · p21 木=클로버 · p29 火=계단 · p37 金=풍선)
 *   — 같은 배너 문구인데 오행마다 **그림이 다르다**. 즉 그림은 슬라이드가 아니라 **테마**를 따른다.
 * ⚠️金 은 전용 그림이 없다 — 시안도 金 페이지에서 **水의 풍선을 회색으로 눌러** 썼다.
 *   여기서는 차분한 것들을 빌려 쓴다. 전용 그림이 오면 갈아 끼운다.
 */
export const BANNER_POOL: Record<ThemeElement, readonly BannerArt[]> = {
  水: ['balloon', 'couple', 'moonlake'],
  土: ['door', 'sunrise'],
  木: ['clover', 'tree'],
  火: ['stairs', 'butterfly'],
  金: ['candle', 'balloon', 'couple', 'moonlake'],
};

/**
 * 배너 한 장이 쓸 그림과 그 바탕색 — 슬라이드 번호로 풀을 돌린다.
 * @param slide 캐러셀 몇 번째 장인가(0부터)
 * @param el    오행. 생략하면 지금 테마 오행
 * ★풀보다 슬라이드가 많으면 다시 처음으로 돈다(土·木·火 는 2장뿐이라 번갈아 나온다).
 */
export const bannerArtFor = (slide: number, el: ThemeElement = activeElement) => {
  const pool = BANNER_POOL[el];
  const name = pool[slide % pool.length];
  return { image: bannerArt(name), field: BANNER_FIELD[name] };
};
