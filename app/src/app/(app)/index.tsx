// src/app/(app)/index.tsx — 홈 (지금 나 + 오늘, 미드나잇 테마, 다국어)
// ─────────────────────────────────────────────────────────────────────────
// ★2026-07-18 IA 개편(daniel): 콘텐츠 카드 그리드 35장은 **하단탭 '풀이'**(/contents)로 옮겼다.
//   홈에 남는 것 = '지금 내 상태'만 — 자기이해 히어로 · AI 코치 진입 · 오늘/내일 기운 · 대표 명식 선택 · 통변 진행률.
//   daniel 지시: "풀이 넘어가는 리스트만 옮기고 오늘의 운세나 이런건 다 그대로 둘꺼야."
//   목록 데이터/렌더는 lib/content/contentSections.ts · components/ContentGrid.tsx 로 이관(단일 출처).
//
// ★2026-07-21 홈 in-place 드래그(daniel "실제 홈에서 길게 탭해 위아래로 이동해 배치 조절"):
//   블록 배치 순서를 **홈에서 직접** 길게 눌러 드래그해 바꾼다(설정 화면에서도 여전히 가능).
//   구현: 블록 6개(order)를 DraggableFlatList 로. 헤더/통변 진행률 배너/로그인 링크는 '고정'(순서 대상 아님)이라
//     ListHeaderComponent/ListFooterComponent 로 뺀다.
//   ★블록들이 PressableScale(짧은 탭=화면 이동)이라 RN <Pressable onLongPress> 로는 drag 가 안 걸린다
//     → gesture-handler Gesture.LongPress 로 길게 누르면 drag() 발동(짧은 탭은 그대로 통과=이동). drag 는 JS 함수라 runOnJS.
//   ※ DraggableFlatList 가 스크롤 컨테이너가 되므로 기존 바깥 ScrollView 는 없앤다(리스트가 세로 스크롤 담당).
//     'today' 블록 내부의 가로 페이저(ScrollView)는 세로 드래그와 직교라 공존(그대로 둔다).
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
import { TodayRelationCard } from '../../components/TodayRelationCard'; // 오늘의 관계 — 궁합을 매일 여는 화면으로(리텐션 07-20)
import { TigerMascot } from '../../components/TigerMascot'; // 아기 백호 브랜드 마스코트(모션) — 홈 헤더 타이틀 좌측
import { getDailyFortune, dailyHeadline, dailyPreview, scoreFlow, dailyEnergy, energyReason, ENERGY_LABEL, type DailyEnergy } from '../../lib/content/dailyFortune';
import { ScoreFlowGraph } from '../../components/ScoreFlowGraph'; // 오늘 기운 점수 흐름 그래프(홈, daniel 07-13)
import { stemElement, branchElement, elementColor, elementText } from '../../lib/engine/ohaeng'; // 오늘의 기운 = 오행색 네모 한자
import { useGenProgress, clearGenProgress } from '../../lib/backend/genProgress'; // 풀이 진행률(다중·route별, 풀이중 홈 나가도 % — daniel)
import { useSubscription } from '../../lib/billing/subscription';
import { loadRepChart, subscribeRepChange } from '../../lib/engine/myChart';
import { prewarmReadings, prewarmDaily } from '../../lib/backend/prewarmReadings';
import { scheduleDailyFortune } from '../../lib/backend/notifications'; // 매일 9시 오늘의 운세 알림
import { scheduleLuckAlerts } from '../../lib/backend/luckAlerts'; // 시기 예고(대운 교체·세운 전환) 로컬 알림 — 리텐션 Phase 2
import { buildSajuChart } from '@engine/saju';
import type { Stem, Branch } from '@spec/chart';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { BusyOverlay } from '../../components/BusyOverlay'; // 로그아웃 등 긴 콜백 로딩
import { PressableScale } from '../../components/PressableScale';
import { appLang } from '../../lib/i18n';
import { useHomeOrder, type HomeBlockKey } from '../../lib/ui/homeOrder'; // 홈 블록 배치 순서(계정별 저장·daniel 07-19)
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist'; // 홈 길게눌러 드래그 재정렬(daniel 07-21)
import { Gesture, GestureDetector } from 'react-native-gesture-handler'; // PressableScale이 onLongPress를 삼켜서 RNGH LongPress로 drag 발동
import { runOnJS } from 'react-native-reanimated'; // 제스처 worklet → JS drag() 호출

// 주의 등급 라벨·색 — dailyEnergy.caution(점수 구간)에 붙는 이름표.
//   ★'조심'에 빨강을 쓰지 않는다(§4 부정 증폭 금지) — 골드/중립 톤으로 낮춰 표시한다.
const CAUTION: Record<DailyEnergy['caution'], { label: string; tone: string }> = {
  low: { label: '순조', tone: colors.ju },
  mid: { label: '보통', tone: colors.inkSoft },
  high: { label: '조심', tone: colors.inkSoft },
};

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
  const { order, setOrder } = useHomeOrder(); // 홈 블록 순서(계정별 — 설정·홈 드래그에서 변경)
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
  // 오늘·내일 기운 판정(유형명·총운점수·주의등급·근거·신살) — 별도 카드였던 것을 이 배너로 통합(daniel 07-19).
  const [energies, setEnergies] = useState<(DailyEnergy | null)[]>([null, null]);
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
      if (!rep) { setDayData([{ headline: null, prose: null }, { headline: null, prose: null }]); setFlow(null); setEnergies([null, null]); return; }
      const saju = buildSajuChart(rep.input);
      try { setFlow(scoreFlow(saju, 'day')); } catch { setFlow(null); } // 오늘 점수 흐름(그제~모레)
      // 오늘·내일 각각의 기운 판정(결정론·API 0). 실패해도 배너 나머지는 그대로 보이게 null 유지.
      try {
        setEnergies(fortunes.map((f) => dailyEnergy(saju, f.dayGanZhi[0] as Stem, f.dayGanZhi[1] as Branch)));
      } catch { setEnergies([null, null]); }
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

  // ★시기 예고 알림(리텐션 Phase 2·daniel 07-19) — 대운 교체 1개월 전 / 세운 전환(입춘) 3일 전.
  //   ★서버 푸시가 아니라 로컬 예약: 시점 계산이 완전한 결정론이라 기기에서 뽑아 예약하면 되고,
  //   그래야 생년월일이 서버로 나가지 않는다(PII 경계 ADR-005). 연 1~2회만 울려 스팸이 되지 않는다.
  useEffect(() => {
    let alive = true;
    (async () => {
      const rep = await loadRepChart();
      if (!alive || !rep) return;
      const b = new Date(rep.input.birthDateTime);             // 대운 교체 나이를 날짜로 환산하는 데 필요
      if (isNaN(b.getTime())) return;
      await scheduleLuckAlerts(buildSajuChart(rep.input), b);
    })().catch(() => {});
    return () => { alive = false; };
  }, [reloadKey]);

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

  // ── 홈 블록 하나를 렌더 — order 의 각 키 → 해당 컴포넌트/배너. (드래그 재정렬 renderItem 에서 호출) ──
  //   key 는 DraggableFlatList(keyExtractor)·renderItem 래퍼가 담당하므로 여기선 붙이지 않는다.
  const renderBlock = (k: HomeBlockKey) => {
    // 명식 선택/전환 — 아래 블록이 전부 '지금 적용된 명식' 기준이라 기본 순서에선 맨 위.
    if (k === 'chart') return <ChartPicker onChange={() => setReloadKey((n) => n + 1)} />;
    // 성격유형 120종(일간10×월지12·온디바이스 결정론) — 명식이 없으면 스스로 렌더하지 않는다.
    if (k === 'persona') return <PersonaTypeHero reloadKey={reloadKey} />;
    // 자기이해 히어로 — 에겐·테토 게이지 + 성격유형/MBTI/특징 클러스터(App Store 4.3 결).
    if (k === 'self') return <SelfUnderstandingHero reloadKey={reloadKey} />;
    // 오늘의 관계 — 등록한 상대 × 오늘 일진(결정론). 상대가 없으면 스스로 렌더하지 않는다.
    if (k === 'relation') return <TodayRelationCard reloadKey={reloadKey} dateKey={dateKey} />;
    // AI 자기이해 코치 — 대화형 도구 진입('운세 피드'가 아니라 물어보는 도구 = 차별화).
    if (k === 'coach') return (
      <PressableScale style={styles.coachBanner} onPress={() => router.push('/coach')}>
        <Text style={styles.coachBannerEmoji}>💬</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.coachBannerTitle}>{t('coach.title', 'AI 자기이해 코치')}</Text>
          <Text style={styles.coachBannerSub} numberOfLines={1}>{t('coach.sub', '나에 대해 궁금한 걸 물어보세요')}</Text>
        </View>
        <Text style={styles.coachBannerArrow}>›</Text>
      </PressableScale>
    );
    // 오늘/내일 기운 — 토글·좌우 슬라이드(가로 페이징). 별도 카드였던 유형명·점수·등급·근거·신살 칩이 여기 통합됐다.
    return (
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
              const e = energies[off];                        // 그 날 기운 판정(유형·점수·등급·근거·신살)
              const cau = e ? CAUTION[e.caution] : null;      // 주의 등급 라벨·색
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
                    {/* 총운 점수 + 주의 등급 — 우측 정렬(통합 전 카드의 핵심 정보) */}
                    {e && cau && (
                      <View style={styles.scoreWrap}>
                        <Text style={[styles.scoreTx, { color: cau.tone }]}>{e.score}</Text>
                        <Text style={styles.scoreUnit}>{t('todayEnergy.point', '점')}</Text>
                        <View style={[styles.cautionPill, { borderColor: cau.tone }]}>
                          <Text style={[styles.cautionTx, { color: cau.tone }]}>{cau.label}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                  {/* 기운 유형명 + 한 줄 설명 */}
                  {e && (
                    <View style={{ marginTop: space(2) }}>
                      <Text style={[styles.energyName, { fontSize: fs(16) }]}>{ENERGY_LABEL[e.group].name}</Text>
                      <Text style={[styles.energyDesc, { fontSize: fs(12.5) }]} numberOfLines={2}>{ENERGY_LABEL[e.group].desc}</Text>
                    </View>
                  )}
                  {/* 점수 흐름 그래프(그제~모레) — off(오늘/내일)에 맞춰 강조점 이동(daniel 07-13) */}
                  {flow ? <View style={{ marginTop: space(2), marginBottom: space(1) }}><ScoreFlowGraph scores={flow.scores} labels={flow.labels} currentIndex={flow.currentIndex + off} height={112} /></View> : null}
                  {d.headline && <Text style={[styles.bannerHeadline, { fontSize: fs(16) }]}>{d.headline}</Text>}
                  {d.prose && <Text style={[styles.bannerProse, { fontSize: fs(15), lineHeight: fs(22) }]} numberOfLines={3}>{d.prose}</Text>}
                  {/* 근거(억부: 내 강약 × 그 날 기운) + 작용·신살 칩 */}
                  {e && <Text style={[styles.energyReason, { fontSize: fs(13), lineHeight: fs(19) }]}>{energyReason(e)}</Text>}
                  {e && e.signals.length > 0 && (
                    <View style={styles.chips}>
                      {e.signals.map((s) => (
                        <View key={s.key} style={[styles.chip, s.kind === 'good' ? styles.chipGood : styles.chipCare]}>
                          <Text style={[styles.chipTx, s.kind === 'good' && styles.chipTxGood]} numberOfLines={1}>{s.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {d.prose && <Text style={styles.bannerMore}>{t('today.more')}</Text>}
                </PressableScale>
              );
            })}
          </ScrollView>
        </View>
        </>)}
      </View>
    );
  };

  // ── 드래그 재정렬 renderItem — 길게 누르면(Gesture.LongPress) drag() 발동. 짧은 탭은 내부 PressableScale 로 통과(=화면 이동). ──
  const renderItem = ({ item, drag, isActive }: RenderItemParams<HomeBlockKey>) => {
    // drag 는 DraggableFlatList 가 준 JS 함수 → worklet(onStart)에서 runOnJS 로 호출. 250ms 홀드면 발동.
    const hold = Gesture.LongPress().minDuration(250).onStart(() => runOnJS(drag)());
    return (
      <ScaleDecorator activeScale={1.03}>
        <GestureDetector gesture={hold}>
          <View style={isActive ? styles.dragActive : undefined}>{renderBlock(item)}</View>
        </GestureDetector>
      </ScaleDecorator>
    );
  };

  // 리스트 고정 헤더 = 브랜드 헤더 + 구분선 + 통변 진행률 배너(알림·순서 대상 아님·항상 최상단).
  const listHeader = (
    <>
      {/* 헤더 — 타이틀 옆에 계정(사람) 아이콘: 탭 → 계정 관리·프리미엄 구매(설정)(daniel) */}
      <View style={styles.headerRow}>
        {/* 브랜드 마스코트(아기 백호·모션) — 타이틀 좌측. 헤더가 조밀해 후광은 끔(bob/sway만). */}
        <TigerMascot size={40} glow={false} style={{ marginRight: space(2.5), marginBottom: space(1) }} />
        {/* 타이틀·서브타이틀 = 좌측 컬럼. ★왼쪽 못박기(daniel 07-02): 컬럼 alignItems:flex-start + 텍스트 textAlign:left. 👤만 우측 y축 가운데 */}
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <Text style={styles.title}>{t('appName')}</Text>
          <Text style={styles.sub}>{t('tagline')}</Text>
        </View>
        <PressableScale onPress={() => router.push('/settings')} hitSlop={10} style={styles.accountBtn}>
          <Text style={styles.accountIcon}>👤</Text>
        </PressableScale>
      </View>
      <View style={styles.divider} />

      {/* 통변 생성 진행률(daniel) — 여러 개 동시 풀이 가능 → route별 배너 여러 개. 탭=그 화면 이동 + 그 배너만 닫기.
          ★이 배너는 '알림'이라 배치 순서 대상이 아니다(항상 최상단 고정). */}
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
    </>
  );

  // 리스트 고정 푸터 = 로그인 링크(선택·순서 대상 아님).
  //   ★익명 세션 상시라 !session 아닌 !isRegistered — 익명/미로그인에 로그인 유도 노출.
  const listFooter = (
    <View style={styles.authRow}>
      {!isRegistered && (
        <PressableScale onPress={() => router.push('/login')}>
          <Text style={styles.linkText}>{t('common.loginOptional')}</Text>
        </PressableScale>
      )}
    </View>
  );

  return (
    // ★홈도 투명(daniel 2026-07-15 '홈은 테마 적용 안돼') — bgSource 이미지 제거, 전역 ContentBackdrop(오행 배경색)이 비치게.
    <View style={styles.bgImage}>
      {/* fade-in — DraggableFlatList 가 스크롤 컨테이너라 이 Animated.View 로 감싸 opacity 만 준다(flex:1). */}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {/* ★홈 블록 배치 — 순서는 계정별(useHomeOrder · profiles.home_order). 홈에서 길게 눌러 드래그 or 설정에서 변경(daniel).
            기본 순서 = 명식 → AI 코치 → 오늘의 기운 → 오늘의 관계 → 나의 성격유형 → 나는 어떤 사람인가.
            헤더/진행률 배너/로그인 링크는 '고정'이라 ListHeaderComponent/ListFooterComponent 로 뺀다(드래그 대상 아님). */}
        <DraggableFlatList
          data={order}
          keyExtractor={(k) => k}
          renderItem={renderItem}
          onDragEnd={({ data }) => setOrder(data)}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          style={styles.screen}
          contentContainerStyle={styles.wrap}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>
      <BusyOverlay visible={loggingOut} message={t('common.loggingOut')} />
    </View>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, backgroundColor: 'transparent' }, // 전역 ContentBackdrop(오행 배경) 투과
  screen: { backgroundColor: 'transparent' },
  wrap: { padding: space(5), paddingTop: space(12), paddingBottom: space(10) }, // 헤더 숨김 → status bar 여백 확보
  // 드래그 중인 블록 — 살짝 떠 보이게(그림자/불투명 낮춤). ScaleDecorator 가 확대는 담당.
  dragActive: { opacity: 0.92, ...shadow.card },
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
  // ── 기운 판정(별도 카드에서 통합·daniel 07-19): 점수·등급·유형명·근거·신살 칩 ──
  scoreWrap: { flexDirection: 'row', alignItems: 'baseline', gap: space(1), marginLeft: 'auto' }, // 우측 정렬
  scoreTx: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  scoreUnit: { ...font.caption, color: colors.inkFaint, marginRight: space(1) },
  cautionPill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space(2), paddingVertical: space(0.5), alignSelf: 'center' },
  cautionTx: { fontSize: 11, fontWeight: '800' },
  energyName: { color: colors.ink, fontWeight: '900' },
  energyDesc: { color: colors.inkSoft, marginTop: 2, lineHeight: 17 },
  energyReason: { ...font.body, color: colors.inkSoft, marginTop: space(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(2) },
  chip: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space(2.5), paddingVertical: space(1), maxWidth: '100%' },
  chipGood: { backgroundColor: colors.juSoft, borderColor: colors.juLine },
  chipCare: { backgroundColor: colors.overlay, borderColor: colors.line },
  chipTx: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  chipTxGood: { color: colors.ju },
  authRow: { marginTop: space(8), marginBottom: space(4), alignItems: 'center' },
  linkText: { color: colors.ju, fontSize: 14 },
});
