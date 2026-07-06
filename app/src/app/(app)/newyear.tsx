// src/app/(app)/newyear.tsx — 신년운세 패키지 (스페셜) — 신년 전용 LLM(연운과 분리)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-06 '신년 전용 차별화': 타임라인(연도 탐색)과 포지션 분리. 올해 1년에만 몰입한 시즌 상품.
//   = 올해의 키워드 + 새해 총평 + 분야 5(통합·직업·재물·애정·건강) + 12개월 캘린더 + 삼재 대처 + 올해 다짐.
//   Edge kind='newyear'(NEWYEAR_READING_SYSTEM) · 캐시 category='newyear_YYYY'(연운 year_YYYY와 안 겹침).
//   삼재(lib/samjae 온디바이스)는 배지로 즉시 표시 + body로 Edge에 전달(LLM 대처문 samjaeAdvice 생성).
//   접근: 프리미엄=무광고 자동 / 비프리미엄=결제(이용권·관리자)만 — 유료 콘텐츠라 보상형 광고 무료 생성 없음(daniel). §4 안전: 삼재=흉 단정 금지(전향적).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, ImageBackground } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { ExpiryNote } from '../../components/ExpiryNote'; // 보유 만료일 공통(프리미엄 가드 한 곳)
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getDailyFortune } from '../../lib/content/dailyFortune';
import { loadRepChart, type SavedChart } from '../../lib/engine/myChart';
import { ensureServerChartId } from '../../lib/backend/prewarmReadings';
import { computeChart } from '../../lib/engine/engine';
import { samjaeStatus } from '../../lib/engine/samjae';
import { useAuth } from '../../lib/useAuth';
import { useSubscription } from '../../lib/billing/subscription';
import { Alert } from '../../lib/ui/alert';
import { loadCredits } from '../../lib/billing/coupons';
import { isAdmin } from '../../lib/core/admin'; // 스페셜 = 관리자 바로 / 그 외 쿠폰(크레딧)만
import { requireLoginForPurchase } from '../../lib/billing/requireLogin';
import { confirmReadingChart } from '../../lib/ui/confirmChart'; // 생성 전 명식 확인 + 보유 이용권 안내(daniel)
import { supabase } from '../../lib/supabase';
import { appLang } from '../../lib/i18n';
import { invokeFail } from '../../lib/backend/interpretResult'; // 방어: Edge 실패(일시적 불가·결제필요·오류) 정규화
import { assertOnline } from '../../lib/backend/network'; // daniel: 네트워크/서버 미연결 시 풀이 생성 차단
import { logEvent } from '../../lib/backend/logger';
import { setGenProgress } from '../../lib/backend/genProgress'; // 일회성 컨텐츠 진행도(daniel 이슈15)
import { bgSource, colors, radius, space, shadow, font } from '../../lib/theme';
import { UnlockOverlay } from '../../components/UnlockOverlay'; // unlock 자물쇠 애니 + 그 사이 LLM 분석
import { ContentHero } from '../../components/SpecialContentScreen'; // 공용 히어로
import { ChartPicker } from '../../components/ChartPicker'; // 상단 명식 헤더 — 현재 적용 명식 표시·전환
import { ShareReadingButton } from '../../components/ShareReadingButton'; // 이슈17: 풀이 결과 공유(가드 내장)
import { TTSButton } from '../../components/TTSButton'; // 풀이 음성 읽기(온디바이스 TTS·무료)
import { NewyearWheel } from '../../components/contentMotifs'; // 12달 수레바퀴 모티프
import { NewyearTeaser } from '../../components/NewyearTeaser'; // 무료 온디바이스 티저(내년 신수 3층 산식 + 큰 삼재 배지 + 길월) — 유료 전환 후크
import { useFontScale } from '../../lib/ui/fontScale';

// 신년 패키지 분야 8(daniel: 컨텐츠 강화 — 통합·직업·재물·애정·건강·대인·배움·이동)
const AREAS: { key: string; ko: string }[] = [
  { key: 'general', ko: '통합' }, { key: 'work', ko: '직업' }, { key: 'money', ko: '재물' },
  { key: 'love', ko: '애정' }, { key: 'marriage', ko: '결혼' }, { key: 'health', ko: '건강' },
  { key: 'social', ko: '대인' }, { key: 'growth', ko: '배움' }, { key: 'move', ko: '이동' },
];

export default function NewYearScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const f = useMemo(() => getDailyFortune(), []);
  const year = Number(f.date.slice(0, 4));
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

  const category = `newyear_${year}`; // 연운(year_YYYY)과 분리된 신년 전용 캐시
  // 대표 명식의 결정론 차트(무료 티저 + 삼재 산출 공용). computeChart 는 엔진 캐시라 재호출 저렴.
  const c = useMemo(() => (saved ? computeChart(saved.input) : null), [saved]);
  // 삼재(온디바이스) — 태어난 해 지지 vs 올해 지지. ★유료 통변(Edge) body 로 전달용(올해 기준). 화면 배지는 NewyearTeaser(내년)로 이관.
  const samjae = useMemo(() => {
    const yb = c?.saju.pillars['년']?.branch;
    return yb ? samjaeStatus(yb, yearBranch) : null;
  }, [c, yearBranch]);

  const uid = session?.user?.id ?? null; // ★deps 안정화 — session 객체 참조가 아닌 user.id로(재발행 깜빡임 방지, daniel 07-02)
  useEffect(() => {
    let alive = true;
    // ★재실행 시 화면을 비우지 않는다(구매화면↔풀이화면 깜빡임 근본): 새 값을 받은 뒤에만 교체.
    //   (기존엔 시작 시 setData(null)+setLoaded(false)로 blank → 캐시 재세팅을 반복해 깜빡였음)
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setSaved(ch);
      if (!ch || !uid) { setData(null); setLoaded(true); return; }
      const c = computeChart(ch.input);
      const id = await ensureServerChartId(c, ch.input, session!, ch);
      if (!alive || !id) { setLoaded(true); return; }
      setChartId(id);
      const { data: row } = await supabase.from('readings').select('content, created_at').eq('chart_id', id).eq('category', category).eq('lang', appLang()).maybeSingle();
      if (!alive) return;
      const cached = (row?.content as Record<string, any> | undefined) ?? null;
      setData(cached);
      // 보유 만료일(daniel #25): 생성(구매)일 + 1년. 캐시 created_at 있을 때만(명식 전환 시 stale 방지 위해 else로 초기화).
      if (row?.created_at) { const d = new Date(row.created_at); d.setFullYear(d.getFullYear() + 1); setExpiry(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`); } else setExpiry(null);
      setLoaded(true);
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, category, isPremium, reloadKey]);

  // invoke 타임아웃/실패 시 readings 캐시를 폴링해 결과 회수(Edge가 서버에서 계속 생성·캐시하므로).
  //   무거운 신년 풀이(원국+대운+세운 종합)는 Edge 생성이 87~103s → 클라 invoke가 먼저 끊겨도('Failed to send request')
  //   서버는 완료·캐시함. 그 캐시를 폴링해 로딩 유지한 채 결과를 받아온다(멈춤·"갑자기 완료" 해결, daniel 07-02).
  //   category 는 동적(newyear_YYYY)이라 인자로 받는다.
  async function pollCachedReading(id: string, cat: string, maxMs = 135000, everyMs = 3500): Promise<any | null> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, everyMs));
      const { data } = await supabase.from('readings').select('content').eq('chart_id', id).eq('category', cat).eq('lang', appLang()).maybeSingle();
      if (data?.content) return data.content;
    }
    return null;
  }

  async function generate(id: string) {
    if (!assertOnline(t)) return; // daniel: 오프라인이면 풀이 진입(Edge 생성) 차단
    if (busy) return;
    setBusy(true); setErr(null);
    setGenProgress({ active: true, total: 1, done: 0, label: t('newyear.title', '신년운세'), route: '/newyear' }); // 일회성=진행도 측정 어려움 → '풀이 중'(daniel 이슈15)
    logEvent('newyear_generate', { chartId: id, category });
    try {
      // 신년 전용 — kind='newyear' + 삼재(온디바이스 계산값) body 전달
      const { data: res, error } = await supabase.functions.invoke('interpret', {
        body: { chartId: id, category, kind: 'newyear', samjae: samjae ?? undefined, tier: 'paid', lang: appLang(), ...(saved?.context ? { context: saved.context } : {}) },
      });
      const f = invokeFail(res, error); // 방어: 일시적 불가→재시도 안내 / 결제필요·오류 일관 처리
      if (f && f.kind !== 'error') {
        // unavailable/needPayment = 200 빠른 실패(Edge가 긴 생성을 시작 안 함) → 폴링 없이 즉시 친화 문구
        logEvent('newyear_fail', { kind: f.kind, message: error?.message }, 'error');
        setErr(f.message);
      } else if (error || !res?.reading) {
        // ★클라 invoke가 끊기거나(무거운 풀이 타임아웃) 응답이 비어도 Edge는 서버에서 완료·캐시 → 캐시 폴링으로 회수(로딩 유지).
        logEvent('newyear_fail', { kind: 'timeout', message: error?.message ?? 'no reading', polling: true }, 'error');
        const cached = await pollCachedReading(id, category);
        if (cached) setData(cached);
        else setErr(f?.message ?? t('today.genFail', '생성에 실패했어요. 잠시 후 다시 시도해 주세요.'));
      } else setData((res?.reading as Record<string, any>) ?? null);
    } catch (e: any) {
      // fetch throw(타임아웃 등)도 동일 — 서버가 완료·캐시했으면 폴링으로 회수, 아니면 오류 표시.
      logEvent('newyear_throw', { message: String(e?.message ?? e) }, 'error');
      const cached = await pollCachedReading(id, category);
      if (cached) setData(cached);
      else setErr(t('today.genFail', '생성에 실패했어요. 잠시 후 다시 시도해 주세요.'));
    }
    setGenProgress({ route: '/newyear', done: 1, total: 1 }); // 완료 → 홈 배너 '풀이 보기' 이동버튼(daniel 이슈15)
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
      const admin = await isAdmin();                                                // 관리자 = 바로 진입
      if (!admin) {
        if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
        const credits = await loadCredits();                                        // 쿠폰(이용권)만 unlock — 결제 미연동
        if ((credits['newyear'] ?? 0) <= 0) { Alert.alert(t('newyear.title', '신년운세'), t('special.couponOnly', '쿠폰(이용권)으로 열 수 있어요. 설정에서 쿠폰을 등록하거나 관리자에게 문의하세요.')); return; }
      }
    } catch (e: any) { logEvent('newyear_gate_error', { message: String(e?.message ?? e) }, 'error'); return; }
    finally { gatingRef.current = false; }
    generate(chartId);                                                              // 관리자·프리미엄=우회 / 크레딧=서버 차감
  }

  const months: string[] = Array.isArray(data?.months) ? data!.months : [];

  return (
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        {/* 상단 명식 헤더 — 현재 적용된 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단). 전환 시 그 명식 기준 재로드 */}
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
        <UnlockOverlay visible={busy} message={t('newyear.generating', '올 한 해를 풀어내는 중…')} />
        <ContentHero motif={<NewyearWheel />} image={require('../../../assets/icons/newyear-hero.jpg')} title={`${year}${t('newyear.title', '년 신년운세')}`} sub={t('newyear.heroSub', '올 한 해의 큰 흐름을 한눈에')} themeColor={colors.ju} />

        {/* ★무료 온디바이스 티저(내년 신수 3층 곱연산 산식 + 큰 삼재 배지 + 길월 달력) — 히어로 아래·잠김/열림 무관 항상 노출.
            love.tsx가 게이지/곡선을 히어로 아래 항상 노출하는 배치를 신년에 적용(유료 전환 후크). 내년(curYear+1) 기준.
            시각 미상은 강도(원국↔세운 합충) 판정에서 시주를 빼도록 timeUnknown 병합해 전달(코드베이스 관례). */}
        {c?.saju && <NewyearTeaser saju={c.saju} timeUnknown={saved?.input?.timeAccuracy === '미상'} />}

        {!loaded ? (
          <View style={styles.card}><ActivityIndicator color={colors.ju} /></View>
        ) : !saved ? (
          <View style={styles.card}>
            <Text style={styles.body}>{t('manse.empty', '먼저 명식을 등록해 주세요.')}</Text>
            <PressableScale style={styles.cta} onPress={() => router.push('/register')}><Text style={styles.ctaTx}>{t('compat.registerMyChart', '내 명식 등록')}</Text></PressableScale>
          </View>
        ) : data ? (
          <>
            {/* 풀이 보유 만료일 — 공통 컴포넌트(프리미엄 가드·문구·스타일 한 곳, daniel 07-01) */}
            <ExpiryNote expiry={expiry} chartId={chartId} />
            {/* 이슈19 소제목 — 통변 결과 headline 있으면 섹션들 맨 위에 한 줄 강조(keyword와 별개 필드) */}
            {typeof data.headline === 'string' && data.headline.trim() ? (
              <Text style={{ fontSize: fs(19), fontWeight: '800', color: colors.ju, marginBottom: space(3), lineHeight: fs(26) }}>{data.headline}</Text>
            ) : null}
            {/* 올해의 키워드 + 총평 */}
            {typeof data.keyword === 'string' && (
              <View style={styles.keyCard}>
                <Text style={styles.keyLabel}>{t('newyear.keyword', '올해의 키워드')}</Text>
                <Text style={[styles.keyTx, { fontSize: fs(18) }]}>{data.keyword}</Text>
              </View>
            )}
            {typeof data.summary === 'string' && (
              <View style={styles.card}><Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(26) }]}>{data.summary}</Text></View>
            )}
            {/* 올해의 나 — 올 한 해 어떤 사람으로 살아가는지(daniel 07-01) */}
            {typeof data.thisYearSelf === 'string' && (
              <View style={[styles.card, styles.luckyCard]}>
                <Text style={styles.sectH}>🧭 {t('newyear.thisYearSelf', '올해의 나')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(26) }]}>{data.thisYearSelf}</Text>
              </View>
            )}
            {/* ★올해 좋은 시기 — 콕 집어(daniel: 정확한 시점/날짜). 가장 눈에 띄게 강조 */}
            {typeof data.timing === 'string' && (
              <View style={[styles.card, styles.timingCard]}>
                <Text style={[styles.sectH, { color: colors.bg }]}>📅 {t('newyear.timing', '올해 좋은 시기')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(26), color: colors.bg }]}>{data.timing}</Text>
              </View>
            )}
            {/* 올해의 행운 포인트 */}
            {typeof data.luckyPoints === 'string' && (
              <View style={[styles.card, styles.luckyCard]}>
                <Text style={styles.sectH}>{t('newyear.lucky', '올해의 행운 포인트')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(26) }]}>{data.luckyPoints}</Text>
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
              <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(27) }]}>{typeof data[area] === 'string' ? data[area] : t('today.genFail', '생성 실패')}</Text>
            </View>

            {/* 상·하반기 흐름 */}
            {(typeof data.firstHalf === 'string' || typeof data.secondHalf === 'string') && (
              <View style={styles.card}>
                <Text style={styles.sectH}>{t('newyear.halves', '상반기 · 하반기')}</Text>
                {typeof data.firstHalf === 'string' && <Text style={[styles.halfTx, { fontSize: fs(14), lineHeight: fs(23) }]}><Text style={styles.halfLabel}>상반기  </Text>{data.firstHalf}</Text>}
                {typeof data.secondHalf === 'string' && <Text style={[styles.halfTx, { fontSize: fs(14), lineHeight: fs(23), marginTop: space(2.5) }]}><Text style={styles.halfLabel}>하반기  </Text>{data.secondHalf}</Text>}
              </View>
            )}

            {/* 12개월 캘린더 */}
            {months.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.sectH}>{t('newyear.months', '달별 캘린더')}</Text>
                {months.map((m, i) => (
                  <View key={i} style={styles.monthRow}>
                    <View style={styles.monthBadge}><Text style={styles.monthBadgeTx}>{i + 1}</Text></View>
                    <Text style={[styles.monthText, { fontSize: fs(14), lineHeight: fs(21) }]}>{m.replace(/^\s*\d+\s*월\s*[—\-–·]\s*/, '')}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 올해 개운법(daniel: 신년운세에도 개운법 필수) */}
            {typeof data.remedy === 'string' && (
              <View style={[styles.card, styles.luckyCard]}>
                <Text style={styles.sectH}>🍀 {t('newyear.remedy', '올해 개운법')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(26) }]}>{data.remedy}</Text>
              </View>
            )}
            {/* 삼재 대처(LLM) */}
            {typeof data.samjaeAdvice === 'string' && (
              <View style={styles.card}>
                <Text style={styles.sectH}>{t('newyear.samjaeAdvice', '올해 특히 챙길 점')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(26) }]}>{data.samjaeAdvice}</Text>
              </View>
            )}

            {/* 올해 다짐 */}
            {typeof data.resolution === 'string' && (
              <View style={[styles.card, styles.resoCard]}>
                <Text style={styles.sectH}>{t('newyear.resolution', '올해를 이렇게')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(26) }]}>{data.resolution}</Text>
              </View>
            )}
            {/* 올해의 대응전략(daniel 07-01) — 흐름·과제·기회에 어떻게 대응할지 */}
            {typeof data.strategy === 'string' && (
              <View style={[styles.card, styles.luckyCard]}>
                <Text style={styles.sectH}>♟️ {t('newyear.strategy', '올해의 대응전략')}</Text>
                <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(26) }]}>{data.strategy}</Text>
              </View>
            )}
            {/* 풀이 음성 읽기(온디바이스 TTS·무료) — 전체 신년 통변을 순서대로 읽음(months 배열은 자동 제외) */}
            <TTSButton reading={data} />
            {/* 이슈17: 풀이 결과 공유(content 없거나 error면 컴포넌트가 자체 미노출) */}
            <ShareReadingButton kind="newyear" title={t('newyear.title', '신년운세')} content={data} />
          </>
        ) : (
          <View style={styles.gate}>
            <Text style={styles.gateTitle}>{year}{t('newyear.title', '년 신년운세')}</Text>
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
        <Text style={styles.note}>{t('newyear.bottomNote', '※ 올 한 해의 큰 흐름이에요. 매일의 운세는 \'오늘의 운세\'에서 확인하세요.')}</Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
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
  areaIcon: { fontSize: 26 },
  areaTitle: { fontSize: 18, fontWeight: '900', color: colors.ink },
  // 12달 캘린더 — 월 배지 + 내용 행
  monthRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3), marginBottom: space(3) },
  monthBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.ju, alignItems: 'center', justifyContent: 'center', marginTop: space(0.5) },
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
