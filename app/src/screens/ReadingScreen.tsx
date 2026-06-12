// app/src/screens/ReadingScreen.tsx — 전 항목 일괄 풀이 (사주 16영역 / 자미두수 12궁 공용)
// ─────────────────────────────────────────────────────────────────────────
// 한 명식의 여러 항목(사주=영역, 자미두수=궁)을 한 번에 통변해 카드로 표시.
//   categories prop 으로 항목 집합·라벨·종류(kind)를 주입 → 사주/자미 공용(DRY). 기본=사주 16영역.
// 캐시(ADR-052): 명식↔서버 charts.id 매핑(savedChart.serverChartId, 온디바이스)으로 chart_id 안정화
//   → 진입 시 readings(chart_id×category)를 select 해 *생성 없이* 즉시 표시. 없는 항목만 생성.
//   사주/자미는 같은 serverChartId 를 공유하고 category 키(영역명 vs 궁명)로 구분 캐시된다.
// 접근: 프리미엄(구독)=게이트 없이 생성 / 비프리미엄=trial(첫1회 무료)·perUse(광고·건당). 캐시 열람은 무게이트.
//   ⚠️ '1회 트리거=전 항목 1세트' 게이트. 세트 단가 정책은 daniel 검수.
//   ⚠️ Edge invoke=프로덕션(개발 미배포=호출 실패=비용0·절대0). charts insert/readings select 는 직접 호출이라 개발에서도 동작.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Alert } from '../lib/alert'; // 커스텀 알림(앱 디자인)
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../lib/engine';
import { useAuth } from '../lib/useAuth';
import { supabase } from '../lib/supabase';
import { useEntitlement } from '../lib/entitlement';
import { useSubscription } from '../lib/subscription';
import { setServerChartId, getRepresentativeId, type SavedChart } from '../lib/myChart';
import { loadFollowups, askFollowup, type Followup } from '../lib/followups';
import { useFontScale } from '../lib/fontScale';
import { appLang } from '../lib/i18n'; // 통변 출력 언어(앱 언어)
import { PALACE_DESC } from '../lib/palaceDesc'; // 자미두수 궁 설명(궁 옆 표시)
import { useCredit } from '../lib/coupons'; // 무료 이용권 크레딧(결제 전 우선 소비)
import { requireLoginForPurchase } from '../lib/requireLogin'; // 결제/저장 전 로그인 안내
import { assertOnline, isOnline } from '../lib/network'; // 오프라인 시 신규 생성 차단
import { colors, radius, space, shadow, font } from '../lib/theme';
import type { ChartInput, CategoryKey } from '@spec/chart';

// 풀이 항목 = { key(=캐시 category·Edge 요청 키), label(표시명), desc(부가 설명 — 자미두수 궁이 뭘 보는지) }
export type ReadingCategory = { key: string; label: string; desc?: string };

// opus 응답 정규화: ```json 코드펜스로 감싸졌거나(가드 폴백) base 등이 객체일 때 안전 처리.
function normalizeReading(r: any): any {
  if (!r || typeof r !== 'object' || r.error) return r;
  if (typeof r.base === 'string' && r.base.includes('```')) {
    const m = r.base.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = (m ? m[1] : r.base.replace(/```json?|```/g, '')).trim();
    try { return JSON.parse(raw); } catch { /* 파싱 실패 시 원본 유지 */ }
  }
  return r;
}
// 값이 객체/배열이어도 문자열로 평탄화(중첩 {summary,detail…} → 합침)
function asText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(' · ');
  if (typeof v === 'object') return Object.values(v).map(asText).filter(Boolean).join('\n');
  return String(v);
}

// 사주 16영역 = lib/prewarmReadings 와 단일 출처 공유(프리워밍·화면이 같은 캐시 키를 쓴다).
import { SAJU_READING_CATEGORIES as SAJU_CATEGORIES, ensureServerChartId } from '../lib/prewarmReadings';

export function ReadingScreen({
  input, savedChart, categories, kind = 'saju', titleKey = 'reading.title', subKey = 'reading.sub',
}: {
  input: ChartInput | null;
  savedChart?: SavedChart | null;
  categories?: ReadingCategory[];        // 미지정 = 사주 16영역(t 라벨)
  kind?: string;                         // 'saju' | 'ziwei' — Edge 프롬프트 분기 키
  titleKey?: string;
  subKey?: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const { mode, consumeTrial, watchAdForReading, purchaseReading } = useEntitlement();
  const { isPremium } = useSubscription();
  const { fs } = useFontScale(); // 통변 본문 글자 크기(설정에서 조절)
  const [readings, setReadings] = useState<Record<string, any>>({});
  const [progress, setProgress] = useState<{ done: number; total: number; current?: string } | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [chartId, setChartId] = useState<string | null>(savedChart?.serverChartId ?? null);
  const [detail, setDetail] = useState<string | null>(null); // 상세로 펼친 항목 key
  // 추가 질문(Q&A) — 영역별 누적 + 입력/전송 상태(프리미엄 2회 무료 + 건당)
  const [followups, setFollowups] = useState<Record<string, Followup[]>>({});
  const [askInput, setAskInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [cacheLoaded, setCacheLoaded] = useState(false);  // 캐시 로드 완료(자동 생성 판단 기준)
  const autoRan = useRef(false);                          // 프리미엄 진입 시 자동 생성 1회 가드
  // 대표 명식 여부 — 프리미엄 '자동 생성'은 대표 명식에만(비용통제 daniel: 명식 100개 자동 생성 방지).
  //   대표가 아니면 프리미엄이라도 수동 '생성' 버튼으로(의도된 1회 소비). 캐시는 그대로 표시.
  const [isRep, setIsRep] = useState(false);
  useEffect(() => {
    let alive = true;
    getRepresentativeId().then((rid) => { if (alive) setIsRep(!!savedChart && !!rid && rid === savedChart.id); }).catch(() => {});
    return () => { alive = false; };
  }, [savedChart]);
  const c = useMemo(() => (input ? computeChart(input) : null), [input]);
  // 항목 집합: 주입된 categories 우선, 없으면 사주 16영역(i18n 라벨)
  const cats = useMemo<ReadingCategory[]>(() => {
    if (categories) return categories;
    // 자미두수: 명반 12궁을 항목으로(궁명 = 캐시 category·표시 라벨) + 이 궁이 뭘 보는지 설명(daniel).
    if (kind === 'ziwei') return ((c?.ziwei?.palaces as any[]) ?? []).map((p) => ({ key: p.name, label: p.name, desc: PALACE_DESC[p.name] }));
    return SAJU_CATEGORIES.map((k) => ({ key: k, label: t(`category.${k}`) }));
  }, [categories, kind, c, t]);

  // 진입 시: 서버 chart_id 확보 + 저장된 풀이(캐시) 로드 → 생성 없이 즉시 표시.
  //   savedChart 가 있어야 chart_id 안정화(재사용). 없으면(input-param 경로) 캐시 생략 → 버튼 생성.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!c || !session || !savedChart) { if (alive) setCacheLoaded(true); return; } // 저장명식 없으면 캐시 없음
      const id = await ensureServerChart();
      if (!alive || !id) { if (alive) setCacheLoaded(true); return; }
      setChartId(id);
      const { data } = await supabase.from('readings').select('category, content').eq('chart_id', id).eq('lang', appLang());
      if (!alive) return;
      const keys = new Set(cats.map((x) => x.key));   // 이 화면 항목(사주/자미)만 반영
      const loaded: Record<string, any> = {};
      (data ?? []).forEach((r: any) => { if (keys.has(r.category)) loaded[r.category] = r.content; });
      setReadings(loaded);
      setCacheLoaded(true);
      loadFollowups(id).then((f) => { if (alive) setFollowups(f); }).catch(() => {}); // 추가 질문 누적 로드
    })().catch(() => { if (alive) setCacheLoaded(true); /* 실패해도 자동 생성 판단은 진행 */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, session, savedChart, cats]);

  if (!c) return <View style={styles.center}><Text style={font.body}>{t('myeongsik.noChart')}</Text></View>;

  // 서버 charts row 확보 — 단일 구현(lib/prewarmReadings.ensureServerChartId) 공유.
  async function ensureServerChart(): Promise<string | null> {
    if (!c || !session || !savedChart || !input) return null;
    return ensureServerChartId(c, input, session, savedChart);
  }

  // savedChart 없는 폴백(input-param 경로): 캐시 매핑 없이 1회용 charts insert.
  async function insertChart(): Promise<string | null> {
    if (!c || !session) return null;
    // birth 평문 서버 저장 금지(규칙8) — insert_chart_enc RPC 로 서버 암호화. input 없으면 birth 생략(null).
    const { data, error } = await supabase.rpc('insert_chart_enc', {
      p_relation: 'self',
      p_saju: { ...c.saju, timeUnknown: input?.timeAccuracy === '미상' },
      p_ziwei: c.ziwei ?? null,
      p_birth: input ? JSON.stringify(input) : null,
      p_label: null,
    });
    return error || !data ? null : (data as string);
  }

  // 아직 없는 항목만 생성(캐시된 건 skip — 비용 방어). chart_id 는 재사용 우선.
  async function runAll(isTrial: boolean) {
    if (!c || !session) return;
    setGlobalError(null);
    let id = chartId;
    if (!id) {
      id = savedChart ? await ensureServerChart() : await insertChart();
      if (!id) { setGlobalError(t('reading.saveFail')); return; }
      setChartId(id);
    }
    const todo = cats.filter((cat) => !readings[cat.key]);
    if (!todo.length) return;                              // 전부 캐시됨 → 생성 불필요
    setProgress({ done: cats.length - todo.length, total: cats.length, current: todo[0].label });
    for (const cat of todo) {
      setProgress((p) => (p ? { ...p, current: cat.label } : null)); // 지금 풀이 중인 영역
      try {
        // 자미는 운한(대한 비성사화)이 포함된 최신 명반을 body 로 전달(저장본은 구버전일 수 있음 → Edge가 우선 사용).
        const { data, error } = await supabase.functions.invoke('interpret', { body: { chartId: id, category: cat.key, kind, tier: 'paid', lang: appLang(), ...(kind === 'ziwei' ? { ziwei: c!.ziwei } : {}) } });
        setReadings((prev) => ({ ...prev, [cat.key]: error ? { error: error.message } : data?.reading }));
      } catch (err) {
        setReadings((prev) => ({ ...prev, [cat.key]: { error: (err as Error).message } }));
      }
      setProgress((p) => (p ? { done: p.done + 1, total: p.total, current: p.current } : null));
    }
    setProgress(null);
    if (isTrial) await consumeTrial();                     // 무료 체험 소진(전 항목 1세트 = 1회)
  }

  // 생성 트리거: 프리미엄 > 무료이용권(쿠폰) > trial·perUse 순.
  async function onStart() {
    // 풀이는 계정에 저장·캐시됨(서버차트 귀속) → 미로그인 시 '저장용' 안내 후 로그인 유도(daniel)
    if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
    if (!assertOnline(t)) return;                          // 오프라인 = 신규 생성 차단(경고)
    if (isPremium) { await runAll(false); return; }        // 구독 = 무게이트(캐시로 비용 방어)
    // ★무료 이용권: 이 화면 종류(사주=reading/자미=ziwei) 크레딧 있으면 차감하고 무료 생성
    if (await useCredit(kind === 'ziwei' ? 'ziwei' : 'reading')) { await runAll(false); return; }
    if (mode === 'perUse') {
      Alert.alert(t('reading.premiumAlert'), t('reading.premiumAlertMsg'), [
        { text: t('reading.watchAd'), onPress: async () => { try { await watchAdForReading(); await runAll(false); } catch (e) { if ((e as Error).message !== 'cancelled') Alert.alert('!', (e as Error).message); } } },
        { text: t('reading.payPerUse'), onPress: async () => { try { await purchaseReading(); await runAll(false); } catch (e) { Alert.alert('!', (e as Error).message); } } },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
      return;
    }
    await runAll(mode === 'trial');
  }

  const banner = isPremium ? t('reading.bannerPremium') : (mode === 'trial' ? t('reading.bannerTrial') : t('reading.bannerPerUse'));
  const haveAll = cats.every((cat) => readings[cat.key]);
  // 생성 버튼: 비프리미엄(게이트) + 프리미엄이라도 '대표 아님'(자동생성 제외 → 수동 생성). 대표 프리미엄만 버튼 없이 자동.
  const showStart = !haveAll && progress === null && (!isPremium || !isRep);

  // 프리미엄 자동 생성 — 캐시 로드 후 미생성 영역이 있으면 1회 자동 runAll(버튼 없이).
  //   ★대표 명식에만(비용통제): 다른 명식은 프리미엄이라도 자동 생성하지 않는다(수동 버튼).
  useEffect(() => {
    if (!isPremium || !isRep || !cacheLoaded || progress || autoRan.current || !session || !isOnline()) return; // 오프라인=자동생성 보류(조용히)
    if (cats.some((cat) => !readings[cat.key])) { autoRan.current = true; runAll(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, isRep, cacheLoaded, readings, cats, progress, session]);

  // 추가 질문 전송 — 프리미엄 무료 2회 + 초과 시 건당 결제 후 재시도(paid). Edge가 게이트 판정.
  async function submitFollowup(retryPaid = false) {
    if (!detail || !chartId || !askInput.trim() || asking) return;
    const q = askInput.trim();
    setAsking(true);
    const res = await askFollowup(chartId, detail, kind, q, retryPaid);
    setAsking(false);
    if (res.kind === 'answer') {
      setFollowups((prev) => ({ ...prev, [detail!]: [...(prev[detail!] ?? []), { question: q, answer: res.answer }] }));
      setAskInput('');
    } else if (res.kind === 'needPremium') {
      Alert.alert(t('reading.askPremiumTitle'), t('reading.askPremiumMsg'));
    } else if (res.kind === 'needPayment') {
      // 무료 한도 소진 → 건당 결제 안내 → 결제 성공 시 paid 로 재시도(RevenueCat 미연동 시 '준비 중')
      Alert.alert(t('reading.askPayTitle'), t('reading.askPayMsg'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('reading.askPayBtn'), onPress: async () => {
          try { await purchaseReading(); await submitFollowup(true); }
          catch (e) { Alert.alert(t('reading.payPending'), (e as Error).message); }
        } },
      ]);
    } else {
      Alert.alert(t('common.error'), res.message);
    }
  }

  // 추가 질문(Q&A) 영역 — 상세 모달 하단. 프리미엄 = 무료 2회+건당 / 비프리미엄 = 프리미엄 유도.
  const renderFollowups = (key: string) => {
    const list = followups[key] ?? [];
    const used = list.length;
    const freeLeft = Math.max(0, 1 - used); // 무료 1회(daniel) — 초과는 건당 구매
    return (
      <View style={styles.askWrap}>
        <Text style={styles.askH}>{t('reading.askTitle')}</Text>
        {/* 지난 질문·답변 */}
        {list.map((f, i) => (
          <View key={i} style={styles.qaItem}>
            <Text style={styles.qaQ}>Q. {f.question}</Text>
            <Text style={styles.qaA}>{f.answer}</Text>
          </View>
        ))}
        {isPremium ? (
          <>
            <Text style={styles.askQuota}>
              {freeLeft > 0 ? t('reading.askFree', { n: freeLeft }) : t('reading.askPaid')}
            </Text>
            <View style={styles.askRow}>
              <TextInput
                style={styles.askInput}
                value={askInput}
                onChangeText={setAskInput}
                placeholder={t('reading.askPh')}
                placeholderTextColor={colors.inkFaint}
                multiline
                maxLength={50}
                editable={!asking}
              />
              <Text style={styles.askLen}>{askInput.length}/50</Text>
              <Pressable
                style={[styles.askSend, (!askInput.trim() || asking) && styles.askSendOff]}
                onPress={() => submitFollowup(false)}
                disabled={!askInput.trim() || asking}
              >
                {asking ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.askSendTx}>{t('reading.askSend')}</Text>}
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable style={styles.askLock} onPress={() => Alert.alert(t('reading.askPremiumTitle'), t('reading.askPremiumMsg'))}>
            <Text style={styles.askLockTx}>🔒 {t('reading.askPremiumCta')}</Text>
          </Pressable>
        )}
      </View>
    );
  };

  // 항목 상세 섹션 렌더 — 리스트 상세 모달에서 재사용
  const renderSections = (key: string) => {
    const r = normalizeReading(readings[key]);
    const base = asText(r.base), past = asText(r.past), overlay = asText(r.overlay), remedy = asText(r.remedy);
    if (r.error) return <Text style={styles.err}>{r.error}</Text>;
    const bodyDyn = { fontSize: fs(15), lineHeight: fs(26) }; // 설정 글자 크기 반영
    return (
      <>
        {base ? (
          <View style={styles.section}>
            <Text style={styles.secLabel}>{t('reading.base')}</Text>
            <Text style={[styles.secBody, bodyDyn]}>{base}</Text>
          </View>
        ) : null}
        {past ? (
          <View style={styles.section}>
            <Text style={styles.secLabel}>{t('reading.past')}</Text>
            <Text style={[styles.secBody, bodyDyn]}>{past}</Text>
          </View>
        ) : null}
        {overlay ? (
          <View style={styles.section}>
            <Text style={styles.secLabel}>{t('reading.overlay')}</Text>
            <Text style={[styles.secBody, bodyDyn]}>{overlay}</Text>
          </View>
        ) : null}
        {remedy ? (
          <View style={[styles.section, styles.remedySection]}>
            <Text style={styles.secLabel}>{t('reading.remedy')}</Text>
            <Text style={[styles.secBody, bodyDyn]}>{remedy}</Text>
          </View>
        ) : null}
        {!base && !overlay && !remedy && <Text style={[styles.secBody, bodyDyn]}>{asText(r)}</Text>}
      </>
    );
  };

  return (
    <>
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.h}>{t(titleKey)}</Text>
      <Text style={styles.sub}>{t(subKey)}</Text>

      {/* 생성 버튼 + 과금 안내(미생성 항목이 있을 때만) */}
      {showStart && (
        <>
          <Pressable style={styles.startBtn} onPress={onStart}>
            <Text style={styles.startBtnText}>{t('reading.runAll', { count: cats.length })}</Text>
          </Pressable>
          <Text style={styles.bannerText}>{banner}</Text>
        </>
      )}

      {/* 생성 중 진행률 (N/총) */}
      {progress && (
        <View style={styles.progressRow}>
          <ActivityIndicator color={colors.ju} />
          <Text style={styles.progressText}>{t('reading.progress', { current: progress.current ?? '', done: progress.done, total: progress.total })}</Text>
        </View>
      )}

      {/* 차트 저장 실패(전역) */}
      {globalError && <View style={styles.card}><Text style={styles.err}>{globalError}</Text></View>}

      {/* 항목 리스트 — 영역명 + 미리보기. 탭하면 상세 페이지(모달)로 이동 */}
      {cats.map((cat) => {
        const raw = readings[cat.key];
        if (!raw) return null;
        const r = normalizeReading(raw);
        const preview = r.error ? '생성 실패 — 다시 시도해 주세요' : asText(r.base);
        return (
          <Pressable key={cat.key} style={styles.listItem} onPress={() => setDetail(cat.key)}>
            <View style={{ flex: 1 }}>
              <View style={styles.listLabelRow}>
                <Text style={styles.listLabel}>{cat.label}</Text>
                {cat.desc ? <Text style={styles.listDesc}>{cat.desc}</Text> : null}
              </View>
              <Text style={styles.listPreview} numberOfLines={1}>{preview}</Text>
            </View>
            <Text style={styles.listArrow}>›</Text>
          </Pressable>
        );
      })}
    </ScrollView>

    {/* 항목 상세 — 탭한 영역의 섹션을 별도 페이지처럼 슬라이드 */}
    <Modal visible={!!detail} animationType="slide" onRequestClose={() => setDetail(null)}>
      <View style={styles.detailScreen}>
        <Pressable style={styles.detailBack} onPress={() => setDetail(null)}>
          <Text style={styles.detailBackTx}>‹ 목록으로</Text>
        </Pressable>
        {detail && (
          <ScrollView contentContainerStyle={styles.detailWrap}>
            <Text style={styles.detailTitle}>{cats.find((x) => x.key === detail)?.label}</Text>
            {/* 자미두수 등 — 이 항목(궁)이 뭘 보는지 설명 */}
            {cats.find((x) => x.key === detail)?.desc ? <Text style={styles.detailDesc}>{cats.find((x) => x.key === detail)?.desc}</Text> : null}
            {renderSections(detail)}
            {renderFollowups(detail)}
          </ScrollView>
        )}
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(10) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  h: { ...font.heading, fontSize: 21 },
  sub: { ...font.caption, marginTop: space(1.5), marginBottom: space(4) },
  startBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center', marginTop: space(2), ...shadow.card },
  startBtnText: { color: colors.bg, fontSize: 16, fontWeight: '800' },
  bannerText: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(3) },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(5), marginBottom: space(2) },
  progressText: { ...font.body, color: colors.inkSoft },
  card: {
    marginTop: space(4), padding: space(4), borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow.card,
  },
  cardTitle: { ...font.heading, color: colors.ju, marginBottom: space(2) },
  // 가독성(daniel): 소제목 더 크게 + 섹션(문단) 사이 간격 넉넉히
  section: { marginTop: space(6) },
  secLabel: { fontSize: 16, color: colors.ju, fontWeight: '800', marginBottom: space(2.5), letterSpacing: 0.3 },
  secBody: { ...font.body, color: colors.ink, fontSize: 15, lineHeight: 26 },
  remedySection: { marginTop: space(6), paddingTop: space(5), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  // 항목 리스트(구역)
  listItem: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(3), padding: space(4), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, ...shadow.card },
  listLabelRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space(2) },
  listLabel: { ...font.heading, fontSize: 19, color: colors.ju },
  listDesc: { ...font.caption, color: colors.inkSoft },
  listPreview: { ...font.caption, color: colors.inkSoft, marginTop: space(1) },
  listArrow: { fontSize: 24, color: colors.inkFaint, fontWeight: '300' },
  // 상세 페이지(모달)
  detailScreen: { flex: 1, backgroundColor: colors.bg },
  detailBack: { paddingTop: space(12), paddingHorizontal: space(5), paddingBottom: space(2) },
  detailBackTx: { ...font.body, color: colors.ju, fontWeight: '700' },
  detailWrap: { padding: space(5), paddingTop: space(2), paddingBottom: space(10) },
  detailTitle: { ...font.title, fontSize: 26, color: colors.ink, marginBottom: space(1) },
  detailDesc: { ...font.body, color: colors.inkSoft, marginBottom: space(3) },
  err: { fontSize: 13, color: colors.ju },
  // 추가 질문(Q&A)
  askWrap: { marginTop: space(7), paddingTop: space(5), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  askH: { fontSize: 17, fontWeight: '800', color: colors.ink, marginBottom: space(3) },
  qaItem: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(3) },
  qaQ: { ...font.body, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  qaA: { ...font.body, color: colors.ink, lineHeight: 24 },
  askQuota: { ...font.caption, color: colors.inkFaint, marginBottom: space(2) },
  askRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space(2) },
  askInput: { ...font.body, flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: space(3), paddingVertical: space(2.5), color: colors.ink },
  askLen: { fontSize: 11, color: colors.inkFaint, alignSelf: 'flex-end', marginBottom: space(3) },
  askSend: { backgroundColor: colors.ju, borderRadius: radius.md, paddingHorizontal: space(4), height: 44, alignItems: 'center', justifyContent: 'center' },
  askSendOff: { opacity: 0.4 },
  askSendTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  askLock: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center' },
  askLockTx: { color: colors.ju, fontWeight: '700', fontSize: 14 },
});
