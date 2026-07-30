// app/src/app/(app)/coach.tsx — AI 자기이해 코치(daniel 2026-07-12·App Store 4.3)
// ─────────────────────────────────────────────────────────────────────────
// 독립 대화형 도구 — 사용자가 자신에 대해 궁금한 점을 물으면 그 사람의 사주 차트에 근거해 답한다.
//   '운세 콘텐츠 피드'가 아니라 *상호작용하는 자기이해 도구* = 4.3(스팸) 차별화. Edge coach 분기 사용.
//   무료 일일 N회(비프리미엄)·프리미엄 무제한(서버 판정). 지난 대화는 히스토리로 복원.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, ActivityIndicator, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // ★상단 안전영역 — 고정 여백은 글자확대 시 잘린다(daniel 07-27)
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Alert } from '../../lib/ui/alert';
import { ensureCoinsFor } from '../../lib/billing/coinGate';   // ★코인 단일 경로(daniel 07-28)
import { PressableScale } from '../../components/PressableScale';
import { CoachRouteHint } from '../../components/CoachRouteHint';   // ★코치 → 콘텐츠 안내(daniel 07-27)
import { CoachTarotCard } from '../../components/CoachTarotCard'; // ★코치 답 아래 '가볍게 뽑은 카드'(daniel IMG_8198)
import { ChartPicker } from '../../components/ChartPicker';
import { TigerMascot } from '../../components/TigerMascot'; // 아기 백호 마스코트(모션) — 코치 아바타(생각 중=active)
import { getNavBarHeight } from '../../components/BottomNav'; // 전역 네비바 높이 — 키보드 위 입력바 정확 위치용
import { computeChart } from '../../lib/engine/engine';
import { loadRepChart } from '../../lib/engine/myChart';
import { ensureServerChartId } from '../../lib/backend/prewarmReadings';
import { logEvent } from '../../lib/backend/logger';
import { useAuth } from '../../lib/useAuth';
import { useFontScale } from '../../lib/ui/fontScale';
import { askCoach, loadCoachHistory, deleteCoachHistory, type CoachTurn } from '../../lib/backend/coach';
import { coachSuggestionGroups, type CoachPromptCat } from '../../lib/content/coachPrompts'; // 추천 질문(주제별 프리셋·온디바이스·API 0)
import { useSubscription } from '../../lib/billing/subscription';
import { useAdFree } from '../../lib/billing/adFree'; // 프리미엄=월 10회 무료(서버 COACH_PREMIUM_MONTHLY 가 정본 — 화면은 응답의 freeLimit 을 그대로 표시)
import { showRewardedAd } from '../../lib/core/ads';               // 비프리미엄 무료=보상형 광고(daniel 07-13)
import { purchaseCreditRC } from '../../lib/billing/purchases';    // coach 이용권 즉시 구매
import * as SecureStore from 'expo-secure-store';
import { colors, radius, space, shadow, font } from '../../lib/theme';

// 오늘 이미 무료 광고를 봤는지(하루 1회 무료 게이트용 로컬 플래그) — 서버가 실제 카운트 판정, 이건 광고 노출 UX만.
const COACH_AD_KEY = 'pref.coachAdDate';
function coachAdSeenToday(): boolean {
  try { return (SecureStore as any).getItem?.(COACH_AD_KEY) === new Date().toISOString().slice(0, 10); } catch { return false; }
}
function markCoachAdToday() {
  const d = new Date().toISOString().slice(0, 10);
  try { (SecureStore as any).setItem?.(COACH_AD_KEY, d); } catch { /* noop */ }
  SecureStore.setItemAsync(COACH_AD_KEY, d).catch(() => {});
}

export default function CoachScreen() {
  // ★고정 상단여백(space(12) 등)은 **글자 크기를 키우면 헤더가 상태바 위로 잘린다**(daniel 07-27 IMG_8215).
  //   상수는 기기 노치·다이내믹아일랜드·글자배율 어느 것도 반영하지 못한다 → 실제 안전영역을 쓴다.
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { fs, ls } = useFontScale();
  const router = useRouter();
  const { session } = useAuth();
  const [chartId, setChartId] = useState<string | null>(null);
  const [hasChart, setHasChart] = useState<boolean | null>(null); // null=로딩
  const [history, setHistory] = useState<CoachTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState<{ isPremium: boolean; used: number; freeLimit: number; period: 'day' | 'month' } | null>(null); // 무료 소진 → 이용권
  const { isPremium } = useSubscription();
  const adFree = useAdFree();   // ★광고 제거 구매자 = 보상형 광고 스킵(07-28) // 프리미엄=월 10회 무료(서버 COACH_PREMIUM_MONTHLY 가 정본 — 화면은 응답의 freeLimit 을 그대로 표시)(광고 없음)
  const lastQ = useRef<string>(''); // 이용권 구매 후 재전송용
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

  // 추천 질문(주제별 프리셋) — 탭하면 바로 전송. 대화 시작 문턱↓ + 코치가 답하는 '범위'(자기이해·관계·일·시기)를 노출.
  //   온디바이스 정적(coachPrompts) — 언어 바뀌면 리마운트되므로 렌더마다 해석해도 저렴.
  const groups = coachSuggestionGroups();
  const [qCat, setQCat] = useState<CoachPromptCat>('self'); // 선택된 추천 질문 카테고리(기본=자기이해)
  const activeGroup = groups.find((g) => g.key === qCat) ?? groups[0];

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
      // ★1회 재시도(daniel 2026-07-30 "ai 코치 계속 네트워크 에러떠").
      //   ensureServerChartId 는 서버 RPC 다 — 일시적 네트워크·콜드스타트로 실패할 수 있는데
      //   종전엔 **한 번 실패하면 바로 포기**하고 "명식을 불러오지 못했어요"를 띄웠다.
      //   사용자는 질문을 다시 입력해야 했고, 원인도 알 수 없었다(실패가 로그에도 안 남았다 — 지금은 남는다).
      for (let attempt = 0; attempt < 2 && !id; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 700));   // 짧은 백오프 후 1회만 재시도
        try { const cc = computeChart(ch.input); id = await ensureServerChartId(cc, ch.input, session, ch); }
        catch { id = null; }
      }
      if (!id) {
        logEvent('coach_chartid_fail', { hasSession: !!session });
        Alert.alert('!', t('coach.loadFail', '명식을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
        return;
      }
      setChartId(id);
    }
    setInput(''); setBusy(true); lastQ.current = question;
    // ⑨a(daniel 07-20): 보낸 질문을 *즉시* 말풍선으로 올린다(답은 pending=생성 중). busy 가드로 동시 전송이 없어 pending 은 항상 1개.
    //   질문이 채팅에 바로 남아 '보냈는데 안 뜬다'가 사라진다. (강종 시 서버 이력 보존은 ⑨b=Edge 별도.)
    setHistory((h) => [...h, { question, answer: '', pending: true }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    // 무료 사용 = 보상형 광고(daniel 07-13: 광고 보고 하루 1회 무료). 오늘 이미 봤으면 재노출 안 함(서버가 실제 카운트 판정).
    //   ★광고 제거를 산 사용자에겐 광고를 띄우지 않는다(daniel 07-28) — 돈 내고 없앤 광고를
    //     '무료 사용의 대가'로 다시 보게 하면 산 의미가 없다. 무료 1회는 그대로 준다(서버가 판정).
    //   광고 미시청/실패해도 진행(서버가 무료/needCredit 판정).
    if (!isPremium && !adFree && !coachAdSeenToday()) {
      const rewarded = await showRewardedAd().catch(() => false);
      if (rewarded) markCoachAdToday();
    }
    const res = await askCoach(id, question);
    setBusy(false);
    if (res.kind === 'answer') {
      setHistory((h) => h.map((t) => (t.pending ? { question: t.question, answer: res.answer } : t))); // pending 턴에 답 채움
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    } else {
      setHistory((h) => h.filter((t) => !t.pending)); // 실패(게이트/오류) → 질문 말풍선 회수(lastQ 로 재전송 가능)
      if (res.kind === 'needCredit') setGate({ isPremium: res.isPremium, used: res.used, freeLimit: res.freeLimit, period: res.period });
      else Alert.alert('!', res.message);
    }
  }

  // 입력바 lift = 키보드 높이 − 전역 네비바 높이(네비바가 입력바 아래에 있으니 그만큼만 올리면 키보드 바로 위·틈 없음).
  const lift = kbH > 0 ? Math.max(0, kbH - getNavBarHeight()) : 0;
  return (
    <View style={styles.bg}>
      <ScrollView ref={scrollRef} style={styles.overlay} contentContainerStyle={[styles.wrap, { paddingBottom: 84 + lift }, { paddingTop: insets.top + space(2) }]} keyboardShouldPersistTaps="handled">
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
        {/* 아기 백호 마스코트 — 코치 아바타. busy(답 생성)면 active=true 로 광채·움직임 강화(반응하는 느낌). */}
        {/* marginTop = 후광(halo, size×1.72=~131px)이 76px 박스 위로 ~27px 삐져나오므로 명식 바와 그만큼 띄움(겹침 방지, daniel 07-14). */}
        <TigerMascot size={76} active={busy} style={{ alignSelf: 'center', marginTop: space(8), marginBottom: space(2) }} />
        <Text style={[styles.title, { fontSize: fs(23) }]}>{t('coach.title', 'AI 자기이해 코치')}</Text>
        <Text style={[styles.sub, { fontSize: fs(13) }]}>{t('coach.sub2', '나와 내 삶에 대해 물어보세요. 사주와 자미두수로 함께 답해 드려요.')}</Text>

        {/* 대화 삭제(daniel 07-21) — 히스토리 있을 때만. ★삭제 전 얼랏으로 확인(되돌릴 수 없음). */}
        {history.length > 0 && (
          <PressableScale
            style={{ alignSelf: 'flex-end', paddingVertical: space(2), paddingHorizontal: space(3), marginBottom: space(1) }}
            onPress={() => Alert.alert(
              t('coach.clearTitle', '대화 삭제'),
              t('coach.clearMsg', '이 코치 대화를 모두 지울까요? 되돌릴 수 없어요.'),
              [
                { text: t('common.cancel', '취소'), style: 'cancel' },
                { text: t('coach.clearConfirm', '삭제'), style: 'destructive', onPress: async () => {
                  if (!chartId) return;
                  const ok = await deleteCoachHistory(chartId);
                  if (ok) setHistory([]);
                  else Alert.alert('!', t('coach.clearFail', '삭제하지 못했어요. 잠시 후 다시 시도해 주세요.'));
                } },
              ],
            )}
          >
            <Text style={{ fontSize: fs(12), color: colors.inkFaint, fontWeight: '700' }}>🗑 {t('coach.clear', '대화 삭제')}</Text>
          </PressableScale>
        )}

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
                {turn.pending ? (
                  // 답 생성 중 — 질문 아래에 '생각 중' 인디케이터(⑨a). 별도 하단 인디케이터는 제거해 중복 방지.
                  <View style={styles.thinking}><ActivityIndicator color={colors.ju} /><Text style={styles.thinkingTx}>{t('coach.thinking', '당신의 사주를 살펴보는 중…')}</Text></View>
                ) : turn.answer ? (
                  <View style={styles.aCard}>
                    <Text style={styles.aLabel}>{t('coach.coachLabel', '코치')}</Text>
                    {/* 가독성 — 답변을 문단 단위로 나눠 간격을 준다(COACH_SYSTEM 은 2~4문단 평문 출력).
                        빈 줄(\n\n)·단일 줄바꿈 모두 문단 경계로 보고 빈 문단은 버린다. 포맷만 손대는 것이라 통변 내용/API 무관. */}
                    {turn.answer.split(/\n+/).map((p) => p.trim()).filter(Boolean).map((para, pi) => (
                      <Text key={pi} style={[styles.aTx, { fontSize: fs(15), lineHeight: ls(25) }, pi > 0 && { marginTop: space(2.5) }]}>{para}</Text>
                    ))}
                    {/* ★가볍게 뽑은 카드(daniel IMG_8198) — 위 사주·자미 답과 **분리된** 재미 레이어.
                        섞지 않는 이유 = 기획서 §9 규칙2(체계 블렌딩 금지)의 취지. LLM 프롬프트에 들어가지 않고
                        온디바이스 결정론(질문+날짜 시드)이라 서버 왕복·비용 0. */}
                    {/* ★콘텐츠 안내(daniel 07-27 "코치가 컨텐츠로 안내하고") — 질문에 실제로 나온 말에만 반응.
                        온디바이스 결정론이라 없는 콘텐츠로 안내할 수 없고 토큰 비용도 0. */}
                    <CoachRouteHint question={turn.question} />
                    <CoachTarotCard seed={turn.question} />
                  </View>
                ) : (
                  // ⑨b: 서버에 질문은 남았으나 답이 빈 행(강종/생성 중단으로 답 못 받음) — 재진입 시 안내(질문은 보존됨).
                  <View style={styles.aCard}>
                    <Text style={styles.aLabel}>{t('coach.coachLabel', '코치')}</Text>
                    <Text style={[styles.aTx, { fontSize: fs(14), lineHeight: ls(22), color: colors.inkSoft }]}>{t('coach.failedTurn', '답을 받지 못했어요. 다시 물어봐 주세요.')}</Text>
                  </View>
                )}
              </View>
            ))}

            {/* 무료 일일 소진 게이트 → 프리미엄 유도 */}
            {gate ? (
              <View style={styles.gateCard}>
                <Text style={styles.gateTitle}>{gate.isPremium ? t('coach.gateTitleMonth', '이번 달 무료 질문을 다 쓰셨어요') : t('coach.gateTitle', '오늘 무료 질문을 다 쓰셨어요')}</Text>
                <Text style={styles.gateDesc}>{gate.isPremium
                  ? t('coach.gateDescMonth', { count: gate.freeLimit, defaultValue: '코인으로 더 물어볼 수 있어요.' })
                  : t('coach.gateDescDay', { count: gate.freeLimit, defaultValue: '무료는 하루 {{count}}번(광고 시청)이에요. 코인으로 더 물어볼 수 있어요.' })}</Text>
                {/* 이용권으로 물어보기 — 즉시 구매 후 마지막 질문 재전송 */}
                <PressableScale style={styles.gateBtn} onPress={async () => {
                  try {
                    // ★코인 전환(daniel 2026-07-28 "기존 단건 결제는 다 없애") — 스토어 결제 대신 보유 코인.
                    const g = await ensureCoinsFor('coach', { title: t('coach.title', 'AI 코치'), t, goCharge: () => router.push('/coins') });
                    if (g !== 'ok') return;   // 부족·취소·조회실패는 게이트가 안내까지 마쳤다
                    setGate(null);
                    if (lastQ.current) void send(lastQ.current); // 구매 성공 → 그 질문 재전송(서버가 이용권 차감)
                  } catch (e) { Alert.alert('!', (e as Error).message); } // ★결제 미준비·오프라인·풀이 불가(헬스 게이트) 친화 표출(throw 미포장 결함 수정)
                }}>
                  <Text style={styles.gateBtnTx}>{t('coach.gateBuy', '이용권으로 물어보기')}</Text>
                </PressableScale>
                {!gate.isPremium && (
                  <PressableScale style={styles.gatePrem} onPress={() => router.push('/market')}>
                    <Text style={styles.gatePremTx}>{t('coach.gateCta', '코인 충전하기')}</Text>
                  </PressableScale>
                )}
              </View>
            ) : (
              <>
                {/* 추천 질문(첫 진입/대화 사이) — 주제 칩(범위 노출) + 그 주제의 질문 칩. 탭=바로 전송. */}
                {!busy && (
                  <View style={styles.suggest}>
                    {/* 주제 선택 — 코치가 답하는 범위(자기이해·관계·일·시기)를 한눈에 */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
                      {groups.map((g) => (
                        <PressableScale key={g.key} style={[styles.catChip, g.key === qCat && styles.catChipOn]} onPress={() => setQCat(g.key)}>
                          <Text style={[styles.catTx, g.key === qCat && styles.catTxOn, { fontSize: fs(12.5) }]}>{g.label}</Text>
                        </PressableScale>
                      ))}
                    </ScrollView>
                    {/* 선택 주제의 질문 프리셋 */}
                    {activeGroup?.questions.map((q, i) => (
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
  wrap: { paddingHorizontal: space(6), paddingBottom: space(24) }, // ★헤더 숨김(탭) → status bar 여백 확보(홈과 동일·daniel 07-12 '위 짤림')
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
  // 추천 질문
  suggest: { marginTop: space(2), gap: space(2.5) },
  // 주제(카테고리) 칩 — 코치 답변 범위 노출(TodayRelationCard 카테고리 칩과 동일 톤)
  catRow: { gap: space(1.5), paddingBottom: space(1) },
  catChip: { paddingVertical: space(1.5), paddingHorizontal: space(3), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.juSoft },
  catChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  catTx: { fontWeight: '800', color: colors.ju },
  catTxOn: { color: '#15132E' },
  // 질문 칩
  chip: { backgroundColor: colors.sunk, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingVertical: space(3), paddingHorizontal: space(4) },
  chipTx: { color: colors.inkSoft, fontWeight: '700' },
  // 게이트
  gateCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, borderStyle: 'dashed', padding: space(6), alignItems: 'center', marginTop: space(3), ...shadow.card },
  gateTitle: { ...font.heading, color: colors.ink, textAlign: 'center' },
  gateDesc: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(2.5), marginBottom: space(5), lineHeight: 22 },
  gateBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(3.25) },
  gateBtnTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  gatePrem: { marginTop: space(3), paddingVertical: space(2) },
  gatePremTx: { color: colors.ju, fontSize: 13, fontWeight: '700' },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', lineHeight: 19, marginTop: space(6) },
  // 입력바
  inputBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: space(2.5), paddingHorizontal: space(5), paddingVertical: space(3), backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.juLine },
  input: { flex: 1, maxHeight: 100, backgroundColor: colors.sunk, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space(3.5), paddingVertical: space(2.5), color: colors.ink },
  sendBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingHorizontal: space(4), paddingVertical: space(3) },
  sendBtnOff: { opacity: 0.4 },
  sendTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
});
