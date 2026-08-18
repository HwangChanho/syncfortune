// src/components/ContentGrid.tsx — 콘텐츠 카드 그리드(카드뷰/리스트뷰) + 진입 게이트
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-18 IA 개편: 홈(index.tsx)에 있던 카드 그리드를 통째로 분리해 **하단탭 '풀이'**(/contents)로 옮겼다.
//   홈에는 히어로·오늘 기운·명식 선택만 남고, "풀이 넘어가는 리스트"는 전부 이 컴포넌트가 그린다.
//
// 이 컴포넌트가 소유하는 것(홈에서 그대로 옮겨온 로직 — 신규 발명 아님):
//   ① 카드/리스트 뷰 토글(저장·useHomeViewMode)          ② 카드 이미지 순차 공개(revealCount — 디코드 분산)
//   ③ 카드 설명 = 대표 명식 티저('내 얘기') 우선          ④ 유료 배지(무제한/풀이있음·만료일/쿠폰/가격)
//   ⑤ 진입 게이트(로그인 필요·무료 온디바이스 보상형 광고·연타 차단)
//
// ★목록 데이터는 lib/content/contentSections.ts 단일 출처 — 카드 추가는 그 파일만 고친다.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image'; // 이미지 자동 다운샘플(표시 크기로 디코딩) — 카드 35장 메모리·랙 해결
import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert } from '../lib/ui/alert';
import { useAuth } from '../lib/useAuth';
import { useFeatureOn } from '../lib/core/features'; // 신규 기능 노출 게이트(속궁합 등 — 원격 플래그+관리자, 재제출 안전판)
import { supabase } from '../lib/supabase';
import { excludeMock } from '../lib/core/testMode'; // ★풀이 배지(기존 풀이 유무)서 목업 제외(OFF) — 목업을 '풀이함'으로 오인 방지
import { withTimeout } from '../lib/core/withTimeout';   // ★대기 상한(멈춤 방지)
import { showRewardedAd, adTestMode } from '../lib/core/ads'; // 무료 온디바이스 콘텐츠 진입 보상형 광고
import { isAdminActing } from '../lib/core/admin';                  // 관리자·프리미엄 = 무료 진입 광고 제외
import { useAdFree } from '../lib/billing/adFree'; // ★광고 제거(운 구매) — 폐지된 isPremium 을 대신하는 **살아 있는** 개념
import { loadRepChart, subscribeRepChange } from '../lib/engine/myChart';
import { isPremiumForChart } from '../lib/billing/premiumStore';  // 명식별 프리미엄('이용중' 표시)
import { needsYearRepurchase } from '../lib/billing/repurchase';  // 지난 해 연도 풀이 → '재구매' 배지(daniel 07-08)
import { loadCredits } from '../lib/billing/coupons';             // 쿠폰 잔량
import { computeChart } from '../lib/engine/engine'; // canonical 빌더 단일화(daniel 07-23·drift 방지)
import { appLang } from '../lib/i18n';
import { homeTeaser, type HomeTeaser } from '../lib/content/homeTeaser'; // 카드 설명을 '내 얘기' 한 줄로(결정론·API 0, daniel 07-16)
import { SECTIONS, HOME_INDIVIDUAL, priceLabel, baseKey, type MenuItem } from '../lib/content/contentSections';
import { SAJU_READING_CATEGORIES } from '../lib/backend/prewarmReadings'; // 세트(사주16) 카테고리 단일출처
import { isNewContent } from '../lib/content/newBadge'; // 신규 콘텐츠 NEW 배지(출시일+21일 자동 만료·우측 상단 연한 빨강)
import type { HomeViewMode } from '../lib/ui/homeView'; // 보기 방식(카드/리스트) — 상태는 화면이 소유(아래 주석)
import { playSound } from '../lib/ui/sounds';
import { PressableScale } from './PressableScale';
import { loadFavorites, toggleFavorite, subscribeFavorites } from '../lib/content/favorites';   // ★찜하기(시안 「찜한 콘텐츠」)
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useWebCols } from './WebShell'; // 넓은 웹 = 카드 3열(폰/모바일웹은 그대로 2열)

// ★2026-08-19 `KenBurnsCard` 삭제 — 사진 카드를 걷어내면서 쓸 곳이 사라졌다(느린 줌은 사진 전용 효과).
//   아이콘은 투명 PNG 라 줌을 걸면 잘리기만 한다. 사진 카드가 돌아오면 git 이력에서 되살릴 것.

// ★풀이 3대 카테고리 시스템 매핑(daniel 2026-07-24) — 자미두수=ziwei(자미 원국풀이)·타로=taro, 그 외 전부 사주.

/**
 * 콘텐츠 카드 그리드. 화면(/contents)이 이걸 그대로 얹기만 하면 된다.
 * @param showViewToggle 카드/리스트 토글 노출 여부(기본 true)
 * ★2026-07-26(daniel "상단에 사주 타로 자미두수도 별로야 빼던가 다르게하자"): **카테고리 필터 제거**.
 *   실측 근거 = `ZIWEI_KEYS`·`TARO_KEYS` 가 각각 **항목 1개**('ziwei'·'taro')뿐이었다. 큰 세그먼트 버튼 3개가
 *   상단을 차지하는데 그중 둘은 눌러도 카드 1장만 나오는 구조 → 공간 낭비이자 '체계로 고르라'는 요구가
 *   사용자 사고(“궁합 보고 싶다”)와도 어긋났다. 이제 전 항목을 한 목록으로 보이고 섹션으로만 구분한다
 *   (자미두수·타로도 목록에 자연히 포함 — 예전엔 사주 탭에서 아예 빠져 있었다).
 */
/** 리스트뷰에서 섹션당 기본 노출 개수 — 나머지는 '더 보기'로 접는다(daniel 2026-07-26 나열 개선).
 *  4 = 스크린 한 화면에 섹션 헤더+4행이 들어가 '섹션이 여러 개 있다'는 구조가 보이는 최소치. */

/** 카드뷰에서 가로 스크롤을 2줄로 접는 기준 개수(daniel 2026-08-06).
 *  ★예전엔 섹션 **키를 하드코딩**해 'light 는 5개씩 N줄, deep 은 2줄'로 갈랐다. 그래서 25개짜리
 *    '가볍게 보기'가 **가로 5줄**이 되어 대부분이 화면 밖에 숨었고, 섹션을 새로 만들 때마다
 *    이 분기를 같이 고쳐야 했다(고치지 않으면 조용히 1줄로 떨어진다).
 *  → 이제 **개수로만** 판단한다: 6개 이하면 1줄, 넘으면 2줄. 최대 2줄이라 세로 길이가 예측 가능하다. */
const ROW_FOLD = 6;

/** 보상형 광고 대기 상한(ms) — 광고는 부가 기능이라 오래 붙잡지 않는다. */
const AD_TIMEOUT_MS = 15_000;

/**
 * @param query 검색어. 비어 있지 않으면 섹션 대신 **한 목록**으로 결과만 그린다.
 * @param viewMode 카드/리스트 보기 방식.
 *
 * ★검색어·보기방식을 **화면(contents.tsx)이 소유**하는 이유:
 *   ① 검색창·토글을 스크롤 밖 최상단 한 줄에 고정해야 한다 — 스크롤을 내린 뒤에도 쓸 수 있고
 *      키보드에 가리지 않는다(check:keyboard R1). 그 줄은 화면 소유다.
 *   ② `useHomeViewMode()` 를 화면과 이 컴포넌트가 **각자 부르면 state 가 둘**이 되어,
 *      화면에서 토글해도 그리드는 모른다(같은 값을 여러 곳이 각자 읽어 갈린 사고 이력 있음).
 *      → 훅은 화면에서 한 번만 부르고 여기로는 값만 내려온다.
 */
/**
 * @param query      검색어(있으면 카테고리 필터 대신 전 영역 검색)
 * @param viewMode   'card' | 'list' — 화면이 소유한 값(여기서 훅을 다시 부르지 않는다)
 * @param category   섹션 키. 주면 그 섹션만 그린다.
 * @param wrap       카드뷰를 **가로 스크롤 대신 세로 랩 그리드**로. 카테고리 전용 화면처럼
 *                   섹션 하나가 곧 화면 전체일 때 쓴다. 기본 false(풀이탭 개요는 종전 캐러셀).
 * @param header     섹션 제목·설명 표시 여부. 화면이 이미 같은 문구를 그리면 false 로 끈다.
 */
/**
 * 카드 우측 하단 하트.
 *
 * ★카드뷰·리스트뷰가 **같은 것**을 쓴다 — 하트가 두 벌이면 상태가 갈린다([[duplicate-ui-single-source]]).
 * ⚠️카드 전체가 눌리는 영역이라 하트는 이벤트를 **먹어야** 한다(안 그러면 찜하려다 콘텐츠로 들어간다).
 *
 * @param k    콘텐츠 카드 키
 * @param on   지금 찜한 상태
 * @param dark   어두운 이미지 위에 얹히는가(흰 하트로 그린다)
 * @param inline 리스트 행처럼 **흐름 안**에 놓는가(카드는 절대배치)
 */
function FavHeart({ k, on, dark, inline }: { k: string; on: boolean; dark?: boolean; inline?: boolean }) {
  return (
    <PressableScale
      style={inline ? styles.favInline : styles.favBtn}
      hitSlop={8}
      onPress={(e?: any) => { e?.stopPropagation?.(); void toggleFavorite(k); }}
    >
      <Text style={[styles.favTx, dark && styles.favTxDark, on && styles.favTxOn]}>{on ? '♥' : '♡'}</Text>
    </PressableScale>
  );
}

export function ContentGrid({ query = '', viewMode, category = null, wrap = false, header = true }:
  { query?: string; viewMode: HomeViewMode; category?: string | null; wrap?: boolean; header?: boolean }) {
  // ★랩 그리드의 카드 폭 — 폰은 2열, 넓은 웹은 3열(가로를 실제로 쓰게).
  //   숫자를 화면에 박지 않고 `useWebCols` 한 곳에서 받는다(정책이 갈리지 않게).
  const cols = useWebCols();
  // ★찜 상태는 여기서 한 번 구독하고 카드에는 **값만** 내린다(카드마다 훅을 걸면 수십 개가 된다).
  const [favs, setFavs] = useState<Set<string>>(new Set());
  useEffect(() => {
    void loadFavorites().then(setFavs);
    return subscribeFavorites(setFavs);
  }, []);
  // ★시안 p05 는 **3열**이다(카드 178pt · 폰 환산 116pt · 3×116 + 간격 = 370 = 402 − 좌우 16).
  //   종전엔 폰에서 2열이었다. 3열이 되면 카드가 좁아져 설명이 안 들어가는데,
  //   **시안 카드에는 애초에 설명이 없다** — 제목과 그림뿐이다(아래 카드 렌더 참조).
  //   ⚠️퍼센트는 **간격을 뺀 뒤** 나눠야 한다 — 31.7%×3 + 간격 12pt×2 는 100%를 넘어
  //     3열로 짰는데 **2개만 들어가고 오른쪽이 텅 비었다**(시뮬 실측).
  //     폭 362pt(402 − 좌우 20) · 간격 12pt×2 = 6.6% → (100−6.6)/3 = **31.1%**.
  const cardW: `${number}%` = cols >= 3 ? '31.1%' : cols === 2 ? '48%' : '31.1%';
  /**
   * ★넓은 웹에서는 **가로 캐러셀 대신 랩 그리드**를 쓴다.
   *   아래 주석(카테고리 화면)과 같은 이유다 — 가로로 미는 건 손가락이 있을 때 얘기고,
   *   데스크톱엔 스와이프가 없어서 오른쪽에 잘린 카드는 사실상 없는 카드가 된다.
   */
  const wrapEff = wrap || cols > 1;
  /**
   * ★29CM 톤(Boss 2026-08-15 선택) — **이미지가 곧 카드**.
   * 폰에서는 카드가 서로 붙어 있어 테두리·그림자가 경계 노릇을 했지만, 데스크톱은 여백이 넉넉해
   * **이미지 자체가 이미 경계**다. 걷어내면 카드아트 278장이 화면의 주인이 된다.
   */
  const webCard = cols > 1 ? { borderWidth: 0, shadowOpacity: 0, elevation: 0 } : null;
  /**
   * 카드 비율 — 원본 카드아트는 832×1216(세로 0.72)이라 3열에서 카드 하나가 500px 가까이 길어진다.
   * 자산을 다시 만들지 않고 **보이는 창만** 가로로 잡는다(`contentFit="cover"` 가 가운데를 남긴다).
   */
  //   ⚠️`{aspectRatio: undefined}` 를 스타일 배열에 넣으면 **앞의 값을 지운다**(RN 병합은 undefined 도 대입).
  //     `styles.card` 가 `aspectRatio: 0.72` 를 갖고 있어, 네이티브(cols===1)에서 그 비율이 통째로 날아간다
  //     → 카테고리 화면 카드가 높이를 잃는다. 그래서 **값이 있을 때만** 키를 만든다.
  const cardOverride: { width: `${number}%`; aspectRatio?: number } =
    cols > 1 ? { width: cardW, aspectRatio: 1.05 } : { width: cardW };   // 폰(cols=1)은 위 cardW 가 31.7% = 3열
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const adFree = useAdFree();   // ★광고 게이트 판정(아래 주석)
  const [admin, setAdmin] = useState(false);
  // ★신규 기능 노출 게이트 — 속궁합은 관리자(daniel) 또는 원격 플래그 ON 일 때만 노출(재제출 안전판).
  const sokOn = useFeatureOn('sokgunghap');
  // ★풀이 3대 카테고리(daniel 2026-07-24): category(사주/자미두수/타로)로 항목 필터 + 빈 섹션 제거. 세그먼트는 화면(contents.tsx).
  const sections = useMemo(
    () => SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter((m) => {
        if (m.key === 'sokgunghap' && !sokOn) return false;          // 속궁합 노출 게이트 유지
        if (m.hiddenInList) return false;                             // 목록에서만 숨김(예: 이달의 운세 — 상단에 펼쳐져 있다)
        return true;
      }),
    })).filter((sec) => sec.items.length > 0)
      // ★카테고리 선택(daniel 2026-08-06) — 상단 칩에서 고른 주제 하나만 남긴다.
      //   '전체'(category=null)면 종전대로 전 섹션. 검색 중에는 이 필터를 타지 않는다(검색은 전 영역 대상).
      .filter((sec) => !category || sec.key === category),
    [sokOn, category],
  );
  const [repServerChartId, setRepServerChartId] = useState<string | null>(null); // 현재 대표 명식(프리미엄·배지 판정)
  const [credits, setCredits] = useState<Record<string, number>>({});                            // creditKey별 쿠폰 잔량
  const [readingRows, setReadingRows] = useState<{ category: string; created_at: string }[]>([]); // 이 명식의 기존 풀이
  const [teasers, setTeasers] = useState<Record<string, HomeTeaser>>({});                         // 카드별 '내 얘기' 한 줄
  const [reloadKey, setReloadKey] = useState(0); // 명식 변경(전환·수정) 감지 — 포커스마다 재계산

  // session 반응형 — 로그아웃 즉시 관리자 상태 해제.
  useEffect(() => { if (!session) { setAdmin(false); return; } isAdminActing().then(setAdmin).catch(() => {}); }, [session]);
  // 탭 포커스 복귀 시 재계산(명식 전환·수정 반영 — 명식 수정은 id가 같아 이것 없이는 갱신이 안 된다).
  useFocusEffect(useCallback(() => { setReloadKey((k) => k + 1); }, []));
  // 명식 전역 변경(전환·수정·로그아웃 클리어) 구독.
  useEffect(() => subscribeRepChange(() => setReloadKey((k) => k + 1)), []);

  // 대표 명식 → 티저(결정론·동기·API 0) + 프리미엄 판정 대상 id.
  useEffect(() => {
    let alive = true;
    (async () => {
      const rep = await loadRepChart();
      if (!alive) return;
      setRepServerChartId(rep?.serverChartId ?? null);
      if (!rep) { setTeasers({}); return; } // 명식 없음 → 카드는 기존 정적 설명
      const saju = computeChart(rep.input).saju;
      // homeTeaser 는 throw 하지 않고 미지원 카드·산출 실패를 null 로 주므로 개별 try/catch 불필요.
      const tUnknown = (rep.input as any)?.timeAccuracy === '미상'; // 시주 미상 힌트(시에 기대는 산출의 정확도)
      const tz: Record<string, HomeTeaser> = {};
      // ★baseKey — '인기' 사본(hot*)도 원본 티저를 쓴다. 안 그러면 같은 카드가 인기 칸에서만 정적 설명이 뜬다.
      for (const sec of SECTIONS) for (const m of sec.items) { const x = homeTeaser(baseKey(m.key), saju, tUnknown); if (x) tz[m.key] = x; }
      if (alive) setTeasers(tz);
    })().catch(() => {});
    return () => { alive = false; };
  }, [reloadKey]);

  // 유료 카드 배지 데이터 — 대표 명식의 쿠폰 잔량 + 기존 풀이(카테고리+생성일).
  useEffect(() => {
    if (!session || !repServerChartId) { setCredits({}); setReadingRows([]); return; }
    let alive = true;
    (async () => {
      const cr = await loadCredits().catch((): Record<string, number> => ({}));
      const { data } = await excludeMock(supabase
        .from('readings').select('category, created_at')
        .eq('chart_id', repServerChartId).eq('lang', appLang()));
      if (!alive) return;
      setCredits(cr);
      setReadingRows((data ?? []) as { category: string; created_at: string }[]);
    })().catch(() => {});
    return () => { alive = false; };
  }, [repServerChartId, reloadKey, session]);

  // 카드 이미지 순차 공개(daniel) — 위→아래로 한 장씩 mount.
  //   ★타이머(시간 기반)를 택한 이유: 가장 단순·안정적. expo-image onLoad 체인은 이미지 하나라도
  //     로드 실패/지연하면 거기서 멈춰(stall) 아래 카드가 영영 안 뜨는 위험이 있다. 타이머는 절대 멈추지 않는다.
  // ★공개 순번은 **실제로 렌더되는 `sections`** 에서 뽑는다(2026-08-09 수정).
  //   종전엔 `CARD_REVEAL_OFFSETS`/`TOTAL_CARDS`(= 필터 **전** SECTIONS 기준 상수)를 쓰면서
  //   `secIdx` 는 필터 **후** 배열의 인덱스였다 — 두 축이 다른 배열을 가리켰다.
  //   지금은 우연히 상한에 안 걸려 증상이 없지만, 항목이 늘거나 게이트가 하나 더 닫히면
  //   마지막 카드가 영영 mount 되지 않는 형태로 터진다(카드가 '없는 것'처럼 보인다).
  const { revealOffsets, totalCards } = useMemo(() => {
    const offs: number[] = []; let acc = 0;
    for (const sec of sections) { offs.push(acc); acc += sec.items.length; }
    return { revealOffsets: offs, totalCards: acc };
  }, [sections]);
  const [revealCount, setRevealCount] = useState(1);
  useEffect(() => {
    if (revealCount >= totalCards) return;                                       // 모두 공개 → 타이머 정지
    const id = setTimeout(() => setRevealCount((c) => c + 1), 90);               // 한 장씩 위→아래(디코드 분산)
    return () => clearTimeout(id);
  }, [revealCount]);

  // ★카드 연타·중복 진입 차단(daniel) — 네비가 진행 중이면 다음 탭을 즉시 무시.
  //   동기 ref라 state 리렌더 전에도 막힌다. 광고 시청 구간에도 잠금 유지 → 광고 중 다른 카드 탭이 먹지 않음.
  const navigatingRef = useRef(false);
  async function onPress(m: MenuItem) {
    if (navigatingRef.current) return;                 // 이미 진입 처리 중 — 연타 무시
    playSound('click');
    if (!m.ready) { Alert.alert(t(m.labelKey), t('common.comingSoon')); return; }
    // daniel #8(2026-06-24): 무료 콘텐츠는 로그인 없이(광고 보면 OK·온디바이스라 서버 불필요).
    //   로그인은 *유료/구매(계정 귀속)* 콘텐츠에만 필요.
    if ((m.premium || m.creditKey) && !session) {
      Alert.alert(t('login.needTitle', '로그인이 필요해요'), t('login.needContentMsg', '이 콘텐츠를 보려면 로그인해 주세요. 로그인하면 구매·풀이가 계정에 안전하게 저장돼요.'), [
        { text: t('login.go', '로그인'), onPress: () => router.push('/login') },
        { text: t('common.cancel', '취소'), style: 'cancel' },
      ]);
      return;
    }
    navigatingRef.current = true;                      // 진입 경로 잠금(연타 이중 push 차단)
    // ★무료 온디바이스 콘텐츠 진입 = 보상형 광고 1회(daniel 07-02).
    //   오늘·이달의 운세는 content 플래그가 없어 자동 제외(그 화면 내부에 '광고 보고 보기' 별도).
    //   프리미엄=광고 없음. 관리자=평소 제외하되 테스트광고 모드면 게이트 동작. 카드 탭=유저 개시(보상형 정책 OK).
    // ★상한(2026-07-31 '멈춤' 전수조사): `.catch()` 는 **거부**만 잡는다 — 광고 SDK 가 응답 없이 매달리면
    //   이 await 가 안 끝나고 아래 해제가 실행되지 않아 **카드 탭이 영구히 죽는다**(잠금이 남는다).
    //   광고는 부가 기능이므로 상한을 넘기면 그냥 진입시킨다(사용자를 막지 않는다).
    // ★`!isPremium` → `!adFree`(daniel 2026-08-02): 프리미엄은 07-28 폐지로 **항상 false** 라
    //   `!isPremium` 은 늘 참 = 광고 제거를 산 사용자도 이 광고 게이트로 들어왔다(죽은 게이트).
    if (m.content && !m.creditKey && !adFree && (!admin || adTestMode())) {
      await withTimeout(showRewardedAd().catch(() => false), AD_TIMEOUT_MS);
    }
    router.navigate(m.route);
    setTimeout(() => { navigatingRef.current = false; }, 900); // 광고+진입 커버 후 해제
  }

  // 카드 설명 한 줄 — ★대표 명식 티저('내 얘기')가 있으면 그것, 없으면 기존 정적 설명(menu.*Desc).
  //   카드뷰·텍스트카드·리스트뷰 3곳의 단일 출처.
  function descOf(m: MenuItem): string | null {
    const tz = teasers[m.key];
    if (tz) return t(tz.key, tz.vars) as string; // 문구 소유=i18n(ko/en/ja) · 계산 소유=homeTeaser(결정론)
    return m.descKey ? t(m.descKey) : null;
  }

  // 세트형 creditKey → 그 세트가 저장하는 category 목록.
  //   자미 12궁은 iztro 성반에서 오는 고정 이름이라 목록으로 둔다(사주는 단일출처 import).
  const SET_CATEGORIES: Record<string, string[] | undefined> = {
    reading: SAJU_READING_CATEGORIES as unknown as string[],
    ziwei: ['명궁', '형제궁', '부처궁', '자녀궁', '재백궁', '질액궁', '천이궁', '노복궁', '관록궁', '전택궁', '복덕궁', '부모궁'],
  };

  // ★유료 카드 배지(daniel 07-08) — 가격 대신 '명식별 상태'. 우선순위대로 첫 매칭 반환:
  //   ① 프리미엄(대표 명식) = '무제한' — 단 개별전용 3종(dream/followup/timeresolve)은 커버 밖이라 제외.
  //   ② 이 명식에 풀이가 이미 있음 = '풀이있음 · {만료일}'(생성일+1년) / 지난 해 연도 풀이만 있으면 '재구매'.
  //   ③ 쿠폰 잔량 > 0 = '쿠폰 {n}장'.   ④ 그 외 = 개별 가격. creditKey 없으면 null(배지 없이 › 셰브런).
  function badgeFor(m: MenuItem): string | null {
    const ck = m.creditKey;
    if (!ck) return null;                                                                  // 무료 콘텐츠 = 배지 없음
    if (isPremiumForChart(repServerChartId) && !HOME_INDIVIDUAL.has(ck)) return '무제한';   // ①
    const nowD = new Date();
    // ★세트형(사주16영역·자미12궁)은 category 체계가 creditKey 와 **다르다**(daniel 2026-07-29
    //   "풀이탭에서 보유중이나 이런건 알수가 없는데"). 사주 카드의 creditKey 는 'reading' 인데
    //   저장된 category 는 '금전소득운'·'연애운'… 이라 `r.category === ck` 가 **구조적으로 0건**이었다.
    //   → 세트는 자기 영역 목록으로 매칭한다. 개별 콘텐츠(love·career…)는 종전대로 키가 곧 category 다.
    const setCats = SET_CATEGORIES[ck];
    const matched = setCats
      ? readingRows.filter((r) => setCats.includes(r.category))
      : readingRows.filter((r) => r.category === ck || r.category.startsWith(ck + '_'));
    const cur = matched.find((r) => !needsYearRepurchase(r.category, nowD)); // 현재연도 or 연도무관 풀이
    if (cur?.created_at) {
      const d = new Date(cur.created_at);
      d.setFullYear(d.getFullYear() + 1);
      const exp = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
      return `풀이있음 · ${exp}`;
    }
    if (matched.length > 0) return '재구매'; // 지난 해 연도 풀이만 남음 → 올해 것으로 재구매 유도
    if ((credits[ck] ?? 0) > 0) return `쿠폰 ${credits[ck]}장`;                              // ③
    return priceLabel(ck);                                                                 // ④
  }

  /**
   * 리스트 행 1줄 — 작은 썸네일(좌) + 제목·설명 + 가격 배지/셰브런(우).
   * ★리스트뷰와 **검색 결과가 이 함수 하나를 같이 쓴다**. 같은 UI 를 두 곳이 각자 그리면
   *   언젠가 색·배지가 갈린다(에겐테토 막대 사고 2026-08-04). 갈릴 값은 인자로도 열지 않는다.
   */
  function renderListRow(m: MenuItem) {
    const prem = !!m.premium;
    const priceTxt = badgeFor(m);
    const desc = descOf(m);
    const isNew = isNewContent(m.key); // 신규 콘텐츠 = 라벨 옆 NEW(카드뷰와 동일 기준 — 리스트뷰 누락 수정·daniel 07-23)
    return (
      <PressableScale key={m.key} style={styles.listRow} onPress={() => onPress(m)}>
        {/* ★썸네일 = 항목 아이콘, 없으면 **라벨 첫 글자**.
            ⚠️2026-08-19 에 여기를 '섹션 아이콘 폴백'으로 바꿨다가 **되돌렸다** —
              리스트는 한 화면에 여러 줄이 뜨는데 연애 섹션 6줄 중 5줄이 **같은 하트**가 됐다(시뮬 실측).
              도우미(`DeepDiveCta`)는 한 번에 한 장이라 섹션 아이콘이 맞지만, 여기선 정반대다.
              ★같은 폴백이라도 **몇 개가 동시에 보이느냐**에 따라 답이 갈린다. */}
        {m.image ? (
          <ExpoImage source={m.image} style={styles.listThumb} contentFit="contain" cachePolicy="memory-disk" transition={120} />
        ) : (
          <View style={[styles.listThumb, styles.listThumbPlaceholder]}>
            <Text style={styles.listThumbGlyph}>{t(m.labelKey).slice(0, 1)}</Text>
          </View>
        )}
        <View style={styles.listTextCol}>
          <View style={styles.listLabelRow}>
            <Text style={[styles.listLabel, prem && styles.listLabelPrem]} numberOfLines={1}>{t(m.labelKey)}</Text>
            {isNew && <View style={styles.listNewTag}><Text style={styles.newTagTx}>NEW</Text></View>}
          </View>
          {/* 설명 1줄(daniel 07-26 나열 개선) — 리스트는 스캔이 목적이라 2줄이면 행이 두꺼워진다 */}
          {desc ? <Text style={styles.listDesc} numberOfLines={1}>{desc}</Text> : null}
        </View>
        {priceTxt ? (
          <View style={styles.listPriceTag}><Text style={styles.listPriceTx}>{priceTxt}</Text></View>
        ) : (
          <Text style={styles.listChevron}>›</Text>
        )}
        {/* ★리스트 행에도 같은 하트 — 카드뷰에만 달면 리스트로 보는 사용자는 찜을 못 한다(실물에서 확인) */}
        <FavHeart k={m.key} on={favs.has(m.key)} inline />
      </PressableScale>
    );
  }

  // ── 검색(온디바이스·API 0, daniel 2026-08-06) ────────────────────────────
  // 51종을 스크롤로만 찾게 두면 '나열'이 된다. 라벨·설명 부분일치로 즉시 좁힌다.
  //   ★결과는 섹션을 **가로질러 한 목록**으로 낸다 — 검색했는데 또 카테고리로 나누면
  //     '빨리 찾기'라는 목적을 배반한다.
  //   ★같은 라우트 중복(인기 섹션의 hot* 사본)은 하나로 접는다 — 같은 카드가 두 번 뜨면 혼란.
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [] as MenuItem[];
    const seen = new Set<string>();
    const out: MenuItem[] = [];
    for (const sec of sections) {
      // ★섹션 제목·설명도 검색 대상(daniel 08-06 점검에서 발견).
      //   실측: **"돈"으로 검색하면 0건**이었다 — 섹션명은 '돈·일·진로'인데 그 안의 항목
      //   라벨·설명('재물 딥리포트', '타고난 재물 그릇…')에는 '돈'이라는 낱말이 하나도 없다.
      //   사용자는 섹션에 적힌 말로 검색하는데 그 말이 검색되지 않으면 검색이 무용지물이 된다.
      //   → 섹션명이 맞으면 그 섹션 항목을 전부 결과에 넣는다(주제로 훑어보는 것도 검색의 목적).
      const secHay = `${t(sec.titleKey)} ${sec.descKey ? t(sec.descKey) : ''}`.toLowerCase();
      const secHit = secHay.includes(q);
      for (const m of sec.items) {
        if (seen.has(m.route)) continue;
        // 항목 검색 대상 = 정적 라벨·설명. 티저('내 얘기')는 명식마다 달라져 검색 결과가 흔들린다.
        const hay = `${t(m.labelKey)} ${m.descKey ? t(m.descKey) : ''}`.toLowerCase();
        if (!secHit && !hay.includes(q)) continue;
        seen.add(m.route);
        out.push(m);
      }
    }
    return out;
  }, [q, sections, t]);

  // 검색 중 = 섹션·카드뷰·토글을 모두 접고 결과만. (검색어를 지우면 원래 화면으로 돌아온다.)
  if (q) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionH}>{t('contents.searchResult', { n: results.length, defaultValue: '검색 결과 {{n}}개' })}</Text>
        <View style={styles.listBody}>
          {results.length === 0
            ? <Text style={styles.searchEmpty}>{t('contents.searchEmpty', '찾는 내용이 없어요.\n다른 낱말로 찾아보세요.')}</Text>
            : results.map(renderListRow)}
        </View>
      </View>
    );
  }

  return (
    <>
      {/* 주제 섹션 — 큰 헤더 + 좌우 가로 스크롤 카드. (보기 토글은 화면 상단 검색줄로 이동·daniel 08-06) */}
      {sections.map((sec, secIdx) => {
        // 카드뷰 줄 수 = 개수로만 결정(위 ROW_FOLD 주석 참조 — 섹션 키 하드코딩 제거).
        const twoRows = sec.items.length > ROW_FOLD;
        // ★NEW 배지 콘텐츠를 섹션 앞으로(daniel 07-23 "new 붙어있는걸 제일 앞으로"·카드/리스트 공통). JS sort 안정 → 그 외 순서 유지.
        // ★정렬 = ①보유 이용권 ②NEW ③원래 순서.
        //   ①(daniel 2026-07-26 "유저별로 이용권이 있으면 풀이 목록에서 상단에 올라오게") — 이미 산 이용권을
        //   못 찾아 헤매지 않게 맨 위로. ②는 07-23 daniel 요청("new 붙어있는걸 제일 앞으로"). JS sort 는 안정 소트라
        //   같은 등급 안에서는 선언 순서가 유지된다.
        const hasCredit = (m: MenuItem) => (m.creditKey && (credits[m.creditKey] ?? 0) > 0 ? 1 : 0);
        // ★무료 우선(daniel 2026-08-06 퍼널): "앞에는 싹 다 무료, 궁금할 때쯤 유료 상세로".
        //   결제 벽을 앞에 세우면 무료 사용자가 그 섹션을 통째로 건너뛴다 — 가벼운 무료 풀이로 먼저
        //   '내 얘기'를 보여주고, 더 알고 싶어질 때 유료가 바로 옆에 있게 배치한다.
        //   ※'이미 산 것'(hasCredit)은 여전히 맨 앞이다(daniel 07-26) — 산 걸 못 찾는 게 더 나쁘다.
        const isFree = (m: MenuItem) => (m.creditKey ? 0 : 1);
        const items = [...sec.items].sort((a, b) =>
          (hasCredit(b) - hasCredit(a))
          || (isFree(b) - isFree(a))
          || ((isNewContent(b.key) ? 1 : 0) - (isNewContent(a.key) ? 1 : 0)));
        // 섹션 헤더 — 카드뷰·리스트뷰가 동일하게 재사용(중복 제거·정합).
        //   ★'인기'만 연한 골드 밴드로 강조하던 것을 제거하고 **전 섹션 같은 헤더**로 통일(daniel 08-06).
        //     주제 축에서는 섹션이 대등한 선택지라, 하나만 박스로 감싸면 그게 섹션인지 버튼인지 모호해지고
        //     위계가 섞여 보였다. 인기는 **맨 위에 있다는 위치**로 이미 충분히 강조된다.
        //     (이로써 sec.key 하드코딩 분기가 이 컴포넌트에서 전부 사라졌다.)
        //   ★`header=false` 면 통째로 생략 — 카테고리 전용 화면이 이미 같은 제목·설명을 그린다
        //     (실물에서 설명이 두 번 찍혔다. 08-04 [[duplicate-ui-single-source]] 와 같은 계열의 중복.)
        const sectionHeader = !header ? null : (
          <>
            {/* ★섹션 제목 — 데스크톱에서 22px 는 작다. 제목이 지면을 잡아야 그리드가 정돈돼 보인다. */}
            <Text style={[styles.sectionH, cols > 1 && { fontSize: 30, lineHeight: 40, marginBottom: space(2) }]}>{t(sec.titleKey)}</Text>
            {/* 섹션 설명은 **있으면 항상** 표시(daniel 08-06). 예전엔 'free' 섹션만 예외로 숨겼는데,
                주제 축에서는 설명이 곧 "이 칸에 뭐가 들었나"를 알려주는 안내라 숨길 이유가 없다. */}
            {sec.descKey ? <Text style={styles.sectionDesc}>{t(sec.descKey)}</Text> : null}
          </>
        );

        // ── 리스트뷰(daniel: "리스트로 좀 더 보기 편한 뷰") ─────────────────────────
        //   카드뷰의 순차 공개·켄번스 줌 없이 세로 '행': 작은 썸네일(좌) + 제목·설명 + 가격 배지/셰브런(우).
        //   썸네일이 작아(≈54px) expo-image 다운샘플로 전량 즉시 로드해도 가볍다.
        //   가격/프리미엄 판정·진입(onPress)은 카드뷰와 완전히 동일한 헬퍼를 재사용(단일 출처).
        if (viewMode === 'list') {
          // ★2026-08-09 **접기 폐지**(daniel "컨텐츠 몇개가 사라졌는데" · "mbti 이런것도 없는데").
          //   07-26 에 접기를 넣은 이유는 '가볍게 보기' 25개까지 합쳐 **56행**이 한 줄씩 쌓여
          //   스캔이 불가능했기 때문이다. 그 조건이 사라졌다 — 지금은 51개가 6섹션으로 갈렸고
          //   상단 **카테고리 칩**으로 원하는 섹션에 바로 갈 수 있다.
          //   그 사이 08-07 에 **기본 보기가 카드→리스트로** 바뀌면서, 카드뷰(가로 스크롤로 전량 노출)가
          //   가려 주던 이 접힘이 **기본 화면에 그대로 드러났다** — 51개 중 22개만 보이는 상태가 됐다.
          //   ★더 나쁜 건 *어떤* 4개가 보일지가 고정이 아니라는 점이다: 정렬이
          //   `쿠폰보유 → 무료 → 신규` 라 NEW 배지가 만료되거나 쿠폰이 생기면 순서가 바뀌어
          //   **어제 보이던 항목이 오늘 사라진다**(mbti 가 gem 의 NEW 때문에 5위로 밀려 사라진 게 이 경우).
          //   ⇒ 개요에서도 전량 표시한다. 08-06 "숨기는 건 없어" 와 같은 결이다.
          const shown = items;
          return (
            <View key={sec.key} style={styles.section}>
              {sectionHeader}
              <View style={styles.listBody}>
                {shown.map(renderListRow)}
              </View>
            </View>
          );
        }

        // ── 카드뷰(기본) — 순차 공개 + 켄번스 가로 스크롤 ──────────────────────────
        const cards = items.map((m, itemIdx) => {
          const badge = badgeFor(m);
          const isNew = isNewContent(m.key); // 신규 콘텐츠 = 우측 상단 연한 빨강 NEW(출시일+21일)
          // 순차 공개 — 이 카드의 전역 순번이 공개분에 들어왔는지. 아직이면 빈 박스(디코드 미발생).
          const revealed = revealOffsets[secIdx] + itemIdx < revealCount;
          // ★2026-08-19 시안 카드로 통일 (daniel *"콘텐츠 이미지 카드들 안쓰니깐 다 제거하고 시안대로"*)
          //   시안 p05·p14 실측: **밝은 카드 · 제목이 위(강조색·굵게) · 아이콘은 가운데 아래**.
          //   종전엔 사진이 카드를 꽉 채우고 아래에 검은 그라데이션 + 흰 글자였다(미디어 카드).
          //   ⇒ 사진 46장을 걷어내고 한 모양으로 합쳤다. 카드 종류가 둘이면 같은 목록이 두 결로 보인다.
          //
          //   ⚠️아이콘은 **그 콘텐츠를 정확히 가리킬 때만** 붙인다(현재 18/55).
          //     Boss 가 준 아이콘은 10종인데 콘텐츠는 55개다. 주제별로 억지로 나눠 쓰면
          //     한 섹션에 같은 그림이 아홉 번 나와 **뜻이 사라지고 복사 실수처럼 보인다**
          //     (`check:cardart` 가 사진에서 그 문제를 잡아낸 적이 있다).
          //     아이콘이 없는 카드는 **제목이 주인공**이다 — 시안의 카드에서 장식만 뺀 모양이라 결이 같다.
          return (
            <PressableScale key={m.key} style={[styles.card, wrapEff && cardOverride, webCard]} onPress={() => onPress(m)}>
              {/* ★시안 카드에는 **설명이 없다** — 제목과 그림뿐이다(p05·p14 실측).
                  3열이라 카드 폭이 116pt 뿐이라 설명을 넣으면 두 글자씩 끊어져 오히려 안 읽힌다.
                  설명은 **리스트 뷰**가 맡는다(거기는 가로가 넉넉하다). */}
              <Text style={styles.cardLabel} numberOfLines={3}>{t(m.labelKey)}</Text>
              {/* 남는 세로를 여기서 먹어 그림이 **항상 아래쪽 같은 자리**에 온다 */}
              <View style={{ flex: 1 }} />
              {/* 그림 자리는 **있든 없든 남긴다** — 카드 높이가 들쭉날쭉하지 않게 */}
              <View style={styles.cardArt}>
                {m.image && revealed ? (
                  <ExpoImage source={m.image} style={styles.cardArtImg} contentFit="contain" cachePolicy="memory-disk" transition={140} />
                ) : null}
              </View>
              {/* ★배지·하트는 **흐름 안 한 줄**로 둔다(2026-08-19).
                  절대배치로 두었더니 그림 위에 겹쳤다(「30 운」이 사람 그림을 덮었다 · 시뮬 실측). */}
              <View style={styles.cardFoot}>
                {isNew ? <View style={styles.newTag}><Text style={styles.newTagTx}>NEW</Text></View>
                       : badge ? <View style={styles.priceTag}><Text style={styles.priceTagText}>{badge}</Text></View>
                       : <View />}
                <FavHeart k={m.key} on={favs.has(m.key)} inline />
              </View>
            </PressableScale>
          );
        });
        // ★랩 그리드 — 카테고리 전용 화면(섹션 1개 = 화면 전체)에서는 가로 캐러셀이 틀린 그림이다.
        //   실물에서 10개 중 2.5개만 보이고 나머지는 오른쪽으로 잘렸다. "타고 들어가면 하위 항목이 나오게"(daniel)
        //   라고 했는데 정작 들어가서도 옆으로 밀어야 보였다 — 개요(여러 섹션을 세로로 쌓으므로 가로 압축이 필요)와
        //   전용 화면(세로 지면이 통째로 남는다)은 요구가 반대다.
        if (wrapEff) {
          return (
            <View key={sec.key} style={styles.section}>
              {sectionHeader}
              <View style={styles.wrapGrid}>{cards}</View>
            </View>
          );
        }
        return (
          <View key={sec.key} style={styles.section}>
            {sectionHeader}
            {twoRows ? (
              // 2줄 — 컬럼 정렬(위/아래 번갈아)이라 **가로로 읽으면 선언 순서 그대로**다.
              //   (줄 단위로 나누면(앞 절반/뒤 절반) 윗줄을 다 본 뒤 아랫줄로 돌아와야 해 순서가 끊긴다.)
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
                <View style={styles.grid2col}>
                  <View style={styles.grid2row}>{cards.filter((_, i) => i % 2 === 0)}</View>
                  <View style={styles.grid2row}>{cards.filter((_, i) => i % 2 === 1)}</View>
                </View>
              </ScrollView>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>{cards}</ScrollView>
            )}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  // (보기 토글 스타일은 화면 상단 검색줄로 이동 — contents.tsx)
  // 범주 섹션 — 큰 헤더 + 좌우 가로 스크롤. marginHorizontal 음수 = 화면 wrap 패딩(space(5)) 상쇄(가로 스크롤이 화면 끝까지).
  section: { marginBottom: space(6), marginHorizontal: -space(5) },
  sectionH: { fontSize: 22, fontWeight: '800', color: colors.ju, marginBottom: space(1), letterSpacing: 0.3, paddingHorizontal: space(5) },
  // ('인기' 전용 골드 밴드 제거 — 전 섹션 같은 헤더로 통일, daniel 08-06)
  sectionDesc: { ...font.caption, color: colors.inkSoft, marginBottom: space(3), paddingHorizontal: space(5), lineHeight: 18 },
  hRow: { gap: space(3), paddingHorizontal: space(5), paddingVertical: space(1) }, // 카드 간격 + 좌우 여백
  // 랩 그리드(카테고리 전용 화면) — 2열로 접히며 세로로 이어진다. hRow 와 같은 좌우 여백을 써서
  //   개요 화면에서 들어왔을 때 카드 왼쪽 선이 그대로 이어지는 느낌을 준다.
  wrapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3), paddingHorizontal: space(5), paddingVertical: space(1) },
  // ★폭을 고정 168 → 비율로. 좁은 기기(375pt)에서 168×2+간격이 넘쳐 1열로 무너지던 걸 막는다.
  grid2col: { gap: space(3) },                       // 윗줄·아랫줄 세로 간격
  grid2row: { flexDirection: 'row', gap: space(3) }, // 한 줄 카드 가로 간격
  // 콘텐츠 텍스트 카드(이미지 없음) — 이미지 카드와 동일 비율, 제목+설명 하단 정렬
  // 가격/상태 배지 — 골드 pill·다크 텍스트(daniel 07-07 라이트에서도 금색 고정)
  // 찜 하트 — 카드 우측 하단(가격 배지는 우측 상단이라 겹치지 않는다)
  favBtn: { position: 'absolute', right: space(1.5), bottom: space(1.5), zIndex: 3, padding: space(1.5) },
  favTx: { fontSize: 18, lineHeight: 22, color: colors.inkFaint },
  favTxDark: { color: 'rgba(255,255,255,0.92)' },   // 이미지 위 — 흰 하트
  favInline: { paddingLeft: space(2), paddingVertical: space(1) },
  favTxOn: { color: colors.ju },
  // ★배지는 카드 **맨 아래 줄**에 흐름으로 놓인다(절대배치 아님 — 그림과 겹쳤다).
  //   리스트 뷰는 여전히 자기 배지(`listPriceTag`)를 쓴다.
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space(1.5) },
  priceTag: {
    backgroundColor: colors.badgeGold, borderRadius: radius.pill,
    paddingHorizontal: space(2), paddingVertical: space(0.5),
  },
  priceTagText: { color: '#15132E', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  // 신규 콘텐츠 NEW 배지 — 우측 상단·연한 빨강(daniel 07-22). newBadge.NEW_SINCE 로 출시+21일 자동 노출.
  newTag: {
    backgroundColor: '#F16C6C', borderRadius: radius.pill,
    paddingHorizontal: space(2), paddingVertical: space(0.5),
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  newTagTx: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  // 카드 비율 3:4 고정폭(가로 스크롤). 이미지 cover + 하단 라벨 오버레이.
  // ★미디어 카드(daniel 07-22 '카드인지도 모르겠고') — 이미지가 카드를 꽉 채우고, 하단 다크 그라데이션 위 흰 글씨.
  //   라이트 페이지 위에서 어두운 카드 + 테두리 + 그림자로 경계가 또렷해진다(예전 연한 라벨바 blend 문제 해소).
  // ★시안 카드 — 밝은 면 · 큰 라운드 · 테두리 없음 · 그림자는 아주 옅게.
  //   제목이 위에 오고 그림은 아래다(보통과 반대 — 무엇인지 먼저 읽히게 한 배치).
  card: {
    width: 168, aspectRatio: 0.72, borderRadius: radius.lg, overflow: 'hidden',
    backgroundColor: colors.card, paddingHorizontal: space(2.5), paddingTop: space(3), paddingBottom: space(2.5),
    ...shadow.soft,
  },
  // ★고정 높이 — `flex:1` 로 두면 **설명 줄 수에 따라 아이콘 크기가 달라진다**
  //   (2줄짜리 카드는 아이콘이 크고 3줄짜리는 작았다 · 시뮬 실측). 위쪽 여백이 대신 늘어난다.
  //   ★높이 88 = 시안에서 그림이 **카드 폭의 약 60%**를 차지한다(정사각에 가까워 높이도 그만큼).
  cardArt: { height: 76, alignItems: 'center', justifyContent: 'center', marginTop: space(2) },
  cardArtImg: { width: '100%', height: '100%' },
  cardImgInner: { borderRadius: radius.md },
  // 순차 공개 전 자리 — 빈 박스(디코드 전). 카드와 같은 크기·모서리 유지(레이아웃 안 흔들림).
  cardPlaceholder: { backgroundColor: colors.juSoft },
  cardLabel: { color: colors.ju, fontSize: 14.5, lineHeight: 19, fontWeight: '900', letterSpacing: -0.4 },
  cardDesc: { color: colors.inkSoft, fontSize: 11.5, lineHeight: 15.5, textAlign: 'left', marginTop: 4 },
  // ★`cardLabelPrem`(밝은 골드) 삭제 — **다크 오버레이 위**에서 읽히라고 만든 색이라
  //   밝은 시안 카드에서는 대비가 **2.3**(기준 4.5)으로 거의 안 보였다(계산 · 시뮬 실측).
  //   유료라는 신호는 아래 가격 배지(「30 운」)가 이미 하고 있어 글자색까지 바꿀 이유가 없다.
  // ── 리스트뷰 — 세로 행: 썸네일 + 텍스트 + 가격/셰브런 ──
  listBody: { paddingHorizontal: space(5), gap: space(2), marginTop: space(1) }, // section 의 -space(5) 상쇄해 폭 정렬
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    paddingVertical: space(2.5), paddingHorizontal: space(3),
    ...shadow.soft,
  },
  // 투명 아이콘이 `contain` 으로 들어간다 — 면은 옅게 깔아 두어 빈 줄에도 정렬이 유지된다
  listThumb: { width: 54, height: 54, borderRadius: radius.md, backgroundColor: colors.juSoft, padding: space(1) },
  // 글자 모노그램 — 테두리 없이 색면만(시안 톤). 항목마다 달라 반복으로 보이지 않는다
  listThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  listThumbGlyph: { fontSize: 21, fontWeight: '900', color: colors.ju, letterSpacing: -0.5 },
  listTextCol: { flex: 1, justifyContent: 'center' }, // 남는 폭 차지 → 가격/셰브런 우측 고정
  listLabel: { flexShrink: 1, fontSize: 16, fontWeight: '800', color: colors.ink, letterSpacing: 0.2 },
  listLabelRow: { flexDirection: 'row', alignItems: 'center' }, // 라벨 + NEW 배지 한 줄(라벨 flexShrink 로 길면 …, NEW 는 고정)
  listNewTag: { backgroundColor: '#F16C6C', borderRadius: radius.pill, paddingHorizontal: space(1.5), paddingVertical: 1, marginLeft: space(1.5) }, // 리스트뷰 인라인 NEW(카드뷰 newTag 와 같은 색)
  listLabelPrem: { color: colors.ju },
  listDesc: { fontSize: 12.5, color: colors.inkSoft, lineHeight: 17, marginTop: 2 },
  // 검색 결과 없음 — 결과 자리에 그대로 놓아 '검색은 됐는데 없다'가 읽히게(빈 화면 아님).
  searchEmpty: { ...font.body, color: colors.inkSoft, textAlign: 'center', paddingVertical: space(10), lineHeight: 22 },
  // '더 보기/접기' — 섹션 끝 가운데 정렬 소형 버튼(행과 구분되게 배경 없음)
  listPriceTag: { flexShrink: 0, backgroundColor: colors.badgeGold, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) },
  listPriceTx: { color: '#15132E', fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  listChevron: { flexShrink: 0, fontSize: 24, fontWeight: '700', color: colors.inkFaint, paddingHorizontal: space(1) },
});
