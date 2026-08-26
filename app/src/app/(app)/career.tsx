// src/app/(app)/career.tsx — '사업가의 나 vs 직장인의 나' (LLM·명식+대운+세운, 건당 유료)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 독립(사업·1인 기업) vs 조직(직장) 두 길을 명식 전체+대운+세운으로 디테일하게.
//   시대 맥락(인성·식상형 1인 기업가도 사업가). 건당 ₩4,900, 1회 생성→캐시(영구). Edge kind='career'.
//   카테고리 6개 각각 이미지(있으면) + 통변. love.tsx 게이트/생성 패턴 차용.
//   ※ 화면 문구는 t() 기본값(ko)으로 i18n 키 없이도 동작 — en/ja career 블록은 점진 추가(daniel).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useRef } from 'react';
import { A } from '../../lib/ui/remoteAsset'; // ★이미지 원격화(daniel 08-01) — 번들에서 걷어내고 Storage 에서 받는다
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { RelatedContent } from '../../components/RelatedContent';
import { ExpiryNote } from '../../components/ExpiryNote'; // 보유 만료일 공통(프리미엄 가드 한 곳)
import { Image as ExpoImage } from 'expo-image'; // 콘텐츠 이미지 — 자동 다운샘플·디스크캐시(랙 방지·타 콘텐츠와 통일, daniel)
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { computeChart } from '../../lib/engine/engine';
import { loadRepChart, listCharts, setRepresentative, getRepresentativeId, type SavedChart } from '../../lib/engine/myChart';
import { ensureServerChartId } from '../../lib/backend/prewarmReadings';
import { useAuth } from '../../lib/useAuth';
import { useFontScale } from '../../lib/ui/fontScale';
import { useSubscription } from '../../lib/billing/subscription'; // 프리미엄=자동 생성(타 스페셜과 통일)
import { autoGenWithChartConfirm } from '../../lib/ui/confirmChart'; // 자동생성 전 명식 확인(명식 2개+ 일 때, daniel 07-13)
import { ensureCoinsFor } from '../../lib/billing/coinGate';   // ★운 단일 경로(daniel 07-28 · 이 화면은 07-30 에 누락 발견)
import { requireLoginForPurchase } from '../../lib/billing/requireLogin';
import { assertOnline } from '../../lib/backend/network';
import { supabase } from '../../lib/supabase';
import { withTimeout, GEN_TIMEOUT_MS } from '../../lib/core/withTimeout';   // ★대기 상한(멈춤 방지·2026-07-31)
import { excludeMock } from '../../lib/core/testMode'; // ★목업(tier='mock') 제외(테스트모드 OFF) — 실모드 목업 서빙 차단
import { readingLang } from '../../lib/i18n';
import { readingFromInvoke } from '../../lib/backend/interpretResult'; // 방어: Edge 응답 정규화(일시적 불가·결제필요·오류)
import { logEvent } from '../../lib/backend/logger'; // DB 로그(단계별 — 네이티브 크래시 직전 추적)
import { useResumeReading } from '../../lib/backend/useResumeReading'; // 앱 복귀 시 서버가 만들어 둔 결과 회수
import { setGenProgress } from '../../lib/backend/genProgress'; // 일회성 진행도(daniel 이슈15)
import { acquireGen, releaseGen, isGenActive } from '../../lib/backend/genLock'; // 크로스마운트 이중 생성 잠금(② 이중 LLM 방지)
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { UnlockOverlay } from '../../components/UnlockOverlay';
import { ChartPicker } from '../../components/ChartPicker'; // 상단 명식 헤더 — 전환 시 그 명식 기준 재로드
import { CareerTeaser } from '../../components/CareerTeaser'; // ★무료 온디바이스 성향 저울(유료 전환 후크 — 재회/취업과 동일 결)
import { ShareReadingButton } from '../../components/ShareReadingButton'; // 이슈17: 풀이 결과 공유(가드 내장)
import { TTSButton } from '../../components/TTSButton'; // 풀이 음성 읽기(온디바이스 TTS·무료)
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회 기록
import { ReadingProse } from '../../components/ReadingProse'; // ★소분류 마커(◆) 렌더 — 본문을 공용 프로즈로 통일(daniel 2026-08-05)

// 6개 카테고리(Edge 응답 키 ↔ i18n 라벨, 없으면 ko 기본값). 순서대로 스택.
const SECTIONS: { key: string; tk: string; def: string }[] = [
  { key: 'overview', tk: 'career.overview', def: '두 길의 큰 그림' },
  { key: 'entrepreneur', tk: 'career.entrepreneur', def: '사업가의 나' },
  { key: 'employee', tk: 'career.employee', def: '직장인의 나' },
  { key: 'lean', tk: 'career.lean', def: '타고난 무게추' },
  { key: 'timing', tk: 'career.timingSec', def: '시기 — 언제 독립, 언제 안정' },
  { key: 'strategy', tk: 'career.strategy', def: '전략과 처방' },
];

// 카테고리별 이미지(daniel 자산, assets/icons/career/{key}.jpg) — 들어온 것만 require, 없으면 텍스트만.
//   ⚠️ 정적 require는 파일 없으면 빌드 에러 → 이미지 생성·배치 후 아래 require 주석 해제(hero 포함 7장).
const CAREER_IMG: Record<string, any> = {
  hero: A('icons/career/hero.jpg'),
  overview: A('icons/career/overview.jpg'),
  entrepreneur: A('icons/career/entrepreneur.jpg'),
  employee: A('icons/career/employee.jpg'),
  lean: A('icons/career/lean.jpg'),
  timing: A('icons/career/timing.jpg'),
  strategy: A('icons/career/strategy.jpg'),
};

const CAREER_TEAL = '#3FA7A0'; // 테마색(독립↔조직)

export default function CareerScreen() {
  useLogContentVisit('career'); // 진입 1회 방문 기록(daniel 2026-07-06)
  const { t } = useTranslation();
  const router = useRouter();
  const { chartId: chartIdParam } = useLocalSearchParams<{ chartId?: string }>(); // ★M1 재진입 바인딩(배너/푸시 route 의 chartId)
  const { session } = useAuth();
  const { fs } = useFontScale();
  const { isPremium } = useSubscription();
  const [savedChart, setSavedChart] = useState<SavedChart | null>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [reading, setReading] = useState<any>(null);     // 캐시/생성된 통변(6항목)
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);         // ChartPicker 전환 시 재로드
  const [expiry, setExpiry] = useState<string | null>(null); // 보유 만료일(생성일+1년) — 캐시 created_at으로 채움(daniel #25)
  const c = useMemo(() => (savedChart ? computeChart(savedChart.input) : null), [savedChart]);
  const gatingRef = useRef(false);                       // 게이트(모달) 연타 차단
  const lastAppliedChartId = useRef<string | null>(null); // ★M1 적용한 chartId param 추적(재진입 중복 setRepresentative 방지·reading.tsx 38-43)
  const genSeq = useRef(0);        // ① 생성 세대 토큰 — 명식 전환/재로드 시 ++ 로 진행 중 gen 무효화(stale setReading 폐기)
  const chartIdRef = useRef<string | null>(null); // ① 현재 로드된 serverChartId — generate 결과 명식 대조(남의 풀이 표시 차단)

  // ★유효 통변(reading)이 실제로 공개되는 순간 = 골드 명조 문 열림 연출 1회(daniel 07-06). 캐시 로드/생성 완료로 처음 뜰 때만(ref 가드).
  // ★복귀 회수 — 앱이 나가도 Edge 는 끝까지 만들어 저장한다. 읽기 전용이라 재결제·재생성 없음.
  useResumeReading(chartId, 'career', (content) => { setReading(content as any); setBusy(false); });

  useEffect(() => {
  }, [reading]);

  // 대표 명식 로드 → 서버차트ID → 'career' 캐시 조회(생성 없이 즉시 표시)
  useEffect(() => {
    let alive = true;
    genSeq.current++;   // ① 재로드(진입·명식전환) = 진행 중 generate 무효화(그 결과가 이 화면에 setReading 되지 않게)
    setBusy(false);     // ① 무효화한 gen 의 로딩 상태 정리(자물쇠가 남지 않게)
    (async () => {
      // ★M1(재진입 바인딩): 배너/푸시 route 의 chartId → 그 명식을 대표로 1회 전환(reading.tsx 38-43 패턴). 중복가드(ref)+이미 대표면 skip.
      if (chartIdParam && chartIdParam !== lastAppliedChartId.current) {
        lastAppliedChartId.current = chartIdParam;
        const cs = await listCharts();
        const target = cs.find((sc) => sc.id === chartIdParam) ?? null;
        if (target && (await getRepresentativeId()) !== target.id) await setRepresentative(target.id);
      }
      const ch = await loadRepChart();
      if (!alive) return;
      setSavedChart(ch);
      if (!ch || !session) { setLoaded(true); return; }
      const cc = computeChart(ch.input);
      const id = await ensureServerChartId(cc, ch.input, session, ch);
      if (!alive || !id) { setLoaded(true); return; }
      setChartId(id);
      chartIdRef.current = id;   // ① 현재 명식 확정 — 이후 도착하는 generate 결과의 명식 대조 기준
      const { data } = await excludeMock(supabase.from('readings').select('content, created_at').eq('chart_id', id).eq('category', 'career').eq('lang', readingLang())).maybeSingle();
      if (!alive) return;
      const cached = data?.content ?? null;
      setReading(cached);
      // 보유 만료일(daniel #25): 생성(구매)일 + 1년. 캐시 created_at 있을 때만(명식 전환 시 stale 방지 위해 else로 초기화).
      if (data?.created_at) { const d = new Date(data.created_at); d.setFullYear(d.getFullYear() + 1); setExpiry(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`); } else setExpiry(null);
      setLoaded(true);
      if (isPremium && !cached) void autoGenWithChartConfirm({ creditKind: 'career', onConfirm: () => generate(id) }); // 프리미엄 자동 생성 — 명식 2개+ 면 '어느 명식?' 먼저(daniel 07-13)
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [session, isPremium, reloadKey, chartIdParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // 순수 생성(LLM) — 게이트 통과 후 호출
  async function generate(idArg?: string) {
    const id = idArg ?? chartId;
    if (!id || busy) return;
    // ② 크로스마운트 이중 LLM 방지 — 이미 이 명식 career 가 생성 중이면 2차 호출하지 않는다(과금 0).
    const lockKey = `career:${id}`;
    const myGen = genSeq.current;    // ① 이 생성의 세대 스냅샷(읽기만) — 재로드/명식전환(load effect)이 genSeq 를 올리면 stale
    const myChart = id;              // ① 대상 명식
    const isStale = () => myGen !== genSeq.current || myChart !== chartIdRef.current; // ① 결과 쓰기 직전 대조
    // A4(daniel 2026-07-08): 이미 다른 마운트가 생성 중이면 2차 LLM 막고(과금0) 로딩 유지·완료까지 대기 후 재시도(Edge 캐시 히트=과금0). daniel: 풀이중 진입차단 허용.
    if (!acquireGen(lockKey)) {
      setBusy(true);
      for (let i = 0; i < 45 && isGenActive(lockKey); i++) await new Promise((r) => setTimeout(r, 3000));
      setBusy(false);
      if (isStale() || isGenActive(lockKey)) return;
      return generate(idArg);
    }
    setBusy(true);
    // ③ 배너/푸시 명식 식별 — route 에 chartId(로컬 savedChart.id) + chartLabel. 재진입 바인딩은 ★M1 로 load effect 상단에 구현됨(reading.tsx 38-43 패턴).
    const gpRoute = savedChart?.id ? `/career?chartId=${savedChart.id}` : '/career';
    setGenProgress({ active: true, total: 1, done: 0, label: '사업가 vs 직장인', chartLabel: savedChart?.label, route: gpRoute }); // 일회성 진행도(daniel 이슈15)
    logEvent('career_invoke_start', { chartId: id });
    let ok = false; // ★L2: 실제 성공(정상 reading 객체) 여부 — 완료 배너·푸시는 이때만(오완료 '완성' 푸시 방지)
    try {
      const __inv = await withTimeout(supabase.functions.invoke('interpret', {
        body: { chartId: id, category: 'career', kind: 'career', tier: 'paid', lang: readingLang() },
      }), GEN_TIMEOUT_MS);
      const { data, error } = __inv ?? { data: null, error: { message: 'client timeout' } as any };      if (isStale()) return;   // ① 생성 사이 명식 전환됨 → 남의 화면에 쓰지 않음(폐기)
      if (error) logEvent('career_invoke_error', { message: error.message }, 'error');
      else if ((data as any)?.unavailable) logEvent('career_unavailable', { retryAt: (data as any)?.retryAt }, 'error'); // 방어: LLM 일시적 불가
      else if ((data as any)?.needPayment) logEvent('career_need_payment', {}, 'error');
      else logEvent('career_invoke_ok');
      const r = readingFromInvoke(data, error); // 방어: 일시적 불가→친화 재시도 / 오류→원문 숨김
      setReading(r);
      ok = !!r && typeof r === 'object' && !r.error; // 정상 통변 객체(error·unavailable·needPayment 아님)만 완료
    } catch (e) {
      logEvent('career_invoke_throw', { message: (e as Error).message }, 'error');
      if (isStale()) return;
      setReading({ error: (e as Error).message });
    } finally {
      // ★로딩은 **어떤 경로로 나가든** 꺼야 한다(daniel 2026-08-13).
      //   `isStale()` 로 빠져나가는 return 이 이 아래에만 7곳 있는데, 전부 setBusy(false) 없이 나갔다.
      //   ⇒ 명식을 바꾸거나 화면이 재로드되면 **로딩이 영영 안 사라졌다**(사용자는 멈춘 걸로 본다).
      //   finally 는 성공·실패·폐기를 모두 지나므로 여기 한 줄이면 전 경로가 닫힌다.
      //   (아래쪽 setBusy(false) 는 중복이지만 같은 값이라 무해 — 굳이 지우지 않는다.)
      releaseGen(lockKey);
      setBusy(false);
    }
    if (isStale()) return;   // ① 완료 처리도 현재 명식일 때만
    // ★L2: 실제 성공만 완료 전이(배너+완료 푸시). 실패(오류·unavailable·needPayment)면 배너 제거 → 오완료 '완성' 푸시 방지.
    if (ok) setGenProgress({ route: gpRoute, done: 1, total: 1 }); // 완료 → 홈 배너 '풀이 보기'(daniel 이슈15)
    else setGenProgress({ route: gpRoute, active: false });
    setBusy(false);
  }

  // 게이트(서버 차감 통일·타 스페셜과 동일): 프리미엄=바로 / 관리자=바로 / 그 외 쿠폰('career') 보유 시만.
  async function onStart() {
    if (!chartId || busy || gatingRef.current) return;
    logEvent('career_generate_tap', { chartId });
    if (!assertOnline(t)) { logEvent('career_offline'); return; }
    if (isPremium) { generate(chartId); return; }
    gatingRef.current = true;
    try {
      const admin = false;   // ★관리자 전체오픈 폐지(daniel 2026-07-29) — 관리자도 운을 쓴다(결제 경로를 관리자 계정으로 실제 검증하기 위해)
      if (!admin) {
        if (!requireLoginForPurchase(session, () => router.push('/login'), t)) { logEvent('career_need_login'); return; }
        // ★★운 게이트로 전환(daniel 2026-07-30 "왜 쿠폰으로 열기가 나오지 코인으로 열수있는데").
        //   07-28 코인 단일화폐 전환에서 **이 화면이 누락**됐다 — 구 쿠폰(크레딧) 잔여가 없으면
        //   운을 아무리 많이 갖고 있어도 통과할 수 없었다(프리미엄 폐지·관리자 개방 폐지로 우회로도 전멸).
        //   ⇒ 마켓에서 '열기'를 눌러도 이 화면으로 와서 "쿠폰이 필요하다"만 반복됐다.
        //   차감은 여기서 하지 않는다 — 서버(Edge interpret)가 생성 직전에 원자적으로 뺀다.
        const g = await ensureCoinsFor('career', { title: t('career.title', '사업가의 나 vs 직장인의 나'), t, goCharge: () => router.push('/coins'), chartId });
        logEvent('career_coin_gate', { result: g });
        if (g !== 'ok') return;   // insufficient=충전 안내 / cancel=사용자 취소 / error=조회 실패(부족으로 오해 금지)
      }
    } catch (e) { logEvent('career_gate_error', { message: (e as Error).message }, 'error'); return; }
    finally { gatingRef.current = false; }
    generate(chartId);
  }


  if (!loaded) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (!savedChart) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>{t('manse.empty')}</Text>
        <PressableScale style={styles.cta} onPress={() => router.push('/register')}><Text style={styles.ctaTx}>{t('compat.registerMyChart')}</Text></PressableScale>
      </View>
    );
  }

  return (
    <View style={styles.bg}>
      {/* 전역 ContentBackdrop 이 배경(한지/달밤+별)을 제공 — 화면별 bgSource 이미지·스크림 제거(daniel 07-02) */}
      <>
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
        {/* 히어로 */}
        <View style={styles.hero}>
          {CAREER_IMG.hero ? <ExpoImage source={CAREER_IMG.hero} style={styles.heroImg} contentFit="cover" cachePolicy="memory-disk" transition={150} /> : null}
          <Text style={styles.title}>{t('career.title', '사업가의 나 vs 직장인의 나')}</Text>
          <Text style={styles.sub}>{t('career.sub', '명식과 대운·세운으로, 독립과 조직 두 길을 짚어 드려요')}</Text>
        </View>

        {/* ★무료 온디바이스 티저 — 사업가↔직장인 성향 저울(히어로 아래·잠김/열림 무관 항상 노출·유료 전환 후크).
            career 는 SpecialContentScreen 이 아닌 커스텀 화면이라 freeHook 슬롯 대신 여기(게이트 위)에 직접 배치(love.tsx 와 동일 결).
            c.saju 에 timeUnknown 을 코드베이스 관례(prewarm/Reading/freeHook)와 동일하게 병합해 넘긴다. */}
        {c?.saju ? <CareerTeaser saju={{ ...c.saju, timeUnknown: savedChart?.input?.timeAccuracy === '미상' }} /> : null}

        {reading?.error ? (
          <View style={styles.card}><Text style={styles.err}>{String(reading.error)}</Text></View>
        ) : reading ? (
          // ── 소제목 + 6개 카테고리 섹션(각 이미지 있으면 위에) ──
          <>
          {/* 풀이 보유 만료일 — 공통 컴포넌트(daniel 07-01) */}
          <ExpiryNote expiry={expiry} chartId={chartId} />
          {/* 이슈19 소제목 — 통변 결과 headline 있으면 섹션들 맨 위에 한 줄 강조 */}
          {typeof reading.headline === 'string' && reading.headline.trim() ? (
            <Text style={{ fontSize: fs(19), fontWeight: '800', color: colors.ju, marginBottom: space(3), lineHeight: 26 }}>{reading.headline}</Text>
          ) : null}
          {/* ★근본 '풀이 안 보임'(daniel 07-11): base 폴백 형식이면 구조화 섹션 키가 비어 화면이 텅 빔 → base 있으면 통째로 표시. */}
          {typeof reading.base === 'string' && reading.base.trim() ? (
            <View style={[styles.card, styles.cardAccent]}><ReadingProse text={String(reading.base ?? '')} collapsible={false} /></View>
          ) : SECTIONS.map((s) => (typeof reading[s.key] === 'string' && reading[s.key] ? (
            <View key={s.key} style={[styles.card, styles.cardAccent]}>
              {CAREER_IMG[s.key] ? <ExpoImage source={CAREER_IMG[s.key]} style={styles.secImg} contentFit="cover" cachePolicy="memory-disk" transition={150} /> : null}
              <Text style={styles.secLabel}>{t(s.tk, s.def)}</Text>
              <ReadingProse text={String(reading[s.key] ?? '')} collapsible={false} />
            </View>
          ) : null))}
          {/* 풀이 음성 읽기(온디바이스 TTS·무료) — SECTIONS 순서로 읽음 */}
          <TTSButton reading={reading} sections={SECTIONS} />
          {/* 이슈17: 풀이 결과 공유(content 없거나 error면 컴포넌트가 자체 미노출) */}
          <ShareReadingButton kind="career" title={t('career.title', '사업가의 나 vs 직장인의 나')} content={reading} />
          </>
        ) : (
          // ── 잠김(미생성) — 쿠폰(이용권)/관리자로 unlock(타 스페셜과 통일) ──
          <View style={[styles.card, styles.gate]}>
            <Text style={styles.gateTitle}>{t('career.title', '사업가의 나 vs 직장인의 나')}</Text>
            <Text style={styles.gateDesc}>{t('career.gateDesc', '두 길에서 어떻게 빛나고 어디서 막히는지, 타고난 무게추와 시기까지 풀어 드려요.')}</Text>
            <View style={styles.previewBox}>
              <Text style={styles.previewHead}>{t('special.previewHead', '이런 걸 풀어드려요')}</Text>
              {SECTIONS.map((s) => <Text key={s.key} style={styles.previewItem}>· {t(s.tk, s.def)}</Text>)}
            </View>
            <PressableScale style={[styles.cta, styles.ctaTeal]} onPress={onStart}><Text style={styles.ctaTx}>{t('special.unlock', '운으로 열기')}</Text></PressableScale>
            <Text style={styles.gateNote}>{t('special.couponHint', '운으로 열 수 있어요')}</Text>
          </View>
        )}
              {/* ★이어서 보면 좋은 콘텐츠(daniel 2026-07-27 "전부 붙여") — 화면마다 하단이 달라 보이던 것 통일.
            큐레이션 출처는 RELATED 단일(중복 하드코딩 0). 매핑이 없으면 스스로 아무것도 안 그린다. */}
        <RelatedContent kind="career" />
</ScrollView>
      {/* ★UnlockOverlay 는 **반드시 ScrollView 밖**(daniel 2026-08-12 *"자물쇠가 위에있어서 안보여"*).
          안에 두면 absoluteFill 이 **스크롤 내용 전체 높이**를 채워, 가운데 정렬된 자물쇠·%·메시지가
          화면 밖으로 밀려 '홈으로 나가기' 버튼만 떠 보였다. check:overlayroot 가 재발을 막는다. */}
        <UnlockOverlay visible={busy} message={t('career.generating', '두 길을 풀어내는 중…')} />
      </>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },                 // ★전역 ContentBackdrop 이 비쳐 보이게(daniel 07-02)
  overlay: { flex: 1, backgroundColor: 'transparent' },            // 스크롤 컨텐츠 루트 — 투명(스크림 제거)
  wrap: { padding: space(6), paddingBottom: space(12) }, // 콘텐츠 좌우여백 통일(daniel)
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: 'transparent' },
  msg: { ...font.body, color: colors.ink, textAlign: 'center', marginBottom: space(5) },
  hero: { alignItems: 'center', paddingVertical: space(4), marginBottom: space(3) },
  heroImg: { width: '100%', height: 190, borderRadius: radius.md, marginBottom: space(3) },
  title: { fontSize: 24, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  sub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(2), lineHeight: 19 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  cardAccent: { borderLeftWidth: 3, borderLeftColor: CAREER_TEAL },
  secImg: { width: '100%', height: 190, alignSelf: 'center', borderRadius: radius.sm, marginBottom: space(3) },
  secLabel: { fontSize: 16, fontWeight: '800', color: CAREER_TEAL, marginBottom: space(2) },
  body: { ...font.body, color: colors.ink },
  err: { fontSize: 13, color: colors.ju },
  gate: { alignItems: 'center', borderStyle: 'dashed', borderColor: CAREER_TEAL, paddingVertical: space(7) },
  gateTitle: { ...font.heading, color: colors.ink, marginBottom: space(2), textAlign: 'center' },
  gateDesc: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginBottom: space(5), lineHeight: 22 },
  previewBox: { width: '100%', backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(5) },
  previewHead: { fontSize: 13, fontWeight: '800', color: CAREER_TEAL, marginBottom: space(2), letterSpacing: 0.5 },
  previewItem: { ...font.body, color: colors.inkSoft, lineHeight: 24, fontSize: 14 },
  gateNote: { ...font.caption, color: colors.inkFaint, marginTop: space(3) },
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), paddingHorizontal: space(7) },
  ctaTeal: { backgroundColor: CAREER_TEAL },
  ctaTx: { color: colors.bg, fontWeight: '800', fontSize: 16 },
});
