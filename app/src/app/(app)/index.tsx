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
import { View, Text, ScrollView, StyleSheet, Animated, AppState, Dimensions, Modal, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // ★상단 안전영역 — 고정 여백은 글자확대 시 잘린다(daniel 07-27)
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/useAuth';
import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { excludeMock } from '../../lib/core/testMode'; // ★홈 배너 daily 캐시서 목업 제외(OFF) — 실모드서 '목업 자리표시' 노출 방지(daniel 07-23 신고)
// ChartPicker(명식 선택)는 홈에서 제거(daniel 2026-07-25 '명식 선택은 홈에서 빼자') — 풀이 탭·만세력·설정에서 전환.
import { SelfUnderstandingHero } from '../../components/SelfUnderstandingHero'; // ★4.3: 홈 최상단 자기이해 히어로(성향분석 첫 경험)
import { PersonaTypeHero } from '../../components/PersonaTypeHero'; // ★홈 주인공 ①: 성격유형 120종(daniel 07-18 IA 개편)

// 홈 블록 이미지 상수(IMG)는 홈이 정보 카드로 바뀌며(2026-08-01) 소비처가 사라져 제거했다.
import { HouseAdBanner } from '../../components/HouseAdBanner';
import { ScoreCard } from '../../components/kit/ScoreCard';   // 시안 p04 점수 카드
import { FreeTrioBlock } from '../../components/home/FreeTrioBlock';
import { Image as ExpoImage } from 'expo-image';
import { brandMark } from '../../lib/ui/brandAsset';
import { BonusStrip } from '../../components/home/BonusStrip';
import { unreadCount } from '../../lib/backend/notifyInbox';   // ★시안 헤더의 종 — 안 읽은 알림 배지
import { isAdminActing } from '../../lib/core/admin'; // 홈 배치 편집 = 관리자 전용(daniel 2026-08-06) // 홈 상단 내부 프로모 배너(하우스 광고·daniel 07-24)
import { BiorhythmCard } from '../../components/BiorhythmCard'; // 홈 블록: 바이오리듬(07-21 코드큐·온디바이스·부가 재미·API 0)
import { LuckyTodayCard } from '../../components/LuckyTodayCard'; // 홈 블록: 오늘의 행운(07-22 코드큐·온디바이스·luckyItem 재사용·API 0)
import { CommunityPulseInline } from '../../components/CommunityPulseCard'; // 상단 컨트롤 행 우측 소셜 프루프(실측 집계·임계값 미만 자동 숨김)
import { DecisionTodayCard } from '../../components/DecisionTodayCard'; // 홈 블록: 오늘의 결정(07-25 코드큐·dailyEnergy 재배열·새 판정 0·API 0)
import { TodayRelationCard } from '../../components/TodayRelationCard'; // 오늘의 관계 — 궁합을 매일 여는 화면으로(리텐션 07-20)
import { RelationMapCard } from '../../components/RelationMapCard';
import { getDailyFortune, dailyHeadline, getDailyReading, dailyEnergy, type DailyEnergy } from '../../lib/content/dailyFortune';
import { useGenProgress, clearGenProgress } from '../../lib/backend/genProgress'; // 풀이 진행률(다중·route별, 풀이중 홈 나가도 % — daniel)
import { useSubscription } from '../../lib/billing/subscription';
import { loadRepChart, subscribeRepChange } from '../../lib/engine/myChart';
import { prewarmReadings, prewarmDaily } from '../../lib/backend/prewarmReadings';
import { scheduleDailyFortune } from '../../lib/backend/notifications'; // 매일 9시 오늘의 운세 알림
import { scheduleLuckAlerts } from '../../lib/backend/luckAlerts'; // 시기 예고(대운 교체·세운 전환) 로컬 알림 — 리텐션 Phase 2
import { computeChart } from '../../lib/engine/engine'; // ★canonical 명식 빌더 단일화(daniel 07-23) — 홈이 raw buildSajuChart 직접호출 시 세운·interactions 누락→신강약 드리프트(홈 33 vs 상세 59)
import type { Stem, Branch } from '@spec/chart';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { PressableScale } from '../../components/PressableScale';
import { appLang } from '../../lib/i18n';
import { useHomeOrder, type HomeBlockKey } from '../../lib/ui/homeOrder'; // 홈 블록 배치 순서(계정별 저장·daniel 07-19)
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist'; // 홈 블록 리스트(드래그는 '배치 편집' 모달에서 — daniel 07-21 '편집 모드')
import { HomeOrderEditModal } from '../../components/HomeOrderEditModal';
import { useWebCols } from '../../components/WebShell';
import { WebLanding } from '../../components/WebLanding'; // 웹 첫 방문자에게 '이게 뭔지' 먼저(명식 0개일 때만) // 넓은 웹 = 홈 블록 2열(폰은 그대로 드래그 리스트) // 홈 배치 편집 모달(간단 목록 드래그·제스처 충돌 0)

// 주의 등급 라벨·색 — dailyEnergy.caution(점수 구간)에 붙는 이름표.
//   ★'조심'에 빨강을 쓰지 않는다(§4 부정 증폭 금지) — 골드/중립 톤으로 낮춰 표시한다.
const CAUTION: Record<DailyEnergy['caution'], { label: string; tone: string }> = {
  low: { label: '순조', tone: colors.ju },
  mid: { label: '보통', tone: colors.inkSoft },
  high: { label: '조심', tone: colors.inkSoft },
};

export default function Home() {
  const twoCol = useWebCols() > 1;   // 넓은 웹에서만 2열(드래그는 폰 제스처라 그쪽에만 둔다)
  const wideWebHome = twoCol;        // 사이드바가 있는 화면 = 헤더에서 워드마크 중복 제거
  // ★고정 상단여백(space(12) 등)은 **글자 크기를 키우면 헤더가 상태바 위로 잘린다**(daniel 07-27 IMG_8215).
  //   상수는 기기 노치·다이내믹아일랜드·글자배율 어느 것도 반영하지 못한다 → 실제 안전영역을 쓴다.
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale(); // 남은 인라인 글자 크기(명식 없음 안내 등)
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
  // 오늘·내일 기운 판정(유형명·총운점수·주의등급·근거·신살) — 별도 카드였던 것을 이 배너로 통합(daniel 07-19).
  const [energies, setEnergies] = useState<(DailyEnergy | null)[]>([null, null]);
  const [unread, setUnread] = useState(0);                       // 안 읽은 알림(0 이면 배지를 그리지 않는다)
  const [repName, setRepName] = useState<string | null>(null);   // ★시안 인사말('○○님 반갑습니다')용 대표 명식 이름
  const [hasChart, setHasChart] = useState<boolean>(true); // H1(daniel): 대표 명식 유무 — 없으면 오늘/내일 배너를 '명식 등록 안내'로(탭→등록)
  const [reloadKey, setReloadKey] = useState(0); // 명식 변경(전환·수정) 감지 — 포커스마다 오늘의 기운 재계산(daniel: 명식 수정 시 id 동일이라 갱신 안 되던 버그)
  const [editOpen, setEditOpen] = useState(false); // 홈 배치 편집 모달(daniel 07-21 '편집 모드')
  // ★홈 배치 편집을 **관리자에게만** 보인다(daniel 2026-08-06 "홈화면 편집은 관리자 뷰에서 관리자 계정만").
  //   일반 사용자에게 배치 편집은 첫 화면의 상단 자리를 차지할 만큼 자주 쓰는 기능이 아니고,
  //   지금은 홈 구성(오늘의 운세 → 배너 → …)을 운영이 정하는 편이 퍼널 의도에 맞다.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => { isAdminActing().then(setIsAdmin).catch(() => setIsAdmin(false)); }, [session]);
  const [quickOpen, setQuickOpen] = useState(false); // 🧭 바로가기 메뉴(만세력·AI코치 분기 — daniel 2026-07-25 J)

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
      setRepName(rep?.label ?? null);   // 인사말용 — 같은 왕복에서 얻으므로 추가 조회가 없다
      void unreadCount().then((n) => { if (alive) setUnread(n); });   // 실패하면 0 = 배지 없음(틀린 숫자보다 낫다)
      if (!rep) { setDayData([{ headline: null, prose: null }, { headline: null, prose: null }]); setEnergies([null, null]); return; }
      const saju = computeChart(rep.input).saju; // ★상세(today.tsx)와 동일 빌더 — 세운·interactions 포함해 classifyStrength 일치(favorGood 뒤집힘 방지)
      // 오늘·내일 각각의 기운 판정(결정론·API 0). 실패해도 배너 나머지는 그대로 보이게 null 유지.
      try {
        setEnergies(fortunes.map((f) => dailyEnergy(saju, f.dayGanZhi[0] as Stem, f.dayGanZhi[1] as Branch)));
      } catch { setEnergies([null, null]); }
      // ★홈 배너 본문 = 상세(/today)와 동일 소스(getDailyReading 통합 첫문장)로 통일 — 주제/내용 정합(daniel 07-23).
      //   기존 dailyPreview(별도 2문장 조합 풀)는 상세 본문(getDailyReading 5분야)과 달라 '홈≠상세' 어긋남 → 상세 통합의 teaser로 교체.
      //   룰·LLM 두 경우 모두 general(통합) 첫문장을 쓰므로 홈은 언제나 상세의 미리보기가 된다. firstSentence 는 아래 LLM 병합과 공용.
      const firstSentence = (s: string) => { const tx = (s || '').trim(); const m = tx.match(/^[\s\S]*?[.!?。]\s/); return (m ? m[0] : tx).trim(); };
      const calc = (f: typeof fortunes[number]) => ({
        prose: firstSentence(getDailyReading(saju, f.dayGanZhi[0] as Stem, f.dayGanZhi[1] as Branch, 'day').general),
        headline: dailyHeadline(saju, f.dayGanZhi[0] as Stem, f.dayGanZhi[1] as Branch),
      });
      const base = [calc(fortunes[0]), calc(fortunes[1])];
      setDayData(base); // 룰 기반 즉시 표시(즉시성 유지 — 절대규칙5)

      // ★ 상세 화면과 정합(daniel 07-13): 같은 날 LLM 통변 캐시가 있으면 그 headline/통합을 우선.
      //   상세(today.tsx)는 reading.headline 우선인데 홈은 룰만 써서 '같은 명식·같은 날인데 제목이 다름' 발생 → 홈도 캐시 우선.
      if (session && rep.serverChartId) {
        try {
          const cats = fortunes.map((f) => `daily_${f.date.replace(/-/g, '')}`);
          const { data } = await excludeMock(supabase.from('readings')
            .select('category, content').eq('chart_id', rep.serverChartId).eq('lang', appLang()).in('category', cats));
          if (!alive || !data?.length) return;
          const byCat: Record<string, Record<string, string>> = {};
          for (const r of data as { category: string; content: Record<string, string> }[]) byCat[r.category] = r.content;
          // 통합(general) 첫 문장만 뽑아 배너 teaser 로(상세 본문과 같은 소스 → 톤 정합·firstSentence 는 위에서 정의). numberOfLines=3 이 넘치면 클램프.
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
      await scheduleLuckAlerts(computeChart(rep.input).saju, b);
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

  // ── 홈 블록 하나를 렌더 — order 의 각 키 → 해당 컴포넌트/배너. (드래그 재정렬 renderItem 에서 호출) ──
  //   key 는 DraggableFlatList(keyExtractor)·renderItem 래퍼가 담당하므로 여기선 붙이지 않는다.
  const renderBlock = (k: HomeBlockKey) => {
    // 명식 선택(ChartPicker)은 홈에서 제거(daniel 2026-07-25) — 홈은 대표 명식 기준 자동 표시. reloadKey 는 포커스/repChange 로 갱신(105·108).
    // 만세력·AI 코치 = 홈 블록에서 제거(daniel 2026-07-25 J) → 상단 '🧭 바로가기' 메뉴로 분기(order·renderBlock 미처리).
    // 성격유형 120종(일간10×월지12·온디바이스 결정론) — 명식이 없으면 스스로 렌더하지 않는다.
    // ★2026-07-27(daniel "홈에 글씨들은 다 숨기고 타고 들어가야 볼 수 있게" → "홈은 모든 컨텐츠 다, 오늘의 운세 빼고"):
    //   오늘의 운세만 펼치고 **나머지 6블록은 제목 한 줄로 접는다.** 홈이 글로 도배되지 않게 하는 것이 목적이라
    //   힌트 문구도 '내용'이 아니라 *무엇을 볼 수 있는지*만 적는다(내용을 적으면 접는 의미가 없다).
    //   ⚠️접기 전 상세 화면 존재를 전수 확인했다 — 바이오리듬만 없어서 `/biorhythm` 을 새로 만들었다
    //     (상세가 없는 블록을 접으면 그 콘텐츠가 도달 불가가 된다).
    //   ★원래 카드 컴포넌트는 그대로 둔다 — 각자의 상세 화면에서 재사용된다(중복 구현 0).
    // ★★2026-08-01 daniel "홈 이미지들 오늘의 기운처럼 바꿔" — **정보 카드로 되돌린다.**
    //   07-27 엔 반대로 갔었다("홈에 글씨들은 다 숨기고 타고 들어가야 볼 수 있게"). 실물을 보고 나온 판단이
    //   바뀐 것이고, 지금 화면은 **제목 한 줄뿐인 큰 그림**이 줄줄이라 정보 밀도가 0이었다.
    //   오늘의 기운 카드처럼 **들어가지 않아도 내 얘기가 보이는** 카드로 통일한다.
    //
    //   ★고칠 게 거의 없었다 — 정보 카드 컴포넌트(BiorhythmCard·LuckyTodayCard…)는 처음부터 다 있었고,
    //     `명식 있음 → 이미지 카드 / 없음 → 정보 카드` 로 **게이트가 거꾸로** 걸려 있었을 뿐이다.
    //     (각 카드는 명식이 없으면 스스로 미노출을 판단하므로 분기 자체가 불필요했다.)
    //   ⚡부수 효과: 홈의 `ImageBackground`(원본 풀 디코딩)가 사라져 갤럭시 랙의 큰 축 하나가 없어진다.
    // ★배너(하우스 광고) — 08-06 부터 **순서를 바꿀 수 있는 블록**이다(daniel "편집에 배너도 위치이동 가능하게").
    //   기본 위치는 오늘의 운세 바로 아래(DEFAULT_HOME_ORDER). 종전엔 고정 헤더라 늘 최상단이었다.
    if (k === 'banner') return <HouseAdBanner />;
    // 시안 p04 「무료로 체험해보세요!」 — 무료 콘텐츠 29종에서 날짜 시드로 도는 3장(FreeTrioBlock 머리말)
    if (k === 'free3') return <FreeTrioBlock dateKey={dateKey} />;
    // 시안 p13 하단 「도착한 혜택」 — 보너스 쿠폰이 **있을 때만** 스스로 렌더한다(없으면 null)
    if (k === 'bonus') return <BonusStrip name={repName} />;
    if (k === 'persona') return <PersonaTypeHero reloadKey={reloadKey} />;
    if (k === 'self') return <SelfUnderstandingHero reloadKey={reloadKey} />;
    if (k === 'biorhythm') return <BiorhythmCard reloadKey={reloadKey} />;
    if (k === 'luck') return <LuckyTodayCard reloadKey={reloadKey} />;
    if (k === 'decision') return <DecisionTodayCard reloadKey={reloadKey} />;
    if (k === 'relation') return <TodayRelationCard reloadKey={reloadKey} dateKey={dateKey} />;
    if (k === 'relmap') return <RelationMapCard reloadKey={reloadKey} />;   // 관계 지도(daniel 2026-08-14 '최초 진입')
    // (AI 자기이해 코치 블록은 상단 🧭 바로가기로 이동 — daniel 2026-07-25 J)
    // 오늘/내일 기운 — 토글·좌우 슬라이드(가로 페이징). 별도 카드였던 유형명·점수·등급·근거·신살 칩이 여기 통합됐다.
    return (
      <View style={styles.fortuneBanner}>
        {!hasChart ? (
          // H1(daniel): 명식 미등록 → 오늘/내일 운세 대신 안내.
          //   ★2026-07-26: **주 CTA 를 '가볍게 보기'로 바꿈**(docs/PLAN_light_mode.md L1). 이유 =
          //     앱 화면 49개가 대표 명식 게이트라 신규는 **아무것도 보기 전에 등록 폼**(이름·생년월일·양음윤달·
          //     시진/정확시각·출생지 + 선택 4항목)을 만난다. 먼저 결과를 보여주고 등록은 그다음이다.
          //     등록 링크는 남겨 둔다 — 이미 마음먹은 사람의 길을 막지 않게.
          <View style={{ alignItems: 'center', paddingVertical: space(3.5), gap: space(1.5) }}>
            <Text style={{ color: colors.ju, fontWeight: '900', fontSize: fs(16), textAlign: 'center' }}>{t('home.noChartTitle', 'AI가 분석하는 나 — 여기서 시작')}</Text>
            <Text style={{ color: colors.inkSoft, fontSize: fs(13), textAlign: 'center' }}>{t('home.noChartSub2', '생년월일만 넣으면 성격유형과 일주를 바로 볼 수 있어요. 가입도, 저장도 안 해요.')}</Text>
            <PressableScale onPress={() => router.push('/light')} style={{ backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(6), marginTop: space(2) }}>
              <Text style={{ color: colors.bg, fontWeight: '800', fontSize: fs(14) }}>{t('home.lightCta', '가볍게 보기')}</Text>
            </PressableScale>
            <PressableScale onPress={() => router.push('/register')} style={{ paddingVertical: space(2), paddingHorizontal: space(4) }}>
              <Text style={{ color: colors.inkSoft, fontWeight: '700', fontSize: fs(13) }}>{t('home.noChartCta', '+ 명식 등록')}</Text>
            </PressableScale>
          </View>
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
              const e = energies[off];   // 그 날 기운 판정(점수·주의 등급). 유형명·근거·신살은 /today 가 맡는다
              return (
                <View key={off} style={{ width: pageW }}>
                  {/* ★시안 p04 그대로 — 좌: 「오늘의 운세」·**큰 점수**·상태칩 / 우: 제목·2줄·자세히보기.
                      [무엇이 빠졌나] 간지 박스·꺾은선 그래프·기운 유형명·억부 근거·신살 칩은
                      **지우지 않고 `/today` 로 옮겼다**. 홈 카드는 "오늘 몇 점"만 박는 자리다
                      — 종전엔 이 카드 하나가 첫 화면을 통째로 먹어 **아래에 뭔가 더 있다는 신호가 0** 이었다.
                      ⚠️'홈에서 뺀다'와 '없앤다'는 다르다. 옮길 곳을 먼저 만들고 뺐다. */}
                  <ScoreCard
                    label={off === 0 ? t('today.title', '오늘의 운세') : t('today.energyTomorrow', '내일의 기운')}
                    score={e?.score ?? '—'}
                    tone={e ? CAUTION[e.caution].label : undefined}
                    title={dayData[off].headline ?? ''}
                    body={dayData[off].prose ?? undefined}
                    unitLabel={t('todayEnergy.point', '점')}
                    moreLabel={t('today.more', '분야별로 자세히 보기 →')}
                    onPress={() => router.push(`/today?offset=${off}`)}
                  />
                </View>
              );
            })}
          </ScrollView>
        </View>
        </>)}
      </View>
    );
  };

  // ── 홈 블록 렌더 — 순서대로 표시(홈에서 드래그 없음). 순서 변경은 '배치 편집' 버튼 → HomeOrderEditModal(간단 목록 드래그). ──
  const renderItem = ({ item }: RenderItemParams<HomeBlockKey>) => <View>{renderBlock(item)}</View>;

  // 리스트 고정 헤더 = 브랜드 헤더 + 구분선 + 통변 진행률 배너(알림·순서 대상 아님·항상 최상단).
  const listHeader = (
    <>
      {/* 헤더 — 타이틀 옆에 계정(사람) 아이콘: 탭 → 계정 관리·프리미엄 구매(설정)(daniel)
          ★넓은 웹에서는 **워드마크를 빼고 계정 버튼만** 남긴다(2026-08-15).
            좌측 사이드바가 이미 '니운내운'을 달고 있어, 같은 화면에 브랜드가 두 번 뜨고 있었다.
            폰에는 사이드바가 없으므로 그대로 둔다. */}
      {/* ★시안 헤더(`니운내운.pdf` p04) — 로고는 가운데, 설정·알림은 우측, 그 아래 큰 인사말.
            종전엔 좌측에 마스코트+앱이름, 우측에 👤 였다. 시안은 **이름을 부르는 것**을 앞세운다. */}
      <View style={styles.headerRow}>
        <View style={styles.headerSide} />
        {/* ★「운」 심볼(Boss 제공 2026-08-18) — 시안은 헤더 가운데가 로고다.
              넓은 웹에서는 사이드바가 이미 브랜드를 달고 있어 숨긴다(브랜드 중복 방지·08-15 규칙 유지). */}
        {!wideWebHome && <ExpoImage source={brandMark()} style={styles.brandMark} contentFit="contain" transition={160} />}
        <View style={[styles.headerSide, styles.headerIcons]}>
          {/* 알림 — 안 읽은 게 있을 때만 점을 얹는다(숫자는 쓰지 않는다: 3개든 30개든 '새 게 있다'가 전부다) */}
          <PressableScale onPress={() => router.push('/notifications')} hitSlop={10} style={styles.iconBtn}>
            <Text style={styles.iconTx}>🔔</Text>
            {unread > 0 ? <View style={styles.dot} /> : null}
          </PressableScale>
          <PressableScale onPress={() => router.push('/settings')} hitSlop={10} style={styles.iconBtn}>
            <Text style={styles.iconTx}>⚙︎</Text>
          </PressableScale>
        </View>
      </View>
      {/* 인사말 — 대표 명식이 있으면 이름을 부르고, 없으면 앱 이름을 세운다(빈 자리를 만들지 않는다). */}
      <Text style={styles.greeting}>{repName ? `${repName}님 반갑습니다.` : t('appName')}</Text>
      {/* 홈 상단 컨트롤 행(daniel 2026-07-25 J): [⠿ 홈 배치 편집] + [🧭 바로가기](만세력·AI코치 분기 메뉴).
          배치 편집 = 블록 순서 드래그(모달·내부 탭 충돌 회피). 바로가기 = 블록에서 뺀 만세력/코치로 진입. */}
      <View style={styles.topCtrlRow}>
        {isAdmin && (
          <PressableScale onPress={() => setEditOpen(true)} style={styles.editBtn} hitSlop={8}>
            <Text style={styles.editBtnTx}>⠿ 홈 배치 편집</Text>
          </PressableScale>
        )}
        <PressableScale onPress={() => setQuickOpen(true)} style={styles.editBtn} hitSlop={8}>
          <Text style={styles.editBtnTx}>⚡ 바로가기</Text>
        </PressableScale>
        {/* ★코인 잔액(daniel 2026-07-28 코인 전환) — 충전 화면 진입점.
            여기 둔 이유: 유료 풀이를 열기 전에 잔액을 미리 알 수 있어야 '부족' 알림이 놀람이 되지 않는다. */}
        {/* ★소셜 프루프(daniel 2026-07-27 IMG_8205 "바로가기 라인 우측에 작게") — 카드였던 걸 이 행 우측 한 줄로.
            카드는 블록 하나를 통째로 쓰면서 아래가 비어 균형이 깨져 있었다. 규모가 작으면 스스로 숨는다. */}
        <CommunityPulseInline />
      </View>

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
      {/* ★배너는 여기(고정 헤더)에서 **블록으로 이동**했다(daniel 2026-08-06) — renderBlock 의 'banner'.
          종전엔 헤더라 항상 오늘의 운세보다 위였고 순서도 못 바꿨다. */}
      {/* ★웹 첫 방문자 — 앱은 설치라는 문턱이 설명을 대신하지만 웹은 링크 하나로 들어온다.
          명식이 하나라도 생기면 사라진다(그때부턴 홈이 할 일이 있다). 네이티브에선 렌더 안 됨. */}
      {Platform.OS === 'web' && !hasChart && <WebLanding />}
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
            기본 순서(daniel 07-25) = 명식 → 오늘의 기운 → 나는 어떤 사람인가 → 나의 성격유형 → 오늘의 관계 → 바이오리듬 → 오늘의 행운. (만세력·AI코치는 상단 🧭 바로가기 메뉴)
            헤더/진행률 배너/로그인 링크는 '고정'이라 ListHeaderComponent/ListFooterComponent 로 뺀다(드래그 대상 아님). */}
        {twoCol ? (
          /* ★넓은 웹 — 블록을 **두 단**으로 흘린다(홀/짝 번갈아). 세로로만 쌓으면 데스크톱에서
             카드가 1160px 로 늘어나 '폰 앱을 늘려 놓은' 그 모양이 된다.
             ⚠️드래그는 여기 없다 — 길게 눌러 옮기는 건 **폰 제스처**다. 데스크톱에서 순서를 바꾸려면
               관리자 '배치 편집' 모달을 쓴다(이미 있는 경로라 새로 만들지 않았다). */
          <ScrollView
            style={styles.screen}
            contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(2) }]}
            showsVerticalScrollIndicator={false}
          >
            {listHeader}
            <View style={styles.webTwo}>
              {([0, 1] as const).map((side) => (
                <View key={side} style={styles.webCol}>
                  {order.filter((_, i) => i % 2 === side).map((k) => <View key={k}>{renderBlock(k)}</View>)}
                </View>
              ))}
            </View>
            {listFooter}
          </ScrollView>
        ) : (
        <DraggableFlatList
          data={order}
          keyExtractor={(k) => k}
          renderItem={renderItem}
          // ★배치 변경은 관리자만(daniel 2026-08-06 "UI 레이아웃 배치를 관리자에서만 컨트롤 가능하게").
          //   편집 버튼만 숨기면 **길게 눌러 드래그**로 여전히 순서가 바뀐다 — 저장 경로 자체를 막는다.
          onDragEnd={({ data }) => { if (isAdmin) setOrder(data); }}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          style={styles.screen}
          contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(2) }]}
          showsVerticalScrollIndicator={false}
        />
        )}
      </Animated.View>
      <HomeOrderEditModal visible={editOpen} onClose={() => setEditOpen(false)} />
      {/* 🧭 바로가기 메뉴(daniel 2026-07-25 J) — 만세력·AI 코치를 홈 블록에서 빼고 여기서 분기 진입. 배경 탭=닫힘(모달·리스트내 absolute 금지). */}
      <Modal statusBarTranslucent visible={quickOpen} transparent animationType="fade" onRequestClose={() => setQuickOpen(false)}>
        <Pressable style={styles.quickBackdrop} onPress={() => setQuickOpen(false)}>
          <Pressable style={styles.quickSheet} onPress={() => {}}>
            <Text style={styles.quickSheetTitle}>바로가기</Text>
            {hasChart && (
              <PressableScale style={styles.quickItem} onPress={() => { setQuickOpen(false); router.push('/charts'); }}>
                <Text style={styles.coachBannerEmoji}>📜</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.coachBannerTitle}>{t('menu.manse', '만세력')}</Text>
                  <Text style={styles.coachBannerSub} numberOfLines={1}>{t('home.manseSub', '내 사주 명식 전체 보기')}</Text>
                </View>
                <Text style={styles.coachBannerArrow}>›</Text>
              </PressableScale>
            )}
            <PressableScale style={styles.quickItem} onPress={() => { setQuickOpen(false); router.push('/coach'); }}>
              <Text style={styles.coachBannerEmoji}>💬</Text>
              <View style={{ flex: 1 }}>
                {/* 팔자 도우미로 전환(daniel 2026-07-30) — 종전 'AI 자기이해 코치'(LLM 생성)에서 콘텐츠 안내로 */}
                <Text style={styles.coachBannerTitle}>{t('assist.title', '우니')}</Text>
                <Text style={styles.coachBannerSub} numberOfLines={1}>{t('assist.sub', '보고 싶은 걸 말해 주세요. 바로 그 자리로 데려다 드려요.')}</Text>
              </View>
              <Text style={styles.coachBannerArrow}>›</Text>
            </PressableScale>
            {/* ★명식 등록(daniel 2026-07-27 "홈에서도 명식 등록 할 수 있으면 좋겠어").
                홈 상단 ChartPicker 는 daniel 이 07-25 에 직접 뺐으므로 되돌리지 않는다 —
                대신 그때 만든 이 바로가기 메뉴(홈 블록에서 뺀 것들의 집합소)에 등록 동선을 둔다.
                ★명식이 없을 땐 홈 배너 CTA 가 이미 등록으로 보내므로 여기선 중복 표시하지 않는다. */}
            {hasChart && (
              <PressableScale style={styles.quickItem} onPress={() => { setQuickOpen(false); router.push('/register'); }}>
                <Text style={styles.coachBannerEmoji}>＋</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.coachBannerTitle}>{t('home.quickRegister', '명식 등록')}</Text>
                  <Text style={styles.coachBannerSub} numberOfLines={1}>{t('home.quickRegisterSub', '가족·연인·친구의 명식을 추가해요')}</Text>
                </View>
                <Text style={styles.coachBannerArrow}>›</Text>
              </PressableScale>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, backgroundColor: 'transparent' }, // 전역 ContentBackdrop(오행 배경) 투과
  screen: { backgroundColor: 'transparent' },
  // 넓은 웹 2열 — 두 단이 각자 흐른다(높이가 달라도 옆 단을 기다리지 않는다)
  webTwo: { flexDirection: 'row', alignItems: 'flex-start', gap: space(5) },
  webCol: { flex: 1, minWidth: 0 },
  wrap: { padding: space(5), paddingBottom: space(24) }, // 헤더 숨김 → status bar 여백 확보
  // 홈 상단 컨트롤 행(배치 편집 + 바로가기) — 구분선 아래·subtle. marginBottom 은 행에서 한 번만.
  topCtrlRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexWrap: 'wrap', marginTop: -space(2), marginBottom: space(5) },
  // 홈 배치 편집/바로가기 버튼(pill). 탭 → HomeOrderEditModal(드래그) / 바로가기 메뉴.
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), backgroundColor: colors.overlay, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingVertical: space(1.5), paddingHorizontal: space(3.5) },
  editBtnTx: { color: colors.inkSoft, fontSize: 12, fontWeight: '700' },
  // 🧭 바로가기 메뉴(모달 시트) — 만세력·AI코치 분기(daniel 2026-07-25 J)
  quickBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: space(6) },
  quickSheet: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: space(5), gap: space(3), ...shadow.card },
  quickSheetTitle: { ...font.heading, color: colors.ink, fontWeight: '900', marginBottom: space(1) },
  quickItem: { flexDirection: 'row', alignItems: 'center', gap: space(3), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, paddingVertical: space(3.5), paddingHorizontal: space(4) },
  // ★타이틀 줄높이를 못박는다(daniel 2026-08-04 "운이랑 아래 서브타이틀 사이 간격이 너무 커").
  //   font.display 엔 lineHeight 가 없어 전역 보정이 넉넉한 기본 줄높이(≈fontSize×1.5)를 넣었고,
  //   그 여백이 글자 아래에 그대로 남아 서브타이틀과 벌어져 보였다. 간격은 marginTop 으로만 준다.
  title: { ...font.display, lineHeight: 34, textAlign: 'left' as const }, // ★좌측 못박기(daniel 07-02)
  // 헤더 행 — 전체를 살짝 아래로(타이틀 너무 위 방지), 👤 아이콘만 좌측 타이틀·서브 컬럼 기준 y축 가운데(daniel 07-02)
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space(4) },
  headerSide: { flex: 1, flexDirection: 'row', alignItems: 'center' },   // 로고를 정확히 가운데 두려면 양옆 폭이 같아야 한다
  headerIcons: { justifyContent: 'flex-end', gap: space(2) },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  brandMark: { width: 44, height: 44 },
  iconTx: { fontSize: 20, color: colors.ju },
  dot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5484D' },
  // 시안 인사말 — 화면에서 두 번째로 큰 글자(첫째는 점수). 가운데 정렬·아주 굵게.
  greeting: { fontSize: 22, lineHeight: 30, fontWeight: '900', color: colors.ink, textAlign: 'center', marginTop: space(3), marginBottom: space(5), letterSpacing: -0.3 },
  accountBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.ju, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.juSoft, marginRight: space(2), marginBottom: space(1) },
  accountIcon: { fontSize: 20 },
  sub: { ...font.body, color: colors.inkSoft, marginTop: space(1), textAlign: 'left' as const }, // ★좌측 못박기(daniel 07-02)
  divider: { width: 44, height: 3, borderRadius: 2, backgroundColor: colors.ju, marginTop: space(4), marginBottom: space(6) },
  // ★크기 축소(daniel 2026-08-06 "홈 아래쪽에 배너가 살짝 보여야 해 — 오늘의 운세 사이즈를 조금 줄여").
  //   첫 화면이 오늘의 운세로 꽉 차 **다음 블록(배너)이 화면 밖**에 있었다 = 아래에 뭔가 더 있다는 신호가 0.
  //   내용을 지우지 않고 **여백만** 줄였다(정보 손실 없이 다음 블록의 머리가 걸치게).
  // ★2026-08-19 `juSoft` → 투명. 시뮬에서 재 보니 이 면(金 #EDEDED)이 페이지 배경(#E8E9E9)과
  //   **대비 1.039** 로 사실상 구분이 안 됐다(시안은 흰 카드 vs 배경 = 1.216).
  //   안에 든 `ScoreCard` 가 이미 흰 카드라 여기서 또 면을 깔면 **카드가 겹쳐 보인다** — 감싸기만 한다.
  fortuneBanner: { marginBottom: space(1) },
  // ★AI 자기이해 코치 진입 배너(홈 상단·4.3 대화형 도구)
  coachBanner: { flexDirection: 'row', alignItems: 'center', gap: space(3), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, paddingVertical: space(3.5), paddingHorizontal: space(4), marginBottom: space(6), ...shadow.card },
  coachBannerEmoji: { fontSize: 22 },
  coachBannerTitle: { ...font.body, color: colors.ink, fontWeight: '800' },
  coachBannerSub: { ...font.caption, color: colors.inkSoft, marginTop: 1 },
  coachBannerArrow: { fontSize: 22, color: colors.ju, fontWeight: '800' },
  // 오늘/내일 토글(배너 상단)
  dayToggle: { flexDirection: 'row', gap: space(2), marginBottom: space(2) },
  dayTogChip: { paddingHorizontal: space(4), paddingVertical: space(1.5), borderRadius: radius.pill, backgroundColor: colors.overlay, borderWidth: 1, borderColor: colors.line },
  dayTogChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  dayTogTx: { fontSize: 13, fontWeight: '800', color: colors.inkSoft },
  // ★`#15132E`(옛 미드나잇 네이비) → `colors.onJu` (2026-08-19).
  //   이 글자는 **`colors.ju` 배경 위**에 올라간다. 팔레트가 파스텔 5색으로 바뀌면서
  //   대비가 **2.23~2.86**(기준 4.5)으로 떨어졌다 — 선택된 칩의 글자가 거의 안 보였다.
  //   `onJu`(흰색)면 다섯 오행 전부 6.3~8.1 로 통과한다(계산). ⚠️강조색 위 글자는 반드시 `onJu`.
  dayTogTxOn: { color: colors.onJu },
  bannerDate: { ...font.caption, color: colors.inkSoft },
  bannerPillar: { ...font.heading, color: colors.ink, flexShrink: 1 },
  // ★큰 글자에서 한 줄에 다 못 들어가 밀려 잘리던 행 — 줄바꿈 허용 + 라벨 축소 가능(daniel 07-28)
  bannerPillarRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2), marginTop: space(1.5), flexWrap: 'wrap' },
  gzBoxRow: { flexDirection: 'row', gap: space(1) },
  gzBox: { borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  gzBoxTx: { fontSize: 20, fontWeight: '800', lineHeight: 24 },
  bannerHeadline: { ...font.body, color: colors.ju, fontWeight: '800', fontSize: 16, marginTop: space(2) }, // 오늘의 기운을 아우르는 캐치 타이틀
  bannerProse: { ...font.body, color: colors.inkSoft, marginTop: space(1), lineHeight: 21 },
  bannerMore: { ...font.caption, color: colors.ju, fontWeight: '700', marginTop: space(2) },
  // ── 기운 판정(별도 카드에서 통합·daniel 07-19): 점수·등급·유형명·근거·신살 칩 ──
  // ★시안(니운내운.pdf p04) — **점수가 화면에서 가장 큰 글자**다. 24 → 40 으로 올리고,
  //   등급 칩은 옆이 아니라 **숫자 아래**로 내려 '숫자 + 그 뜻'이 한 덩어리로 읽히게 했다.
  //   (옆에 두면 40px 숫자와 11px 칩이 같은 줄에서 baseline 이 어긋나 지저분해진다.)
  todayLeft: { flex: 1, minWidth: 0 },                                       // 좌측 열(간지·유형명·설명) — minWidth:0 이라야 긴 글이 줄바꿈된다
  gzHeadRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },   // 「오늘의 운세」 + 간지 두 칸
  scoreWrap: { alignItems: 'flex-end', gap: space(1) },   // 우측 열 — flex 로 나뉘므로 marginLeft:auto 는 필요 없다
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  scoreTx: { fontSize: 40, lineHeight: 46, fontWeight: '900', letterSpacing: -1.5 },
  scoreUnit: { ...font.caption, color: colors.inkFaint },
  cautionPill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space(2), paddingVertical: space(0.5), alignSelf: 'center' },
  cautionTx: { fontSize: 11, fontWeight: '800' },
  energyName: { color: colors.ink, fontWeight: '900' },
  energyDesc: { color: colors.inkSoft, marginTop: 2 },   // ★lineHeight 는 인라인에서 fs() 로(고정값이 잘림 원인이었다)
  energyReason: { ...font.body, color: colors.inkSoft, marginTop: space(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(1.5) },
  chip: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space(2.5), paddingVertical: space(1), maxWidth: '100%' },
  chipGood: { backgroundColor: colors.juSoft, borderColor: colors.juLine },
  chipCare: { backgroundColor: colors.overlay, borderColor: colors.line },
  chipTx: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  chipTxGood: { color: colors.ju },
  authRow: { marginTop: space(8), marginBottom: space(4), alignItems: 'center' },
  linkText: { color: colors.ju, fontSize: 14 },
});
