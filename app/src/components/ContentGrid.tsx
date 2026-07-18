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
import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert } from '../lib/ui/alert';
import { useAuth } from '../lib/useAuth';
import { useFeatureOn } from '../lib/core/features'; // 신규 기능 노출 게이트(속궁합 등 — 원격 플래그+관리자, 재제출 안전판)
import { supabase } from '../lib/supabase';
import { showRewardedAd, adTestMode } from '../lib/core/ads'; // 무료 온디바이스 콘텐츠 진입 보상형 광고
import { isAdmin } from '../lib/core/admin';                  // 관리자·프리미엄 = 무료 진입 광고 제외
import { useSubscription } from '../lib/billing/subscription';
import { loadRepChart, subscribeRepChange } from '../lib/engine/myChart';
import { isPremiumForChart } from '../lib/billing/premiumStore';  // 명식별 프리미엄('이용중' 표시)
import { needsYearRepurchase } from '../lib/billing/repurchase';  // 지난 해 연도 풀이 → '재구매' 배지(daniel 07-08)
import { loadCredits } from '../lib/billing/coupons';             // 쿠폰 잔량
import { buildSajuChart } from '@engine/saju';
import { appLang } from '../lib/i18n';
import { homeTeaser, type HomeTeaser } from '../lib/content/homeTeaser'; // 카드 설명을 '내 얘기' 한 줄로(결정론·API 0, daniel 07-16)
import { SECTIONS, CARD_REVEAL_OFFSETS, TOTAL_CARDS, HOME_INDIVIDUAL, priceLabel, type MenuItem } from '../lib/content/contentSections';
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

/**
 * 콘텐츠 카드 그리드. 화면(/contents)이 이걸 그대로 얹기만 하면 된다.
 * @param showViewToggle 카드/리스트 토글 노출 여부(기본 true)
 */
export function ContentGrid({ showViewToggle = true }: { showViewToggle?: boolean }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useHomeViewMode();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const [admin, setAdmin] = useState(false);
  // ★신규 기능 노출 게이트 — 속궁합은 관리자(daniel) 또는 원격 플래그 ON 일 때만 노출(재제출 안전판).
  const sokOn = useFeatureOn('sokgunghap');
  const sections = useMemo(
    () => SECTIONS.map((sec) => ({ ...sec, items: sec.items.filter((m) => m.key !== 'sokgunghap' || sokOn) })),
    [sokOn],
  );
  const [repServerChartId, setRepServerChartId] = useState<string | null>(null); // 현재 대표 명식(프리미엄·배지 판정)
  const [credits, setCredits] = useState<Record<string, number>>({});                            // creditKey별 쿠폰 잔량
  const [readingRows, setReadingRows] = useState<{ category: string; created_at: string }[]>([]); // 이 명식의 기존 풀이
  const [teasers, setTeasers] = useState<Record<string, HomeTeaser>>({});                         // 카드별 '내 얘기' 한 줄
  const [reloadKey, setReloadKey] = useState(0); // 명식 변경(전환·수정) 감지 — 포커스마다 재계산

  // session 반응형 — 로그아웃 즉시 관리자 상태 해제.
  useEffect(() => { if (!session) { setAdmin(false); return; } isAdmin().then(setAdmin).catch(() => {}); }, [session]);
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
      const saju = buildSajuChart(rep.input);
      // homeTeaser 는 throw 하지 않고 미지원 카드·산출 실패를 null 로 주므로 개별 try/catch 불필요.
      const tUnknown = (rep.input as any)?.timeAccuracy === '미상'; // 시주 미상 힌트(시에 기대는 산출의 정확도)
      const tz: Record<string, HomeTeaser> = {};
      for (const sec of SECTIONS) for (const m of sec.items) { const x = homeTeaser(m.key, saju, tUnknown); if (x) tz[m.key] = x; }
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
      const { data } = await supabase
        .from('readings').select('category, created_at')
        .eq('chart_id', repServerChartId).eq('lang', appLang());
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
    if (m.content && !m.creditKey && !isPremium && (!admin || adTestMode())) await showRewardedAd().catch(() => false);
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

  // ★유료 카드 배지(daniel 07-08) — 가격 대신 '명식별 상태'. 우선순위대로 첫 매칭 반환:
  //   ① 프리미엄(대표 명식) = '무제한' — 단 개별전용 3종(dream/followup/timeresolve)은 커버 밖이라 제외.
  //   ② 이 명식에 풀이가 이미 있음 = '풀이있음 · {만료일}'(생성일+1년) / 지난 해 연도 풀이만 있으면 '재구매'.
  //   ③ 쿠폰 잔량 > 0 = '쿠폰 {n}장'.   ④ 그 외 = 개별 가격. creditKey 없으면 null(배지 없이 › 셰브런).
  function badgeFor(m: MenuItem): string | null {
    const ck = m.creditKey;
    if (!ck) return null;                                                                  // 무료 콘텐츠 = 배지 없음
    if (isPremiumForChart(repServerChartId) && !HOME_INDIVIDUAL.has(ck)) return '무제한';   // ①
    const nowD = new Date();
    const matched = readingRows.filter((r) => r.category === ck || r.category.startsWith(ck + '_'));
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
        const isLight = sec.key === 'light'; // '가볍게 보기' = 항목이 많아 2줄 가로 스크롤(daniel)
        const isDeep = sec.key === 'deep';   // '나에 대해 알기' = 5개 넘어 2줄(컬럼 정렬) 가로 스크롤
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
            {sec.key !== 'free' && sec.descKey ? <Text style={styles.sectionDesc}>{t(sec.descKey)}</Text> : null}
          </>
        );

        // ── 리스트뷰(daniel: "리스트로 좀 더 보기 편한 뷰") ─────────────────────────
        //   카드뷰의 순차 공개·켄번스 줌 없이 세로 '행': 작은 썸네일(좌) + 제목·설명 + 가격 배지/셰브런(우).
        //   썸네일이 작아(≈54px) expo-image 다운샘플로 전량 즉시 로드해도 가볍다.
        //   가격/프리미엄 판정·진입(onPress)은 카드뷰와 완전히 동일한 헬퍼를 재사용(단일 출처).
        if (viewMode === 'list') {
          return (
            <View key={sec.key} style={styles.section}>
              {sectionHeader}
              <View style={styles.listBody}>
                {sec.items.map((m) => {
                  const prem = !!m.premium;
                  const priceTxt = badgeFor(m);
                  const desc = descOf(m);
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
                        <Text style={[styles.listLabel, prem && styles.listLabelPrem]} numberOfLines={1}>{t(m.labelKey)}</Text>
                        {desc ? <Text style={styles.listDesc} numberOfLines={2}>{desc}</Text> : null}
                      </View>
                      {priceTxt ? (
                        <View style={styles.listPriceTag}><Text style={styles.listPriceTx}>{priceTxt}</Text></View>
                      ) : (
                        <Text style={styles.listChevron}>›</Text>
                      )}
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          );
        }

        // ── 카드뷰(기본) — 순차 공개 + 켄번스 가로 스크롤 ──────────────────────────
        const cards = sec.items.map((m, itemIdx) => {
          const prem = !!m.premium;
          const badge = badgeFor(m);
          const desc = descOf(m);
          // 순차 공개 — 이 카드의 전역 순번이 공개분에 들어왔는지. 아직이면 빈 박스(디코드 미발생).
          const revealed = CARD_REVEAL_OFFSETS[secIdx] + itemIdx < revealCount;
          // 이미지 없는 콘텐츠 = 텍스트 카드(제목+설명), 이미지 카드와 시각 구분
          if (!m.image) {
            return (
              <PressableScale key={m.key} style={[styles.card, styles.textCard]} onPress={() => onPress(m)}>
                {badge && <View style={styles.priceTag}><Text style={styles.priceTagText}>{badge}</Text></View>}
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
                {badge && <View style={styles.priceTag}><Text style={styles.priceTagText}>{badge}</Text></View>}
                {/* 하단 라벨 바(반투명) — 라벨 + 간략 설명(daniel: 콘텐츠별 설명) */}
                <View style={styles.labelBar}>
                  <Text style={[styles.cardLabel, prem && styles.cardLabelPrem]}>{t(m.labelKey)}</Text>
                  {desc ? <Text style={styles.cardDesc} numberOfLines={2}>{desc}</Text> : null}
                </View>
              </View>
            </PressableScale>
          );
        });
        return (
          <View key={sec.key} style={styles.section}>
            {sectionHeader}
            {isLight ? (
              // 좌우 스크롤 — 한 줄 5개씩, 5개 넘으면 아래 줄로 쌓음(daniel).
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
                <View style={styles.grid2col}>
                  {Array.from({ length: Math.ceil(cards.length / 5) }, (_, r) => (
                    <View key={r} style={styles.grid2row}>{cards.slice(r * 5, r * 5 + 5)}</View>
                  ))}
                </View>
              </ScrollView>
            ) : isDeep ? (
              // 나에 대해 알기 — 5개 넘어 2줄(컬럼 정렬: 위/아래 번갈아) 가로 스크롤(daniel)
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
  // 카드 비율 3:4 고정폭(가로 스크롤). 이미지 cover + 하단 라벨 오버레이.
  card: { width: 162, aspectRatio: 0.72, borderRadius: radius.md, overflow: 'hidden', ...shadow.card },
  cardImg: { flex: 1, justifyContent: 'flex-end' },
  cardImgInner: { borderRadius: radius.md },
  // 순차 공개 전 자리 — 빈 박스(디코드 전). 카드와 같은 크기·모서리 유지(레이아웃 안 흔들림).
  cardPlaceholder: { backgroundColor: colors.juSoft },
  labelBar: { backgroundColor: colors.labelScrim, paddingVertical: space(2.5), alignItems: 'center' }, // 라이트=거의 불투명(이미지 비침 차단·daniel)
  cardLabel: { color: colors.ink, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  cardDesc: { color: colors.inkSoft, fontSize: 10.5, lineHeight: 13.5, textAlign: 'center', marginTop: 3, paddingHorizontal: space(1.5) },
  cardLabelPrem: { color: colors.ju }, // 프리미엄 = 골드 라벨
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
  listLabel: { fontSize: 16, fontWeight: '800', color: colors.ink, letterSpacing: 0.2 },
  listLabelPrem: { color: colors.ju },
  listDesc: { fontSize: 12.5, color: colors.inkSoft, lineHeight: 17, marginTop: 2 },
  listPriceTag: { flexShrink: 0, backgroundColor: colors.badgeGold, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) },
  listPriceTx: { color: '#15132E', fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  listChevron: { flexShrink: 0, fontSize: 24, fontWeight: '700', color: colors.inkFaint, paddingHorizontal: space(1) },
});
