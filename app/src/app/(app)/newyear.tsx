// src/app/(app)/newyear.tsx — 신년운세 패키지 (스페셜) — 신년 전용 LLM(연운과 분리)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-06 '신년 전용 차별화': 타임라인(연도 탐색)과 포지션 분리. 올해 1년에만 몰입한 시즌 상품.
//   = 올해의 키워드 + 새해 총평 + 분야 5(통합·직업·재물·애정·건강) + 12개월 캘린더 + 삼재 대처 + 올해 다짐.
//   Edge kind='newyear'(NEWYEAR_READING_SYSTEM) · 캐시 category='newyear_YYYY'(연운 year_YYYY와 안 겹침).
//   삼재(lib/samjae 온디바이스)는 배지로 즉시 표시 + body로 Edge에 전달(LLM 대처문 samjaeAdvice 생성).
//   접근: 프리미엄=무광고 자동 / 비프리미엄=결제(이용권·관리자)만 — 유료 콘텐츠라 보상형 광고 무료 생성 없음(daniel). §4 안전: 삼재=흉 단정 금지(전향적).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useRef } from 'react';
import { A } from '../../lib/ui/remoteAsset'; // ★이미지 원격화(daniel 08-01) — 번들에서 걷어내고 Storage 에서 받는다
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { RelatedContent } from '../../components/RelatedContent';
import { ExpiryNote } from '../../components/ExpiryNote'; // 보유 만료일 공통(프리미엄 가드 한 곳)
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getDailyFortune } from '../../lib/content/dailyFortune';
import { loadRepChart, listCharts, setRepresentative, getRepresentativeId, type SavedChart } from '../../lib/engine/myChart';
import { ensureServerChartId } from '../../lib/backend/prewarmReadings';
import { computeChart } from '../../lib/engine/engine';
import { samjaeStatus } from '../../lib/engine/samjae';
import { useAuth } from '../../lib/useAuth';
import { useSubscription } from '../../lib/billing/subscription';
import { ensureCoinsFor } from '../../lib/billing/coinGate';   // ★운 단일 경로(daniel 07-28 · 이 화면은 07-30 에 누락 발견)
import { requireLoginForPurchase } from '../../lib/billing/requireLogin';
import { confirmReadingChart } from '../../lib/ui/confirmChart'; // 생성 전 명식 확인 + 보유 이용권 안내(daniel)
import { supabase } from '../../lib/supabase';
import { withTimeout, GEN_TIMEOUT_MS } from '../../lib/core/withTimeout';   // ★대기 상한(멈춤 방지)
import { excludeMock } from '../../lib/core/testMode'; // ★목업(tier='mock') 제외(테스트모드 OFF) — 실모드 목업 서빙 차단
import { appLang } from '../../lib/i18n';
import { invokeFail } from '../../lib/backend/interpretResult'; // 방어: Edge 실패(일시적 불가·결제필요·오류) 정규화
import { assertOnline } from '../../lib/backend/network'; // daniel: 네트워크/서버 미연결 시 풀이 생성 차단
import { logEvent } from '../../lib/backend/logger';
import { setGenProgress } from '../../lib/backend/genProgress'; // 일회성 컨텐츠 진행도(daniel 이슈15)
import { acquireGen, releaseGen } from '../../lib/backend/genLock'; // 크로스마운트 이중 생성 잠금(② 이중 LLM 방지)
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { UnlockOverlay } from '../../components/UnlockOverlay'; // unlock 자물쇠 애니 + 그 사이 LLM 분석
import { ContentHero } from '../../components/SpecialContentScreen'; // 공용 히어로
import { ChartPicker } from '../../components/ChartPicker'; // 상단 명식 헤더 — 현재 적용 명식 표시·전환
import { ShareReadingButton } from '../../components/ShareReadingButton'; // 이슈17: 풀이 결과 공유(가드 내장)
import { TTSButton } from '../../components/TTSButton'; // 풀이 음성 읽기(온디바이스 TTS·무료)
import { NewyearWheel } from '../../components/contentMotifs'; // 12달 수레바퀴 모티프
import { NewyearTeaser } from '../../components/NewyearTeaser'; // 무료 온디바이스 티저(내년 신수 3층 산식 + 큰 삼재 배지 + 길월) — 유료 전환 후크
import { MonthFlowGraph } from '../../components/MonthFlowGraph'; // 12개월 흐름 곡선(SVG 공용)
import { newyearCategoryFlow, type NewyearCategory } from '../../lib/content/newyearCategoryFlow'; // 카테고리별 월별 흐름(합성 활성×부합·결정론·daniel 07-08)
import { useFontScale } from '../../lib/ui/fontScale';
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회 기록
import { ReadingProse } from '../../components/ReadingProse'; // ★소분류 마커(◆) 렌더 — 본문을 공용 프로즈로 통일(daniel 2026-08-05)

// 신년 패키지 분야 10(daniel: 컨텐츠 강화 — 통합·직업·사업·재물·애정·결혼·건강·대인·배움·이동)
const AREAS: { key: string; ko: string }[] = [
  { key: 'general', ko: '통합' }, { key: 'work', ko: '직업' },
  { key: 'business', ko: '사업' }, // daniel 2026-07-08: 사업·창업 방면(편재·식상=식신생재 사업 통로) — 직업(고용)과 분리
  { key: 'money', ko: '재물' },
  { key: 'love', ko: '애정' }, { key: 'marriage', ko: '결혼' }, { key: 'health', ko: '건강' },
  { key: 'social', ko: '대인' }, { key: 'growth', ko: '배움' }, { key: 'move', ko: '이동' },
];

export default function NewYearScreen() {
  useLogContentVisit('newyear'); // 진입 1회 방문 기록(daniel 2026-07-06)
  const { t } = useTranslation();
  const { fs, ls } = useFontScale();
  const router = useRouter();
  const { chartId: chartIdParam } = useLocalSearchParams<{ chartId?: string }>(); // ★M1 재진입 바인딩(배너/푸시 route 의 chartId)
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const f = useMemo(() => getDailyFortune(), []);
  const thisYear = Number(f.date.slice(0, 4));
  // ★연도 선택(daniel 2026-07-29 "26년도꺼도 보여줘야지").
  //   종전엔 연도가 **오늘 기준 하나뿐**이라 올해·내년을 골라 볼 수 없었다.
  //   캐시(category=newyear_YYYY)와 재구매 판정(needsYearRepurchase)은 이미 **연도별로 분리**돼 있어
  //   구조는 준비돼 있었다 — 고를 UI 만 없었다.
  //   ⚠️연도마다 별도 풀이다(category 가 다르면 캐시 미스 = 새 생성 = 별도 결제). 그래서 배지로 소유 여부를 보여준다.
  const [year, setYear] = useState(thisYear);
  const YEARS = [thisYear, thisYear + 1];
  const yearBranch = f.yearGanZhi[1]; // 올해 지지(삼재 판정용)
  const [saved, setSaved] = useState<SavedChart | null>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [area, setArea] = useState('general');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // ChartPicker 로 대표 전환 시 재로드 트리거
  const [expiry, setExpiry] = useState<string | null>(null); // 보유 만료일(생성일+1년) — 캐시 created_at으로 채움(daniel #25)
  const gatingRef = useRef(false); // 결제 구간 연타 차단
  const lastAppliedChartId = useRef<string | null>(null); // ★M1 적용한 chartId param 추적(재진입 중복 setRepresentative 방지·reading.tsx 38-43)
  const genSeq = useRef(0);        // ① 생성 세대 토큰 — 명식 전환/재로드 시 ++ 로 진행 중 gen 무효화(stale setData 폐기)
  const chartIdRef = useRef<string | null>(null); // ① 현재 로드된 serverChartId — generate 결과 명식 대조(남의 풀이 표시 차단)

  // ★신년 통변(data)이 실제로 공개되는 순간 = 골드 명조 문 열림 연출 1회(daniel 07-06). 캐시 로드/생성 완료로 처음 뜰 때만(ref 가드·오류는 err 상태라 data는 유효 통변만).
  useEffect(() => {
  }, [data]);

  const category = `newyear_${year}`; // 연운(year_YYYY)과 분리된 신년 전용 캐시
  // 대표 명식의 결정론 차트(무료 티저 + 삼재 산출 공용). computeChart 는 엔진 캐시라 재호출 저렴.
  const c = useMemo(() => (saved ? computeChart(saved.input) : null), [saved]);
  // ★신년 카테고리별 12개월 흐름(결정론·온디바이스·daniel 07-08) — 합성(활성×부합). 유료 본문 분야 카드의 곡선 소스.
  const catFlow = useMemo(
    () => (c?.saju ? newyearCategoryFlow(c.saju, year, { gender: saved?.input?.sex, timeUnknown: saved?.input?.timeAccuracy === '미상' }) : null),
    [c, year, saved],
  );
  // 삼재(온디바이스) — 태어난 해 지지 vs 올해 지지. ★유료 통변(Edge) body 로 전달용(올해 기준). 화면 배지는 NewyearTeaser(내년)로 이관.
  const samjae = useMemo(() => {
    const yb = c?.saju.pillars['년']?.branch;
    return yb ? samjaeStatus(yb, yearBranch) : null;
  }, [c, yearBranch]);

  const uid = session?.user?.id ?? null; // ★deps 안정화 — session 객체 참조가 아닌 user.id로(재발행 깜빡임 방지, daniel 07-02)
  useEffect(() => {
    let alive = true;
    genSeq.current++;   // ① 재로드(진입·명식전환) = 진행 중 generate 무효화(그 결과가 이 화면에 setData 되지 않게)
    setBusy(false);     // ① 무효화한 gen 의 로딩 상태 정리(자물쇠가 남지 않게)
    // ★재실행 시 화면을 비우지 않는다(구매화면↔풀이화면 깜빡임 근본): 새 값을 받은 뒤에만 교체.
    //   (기존엔 시작 시 setData(null)+setLoaded(false)로 blank → 캐시 재세팅을 반복해 깜빡였음)
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
      setSaved(ch);
      if (!ch || !uid) { setData(null); setLoaded(true); return; }
      const c = computeChart(ch.input);
      const id = await ensureServerChartId(c, ch.input, session!, ch);
      if (!alive || !id) { setLoaded(true); return; }
      setChartId(id);
      chartIdRef.current = id;   // ① 현재 명식 확정 — 이후 도착하는 generate 결과의 명식 대조 기준
      const { data: row } = await excludeMock(supabase.from('readings').select('content, created_at').eq('chart_id', id).eq('category', category).eq('lang', appLang())).maybeSingle();
      if (!alive) return;
      const cached = (row?.content as Record<string, any> | undefined) ?? null;
      setData(cached);
      // 보유 만료일(daniel #25): 생성(구매)일 + 1년. 캐시 created_at 있을 때만(명식 전환 시 stale 방지 위해 else로 초기화).
      if (row?.created_at) { const d = new Date(row.created_at); d.setFullYear(d.getFullYear() + 1); setExpiry(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`); } else setExpiry(null);
      setLoaded(true);
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, category, isPremium, reloadKey, chartIdParam]);

  // invoke 타임아웃/실패 시 readings 캐시를 폴링해 결과 회수(Edge가 서버에서 계속 생성·캐시하므로).
  //   무거운 신년 풀이(원국+대운+세운 종합)는 Edge 생성이 87~103s → 클라 invoke가 먼저 끊겨도('Failed to send request')
  //   서버는 완료·캐시함. 그 캐시를 폴링해 로딩 유지한 채 결과를 받아온다(멈춤·"갑자기 완료" 해결, daniel 07-02).
  //   category 는 동적(newyear_YYYY)이라 인자로 받는다.
  async function pollCachedReading(id: string, cat: string, maxMs = 135000, everyMs = 3500): Promise<any | null> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, everyMs));
      const { data } = await excludeMock(supabase.from('readings').select('content').eq('chart_id', id).eq('category', cat).eq('lang', appLang())).maybeSingle();
      if (data?.content) return data.content;
    }
    return null;
  }

  async function generate(id: string) {
    if (!assertOnline(t)) return; // daniel: 오프라인이면 풀이 진입(Edge 생성) 차단
    if (busy) return;
    // ② 크로스마운트 이중 LLM 방지 — 이미 이 명식·이 연도 신년운세가 생성 중이면 2차 호출하지 않는다(과금 0).
    const lockKey = `${category}:${id}`; // category=newyear_YYYY(연도별 분리)
    const myGen = genSeq.current;    // ① 이 생성의 세대 스냅샷(읽기만) — 재로드/명식전환(load effect)이 genSeq 를 올리면 stale
    const myChart = id;              // ① 대상 명식
    const isStale = () => myGen !== genSeq.current || myChart !== chartIdRef.current; // ① 결과 쓰기 직전 대조
    // A4(daniel 2026-07-08): 이미 다른 마운트가 이 명식·연도를 생성 중(잠금 점유)이면 2차 LLM은 막되(과금 0),
    //   화면은 로딩으로 두고 캐시 폴링해 완료 시 결과 회수. 예전엔 조용히 return → 오버레이·에러·로딩 없이 '멈춤'(홈도 못 감).
    if (!acquireGen(lockKey)) {
      setBusy(true); setErr(null);
      const cached = await pollCachedReading(id, category);
      if (isStale()) return;
      if (cached) setData(cached);
      setBusy(false);
      return;
    }
    setBusy(true); setErr(null);
    // ③ 배너/푸시 명식 식별 — route 에 chartId(로컬 saved.id) + chartLabel. 재진입 바인딩은 ★M1 로 load effect 상단에 구현됨(reading.tsx 38-43 패턴).
    const gpRoute = saved?.id ? `/newyear?chartId=${saved.id}` : '/newyear';
    setGenProgress({ active: true, total: 1, done: 0, label: t('newyear.title', '신년운세'), chartLabel: saved?.label, route: gpRoute }); // 일회성=진행도 측정 어려움 → '풀이 중'(daniel 이슈15)
    logEvent('newyear_generate', { chartId: id, category });
    let ok = false; // ★L2: 실제 성공(정상 통변 데이터) 여부 — 완료 배너·푸시는 이때만(오완료 '완성' 푸시 방지)
    try {
      // 신년 전용 — kind='newyear' + 삼재(온디바이스 계산값) body 전달
      // ★상한(2026-07-31 멈춤 전수조사) — 응답이 안 오면 로딩 잠금이 영구히 남는다.
      const __inv = await withTimeout(supabase.functions.invoke('interpret', {
        body: { chartId: id, category, kind: 'newyear', samjae: samjae ?? undefined, tier: 'paid', lang: appLang(), ...(saved?.context ? { context: saved.context } : {}) },
      }), GEN_TIMEOUT_MS);
      const { data: res, error } = __inv ?? { data: null, error: { message: 'client timeout' } as any };      const f = invokeFail(res, error); // 방어: 일시적 불가→재시도 안내 / 결제필요·오류 일관 처리
      if (f && f.kind !== 'error') {
        // unavailable/needPayment = 200 빠른 실패(Edge가 긴 생성을 시작 안 함) → 폴링 없이 즉시 친화 문구
        logEvent('newyear_fail', { kind: f.kind, message: error?.message }, 'error');
        if (isStale()) return;   // ① 생성 사이 명식 전환됨 → 폐기
        setErr(f.message);
      } else if (error || !res?.reading) {
        // ★클라 invoke가 끊기거나(무거운 풀이 타임아웃) 응답이 비어도 Edge는 서버에서 완료·캐시 → 캐시 폴링으로 회수(로딩 유지).
        logEvent('newyear_fail', { kind: 'timeout', message: error?.message ?? 'no reading', polling: true }, 'error');
        const cached = await pollCachedReading(id, category);
        if (isStale()) return;   // ① 폴링 사이 명식 전환됨 → 폐기
        if (cached) { setData(cached); ok = true; } // 서버 완료·캐시 = 성공
        else setErr(f?.message ?? t('today.genFail', '풀이 생성에 실패했어요. 잠시 후 다시 시도해 주세요.'));
      } else { if (isStale()) return; const rd = (res?.reading as Record<string, any>) ?? null; setData(rd); ok = !!rd; }
    } catch (e: any) {
      // fetch throw(타임아웃 등)도 동일 — 서버가 완료·캐시했으면 폴링으로 회수, 아니면 오류 표시.
      logEvent('newyear_throw', { message: String(e?.message ?? e) }, 'error');
      const cached = await pollCachedReading(id, category);
      if (isStale()) return;
      if (cached) { setData(cached); ok = true; } // 서버 완료·캐시 = 성공
      else setErr(t('today.genFail', '풀이 생성에 실패했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      releaseGen(lockKey);   // ② 완료·중단·오류·폐기 모두 잠금 해제
    }
    if (isStale()) return;   // ① 완료 처리도 현재 명식일 때만
    // ★L2: 실제 성공만 완료 전이(배너+완료 푸시). 실패(오류·폴링실패·unavailable·needPayment)면 배너 제거 → 오완료 '완성' 푸시 방지.
    if (ok) setGenProgress({ route: gpRoute, done: 1, total: 1 }); // 완료 → 홈 배너 '풀이 보기' 이동버튼(daniel 이슈15)
    else setGenProgress({ route: gpRoute, active: false });
    setBusy(false);
  }

  // 결제 게이트(서버 차감 통일·daniel 2026-06): 프리미엄=무료 / 비프리미엄=크레딧 보유시 통과(서버 차감), 없으면 결제→부여.
  //   ★실제 차감·검증은 Edge(consume_credit). 클라는 결제 UI + 사전 보유 확인(UX)만 — 우회·이중차감 방지.
  // 생성 전 '이 명식으로 풀이할지' 확인(+보유 이용권) → 확인 시 doStart(daniel 07-02).
  function onStart() {
    if (!chartId || busy || gatingRef.current) return;
    void confirmReadingChart({ chartLabel: saved?.label, creditKind: 'newyear', t, onConfirm: () => { void doStart(); } });
  }
  async function doStart() {
    if (!chartId || busy || gatingRef.current) return;
    gatingRef.current = true;                                                       // 게이트 구간 연타 차단
    try {
      const admin = false;   // ★관리자 전체오픈 폐지(daniel 2026-07-29) — 관리자도 운을 쓴다(결제 경로를 관리자 계정으로 실제 검증하기 위해)
      if (!admin) {
        if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
        // ★★운 게이트로 전환(daniel 2026-07-30 "왜 쿠폰으로 열기가 나오지 코인으로 열수있는데").
        //   07-28 코인 단일화폐 전환에서 **이 화면이 누락**됐다 — 구 쿠폰(크레딧) 잔여가 없으면
        //   운을 아무리 많이 갖고 있어도 통과할 수 없었다(프리미엄 폐지·관리자 개방 폐지로 우회로도 전멸).
        //   ⇒ 마켓에서 '열기'를 눌러도 이 화면으로 와서 "쿠폰이 필요하다"만 반복됐다.
        //   차감은 여기서 하지 않는다 — 서버(Edge interpret)가 생성 직전에 원자적으로 뺀다.
        const g = await ensureCoinsFor('newyear', { title: t('newyear.title', '신년운세'), t, goCharge: () => router.push('/coins'), chartId });
        logEvent('newyear_coin_gate', { result: g });
        if (g !== 'ok') return;   // insufficient=충전 안내 / cancel=사용자 취소 / error=조회 실패(부족으로 오해 금지)
      }
    } catch (e: any) { logEvent('newyear_gate_error', { message: String(e?.message ?? e) }, 'error'); return; }
    finally { gatingRef.current = false; }
    generate(chartId);                                                              // 관리자·프리미엄=우회 / 크레딧=서버 차감
  }

  const months: string[] = Array.isArray(data?.months) ? data!.months : [];

  return (
    <View style={styles.bg}>
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        {/* 상단 명식 헤더 — 현재 적용된 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단). 전환 시 그 명식 기준 재로드 */}
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
        <UnlockOverlay visible={busy} message={t('newyear.generating', '올 한 해를 풀어내는 중…')} />
        <ContentHero motif={<NewyearWheel />} image={A('icons/newyear-hero.jpg')} title={`${year}${t('newyear.title', '신년운세')}`} sub={t('newyear.heroSub', '올 한 해의 큰 흐름을 한눈에')} themeColor={colors.ju} />

        {/* ★연도 선택 — 올해/내년(daniel 2026-07-29). 연도별로 캐시·결제가 분리된다. */}
        <View style={styles.yearRow}>
          {YEARS.map((y) => {
            const on = y === year;
            return (
              <PressableScale key={y} style={[styles.yearChip, on && styles.yearChipOn]} onPress={() => { if (y !== year) { setYear(y); setReloadKey((k) => k + 1); } }}>
                <Text style={[styles.yearChipTx, on && styles.yearChipTxOn, { fontSize: fs(14) }]}>
                  {y}년{y === thisYear ? ' (올해)' : ' (내년)'}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        {/* ★무료 온디바이스 티저(내년 신수 3층 곱연산 산식 + 큰 삼재 배지 + 길월 달력) — 히어로 아래. ★유료 전환 후크라 '미소유(전체 풀이 없음)'일 때만(daniel 2026-07-24):
            유료로 열린 뒤에도 "깊은 풀이에서 (콕/달별로) 짚어 드려요" 티저 문구가 남아 구매 상태와 모순(IMG_8168 계열·freeHook 12종과 동일 원인). data(전체 풀이) 있으면 숨김.
            시각 미상은 강도(원국↔세운 합충) 판정에서 시주를 빼도록 timeUnknown 병합해 전달(코드베이스 관례). */}
        {c?.saju && !data && <NewyearTeaser saju={c.saju} timeUnknown={saved?.input?.timeAccuracy === '미상'} />}

        {!loaded ? (
          <View style={styles.card}><ActivityIndicator color={colors.ju} /></View>
        ) : !saved ? (
          <View style={styles.card}>
            <Text style={styles.body}>{t('manse.empty', '등록된 명식이 없습니다.')}</Text>
            <PressableScale style={styles.cta} onPress={() => router.push('/register')}><Text style={styles.ctaTx}>{t('compat.registerMyChart', '명식 등록')}</Text></PressableScale>
          </View>
        ) : data ? (
          <>
            {/* 풀이 보유 만료일 — 공통 컴포넌트(프리미엄 가드·문구·스타일 한 곳, daniel 07-01) */}
            <ExpiryNote expiry={expiry} chartId={chartId} />
            {/* 이슈19 소제목 — 통변 결과 headline 있으면 섹션들 맨 위에 한 줄 강조(keyword와 별개 필드) */}
            {typeof data.headline === 'string' && data.headline.trim() ? (
              <Text style={{ fontSize: fs(19), fontWeight: '800', color: colors.ju, marginBottom: space(3), lineHeight: 26 }}>{data.headline}</Text>
            ) : null}
            {/* ★근본 '풀이 안 보임'(daniel 07-11): base 프로즈만 오면(JSON 파싱 폴백) 명명 키(keyword/yearNature/분야…)가 전부 비어 본문 텅 빔 → base 통째로 표시. */}
            {typeof data.base === 'string' && data.base.trim() ? (
              <View style={styles.card}><ReadingProse text={String(data.base ?? '')} collapsible={false} /></View>
            ) : null}
            {/* 올해의 키워드 + 총평 */}
            {typeof data.keyword === 'string' && (
              <View style={styles.keyCard}>
                <Text style={styles.keyLabel}>{t('newyear.keyword', '올해의 키워드')}</Text>
                <Text style={[styles.keyTx, { fontSize: fs(18) }]}>{data.keyword}</Text>
              </View>
            )}
            {typeof data.summary === 'string' && (
              <View style={styles.card}><ReadingProse text={String(data.summary ?? '')} collapsible={false} /></View>
            )}
            {/* ★올해 간지 특성 + 대운·원국 작용(daniel 07-08) — 상세 분야 전에 '올해는 어떤 해'를 먼저 설명. */}
            {typeof data.yearNature === 'string' && (
              <View style={styles.card}>
                <Text style={styles.sectH}>🗓️ {t('newyear.yearNature', '올해는 어떤 해')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: 26 }]}>{data.yearNature}</Text>
              </View>
            )}
            {/* 올해의 나 — 올 한 해 어떤 사람으로 살아가는지(daniel 07-01) */}
            {typeof data.thisYearSelf === 'string' && (
              <View style={[styles.card, styles.luckyCard]}>
                <Text style={styles.sectH}>🧭 {t('newyear.thisYearSelf', '올해의 나')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: 26 }]}>{data.thisYearSelf}</Text>
              </View>
            )}
            {/* ★올해 좋은 시기 — 콕 집어(daniel: 정확한 시점/날짜). 가장 눈에 띄게 강조 */}
            {typeof data.timing === 'string' && (
              <View style={[styles.card, styles.timingCard]}>
                <Text style={[styles.sectH, { color: colors.bg }]}>📅 {t('newyear.timing', '올해 좋은 시기')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: 26, color: colors.bg }]}>{data.timing}</Text>
              </View>
            )}
            {/* 올해의 행운 포인트 */}
            {typeof data.luckyPoints === 'string' && (
              <View style={[styles.card, styles.luckyCard]}>
                <Text style={styles.sectH}>{t('newyear.lucky', '올해의 행운 포인트')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: 26 }]}>{data.luckyPoints}</Text>
              </View>
            )}

            {/* 분야 8 */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {AREAS.map((a) => (
                <PressableScale key={a.key} style={[styles.chip, area === a.key && styles.chipOn]} onPress={() => setArea(a.key)}>
                  <Text style={[styles.chipTx, area === a.key && styles.chipTxOn]}>{a.ko}</Text>
                </PressableScale>
              ))}
            </ScrollView>
            <View style={styles.areaCard}>
              <View style={styles.areaHead}>
                <Text style={styles.areaTitle}>{AREAS.find((a) => a.key === area)?.ko}</Text>
              </View>
              {/* ★카테고리 월별 흐름(결정론·활성×부합·daniel 07-08) — 선택 분야의 12개월 곡선. 월운 확보 시만 노출 */}
              {catFlow?.hasMonths && Array.isArray(catFlow.flows[area as NewyearCategory]) && (
                <View style={styles.flowWrap}>
                  <MonthFlowGraph scores={catFlow.flows[area as NewyearCategory]} height={124} />
                </View>
              )}
              <Text style={[styles.body, { fontSize: fs(15), lineHeight: 27 }]}>{typeof data[area] === 'string' ? data[area] : t('today.genFail', '풀이 생성에 실패했어요. 잠시 후 다시 시도해 주세요.')}</Text>
            </View>

            {/* 상·하반기 흐름 */}
            {(typeof data.firstHalf === 'string' || typeof data.secondHalf === 'string') && (
              <View style={styles.card}>
                <Text style={styles.sectH}>{t('newyear.halves', '상반기 · 하반기')}</Text>
                {typeof data.firstHalf === 'string' && <Text style={[styles.halfTx, { fontSize: fs(14), lineHeight: 23 }]}><Text style={styles.halfLabel}>상반기  </Text>{data.firstHalf}</Text>}
                {typeof data.secondHalf === 'string' && <Text style={[styles.halfTx, { fontSize: fs(14), lineHeight: 23, marginTop: space(2.5) }]}><Text style={styles.halfLabel}>하반기  </Text>{data.secondHalf}</Text>}
              </View>
            )}

            {/* 12개월 캘린더 */}
            {months.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectH}>{t('newyear.months', '달별 캘린더')}</Text>
                {months.map((m, i) => (
                  <View key={i} style={styles.monthRow}>
                    <View style={[styles.monthBadge, { minWidth: ls(28), minHeight: ls(28) }, { minWidth: ls(28), minHeight: ls(28) }]}><Text style={styles.monthBadgeTx}>{i + 1}</Text></View>
                    <Text style={[styles.monthText, { fontSize: fs(14), lineHeight: 21 }]}>{m.replace(/^\s*\d+\s*월\s*[—\-–·]\s*/, '')}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 올해 개운법(daniel: 신년운세에도 개운법 필수) */}
            {typeof data.remedy === 'string' && (
              <View style={[styles.card, styles.luckyCard]}>
                <Text style={styles.sectH}>🍀 {t('newyear.remedy', '올해 개운법')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: 26 }]}>{data.remedy}</Text>
              </View>
            )}
            {/* 삼재 대처(LLM) */}
            {typeof data.samjaeAdvice === 'string' && (
              <View style={styles.card}>
                <Text style={styles.sectH}>{t('newyear.samjaeAdvice', '올해 특히 챙길 점')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: 26 }]}>{data.samjaeAdvice}</Text>
              </View>
            )}

            {/* 올해 다짐 */}
            {typeof data.resolution === 'string' && (
              <View style={[styles.card, styles.resoCard]}>
                <Text style={styles.sectH}>{t('newyear.resolution', '올해를 이렇게')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: 26 }]}>{data.resolution}</Text>
              </View>
            )}
            {/* 올해의 대응전략(daniel 07-01) — 흐름·과제·기회에 어떻게 대응할지 */}
            {typeof data.strategy === 'string' && (
              <View style={[styles.card, styles.luckyCard]}>
                <Text style={styles.sectH}>♟️ {t('newyear.strategy', '올해의 대응전략')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: 26 }]}>{data.strategy}</Text>
              </View>
            )}
            {/* 풀이 음성 읽기(온디바이스 TTS·무료) — 전체 신년 통변을 순서대로 읽음(months 배열은 자동 제외) */}
            <TTSButton reading={data} />
            {/* 이슈17: 풀이 결과 공유(content 없거나 error면 컴포넌트가 자체 미노출) */}
            <ShareReadingButton kind="newyear" title={t('newyear.title', '신년운세')} content={data} />
          </>
        ) : (
          <View style={styles.gate}>
            <Text style={styles.gateTitle}>{year}{t('newyear.title', '신년운세')}</Text>
            <Text style={styles.gateDesc}>{t('newyear.gateDesc', '올해의 키워드부터 분야별 운, 열두 달 캘린더, 새해 다짐까지 한 번에 정리해 드려요.')}</Text>
            <View style={styles.previewBox}>
              <Text style={styles.previewHead}>{t('special.previewHead', '이런 걸 풀어드려요')}</Text>
              {[t('newyear.pv1', '올해의 키워드'), t('newyear.pv2', '분야별 운 8가지'), t('newyear.pv3', '열두 달 캘린더'), t('newyear.pv4', '상·하반기 흐름'), t('newyear.pv5', '올해 다질 점·새해 다짐')].map((p, i) => <Text key={i} style={styles.previewItem}>· {p}</Text>)}
            </View>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <PressableScale style={styles.gateBtn} onPress={onStart}>
              <Text style={styles.gateBtnTx}>{t('newyear.seePaid', '신년운세 보기 (₩9,900)')}</Text>
            </PressableScale>
          </View>
        )}
              {/* ★이어서 보면 좋은 콘텐츠(daniel 2026-07-27 "전부 붙여") — 화면마다 하단이 달라 보이던 것 통일.
            큐레이션 출처는 RELATED 단일(중복 하드코딩 0). 매핑이 없으면 스스로 아무것도 안 그린다. */}
        <RelatedContent kind="newyear" />
</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // 연도 선택 칩 — 올해/내년(연도별 캐시·결제 분리)
  // ★아래 간격을 4pt → 16pt(daniel 2026-08-04 IMG_8352 "년도 밑에 간격이 너무 좁아").
  //   위(marginTop 12)와 아래(4)가 어긋나 탭이 아래 카드에 붙어 보였다 —
  //   연도 탭은 '무엇을 볼지 고르는' 구획이라 아래와 확실히 떨어져야 선택이 읽힌다.
  //   ⚠️바로 아래 티저 카드는 **탭 선택과 무관하게 '내년'** 기준이라(위 주석 277행),
  //     붙어 있으면 '2026 선택인데 2027 내용'으로 오해를 준다. 간격이 그 구분도 돕는다.
  yearRow: { flexDirection: 'row', gap: space(2), marginTop: space(3), marginBottom: space(4) },
  yearChip: { flex: 1, paddingVertical: space(2.5), borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center' },
  yearChipOn: { borderColor: colors.ju, backgroundColor: colors.juSoft },
  yearChipTx: { ...font.body, color: colors.inkSoft, fontWeight: '700' },
  yearChipTxOn: { color: colors.ju, fontWeight: '800' },
  bg: { flex: 1, backgroundColor: 'transparent' }, // 전역 ContentBackdrop 비쳐 보이게(07-20 배경통일 누락분)
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  h: { ...font.title, color: colors.ink, marginBottom: space(3) },
  keyCard: { backgroundColor: colors.ju, borderRadius: radius.md, padding: space(5), marginBottom: space(3), ...shadow.card },
  keyLabel: { fontSize: 12, fontWeight: '800', color: colors.bg, opacity: 0.8, marginBottom: space(1.5), letterSpacing: 1 },
  keyTx: { fontSize: 18, fontWeight: '900', color: colors.bg, lineHeight: 26 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  resoCard: { borderColor: colors.ju, borderWidth: 1.5 },
  body: { ...font.body, color: colors.ink, lineHeight: 26, fontSize: 15 },
  sectH: { fontSize: 15, fontWeight: '800', color: colors.ju, marginBottom: space(3) },
  luckyCard: { borderColor: colors.ju, borderWidth: 1.5 },
  timingCard: { backgroundColor: colors.ju, borderColor: colors.ju }, // 올해 좋은 시기 — 금색 강조(daniel: 가장 눈에 띄게)
  halfTx: { ...font.body, color: colors.ink },
  halfLabel: { color: colors.ju, fontWeight: '800' },
  chips: { gap: space(2), paddingVertical: space(1), marginBottom: space(2) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingHorizontal: space(3.5), paddingVertical: space(2.25), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipIcon: { fontSize: 14 },
  chipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  chipTxOn: { color: colors.bg },
  monthTx: { ...font.body, color: colors.ink, marginBottom: space(2) },
  // 선택 분야 카드(아이콘 헤더 + 내용) — 가독성(daniel)
  areaCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  areaHead: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), marginBottom: space(3), paddingBottom: space(3), borderBottomWidth: 1, borderBottomColor: colors.juLine },
  // 카테고리 월별 흐름 그래프 래퍼(분야명 아래·본문 위)
  flowWrap: { marginBottom: space(4), paddingBottom: space(3.5), borderBottomWidth: 1, borderBottomColor: colors.juLine },
  flowNote: { ...font.caption, color: colors.inkFaint, marginTop: space(1.5), textAlign: 'center' },
  areaIcon: { fontSize: 26 },
  areaTitle: { fontSize: 18, fontWeight: '900', color: colors.ink },
  // 12달 캘린더 — 월 배지 + 내용 행
  monthRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3), marginBottom: space(3) },
  monthBadge: { borderRadius: 14, backgroundColor: colors.badgeGold, alignItems: 'center', justifyContent: 'center', marginTop: space(0.5) },
  monthBadgeTx: { color: colors.bg, fontSize: 13, fontWeight: '900' },
  monthText: { flex: 1, ...font.body, color: colors.ink },
  wait: { ...font.caption, color: colors.inkSoft, marginTop: space(2), textAlign: 'center' },
  gate: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, borderStyle: 'dashed', padding: space(6), alignItems: 'center', ...shadow.card },
  gateTitle: { ...font.heading, color: colors.ink },
  gateDesc: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(2.5), marginBottom: space(5), lineHeight: 22 },
  previewBox: { width: '100%', backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(5) },
  previewHead: { fontSize: 13, fontWeight: '800', color: colors.ju, marginBottom: space(2), letterSpacing: 0.5 },
  previewItem: { ...font.body, color: colors.inkSoft, lineHeight: 24, fontSize: 14 },
  gateBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(3.25) },
  gateBtnTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  err: { fontSize: 13, color: colors.ju, marginBottom: space(3), textAlign: 'center' },
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(6), marginTop: space(4), alignSelf: 'center' },
  ctaTx: { color: colors.bg, fontWeight: '800' },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4) },
});
