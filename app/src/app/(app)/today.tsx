// src/app/(app)/today.tsx — 오늘의 운세 (LLM 통변, ADR 개정 2026-06)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 단순 룰("군겁쟁재→돈나간다") 말고, 원국+대운+세운+오늘 일진의 형충화합을 *종합*해
//   생길 이슈와 대처까지 일반인도 쉽게 — Edge kind='daily'(DAILY_READING_SYSTEM).
// 접근(하이브리드·절대규칙5 무료=룰 복원 / API 역마진 제거):
//   · 무료 기본 = 온디바이스 룰 5분야(getDailyReading) *즉시* 표시 — interpret 호출 0(광고·로그인도 불필요).
//   · 프리미엄 = 무광고 LLM 자동 생성(유료·비용 정합).
//   ★2026-07-26(daniel "이미 풀이가 나와있는데 ai정밀 풀이는 빼"): **무료 'AI 정밀 풀이' 보상형 광고 업셀 제거.**
//     이유 ①이미 온디바이스 룰 풀이가 화면에 나와 있는데 그 아래 "AI가 더 깊게 풀어 드려요"가 또 떠서
//     사용자가 "지금 보고 있는 건 뭔가?" 혼란 ②광고 no-fill 시 "광고를 불러오지 못했어요" 실패 문구가
//     그대로 노출돼 첫 화면 인상이 나빠짐 ③무엇보다 **"유료(비용발생) 통변은 보상형 광고로 무료 생성하지
//     않는다"가 이미 daniel 방침**(2026-07)이라 이 경로는 그 방침 이전의 잔존물이었다.
//     → 무료 = 온디바이스 룰 풀이로 완결 / 더 깊은 건 프리미엄·유료 콘텐츠(하단 RelatedContent 크로스셀).
//   → LLM(reading)이 있으면 그것, 없으면 룰(ruleReading)을 표시(shown = reading ?? ruleReading).
// 캐시: readings(chart_id × 'daily_YYYYMMDD' × lang) — 하루 1회만 생성(재방문 비용 0).
//   ★본문은 일상어만(한자·명리 용어 미노출 — 프롬프트가 강제). 명식 없으면 등록 유도.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { A } from '../../lib/ui/remoteAsset'; // ★이미지 원격화(daniel 08-01) — 번들에서 걷어내고 Storage 에서 받는다
import { Reveal } from '../../components/Reveal'; // 분야 전환 시 풀이 크로스페이드(daniel 재미)
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getDailyFortune, DAILY_AREA_KEYS, dailyHeadline, getDailyReading, scoreFlow, dailyEnergy, energyReason, ENERGY_LABEL, type DailyAreaKey } from '../../lib/content/dailyFortune';
import { ScoreFlowGraph } from '../../components/ScoreFlowGraph'; // 점수 흐름 그래프(그제~모레, daniel 07-13)
import { loadRepChart, type SavedChart } from '../../lib/engine/myChart';
import { ensureServerChartId } from '../../lib/backend/prewarmReadings';
import { computeChart } from '../../lib/engine/engine';
import { useAuth } from '../../lib/useAuth';
import { useSubscription } from '../../lib/billing/subscription';
import { autoGenWithChartConfirm } from '../../lib/ui/confirmChart'; // 자동생성 전 명식 확인(명식 2개+ 일 때, daniel 07-13)
import { supabase } from '../../lib/supabase';
import { withTimeout, GEN_TIMEOUT_MS } from '../../lib/core/withTimeout';   // ★대기 상한(멈춤 방지·2026-07-31)
import { excludeMock } from '../../lib/core/testMode'; // ★목업(tier='mock') 제외(테스트모드 OFF) — 실모드 목업 서빙 차단
import { readingLang } from '../../lib/i18n';
import { logEvent } from '../../lib/backend/logger';
import { invokeFail } from '../../lib/backend/interpretResult'; // 방어: 일시적 불가/오류 친화 처리
import { assertOnline } from '../../lib/backend/network'; // daniel: 네트워크/서버 미연결 시 풀이 생성 차단
import type { Stem, Branch } from '@spec/chart';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { stemElement, branchElement, elementColor, elementText, stemReading, branchReading, stemYinYang, branchYinYang } from '../../lib/engine/ohaeng';
import { ContentHero } from '../../components/SpecialContentScreen'; // 이미지 히어로(보는 맛)
import { HourFlowCard } from '../../components/HourFlowCard'; // 「오늘의 시간대」 12시진(무료·온디바이스·API 0)
import { ChartPicker } from '../../components/ChartPicker'; // 명식 선택(대표 전환) — 명식별 오늘 운세(daniel)
import { ShareReadingButton } from '../../components/ShareReadingButton'; // 이슈17: 풀이 결과 공유(가드 내장)
import { DailyLogCard } from '../../components/DailyLogCard'; // 리텐션: 오늘의 미션 체크 + 적중 회고(daniel 07-19)
import { TTSButton } from '../../components/TTSButton'; // daniel: 풀이 음성 읽기(온디바이스 TTS·무료)
import { RelatedContent } from '../../components/RelatedContent'; // 오늘운세 하단 연관 콘텐츠 추천(개운·애정 동선·API 0)
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회 기록
import { useReadBody } from '../../components/WebShell'; // ★읽는 화면 본문 캡(히어로는 전폭·글은 좁게)

export default function TodayScreen() {
  const readBody = useReadBody();   // 넓은 웹에서만 본문 폭을 묶는다
  useLogContentVisit('daily'); // 진입 1회 방문 기록(daniel 2026-07-06)
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const params = useLocalSearchParams<{ offset?: string }>();
  const [dayOffset, setDayOffset] = useState(params.offset === '1' ? 1 : 0); // 0=오늘·1=내일
  const f = useMemo(() => getDailyFortune(dayOffset), [dayOffset]);
  const [saved, setSaved] = useState<SavedChart | null>(null);
  const [, setChartId] = useState<string | null>(null);
  const [reading, setReading] = useState<Record<string, string> | null>(null); // 5분야 LLM 결과
  const [area, setArea] = useState<DailyAreaKey>('general');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // ChartPicker 로 명식(대표) 전환 시 재로드 트리거

  const stem = f.dayGanZhi[0] as Stem;
  const branch = f.dayGanZhi[1] as Branch;
  const category = `daily_${f.date.replace(/-/g, '')}`; // daily_YYYYMMDD (일별 캐시 키)
  // 오늘의 기운 한 줄 타이틀(온디바이스) — 오늘(또는 내일) 일진 기준. 명식 있으면 즉시.
  const headline = useMemo(() => { if (!saved) return null; try { return dailyHeadline(computeChart(saved.input).saju, stem, branch); } catch { return null; } }, [saved, stem, branch]);
  // 무료 기본 = 온디바이스 룰 5분야 풀이(LLM 0·즉시). 명식만 있으면 계산 — 로그인/서버 불필요(절대규칙5).
  const ruleReading = useMemo(() => { if (!saved) return null; try { return getDailyReading(computeChart(saved.input).saju, stem, branch, 'day'); } catch { return null; } }, [saved, stem, branch]);
  // 오늘 점수 흐름(그제~모레 5일) — 온디바이스 결정론. 상단 그래프(daniel 07-13)
  const flow = useMemo(() => { if (!saved) return null; try { return scoreFlow(computeChart(saved.input).saju, 'day'); } catch { return null; } }, [saved]);
  // ★2026-08-19 홈에서 옮겨 온 것 — 홈 카드를 시안 p04 대로 압축하면서 **지우지 않고 여기로** 데려왔다.
  //   기운 유형명·설명 · 억부 근거 · 작용/신살 칩. 상세 화면이 이것들의 제자리다.
  const energy = useMemo(() => {
    if (!saved) return null;
    try { return dailyEnergy(computeChart(saved.input).saju, stem, branch); } catch { return null; }
  }, [saved, stem, branch]);
  // 실제 표시 풀이: LLM 결과(프리미엄/광고)가 있으면 그것, 없으면 무료 룰 기본.
  const shown = reading ?? ruleReading;

  // 대표 명식 → 서버차트 → 그날 캐시 로드. 프리미엄 + 캐시 없으면 자동 생성.
  useEffect(() => {
    let alive = true;
    setReading(null); setErr(null); setLoaded(false);
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setSaved(ch);
      if (!ch || !session) { setLoaded(true); return; }
      const c = computeChart(ch.input);
      const id = await ensureServerChartId(c, ch.input, session, ch);
      if (!alive || !id) { setLoaded(true); return; }
      setChartId(id);
      const { data } = await excludeMock(supabase.from('readings').select('content').eq('chart_id', id).eq('category', category).eq('lang', readingLang())).maybeSingle();
      if (!alive) return;
      const cached = (data?.content as Record<string, string> | undefined) ?? null;
      setReading(cached);
      setLoaded(true);
      if (isPremium && !cached) void autoGenWithChartConfirm({ onConfirm: () => generate(id) }); // 프리미엄 자동 생성 — 명식 2개+ 면 '어느 명식?' 먼저(daniel 07-13)
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, category, isPremium, reloadKey]);

  // LLM 생성 — 오늘 간지(gz)를 body 로 전달(Edge가 원국+대운+세운과 종합). 캐시는 Edge가 저장.
  async function generate(id: string) {
    if (!assertOnline(t)) return; // daniel: 오프라인이면 풀이 진입(Edge 생성) 차단
    if (busy) return;
    setBusy(true); setErr(null);
    // 오늘/이달 운세는 홈 풀이 진행률 배너에 띄우지 않는다(daniel 07-05 — 저비용 단발이라 노티 불필요).
    logEvent('daily_generate', { chartId: id, category });
    try {
      const __inv = await withTimeout(supabase.functions.invoke('interpret', {
        body: { chartId: id, category, kind: 'daily', gz: f.dayGanZhi, tier: 'paid', lang: readingLang(), ...(saved?.context ? { context: saved.context } : {}) },
      }), GEN_TIMEOUT_MS);
      const { data, error } = __inv ?? { data: null, error: { message: 'client timeout' } as any };      // 방어: 일시적 불가(200+unavailable)/오류 모두 친화 메시지로 처리(원문 'non-2xx' 노출 방지)
      const fail = invokeFail(data, error);
      if (fail) { logEvent(fail.kind === 'unavailable' ? 'daily_unavailable' : 'daily_error', { message: fail.message, retryAt: fail.retryAt }, 'error'); setErr(fail.message); }
      else setReading((data?.reading as Record<string, string>) ?? null);
    } catch (e: any) { logEvent('daily_throw', { message: String(e?.message ?? e) }, 'error'); setErr(t('today.genFail', '풀이 생성에 실패했어요. 잠시 후 다시 시도해 주세요.')); }
    setBusy(false);
  }

  // 일진 미니 칩(오행색)
  const gzChip = (g: string, kind: 'stem' | 'branch') => {
    const el = kind === 'stem' ? stemElement(g) : branchElement(g);
    const ko = kind === 'stem' ? stemReading(g) : branchReading(g);
    const yy = kind === 'stem' ? stemYinYang(g) : branchYinYang(g); // daniel: 음양 표시
    return (
      <View style={[styles.gzChip, { backgroundColor: elementColor[el] }]}>
        <Text style={[styles.gzChipTx, { color: elementText[el] }]}>{g}</Text>
        <Text style={[styles.gzChipKo, { color: elementText[el] }]}>{ko} {yy}</Text>
      </View>
    );
  };

  return (
    <View style={styles.bgImage}>
      <ScrollView
        style={styles.overlay} contentContainerStyle={styles.wrap}
        // 하단 DailyLogCard 의 회고 입력창이 키보드에 덮이지 않게(iOS 자동 인셋) — daniel 07-18 표준 · check:keyboard.
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        <ContentHero image={A('icons/today.jpg')} title={t('today.title', '오늘의 운세')} sub={t('today.heroSub', '오늘 일진으로 보는 하루 흐름')} />
      {/* ★본문 캡 — 히어로는 지면 전체, 글은 좁게(브런치 방향). 폰은 undefined 라 그대로 지나간다. */}
      <View style={readBody}>
        {/* 명식 선택 — 대표 전환 시 그 명식 기준으로 오늘의 운세 재로드(daniel: 명식별 적용) */}
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
        {/* 오늘/내일 토글 */}
        <View style={styles.dayToggle}>
          {([0, 1] as const).map((off) => (
            <PressableScale key={off} style={[styles.dayTogChip, dayOffset === off && styles.dayTogChipOn]} onPress={() => setDayOffset(off)}>
              <Text style={[styles.dayTogTx, dayOffset === off && styles.dayTogTxOn]}>{t(off === 0 ? 'today.today' : 'today.tomorrow')}</Text>
            </PressableScale>
          ))}
        </View>

        {/* 일진 컴팩트 헤더 */}
        <View style={styles.pillarRow}>
          {gzChip(stem, 'stem')}
          {gzChip(branch, 'branch')}
          <View style={styles.pillarInfo}>
            <Text style={styles.pillarTitle}>{dayOffset === 0 ? t('today.dayPillar') : t('today.energyTomorrow')}</Text>
            <Text style={styles.pillarSub}>{f.date} · {f.yearGanZhi}년 {f.monthGanZhi}월</Text>
          </View>
        </View>

        {/* 점수 흐름 그래프(그제~오늘~모레) — 온디바이스 결정론 점수(daniel 07-13). 오늘/내일 토글에 맞춰 강조점 이동. */}
        {flow ? (
          <View style={styles.graphCard}>
            <Text style={styles.graphScore}>{flow.scores[flow.currentIndex + dayOffset] ?? flow.scores[flow.currentIndex]}</Text>
            <Text style={styles.graphScoreCap}>{(dayOffset === 0 ? t('today.today', '오늘') : t('today.tomorrow', '내일'))} 기운 점수</Text>
            <ScoreFlowGraph scores={flow.scores} labels={flow.labels} currentIndex={flow.currentIndex + dayOffset} />
          </View>
        ) : null}

        {/* 오늘 기운의 성격 — 유형명·한 줄 설명 · 왜 그런지(억부 근거) · 작용/신살
            ★홈에서 옮겨 왔다(2026-08-19). 홈은 "몇 점"만, 여기는 "왜 그 점수인지". */}
        {energy ? (
          <View style={styles.energyCard}>
            <Text style={styles.energyName}>{ENERGY_LABEL[energy.group].name}</Text>
            <Text style={styles.energyDesc}>{ENERGY_LABEL[energy.group].desc}</Text>
            <Text style={styles.energyReason}>{energyReason(energy)}</Text>
            {energy.signals.length > 0 ? (
              <View style={styles.energyChips}>
                {energy.signals.map((sg) => (
                  <View key={sg.key} style={[styles.energyChip, sg.kind === 'good' && styles.energyChipGood]}>
                    <Text style={[styles.energyChipTx, sg.kind === 'good' && styles.energyChipTxGood]} numberOfLines={1}>{sg.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 시간대별 흐름(12시진) — 하루 안이 비어 있던 자리(기획 §4 C안). 무료·온디바이스·API 0.
            ★별도 라우트로 빼지 않는다 — 매일 여는 화면 안에 있어야 리텐션에 쓰인다. */}
        {saved ? <HourFlowCard saju={computeChart(saved.input).saju} dateISO={f.date} isToday={dayOffset === 0} /> : null}

        {/* 타이틀 = API 본문 headline 우선(본문과 정합·모순 제거) / 로드 전엔 온디바이스 룰 headline(즉시성) — daniel 07-01 */}
        {(reading?.headline || headline) && (
          <View style={styles.headlineCard}><Text style={styles.headlineTitle}>{reading?.headline || headline}</Text></View>
        )}

        {!loaded ? (
          <View style={styles.readCard}><ActivityIndicator color={colors.ju} /></View>
        ) : !saved ? (
          // 명식 미등록 — 등록 유도(무료 룰 풀이도 원국은 필요)
          <View style={styles.readCard}>
            <Text style={styles.readTx}>{t('today.needChart')}</Text>
            <PressableScale style={styles.regBtn} onPress={() => router.push('/register')}>
              <Text style={styles.regBtnTx}>{t('today.registerBtn')}</Text>
            </PressableScale>
          </View>
        ) : (
          // 명식 있음 → 무료 룰 기본(shown)을 *즉시* 표시(API 0). LLM(프리미엄/광고)이 있으면 우선(shown = reading ?? ruleReading).
          <>
            <View style={styles.areaChips}>
              {DAILY_AREA_KEYS.map((k) => (
                <PressableScale key={k} style={[styles.areaChip, area === k && styles.areaChipOn]} onPress={() => setArea(k)}>
                  <Text style={[styles.areaChipTx, area === k && styles.areaChipTxOn]}>{t(`today.area_${k}`)}</Text>
                </PressableScale>
              ))}
            </View>
            <Reveal key={area} dy={8}>
              <View style={styles.readCard}>
                {busy && !reading ? (
                  // ★생성 중 — 무료 룰 대신 로딩만(무료룰+아래 로딩박스 이중표시 차단, daniel 07-06)
                  <><ActivityIndicator color={colors.ju} /><Text style={styles.genWait}>{t('today.generating', '오늘의 흐름을 풀어내는 중…')}</Text></>
                ) : (
                  // daniel #17: 신규 '투자' 영역이 구(舊) 캐시엔 없을 수 있음 → '실패' 대신 중립 안내
                  <Text style={[styles.readTx, { fontSize: fs(15), lineHeight: 26 }]}>{shown?.[area] || t('today.areaSoon', '이 분야 풀이는 다음 운세부터 채워져요.')}</Text>
                )}
              </View>
            </Reveal>
            {/* 음성으로 듣기(온디바이스 TTS·무료) — 현재 표시본(룰/LLM) 읽기 */}
            {/* TTS·공유 — 생성 중(로딩)엔 숨김(daniel 07-06 이중표시 정리) */}
            {!(busy && !reading) && <TTSButton reading={shown} />}
            {!(busy && !reading) && session ? <ShareReadingButton kind="daily" title={t('today.title', '오늘의 운세')} content={shown} /> : null}
            {/* 오늘의 한 가지 — 결정론으로 뽑은 행동 한 줄. 오늘 탭에서만(내일 것을 미리 보여줄 이유가 없다).
                ★체크 버튼('했어요')은 daniel 2026-07-27 요청으로 제거 — 사용자 입력에 기대는 장치를 걷어냄. */}
            {dayOffset === 0 && saved ? (
              <DailyLogCard
                saju={computeChart(saved.input).saju}
                stem={stem}
                branch={branch}
              />
            ) : null}
          </>
        )}

{/* 오늘운세 하단 → 연관 콘텐츠 추천(개운·애정·직업 동선·daniel 기획서②-피드백) */}
        <RelatedContent kind="daily" />
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, backgroundColor: 'transparent' }, // 전역 ContentBackdrop 이 비쳐 보이게(daniel 07-02)
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  // ★marginTop 추가(daniel 2026-08-13 "여기 아직도 사이 여백이 없네") — 위 시간대별 흐름 카드와 **붙어 있었다.**
  //   카드 **안쪽** 여백은 08-12 에 고쳤는데 **카드 사이**가 남아 있었다(HourFlowCard 는 marginTop 만 갖는다).
  headlineCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, paddingVertical: space(3.5), paddingHorizontal: space(4), marginTop: space(4), marginBottom: space(4), alignItems: 'center', ...shadow.card },
  // 점수 흐름 그래프 카드(daniel 07-13)
  // ── 오늘 기운(홈에서 옮겨 온 블록) ───────────────────────────
  energyCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space(4), marginBottom: space(3), ...shadow.soft },
  energyName: { ...font.heading, color: colors.ink, fontWeight: '900' },
  energyDesc: { ...font.caption, color: colors.inkSoft, marginTop: space(1), lineHeight: 19 },
  energyReason: { ...font.body, color: colors.inkSoft, marginTop: space(2.5), lineHeight: 21 },
  energyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(2.5) },
  energyChip: { borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1), backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line },
  energyChipGood: { backgroundColor: colors.juSoft, borderColor: colors.juLine },
  energyChipTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  energyChipTxGood: { color: colors.ju },
  graphCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, paddingTop: space(4), paddingBottom: space(2), paddingHorizontal: space(2), marginBottom: space(4), alignItems: 'center', ...shadow.card },
  graphScore: { fontSize: 44, fontWeight: '900', color: colors.ju, lineHeight: 48 },
  graphScoreCap: { ...font.caption, color: colors.inkFaint, marginBottom: space(1), fontWeight: '700' },
  headlineTitle: { ...font.body, color: colors.ju, fontWeight: '800', fontSize: 17, textAlign: 'center', lineHeight: 24 },
  dayToggle: { flexDirection: 'row', gap: space(2), marginBottom: space(3) },
  dayTogChip: { paddingHorizontal: space(5), paddingVertical: space(2), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  dayTogChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  dayTogTx: { fontSize: 14, fontWeight: '800', color: colors.inkSoft },
  dayTogTxOn: { color: colors.onJu },
  pillarRow: {
    flexDirection: 'row', alignItems: 'center', gap: space(2.5),
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    padding: space(3.5), marginBottom: space(4), ...shadow.card,
  },
  gzChip: { width: 40, height: 50, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  gzChipTx: { fontSize: 20, fontWeight: '800' },
  gzChipKo: { fontSize: 10, fontWeight: '600', marginTop: -1 },
  pillarInfo: { flex: 1, marginLeft: space(1.5) },
  pillarTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  pillarSub: { ...font.caption, color: colors.inkFaint, marginTop: 2 },
  areaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginBottom: space(3) },
  areaChip: { paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  areaChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  areaChipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  areaChipTxOn: { color: colors.onJu },
  readCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card, alignItems: 'center' },
  readTx: { ...font.body, color: colors.ink, lineHeight: 26, fontSize: 15, alignSelf: 'stretch' },
  genWait: { ...font.caption, color: colors.inkSoft, marginTop: space(2) },
  // 미생성 게이트(광고/프리미엄)
  gateCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, borderStyle: 'dashed', padding: space(6), alignItems: 'center', ...shadow.card },
  gateTitle: { ...font.heading, color: colors.ink },
  gateDesc: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(2.5), marginBottom: space(5), lineHeight: 22 },
  gateBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(3.25) },
  gateBtnTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  err: { fontSize: 13, color: colors.ju, marginBottom: space(3), textAlign: 'center' },
  regBtn: { alignSelf: 'center', marginTop: space(4), backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(4.5), paddingVertical: space(2.25) },
  regBtnTx: { color: colors.bg, fontSize: 14, fontWeight: '800' },
  sub: { ...font.caption, color: colors.inkFaint, textAlign: 'center', lineHeight: 19, marginTop: space(5) },
});
