// app/src/screens/CompatScreen.tsx — 1:1 궁합 (관계 유형별 일반인 통변 + 글자 작용 상세)
// ─────────────────────────────────────────────────────────────────────────
// daniel 개편(2026-06-11): ① 두 명식을 각각 슬롯으로 — '내 명식'은 골드 슬롯으로 따로 빼서 식별,
//   상대는 저장 명식 선택 또는 직접 입력. ② 통변 = 단순 합충 나열이 아니라 관계 유형(지인·친구/동업/
//   투자/연애/결혼)별로 핵심을 먼저 짚어 일반인이 읽게(Edge kind='compat', 쉬운 말). 합충 비교는 접이식 상세.
// 결정론(일간관계·교차합충)은 온디바이스 → 통변의 근거로 Edge에 전달(규칙2 사주 단독). 상대 PII=동의(규칙8).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Modal, TextInput, Keyboard, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // 모달 상단 노치/상태바 침범 방지(J)
import { Alert } from '../lib/alert'; // 커스텀 알림(앱 디자인)
import { useTranslation } from 'react-i18next';
import { computeChart } from '../lib/engine';
import { analyzeCompatibility } from '@engine/compatibility';
import { detectInteractionsAmong } from '@engine/structure';
import { stemElement, branchElement, elementColor, elementText } from '../lib/ohaeng';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { listCharts, getRepresentativeId, addChart, ChartLimitError, type SavedChart } from '../lib/myChart';
import { ChartRegisterScreen } from './ChartRegisterScreen'; // 상대 명식 = 정식 등록 폼으로 입력
import { useAuth } from '../lib/useAuth';
import { useSubscription, purchasePremium } from '../lib/subscription';
import { assertOnline } from '../lib/network'; // 오프라인 시 신규 생성 차단
import { purchaseCreditRC } from '../lib/purchases'; // 궁합 건당 결제 = credit_compat(서버 consume)
import { grantCredit } from '../lib/coupons';        // 결제 성공 → 크레딧 부여(서버가 차감)
import { ensureServerChartId } from '../lib/prewarmReadings';
import { useFontScale } from '../lib/fontScale';
import { COMPAT_RELS, otherSig, loadCompatReadings, genCompatReading, compatSections, compatSectionLabel, type CompatReading } from '../lib/compatReadings';
import { loadFollowups, askFollowup, type Followup } from '../lib/followups'; // 궁합 추가질문(사주/자미 풀이와 동일 — 무료1 + 건당)
import { yearGanZhi } from '../lib/dailyFortune'; // 연도별 궁합: 그 해 간지(세운)
import { compatScore, tierLabel, tierOf, type CompatScoreResult } from '../lib/compatScore'; // 궁합 점수·등급(R26: LLM 직접 산출 우선, 결정론은 폴백)
import { appLang } from '../lib/i18n';

// 궁합 등급별 이미지 — assets/icons/compat/{tier.key}.jpg. 없으면 이모지 폴백(이미지 생성 후 require 연결).
const COMPAT_IMG: Record<string, any> = {
  soulmate: require('../../assets/icons/compat/soulmate.jpg'),
  great: require('../../assets/icons/compat/great.jpg'),
  good: require('../../assets/icons/compat/good.jpg'),
  steady: require('../../assets/icons/compat/steady.jpg'),
  spark: require('../../assets/icons/compat/spark.jpg'),
  opposite: require('../../assets/icons/compat/opposite.jpg'),
};

// 관계 카테고리별 이미지(daniel: 각 카테고리에 맞는 이미지) — assets/icons/compat-rel/{rel}.jpg. 선택 관계 배너.
const CAT_IMG: Record<string, any> = {
  friend: require('../../assets/icons/compat-rel/friend.jpg'),
  family: require('../../assets/icons/compat-rel/family.jpg'),
  love: require('../../assets/icons/compat-rel/love.jpg'),
  marriage: require('../../assets/icons/compat-rel/marriage.jpg'),
  coworker: require('../../assets/icons/compat-rel/coworker.jpg'),
  senior: require('../../assets/icons/compat-rel/senior.jpg'),
  staff: require('../../assets/icons/compat-rel/staff.jpg'),
  business: require('../../assets/icons/compat-rel/business.jpg'),
};
import { UnlockOverlay } from '../components/UnlockOverlay'; // 생성 중 화면 가림 로딩(daniel)
import type { ChartInput } from '@spec/chart';

export function CompatScreen({ me }: { me: ChartInput | null }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const { fs } = useFontScale(); // 통변 본문 글자 크기(설정에서 조절)
  const insets = useSafeAreaInsets(); // 상대 등록 모달 헤더가 노치/상태바에 가리지 않게(daniel J)
  const [saved, setSaved] = useState<SavedChart[]>([]);
  const [meSel, setMeSel] = useState<SavedChart | null>(null);   // '내 명식' 슬롯(기본=대표). 저장 명식에서 변경 가능.
  const [mePick, setMePick] = useState(false);                    // 내 명식 변경 피커 펼침
  const [otherSel, setOtherSel] = useState<SavedChart | null>(null); // 상대(저장 명식). 없으면 등록 폼으로 추가.
  const [otherReg, setOtherReg] = useState(false);                    // 상대 명식 등록 폼 모달
  // 통변(관계별) + 결정론 비교
  const [rel, setRel] = useState('love');                        // 선택 관계 유형(기본 연애)
  const [year, setYear] = useState('');                          // '' = 원국(관계 본바탕) / 'YYYY' = 그 해 흐름
  const [readings, setReadings] = useState<Record<string, CompatReading>>({});
  const [busy, setBusy] = useState<string | null>(null);         // 생성 중 키(rel 또는 rel_yYYYY)
  const [pair, setPair] = useState<{ me: any; other: any } | null>(null);
  const [compat, setCompat] = useState<CompatScoreResult | null>(null); // 궁합 점수·등급(결정론 — 통변과 별개로 항상)
  const [ctx, setCtx] = useState<{ chartId: string; sig: string; cross: string[]; dayRel: string; meZiwei: any; otherZiwei: any } | null>(null); // 연도별 추가 생성 컨텍스트
  const YEARS = [0, 1, 2, 3, 4].map((i) => new Date().getFullYear() + i); // 연도별 옵션(올해~+4)
  const [showDetail, setShowDetail] = useState(false);           // 글자 작용 상세 접이식
  const [active, setActive] = useState<Set<string>>(new Set());
  // 궁합 추가질문(관계유형/연도 키별) — 사주·자미 풀이와 동일(무료 1회 + 건당 결제)
  const [followups, setFollowups] = useState<Record<string, Followup[]>>({});
  const [askInput, setAskInput] = useState('');
  const [asking, setAsking] = useState(false);

  // 저장 명식 + 대표 로드 → 내 명식 슬롯 기본값 = 대표(없으면 me 입력)
  useEffect(() => {
    (async () => {
      const list = await listCharts(); setSaved(list);
      const repId = await getRepresentativeId();
      const rep = list.find((c) => c.id === repId) ?? list.find((c) => c.relation === 'self') ?? list[0] ?? null;
      setMeSel(rep);
    })();
  }, []);

  // 통변 컨텍스트(ctx) 준비되면 그 차트의 추가질문 로드(관계유형/연도 키별)
  useEffect(() => { if (ctx?.chartId) loadFollowups(ctx.chartId).then(setFollowups).catch(() => {}); }, [ctx]);

  // 현재 '내 명식' input(슬롯 선택 우선, 없으면 라우트 me)
  const meInput: ChartInput | null = meSel?.input ?? me;
  const otherInput: ChartInput | null = otherSel?.input ?? null; // 상대 = 저장 명식(등록 폼으로 추가)

  // 상대 명식 등록(정식 폼) → 내 명식 목록에 저장 + 상대 슬롯 자동 선택. 무료 한도 초과 시 안내.
  async function onRegisterOther(input: any) {
    try {
      const id = await addChart(input, { isPro: isPremium });
      const list = await listCharts(); setSaved(list);
      setOtherSel(list.find((c) => c.id === id) ?? null);
      setOtherReg(false);
    } catch (e) {
      if (e instanceof ChartLimitError) Alert.alert(t('register.limitTitle'), t('register.limitMsg', { limit: e.limit }));
      else Alert.alert('!', (e as Error).message);
    }
  }

  function toggleActive(key: string) {
    setActive((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  // 궁합 풀이 — 두 명식 결정론 계산(근거) → 서버차트 확보 → 관계 유형별 통변 로드/생성.
  //   게이트(서버 판정): 비프리미엄=프리미엄 유도 / 무료 5쌍 초과=건당 결제(paid 재시도). daniel.
  async function analyze() {
    if (!meInput || !otherInput || !session) return;
    const meC = computeChart(meInput), otherC = computeChart(otherInput);
    setPair({ me: meC.saju, other: otherC.saju }); setActive(new Set()); setYear(''); // 분석 시작 = 원국부터
    const dx = analyzeCompatibility(meC.saju, otherC.saju);     // 일간관계·교차(통변 근거)
    setCompat(compatScore(dx));                                 // 궁합 점수·등급(결정론 — 항상 표시, 저장명식 없어도)
    if (!meSel) return; // 캐시·통변은 저장 명식(serverChartId) 필요 — 대표 없으면 점수·비교만
    const chartId = await ensureServerChartId(meC, meInput, session, meSel);
    if (!chartId) return;
    const sig = otherSig(otherC.saju);
    const cross = crossDetails(meC.saju, otherC.saju);          // 교차작용(통변 근거 — 쉬운 말로 번역)
    setCtx({ chartId, sig, cross, dayRel: dx.dayMasterRelation.detail, meZiwei: meC.ziwei, otherZiwei: otherC.ziwei }); // 연도별 추가 생성용
    const cached = await loadCompatReadings(chartId, sig);
    setReadings(cached);

    // 관계 유형(9종) 순차 생성(캐시된 건 skip). 첫 미생성에서 게이트가 걸리면 전체 중단(쌍 단위 과금 — 9종=1쌍).
    async function genAll() {
      if (!assertOnline(t)) return;                        // 오프라인 = 신규 생성 차단
      for (const r of COMPAT_RELS) {
        if (cached[r.key] || readings[r.key]) continue;
        setBusy(r.key);
        const res = await genCompatReading(chartId!, r.key, sig, otherC.saju, cross, dx.dayMasterRelation.detail, meC.ziwei, otherC.ziwei, undefined, undefined, meSel?.context);
        if (res.kind === 'answer') { setReadings((prev) => ({ ...prev, [r.key]: res.reading })); continue; }
        setBusy(null);
        if (res.kind === 'needPremium') { Alert.alert(t('compat.premiumTitle'), t('compat.premiumMsg')); return; }
        if (res.kind === 'needPayment') {
          Alert.alert(t('compat.payTitle'), t('compat.payMsg'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('compat.payBtn'), onPress: async () => {
              try { const ok = await purchaseCreditRC('compat'); if (!ok) return; await grantCredit('compat'); await genAll(); } // 결제→크레딧 부여→서버 consume
              catch (e) { Alert.alert(t('reading.payPending'), (e as Error).message); }
            } },
          ]);
          return;
        }
        return; // error
      }
      setBusy(null);
    }
    await genAll();
  }

  // 연도별 궁합(그 해 흐름) — 선택 관계×연도 1개 lazy 생성. ctx(analyze 시 보관) 재사용.
  //   같은 상대(쌍)면 게이트 통과(원국 생성 후라 samePair) — 비용은 캐시(연도×관계 1회)로 방어.
  async function genYear(relKey: string, yr: string) {
    if (!ctx || !pair || busy) return;
    if (!assertOnline(t)) return;
    const key = `${relKey}_y${yr}`;
    if (readings[key]) return;
    setBusy(key);
    const gz = yearGanZhi(Number(yr));
    const res = await genCompatReading(ctx.chartId, relKey, ctx.sig, pair.other, ctx.cross, ctx.dayRel, ctx.meZiwei, ctx.otherZiwei, yr, gz, meSel?.context);
    setBusy(null);
    if (res.kind === 'answer') { setReadings((prev) => ({ ...prev, [key]: res.reading })); return; }
    if (res.kind === 'needPremium') { Alert.alert(t('compat.premiumTitle'), t('compat.premiumMsg')); return; }
    if (res.kind === 'needPayment') {
      Alert.alert(t('compat.payTitle'), t('compat.payMsg'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('compat.payBtn'), onPress: async () => {
          try {
            const ok = await purchaseCreditRC('compat'); if (!ok) return;
            await grantCredit('compat');                 // 결제→크레딧 부여→서버 consume
            setBusy(key);
            const r2 = await genCompatReading(ctx.chartId, relKey, ctx.sig, pair.other, ctx.cross, ctx.dayRel, ctx.meZiwei, ctx.otherZiwei, yr, gz, meSel?.context);
            setBusy(null);
            if (r2.kind === 'answer') setReadings((prev) => ({ ...prev, [key]: r2.reading }));
          } catch (e) { setBusy(null); Alert.alert(t('reading.payPending'), (e as Error).message); }
        } },
      ]);
    }
  }

  // 나↔상대 교차 합충(detail 문자열 배열) — Edge 통변 근거(원국+대운+세운)
  function crossDetails(meS: any, otherS: any): string[] {
    const POSK = ['시', '일', '월', '년'] as const;
    const pers = (s: any, who: string) => {
      const out: any[] = POSK.map((p) => ({ pos: `${who}${p}`, stem: s.pillars[p].stem, branch: s.pillars[p].branch }));
      if (s.currentLuck) out.push({ pos: `${who}대운`, stem: s.currentLuck.stem, branch: s.currentLuck.branch });
      return out;
    };
    const all = [...pers(meS, '나'), ...pers(otherS, '상')];
    return detectInteractionsAmong(all.map((x) => ({ pos: x.pos as any, stem: x.stem, branch: x.branch })))
      .filter((it) => String(it.members[0]).startsWith('나') !== String(it.members[1]).startsWith('나'))
      .map((it) => it.detail);
  }

  const curKey = year ? `${rel}_y${year}` : rel; // 추가질문 누적 키(관계유형/연도별 분리)
  const cur = readings[curKey];
  // R26: 궁합 점수는 LLM이 카테고리별로 *입체 산출*(가산표 아님) → 현재 풀이의 score 우선. 생성 전엔 결정론(compat) 임시값.
  const llmScore = (() => { const v: any = (cur as any)?.score; const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN; return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null; })();
  const dispScore = llmScore ?? compat?.score ?? null;
  const dispTier = llmScore != null ? tierOf(llmScore) : (compat?.tier ?? null);
  const slotLine = (input: ChartInput | null) => input ? `${String(input.birthDateTime).split(' ')[0]} · ${input.sex}` : '미선택';

  return (
    <>
    <UnlockOverlay visible={!!busy} message={t('compat.generating', '궁합을 풀어내는 중…')} />
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* ── 내 명식 슬롯(골드, 따로 빼서 식별) ── */}
      <Text style={styles.slotLabel}>{t('compat.mySlot')}</Text>
      <Pressable style={styles.meSlot} onPress={() => setMePick((v) => !v)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.meSlotName}>{meSel?.label ?? t('compat.mySlot')}</Text>
          <Text style={styles.meSlotSub}>{slotLine(meInput)}</Text>
        </View>
        <Text style={styles.meSlotChange}>{t('compat.change')}</Text>
      </Pressable>
      {mePick && saved.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {saved.map((s) => {
            const on = meSel?.id === s.id;
            return <Pressable key={s.id} style={[styles.chip, on && styles.chipOn]} onPress={() => { setMeSel(s); setMePick(false); }}>
              <Text style={[styles.chipTx, on && styles.chipTxOn]}>{s.label}</Text></Pressable>;
          })}
        </ScrollView>
      )}

      {/* ── 상대 슬롯 ── */}
      <Text style={[styles.slotLabel, { marginTop: space(5) }]}>{t('compat.otherSlot')}</Text>
      {saved.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {saved.filter((s) => s.id !== meSel?.id).map((s) => {
            const on = otherSel?.id === s.id;
            return <Pressable key={s.id} style={[styles.chip, on && styles.chipOn]} onPress={() => setOtherSel(on ? null : s)}>
              <Text style={[styles.chipTx, on && styles.chipTxOn]}>{s.label}</Text></Pressable>;
          })}
        </ScrollView>
      )}
      <Pressable style={styles.regOtherBtn} onPress={() => setOtherReg(true)}>
        <Text style={styles.regOtherTx}>＋ {t('compat.registerOther')}</Text>
      </Pressable>

      <Pressable style={[styles.btn, (!otherInput || !!busy) && styles.btnOff]} onPress={analyze} disabled={!otherInput || !!busy}>
        {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.btnText}>{t('compat.analyze')}</Text>}
      </Pressable>

      {/* ── 관계 유형별 통변 ── */}
      {pair && (
        <>
          {/* 궁합 점수 + 등급 이미지(daniel: 메인 콘텐츠 — 임의 점수·등급별 이미지) */}
          {dispTier && dispScore != null && (
            <View style={styles.scoreCard}>
              {COMPAT_IMG[dispTier.key]
                ? <Image source={COMPAT_IMG[dispTier.key]} style={styles.scoreImg} resizeMode="contain" />
                : <Text style={styles.scoreEmoji}>{dispTier.emoji}</Text>}
              <Text style={styles.scoreTier}>{dispTier.emoji} {tierLabel(dispTier, appLang() as 'ko' | 'en' | 'ja')}</Text>
              <Text style={styles.scoreNum}>{dispScore}<Text style={styles.scoreUnit}> / 100</Text></Text>
              <View style={styles.scoreBar}><View style={[styles.scoreBarFill, { width: `${dispScore}%` }]} /></View>
              {compat && <Text style={styles.scoreSub}>{t('compat.scoreHarmony', '조화')} {compat.harmony} · {t('compat.scoreTension', '긴장')} {compat.tension}</Text>}
            </View>
          )}
          <View style={styles.relChips}>
            {COMPAT_RELS.map((r) => (
              <Pressable key={r.key} style={[styles.relChip, rel === r.key && styles.relChipOn]} onPress={() => { setRel(r.key); if (year && !readings[`${r.key}_y${year}`]) genYear(r.key, year); }}>
                <Text style={[styles.relChipTx, rel === r.key && styles.relChipTxOn]}>{t(r.tk)}</Text>
              </Pressable>
            ))}
          </View>
          {/* 연도별 — 전체(원국 본바탕) / 그 해 흐름(세운). 연도 탭 시 그 관계×연도 통변 생성 */}
          <View style={styles.yearChips}>
            <Pressable style={[styles.yearChip, !year && styles.yearChipOn]} onPress={() => setYear('')}>
              <Text style={[styles.yearChipTx, !year && styles.yearChipTxOn]}>{t('compat.yearAll')}</Text>
            </Pressable>
            {YEARS.map((y) => {
              const ys = String(y);
              return (
                <Pressable key={ys} style={[styles.yearChip, year === ys && styles.yearChipOn]} onPress={() => { setYear(ys); if (!readings[`${rel}_y${ys}`]) genYear(rel, ys); }}>
                  <Text style={[styles.yearChipTx, year === ys && styles.yearChipTxOn]}>{ys}</Text>
                </Pressable>
              );
            })}
          </View>
          {/* 선택한 관계 카테고리 배너(daniel: 카테고리별 이미지) */}
          {CAT_IMG[rel] && <Image source={CAT_IMG[rel]} style={styles.catBanner} resizeMode="contain" />}
          {cur ? (
            <View style={styles.readCard}>
              {/* 관계별 동적 섹션(daniel 2026-06): 연애=속궁합·썸·짝사랑 등 / 결혼=속궁합·시댁·자녀 등 / 동업=투자 등. 연도별은 기본 4항목. */}
              {compatSections(rel, !!year).map((s) => {
                const v = cur[s.key];
                if (typeof v !== 'string' || !v) return null;
                if (s.key === 'core') return <Text key="core" style={[styles.coreTx, { fontSize: fs(16), lineHeight: fs(24) }]}>{v}</Text>;
                return (
                  <View key={s.key} style={[styles.sec, s.key === 'advice' && styles.remedySec]}>
                    <Text style={styles.secLabel}>{compatSectionLabel(s)}</Text>
                    <Text style={[styles.secBody, { fontSize: fs(15), lineHeight: fs(25) }]}>{v}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.note}>{t('compat.noReading')}</Text>
          )}

          {/* 추가질문 — 통변이 있을 때만(관계유형/연도 키별, 사주·자미와 동일) */}
          {cur && renderFollowups(curKey)}

          {/* 글자 작용 자세히(접이식 — 근거·글라스박스) */}
          <Pressable style={styles.detailToggle} onPress={() => setShowDetail((v) => !v)}>
            <Text style={styles.detailToggleTx}>{showDetail ? '▾' : '▸'} {t('compat.detailToggle')}</Text>
          </Pressable>
          {showDetail && renderCrossDetail()}
        </>
      )}
    </ScrollView>

    {/* 상대 명식 등록 — 정식 등록 폼(이름·시진·출생지) 모달, 저장 시 상대 슬롯 자동 선택 */}
    <Modal visible={otherReg} animationType="slide" onRequestClose={() => setOtherReg(false)}>
      <View style={styles.modalRoot}>
        <View style={[styles.modalHeader, { paddingTop: insets.top + space(3) }]}>
          <Text style={styles.modalTitle}>{t('compat.registerOtherTitle')}</Text>
          <Pressable onPress={() => setOtherReg(false)} hitSlop={10}><Text style={styles.modalClose}>✕</Text></Pressable>
        </View>
        <ChartRegisterScreen defaultRelation="지인" submitLabel={t('compat.registerOtherSubmit')} showMakeRep={false} onSubmit={onRegisterOther} />
      </View>
    </Modal>
    </>
  );

  // 추가질문 전송 — 서버가 무료한도/크레딧/프리미엄 판정(사주·자미와 동일). 키=관계유형/연도.
  async function submitFollowup() {
    if (!cur || !ctx || !askInput.trim() || asking) return;
    Keyboard.dismiss();
    const q = askInput.trim();
    setAsking(true);
    const res = await askFollowup(ctx.chartId, curKey, 'compat', q);
    setAsking(false);
    if (res.kind === 'answer') {
      setFollowups((prev) => ({ ...prev, [curKey]: [...(prev[curKey] ?? []), { question: q, answer: res.answer }] }));
      setAskInput('');
    } else if (res.kind === 'needPremium') {
      Alert.alert(t('reading.askPremiumTitle'), t('reading.askPremiumMsg'));
    } else if (res.kind === 'needPayment') {
      Alert.alert(t('reading.askPayTitle'), t('reading.askPayMsg'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('reading.askPayBtn'), onPress: async () => {
          try { const ok = await purchaseCreditRC('followup'); if (!ok) return; await grantCredit('followup'); await submitFollowup(); }
          catch (e) { Alert.alert(t('reading.payPending'), (e as Error).message); }
        } },
      ]);
    } else { Alert.alert(t('common.error'), res.message); }
  }

  // 추가질문(Q&A) 영역 — 통변 카드 하단. 프리미엄=무료1회+건당 / 비프리미엄=프리미엄 유도.
  function renderFollowups(key: string) {
    const list = followups[key] ?? [];
    const freeLeft = Math.max(0, 1 - list.length);
    return (
      <View style={styles.askWrap}>
        <Text style={styles.askH}>{t('reading.askTitle')}</Text>
        {list.map((f, i) => (
          <View key={i} style={styles.qaItem}>
            <Text style={styles.qaQ}>Q. {f.question}</Text>
            <Text style={styles.qaA}>{f.answer}</Text>
          </View>
        ))}
        {isPremium ? (
          <>
            <Text style={styles.askQuota}>{freeLeft > 0 ? t('reading.askFree', { n: freeLeft }) : t('reading.askPaid')}</Text>
            <View style={styles.askRow}>
              <TextInput style={styles.askInput} value={askInput} onChangeText={setAskInput} placeholder={t('reading.askPh')} placeholderTextColor={colors.inkFaint} multiline maxLength={50} editable={!asking} />
              <Text style={styles.askLen}>{askInput.length}/50</Text>
              <Pressable style={[styles.askSend, (!askInput.trim() || asking) && styles.askSendOff]} onPress={() => submitFollowup()} disabled={!askInput.trim() || asking}>
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
  }

  // ── 글자 작용 비교(나↔상대) — 기존 미니명식 + 합충 그룹(근거·탭 강조) ──
  function renderCrossDetail() {
    if (!pair) return null;
    const POSK = ['시', '일', '월', '년'] as const;
    const personPillars = (saju: any, who: string) => {
      const out: any[] = POSK.map((p) => ({ pos: `${who}${p}`, who, label: p, stem: saju.pillars[p].stem, branch: saju.pillars[p].branch }));
      if (saju.currentLuck) out.push({ pos: `${who}대운`, who, label: '대운', stem: saju.currentLuck.stem, branch: saju.currentLuck.branch });
      if (saju.annual) out.push({ pos: `${who}세운`, who, label: '세운', stem: saju.annual.stem, branch: saju.annual.branch });
      return out;
    };
    const mineP = personPillars(pair.me, '나'), othersP = personPillars(pair.other, '상대');
    const all = [...mineP, ...othersP];
    const cross = detectInteractionsAmong(all.map((x) => ({ pos: x.pos as any, stem: x.stem, branch: x.branch })))
      .filter((it) => String(it.members[0]).startsWith('나') !== String(it.members[1]).startsWith('나'));
    const findP = (pos: string) => all.find((x) => x.pos === pos);
    const typeColor = (ty: string) => (ty === '합' ? colors.ju : (ty === '충' || ty === '극') ? '#C0392B' : '#9A8CC0');
    const rowKey = (it: any) => `${it.type}:${it.level}:${it.members[0]}:${it.members[1]}`;
    const hlCells = new Set<string>();
    cross.forEach((it) => { if (!active.has(rowKey(it))) return; const side = it.level === '천간' ? 'stem' : 'branch'; hlCells.add(`${it.members[0]}|${side}`); hlCells.add(`${it.members[1]}|${side}`); });
    const miniChart = (pillars: any[], title: string) => (
      <View>
        <Text style={styles.cmTitle}>{title}</Text>
        <View style={styles.cmRow}>
          {pillars.map((x, i) => {
            const stemOn = hlCells.has(`${x.pos}|stem`), branchOn = hlCells.has(`${x.pos}|branch`);
            return (
              <View key={i} style={[styles.cmCol, (x.label === '대운' || x.label === '세운') && styles.cmColLuck]}>
                <Text style={styles.cmLabel}>{x.label}</Text>
                <View style={[styles.cmCell, { backgroundColor: elementColor[stemElement(x.stem)] }, stemOn && styles.cmCellHL]}><Text style={[styles.cmTx, { color: elementText[stemElement(x.stem)] }]}>{x.stem}</Text></View>
                <View style={[styles.cmCell, { backgroundColor: elementColor[branchElement(x.branch)] }, branchOn && styles.cmCellHL]}><Text style={[styles.cmTx, { color: elementText[branchElement(x.branch)] }]}>{x.branch}</Text></View>
              </View>
            );
          })}
        </View>
      </View>
    );
    return (
      <View style={styles.crossWrap}>
        {/* 가로 ScrollView 제거 — 6칸이 화면에 들어가므로 전체 폭에 고르게 분배(나↔상대 세로 정렬) */}
        <View style={{ marginBottom: space(2) }}>{miniChart(mineP, '나')}</View>
        <View>{miniChart(othersP, '상대')}</View>
        {cross.length > 0 && <Text style={styles.cmHint}>작용을 탭하면 위 두 명식에서 해당 글자가 강조됩니다.</Text>}
        <View style={styles.crossList}>
          {cross.length === 0 ? <Text style={styles.note}>두 명식 간 직접 합충형해가 없습니다.</Text> :
            ['합', '충', '형', '해', '파', '극'].map((ty) => {
              const grp = cross.filter((it) => it.type === ty);
              if (!grp.length) return null;
              const col = typeColor(ty);
              return (
                <View key={ty} style={{ marginBottom: space(2) }}>
                  <Text style={[styles.cmGroupHead, { color: col }]}>● {ty} {grp.length}</Text>
                  {grp.map((it, i) => {
                    const isGan = it.level === '천간';
                    const pa = findP(String(it.members[0])), pb = findP(String(it.members[1]));
                    if (!pa || !pb) return null;
                    const ca = isGan ? pa.stem : pa.branch, cb = isGan ? pb.stem : pb.branch;
                    const key = rowKey(it), on = active.has(key);
                    return (
                      <Pressable key={i} onPress={() => toggleActive(key)} style={[styles.cmLinkRow, on && { borderLeftColor: col, backgroundColor: colors.sunk }]}>
                        <Text style={styles.cmLink}>{on ? '◉ ' : '○ '}{pa.who}·{pa.label} <Text style={{ color: elementColor[isGan ? stemElement(ca) : branchElement(ca)], fontWeight: '800' }}>{ca}</Text>{'  ⟷  '}{pb.who}·{pb.label} <Text style={{ color: elementColor[isGan ? stemElement(cb) : branchElement(cb)], fontWeight: '800' }}>{cb}</Text>{'   '}<Text style={{ color: col, fontWeight: '800' }}>{it.type}{it.transformsTo ? ` ${it.transformsTo}` : ''}</Text></Text>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(12) },
  // 궁합 점수 카드(daniel: 메인 콘텐츠 — 점수+등급 이미지)
  scoreCard: { alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, padding: space(5), marginTop: space(4), marginBottom: space(2), ...shadow.card },
  scoreImg: { width: 160, aspectRatio: 0.68, borderRadius: radius.md, marginBottom: space(3) },
  scoreEmoji: { fontSize: 60, marginBottom: space(2) },
  scoreTier: { fontSize: 19, fontWeight: '900', color: colors.ju, marginBottom: space(1) },
  scoreNum: { fontSize: 40, fontWeight: '900', color: colors.ink },
  scoreUnit: { fontSize: 16, fontWeight: '700', color: colors.inkFaint },
  scoreBar: { width: '80%', height: 8, borderRadius: 4, backgroundColor: colors.line, marginTop: space(3), overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 4, backgroundColor: colors.ju },
  scoreSub: { ...font.caption, color: colors.inkSoft, marginTop: space(2) },
  catBanner: { width: '100%', aspectRatio: 1.75, borderRadius: radius.md, marginTop: space(2), marginBottom: space(1) },
  slotLabel: { ...font.caption, color: colors.ju, fontWeight: '800', marginBottom: space(2), letterSpacing: 0.3 },
  // 내 명식 골드 슬롯
  meSlot: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ju, borderRadius: radius.md, padding: space(4), ...shadow.card },
  meSlotName: { fontSize: 16, fontWeight: '800', color: colors.ink },
  meSlotSub: { ...font.caption, color: colors.inkSoft, marginTop: 2 },
  meSlotChange: { color: colors.ju, fontSize: 13, fontWeight: '700' },
  chipRow: { gap: space(2), paddingVertical: space(2) },
  chip: { paddingVertical: space(2), paddingHorizontal: space(4), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { ...font.body, color: colors.ink, fontWeight: '700' },
  chipTxOn: { color: colors.bg },
  orHint: { ...font.caption, color: colors.inkSoft, marginTop: space(2), marginBottom: space(1) },
  placeField: { marginTop: space(2) },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: space(3), fontSize: 15, color: colors.ink, marginTop: space(2), ...shadow.soft },
  inputDim: { opacity: 0.4 },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, padding: space(3.5), alignItems: 'center', marginTop: space(4), ...shadow.card },
  btnOff: { opacity: 0.5 },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  // 상대 명식 등록 버튼(점선) + 등록 폼 모달
  regOtherBtn: { marginTop: space(3), padding: space(3.5), borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, borderStyle: 'dashed', alignItems: 'center', backgroundColor: colors.card },
  regOtherTx: { color: colors.ju, fontSize: 15, fontWeight: '800' },
  modalRoot: { flex: 1, backgroundColor: colors.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(5), paddingTop: space(6), paddingBottom: space(3), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  modalClose: { fontSize: 22, color: colors.inkSoft, fontWeight: '700' },
  // 관계 유형
  relChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(6), marginBottom: space(3) },
  // 연도별 칩(전체/그 해)
  yearChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginBottom: space(3) },
  yearChip: { paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  yearChipOn: { backgroundColor: colors.juSoft, borderColor: colors.ju },
  yearChipTx: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  yearChipTxOn: { color: colors.ju },
  relChip: { paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  relChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  relChipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  relChipTxOn: { color: colors.bg },
  readCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card, alignItems: 'stretch' },
  coreTx: { fontSize: 16, fontWeight: '800', color: colors.ju, lineHeight: 24, marginBottom: space(3) },
  sec: { marginTop: space(4) },
  secLabel: { fontSize: 15, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  secBody: { ...font.body, color: colors.ink, fontSize: 15, lineHeight: 25 },
  remedySec: { marginTop: space(5), paddingTop: space(4), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  busyTx: { ...font.caption, color: colors.inkSoft, marginTop: space(2), textAlign: 'center' },
  note: { ...font.caption, marginTop: space(3) },
  detailToggle: { marginTop: space(5), paddingVertical: space(2) },
  // 추가질문(Q&A) — ReadingScreen 과 동일 스타일
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
  detailToggleTx: { ...font.body, color: colors.inkSoft, fontWeight: '700' },
  // 글자 작용 비교
  crossWrap: { marginTop: space(2) },
  cmTitle: { ...font.caption, color: colors.ju, fontWeight: '700', marginBottom: space(1) },
  // 전체 폭에 칸을 고르게 분배(space-between) + 양끝 패딩 → 나/상대 칸이 화면 양끝에 맞춰 정렬
  cmRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space(1) },
  cmCol: { alignItems: 'center', width: 38 },
  cmColLuck: { backgroundColor: colors.juSoft, borderRadius: radius.sm },
  cmLabel: { fontSize: 9, color: colors.inkFaint, marginBottom: 2 },
  cmCell: { width: 30, height: 30, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginVertical: 1 },
  // 강조 테두리 = 밝은 청록(오행 5색에 없는 색) — 土(골드 #C9A14A)·金 배경에서도 또렷이 보이게(daniel)
  cmCellHL: { borderWidth: 3, borderColor: '#19E3E3' },
  cmTx: { fontSize: 17, fontWeight: '800' },
  cmHint: { ...font.caption, color: colors.inkFaint, marginTop: space(1), marginBottom: space(1) },
  crossList: { marginTop: space(2), padding: space(3), borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  cmGroupHead: { ...font.caption, fontWeight: '800', marginBottom: space(1) },
  cmLinkRow: { borderLeftWidth: 3, borderLeftColor: 'transparent', borderRadius: radius.sm, paddingLeft: space(2) },
  cmLink: { ...font.body, color: colors.ink, paddingVertical: space(1) },
});
