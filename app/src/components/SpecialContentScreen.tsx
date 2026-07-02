// app/src/components/SpecialContentScreen.tsx — 심층 콘텐츠 공통 화면(뿌리·비치는 나·사명 등)
// ─────────────────────────────────────────────────────────────────────────
// love.tsx 패턴 일반화(단일 책임): 프리미엄 자동생성 + 쿠폰/관리자 게이트 + UnlockOverlay + 영구 캐시.
//   각 콘텐츠 라우트(roots/image/mission)는 kind·제목·섹션 + 시각(heroMotif/themeColor/heroImage)만 주입한다.
//   ★보는 맛(daniel 2026-06): 상단 ContentHero(SVG 모티프 + 타이틀 애니 + 이미지 슬롯) + 섹션 순차 등장(stagger).
//   needsZiwei=true 면 자미두수 명반을 body 로 전달(사명=사주 主 + 자미 보조 교차).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Animated, Easing } from 'react-native';
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
import { useFontScale } from '../lib/ui/fontScale';
import { useCredit, grantCredit, type CreditKind } from '../lib/billing/coupons';
import { isUnlocked, markUnlocked } from '../lib/billing/unlocks'; // unlock 영속(차감 후 재차감/재잠금 방지)
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
};

export function SpecialContentScreen({ kind, category = kind, title, sub, sections, needsZiwei = false, genMsg, heroMotif, themeColor = colors.ju, heroImage, buildBody, freePreview, showExpiry = false }: {
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
  showExpiry?: boolean;    // 유료 단일 풀이(roots·image·talent·mission)만 = 생성일+1년 '보유 만료일' 표시(daniel #25). 무료·소모성 콘텐츠는 미전달 → 숨김.
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
  const c = useMemo(() => (savedChart ? computeChart(savedChart.input) : null), [savedChart]);
  const gatingRef = useRef(false); // 게이트(모달) 연타 차단
  const reveal = useRef(new Animated.Value(0)).current; // 섹션 순차 등장

  // 대표 명식 → 서버차트ID → 캐시(category=kind) 조회. 프리미엄이고 캐시 없으면 자동 생성.
  useEffect(() => {
    let alive = true;
    setReading(null); setOwned(false); setExpiry(null); // 진입/명식 변경 시 초기화 — 미구매 차트가 직전 풀이로 새지 않게(daniel ⓐ)
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setSavedChart(ch);
      if (!ch || !session) { setLoaded(true); return; }
      const cc = computeChart(ch.input);
      const id = await ensureServerChartId(cc, ch.input, session, ch);
      if (!alive || !id) { setLoaded(true); return; }
      setChartId(id);
      // 소유 판정(daniel ⓐⓒ): 프리미엄 / 관리자 / 이 차트×종류 unlock(차감 완료) 중 하나여야 풀이 노출. 아니면 설명창(게이트).
      const own = isPremium || (await isAdmin()) || (await isUnlocked(id, kind));
      const { data } = await supabase.from('readings').select('content, created_at').eq('chart_id', id).eq('category', category).eq('lang', appLang()).maybeSingle();
      if (!alive) return;
      const cached = data?.content ?? null;
      setOwned(own);
      setReading(cached);
      // 보유 만료일(daniel #25): 생성(구매)일 + 1년. 유료 단일 풀이(showExpiry)이고 캐시 created_at 있을 때만.
      if (showExpiry && data?.created_at) { const d = new Date(data.created_at); d.setFullYear(d.getFullYear() + 1); setExpiry(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`); }
      setLoaded(true);
      if (isPremium && !cached) generate(id, cc.ziwei); // 프리미엄=자동 생성
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

  // 순수 생성(LLM) — 게이트 통과 후. idArg/ziweiArg = 자동생성용(state 갱신 전 직접 전달).
  async function generate(idArg?: string, ziweiArg?: any) {
    const id = idArg ?? chartId;
    if (!id || busy) return;
    setBusy(true);
    setOwned(true); // 생성 = 게이트 통과(프리미엄/차감/관리자) → 소유로 표시(daniel ⓐ)
    setGenProgress({ active: true, total: 1, done: 0, label: title, route: ('/' + kind) }); // 일회성 진행도(daniel 이슈15) — '풀이 중'
    logEvent(`${kind}_invoke_start`, { chartId: id });
    try {
      const body: any = { chartId: id, category, kind, tier: 'paid', lang: appLang() };
      if (needsZiwei) body.ziwei = ziweiArg ?? c?.ziwei; // 사명 = 자미 보조 교차
      if (buildBody && savedChart) Object.assign(body, buildBody(savedChart)); // 수비학/점성술 = 앱 산출 차트(numerologyChart/natalChart)
      const { data, error } = await supabase.functions.invoke('interpret', { body });
      if (error) logEvent(`${kind}_invoke_error`, { message: error.message }, 'error');
      else if ((data as any)?.unavailable) logEvent(`${kind}_unavailable`, { retryAt: (data as any)?.retryAt }, 'error'); // 방어: LLM 일시적 불가
      setReading(readingFromInvoke(data, error)); // 방어: 일시적 불가→친화 재시도 / 오류→원문 숨김
    } catch (e) { logEvent(`${kind}_invoke_throw`, { message: (e as Error).message }, 'error'); setReading({ error: (e as Error).message }); }
    setGenProgress({ route: ('/' + kind), done: 1, total: 1 }); // 완료 → 홈 배너 '풀이 보기' 이동버튼(daniel 이슈15)
    setBusy(false);
  }

  // 생성 전 '이 명식으로 풀이할지' 확인(+보유 이용권) → 확인 시 doStart(daniel 07-02).
  function onStart() {
    if (!chartId || busy || gatingRef.current) return;
    void confirmReadingChart({ chartLabel: savedChart?.label, creditKind: kind as any, t, onConfirm: () => { void doStart(); } });
  }
  // 게이트(서버 차감 통일·타 스페셜과 동일): 프리미엄=바로 / 관리자=바로 / 그 외 쿠폰 보유시만(결제 미연동).
  async function doStart() {
    if (!chartId || busy || gatingRef.current) return;
    logEvent(`${kind}_generate_tap`, { chartId });
    if (!assertOnline(t)) return;
    if (isPremium) { generate(chartId); return; }
    // unlock 영속(daniel): 이미 차감한 차트×종류면 재차감 없이 무료 재생성(invoke 중단 후 재진입 보호)
    if (await isUnlocked(chartId, kind)) { generate(chartId); return; }
    gatingRef.current = true;
    try {
      const admin = await isAdmin();
      if (!admin) {
        if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
        // 크레딧 1 차감(roots·image·mission 은 Edge 서버게이트가 아니라 여기서 차감) → 성공 시 unlock 도장.
        //   ★기존 버그 수정: 차감 없이 잔여 '확인'만 해서, 크레딧 1로 다른 차트까지 무한 생성됐음(수익 누수).
        if (await useCredit(kind)) { await markUnlocked(chartId, kind); }
        else {
          // 크레딧 없음 → '쿠폰으로 열기' 대신 바로 구매 또는 마켓 이동(daniel 2026-06)
          Alert.alert(title, t('special.needPayMsg', '이용권이 필요해요. 바로 구매하거나 마켓에서 받을 수 있어요.'), [
            { text: t('special.buyNow', '바로 구매'), onPress: async () => {
                if (!purchasesEnabled()) { Alert.alert(title, t('market.payPending', '결제 준비 중이에요. 쿠폰을 이용하거나 잠시 후 다시 시도해 주세요.')); return; }
                try {
                  const ok = await purchaseCreditRC(kind); if (!ok) return;   // 결제 취소=false(조용히)
                  await grantCredit(kind);                                     // 구매분 크레딧 +1(서버 기록)
                  if (await useCredit(kind)) { await markUnlocked(chartId, kind); generate(chartId); } // 차감 → unlock → 생성
                } catch (e) { Alert.alert('!', (e as Error).message); }
              } },
            { text: t('special.goMarket', '마켓에서 보기'), onPress: () => router.push('/market') },
            { text: t('common.cancel'), style: 'cancel' },
          ]);
          return;
        }
      }
    } catch (e) { logEvent(`${kind}_gate_error`, { message: (e as Error).message }, 'error'); return; }
    finally { gatingRef.current = false; }
    generate(chartId);
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
      <Pressable style={styles.cta} onPress={() => router.push('/register')}><Text style={[styles.ctaTx, dynStyles.ctaTx]}>{t('compat.registerMyChart')}</Text></Pressable>
    </View>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* 상단 명식 헤더 — 현재 적용된 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단). 전환 시 그 명식 기준 재로드 */}
      <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
      <UnlockOverlay visible={busy} message={genMsg} />
      <ContentHero motif={heroMotif} image={heroImage ?? HERO_BY_KIND[kind]} title={title} sub={sub} themeColor={themeColor} />

      {reading?.error ? (
        <View style={styles.card}><Text style={[styles.err, dynStyles.err]}>{String(reading.error)}</Text></View>
      ) : (reading && owned) ? (
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
          <Pressable style={[styles.cta, { backgroundColor: themeColor }]} onPress={onStart}><Text style={[styles.ctaTx, dynStyles.ctaTx]}>{t('special.unlockCta', '구매하고 보기')}</Text></Pressable>
          <Text style={[styles.gateNote, dynStyles.gateNote]}>{t('special.unlockHint', '이용권 구매 또는 쿠폰으로 열려요')}</Text>
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
  // 미리보기 박스(잠긴 콘텐츠의 핵심 항목 목록)
  previewBox: { width: '100%', backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(5) },
  previewHead: { fontSize: 13, fontWeight: '800', marginBottom: space(2), letterSpacing: 0.5 },
  previewItem: { ...font.body, color: colors.inkSoft, lineHeight: 24, fontSize: 14 },
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), paddingHorizontal: space(7) },
  ctaTx: { color: colors.bg, fontWeight: '800', fontSize: 16 },
});
