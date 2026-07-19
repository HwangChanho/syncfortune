// src/app/(app)/index.tsx — 홈 (지금 나 + 오늘, 미드나잇 테마, 다국어)
// ─────────────────────────────────────────────────────────────────────────
// ★2026-07-18 IA 개편(daniel): 콘텐츠 카드 그리드 35장은 **하단탭 '풀이'**(/contents)로 옮겼다.
//   홈에 남는 것 = '지금 내 상태'만 — 자기이해 히어로 · AI 코치 진입 · 오늘/내일 기운 · 대표 명식 선택 · 통변 진행률.
//   daniel 지시: "풀이 넘어가는 리스트만 옮기고 오늘의 운세나 이런건 다 그대로 둘꺼야."
//   목록 데이터/렌더는 lib/content/contentSections.ts · components/ContentGrid.tsx 로 이관(단일 출처).
//
// 로그인 게이트 없음(ADR-037).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, ScrollView, StyleSheet, Animated, AppState, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/useAuth';
import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ChartPicker } from '../../components/ChartPicker';
import { SelfUnderstandingHero } from '../../components/SelfUnderstandingHero'; // ★4.3: 홈 최상단 자기이해 히어로(성향분석 첫 경험)
import { PersonaTypeHero } from '../../components/PersonaTypeHero'; // ★홈 주인공 ①: 성격유형 120종(daniel 07-18 IA 개편)
import { TodayEnergyCard } from '../../components/TodayEnergyCard'; // ★홈 주인공 ②: 오늘 기운 × 내 원국(근거·등급·점수)
import { TigerMascot } from '../../components/TigerMascot'; // 아기 백호 브랜드 마스코트(모션) — 홈 헤더 타이틀 좌측
import { getDailyFortune, dailyHeadline, dailyPreview, scoreFlow } from '../../lib/content/dailyFortune';
import { ScoreFlowGraph } from '../../components/ScoreFlowGraph'; // 오늘 기운 점수 흐름 그래프(홈, daniel 07-13)
import { stemElement, branchElement, elementColor, elementText } from '../../lib/engine/ohaeng'; // 오늘의 기운 = 오행색 네모 한자
import { useGenProgress, clearGenProgress } from '../../lib/backend/genProgress'; // 풀이 진행률(다중·route별, 풀이중 홈 나가도 % — daniel)
import { useSubscription } from '../../lib/billing/subscription';
import { loadRepChart, subscribeRepChange } from '../../lib/engine/myChart';
import { prewarmReadings, prewarmDaily } from '../../lib/backend/prewarmReadings';
import { scheduleDailyFortune } from '../../lib/backend/notifications'; // 매일 9시 오늘의 운세 알림
import { buildSajuChart } from '@engine/saju';
import type { Stem, Branch } from '@spec/chart';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { BusyOverlay } from '../../components/BusyOverlay'; // 로그아웃 등 긴 콜백 로딩
import { PressableScale } from '../../components/PressableScale';
import { appLang } from '../../lib/i18n';

export default function Home() {
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale(); // 오늘의 기운 배너 본문(읽는 글) 글자 크기 반영
  const gen = useGenProgress(); // 통변 생성 진행률(풀이중 홈 나가면 여기 배너로 %)
  // I(daniel): %가 움직이도록 — 진행 중 풀이가 있으면 주기 리렌더(단일 콜의 추정 % 갱신). 진행 없으면 타이머 미동작.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!gen.some((g) => g.active && g.done < g.total)) return;
    const id = setInterval(() => setTick((x) => x + 1), 700);
    return () => clearInterval(id);
  }, [gen]);
  // 홈 배너 % — multi(사주16/자미12)=저장 기반 실제값, single(총1)=시작~저장 추정(저장되면 done>=total로 완료 분기=100%)
  const genPct = (done: number, total: number, startedAt: number) => total > 1
    ? Math.round((done / total) * 100)
    : Math.min(95, Math.max(3, Math.round(((Date.now() - startedAt) / 20000) * 100)));
  const { session, isRegistered } = useAuth();
  const { isPremium } = useSubscription();
  const [dayOffset, setDayOffset] = useState(0); // 0=오늘·1=내일(오늘의 기운 카드 토글)
  // 날짜 키 — 홈을 켜둔 채 자정이 지나도 갱신되게(③). 포커스·앱 복귀 시 재확인.
  const [dateKey, setDateKey] = useState(() => new Date().toDateString());
  // 오늘·내일 둘 다 미리 계산(daniel: 좌우 슬라이드 — 손가락 따라 미끄러지는 가로 페이징)
  const fortunes = useMemo(() => [getDailyFortune(0), getDailyFortune(1)], [dateKey]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  // 오늘/내일 가로 페이징(네이티브 슬라이드) 제어 — 페이지 폭은 onLayout 으로 확정(초기엔 대략값=깜빡임 방지)
  const fortunePager = useRef<ScrollView>(null);
  const [pageW, setPageW] = useState(Dimensions.get('window').width - space(5) * 2 - space(4) * 2);
  const goDay = (off: number) => { setDayOffset(off); fortunePager.current?.scrollTo({ x: off * pageW, animated: true }); };
  // 오늘·내일 각각의 한 줄 풀이(글)+캐치 타이틀 — 대표 명식 일간 × 그날 일진(온디바이스). [0]=오늘 [1]=내일.
  const [dayData, setDayData] = useState<{ headline: string | null; prose: string | null }[]>([{ headline: null, prose: null }, { headline: null, prose: null }]);
  const [flow, setFlow] = useState<{ scores: number[]; labels: string[]; currentIndex: number } | null>(null); // 오늘 점수 흐름(그래프, daniel 07-13)
  const [hasChart, setHasChart] = useState<boolean>(true); // H1(daniel): 대표 명식 유무 — 없으면 오늘/내일 배너를 '명식 등록 안내'로(탭→등록)
  const [reloadKey, setReloadKey] = useState(0); // 명식 변경(전환·수정) 감지 — 포커스마다 오늘의 기운 재계산(daniel: 명식 수정 시 id 동일이라 갱신 안 되던 버그)
  const [loggingOut, setLoggingOut] = useState(false); // 로그아웃 콜백 동안 오버레이

  // 홈 포커스 시(명식 변경 후 복귀 포함) 날짜·대표 명식 재확인 → 오늘의 기운 갱신(①③)
  useFocusEffect(useCallback(() => {
    setDateKey(new Date().toDateString());
    setReloadKey((k) => k + 1); // 홈 복귀마다 재계산 트리거 → 명식 전환·수정 모두 반영(daniel)
  }, []));
  // 명식 전역 변경(전환·수정·★로그아웃 클리어) 구독 → 오늘의 기운 즉시 재계산. 로그아웃 시 화면 전환 없이 명식이 비워지면 바로 빈 상태로(daniel).
  useEffect(() => subscribeRepChange(() => setReloadKey((k) => k + 1)), []);
  // 백그라운드→포그라운드(자정 넘겨 홈 유지) 시 날짜 재확인(③)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setDateKey(new Date().toDateString()); });
    return () => sub.remove();
  }, []);
  // 대표 명식 × 오늘·내일 일진 → 각 날의 한 줄 풀이+캐치(둘 다 미리 = 슬라이드 시 즉시 표시). ①③ 재계산.
  useEffect(() => {
    let alive = true;
    (async () => {
      const rep = await loadRepChart();
      if (!alive) return;
      setHasChart(!!rep); // H1: 명식 유무 → 오늘/내일 배너 분기(등록안내 vs 운세)
      if (!rep) { setDayData([{ headline: null, prose: null }, { headline: null, prose: null }]); setFlow(null); return; }
      const saju = buildSajuChart(rep.input);
      try { setFlow(scoreFlow(saju, 'day')); } catch { setFlow(null); } // 오늘 점수 흐름(그제~모레)
      const calc = (f: typeof fortunes[number]) => ({
        // 미리보기 본문 = 조합형(매일·오늘≠내일 다르게, API 0). 상세 화면은 전체 풀이(dailyChartReadings) 별도.
        prose: dailyPreview(saju, f.dayGanZhi[0] as Stem, f.dayGanZhi[1] as Branch),
        headline: dailyHeadline(saju, f.dayGanZhi[0] as Stem, f.dayGanZhi[1] as Branch),
      });
      const base = [calc(fortunes[0]), calc(fortunes[1])];
      setDayData(base); // 룰 기반 즉시 표시(즉시성 유지 — 절대규칙5)

      // ★ 상세 화면과 정합(daniel 07-13): 같은 날 LLM 통변 캐시가 있으면 그 headline/통합을 우선.
      //   상세(today.tsx)는 reading.headline 우선인데 홈은 룰만 써서 '같은 명식·같은 날인데 제목이 다름' 발생 → 홈도 캐시 우선.
      if (session && rep.serverChartId) {
        try {
          const cats = fortunes.map((f) => `daily_${f.date.replace(/-/g, '')}`);
          const { data } = await supabase.from('readings')
            .select('category, content').eq('chart_id', rep.serverChartId).eq('lang', appLang()).in('category', cats);
          if (!alive || !data?.length) return;
          const byCat: Record<string, Record<string, string>> = {};
          for (const r of data as { category: string; content: Record<string, string> }[]) byCat[r.category] = r.content;
          // 통합(general) 첫 문장만 뽑아 배너 teaser 로(상세 본문과 같은 소스 → 톤 정합). numberOfLines=3 이 넘치면 클램프.
          const firstSentence = (s: string) => { const tx = (s || '').trim(); const m = tx.match(/^[\s\S]*?[.!?。]\s/); return (m ? m[0] : tx).trim(); };
          const merged = fortunes.map((f, i) => {
            const c = byCat[`daily_${f.date.replace(/-/g, '')}`];
            if (!c?.headline) return base[i]; // 그 날 LLM 통변 없으면 룰 유지(오늘만 있고 내일은 보통 없음)
            return { headline: c.headline, prose: firstSentence(c.general) || base[i].prose };
          });
          if (alive) setDayData(merged);
        } catch { /* 캐시 조회 실패 시 룰 유지 */ }
      }
    })();
    return () => { alive = false; };
  }, [fortunes, reloadKey, session]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
  }, []);

  // 매일 9시 '오늘의 운세' 알림 스케줄(향후 14일치, 진입마다 갱신). 네이티브 모듈/권한 없으면 no-op.
  useEffect(() => { scheduleDailyFortune().catch(() => {}); }, []);

  // 프로 구독자 풀이 선생성(daniel: "구독하면 통변 1회는 미리 돌아가게") — 홈 진입 시
  //   대표 명식의 전 영역(사주16+자미12)을 백그라운드 생성. 멱등(캐시된 영역 skip = 재과금 0).
  useEffect(() => {
    if (!session || !isPremium) return;
    (async () => {
      const rep = await loadRepChart();
      if (rep) prewarmReadings(rep, session); // fire-and-forget — 실패해도 앱 흐름 무관
      if (rep) prewarmDaily(rep, session);    // H2(daniel): 오늘·내일 정확한 운세(LLM) 미리 생성 → /today 즉시(프리미엄만, 구독이 비용 커버)
    })();
  }, [session, isPremium]);

  async function doLogout() {
    setLoggingOut(true);
    try { await supabase.auth.signOut(); }
    finally { setLoggingOut(false); }
  }

  return (
    // ★홈도 투명(daniel 2026-07-15 '홈은 테마 적용 안돼') — bgSource 이미지 제거, 전역 ContentBackdrop(오행 배경색)이 비치게.
    <View style={styles.bgImage}>
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* 헤더 — 타이틀 옆에 계정(사람) 아이콘: 탭 → 계정 관리·프리미엄 구매(설정)(daniel) */}
        <View style={styles.headerRow}>
          {/* 브랜드 마스코트(아기 백호·모션) — 타이틀 좌측. 홈 첫인상에 캐릭터성 부여(daniel 07-13). 헤더가 조밀해 후광은 끔(bob/sway만). */}
          <TigerMascot size={40} glow={false} style={{ marginRight: space(2.5), marginBottom: space(1) }} />
          {/* 타이틀·서브타이틀 = 좌측 컬럼. ★왼쪽 못박기(daniel 07-02: 여전히 가운데로 보임 → 명시 좌측): 컬럼 alignItems:flex-start + 텍스트 textAlign:left. 👤만 우측 y축 가운데 */}
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Text style={styles.title}>{t('appName')}</Text>
            <Text style={styles.sub}>{t('tagline')}</Text>
          </View>
          <PressableScale onPress={() => router.push('/settings')} hitSlop={10} style={styles.accountBtn}>
            <Text style={styles.accountIcon}>👤</Text>
          </PressableScale>
        </View>
        <View style={styles.divider} />

        {/* ★대표 명식 선택/전환 — 홈 **최상단**(daniel 2026-07-19 "홈도 가장 상단에 오게").
            아래 히어로·오늘기운·운세가 전부 '지금 적용된 명식' 기준이라, 무엇을 보고 있는지가 먼저 보여야 한다.
            전환 시 reloadKey 를 올려 아래 카드가 즉시 재계산된다. */}
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />

        {/* 통변 생성 진행률(daniel) — 여러 개 동시 풀이 가능 → route별 배너 여러 개. 탭=그 화면 이동 + 그 배너만 닫기. */}
        {gen.map((g) => (g.total > 0 && g.done >= g.total ? (
          // 완료(daniel 이슈13): '풀이 보기' — 탭하면 그 화면 이동 + 그 배너만 닫기(다른 풀이 배너는 유지).
          <PressableScale key={g.route} onPress={() => { clearGenProgress(g.route); router.navigate(g.route as any); }} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(4), marginBottom: space(3), gap: space(2) }}>
            <Text style={{ color: colors.bg, fontWeight: '800', fontSize: fs(13), flex: 1 }}>{g.chartLabel ? g.chartLabel + ' — ' : ''}{g.label} 풀이가 완성됐어요!</Text>
            <Text style={{ color: colors.bg, fontWeight: '800', fontSize: fs(13) }}>풀이 보기 ›</Text>
          </PressableScale>
        ) : (
          <PressableScale key={g.route} onPress={() => router.navigate(g.route as any)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.juSoft, borderColor: colors.ju, borderWidth: 1, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(4), marginBottom: space(3), gap: space(2) }}>
            <Text style={{ color: colors.ju, fontWeight: '700', fontSize: fs(13), flex: 1 }}>{g.restored ? `이전에 진행중이던 ${g.chartLabel ? g.chartLabel + ' — ' : ''}${g.label} 풀이가 있어요` : `${g.chartLabel ? g.chartLabel + ' — ' : ''}${g.label} 풀이 중… ${g.total > 1 ? `${g.done}/${g.total} ` : ''}${genPct(g.done, g.total, g.startedAt)}%`}</Text>
            <Text style={{ color: colors.ju, fontWeight: '700', fontSize: fs(13) }}>이어보기 ›</Text>
          </PressableScale>
        )))}

        {/* ★홈 주인공 ①: 나의 성격유형 120종(daniel 2026-07-18) — 카드 그리드를 '풀이' 탭으로 보내고 이 자리를 주인공으로.
            일간10×월지12 온디바이스 결정론(API 0). 명식이 없으면 스스로 렌더하지 않는다(아래 히어로가 등록 유도). */}
        <PersonaTypeHero reloadKey={reloadKey} />

        {/* ★홈 주인공 ②: 오늘 기운 × 내 원국(daniel 2026-07-18) — 유형명·근거·주의 등급·총운 점수.
            아래 '오늘/내일 기운 배너'와 역할이 다르다: 저쪽은 '어떤 하루인가(서술)', 이쪽은 '왜 그런가(근거)·몇 점인가'.
            dateKey 를 함께 넘겨 자정이 지나 앱에 돌아와도(포커스 없이 AppState 만 바뀌는 경우 포함) 오늘 것으로 갱신된다. */}
        <TodayEnergyCard reloadKey={reloadKey} dateKey={dateKey} />

        {/* ★자기이해 히어로(App Store 4.3 · daniel 2026-07-12) — 홈 첫 화면을 '운세 목록'이 아니라 '나를 분석하는 도구'로 각인.
            에겐·테토 성향을 온디바이스 즉시 산출해 게이지+한줄요약 + 성격유형/MBTI/특징 클러스터. 오늘 기운 배너 *위*. */}
        <SelfUnderstandingHero reloadKey={reloadKey} />

        {/* ★AI 자기이해 코치(App Store 4.3 · daniel 2026-07-12) — 대화형 도구 진입. '운세 피드'가 아니라 물어보는 도구 = 차별화. */}
        <PressableScale style={styles.coachBanner} onPress={() => router.push('/coach')}>
          <Text style={styles.coachBannerEmoji}>💬</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.coachBannerTitle}>{t('coach.title', 'AI 자기이해 코치')}</Text>
            <Text style={styles.coachBannerSub} numberOfLines={1}>{t('coach.sub', '나에 대해 궁금한 걸 물어보세요')}</Text>
          </View>
          <Text style={styles.coachBannerArrow}>›</Text>
        </PressableScale>

        {/* 오늘/내일 기운 — 토글 또는 좌우 슬라이드(가로 페이징·daniel). 본문 탭 → 상세(분야별, 같은 offset). */}
        <View style={styles.fortuneBanner}>
          {!hasChart ? (
            // H1(daniel): 명식 미등록 → 오늘/내일 운세 대신 등록 안내(탭하면 등록창)
            <PressableScale onPress={() => router.push('/register')} style={{ alignItems: 'center', paddingVertical: space(5), gap: space(2) }}>
              <Text style={{ color: colors.ju, fontWeight: '900', fontSize: fs(16), textAlign: 'center' }}>{t('home.noChartTitle', 'AI가 분석하는 나 — 여기서 시작')}</Text>
              <Text style={{ color: colors.inkSoft, fontSize: fs(13), textAlign: 'center' }}>{t('home.noChartSub', '생년월일시를 넣으면 성격·반복되는 관계·적성·올해 흐름을 사주 엔진으로 개인 분석해요')}</Text>
              <View style={{ backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(6), marginTop: space(2) }}>
                <Text style={{ color: colors.bg, fontWeight: '800', fontSize: fs(14) }}>{t('home.noChartCta', '+ 명식 등록')}</Text>
              </View>
            </PressableScale>
          ) : (<>
          <View style={styles.dayToggle}>
            {([0, 1] as const).map((off) => (
              <PressableScale key={off} style={[styles.dayTogChip, dayOffset === off && styles.dayTogChipOn]} onPress={() => goDay(off)}>
                <Text style={[styles.dayTogTx, dayOffset === off && styles.dayTogTxOn]}>{t(off === 0 ? 'today.today' : 'today.tomorrow')}</Text>
              </PressableScale>
            ))}
          </View>
          {/* 가로 페이징 = 손가락 따라 슬라이드. onLayout 으로 페이지 폭 확정 → 한 페이지씩 스냅. */}
          <View onLayout={(e) => setPageW(e.nativeEvent.layout.width)}>
            <ScrollView
              ref={fortunePager}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setDayOffset(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, pageW)))}
            >
              {([0, 1] as const).map((off) => {
                const f = fortunes[off];
                const d = dayData[off];
                return (
                  <PressableScale key={off} style={{ width: pageW }} onPress={() => router.push(`/today?offset=${off}`)}>
                    <Text style={styles.bannerDate}>{f.date} ({t('today.weekdaysShort').split(',')[new Date(f.date + 'T00:00:00').getDay()] ?? ''})</Text>
                    <View style={styles.bannerPillarRow}>
                      <Text style={styles.bannerPillar}>{off === 0 ? t('today.dayPillar') : t('today.energyTomorrow')}</Text>
                      <View style={styles.gzBoxRow}>
                        {[f.dayGanZhi[0], f.dayGanZhi[1]].map((ch, i) => {
                          const el = i === 0 ? stemElement(ch) : branchElement(ch); // 천간·지지 오행
                          return (
                            <View key={i} style={[styles.gzBox, { backgroundColor: elementColor[el] }]}>
                              <Text style={[styles.gzBoxTx, { color: elementText[el] }]}>{ch}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                    {/* 점수 흐름 그래프(그제~모레) — off(오늘/내일)에 맞춰 강조점 이동(daniel 07-13) */}
                    {flow ? <View style={{ marginTop: space(2), marginBottom: space(1) }}><ScoreFlowGraph scores={flow.scores} labels={flow.labels} currentIndex={flow.currentIndex + off} height={112} /></View> : null}
                    {d.headline && <Text style={[styles.bannerHeadline, { fontSize: fs(16) }]}>{d.headline}</Text>}
                    {d.prose && <Text style={[styles.bannerProse, { fontSize: fs(15), lineHeight: fs(22) }]} numberOfLines={3}>{d.prose}</Text>}
                    {d.prose && <Text style={styles.bannerMore}>{t('today.more')}</Text>}
                  </PressableScale>
                );
              })}
            </ScrollView>
          </View>
          </>)}
        </View>

        {/* ※ChartPicker 는 위 최상단으로 이동(daniel 07-19) — 여기서 다시 그리지 않는다. */}

        {/* ★콘텐츠 카드 그리드는 하단탭 '풀이'(/contents)로 이동(daniel 07-18 IA 개편).
            여기서 목록을 다시 그리지 않는다 — 두 곳에 두면 카드 추가 시 드리프트가 난다. */}

        {/* 로그인 = 선택 (로그아웃은 설정에서 — daniel: 홈 하단 로그아웃 버튼 제거). ★익명 세션 상시라 !session 아닌 !isRegistered — 익명/미로그인에 로그인 유도 노출 */}
        <View style={styles.authRow}>
          {!isRegistered && (
            <PressableScale onPress={() => router.push('/login')}>
              <Text style={styles.linkText}>{t('common.loginOptional')}</Text>
            </PressableScale>
          )}
        </View>
      </Animated.View>
    </ScrollView>
    <BusyOverlay visible={loggingOut} message={t('common.loggingOut')} />
    </View>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, backgroundColor: 'transparent' }, // 전역 ContentBackdrop(오행 배경) 투과
  screen: { backgroundColor: 'transparent' },
  wrap: { padding: space(5), paddingTop: space(12), paddingBottom: space(10) }, // 헤더 숨김 → status bar 여백 확보
  title: { ...font.display, textAlign: 'left' as const }, // ★좌측 못박기(daniel 07-02)
  // 헤더 행 — 전체를 살짝 아래로(타이틀 너무 위 방지), 👤 아이콘만 좌측 타이틀·서브 컬럼 기준 y축 가운데(daniel 07-02)
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space(4) },
  accountBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.ju, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.juSoft, marginRight: space(2), marginBottom: space(1) },
  accountIcon: { fontSize: 20 },
  sub: { ...font.body, color: colors.inkSoft, marginTop: space(2), textAlign: 'left' as const }, // ★좌측 못박기(daniel 07-02)
  divider: { width: 44, height: 3, borderRadius: 2, backgroundColor: colors.ju, marginTop: space(4), marginBottom: space(6) },
  fortuneBanner: {
    backgroundColor: colors.juSoft, padding: space(4), borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, marginBottom: space(6),
  },
  // ★AI 자기이해 코치 진입 배너(홈 상단·4.3 대화형 도구)
  coachBanner: { flexDirection: 'row', alignItems: 'center', gap: space(3), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, paddingVertical: space(3.5), paddingHorizontal: space(4), marginBottom: space(6), ...shadow.card },
  coachBannerEmoji: { fontSize: 22 },
  coachBannerTitle: { ...font.body, color: colors.ink, fontWeight: '800' },
  coachBannerSub: { ...font.caption, color: colors.inkSoft, marginTop: 1 },
  coachBannerArrow: { fontSize: 22, color: colors.ju, fontWeight: '800' },
  // 오늘/내일 토글(배너 상단)
  dayToggle: { flexDirection: 'row', gap: space(2), marginBottom: space(3) },
  dayTogChip: { paddingHorizontal: space(4), paddingVertical: space(1.5), borderRadius: radius.pill, backgroundColor: colors.overlay, borderWidth: 1, borderColor: colors.line },
  dayTogChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  dayTogTx: { fontSize: 13, fontWeight: '800', color: colors.inkSoft },
  dayTogTxOn: { color: '#15132E' },
  bannerDate: { ...font.caption, color: colors.inkSoft },
  bannerPillar: { ...font.heading, color: colors.ink },
  bannerPillarRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(1.5) },
  gzBoxRow: { flexDirection: 'row', gap: space(1) },
  gzBox: { width: 30, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  gzBoxTx: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  bannerHeadline: { ...font.body, color: colors.ju, fontWeight: '800', fontSize: 16, marginTop: space(3) }, // 오늘의 기운을 아우르는 캐치 타이틀
  bannerProse: { ...font.body, color: colors.inkSoft, marginTop: space(1.5), lineHeight: 22 },
  bannerMore: { ...font.caption, color: colors.ju, fontWeight: '700', marginTop: space(2) },
  authRow: { marginTop: space(8), marginBottom: space(4), alignItems: 'center' },
  linkText: { color: colors.ju, fontSize: 14 },
});
