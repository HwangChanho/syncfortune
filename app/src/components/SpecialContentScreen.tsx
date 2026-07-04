// app/src/components/SpecialContentScreen.tsx — 심층 콘텐츠 공통 화면(뿌리·비치는 나·사명 등)
// ─────────────────────────────────────────────────────────────────────────
// love.tsx 패턴 일반화(단일 책임): 프리미엄 자동생성 + 쿠폰/관리자 게이트 + UnlockOverlay + 영구 캐시.
//   각 콘텐츠 라우트(roots/image/mission)는 kind·제목·섹션 + 시각(heroMotif/themeColor/heroImage)만 주입한다.
//   ★보는 맛(daniel 2026-06): 상단 ContentHero(SVG 모티프 + 타이틀 애니 + 이미지 슬롯) + 섹션 순차 등장(stagger).
//   needsZiwei=true 면 자미두수 명반을 body 로 전달(사명=사주 主 + 자미 보조 교차).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Animated, Easing } from 'react-native';
import { PressableScale } from './PressableScale';
import { ExpiryNote } from './ExpiryNote'; // 보유 만료일 공통(프리미엄 가드 한 곳)
import { Image as ExpoImage } from 'expo-image'; // 콘텐츠 배너 — 자동 다운샘플·디스크캐시(daniel: 이미지 프리로드/캐시). 홈카드와 같은 파일 캐시 공유 → 콘텐츠 진입 즉시
import { Alert } from '../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { computeChart } from '../lib/engine/engine';
import { loadRepChart, type SavedChart } from '../lib/engine/myChart';
import { ensureServerChartId } from '../lib/backend/prewarmReadings';
import { useAuth } from '../lib/useAuth';
import { useSubscription } from '../lib/billing/subscription';   // 프리미엄=자동 생성
import { isPremiumForChart } from '../lib/billing/premiumStore'; // 명식별 프리미엄(premiumCovered 콘텐츠 = 프리미엄 무료해제·자동생성)
import { useFontScale } from '../lib/ui/fontScale';
import { waitForCreditGrant, type CreditKind } from '../lib/billing/coupons'; // C1: 결제 후 웹훅 적립 폴링(차감은 Edge 서버 게이트)
import { isUnlocked, markUnlocked } from '../lib/billing/unlocks'; // isUnlocked=무차감 재열람 힌트 / markUnlocked=생성 성공 후 캐시 힌트(C3 part2 — 게이트 아님)
import { ShareReadingButton } from './ShareReadingButton'; // 이슈17: 풀이 결과 공유
import { TTSButton } from './TTSButton'; // daniel: 풀이 음성 읽기(온디바이스 TTS·무료)
import { purchaseCreditRC, purchasesEnabled } from '../lib/billing/purchases'; // 즉시 구매(마켓 안 거치고 바로)
import { isAdmin } from '../lib/core/admin';                  // 스페셜 = 관리자 바로 / 그 외 쿠폰(크레딧)
import { requireLoginForPurchase } from '../lib/billing/requireLogin';
import { confirmReadingChart } from '../lib/ui/confirmChart'; // 생성 전 명식 확인 + 보유 이용권 안내(daniel)
import { assertOnline } from '../lib/backend/network';
import { supabase } from '../lib/supabase';
import { appLang } from '../lib/i18n';
import { readingFromInvoke } from '../lib/backend/interpretResult'; // 방어: Edge 응답 정규화(일시적 불가·결제필요·오류)
import { logEvent } from '../lib/backend/logger';
import { setGenProgress } from '../lib/backend/genProgress'; // 일회성 진행도(daniel 이슈15)
import { colors, radius, space, shadow, font } from '../lib/theme';
import { UnlockOverlay } from './UnlockOverlay';         // unlock 자물쇠 애니 + 그 사이 LLM
import { ChartPicker } from './ChartPicker';             // 상단 명식 헤더 — 현재 적용 명식 표시·전환

export type Section = { key: string; label: string; groupTitle?: string }; // groupTitle: 이 섹션 카드 위에 그룹 구분 헤더(divider) 표시(daniel: 별자리/점성술 섹터 분리)

// kind별 기본 히어로 이미지(daniel: 모든 콘텐츠 히어로에 이미지 — 세로 카드아트도 1.75 박스 cover-crop 시 중앙 띠가 꽉 참, 시뮬 확인).
//   heroImage prop 명시 시 그게 우선(roots/image/mission = 전용 가로 hero-*.jpg). 없으면 이 맵 폴백.
const HERO_BY_KIND: Record<string, any> = {
  daily: require('../../assets/icons/today.jpg'), monthly: require('../../assets/icons/month.jpg'), dayPillar: require('../../assets/icons/dayPillar.jpg'),
  astrology: require('../../assets/icons/astrology.jpg'), bok: require('../../assets/icons/bok.jpg'), career: require('../../assets/icons/career.jpg'), celeb: require('../../assets/icons/celeb.jpg'),
  dream: require('../../assets/icons/dream.jpg'), egen: require('../../assets/icons/egen.jpg'), healing: require('../../assets/icons/healing.jpg'),
  joseonjob: require('../../assets/icons/joseonjob.jpg'), lifegraph: require('../../assets/icons/lifegraph-hero.jpg'), love: require('../../assets/icons/love-hero.jpg'),
  lovestyle: require('../../assets/icons/lovestyle.jpg'), luck: require('../../assets/icons/luck.jpg'), mbti: require('../../assets/icons/mbti.jpg'),
  name: require('../../assets/icons/name.jpg'), newyear: require('../../assets/icons/newyear-hero.jpg'), numerology: require('../../assets/icons/numerology.jpg'),
  pastlife: require('../../assets/icons/pastlife.jpg'), persona: require('../../assets/icons/persona.jpg'), pet: require('../../assets/icons/pet.jpg'),
  taegil: require('../../assets/icons/taegil.jpg'), talent: require('../../assets/icons/talent.jpg'), zodiac: require('../../assets/icons/zodiac.jpg'),
  child: require('../../assets/icons/child.jpg'), future10: require('../../assets/icons/future10.jpg'),
};

export function SpecialContentScreen({ kind, category = kind, title, sub, sections, needsZiwei = false, genMsg, heroMotif, themeColor = colors.ju, heroImage, buildBody, freePreview, freeHook, showExpiry = false, premiumCovered = false, headerExtra, autoGen = true }: {
  kind: CreditKind;        // 이용권/unlock 키(roots·image·mission). 크레딧 단위.
  category?: string;       // 캐시·Edge category(기본=kind). daniel B 유명인: 인물별 celeb_{id}로 분리(크레딧은 kind='celeb' 공용).
  title: string;
  sub: string;
  sections: Section[];     // 응답 JSON 키 ↔ 라벨(순서대로 카드)
  needsZiwei?: boolean;    // 자미 명반을 body 로 전달(사명)
  genMsg: string;          // 생성 중 오버레이 메시지
  heroMotif?: ReactNode;   // 상단 SVG 모티프(나무·오라·별자리)
  themeColor?: string;     // 섹션 강조색(콘텐츠별 정체성)
  heroImage?: any;         // 히어로 배경 이미지(옵션 — 없으면 모티프만)
  buildBody?: (chart: SavedChart) => Record<string, any>; // 추가 body(수비학/점성술 = 앱이 산출한 차트를 Edge로 전달)
  freePreview?: (chart: SavedChart) => ReactNode; // 무료 티어(하이브리드) — 잠김 화면에 온디바이스 기본값 미리보기(수비학 생명수·점성술 빅3)
  freeHook?: (saju: any) => ReactNode; // ★무료 온디바이스 티저 — 히어로 바로 아래·잠김/열림 무관 항상 노출(유료 전환 후크). love.tsx의 LoveFlowGraph 배치를 공용화(재회 도화-충 달력 등). c.saju(+timeUnknown 관례 병합)를 넘겨받는다.
  showExpiry?: boolean;    // 유료 단일 풀이(roots·image·talent·mission)만 = 생성일+1년 '보유 만료일' 표시(daniel #25). 무료·소모성 콘텐츠는 미전달 → 숨김.
  premiumCovered?: boolean; // 프리미엄 포함 콘텐츠(자식운 등 프리미엄 5종) = 프리미엄 명식이면 무료 해제·자동생성. 기본 false(스페셜=관리자/크레딧 전용, 프리미엄 무관).
  autoGen?: boolean;         // 프리미엄/소유 시 자동 생성 여부(기본 true). ★자식운=false: 부부/단일을 고른 뒤 '풀이 보기'로 생성(자동생성 시 선택 기회 없음, daniel 07-03).
  headerExtra?: ReactNode;  // 콘텐츠별 상단 커스텀 컨트롤(히어로 아래·섹션/게이트 위, 옵션). 자식운 COUPLE 토글 등 — 잠김·열림 두 상태 모두 노출. 기본 undefined(대부분 콘텐츠는 변화 없음).
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const { fs } = useFontScale();
  const [savedChart, setSavedChart] = useState<SavedChart | null>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [reading, setReading] = useState<any>(null);
  const [expiry, setExpiry] = useState<string | null>(null); // 보유 만료일(생성일+1년) — showExpiry(유료 단일)일 때 캐시 created_at으로 채움(daniel #25)
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [owned, setOwned] = useState(false); // 소유(프리미엄/관리자/차감 unlock) — 미구매 차트 풀이 노출 차단(daniel ⓐ). 명식 변경 시 재판정.
  const [reloadKey, setReloadKey] = useState(0); // ChartPicker 로 대표 전환 시 재로드 트리거
  const [revealed, setRevealed] = useState(false); // 상태 뷰 경유(daniel 07-03): 소유(프리미엄/구매/관리자) 풀이도 바로 노출하지 않고 '이미 열려 있음' 상태 뷰를 먼저 보여준 뒤 '풀이 보기'로 공개. 명식/카테고리 변경 시 false 리셋 → 전환할 때마다 상태 뷰 재노출.
  const c = useMemo(() => (savedChart ? computeChart(savedChart.input) : null), [savedChart]);
  const gatingRef = useRef(false); // 게이트(모달) 연타 차단
  const reveal = useRef(new Animated.Value(0)).current; // 섹션 순차 등장

  // 대표 명식 → 서버차트ID → 캐시(category=kind) 조회. 프리미엄이고 캐시 없으면 자동 생성.
  useEffect(() => {
    let alive = true;
    setReading(null); setOwned(false); setExpiry(null); setRevealed(false); // 진입/명식 변경 시 초기화 — 미구매 차트가 직전 풀이로 새지 않게(daniel ⓐ) + 상태 뷰 재노출(revealed 리셋: 명식 전환 시 다시 상태 뷰부터, daniel 07-03)
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setSavedChart(ch);
      if (!ch || !session) { setLoaded(true); return; }
      const cc = computeChart(ch.input);
      const id = await ensureServerChartId(cc, ch.input, session, ch);
      if (!alive || !id) { setLoaded(true); return; }
      setChartId(id);
      // 소유 판정(daniel ⓐⓒ): (premiumCovered면 프리미엄 명식) / 관리자 / 이 차트×종류 unlock(차감 완료) 중 하나여야 풀이 노출. 아니면 설명창(게이트).
      //   ★premiumCovered(자식운 등 프리미엄 포함 콘텐츠)만 프리미엄을 소유로 인정 — 스페셜(astrology/mission 등 기본값)은 프리미엄 무관(관리자/크레딧 전용) 그대로.
      const prem = premiumCovered && isPremiumForChart(id);
      const own = prem || (await isAdmin()) || (await isUnlocked(id, kind));
      const { data } = await supabase.from('readings').select('content, created_at').eq('chart_id', id).eq('category', category).eq('lang', appLang()).maybeSingle();
      if (!alive) return;
      const cached = data?.content ?? null;
      setOwned(own);
      setReading(cached);
      // 보유 만료일(daniel #25): 생성(구매)일 + 1년. 유료 단일 풀이(showExpiry)이고 캐시 created_at 있을 때만.
      if (showExpiry && data?.created_at) { const d = new Date(data.created_at); d.setFullYear(d.getFullYear() + 1); setExpiry(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`); }
      setLoaded(true);
      // 프리미엄=자동 생성(premiumCovered 한정): 프리미엄 명식이고 캐시 없으면 바로 생성. ★단 autoGen=false(자식운)면 자동생성 안 함 — 부부/단일을 고른 뒤 '풀이 보기'로 생성.
      if (alive && autoGen && prem && !cached) generate(id, cc.ziwei);
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isPremium, reloadKey, category]);

  // 통변 도착(캐시·생성 완료) → 섹션 순차 등장 애니 시작
  useEffect(() => {
    if (reading && !reading.error) {
      reveal.setValue(0);
      Animated.timing(reveal, { toValue: 1, duration: 500 + sections.length * 110, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading]);

  // invoke 타임아웃/실패 시 readings 캐시를 폴링해 결과 회수(Edge가 서버에서 계속 생성·캐시하므로).
  //   무거운 풀이(별자리=사주+점성+수비 3계층 등)는 Edge 생성이 87~103s → 클라 invoke가 먼저 끊겨도('Failed to send request')
  //   서버는 완료·캐시함. 그 캐시를 폴링해 로딩 유지한 채 결과를 받아온다(멈춤·"갑자기 완료" 해결, daniel 07-02).
  async function pollCachedReading(id: string, maxMs = 135000, everyMs = 3500): Promise<any | null> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, everyMs));
      const { data } = await supabase.from('readings').select('content').eq('chart_id', id).eq('category', category).eq('lang', appLang()).maybeSingle();
      if (data?.content) return data.content;
    }
    return null;
  }

  // 순수 생성(LLM) — 게이트는 Edge(SERVER_GATED consume_credit / effPrem)가 권위. idArg/ziweiArg = 자동생성용(state 갱신 전 직접 전달).
  //   ★C3 part2(daniel 2026-07-03): 클라는 이용권을 차감하지 않는다 — Edge 가 1회 차감/판정(이중차감 제거).
  //   이용권 없으면 Edge 가 needPayment(200) 반환 → 구매 플로우(promptPurchase)로 유도. 생성 성공 시에만
  //   markUnlocked(캐시 힌트) — 게이트가 아니라 재열람 시 owned 표시·재차감 없음.
  async function generate(idArg?: string, ziweiArg?: any) {
    const id = idArg ?? chartId;
    if (!id || busy) return;
    setBusy(true);
    setOwned(true); // 낙관적: 생성 진행 = 소유 표시(생성 애니). needPayment 면 아래에서 되돌림.
    setGenProgress({ active: true, total: 1, done: 0, label: title, route: ('/' + kind) }); // 일회성 진행도(daniel 이슈15) — '풀이 중'
    logEvent(`${kind}_invoke_start`, { chartId: id });
    try {
      const body: any = { chartId: id, category, kind, tier: 'paid', lang: appLang() };
      if (needsZiwei) body.ziwei = ziweiArg ?? c?.ziwei; // 사명 = 자미 보조 교차
      if (buildBody && savedChart) Object.assign(body, buildBody(savedChart)); // 수비학/점성술 = 앱 산출 차트(numerologyChart/natalChart)
      const { data, error } = await supabase.functions.invoke('interpret', { body });
      // ★C3 part2: 서버 게이트가 이용권 없음 판정 → needPayment(200) → 소유 되돌리고 구매 플로우(에러 표시 아님).
      if ((data as any)?.needPayment || (data as any)?.needPremium) {
        setOwned(false); setBusy(false); setGenProgress({ route: ('/' + kind), active: false });
        logEvent(`${kind}_need_payment`, { chartId: id });
        promptPurchase(id);
        return;
      }
      if (error || !data) {
        // ★클라 invoke가 끊겨도(무거운 풀이 타임아웃) Edge는 서버에서 완료·캐시 → 캐시 폴링으로 회수(로딩 유지).
        logEvent(`${kind}_invoke_error`, { message: error?.message ?? 'no data', polling: true }, 'error');
        const cached = await pollCachedReading(id);
        if (cached) { setReading(cached); await markUnlocked(id, kind); } // 서버가 완료·캐시 = 생성 성공(차감됨) → 캐시 힌트
        else setReading(readingFromInvoke(data, error));
      } else if ((data as any)?.unavailable) {
        logEvent(`${kind}_unavailable`, { retryAt: (data as any)?.retryAt }, 'error'); // 방어: LLM 일시적 불가(미차감·재시도)
        setReading(readingFromInvoke(data, error));
      } else {
        setReading(readingFromInvoke(data, error)); // 정상 도착
        await markUnlocked(id, kind); // ★생성 성공 = 캐시 힌트(재열람 시 owned·무료 재열람). 게이트 아님.
      }
    } catch (e) {
      // fetch throw(타임아웃 등)도 동일 — 서버가 완료·캐시했으면 폴링으로 회수, 아니면 오류 표시.
      logEvent(`${kind}_invoke_throw`, { message: (e as Error).message }, 'error');
      const cached = await pollCachedReading(id);
      if (cached) { setReading(cached); await markUnlocked(id, kind); } // 서버 완료·캐시 = 성공 → 캐시 힌트
      else setReading({ error: (e as Error).message });
    }
    setGenProgress({ route: ('/' + kind), done: 1, total: 1 }); // 완료 → 홈 배너 '풀이 보기' 이동버튼(daniel 이슈15)
    setBusy(false);
  }

  // 생성 전 '이 명식으로 풀이할지' 확인(+보유 이용권) → 확인 시 doStart(daniel 07-02).
  function onStart() {
    if (!chartId || busy || gatingRef.current) return;
    void confirmReadingChart({ chartLabel: savedChart?.label, creditKind: kind as any, t, onConfirm: () => { void doStart(); } });
  }
  // 게이트(★C3 part2·daniel 2026-07-03 — Edge 단일 권위): 프리미엄=바로 / 관리자=바로 / 이미 언락=바로 / 그 외=로그인 후 생성.
  //   ⚠️ 클라는 더 이상 useCredit 로 차감하지 않는다 — Edge(SERVER_GATED)가 이용권을 1회 차감/판정(이중차감 제거).
  //   크레딧 있으면 Edge 가 차감·생성 / 없으면 needPayment → generate 가 구매 플로우(promptPurchase)로 유도.
  async function doStart() {
    if (!chartId || busy || gatingRef.current) return;
    logEvent(`${kind}_generate_tap`, { chartId });
    if (!assertOnline(t)) return;
    // 무차감 통과: 프리미엄(premiumCovered 명식) / 이미 언락(구매·생성 완료) → 바로 생성(재차감 없음).
    if (premiumCovered && isPremiumForChart(chartId)) { generate(chartId); return; }
    if (await isUnlocked(chartId, kind)) { generate(chartId); return; }
    gatingRef.current = true;
    let proceed = false;
    try {
      // 관리자 = 무료(Edge god 도 통과) / 그 외 = 로그인만 보장(결제=계정 귀속). 차감·판정은 Edge.
      if (await isAdmin()) proceed = true;
      else proceed = requireLoginForPurchase(session, () => router.push('/login'), t);
    } catch (e) { logEvent(`${kind}_gate_error`, { message: (e as Error).message }, 'error'); }
    finally { gatingRef.current = false; }
    if (proceed) generate(chartId); // Edge 가 이용권 차감/판정 → 없으면 generate 안에서 needPayment → promptPurchase
  }

  // 구매 유도 — 서버 게이트(Edge)가 needPayment 를 반환했을 때만 호출(클라 차감 없음).
  //   바로 구매: 결제 → 웹훅 적립 폴링(C1) → 재생성(Edge 가 1회 차감) / 또는 마켓 이동. id = 재생성 대상 명식.
  function promptPurchase(id?: string) {
    Alert.alert(title, t('special.needPayMsg', '이용권이 필요해요. 바로 구매하거나 마켓에서 받을 수 있어요.'), [
      { text: t('special.buyNow', '바로 구매'), onPress: async () => {
          if (!purchasesEnabled()) { Alert.alert(title, t('market.payPending', '결제 준비 중이에요. 쿠폰을 이용하거나 잠시 후 다시 시도해 주세요.')); return; }
          try {
            const ok = await purchaseCreditRC(kind); if (!ok) return;   // 결제 취소=false(조용히)
            // ★C1 보안(daniel 07-03): 클라 grant/차감 폐지 → 영수증 검증된 웹훅이 적립. 반영까지 폴링 후 재생성(Edge 가 1회 차감).
            const { granted } = await waitForCreditGrant(kind);
            if (granted) generate(id);
            else Alert.alert(title, t('special.applyPending', '결제가 완료됐어요. 적용까지 잠시 걸릴 수 있어요. 잠시 후 다시 시도해 주세요.'));
          } catch (e) { Alert.alert('!', (e as Error).message); }
        } },
      { text: t('special.goMarket', '마켓에서 보기'), onPress: () => router.push('/market') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }

  const bodyDyn = { fontSize: fs(15), lineHeight: fs(25) };
  // 동적 폰트 스케일이 필요한 StyleSheet 정적값 대체 — StyleSheet.create는 렌더 밖이라 fs()를 직접 쓸 수 없음.
  const dynStyles = {
    secLabel:    { fontSize: fs(16) },
    groupTitle:  { fontSize: fs(18), lineHeight: fs(26) },
    err:         { fontSize: fs(13) },
    msg:         { fontSize: fs(15) },                       // font.body 기본값
    gateTitle:   { fontSize: fs(17) },                       // font.heading 기본값
    gateDesc:    { fontSize: fs(15), lineHeight: fs(22) },   // font.body + lineHeight
    gateNote:    { fontSize: fs(12) },                       // font.caption 기본값
    previewHead: { fontSize: fs(13) },
    previewItem: { fontSize: fs(14), lineHeight: fs(24) },
    ctaTx:       { fontSize: fs(16) },
  };
  const n = sections.length;

  if (!loaded) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (!savedChart) return (
    <View style={styles.center}>
      <Text style={[styles.msg, dynStyles.msg]}>{t('manse.empty')}</Text>
      <PressableScale style={styles.cta} onPress={() => router.push('/register')}><Text style={[styles.ctaTx, dynStyles.ctaTx]}>{t('compat.registerMyChart')}</Text></PressableScale>
    </View>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* 상단 명식 헤더 — 현재 적용된 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단). 전환 시 그 명식 기준 재로드 */}
      <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
      {/* child/child_couple(자녀운)만 전용 테마 영상 — 그 외 스페셜(roots·image·mission·talent·astrology·future10 등)은 videoKey 미지정=기본 링+자물쇠 */}
      <UnlockOverlay visible={busy} message={genMsg} videoKey={(kind === 'child' || kind === 'child_couple') ? 'child' : undefined} />
      <ContentHero motif={heroMotif} image={heroImage ?? HERO_BY_KIND[kind]} title={title} sub={sub} themeColor={themeColor} />

      {/* ★무료 온디바이스 티저(재회 도화-충 달력 등) — 히어로 바로 아래·항상 노출(잠김/열림 무관). 유료 풀이는 이 아래.
          love.tsx가 <LoveFlowGraph>를 히어로 아래 항상 노출하는 배치를 공용화. c.saju에 timeUnknown을 코드베이스 관례(prewarm/Reading)와 동일하게 병합해 전달(클라 computeChart 산출물엔 timeUnknown이 없음). */}
      {freeHook && c?.saju ? freeHook({ ...c.saju, timeUnknown: savedChart?.input?.timeAccuracy === '미상' }) : null}

      {/* 콘텐츠별 상단 커스텀 컨트롤(옵션) — 히어로 아래·상태 뷰/게이트 위. ★풀이를 실제로 공개(revealed)한 뒤엔 숨김 — 상태 뷰·게이트(공개 前)에서는 계속 노출(자식운 COUPLE 토글은 생성 前에만 의미, daniel 07-03). */}
      {!(reading && owned && revealed) && headerExtra}

      {reading?.error ? (
        <View style={styles.card}><Text style={[styles.err, dynStyles.err]}>{String(reading.error)}</Text></View>
      ) : (owned && !revealed) ? (
        // ★상태 뷰(daniel 07-03): 소유(프리미엄/구매/관리자) 풀이라도 바로 노출하지 않고
        //   '이미 열려 있음 + (일반 계정) 만료일' 상태를 먼저 보여준 뒤 '풀이 보기'로 공개(관리 편의·구매이력 인지).
        //   reading 유무와 무관하게 진입 — 캐시가 있으면 '풀이 보기'가 즉시 공개, 없으면 생성까지 트리거(소유 경로라 재차감 없음).
        <View style={[styles.card, styles.gate, { borderColor: themeColor }]}>
          <Text style={[styles.gateTitle, dynStyles.gateTitle]}>{t('special.ownedTitle', '이미 열려 있는 풀이예요')}</Text>
          {/* 상태 라인 — 프리미엄 명식=무제한(골드) / 그 외(구매·관리자)=만료일(showExpiry+expiry 있으면) 또는 '구매한 풀이'. 만료 포맷=ExpiryNote와 동일한 expiry 값(생성일+1년 YYYY.MM.DD) 재사용. */}
          {premiumCovered && isPremiumForChart(chartId) ? (
            <Text style={[styles.ownedStatus, dynStyles.gateDesc, { color: colors.gold }]}>{t('special.ownedUnlimited', '프리미엄 · 무제한 이용')}</Text>
          ) : (showExpiry && expiry) ? (
            <Text style={[styles.ownedStatus, dynStyles.gateDesc]}>{t('special.ownedUntil', { date: expiry, defaultValue: '{{date}}까지 볼 수 있어요' })}</Text>
          ) : (
            <Text style={[styles.ownedStatus, dynStyles.gateDesc]}>{t('special.ownedBought', '구매한 풀이예요')}</Text>
          )}
          {/* '풀이 보기' — revealed 전환(캐시 즉시 공개). 캐시 없으면 onStart(소유 경로: 프리미엄/unlock/관리자 → generate만, 재차감 없음)로 생성까지 트리거. */}
          <PressableScale style={[styles.cta, { backgroundColor: themeColor }]} onPress={() => { setRevealed(true); if (!reading) onStart(); }}>
            <Text style={[styles.ctaTx, dynStyles.ctaTx]}>{t('special.viewCta', '풀이 보기')}</Text>
          </PressableScale>
        </View>
      ) : (reading && owned && revealed) ? (
        <>
        {/* 풀이 보유 만료일(daniel #25) — 캐시(생성된 풀이) + 유료 단일(showExpiry)일 때만. 소모성·무료는 showExpiry 미전달이라 미노출. */}
        <ExpiryNote expiry={showExpiry ? expiry : null} chartId={chartId} />
        {/* 이슈19 소제목 — 통변 결과 headline 있으면 섹션들 맨 위에 한 줄 강조(콘텐츠 테마색) */}
        {typeof reading.headline === 'string' && reading.headline.trim() ? (
          <Text style={{ fontSize: fs(19), fontWeight: '800', color: themeColor, marginBottom: space(3), lineHeight: fs(26) }}>{reading.headline}</Text>
        ) : null}
        {sections.map((s, i) => (typeof reading[s.key] === 'string' && reading[s.key] ? (
          <View key={s.key}>
            {/* 그룹 구분 헤더(daniel: 별자리/점성술 섹터 분리) — groupTitle 있으면 카드 위 divider+제목 */}
            {s.groupTitle ? <Text style={[styles.groupTitle, { color: themeColor }, dynStyles.groupTitle]}>{s.groupTitle}</Text> : null}
            <Animated.View style={[styles.card, { borderLeftColor: themeColor }, styles.cardAccent, cardAnim(reveal, i, n)]}>
              <Text style={[styles.secLabel, { color: themeColor }, dynStyles.secLabel]}>{s.label}</Text>
              <Text style={[styles.body, bodyDyn]}>{reading[s.key]}</Text>
            </Animated.View>
          </View>
        ) : null))}
        {/* daniel(2026-06-24): 풀이 음성으로 듣기(온디바이스 TTS·무료) */}
        <TTSButton reading={reading} sections={sections} />
        {/* 이슈17: 이 풀이 공유(앱 설치자만 열람) — roots/image/mission 등 공통 */}
        <ShareReadingButton kind={kind} title={title} content={reading} />
        </>
      ) : (
        // 잠김(미생성) — 스페셜은 쿠폰(이용권)/관리자로 unlock(결제 미연동)
        <View style={[styles.card, styles.gate, { borderColor: themeColor }]}>
          <Text style={[styles.gateTitle, dynStyles.gateTitle]}>{title}</Text>
          <Text style={[styles.gateDesc, dynStyles.gateDesc]}>{sub}</Text>
          {/* 무료 티어(하이브리드) — 온디바이스 기본값 먼저 보여주고(API 0) 심층은 유료로 유도(daniel) */}
          {freePreview && savedChart ? freePreview(savedChart) : null}
          {/* 미리보기 — 사람들이 궁금해할 핵심 항목들을 보여주고 unlock 유도(daniel) */}
          <View style={styles.previewBox}>
            <Text style={[styles.previewHead, { color: themeColor }, dynStyles.previewHead]}>{t('special.previewHead', '이런 걸 풀어드려요')}</Text>
            {sections.filter((s) => s.key !== 'summary').map((s) => <Text key={s.key} style={[styles.previewItem, dynStyles.previewItem]}>· {s.label}</Text>)}
          </View>
          {/* owned(프리미엄/관리자/unlock)면 '풀이 보기'(구매 아님) — 자식운은 위 토글로 단일/부부 고른 뒤 이 버튼으로 생성(daniel 07-03) */}
          <PressableScale style={[styles.cta, { backgroundColor: themeColor }]} onPress={onStart}><Text style={[styles.ctaTx, dynStyles.ctaTx]}>{owned ? t('special.viewCta', '풀이 보기') : t('special.unlockCta', '구매하고 보기')}</Text></PressableScale>
          {!owned ? <Text style={[styles.gateNote, dynStyles.gateNote]}>{t('special.unlockHint', '이용권 구매 또는 쿠폰으로 열려요')}</Text> : null}
        </View>
      )}
    </ScrollView>
  );
}

// 섹션 순차 등장(stagger) — index 기반으로 reveal 진행을 잘라 카드별 딜레이. love/newyear 등 다른 화면도 재사용.
export function cardAnim(reveal: Animated.Value, i: number, n: number) {
  const start = i / (n + 1), end = (i + 1) / (n + 1);
  return {
    opacity: reveal.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: reveal.interpolate({ inputRange: [start, end], outputRange: [16, 0], extrapolate: 'clamp' }) }],
  };
}

// 상단 히어로 — SVG 모티프(+선택적 이미지 배경) + 타이틀/부제 페이드인. love/newyear 등 다른 화면도 재사용(export).
export function ContentHero({ motif, image, title, sub, themeColor = colors.ju }: { motif?: ReactNode; image?: any; title: string; sub: string; themeColor?: string }) {
  const { fs } = useFontScale();
  const a = useRef(new Animated.Value(0)).current;
  const kb = useRef(new Animated.Value(0)).current; // 히어로 켄번스(느린 줌 인↔아웃) — 정적 이미지에 생동(daniel 재미)
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [a]);
  useEffect(() => {
    if (!image) return; // 이미지 히어로만
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(kb, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(kb, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [kb, image]);
  const titleAnim = { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] };
  // ★이미지 히어로 = 어두운 배경 → 글씨 항상 밝게(onImage). plain(이미지 없음) = 밝은 카드 → 기본 ink.
  //   (라이트모드에서 어두운 히어로 이미지 위 ink(어두움) 글씨가 안 보이던 문제 — daniel 가시성 QA)
  const onImg = !!image;
  const inner = (
    <View style={styles.heroInner}>
      {!image && motif}
      <Animated.Text style={[styles.heroTitle, { fontSize: fs(22) }, onImg && { color: colors.onImage }, titleAnim]}>{title}</Animated.Text>
      <Animated.Text style={[styles.heroSub, { fontSize: fs(12), lineHeight: fs(19), opacity: a }, onImg && { color: colors.onImageSoft }]}>{sub}</Animated.Text>
    </View>
  );
  if (image) return (
    // 히어로 이미지 박스 = 이미지 비율(1344x768=1.75)에 맞춤 → cover가 좌우 안 자르고 풀이미지 중앙 노출(daniel: 이미지 가운데/가로 꽉)
    <View style={styles.heroImageBox}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: kb.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>
        <ExpoImage source={image} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" transition={150} />
      </Animated.View>
      <View style={styles.heroScrim} />
      {inner}
    </View>
  );
  return <View style={[styles.heroPlain, { borderColor: themeColor + '40' }]}>{inner}</View>; // 이미지 없을 때 = 컴팩트 헤더(aspectRatio 1.5 큰 빈 박스 제거·daniel)
}

// 무료 티어 미리보기 카드 — 온디바이스 결정론 기본값(수비학 생명수·점성술 빅3)을 키:값 줄로. 유료=LLM 심층(하이브리드 hook).
export function FreeBasics({ title, rows, color = colors.ju }: { title: string; rows: [string, string | number][]; color?: string }) {
  const { fs } = useFontScale();
  return (
    <View style={{ width: '100%', backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(4) }}>
      <Text style={{ fontSize: fs(13), fontWeight: '800', color, marginBottom: space(2), letterSpacing: 0.5 }}>{title}</Text>
      {rows.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space(1.5) }}>
          <Text style={{ ...font.body, color: colors.inkSoft, fontSize: fs(14) }}>{k}</Text>
          <Text style={{ ...font.body, color: colors.ink, fontSize: fs(16), fontWeight: '800' }}>{String(v)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(6), paddingBottom: space(12) }, // 콘텐츠 화면 좌우여백 통일(daniel) — space(6)
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
  // 히어로
  hero: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: space(5), aspectRatio: 1.5, backgroundColor: colors.sunk },
  // 이미지 히어로 = 단일 스타일(hero와 병합 금지 — aspectRatio 이중지정이 Yoga 폭 계산을 깨 좌치우침 유발). width 100%로 전폭·중앙(daniel 시뮬 실측 확인: 좌72=우72).
  heroImageBox: { width: '100%', aspectRatio: 1.75, borderRadius: radius.lg, overflow: 'hidden', marginBottom: space(5), backgroundColor: colors.sunk },
  heroPlain: { backgroundColor: colors.card, borderWidth: 1, borderRadius: radius.lg, marginBottom: space(5) }, // 이미지 없을 때 = 자동높이 컴팩트 헤더(큰 빈 박스 방지·daniel)
  heroImg: { borderRadius: radius.lg },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrimHero }, // 이미지 위 가독 스크림(스킴 무관 어둡게 — 이미지가 어두우므로 라이트모드에서도 어두운 스크림이라야 밝은 글씨가 산다)
  heroInner: { alignItems: 'center', justifyContent: 'center', paddingVertical: space(6), paddingHorizontal: space(5) },
  heroTitle: { ...font.title, color: colors.ink, marginTop: space(2), textAlign: 'center' },
  heroSub: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5), textAlign: 'center', lineHeight: 19 },
  // 섹션 카드(좌측 테마색 띠)
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  cardAccent: { borderLeftWidth: 3 },
  secLabel: { fontSize: 16, fontWeight: '800', marginBottom: space(2) },
  groupTitle: { fontSize: 18, fontWeight: '900', marginTop: space(6), marginBottom: space(3), paddingTop: space(4), borderTopWidth: 1, borderTopColor: colors.juLine }, // 섹터 구분 헤더(별자리/점성술 — daniel)
  body: { ...font.body, color: colors.ink },
  busyTx: { ...font.caption, color: colors.inkSoft, marginTop: space(2), textAlign: 'center' },
  err: { fontSize: 13, color: colors.ju },
  msg: { ...font.body, textAlign: 'center', marginBottom: space(5) },
  // 잠김 게이트(쿠폰 안내)
  gate: { alignItems: 'center', borderStyle: 'dashed', paddingVertical: space(7) },
  gateTitle: { ...font.heading, color: colors.ink, marginBottom: space(2) },
  gateDesc: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginBottom: space(5), lineHeight: 22 },
  gateNote: { ...font.caption, color: colors.inkFaint, marginTop: space(3) },
  ownedStatus: { ...font.body, color: colors.ink, fontWeight: '700', textAlign: 'center', marginBottom: space(5), lineHeight: 22 }, // 상태 뷰(daniel 07-03) 상태 라인 — 구매이력/만료일/무제한. 게이트 설명(inkSoft)보다 또렷하게(ink·700).
  // 미리보기 박스(잠긴 콘텐츠의 핵심 항목 목록)
  previewBox: { width: '100%', backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(5) },
  previewHead: { fontSize: 13, fontWeight: '800', marginBottom: space(2), letterSpacing: 0.5 },
  previewItem: { ...font.body, color: colors.inkSoft, lineHeight: 24, fontSize: 14 },
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), paddingHorizontal: space(7) },
  ctaTx: { color: colors.bg, fontWeight: '800', fontSize: 16 },
});
