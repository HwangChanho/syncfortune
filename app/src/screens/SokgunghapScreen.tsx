// app/src/screens/SokgunghapScreen.tsx — 속궁합(성적 궁합) 화면 (온디바이스·API 0·17+)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-14 기획서 ④. 흐름: ①17+ 성인 게이트(+‘재미로만’ disclaimer, 1회) → ②상대 선택(저장 명식 또는 신규 등록)
//   → ③결정론 속궁합 결과(등급·게이지·신호칩·통변·처방). PII=상대 동의(규칙8). 명시적 성적 콘텐츠는 17+ 게이트 뒤에만.
//   §4: 부정 증폭 금지·처방 동반·의료/심리 단정 금지. 성적 주제를 솔직히 다루되 노골/외설 배제.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../components/PressableScale';
import { Alert } from '../lib/ui/alert';
import { computeChart } from '../lib/engine/engine';
import { listCharts, addChart, getRepresentativeId, ChartLimitError, type SavedChart } from '../lib/engine/myChart';
import { useSubscription } from '../lib/billing/subscription';
import { ChartRegisterScreen } from './ChartRegisterScreen';
import { analyzeSokgunghap, SOK_TIERS, type SokResult } from '../lib/content/sokgunghap';
import { sokgunghapReading } from '../lib/content/sokgunghapReadings';
import { appLang } from '../lib/i18n';
import { useLogContentVisit } from '../lib/backend/contentVisit';
import { colors, radius, space, shadow, font } from '../lib/theme';
import type { ChartInput } from '@spec/chart';

const GATE_KEY = 'pref.sok17ok'; // 17+ 성인 확인 1회 저장(재진입 시 재확인 생략)
function gate17Seen(): boolean {
  try { return (SecureStore as any).getItem?.(GATE_KEY) === '1'; } catch { return false; }
}
function markGate17() {
  try { (SecureStore as any).setItem?.(GATE_KEY, '1'); } catch { /* noop */ }
  SecureStore.setItemAsync(GATE_KEY, '1').catch(() => {});
}

export function SokgunghapScreen({ me }: { me: ChartInput }) {
  useLogContentVisit('sokgunghap');
  const { t } = useTranslation();
  const lang = appLang();
  const { isPremium } = useSubscription();
  const [gated, setGated] = useState<boolean>(() => gate17Seen()); // true=성인확인 완료
  const [saved, setSaved] = useState<SavedChart[]>([]);
  const [repId, setRepId] = useState<string | null>(null);
  const [partner, setPartner] = useState<SavedChart | null>(null);
  const [otherReg, setOtherReg] = useState(false);
  const [result, setResult] = useState<SokResult | null>(null);
  const [busy, setBusy] = useState(false);

  // 저장 명식 로드(상대 후보) — 대표(나)는 상대 목록에서 제외.
  useEffect(() => {
    (async () => {
      const [list, rid] = await Promise.all([listCharts(), getRepresentativeId()]);
      setSaved(list); setRepId(rid);
    })().catch(() => {});
  }, []);

  // 상대 선택 → 두 명식 결정론 계산 → 속궁합 산출.
  function runWith(pInput: ChartInput, p: SavedChart | null) {
    setBusy(true);
    try {
      const meC = computeChart(me), otherC = computeChart(pInput);
      setResult(analyzeSokgunghap(meC, otherC)); // {saju,sinsal} 구조 = SokSide
      setPartner(p);
    } catch (e) {
      Alert.alert('!', (e as Error).message);
    } finally { setBusy(false); }
  }

  // 신규 상대 등록(정식 폼) → 저장 + 즉시 분석.
  async function onRegisterOther(input: any) {
    try {
      const id = await addChart(input, { isPro: isPremium });
      const list = await listCharts(); setSaved(list);
      setOtherReg(false);
      const sc = list.find((c) => c.id === id) ?? null;
      runWith(input, sc);
    } catch (e) {
      if (e instanceof ChartLimitError) Alert.alert(t('register.limitTitle'), t('register.limitMsg', { limit: e.limit }));
      else Alert.alert('!', (e as Error).message);
    }
  }

  // ── 17+ 성인 게이트(1회) ──
  if (!gated) {
    return (
      <View style={styles.center}>
        <View style={styles.gateCard}>
          <Text style={styles.gateEmoji}>🔞</Text>
          <Text style={styles.gateTitle}>{t('sok.gateTitle', '성인(19세 이상) 콘텐츠')}</Text>
          <Text style={styles.gateDesc}>{t('sok.gateDesc', '속궁합은 두 사람의 성적 궁합을 사주로 풀어보는 성인용 콘텐츠예요. 재미로만 즐겨 주세요.')}</Text>
          <PressableScale style={styles.gateBtn} onPress={() => { markGate17(); setGated(true); }}>
            <Text style={styles.gateBtnTx}>{t('sok.gateConfirm', '만 19세 이상입니다 · 시작')}</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  const partners = saved.filter((c) => c.id !== repId); // 나(대표) 제외한 상대 후보
  const reading = result ? sokgunghapReading(result, lang) : null;

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.wrap}>
      <Text style={styles.h1}>{t('sok.title', '속궁합')}</Text>
      <Text style={styles.sub}>{t('sok.sub', '두 사람의 성적 궁합을 사주로 — 재미로 보는 성인 콘텐츠')}</Text>

      {/* 상대 선택 */}
      <Text style={styles.section}>{t('sok.pickPartner', '상대 선택')}</Text>
      <View style={styles.chips}>
        {partners.map((c) => (
          <PressableScale key={c.id} style={[styles.chip, partner?.id === c.id && styles.chipOn]} onPress={() => runWith(c.input, c)}>
            <Text style={[styles.chipTx, partner?.id === c.id && styles.chipTxOn]}>{c.label || c.input.birthDateTime?.slice(0, 10) || '상대'}</Text>
          </PressableScale>
        ))}
        <PressableScale style={styles.chipAdd} onPress={() => setOtherReg(true)}>
          <Text style={styles.chipAddTx}>＋ {t('sok.newPartner', '새 상대 입력')}</Text>
        </PressableScale>
      </View>

      {busy && <ActivityIndicator color={colors.ju} style={{ marginTop: space(6) }} />}

      {/* 결과 */}
      {reading && result && !busy && (
        <View style={styles.result}>
          {/* 등급 히어로 + 점수 게이지 */}
          <View style={styles.heroCard}>
            <Text style={styles.heroEmoji}>{result.tier.emoji}</Text>
            <Text style={styles.heroLabel}>{(result.tier as any)[lang] ?? result.tier.ko}</Text>
            <View style={styles.gaugeTrack}><View style={[styles.gaugeFill, { width: `${result.score}%` }]} /></View>
            <Text style={styles.heroScore}>{result.score}<Text style={styles.heroScoreUnit}> / 100</Text></Text>
          </View>

          {/* 결정론 신호 칩(근거 투명성) */}
          <View style={styles.sigWrap}>
            {result.signals.map((s, i) => (
              <View key={i} style={styles.sig}><Text style={styles.sigTx}>{s}</Text></View>
            ))}
          </View>

          {/* 통변 본문 */}
          <View style={styles.card}><Text style={styles.body}>{reading.body}</Text></View>
          <View style={styles.card}><Text style={styles.noteLabel}>{t('sok.spouseLabel', '배우자궁 케미')}</Text><Text style={styles.body}>{reading.spouseNote}</Text></View>
          <View style={[styles.card, styles.adviceCard]}><Text style={styles.adviceLabel}>{t('sok.adviceLabel', '더 좋아지는 법')}</Text><Text style={styles.body}>{reading.advice}</Text></View>
        </View>
      )}

      <Text style={styles.disclaimer}>{t('sok.disclaimer', '※ 사주로 보는 재미 콘텐츠예요. 실제 관계는 두 사람이 만들어갑니다. 성인(19세 이상) 전용.')}</Text>

      {/* 신규 상대 등록 폼 */}
      <Modal visible={otherReg} animationType="slide" onRequestClose={() => setOtherReg(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{t('sok.newPartner', '새 상대 입력')}</Text>
            <PressableScale onPress={() => setOtherReg(false)}><Text style={styles.modalX}>✕</Text></PressableScale>
          </View>
          <ChartRegisterScreen defaultRelation="지인" submitLabel={t('sok.registerSubmit', '이 상대로 속궁합 보기')} showMakeRep={false} onSubmit={onRegisterOther} />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },
  wrap: { padding: space(6), paddingTop: space(12), paddingBottom: space(16) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: 'transparent' },
  h1: { ...font.display, color: colors.ink, textAlign: 'center' },
  sub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(1), marginBottom: space(6) },
  section: { ...font.label, color: colors.inkSoft, marginBottom: space(3) },
  // 17+ 게이트
  gateCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.ju, padding: space(7), alignItems: 'center', ...shadow.card },
  gateEmoji: { fontSize: 44, marginBottom: space(3) },
  gateTitle: { ...font.heading, color: colors.ink, textAlign: 'center' },
  gateDesc: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(3), marginBottom: space(6), lineHeight: 22 },
  gateBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(7), paddingVertical: space(3.5) },
  gateBtnTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  // 상대 칩
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2.5) },
  chip: { backgroundColor: colors.sunk, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space(4), paddingVertical: space(2.5) },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { color: colors.inkSoft, fontWeight: '700', fontSize: 13 },
  chipTxOn: { color: colors.bg },
  chipAdd: { backgroundColor: 'transparent', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.ju, borderStyle: 'dashed', paddingHorizontal: space(4), paddingVertical: space(2.5) },
  chipAddTx: { color: colors.ju, fontWeight: '800', fontSize: 13 },
  // 결과
  result: { marginTop: space(6), gap: space(4) },
  heroCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, padding: space(6), alignItems: 'center', ...shadow.card },
  heroEmoji: { fontSize: 52 },
  heroLabel: { ...font.title, color: colors.ink, marginTop: space(2), marginBottom: space(4) },
  gaugeTrack: { width: '100%', height: 10, borderRadius: 5, backgroundColor: colors.sunk, overflow: 'hidden' },
  gaugeFill: { height: '100%', borderRadius: 5, backgroundColor: colors.ju },
  heroScore: { ...font.display, color: colors.ju, marginTop: space(3) },
  heroScoreUnit: { ...font.caption, color: colors.inkFaint },
  sigWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  sig: { backgroundColor: colors.sunk, borderRadius: radius.sm, paddingHorizontal: space(2.5), paddingVertical: space(1.5) },
  sigTx: { ...font.caption, color: colors.inkSoft, fontSize: 11 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card },
  adviceCard: { borderColor: colors.ju, borderStyle: 'dashed' },
  noteLabel: { ...font.label, color: colors.ju, marginBottom: space(2) },
  adviceLabel: { ...font.label, color: colors.ju, marginBottom: space(2) },
  body: { ...font.body, color: colors.ink, lineHeight: 24 },
  disclaimer: { ...font.caption, color: colors.inkFaint, textAlign: 'center', lineHeight: 19, marginTop: space(8) },
  // 모달
  modalBg: { flex: 1, backgroundColor: colors.bg },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(5), paddingTop: space(12), paddingBottom: space(3), borderBottomWidth: 1, borderBottomColor: colors.line },
  modalTitle: { ...font.heading, color: colors.ink },
  modalX: { fontSize: 20, color: colors.inkSoft, paddingHorizontal: space(2) },
});
