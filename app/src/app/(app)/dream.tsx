// src/app/(app)/dream.tsx — 꿈해몽 (가볍게·무료·온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// 키워드 검색 → 해몽(lib/dreamDict). 인기 키워드 칩. 규칙5: 무료=온디바이스(API 0). §4: 전향적.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { useTranslation } from 'react-i18next';
import { searchDreams, DREAM_POPULAR, dreamTitle, dreamMeaning, popularLabel } from '../../lib/content/dreamDict';
import { supabase } from '../../lib/supabase';        // 사전 miss → LLM 폴백(전역 캐시)
import { appLang } from '../../lib/i18n';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { ContentHero } from '../../components/SpecialContentScreen'; // 이미지 히어로(보는 맛)
import { Alert } from '../../lib/ui/alert';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/useAuth';
import { useSubscription } from '../../lib/billing/subscription';
import { isAdmin } from '../../lib/core/admin';
import { waitForCreditGrant } from '../../lib/billing/coupons';          // C1: 결제 후 웹훅 적립 폴링(차감·게이트는 Edge 서버 권위)
import { purchaseCreditRC, purchasesEnabled } from '../../lib/billing/purchases'; // 꿈해몽 5회 번들 결제
import { requireLoginForPurchase } from '../../lib/billing/requireLogin';
import { confirmReadingChart } from '../../lib/ui/confirmChart'; // 생성 전 확인 + 보유 이용권 안내(daniel)
import { setGenProgress } from '../../lib/backend/genProgress'; // 일회성 진행도(daniel·docs/CONTENT_API_INVENTORY.md)
import { acquireGen, releaseGen } from '../../lib/backend/genLock'; // 크로스마운트 이중 생성 잠금(② 이중 LLM 방지)
import { invokeFail } from '../../lib/backend/interpretResult'; // 방어: 일시적 불가/오류 친화 처리(dream은 reading 아닌 dream 구조라 invokeFail만)
import { assertOnline } from '../../lib/backend/network'; // daniel: 네트워크/서버 미연결 시 풀이 생성 차단
import { TTSButton } from '../../components/TTSButton'; // 풀이 음성 읽기(온디바이스 TTS·무료)
import { DoorReveal } from '../../components/DoorReveal'; // 유료 AI 해몽 공개 순간 골드 명조 문 열림 영상(daniel 07-06)
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회 기록

// 계정별 지난 AI 꿈해몽 한 건(테이블 public.dream_readings 1행). RLS로 본인 것만 조회/삽입(user_id=auth.uid).
//   ★재진입 버그 해소: aiResult는 로컬 state뿐이라 완료 배너 탭 → /dream 새 마운트 시 사라짐 → DB에 저장해 목록으로 재조회.
type DreamRow = { id: string; input_text: string; title: string; meaning: string; lang: string; created_at: string };

// created_at(ISO) → 짧은 날짜 'YYYY.MM.DD'(newyear/love 만료일과 동일 포맷). 목록 각 항목의 날짜 표기용.
function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function DreamScreen() {
  useLogContentVisit('dream'); // 진입 1회 방문 기록(daniel 2026-07-06)
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const [q, setQ] = useState('');
  // AI 해몽(자유 텍스트, 항상 열림) — 건당 ₩300 이용권(프리미엄/관리자 무료). 사전 키워드 검색과 별개.
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<{ title: string; meaning: string } | null>(null);
  // 지난 AI 꿈해몽 목록(계정별, 최신순 최대 50 — 초과분은 DB 트리거가 자동 삭제). 로그인 시 마운트에서 로드.
  const [pastDreams, setPastDreams] = useState<DreamRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null); // 목록 아코디언: 펼친 항목 id(탭하면 본문 표시)
  // ★유료 AI 꿈해몽(₩300)이 공개되는 순간만 골드 명조 문 연출 — 무료 사전검색/키워드 폴백엔 재생 안 함.
  //   AI 해몽은 반복 유료라 prev-ref로 '새 결과가 뜰 때마다' 1회(재렌더로는 재생 안 함·SpecialContentScreen prevRevealed 패턴).
  const [doorPlaying, setDoorPlaying] = useState(false);
  const prevAiResult = useRef<{ title: string; meaning: string } | null>(null);
  useEffect(() => {
    if (aiResult && aiResult !== prevAiResult.current) setDoorPlaying(true);
    prevAiResult.current = aiResult;
  }, [aiResult]);
  // 지난 꿈해몽 로드 — 로그인 상태면 최신순 50건 조회(RLS가 본인 것만 반환). 로그아웃/미로그인=빈 목록.
  //   완료 배너 탭으로 /dream 재진입해도 이 목록으로 방금 만든 해몽을 다시 볼 수 있음(재진입 버그 해소).
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setPastDreams([]); return; } // 미로그인 = 저장/조회 스킵(로그인 게이트는 결제 경로에 이미 존재)
    let alive = true; // 언마운트 후 setState 방지
    (async () => {
      const { data, error } = await supabase
        .from('dream_readings')
        .select('id, input_text, title, meaning, lang, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!alive || error) return; // 실패해도 조용히(로컬 aiResult 흐름엔 영향 없음)
      setPastDreams((data ?? []) as DreamRow[]);
    })();
    return () => { alive = false; };
  }, [session?.user?.id]);
  const results = useMemo(() => searchDreams(q), [q]);
  // LLM 폴백 — 사전에 없는 꿈은 Edge(kind='dream')로 즉석 해몽(전역 캐시 → 없으면 생성). 검색어 바뀌면 리셋.
  const [llm, setLlm] = useState<{ title: string; meaning: string } | null>(null);
  const [llmBusy, setLlmBusy] = useState(false);
  useEffect(() => { setLlm(null); }, [q]);
  async function searchLLM() {
    const kw = q.trim();
    if (!kw || llmBusy) return;
    setLlmBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('interpret', { body: { kind: 'dream', keyword: kw, lang: appLang() } });
      // 방어: 일시적 불가/오류면 친화 메시지를 meaning 자리에(원문 'non-2xx' 노출 방지)
      const fail = invokeFail(data, error);
      setLlm(fail ? { title: kw, meaning: fail.message } : ((data?.dream as any) ?? { title: kw, meaning: t('dream.fail', '해몽을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') }));
    } catch { setLlm({ title: kw, meaning: t('dream.fail', '해몽을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') }); }
    setLlmBusy(false);
  }

  // 생성 전 '이 풀이를 만들지' 확인(+보유 이용권) → 확인 시 doStart(daniel 07-02). 꿈해몽은 명식 무관 → 명식명 생략(확인창은 '현재 명식').
  function onAI() {
    const text = aiText.trim();
    if (text.length < 4 || aiBusy) return;
    void confirmReadingChart({ creditKind: 'dream', chartless: true, t, onConfirm: () => { void doStart(); } });
  }
  // AI 해몽(자유 텍스트) — 게이트(프리미엄/관리자 무료 / 그 외 ₩300 이용권) 후 Edge 자유텍스트 해몽.
  async function doStart() {
    const text = aiText.trim();
    if (text.length < 4 || aiBusy) return;
    // ★C3b/C1(daniel 07-03): dream 게이트를 서버(Edge)로 이관 — 클라 useCredit 차감 제거(서버 이중차감 방지).
    //   프리미엄/관리자는 무료(Edge 도 동일 바이패스) / 그 외는 Edge 가 'dream' 이용권 차감 → 없으면 needPayment(runAI 가 구매 제안).
    if (!isPremium) {
      const admin = await isAdmin().catch(() => false);
      if (!admin && !requireLoginForPurchase(session, () => router.push('/login'), t)) return; // 로그인만 보장(결제=계정 귀속)
    }
    runAI(text);
  }

  // 꿈해몽 5회 번들 구매 제안 — Apple IAP 최저가(₩1,200)=5회. 구매 성공 → 5 적립 → 1 차감 → 진행(daniel).
  function promptBuyDream(text: string) {
    if (!purchasesEnabled()) { Alert.alert(t('dream.aiTitle', 'AI 꿈해몽'), t('dream.needCredit', '꿈해몽 이용권이 필요해요. 설정에서 쿠폰을 등록하거나 잠시 후 다시 시도해 주세요.')); return; }
    Alert.alert(
      t('dream.aiTitle', 'AI 꿈해몽'),
      t('dream.buyBundle', '꿈해몽 5회 이용권을 구매할까요? (₩1,200)'),
      [
        { text: t('common.cancel', '취소'), style: 'cancel' },
        { text: t('dream.buy5', '5회 구매'), onPress: async () => {
          try {
            const bought = await purchaseCreditRC('dream'); if (!bought) return;  // 결제(취소 시 false)
            // ★C1(daniel 07-03): 클라 grant 폐지 → 영수증 검증된 웹훅이 5회 적립. 반영까지 폴링 후 재시도(Edge 가 1회 차감).
            const { granted } = await waitForCreditGrant('dream');
            if (granted) runAI(text);
            else Alert.alert(t('dream.aiTitle', 'AI 꿈해몽'), t('dream.applyPending', '결제가 완료됐어요. 이용권 적용까지 잠시 걸릴 수 있어요. 잠시 후 다시 시도해 주세요.'));
          } catch (e) { Alert.alert(t('dream.aiTitle', 'AI 꿈해몽'), (e as Error).message); }
        } },
      ],
    );
  }

  async function runAI(text: string) {
    if (!assertOnline(t)) return; // daniel: 오프라인이면 풀이 진입(Edge 생성) 차단
    // ② 크로스마운트 이중 LLM 방지 — AI 꿈해몽(건당 ₩300)이 이미 생성 중이면 2차 호출 안 함(과금 0).
    //    ★dream 은 명식 무관(chartless)이라 ①명식가드·③route chartId 는 미적용 — 콘텐츠 desync 3종 중 ②만 해당.
    if (!acquireGen('dream')) return;
    setAiBusy(true);
    setGenProgress({ active: true, total: 1, done: 0, label: 'AI 꿈해몽', route: '/dream' }); // 일회성 진행도(daniel)
    let ok = false; // ★L2: 실제 해몽 성공 여부 — 완료 배너·푸시는 이때만(친화 폴백·오류에 '완성' 오푸시 방지)
    try {
      const { data, error } = await supabase.functions.invoke('interpret', { body: { kind: 'dream', dreamText: text, lang: appLang() } });
      // ★C3b 서버 게이트: 'dream' 이용권 없음 → needPayment. 결과 표시 대신 5회 번들 구매 제안(구매·웹훅 반영 후 재시도).
      if ((data as any)?.needPayment) { setGenProgress({ route: '/dream', active: false }); setAiBusy(false); promptBuyDream(text); return; }
      // 방어: 일시적 불가/오류면 친화 메시지를 meaning 자리에(원문 'non-2xx' 노출 방지)
      const fail = invokeFail(data, error);
      const dream = (data as any)?.dream as { title: string; meaning: string } | undefined; // Edge 실제 해몽 페이로드(성공 시만 존재)
      setAiResult(fail ? { title: text.slice(0, 12), meaning: fail.message } : (dream ?? { title: text.slice(0, 12), meaning: t('dream.fail', '해몽을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') }));
      // ★계정별 저장 — 실제 해몽일 때만(invokeFail·needPayment·친화 폴백 제외). 저장 실패해도 UX 막지 않음.
      if (!fail && dream) { void saveDream(text, dream); ok = true; } // 실제 해몽 성공 = 완료
    } catch { setAiResult({ title: text.slice(0, 12), meaning: t('dream.fail', '해몽을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') }); }
    finally { releaseGen('dream'); } // ② 완료·중단·오류·구매유도 모두 해제(구매 후 재시도는 새 lock)
    // ★L2: 성공만 완료 배너·푸시 / 실패(친화 폴백·오류)는 배너 제거 → 오완료 '완성' 푸시 방지(needPayment 처리와 통일).
    if (ok) setGenProgress({ route: '/dream', done: 1, total: 1 }); // 완료 → 홈 배너 '풀이 보기'(daniel)
    else setGenProgress({ route: '/dream', active: false });
    setAiBusy(false);
  }

  // 방금 생성한 해몽을 계정에 저장(dream_readings) 후 목록 맨 앞에 prepend — 재진입 시 목록에서 다시 봄.
  //   @param input 유저가 적은 꿈 원문(input_text) / @param dream Edge 해몽 결과(title·meaning)
  //   주의: RLS가 본인 것만 insert/select 허용. 50개 초과분은 DB 트리거가 자동 삭제(클라 관리 X).
  //         저장 실패는 조용히 로그만(로컬 aiResult는 이미 표시됐으므로 UX를 막지 않음).
  async function saveDream(input: string, dream: { title: string; meaning: string }) {
    const uid = session?.user?.id;
    if (!uid) return; // 미로그인 = 저장 스킵(user_id만 필요 · 명식 무관 chartless)
    try {
      const { data, error } = await supabase
        .from('dream_readings')
        .insert({ user_id: uid, input_text: input, title: dream.title, meaning: dream.meaning, lang: appLang() })
        .select('id, input_text, title, meaning, lang, created_at')
        .single(); // 삽입된 행(실제 id·created_at)을 받아 목록에 그대로 prepend
      if (error || !data) { console.warn('[dream] save failed', error?.message); return; }
      setPastDreams((prev) => [data as DreamRow, ...prev].slice(0, 50)); // 맨 앞에 추가(최신순 · 상한 50 방어)
    } catch (e) { console.warn('[dream] save error', (e as Error).message); }
  }

  return (
    <View style={styles.bg}>
      {/* 유료 AI 해몽 공개 순간 골드 명조 문 열림 영상 — 1회 재생 후 페이드아웃(daniel 07-06) */}
      <DoorReveal visible={doorPlaying} onDone={() => setDoorPlaying(false)} />
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
        <ContentHero image={require('../../../assets/icons/dream.jpg')} title={t('dream.title', '꿈해몽')} sub={t('dream.sub', '꿈에 나온 것을 검색해 보세요.')} />

        <TextInput
          style={styles.input}
          value={q}
          onChangeText={setQ}
          placeholder={t('dream.placeholder', '예: 돼지, 뱀, 물…')}
          placeholderTextColor={colors.inkFaint}
          maxLength={20}
        />

        {/* 인기 키워드 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {DREAM_POPULAR.map((k) => {
            const label = popularLabel(k);
            return (
              <PressableScale key={k.ko} style={[styles.chip, q === label && styles.chipOn]} onPress={() => setQ(label)}>
                <Text style={[styles.chipTx, q === label && styles.chipTxOn]}>{label}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>

        {results.length > 0 ? (
          results.map((e, i) => (
            <View key={i} style={styles.card}>
              <Text style={styles.cardTitle}>{dreamTitle(e)}</Text>
              <Text style={[styles.cardBody, { fontSize: fs(15), lineHeight: fs(25) }]}>{dreamMeaning(e)}</Text>
            </View>
          ))
        ) : q.trim() ? (
          // 사전 miss → LLM 폴백(어떤 꿈이든 해몽)
          llm ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{llm.title}</Text>
              <Text style={[styles.cardBody, { fontSize: fs(15), lineHeight: fs(25) }]}>{llm.meaning}</Text>
            </View>
          ) : llmBusy ? (
            <View style={styles.card}><ActivityIndicator color={colors.ju} /><Text style={[styles.empty, { marginTop: space(2) }]}>{t('dream.generating', 'AI가 해몽을 풀어내는 중…')}</Text></View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.empty}>{t('dream.notInDict', '사전에 없는 꿈이에요. AI 해몽을 받아보세요.')}</Text>
              <PressableScale style={styles.aiBtn} onPress={searchLLM}><Text style={styles.aiBtnTx}>{t('dream.aiSee', 'AI 해몽 보기')}</Text></PressableScale>
            </View>
          )
        ) : null}

        {/* AI 해몽 — 자유 텍스트(긴 꿈 이야기), 항상 열림. 건당 ₩300 이용권(프리미엄/관리자 무료) */}
        <View style={styles.aiCard}>
          <Text style={styles.aiHead}>{t('dream.aiTitle', 'AI 꿈해몽')}</Text>
          <Text style={styles.aiSub}>{t('dream.aiSub', '복잡한 꿈은 이야기로 적어 보세요 — 사전에 없어도, 여러 상징이 섞여도 풀어 드려요.')}</Text>
          <TextInput
            style={styles.aiInput}
            value={aiText}
            onChangeText={setAiText}
            placeholder={t('dream.aiPh', '꿈에서 보거나 겪은 일을 자세히…')}
            placeholderTextColor={colors.inkFaint}
            multiline
            maxLength={200}
            editable={!aiBusy}
          />
          <Text style={styles.aiLen}>{aiText.length}/200</Text>
          <PressableScale
            style={[styles.aiGenBtn, (aiText.trim().length < 4 || aiBusy) && styles.aiGenOff]}
            onPress={onAI}
            disabled={aiText.trim().length < 4 || aiBusy}
          >
            {aiBusy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.aiGenTx}>{t('dream.aiBtn', 'AI 해몽 받기 (₩300)')}</Text>}
          </PressableScale>
          {aiResult ? (
            <View style={styles.aiOut}>
              <Text style={styles.cardTitle}>{aiResult.title}</Text>
              <Text style={[styles.cardBody, { fontSize: fs(15), lineHeight: fs(25) }]}>{aiResult.meaning}</Text>
              {/* 풀이 음성 읽기(온디바이스 TTS·무료) — 제목+해몽 본문 읽음 */}
              <TTSButton reading={aiResult} />
            </View>
          ) : null}
        </View>

        {/* 지난 꿈해몽 — 계정별 저장분(최대 50). 완료 배너로 재진입해도 여기서 다시 봄(재진입 버그 해소). 비었으면 섹션 숨김. */}
        {pastDreams.length > 0 ? (
          <View style={styles.histWrap}>
            <Text style={styles.histHead}>{t('dream.history', '지난 꿈해몽')}</Text>
            {pastDreams.map((d) => {
              const open = openId === d.id; // 아코디언: 탭하면 본문 펼침/접힘
              return (
                <View key={d.id} style={styles.card}>
                  <PressableScale style={styles.histRow} onPress={() => setOpenId(open ? null : d.id)}>
                    <View style={styles.histInfo}>
                      <Text style={[styles.cardTitle, { fontSize: fs(15), marginBottom: 2 }]} numberOfLines={open ? undefined : 1}>{d.title}</Text>
                      <Text style={styles.histDate}>{shortDate(d.created_at)}</Text>
                    </View>
                    <Text style={styles.histChevron}>{open ? '▾' : '▸'}</Text>
                  </PressableScale>
                  {open ? (
                    <View style={styles.histBody}>
                      <Text style={[styles.cardBody, { fontSize: fs(15), lineHeight: fs(25) }]}>{d.meaning}</Text>
                      {/* 저장분도 음성 읽기(온디바이스 TTS·무료) */}
                      <TTSButton reading={{ title: d.title, meaning: d.meaning }} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.note}>{t('dream.note', '※ 가볍게 즐기는 전통 해몽이에요.')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' }, // 전역 배경(ContentBackdrop) 투과
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  h: { ...font.title, color: colors.ink, marginBottom: space(1) },
  sub: { ...font.caption, color: colors.inkSoft, marginBottom: space(5) },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, paddingHorizontal: space(4), paddingVertical: space(3.5), fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: space(3) },
  chips: { gap: space(2), paddingVertical: space(1), marginBottom: space(3) },
  chip: { paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  chipTxOn: { color: colors.bg },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(2.5), ...shadow.card },
  cardTitle: { fontSize: 17, fontWeight: '900', color: colors.ju, marginBottom: space(2) },
  cardBody: { ...font.body, color: colors.ink },
  empty: { ...font.body, color: colors.inkSoft, textAlign: 'center' },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4) },
  aiBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingVertical: space(2.5), paddingHorizontal: space(5), alignSelf: 'center', marginTop: space(3) },
  aiBtnTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  // AI 해몽 카드(자유 텍스트, 항상 열림 — 건당 ₩300)
  aiCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, padding: space(5), marginTop: space(4), ...shadow.card },
  aiHead: { fontSize: 16, fontWeight: '900', color: colors.ju, marginBottom: space(1) },
  aiSub: { ...font.caption, color: colors.inkSoft, marginBottom: space(3), lineHeight: 18 },
  aiInput: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: space(3), minHeight: 72, maxHeight: 160, fontSize: 15, color: colors.ink, textAlignVertical: 'top' },
  aiLen: { fontSize: 11, color: colors.inkFaint, alignSelf: 'flex-end', marginTop: space(1) },
  aiGenBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), alignItems: 'center', marginTop: space(2) },
  aiGenOff: { opacity: 0.4 },
  aiGenTx: { color: colors.bg, fontWeight: '800', fontSize: 15 },
  aiOut: { marginTop: space(4), paddingTop: space(4), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  // 지난 꿈해몽 목록 — 기존 card 스타일 재사용 + 행/날짜/펼침 본문
  histWrap: { marginTop: space(5) },
  histHead: { fontSize: 16, fontWeight: '900', color: colors.ink, marginBottom: space(2.5) },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  histInfo: { flex: 1 },
  histDate: { fontSize: 12, color: colors.inkFaint, fontWeight: '600' },
  histChevron: { fontSize: 16, color: colors.ju, fontWeight: '900' },
  histBody: { marginTop: space(3), paddingTop: space(3), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
