// app/src/app/(app)/coach.tsx — AI 자기이해 코치(daniel 2026-07-12·App Store 4.3)
// ─────────────────────────────────────────────────────────────────────────
// 독립 대화형 도구 — 사용자가 자신에 대해 궁금한 점을 물으면 그 사람의 사주 차트에 근거해 답한다.
//   '운세 콘텐츠 피드'가 아니라 *상호작용하는 자기이해 도구* = 4.3(스팸) 차별화. Edge coach 분기 사용.
//   무료 일일 N회(비프리미엄)·프리미엄 무제한(서버 판정). 지난 대화는 히스토리로 복원.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, ActivityIndicator, Keyboard, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Alert } from '../../lib/ui/alert';
import { PressableScale } from '../../components/PressableScale';
import { ChartPicker } from '../../components/ChartPicker';
import { getNavBarHeight } from '../../components/BottomNav'; // 전역 네비바 높이 — 키보드 위 입력바 정확 위치용
import { computeChart } from '../../lib/engine/engine';
import { loadRepChart } from '../../lib/engine/myChart';
import { ensureServerChartId } from '../../lib/backend/prewarmReadings';
import { useAuth } from '../../lib/useAuth';
import { useFontScale } from '../../lib/ui/fontScale';
import { askCoach, loadCoachHistory, type CoachTurn } from '../../lib/backend/coach';
import { colors, radius, space, shadow, font } from '../../lib/theme';

export default function CoachScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const { session } = useAuth();
  const [chartId, setChartId] = useState<string | null>(null);
  const [hasChart, setHasChart] = useState<boolean | null>(null); // null=로딩
  const [history, setHistory] = useState<CoachTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState<{ used: number; dailyLimit: number } | null>(null); // 무료 일일 소진
  const [reloadKey, setReloadKey] = useState(0);
  const [kbH, setKbH] = useState(0); // 키보드 높이(px) — 입력바를 키보드 바로 위로 올림(전역 네비바 보정)
  const scrollRef = useRef<ScrollView>(null);

  // 키보드 높이 추적 — 전역 BottomNav 가 KAV 밖(하단)이라 표준 KeyboardAvoidingView 로는 네비바 높이만큼 틈이 생김.
  //   리스너로 키보드 높이를 받아 입력바를 절대위치로 정확히 키보드 위에 붙인다(daniel 07-12 '입력바 뜬 뷰 껴있음').
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKbH(e.endCoordinates?.height ?? 0));
    const h = Keyboard.addListener(hideEvt, () => setKbH(0));
    return () => { s.remove(); h.remove(); };
  }, []);

  // 제안 질문(자기이해) — 탭하면 바로 전송. 대화 시작 문턱↓.
  const SUGGESTIONS = [t('coach.q1'), t('coach.q2'), t('coach.q3'), t('coach.q4')];

  // 대표 명식 → serverChartId + 지난 대화 로드(명식 전환·포커스 시 재로드)
  useEffect(() => {
    let alive = true;
    setHistory([]); setGate(null); setChartId(null);
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      if (!ch) { setHasChart(false); return; }
      setHasChart(true);
      if (!session) return; // 세션(익명 포함) 준비 후 재시도 — session 이 dep 라 준비되면 재실행
      try {
        const cc = computeChart(ch.input);
        const id = await ensureServerChartId(cc, ch.input, session, ch);
        if (!alive || !id) return;
        setChartId(id);
        const h = await loadCoachHistory(id);
        if (alive) setHistory(h);
      } catch { /* 로드 실패 = 빈 대화로 시작 */ }
    })().catch(() => { if (alive) setHasChart(false); });
    return () => { alive = false; };
  }, [reloadKey, session]);

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    let id = chartId;
    if (!id) { // 아직 미해석 시 즉석 해석
      const ch = await loadRepChart();
      if (!ch) { setHasChart(false); return; }
      if (!session) { Alert.alert('!', t('coach.loadFail', '명식을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')); return; }
      try { const cc = computeChart(ch.input); id = await ensureServerChartId(cc, ch.input, session, ch); } catch { id = null; }
      if (!id) { Alert.alert('!', t('coach.loadFail', '명식을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')); return; }
      setChartId(id);
    }
    setInput(''); setBusy(true);
    const res = await askCoach(id, question);
    setBusy(false);
    if (res.kind === 'answer') {
      setHistory((h) => [...h, { question, answer: res.answer }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    } else if (res.kind === 'needPremium') {
      setGate({ used: res.used, dailyLimit: res.dailyLimit });
    } else {
      Alert.alert('!', res.message);
    }
  }

  // 입력바 lift = 키보드 높이 − 전역 네비바 높이(네비바가 입력바 아래에 있으니 그만큼만 올리면 키보드 바로 위·틈 없음).
  const lift = kbH > 0 ? Math.max(0, kbH - getNavBarHeight()) : 0;
  return (
    <View style={styles.bg}>
      <ScrollView ref={scrollRef} style={styles.overlay} contentContainerStyle={[styles.wrap, { paddingBottom: 84 + lift }]} keyboardShouldPersistTaps="handled">
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
        <Text style={[styles.title, { fontSize: fs(23) }]}>{t('coach.title', 'AI 자기이해 코치')}</Text>
        <Text style={[styles.sub, { fontSize: fs(13) }]}>{t('coach.sub', '나에 대해 궁금한 걸 물어보세요. 당신의 사주로 답해 드려요.')}</Text>

        {hasChart === false ? (
          <View style={styles.card}>
            <Text style={[styles.readTx, { fontSize: fs(15) }]}>{t('coach.needChart', '먼저 명식을 등록해 주세요.')}</Text>
            <PressableScale style={styles.regBtn} onPress={() => router.push('/register')}>
              <Text style={styles.regBtnTx}>{t('coach.registerBtn', '명식 등록하기')}</Text>
            </PressableScale>
          </View>
        ) : (
          <>
            {/* 대화 히스토리 — 질문(오른쪽) + 코치 답(카드) */}
            {history.map((turn, i) => (
              <View key={i} style={styles.turn}>
                <View style={styles.qBubble}><Text style={[styles.qTx, { fontSize: fs(14) }]}>{turn.question}</Text></View>
                <View style={styles.aCard}>
                  <Text style={styles.aLabel}>{t('coach.coachLabel', '코치')}</Text>
                  <Text style={[styles.aTx, { fontSize: fs(15), lineHeight: fs(25) }]}>{turn.answer}</Text>
                </View>
              </View>
            ))}
            {busy ? <View style={styles.thinking}><ActivityIndicator color={colors.ju} /><Text style={styles.thinkingTx}>{t('coach.thinking', '당신의 사주를 살펴보는 중…')}</Text></View> : null}

            {/* 무료 일일 소진 게이트 → 프리미엄 유도 */}
            {gate ? (
              <View style={styles.gateCard}>
                <Text style={styles.gateTitle}>{t('coach.gateTitle', '오늘 무료 질문을 다 쓰셨어요')}</Text>
                <Text style={styles.gateDesc}>{t('coach.gateDesc', { count: gate.dailyLimit, defaultValue: '무료로 하루 {{count}}번까지 물어볼 수 있어요. 프리미엄이면 제한 없이 코치와 대화할 수 있어요.' })}</Text>
                <PressableScale style={styles.gateBtn} onPress={() => router.push('/market')}>
                  <Text style={styles.gateBtnTx}>{t('coach.gateCta', '프리미엄 보기')}</Text>
                </PressableScale>
              </View>
            ) : (
              <>
                {/* 제안 질문(첫 진입/대화 사이) */}
                {!busy && (
                  <View style={styles.suggest}>
                    {SUGGESTIONS.map((q, i) => (
                      <PressableScale key={i} style={styles.chip} onPress={() => send(q)}>
                        <Text style={[styles.chipTx, { fontSize: fs(13) }]}>{q}</Text>
                      </PressableScale>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
        <Text style={styles.note}>{t('coach.note', '※ 사주로 나를 이해하는 참고예요. 의료·법률·투자 결정은 전문가와 상의하세요.')}</Text>
      </ScrollView>

      {/* 입력바 — 절대위치, 키보드 위에 정확히(전역 네비바 높이 보정). 명식 있을 때만. */}
      {hasChart !== false && !gate ? (
        <View style={[styles.inputBar, { bottom: lift }]}>
          <TextInput
            style={[styles.input, { fontSize: fs(15) }]}
            value={input}
            onChangeText={setInput}
            placeholder={t('coach.placeholder', '나에 대해 물어보세요')}
            placeholderTextColor={colors.inkFaint}
            maxLength={120}
            multiline
            editable={!busy}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
          />
          <PressableScale style={[styles.sendBtn, (!input.trim() || busy) && styles.sendBtnOff]} onPress={() => send(input)} disabled={!input.trim() || busy}>
            <Text style={styles.sendTx}>{t('coach.send', '보내기')}</Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' }, // 전역 ContentBackdrop 비침
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { paddingHorizontal: space(6), paddingTop: space(12), paddingBottom: space(6) }, // ★헤더 숨김(탭) → status bar 여백 확보(홈과 동일·daniel 07-12 '위 짤림')
  title: { fontWeight: '900', color: colors.ink, textAlign: 'center', marginTop: space(2) },
  sub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(1), marginBottom: space(5) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card, alignItems: 'center' },
  readTx: { ...font.body, color: colors.ink, textAlign: 'center' },
  regBtn: { marginTop: space(4), backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(5), paddingVertical: space(2.5) },
  regBtnTx: { color: colors.bg, fontSize: 14, fontWeight: '800' },
  // 대화
  turn: { marginBottom: space(4) },
  qBubble: { alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: colors.ju, borderRadius: radius.lg, borderBottomRightRadius: 4, paddingHorizontal: space(4), paddingVertical: space(2.75), marginBottom: space(2.5) },
  qTx: { color: colors.bg, fontWeight: '700' },
  aCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.juLine, padding: space(4.5), ...shadow.card },
  aLabel: { fontSize: 11, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  aTx: { ...font.body, color: colors.ink },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), paddingVertical: space(3), paddingHorizontal: space(2) },
  thinkingTx: { ...font.caption, color: colors.inkSoft },
  // 제안 질문
  suggest: { marginTop: space(2), gap: space(2.5) },
  chip: { backgroundColor: colors.sunk, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingVertical: space(3), paddingHorizontal: space(4) },
  chipTx: { color: colors.inkSoft, fontWeight: '700' },
  // 게이트
  gateCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, borderStyle: 'dashed', padding: space(6), alignItems: 'center', marginTop: space(3), ...shadow.card },
  gateTitle: { ...font.heading, color: colors.ink, textAlign: 'center' },
  gateDesc: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(2.5), marginBottom: space(5), lineHeight: 22 },
  gateBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(3.25) },
  gateBtnTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', lineHeight: 19, marginTop: space(6) },
  // 입력바
  inputBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: space(2.5), paddingHorizontal: space(5), paddingVertical: space(3), backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.juLine },
  input: { flex: 1, maxHeight: 100, backgroundColor: colors.sunk, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space(3.5), paddingVertical: space(2.5), color: colors.ink },
  sendBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingHorizontal: space(4), paddingVertical: space(3) },
  sendBtnOff: { opacity: 0.4 },
  sendTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
});
