// app/src/components/LangChip.tsx — **언어를 한 번에** 고르는 칩(홈 헤더)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27: *"서비스 홈에서 언어설정 가능하게 하자 자동으로 변경가능하게 하고
//                    모든 텍스트가 다 번역되게"*
//
// ■ ★왜 «하나» 인가 — 우리 사정을 사용자에게 떠넘기지 않는다
//   우리 안에서 언어는 둘로 갈려 있다:
//     화면 문구 = 낱말 1,827개를 **사람이 번역**해야 는다(지금 ko·en·ja)
//     풀이 본문 = **LLM 이 그 자리에서 쓴다**(지금 9개 언어)
//   갈라 둔 데는 이유가 있지만 **그건 우리 사정**이다. 「English」를 고른 사람은 다 영어이길 바란다.
//   ⇒ 이 칩은 `setLang()` 하나를 부른다 — 화면과 풀이가 **같이** 바뀐다.
//
// ■ ⚠️★못 하는 것을 «조용히» 하지 않는다
//   태국어·베트남어·중국어를 고르면 **화면 문구는 아직 영어**로 떨어진다.
//   그걸 숨기면 «번역이 안 됐다» 가 아니라 «앱이 고장났다» 로 읽힌다.
//   ⇒ 목록에서 그 언어들 옆에 「화면은 English」 라고 **적는다**.
//     ([[shipped-before-validated]] 의 반대편 — 아직 못 하는 것을 못 한다고 적는 것.)
//
// ■ ★「자동」 은 값이 아니라 **«값 없음»** 이다
//   종전엔 한 번 고르면 되돌릴 길이 없었다(기기 언어를 바꿔도 앱만 옛 선택에 붙들린다).
//   ⇒ 「자동」 = 저장을 지운다. 풀이 언어의 `null` 과 **같은 규칙**이다(규칙이 둘이면 갈린다).
//
// ■ ⚠️★목록은 **칩 옆이 아니라 앱 루트**에서 그린다
//   칩이 들어갈 자리는 홈 헤더인데, 그 헤더는 `FlatList` 의 `ListHeaderComponent` 안이다.
//   거기서 `absoluteFill` 로 덮으면 **헤더 높이만큼만** 덮인다([[overlay-absolutefill-parent]]).
//   ⇒ 이 저장소가 이미 쓰는 방식을 따른다 — 모듈 상태 + `useSyncExternalStore` +
//     `_layout` 에 **호스트 하나**(`ChartConfirmHost`·`AppAlert` 와 같은 꼴).
//     칩은 여러 곳에 둬도 되고, 목록은 **언제나 한 벌**이다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState, useSyncExternalStore } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from './PressableScale';
import { Icon } from './kit/Icon';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, font } from '../lib/theme';
import {
  READING_LANGS, READING_LANG_LABEL, APP_LANGS,
  setLang, currentLang, deviceAppLang, onReadingLangChange, onAppLangChange,
  type ReadingLang,
} from '../lib/i18n';

/** 화면 문구가 있는 언어인가 — 없으면 목록에 「화면은 English」 를 붙인다. */
const hasUi = (l: ReadingLang) => (APP_LANGS as readonly string[]).includes(l);

/**
 * 언어 칩.
 *
 * @param compact 글자 없이 지구본만(좁은 헤더용)
 * @param style   바깥 여백 조정용
 */
export function LangChip({ compact = false, style }: { compact?: boolean; style?: object }) {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  // ★훅은 전부 조기 return 위에(React #310 — 08-26 웹이 통째로 죽었던 그것)
  const [cur, setCur] = useState<ReadingLang | null>(() => currentLang());

  // 설정 화면에서 바꿔도 이 칩이 따라오도록 **양쪽 다** 구독한다.
  //   한쪽만 구독하면 «설정에서 바꿨는데 홈 칩은 그대로» 가 되고, 그 어긋남이 곧 버그로 보인다.
  useEffect(() => {
    const sync = () => setCur(currentLang());
    const offR = onReadingLangChange(sync);
    const offA = onAppLangChange(sync);
    return () => { offR(); offA(); };
  }, []);

  return (
    <PressableScale
      style={[styles.chip, style]}
      hitSlop={8}
      onPress={openLangPicker}
      accessibilityLabel={t('lang.pick', '언어 고르기')}
    >
      <Icon name="globe" size={fs(15)} color={colors.inkSoft} />
      {!compact && (
        <Text style={[styles.chipTx, { fontSize: fs(12) }]} numberOfLines={1}>
          {cur == null ? t('lang.auto', '자동') : READING_LANG_LABEL[cur]}
        </Text>
      )}
    </PressableScale>
  );
}

// ── 목록(호스트) ────────────────────────────────────────────────────────────
let _open = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => { try { f(); } catch { /* 하나가 죽어도 나머지는 알린다 */ } });
const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
const getOpen = () => _open;

/** 언어 목록을 연다 — 칩이 아닌 곳(설정·안내 문구 등)에서도 부를 수 있다. */
export function openLangPicker(): void { _open = true; emit(); }
function closeLangPicker(): void { _open = false; emit(); }

/**
 * 앱 루트(`_layout`)에 **한 번만** 렌더한다.
 * ⚠️여기 없으면 칩을 눌러도 아무 일도 안 일어난다(오류도 안 난다) — `check:langpicker` L3 가 지킨다.
 */
export function LangPickerHost() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const open = useSyncExternalStore(subscribe, getOpen, getOpen);
  const [cur, setCur] = useState<ReadingLang | null>(() => currentLang());
  useEffect(() => {
    const sync = () => setCur(currentLang());
    const offR = onReadingLangChange(sync);
    const offA = onAppLangChange(sync);
    return () => { offR(); offA(); };
  }, []);

  const pick = async (l: ReadingLang | null) => {
    closeLangPicker();
    await setLang(l);
    // ★`setLang` 이 구독자에게 알리므로 여기서 `setCur` 을 또 하지 않는다(두 곳이 갈릴 여지를 없앤다).
  };

  // ★`statusBarTranslucent` — 안드로이드에서 이게 없으면 **상태바 아래가 안 덮여** 시트가 떠 보인다(`check:platform` P1).
  return (
    <Modal visible={open} transparent statusBarTranslucent animationType="fade" onRequestClose={closeLangPicker}>
      <Pressable style={styles.dim} onPress={closeLangPicker}>
        {/* 안쪽을 눌러도 안 닫히게 — 목록을 고르다 실수로 닫히면 처음부터 다시다 */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={[styles.title, { fontSize: fs(19) }]}>{t('lang.title', '언어')}</Text>
          <Text style={[styles.hint, { fontSize: fs(11.5) }]}>
            {t('lang.hint', '화면 글자와 풀이 본문을 함께 바꿔요.')}
          </Text>
          <ScrollView style={styles.list}>
            {/* 「자동」 — 기기 언어를 따라간다. **무엇을 따라가는지 값을 함께** 보여 준다
                (그냥 「자동」 이라고만 하면 지금 무엇인지 알 길이 없다) */}
            <Row
              on={cur == null}
              label={t('lang.auto', '자동')}
              note={t('lang.autoNote', '기기 언어 · 지금은 {{l}}', { l: READING_LANG_LABEL[deviceAppLang()] })}
              onPress={() => pick(null)}
              fs={fs}
            />
            {READING_LANGS.map((k) => (
              <Row
                key={k}
                on={cur === k}
                label={READING_LANG_LABEL[k]}
                // ⚠️화면 문구가 없는 언어는 **그렇다고 적는다**(조용히 영어로 두지 않는다)
                note={hasUi(k) ? undefined : t('lang.uiEnglish', '화면 글자는 English')}
                onPress={() => pick(k)}
                fs={fs}
              />
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** 목록 한 줄 — 고른 표시 + 부가 설명. */
function Row({ on, label, note, onPress, fs }: {
  on: boolean; label: string; note?: string; onPress: () => void; fs: (n: number) => number;
}) {
  return (
    <PressableScale style={[styles.row, on && styles.rowOn]} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTx, { fontSize: fs(15) }, on && styles.rowTxOn]}>{label}</Text>
        {note ? <Text style={[styles.rowNote, { fontSize: fs(11) }]}>{note}</Text> : null}
      </View>
      {on ? <Icon name="check" size={fs(16)} color={colors.ju} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: space(1),
    paddingHorizontal: space(2), paddingVertical: space(1),
    borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
  },
  chipTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  list: { flexGrow: 0, maxHeight: '70%' },
  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: space(5), paddingTop: space(4), paddingBottom: space(8),
  },
  title: { ...font.title, color: colors.ink, fontWeight: '900' },
  hint: { ...font.caption, color: colors.inkSoft, marginTop: space(1), marginBottom: space(3) },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space(2),
    paddingVertical: space(3), paddingHorizontal: space(3),
    borderRadius: radius.md,
  },
  rowOn: { backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.juLine },
  rowTx: { ...font.body, color: colors.ink },
  rowTxOn: { color: colors.ju, fontWeight: '800' },
  rowNote: { ...font.caption, color: colors.inkSoft, marginTop: space(0.5) },
});
