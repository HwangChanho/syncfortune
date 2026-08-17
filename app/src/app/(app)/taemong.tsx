// src/app/(app)/taemong.tsx — 태몽 풀이 (단독 · 명식 불필요)
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-12: *"태몽은 사주랑 교차해서 풀지말고 단독으로 따로 하자"*
//
// ■ 왜 명식을 안 받나 (daniel stance)
//   태몽은 **민속 해몽**이지 사주명리가 아니다. 명식을 섞으면 두 체계를 임의로 접붙이는 것이고
//   그건 '명리 발명'이다(CLAUDE.md §3.3). ⇒ **chartless** — 생년월일 없이 바로 볼 수 있다.
//   퍼널로도 이득: 가입·명식등록 전에 진입 가능한 몇 안 되는 콘텐츠다.
//
// ■ 두 단(dream 과 동일 구조 — 화면 관용구를 맞춘다)
//   ① 무료 = 상징 사전(온디바이스·API 0)  ② 유료 = AI 태몽 풀이(이야기 전체를 읽는다)
//
// ■ 안전 가드 (§4 — 반드시)
//   ★성별을 **단정하지 않는다.** 전승 소개까지만(사전 주석 참조). 화면에도 그 경계를 적어 둔다.
//   ★임신·출산·건강을 예측하지 않는다(의료 영역).
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, ActivityIndicator, Keyboard, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { A } from '../../lib/ui/remoteAsset';
import { PressableScale } from '../../components/PressableScale';
import { RelatedContent } from '../../components/RelatedContent';
import { ContentHero } from '../../components/SpecialContentScreen';
import { TTSButton } from '../../components/TTSButton';
import { searchTaemong, TAEMONG_POPULAR, taemongTitle, taemongMeaning, taemongTrait, type TaemongEntry } from '../../lib/content/taemongDict';
import { ensureCoinsFor } from '../../lib/billing/coinGate';
import { supabase } from '../../lib/supabase';
import { appLang } from '../../lib/i18n';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { Alert } from '../../lib/ui/alert';
import { withTimeout, GEN_TIMEOUT_MS } from '../../lib/core/withTimeout';
import { useAuth } from '../../lib/useAuth';
import { requireLoginForPurchase } from '../../lib/billing/requireLogin';
import { setGenProgress } from '../../lib/backend/genProgress';
import { acquireGen, releaseGen, isGenActive } from '../../lib/backend/genLock';
import { invokeFail } from '../../lib/backend/interpretResult';
import { assertOnline } from '../../lib/backend/network';
import { useLogContentVisit } from '../../lib/backend/contentVisit';
import { getNavBarHeight } from '../../components/BottomNav'; // 키보드 리프트 보정(하단 네비바 높이)
import { useReadBody } from '../../components/WebShell'; // ★읽는 화면 본문 캡(히어로는 전폭·글은 좁게)

export default function TaemongScreen() {
  const readBody = useReadBody();   // 넓은 웹에서만 본문 폭을 묶는다
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const { fs } = useFontScale();
  const styles = useMemo(() => makeStyles(fs), [fs]);
  useLogContentVisit('taemong');

  const [q, setQ] = useState('');
  const [story, setStory] = useState('');                 // 자유 서술(유료 AI)
  const [busy, setBusy] = useState(false);
  /** 유료 태몽 풀이 — 50운급 섹션 5개(daniel 2026-08-12 "그에맞게 양질의 컨텐츠"). */
  type TaemongReading = { headline?: string; symbols?: string; story?: string; child?: string; keep?: string; tradition?: string };
  const [ai, setAi] = useState<TaemongReading | null>(null);
  const [kbH, setKbH] = useState(0);

  // 키보드 높이 추적 — 하단 입력창이 키보드에 덮이지 않게 그만큼 여백을 준다.
  //   ★표준 KeyboardAvoidingView 는 이 앱의 **전역 하단 네비바**만큼 어긋난다 → coach·dream 과 같은
  //     리스너 방식으로 직접 올린다(화면마다 방식이 갈리면 그게 곧 버그다).
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s1 = Keyboard.addListener(showEvt, (e) => setKbH(e.endCoordinates?.height ?? 0));
    const s2 = Keyboard.addListener(hideEvt, () => setKbH(0));
    return () => { s1.remove(); s2.remove(); };
  }, []);
  const lift = kbH > 0 ? Math.max(0, kbH - getNavBarHeight()) : 0;

  const hits = useMemo(() => searchTaemong(q), [q]);

  // ★★키워드 LLM 폴백(daniel 2026-08-12 *"꿈 카테고리가 너무 다양한데 다 넣을수 있어?"*)
  // ─────────────────────────────────────────────────────────────────────
  //   지적이 옳았다. 태몽 상징은 사실상 무한한데 사전은 12종뿐이라, 처음 만든 2단 구조에서는
  //   사전에 없는 상징이 곧바로 **유료**로 넘어갔다(꿈해몽엔 있던 무료 폴백이 태몽엔 빠져 있었다).
  //   ⇒ 꿈해몽과 **같은 3단**으로 맞춘다:
  //     ①사전 hit = 온디바이스(API 0)
  //     ②사전 miss + 짧은 키워드 = **LLM 무료 + 전역 캐시**(누가 한 번 물으면 그 답이 저장돼
  //       다음 사람은 API 없이 본다 → 캐시가 쌓이며 **무료 범위가 저절로 넓어진다**)
  //     ③긴 꿈 이야기(여러 상징이 얽힌 것) = 유료
  //   ★이래야 '사전 크기 = 커버리지'라는 한계가 사라진다. CLAUDE.md §1-5(무료=룰/캐시)도 지켜진다.
  const [llm, setLlm] = useState<{ title: string; meaning: string } | null>(null);
  const [llmBusy, setLlmBusy] = useState(false);
  useEffect(() => { setLlm(null); }, [q]);   // 검색어가 바뀌면 이전 답을 지운다(엉뚱한 상징의 답 잔존 방지)
  async function searchLLM() {
    const kw = q.trim();
    if (!kw || llmBusy) return;
    setLlmBusy(true);
    try {
      // keyword 로 보낸다 = Edge 가 **차감 없이** 전역 캐시(taemong_cache)를 태우는 경로
      const __inv = await withTimeout(
        supabase.functions.invoke('interpret', { body: { kind: 'taemong', keyword: kw, lang: appLang() } }),
        GEN_TIMEOUT_MS,
      );
      const { data, error } = __inv ?? { data: null, error: { message: 'client timeout' } as any };
      const fail = invokeFail(data, error);
      setLlm(fail ? { title: kw, meaning: fail.message }
                  : ((data?.dream as any) ?? { title: kw, meaning: t('taemong.fail', '풀이를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') }));
    } catch { setLlm({ title: kw, meaning: t('taemong.fail', '풀이를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') }); }
    setLlmBusy(false);
  }

  /**
   * AI 태몽 풀이 — 꿈 이야기 전체를 읽는다.
   * ★`kind: 'taemong'` 으로 Edge 에 보낸다(dream 과 **다른 프롬프트**를 쓰기 위해).
   *   차감·게이트는 서버가 한다 — 클라는 동의만 받는다([[payment-gate-security]]).
   */
  async function runAI(text: string) {
    if (!assertOnline(t)) return;
    // ② 크로스마운트 이중 LLM 방지 — 이미 만들고 있으면 2차 호출 안 함(과금 0).
    //    chartless 라 ①명식가드·③route chartId 는 해당 없음(dream 과 같다).
    if (!acquireGen('taemong')) {
      setBusy(true);
      for (let i = 0; i < 45 && isGenActive('taemong'); i++) await new Promise((r) => setTimeout(r, 3000));
      setBusy(false);
      return;
    }
    setBusy(true);
    setGenProgress({ active: true, total: 1, done: 0, label: t('taemong.title', '태몽 풀이'), route: '/taemong' });
    try {
      const __inv = await withTimeout(
        supabase.functions.invoke('interpret', { body: { kind: 'taemong', dreamText: text, lang: appLang() } }),
        GEN_TIMEOUT_MS,
      );
      const { data, error } = __inv ?? { data: null, error: { message: 'client timeout' } as any };
      // 서버가 이용권 없다고 하면 결제 게이트로 — 금액·잔액은 게이트가 보여 준다([[pay-alert-must-show-numbers]]).
      if ((data as any)?.needPayment) {
        setGenProgress({ route: '/taemong', active: false });
        setBusy(false);
        const g = await ensureCoinsFor('taemong', { title: t('taemong.title', '태몽 풀이'), t, goCharge: () => router.push('/coins') });
        if (g === 'ok') { releaseGen('taemong'); return runAI(text); }
        return;
      }
      const fail = invokeFail(data, error);
      const d = (data as any)?.dream as TaemongReading | undefined;
      setAi(fail ? { headline: text.slice(0, 14), symbols: fail.message }
                 : (d ?? { headline: text.slice(0, 14), symbols: t('taemong.fail', '풀이를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') }));
    } catch (e) {
      setAi({ headline: text.slice(0, 14), symbols: (e as Error).message });
    } finally {
      releaseGen('taemong');
      setGenProgress({ route: '/taemong', active: false, done: 1, total: 1 });
      setBusy(false);
    }
  }

  /** 제출 — 로그인 확인 후 바로 생성. 게이트는 서버가 판정하고, 부족하면 위 needPayment 경로가 받는다. */
  function submit() {
    const text = story.trim();
    if (text.length < 5) { Alert.alert(t('taemong.title', '태몽 풀이'), t('taemong.tooShort', '꿈 이야기를 조금 더 적어 주세요.')); return; }
    if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
    void runAI(text);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.wrap, { paddingBottom: space(14) + lift }]} keyboardShouldPersistTaps="handled">
      <ContentHero image={A('icons/taemong.jpg')} title={t('taemong.title', '태몽 풀이')} sub={t('taemong.sub', '꿈에 나온 것으로 읽는, 아이를 기다리는 마음')} themeColor={TAEMONG_TONE} />
      {/* ★본문 캡 — 히어로는 지면 전체, 글은 좁게(브런치 방향). 폰은 undefined 라 그대로 지나간다. */}
      <View style={readBody}>

      {/* ★경계를 먼저 밝힌다 — 나중에 작게 적으면 아무도 안 읽는다(§4) */}
      <View style={styles.noteBox}>
        <Text style={styles.noteTx}>{t('taemong.guard', '태몽은 오래 전해 온 이야기예요. 아이의 성별이나 건강을 알려주지는 않아요 — 그건 의료의 영역이에요.')}</Text>
      </View>

      {/* ── ① 무료: 상징 사전 ── */}
      <Text style={styles.h}>{t('taemong.dictTitle', '꿈에 무엇이 나왔나요?')}</Text>
      <TextInput
        style={styles.input}
        value={q}
        onChangeText={setQ}
        placeholder={t('taemong.dictPh', '용 · 호랑이 · 잉어 · 복숭아 …')}
        placeholderTextColor={colors.inkFaint}
      />
      <View style={styles.chips}>
        {TAEMONG_POPULAR.map((p) => (
          <PressableScale key={p} style={styles.chip} onPress={() => setQ(p)}>
            <Text style={styles.chipTx}>{p}</Text>
          </PressableScale>
        ))}
      </View>

      {/* ★사전 miss = 막다른 길이 아니다 — **무료로** 한 번 찾아 준다(위 3단 주석) */}
      {q.trim() !== '' && hits.length === 0 && !llm && (
        <View style={styles.card}>
          <Text style={styles.cardTx}>{t('taemong.noHit', '사전에 없는 상징이에요. 무료로 찾아 드릴까요?')}</Text>
          <PressableScale style={[styles.cta, llmBusy && styles.ctaOff]} onPress={searchLLM} disabled={llmBusy}>
            {llmBusy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.ctaTx}>{t('taemong.lookup', '‘{{kw}}’ 찾아보기 (무료)', { kw: q.trim() })}</Text>}
          </PressableScale>
        </View>
      )}
      {llm && (
        <View style={styles.card}>
          <Text style={styles.cardH}>{llm.title}</Text>
          <Text style={styles.cardTx}>{llm.meaning}</Text>
        </View>
      )}
      {hits.map((e: TaemongEntry, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.cardH}>{taemongTitle(e)}</Text>
          <Text style={styles.cardTx}>{taemongMeaning(e)}</Text>
          <Text style={styles.cardTrait}>{taemongTrait(e)}</Text>
        </View>
      ))}

      {/* ── ② 유료: AI 태몽 풀이 ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('taemong.aiTitle', 'AI 태몽 풀이')}</Text>
      <Text style={styles.aiSub}>{t('taemong.aiSub', '꿈 전체를 이야기로 적어 주세요 — 여러 상징이 섞여 있어도, 사전에 없어도 함께 읽어 드려요.')}</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={story}
        onChangeText={setStory}
        placeholder={t('taemong.aiPh', '누가 꾼 꿈인지, 무엇이 나왔고 어떻게 했는지 …')}
        placeholderTextColor={colors.inkFaint}
        multiline
      />
      <PressableScale style={[styles.cta, busy && styles.ctaOff]} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.ctaTx}>{t('taemong.aiCta', '태몽 풀이 받기')}</Text>}
      </PressableScale>

      {/* ★유료 결과 = 섹션 5개(50운급). 빈 섹션은 그리지 않는다 — 서버가 못 채운 칸이 빈 카드로 남으면
          "돈 냈는데 비었다"가 된다. 있는 것만 그리고, 하나도 없으면 실패 문구가 symbols 에 온다. */}
      {ai && (
        <View style={[styles.card, styles.aiCard]}>
          {!!ai.headline && <Text style={styles.aiHead}>{ai.headline}</Text>}
          {([
            ['symbols',   t('taemong.secSymbols', '꿈에 나온 것들')],
            ['story',     t('taemong.secStory', '이 꿈이 말하는 것')],
            ['child',     t('taemong.secChild', '전해 내려오기로는')],
            ['keep',      t('taemong.secKeep', '이 꿈을 간직하는 법')],
            ['tradition', t('taemong.secTradition', '이런 이야기도 있어요')],
          ] as const).map(([k, label]) => {
            const v = (ai as any)[k] as string | undefined;
            if (!v || !v.trim()) return null;
            return (
              <View key={k} style={styles.sec}>
                <Text style={styles.secH}>{label}</Text>
                <Text style={styles.cardTx}>{v}</Text>
              </View>
            );
          })}
          <TTSButton reading={ai} />
        </View>
      )}

      <RelatedContent kind="taemong" />
    </View>
      </ScrollView>
  );
}

/** 태몽 톤 — 아이를 기다리는 정서에 맞춘 부드러운 살구빛(다른 콘텐츠 톤과 겹치지 않게). */
const TAEMONG_TONE = '#E8A87C';

const makeStyles = (fs: (n: number) => number) => StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(4), paddingBottom: space(14), gap: space(2) },
  // ★fontSize 와 lineHeight 는 **짝**으로 — 고정값이면 글자확대에서 잘린다([[ui-font-scale-lineheight]])
  h: { ...font.heading, color: colors.ink, marginTop: space(5), marginBottom: space(2), fontSize: fs(18), lineHeight: fs(26) },
  noteBox: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(3.5), marginTop: space(3) },
  noteTx: { ...font.caption, color: colors.inkSoft, fontSize: fs(13), lineHeight: fs(20) },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    paddingHorizontal: space(3.5), paddingVertical: space(3), color: colors.ink, fontSize: fs(15), lineHeight: fs(22),
  },
  textarea: { minHeight: fs(110), textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(2.5) },
  chip: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingVertical: space(2), paddingHorizontal: space(3.5) },
  chipTx: { color: colors.inkSoft, fontSize: fs(14), lineHeight: fs(20) },
  empty: { ...font.caption, color: colors.inkFaint, marginTop: space(3), fontSize: fs(13), lineHeight: fs(20) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(4), marginTop: space(3), ...shadow.card },
  aiCard: { borderWidth: 1, borderColor: TAEMONG_TONE },
  aiHead: { ...font.heading, color: TAEMONG_TONE, fontWeight: '800', fontSize: fs(18), lineHeight: fs(26), marginBottom: space(3) },
  sec: { marginTop: space(4) },
  secH: { ...font.caption, color: colors.ink, fontWeight: '800', fontSize: fs(14), lineHeight: fs(21), marginBottom: space(1.5) },
  cardH: { ...font.heading, color: colors.ink, marginBottom: space(2), fontSize: fs(17), lineHeight: fs(25) },
  cardTx: { ...font.body, color: colors.inkSoft, fontSize: fs(15), lineHeight: fs(24) },
  cardTrait: { ...font.body, color: TAEMONG_TONE, marginTop: space(2.5), fontWeight: '700', fontSize: fs(14), lineHeight: fs(22) },
  aiSub: { ...font.caption, color: colors.inkFaint, marginBottom: space(2.5), fontSize: fs(13), lineHeight: fs(20) },
  cta: { backgroundColor: TAEMONG_TONE, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center', marginTop: space(3) },
  ctaOff: { opacity: 0.6 },
  ctaTx: { color: colors.bg, fontWeight: '800', fontSize: fs(16), lineHeight: fs(23) },
});
