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
import { View, Text, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import { Image as ExpoImage } from 'expo-image'; // 이미지 자동 다운샘플(표시 크기로 디코딩) — 카드 35장 메모리·랙 해결
import { LinearGradient } from 'expo-linear-gradient'; // 카드 하단 다크 그라데이션(라벨 가독·카드 경계 — daniel 07-22 '카드인지도 모르겠고')
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
import { SECTIONS, CARD_REVEAL_OFFSETS, TOTAL_CARDS, HOME_INDIVIDUAL, priceLabel, baseKey, type MenuItem } from '../lib/content/contentSections';
import { SAJU_READING_CATEGORIES } from '../lib/backend/prewarmReadings'; // 세트(사주16) 카테고리 단일출처
import { isNewContent } from '../lib/content/newBadge'; // 신규 콘텐츠 NEW 배지(출시일+21일 자동 만료·우측 상단 연한 빨강)
import { useHomeViewMode } from '../lib/ui/homeView'; // 보기 방식(카드/리스트) 저장·토글(daniel)
import { playSound } from '../lib/ui/sounds';
import { PressableScale } from './PressableScale';
import { colors, radius, space, shadow, font } from '../lib/theme';

// 카드 켄번스 — 정적 이미지를 아주 느리게 줌(daniel #21: 카드가 '가볍게' 살아 움직이게).
//   정적 일러스트라 내부 요소 자체를 움직일 순 없어, 느린 줌으로 생동감을 준다. native 드라이버=GPU라 스크롤 영향 최소.
function KenBurnsCard({ source }: { source: any }) {
  const s = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(s, { toValue: 1, duration: 6500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(s, { toValue: 0, duration: 6500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [s]);
  const scale = s.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}>
      <ExpoImage source={source} style={[StyleSheet.absoluteFill, styles.cardImgInner]} contentFit="cover" cachePolicy="memory-disk" transition={120} />
    </Animated.View>
  );
}

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
const LIST_PREVIEW = 4;

/** 카드뷰에서 가로 스크롤을 2줄로 접는 기준 개수(daniel 2026-08-06).
 *  ★예전엔 섹션 **키를 하드코딩**해 'light 는 5개씩 N줄, deep 은 2줄'로 갈랐다. 그래서 25개짜리
 *    '가볍게 보기'가 **가로 5줄**이 되어 대부분이 화면 밖에 숨었고, 섹션을 새로 만들 때마다
 *    이 분기를 같이 고쳐야 했다(고치지 않으면 조용히 1줄로 떨어진다).
 *  → 이제 **개수로만** 판단한다: 6개 이하면 1줄, 넘으면 2줄. 최대 2줄이라 세로 길이가 예측 가능하다. */
const ROW_FOLD = 6;

/** 보상형 광고 대기 상한(ms) — 광고는 부가 기능이라 오래 붙잡지 않는다. */
const AD_TIMEOUT_MS = 15_000;

/**
 * @param showViewToggle 카드/리스트 토글 노출 여부(기본 true)
 * @param query 검색어(화면이 소유). 비어 있지 않으면 섹션 대신 **한 목록**으로 결과만 그린다.
 *   ★검색 입력을 화면(contents.tsx)이 갖는 이유 = 화면 최상단에 고정해야 키보드에 가리지 않고
 *     (check:keyboard R1), 스크롤을 내린 상태에서도 계속 쓸 수 있기 때문.
 */
export function ContentGrid({ showViewToggle = true, query = '' }: { showViewToggle?: boolean; query?: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useHomeViewMode();
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
        return true;                                                  // ★필터 없음 — 전 항목 한 목록(위 주석 참조)
      }),
    })).filter((sec) => sec.items.length > 0),
    [sokOn],
  );
  const [repServerChartId, setRepServerChartId] = useState<string | null>(null); // 현재 대표 명식(프리미엄·배지 판정)
  const [credits, setCredits] = useState<Record<string, number>>({});                            // creditKey별 쿠폰 잔량
  const [readingRows, setReadingRows] = useState<{ category: string; created_at: string }[]>([]); // 이 명식의 기존 풀이
  const [teasers, setTeasers] = useState<Record<string, HomeTeaser>>({});                         // 카드별 '내 얘기' 한 줄
  const [reloadKey, setReloadKey] = useState(0); // 명식 변경(전환·수정) 감지 — 포커스마다 재계산
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({}); // 리스트뷰 섹션 펼침(기본 접힘·상위 N개만)

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
  const [revealCount, setRevealCount] = useState(1);
  useEffect(() => {
    if (revealCount >= TOTAL_CARDS) return;                                      // 모두 공개 → 타이머 정지
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
        {m.image ? (
          <ExpoImage source={m.image} style={styles.listThumb} contentFit="cover" cachePolicy="memory-disk" transition={120} />
        ) : (
          // 이미지 없는 항목(텍스트 카드) = 라벨 첫 글자 골드 썸네일 placeholder(행 정렬 유지)
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
    for (const sec of sections) for (const m of sec.items) {
      if (seen.has(m.route)) continue;
      // 검색 대상 = 정적 라벨·설명. 티저('내 얘기')는 명식마다 달라져 검색 결과가 흔들린다.
      const hay = `${t(m.labelKey)} ${m.descKey ? t(m.descKey) : ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
      seen.add(m.route);
      out.push(m);
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
      {/* 보기 방식(카드/리스트) 토글 — 우측 정렬 세그먼트, 선택은 저장(다음 실행에도 유지). */}
      {showViewToggle && (
        <View style={styles.viewToggleRow}>
          <View style={styles.viewToggle}>
            {(['card', 'list'] as const).map((mode) => (
              <PressableScale key={mode} style={[styles.viewTogChip, viewMode === mode && styles.viewTogChipOn]} onPress={() => setViewMode(mode)}>
                <Text style={[styles.viewTogTx, viewMode === mode && styles.viewTogTxOn]}>
                  {mode === 'card' ? '▦' : '☰'} {t(mode === 'card' ? 'menu.viewCard' : 'menu.viewList')}
                </Text>
              </PressableScale>
            ))}
          </View>
        </View>
      )}

      {/* 무료 / 프리미엄 / 콘텐츠 3범주 — 큰 섹션 헤더 + 좌우 가로 스크롤 카드(daniel) */}
      {sections.map((sec, secIdx) => {
        // 카드뷰 줄 수 = 개수로만 결정(위 ROW_FOLD 주석 참조 — 섹션 키 하드코딩 제거).
        const twoRows = sec.items.length > ROW_FOLD;
        // ★NEW 배지 콘텐츠를 섹션 앞으로(daniel 07-23 "new 붙어있는걸 제일 앞으로"·카드/리스트 공통). JS sort 안정 → 그 외 순서 유지.
        // ★정렬 = ①보유 이용권 ②NEW ③원래 순서.
        //   ①(daniel 2026-07-26 "유저별로 이용권이 있으면 풀이 목록에서 상단에 올라오게") — 이미 산 이용권을
        //   못 찾아 헤매지 않게 맨 위로. ②는 07-23 daniel 요청("new 붙어있는걸 제일 앞으로"). JS sort 는 안정 소트라
        //   같은 등급 안에서는 선언 순서가 유지된다.
        const hasCredit = (m: MenuItem) => (m.creditKey && (credits[m.creditKey] ?? 0) > 0 ? 1 : 0);
        const items = [...sec.items].sort((a, b) =>
          (hasCredit(b) - hasCredit(a)) || ((isNewContent(b.key) ? 1 : 0) - (isNewContent(a.key) ? 1 : 0)));
        // 섹션 헤더 — 카드뷰·리스트뷰가 동일하게 재사용(중복 제거·정합).
        const sectionHeader = (
          <>
            {sec.key === 'hot' ? (
              // ★'인기' 강조(daniel 07-05) — 연한 골드 하이라이트 밴드(테두리·🔥 제거). juSoft/ju = 라이트/다크 자동.
              <View style={styles.sectionHotBand}>
                <Text style={styles.sectionHotTx}>{t(sec.titleKey)}</Text>
              </View>
            ) : (
              <Text style={styles.sectionH}>{t(sec.titleKey)}</Text>
            )}
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
          // ★섹션별 미리보기 + '더 보기'(daniel 2026-07-26 "리스트형식 너무 나열되어 있어서 보기 힘들어").
          //   원인: 리스트뷰는 전 항목을 세로로 그대로 나열한다 — 특히 '가볍게 보기' 25개 때문에 총 56행이
          //   한 줄씩 쌓여 스캔이 불가능했다(카드뷰는 2줄 가로 스크롤로 압축되지만 리스트뷰엔 그 장치가 없었다).
          //   → 섹션마다 상위 LIST_PREVIEW 개만 펼치고 나머지는 접는다. 스크롤 길이가 1/3 수준으로 줄고,
          //     찾는 사람은 '더 보기'로 즉시 전체를 본다(정보 삭제 아님).
          const secOpen = openSec[sec.key] ?? false;
          const shown = secOpen ? items : items.slice(0, LIST_PREVIEW);
          const restN = items.length - shown.length;
          return (
            <View key={sec.key} style={styles.section}>
              {sectionHeader}
              <View style={styles.listBody}>
                {shown.map(renderListRow)}
                {/* 더 보기 / 접기 — 항목이 미리보기 수를 넘을 때만 */}
                {items.length > LIST_PREVIEW && (
                  <PressableScale style={styles.listMore} onPress={() => setOpenSec((o) => ({ ...o, [sec.key]: !secOpen }))}>
                    <Text style={styles.listMoreTx}>{secOpen ? '접기 ▴' : `${restN}개 더 보기 ▾`}</Text>
                  </PressableScale>
                )}
              </View>
            </View>
          );
        }

        // ── 카드뷰(기본) — 순차 공개 + 켄번스 가로 스크롤 ──────────────────────────
        const cards = items.map((m, itemIdx) => {
          const prem = !!m.premium;
          const badge = badgeFor(m);
          const isNew = isNewContent(m.key); // 신규 콘텐츠 = 우측 상단 연한 빨강 NEW(출시일+21일)
          const desc = descOf(m);
          // 순차 공개 — 이 카드의 전역 순번이 공개분에 들어왔는지. 아직이면 빈 박스(디코드 미발생).
          const revealed = CARD_REVEAL_OFFSETS[secIdx] + itemIdx < revealCount;
          // 이미지 없는 콘텐츠 = 텍스트 카드(제목+설명), 이미지 카드와 시각 구분
          if (!m.image) {
            return (
              <PressableScale key={m.key} style={[styles.card, styles.textCard]} onPress={() => onPress(m)}>
                {badge && <View style={[styles.priceTag, isNew && styles.priceTagLeft]}><Text style={styles.priceTagText}>{badge}</Text></View>}
                {isNew && <View style={styles.newTag}><Text style={styles.newTagTx}>NEW</Text></View>}
                <Text style={styles.textCardLabel}>{t(m.labelKey)}</Text>
                {desc ? <Text style={styles.textCardDesc}>{desc}</Text> : null}
              </PressableScale>
            );
          }
          return (
            <PressableScale key={m.key} style={styles.card} onPress={() => onPress(m)}>
              <View style={styles.cardImg}>
                {/* expo-image 다운샘플(메모리·랙) + 켄번스 느린 줌(daniel #21). 차례가 온 카드만 mount. */}
                {revealed
                  ? <KenBurnsCard source={m.image} />
                  : <View style={[StyleSheet.absoluteFill, styles.cardImgInner, styles.cardPlaceholder]} />}
                {badge && <View style={[styles.priceTag, isNew && styles.priceTagLeft]}><Text style={styles.priceTagText}>{badge}</Text></View>}
                {isNew && <View style={styles.newTag}><Text style={styles.newTagTx}>NEW</Text></View>}
                {/* 하단 라벨 — 이미지 위 다크 그라데이션 오버레이(흰 글씨). 이미지가 카드를 채우고 아래만 어두워져 '미디어 카드'로 또렷해진다. */}
                <LinearGradient colors={['transparent', 'rgba(11,10,26,0.55)', 'rgba(11,10,26,0.94)']} locations={[0, 0.45, 1]} style={styles.labelBar}>
                  <Text style={[styles.cardLabel, prem && styles.cardLabelPrem]} numberOfLines={1}>{t(m.labelKey)}</Text>
                  {desc ? <Text style={styles.cardDesc} numberOfLines={2}>{desc}</Text> : null}
                </LinearGradient>
              </View>
            </PressableScale>
          );
        });
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
  // 보기 방식(카드/리스트) 토글 — pill 세그먼트, 우측 정렬(daniel).
  viewToggleRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: space(4) },
  viewToggle: { flexDirection: 'row', gap: space(1), backgroundColor: colors.overlay, borderRadius: radius.pill, padding: space(1), borderWidth: 1, borderColor: colors.line },
  viewTogChip: { paddingHorizontal: space(3.5), paddingVertical: space(1.5), borderRadius: radius.pill },
  viewTogChipOn: { backgroundColor: colors.ju }, // 활성 = 골드(라이트/다크 자동)
  viewTogTx: { fontSize: 13, fontWeight: '800', color: colors.inkSoft, letterSpacing: 0.2 },
  viewTogTxOn: { color: '#15132E' },             // 골드 위 다크 텍스트
  // 범주 섹션 — 큰 헤더 + 좌우 가로 스크롤. marginHorizontal 음수 = 화면 wrap 패딩(space(5)) 상쇄(가로 스크롤이 화면 끝까지).
  section: { marginBottom: space(6), marginHorizontal: -space(5) },
  sectionH: { fontSize: 22, fontWeight: '800', color: colors.ju, marginBottom: space(1), letterSpacing: 0.3, paddingHorizontal: space(5) },
  // ★'인기' 강조 밴드(daniel 07-05) — 연한 골드 틴트 칩(juSoft)+골드 글씨. 라이트/다크 자동.
  sectionHotBand: { alignSelf: 'flex-start', marginHorizontal: space(5), marginBottom: space(1), backgroundColor: colors.juSoft, borderRadius: radius.md, paddingVertical: space(2), paddingHorizontal: space(3.5) },
  sectionHotTx: { fontSize: 21, fontWeight: '900', color: colors.ju, letterSpacing: 0.3 },
  sectionDesc: { ...font.caption, color: colors.inkSoft, marginBottom: space(3), paddingHorizontal: space(5), lineHeight: 18 },
  hRow: { gap: space(3), paddingHorizontal: space(5), paddingVertical: space(1) }, // 카드 간격 + 좌우 여백
  grid2col: { gap: space(3) },                       // 윗줄·아랫줄 세로 간격
  grid2row: { flexDirection: 'row', gap: space(3) }, // 한 줄 카드 가로 간격
  // 콘텐츠 텍스트 카드(이미지 없음) — 이미지 카드와 동일 비율, 제목+설명 하단 정렬
  textCard: { backgroundColor: colors.juSoft, borderWidth: 1, borderColor: colors.juLine, justifyContent: 'flex-end', padding: space(4) },
  textCardLabel: { fontSize: 18, fontWeight: '800', color: colors.ink },
  textCardDesc: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5), lineHeight: 18 },
  // 가격/상태 배지 — 골드 pill·다크 텍스트(daniel 07-07 라이트에서도 금색 고정)
  priceTag: {
    position: 'absolute', top: space(2.5), right: space(2.5), zIndex: 1,
    backgroundColor: colors.badgeGold, borderRadius: radius.pill,
    paddingHorizontal: space(2), paddingVertical: space(0.5),
  },
  priceTagText: { color: '#15132E', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  priceTagLeft: { right: undefined, left: space(2.5) }, // 신규(NEW)가 우측 상단을 쓰면 가격은 좌측 상단으로 비켜난다
  // 신규 콘텐츠 NEW 배지 — 우측 상단·연한 빨강(daniel 07-22). newBadge.NEW_SINCE 로 출시+21일 자동 노출.
  newTag: {
    position: 'absolute', top: space(2.5), right: space(2.5), zIndex: 2,
    backgroundColor: '#F16C6C', borderRadius: radius.pill,
    paddingHorizontal: space(2), paddingVertical: space(0.5),
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  newTagTx: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  // 카드 비율 3:4 고정폭(가로 스크롤). 이미지 cover + 하단 라벨 오버레이.
  // ★미디어 카드(daniel 07-22 '카드인지도 모르겠고') — 이미지가 카드를 꽉 채우고, 하단 다크 그라데이션 위 흰 글씨.
  //   라이트 페이지 위에서 어두운 카드 + 테두리 + 그림자로 경계가 또렷해진다(예전 연한 라벨바 blend 문제 해소).
  card: { width: 168, aspectRatio: 0.72, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(20,19,46,0.10)', ...shadow.card },
  cardImg: { flex: 1, justifyContent: 'flex-end' },
  cardImgInner: { borderRadius: radius.md },
  // 순차 공개 전 자리 — 빈 박스(디코드 전). 카드와 같은 크기·모서리 유지(레이아웃 안 흔들림).
  cardPlaceholder: { backgroundColor: colors.juSoft },
  labelBar: { paddingTop: space(7), paddingBottom: space(3), paddingHorizontal: space(3.5), alignItems: 'flex-start' }, // 그라데이션 위 좌측정렬 라벨(paddingTop=페이드 여백)
  cardLabel: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '800', letterSpacing: 0.2 },
  cardDesc: { color: 'rgba(255,255,255,0.82)', fontSize: 11, lineHeight: 14.5, textAlign: 'left', marginTop: 3 },
  cardLabelPrem: { color: '#FFE6A6' }, // 프리미엄 = 밝은 골드(다크 오버레이 위 가독)
  // ── 리스트뷰 — 세로 행: 썸네일 + 텍스트 + 가격/셰브런 ──
  listBody: { paddingHorizontal: space(5), gap: space(2), marginTop: space(1) }, // section 의 -space(5) 상쇄해 폭 정렬
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line,
    paddingVertical: space(2.5), paddingHorizontal: space(3),
    ...shadow.soft,
  },
  listThumb: { width: 54, height: 54, borderRadius: radius.sm, backgroundColor: colors.juSoft },
  listThumbPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.juLine },
  listThumbGlyph: { fontSize: 22, fontWeight: '800', color: colors.ju },
  listTextCol: { flex: 1, justifyContent: 'center' }, // 남는 폭 차지 → 가격/셰브런 우측 고정
  listLabel: { flexShrink: 1, fontSize: 16, fontWeight: '800', color: colors.ink, letterSpacing: 0.2 },
  listLabelRow: { flexDirection: 'row', alignItems: 'center' }, // 라벨 + NEW 배지 한 줄(라벨 flexShrink 로 길면 …, NEW 는 고정)
  listNewTag: { backgroundColor: '#F16C6C', borderRadius: radius.pill, paddingHorizontal: space(1.5), paddingVertical: 1, marginLeft: space(1.5) }, // 리스트뷰 인라인 NEW(카드뷰 newTag 와 같은 색)
  listLabelPrem: { color: colors.ju },
  listDesc: { fontSize: 12.5, color: colors.inkSoft, lineHeight: 17, marginTop: 2 },
  // 검색 결과 없음 — 결과 자리에 그대로 놓아 '검색은 됐는데 없다'가 읽히게(빈 화면 아님).
  searchEmpty: { ...font.body, color: colors.inkSoft, textAlign: 'center', paddingVertical: space(10), lineHeight: 22 },
  // '더 보기/접기' — 섹션 끝 가운데 정렬 소형 버튼(행과 구분되게 배경 없음)
  listMore: { alignSelf: 'center', paddingVertical: space(2.5), paddingHorizontal: space(4) },
  listMoreTx: { ...font.caption, color: colors.ju, fontWeight: '800' },
  listPriceTag: { flexShrink: 0, backgroundColor: colors.badgeGold, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) },
  listPriceTx: { color: '#15132E', fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  listChevron: { flexShrink: 0, fontSize: 24, fontWeight: '700', color: colors.inkFaint, paddingHorizontal: space(1) },
});
