// src/app/(app)/dream.tsx — 꿈해몽 (가볍게·무료·온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// 키워드 검색 → 해몽(lib/dreamDict). 인기 키워드 칩. 규칙5: 무료=온디바이스(API 0). §4: 전향적.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, ImageBackground, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { searchDreams, DREAM_POPULAR, dreamTitle, dreamMeaning, popularLabel } from '../../lib/dreamDict';
import { supabase } from '../../lib/supabase';        // 사전 miss → LLM 폴백(전역 캐시)
import { appLang } from '../../lib/i18n';
import { bgSource, colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/fontScale';
import { ContentHero } from '../../components/SpecialContentScreen'; // 이미지 히어로(보는 맛)
import { Alert } from '../../lib/alert';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/useAuth';
import { useSubscription } from '../../lib/subscription';
import { isAdmin } from '../../lib/admin';
import { useCredit, grantCredit } from '../../lib/coupons';          // AI 해몽 이용권 차감·적립
import { purchaseCreditRC, DREAM_BUNDLE_QTY, purchasesEnabled } from '../../lib/purchases'; // 꿈해몽 5회 번들 결제
import { requireLoginForPurchase } from '../../lib/requireLogin';
import { setGenProgress } from '../../lib/genProgress'; // 일회성 진행도(daniel·docs/CONTENT_API_INVENTORY.md)
import { invokeFail } from '../../lib/interpretResult'; // 방어: 일시적 불가/오류 친화 처리(dream은 reading 아닌 dream 구조라 invokeFail만)

export default function DreamScreen() {
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

  // AI 해몽(자유 텍스트) — 게이트(프리미엄/관리자 무료 / 그 외 ₩300 이용권) 후 Edge 자유텍스트 해몽.
  async function onAI() {
    const text = aiText.trim();
    if (text.length < 4 || aiBusy) return;
    if (!isPremium) {
      const admin = await isAdmin().catch(() => false);
      if (!admin) {
        if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
        const ok = await useCredit('dream');                          // 이용권 차감(서버 use_credit — 본인 인증)
        if (!ok) { promptBuyDream(text); return; }                    // 이용권 없음 → 5회 번들 구매 제안
      }
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
            await grantCredit('dream', DREAM_BUNDLE_QTY);                         // 5회 적립
            if (await useCredit('dream')) runAI(text);                            // 1회 차감 후 진행
          } catch (e) { Alert.alert(t('dream.aiTitle', 'AI 꿈해몽'), (e as Error).message); }
        } },
      ],
    );
  }

  async function runAI(text: string) {
    setAiBusy(true);
    setGenProgress({ active: true, total: 1, done: 0, label: 'AI 꿈해몽', route: '/dream' }); // 일회성 진행도(daniel)
    try {
      const { data, error } = await supabase.functions.invoke('interpret', { body: { kind: 'dream', dreamText: text, lang: appLang() } });
      // 방어: 일시적 불가/오류면 친화 메시지를 meaning 자리에(원문 'non-2xx' 노출 방지)
      const fail = invokeFail(data, error);
      setAiResult(fail ? { title: text.slice(0, 12), meaning: fail.message } : ((data?.dream as any) ?? { title: text.slice(0, 12), meaning: t('dream.fail', '해몽을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') }));
    } catch { setAiResult({ title: text.slice(0, 12), meaning: t('dream.fail', '해몽을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') }); }
    setGenProgress({ route: '/dream', done: 1, total: 1 }); // 완료 → 홈 배너 '풀이 보기'(daniel)
    setAiBusy(false);
  }

  return (
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
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
              <Pressable key={k.ko} style={[styles.chip, q === label && styles.chipOn]} onPress={() => setQ(label)}>
                <Text style={[styles.chipTx, q === label && styles.chipTxOn]}>{label}</Text>
              </Pressable>
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
              <Pressable style={styles.aiBtn} onPress={searchLLM}><Text style={styles.aiBtnTx}>{t('dream.aiSee', 'AI 해몽 보기')}</Text></Pressable>
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
            maxLength={300}
            editable={!aiBusy}
          />
          <Text style={styles.aiLen}>{aiText.length}/300</Text>
          <Pressable
            style={[styles.aiGenBtn, (aiText.trim().length < 4 || aiBusy) && styles.aiGenOff]}
            onPress={onAI}
            disabled={aiText.trim().length < 4 || aiBusy}
          >
            {aiBusy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.aiGenTx}>{t('dream.aiBtn', 'AI 해몽 받기 (₩300)')}</Text>}
          </Pressable>
          {aiResult ? (
            <View style={styles.aiOut}>
              <Text style={styles.cardTitle}>{aiResult.title}</Text>
              <Text style={[styles.cardBody, { fontSize: fs(15), lineHeight: fs(25) }]}>{aiResult.meaning}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.note}>{t('dream.note', '※ 가볍게 즐기는 전통 해몽이에요.')}</Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
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
});
