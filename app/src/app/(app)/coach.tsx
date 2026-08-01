// app/src/app/(app)/coach.tsx — 팔자 도우미(콘텐츠 안내 챗봇 · API 0원)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-30: "ai 코치를 컨텐츠 유도 용도로만 쓰자 ai 챗봇 느낌으로. 풀이말고,
//   직접 클릭해서 타고가기 귀찮은 사람들이 **api 진짜 비용 최소한으로** 쓸 수 있게.
//   사주·타로·자미두수 기준으로 먼저 잡고 그다음 하위 카테고리 콘텐츠들 안내·설명·이동.
//   이름도 '팔자 도우미'."
//
// ★무엇이 바뀌었나(종전 = AI 자기이해 코치):
//   종전: 질문마다 **Sonnet + 원국 전체 + 보유 풀이**를 실어 보내 답을 생성(앱에서 가장 비싼 경로).
//         게이트도 있었다(월 10회/일 1회 무료 → 초과 시 코인 차감).
//   지금: 답을 **생성하지 않는다.** 사용자가 원하는 콘텐츠까지 데려다주는 안내만 한다.
//         → LLM 호출 0 · 서버 왕복 0 · 코인 차감 0 · 광고 0. 오프라인에서도 동작한다.
//         → 게이트가 사라져 **무료**다. 도우미는 콘텐츠로 들어가는 관문(퍼널)이므로
//           여기서 돈을 받으면 정작 팔아야 할 콘텐츠 앞에 문을 하나 더 세우는 셈이다.
//
// ★안내 트리·문구는 `lib/content/assistant.ts` 단일 출처. 콘텐츠 이미지·설명·라우트는
//   `contentSections`(SECTIONS)에서 온다 — 여기서 하드코딩하면 콘텐츠 추가 때 또 갈라진다.
// ★`npm run check:assistant` 가 ①죽은 링크 ②라우트 부재 ③이미지 부재 ④**이 화면의 LLM 호출 0**을 매번 검사한다.
//
// ⚠️명식이 없어도 쓸 수 있다(종전은 명식 필수였다) — 안내는 차트를 읽지 않는다.
//   콘텐츠 화면에 들어가면 거기서 명식을 요구한다(각 화면이 이미 그 게이트를 갖고 있다).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Keyboard, Platform } from 'react-native';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // 고정 여백은 글자확대 시 잘린다(daniel 07-27)
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { PressableScale } from '../../components/PressableScale';
import { DeepDiveCta } from '../../components/DeepDiveCta';      // 안내 카드(이미지 · SECTIONS 단일 출처)
import { CoachTarotCard } from '../../components/CoachTarotCard'; // '가볍게 뽑은 카드' — 타로 안내에만(온디바이스·비용 0)
import { ChartPicker } from '../../components/ChartPicker';
import { TigerMascot } from '../../components/TigerMascot';      // 도우미 아바타
import { getNavBarHeight } from '../../components/BottomNav';
import { logEvent } from '../../lib/backend/logger';
import { useFontScale } from '../../lib/ui/fontScale';
import {
  ASSIST_DOMAINS, ASSIST_EXAMPLES, matchAssist, topicsOf,
  type AssistDomain, type AssistTopic,
} from '../../lib/content/assistant';
import { SECTIONS } from '../../lib/content/contentSections';
import { colors, radius, space, shadow, font } from '../../lib/theme';

/** 콘텐츠 키 → 라우트·라벨(SECTIONS 단일 출처). DeepDiveCta 와 같은 조회 규칙(key + creditKey). */
const META: Record<string, { route: string; labelKey: string }> = (() => {
  const m: Record<string, { route: string; labelKey: string }> = {};
  for (const s of SECTIONS) {
    for (const it of s.items) {
      const e = { route: it.route, labelKey: it.labelKey };
      if (!m[it.key]) m[it.key] = e;
      if (it.creditKey && !m[it.creditKey]) m[it.creditKey] = e;
    }
  }
  return m;
})();

/**
 * 대화 한 턴.
 * ★서버에 저장하지 않는다 — 안내는 일회성이고, 저장하면 DB 쓰기·RLS·삭제 UI 까지 딸려 온다.
 *   (종전 코치는 reading_followups 에 누적했다. 안내에는 그럴 이유가 없다.)
 */
type Turn =
  | { role: 'me'; text: string }
  | { role: 'bot'; text: string; domains?: boolean; topics?: AssistTopic[]; items?: string[]; tarot?: string };

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { fs, ls } = useFontScale();
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [kbH, setKbH] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // 키보드 높이 추적 — 입력바를 키보드 바로 위에 붙인다(전역 네비바 높이 보정).
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKbH(e.endCoordinates?.height ?? 0));
    const h = Keyboard.addListener(hideEvt, () => setKbH(0));
    return () => { s.remove(); h.remove(); };
  }, []);

  const scrollDown = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  const push = (...add: Turn[]) => { setTurns((ts) => [...ts, ...add]); scrollDown(); };

  /** 도메인 선택 → 그 축의 주제들을 내민다. */
  function chooseDomain(d: AssistDomain) {
    const meta = ASSIST_DOMAINS.find((x) => x.key === d)!;
    const tops = topicsOf(d);
    logEvent('assist_domain', { domain: d });   // 어느 축을 많이 찾는지(퍼널 분석) — 개인정보 없음
    push(
      { role: 'me', text: meta.label },
      { role: 'bot', text: `${meta.line}\n어떤 걸 볼까요?`, topics: tops },
    );
  }

  /** 주제 선택 → 그 주제의 콘텐츠 카드(이미지)를 내민다. */
  function chooseTopic(topic: AssistTopic) {
    logEvent('assist_topic', { topic: topic.key });
    push(
      { role: 'me', text: topic.label },
      // 타로 주제에는 '가볍게 뽑은 카드'를 곁들인다 — 온디바이스 결정론이라 비용 0이고,
      // 안내만 하는 화면에 유일하게 '지금 바로 뭔가 나오는' 재미를 준다(daniel IMG_8198 카드 유지).
      { role: 'bot', text: topic.line, items: topic.items, tarot: topic.domain === 'tarot' ? topic.key : undefined },
    );
  }

  /**
   * 자유 입력 처리 — **온디바이스 매칭만**(LLM 없음).
   * 못 알아들으면 지어내지 않고 선택지를 다시 내민다(엉뚱한 콘텐츠로 보내는 것보다 낫다).
   */
  function send(raw: string) {
    const q = raw.trim();
    if (!q) return;
    setInput('');
    Keyboard.dismiss();
    const m = matchAssist(q);
    logEvent('assist_ask', { hit: m.kind });   // 질문 원문은 남기지 않는다(PII) — 적중 여부만
    if (m.kind === 'topic') {
      push({ role: 'me', text: q }, { role: 'bot', text: m.topic.line, items: m.topic.items });
    } else if (m.kind === 'domain') {
      const meta = ASSIST_DOMAINS.find((x) => x.key === m.domain)!;
      push({ role: 'me', text: q }, { role: 'bot', text: `${meta.line}\n어떤 걸 볼까요?`, topics: topicsOf(m.domain) });
    } else {
      push(
        { role: 'me', text: q },
        { role: 'bot', text: t('assist.miss', '제가 아직 그 말은 못 알아들었어요. 아래에서 골라 주시면 바로 안내해 드릴게요.'), domains: true },
      );
    }
  }

  const lift = kbH > 0 ? Math.max(0, kbH - getNavBarHeight()) : 0;
  return (
    <View style={styles.bg}>
      <ScrollView
        ref={scrollRef}
        style={styles.overlay}
        contentContainerStyle={[styles.wrap, { paddingBottom: 84 + lift, paddingTop: insets.top + space(2) }]}
        keyboardShouldPersistTaps="handled"
      >
        <ChartPicker />
        <TigerMascot size={76} style={{ alignSelf: 'center', marginTop: space(8), marginBottom: space(2) }} />
        <Text style={[styles.title, { fontSize: fs(23) }]}>{t('assist.title', '우니')}</Text>
        <Text style={[styles.sub, { fontSize: fs(13) }]}>
          {t('assist.sub', '보고 싶은 걸 말해 주세요. 바로 그 자리로 데려다 드려요.')}
        </Text>

        {/* 첫 인사 — 도메인 3축(daniel 지정)부터. 대화가 시작되면 사라진다. */}
        {turns.length === 0 && (
          <View style={styles.botCard}>
            <Text style={styles.botLabel}>{t('assist.label', '도우미')}</Text>
            <Text style={[styles.botTx, { fontSize: fs(15), lineHeight: Math.round(15 * 1.6) }]}>
              {t('assist.hello', '무엇을 보고 싶으세요? 세 가지 중에 고르셔도 되고, 그냥 편하게 말해 주셔도 돼요.')}
            </Text>
            <DomainChips onPick={chooseDomain} fs={fs} />
            <Text style={[styles.egLabel, { fontSize: fs(11.5) }]}>{t('assist.egLabel', '이렇게 말해도 알아들어요')}</Text>
            <View style={styles.egRow}>
              {ASSIST_EXAMPLES.map((e) => (
                <PressableScale key={e} style={styles.eg} onPress={() => send(e)}>
                  <Text style={[styles.egTx, { fontSize: fs(12.5) }]}>{e}</Text>
                </PressableScale>
              ))}
            </View>
          </View>
        )}

        {/* 대화 */}
        {turns.map((turn, i) => turn.role === 'me' ? (
          <View key={i} style={styles.qBubble}>
            <Text style={[styles.qTx, { fontSize: fs(14) }]}>{turn.text}</Text>
          </View>
        ) : (
          <View key={i} style={styles.botCard}>
            <Text style={styles.botLabel}>{t('assist.label', '도우미')}</Text>
            <Text style={[styles.botTx, { fontSize: fs(15), lineHeight: Math.round(15 * 1.6) }]}>{turn.text}</Text>

            {turn.domains && <DomainChips onPick={chooseDomain} fs={fs} />}

            {turn.topics?.length ? (
              <View style={styles.topicRow}>
                {turn.topics.map((tp) => (
                  <PressableScale key={tp.key} style={styles.topic} onPress={() => chooseTopic(tp)}>
                    <Text style={[styles.topicTx, { fontSize: fs(13.5) }]}>{tp.label}</Text>
                  </PressableScale>
                ))}
              </View>
            ) : null}

            {/* 타로 안내에만 곁들이는 카드 — 시드는 그날 고정(리렌더마다 카드가 바뀌지 않게) */}
            {turn.tarot ? <CoachTarotCard seed={turn.tarot} /> : null}

            {/* 콘텐츠 안내 = 이미지 카드(daniel IMG_8311). 라우트·이미지·설명은 SECTIONS 단일 출처. */}
            {turn.items?.map((k) => {
              const meta = META[k];
              if (!meta) return null;                        // 죽은 키는 그리지 않는다(check:assistant 가 사전 차단)
              return (
                <DeepDiveCta
                  key={k}
                  compact
                  kind={k}
                  label={t(meta.labelKey) as string}
                  onPress={() => { logEvent('assist_go', { key: k }); router.push(meta.route as any); }}
                />
              );
            })}
          </View>
        ))}

        <Text style={[styles.note, { fontSize: fs(11.5) }]}>
          {t('assist.note', '※ 도우미는 콘텐츠를 찾아 주는 안내예요. 풀이 내용은 각 콘텐츠에서 볼 수 있어요.')}
        </Text>
      </ScrollView>

      {/* 입력바 — 절대위치, 키보드 위에 정확히(전역 네비바 높이 보정) */}
      <View style={[styles.inputBar, { bottom: lift }]}>
        <TextInput
          style={[styles.input, { fontSize: fs(15), minHeight: ls(40) }]}
          value={input}
          onChangeText={setInput}
          placeholder={t('assist.placeholder', '무엇을 보고 싶으세요?')}
          placeholderTextColor={colors.inkFaint}
          maxLength={120}
          multiline
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
        />
        <PressableScale style={[styles.sendBtn, !input.trim() && styles.sendBtnOff]} onPress={() => send(input)} disabled={!input.trim()}>
          <Text style={styles.sendTx}>{t('assist.send', '보내기')}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

/** 도메인 3칩 — 첫 인사와 '못 알아들었을 때' 두 곳에서 같은 모양으로 쓴다(한 곳에 정의). */
function DomainChips({ onPick, fs }: { onPick: (d: AssistDomain) => void; fs: (n: number) => number }) {
  return (
    <View style={styles.domRow}>
      {ASSIST_DOMAINS.map((d) => (
        <PressableScale key={d.key} style={styles.dom} onPress={() => onPick(d.key)}>
          <Text style={[styles.domTx, { fontSize: fs(14.5) }]}>{d.label}</Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },  // 전역 ContentBackdrop 비침
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { paddingHorizontal: space(6), paddingBottom: space(24) },
  title: { fontWeight: '900', color: colors.ink, textAlign: 'center', marginTop: space(2) },
  sub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(1), marginBottom: space(5) },
  // 도우미 말풍선(카드)
  botCard: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: colors.juLine, padding: space(4.5), marginBottom: space(4), ...shadow.card,
  },
  botLabel: { fontSize: 11, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  botTx: { ...font.body, color: colors.ink },
  // 내 말풍선
  qBubble: {
    alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: colors.ju,
    borderRadius: radius.lg, borderBottomRightRadius: 4,
    paddingHorizontal: space(4), paddingVertical: space(2.75), marginBottom: space(2.5),
  },
  qTx: { color: colors.bg, fontWeight: '700' },
  // 도메인 칩(사주·타로·자미두수) — 최상위 축이라 크게
  domRow: { flexDirection: 'row', gap: space(2), marginTop: space(3.5) },
  dom: {
    flex: 1, alignItems: 'center', paddingVertical: space(3.25),
    backgroundColor: colors.ju, borderRadius: radius.md,
  },
  domTx: { color: colors.bg, fontWeight: '800' },
  // 주제 칩 — 여러 개라 감기게(wrap)
  topicRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3.5) },
  topic: {
    paddingVertical: space(2.25), paddingHorizontal: space(3.5),
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.juSoft,
  },
  topicTx: { color: colors.ju, fontWeight: '800' },
  // 예시 질문
  egLabel: { ...font.caption, color: colors.inkFaint, marginTop: space(4), marginBottom: space(2), fontWeight: '700' },
  egRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  eg: { backgroundColor: colors.sunk, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, paddingVertical: space(2), paddingHorizontal: space(3.25) },
  egTx: { color: colors.inkSoft, fontWeight: '700' },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4) },
  // 입력바
  inputBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'flex-end', gap: space(2.5),
    paddingHorizontal: space(5), paddingVertical: space(3),
    backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.juLine,
  },
  input: {
    flex: 1, maxHeight: 100, backgroundColor: colors.sunk, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, paddingHorizontal: space(3.5), paddingVertical: space(2.5), color: colors.ink,
  },
  sendBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingHorizontal: space(4), paddingVertical: space(3) },
  sendBtnOff: { opacity: 0.4 },
  sendTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
});
