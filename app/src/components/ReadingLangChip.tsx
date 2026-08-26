// app/src/components/ReadingLangChip.tsx — 풀이를 **다른 나라 말로 바꿔 보는** 칩
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"풀이 결과들을 각국의 다른 언어로도 볼 수 있으면 좋겠어"*
//
// ■ 왜 설정에만 두지 않았나
//   설정에도 있다(「풀이 언어」). 하지만 **풀이를 읽다가** 바꾸고 싶은 것이 이 기능의 본래 자리다.
//   설정에만 있으면 «있는데 아무도 모르는 기능» 이 된다 —
//   [[category-management-ui]] 의 *"길게 누르기만 있는 기능 = 없는 기능"* 과 같은 실수를 반복하지 않는다.
//
// ■ ★두 번 결제되지 않는다
//   언락은 `(owner_id, chart_id, kind)` 라 **언어를 안 가린다**(2026-08-26 실측).
//   서버도 이미 나온 판단(L2 `analysis`)을 그대로 쓰고 **표현만** 그 언어로 다시 쓴다.
//   그래서 이 칩은 «다시 사시겠어요?» 를 묻지 않는다 — 물으면 그게 거짓말이 된다.
//
// ■ ★한 곳에서만 만든다
//   화면마다 비슷한 픽커를 따로 그리면 문구·동작이 갈린다([[duplicate-ui-single-source]]).
//   쓰는 쪽은 `<ReadingLangChip onChange={reload} />` 한 줄이면 된다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from './PressableScale';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, font } from '../lib/theme';
import {
  READING_LANGS, READING_LANG_LABEL, readingLang, setReadingLang,
  isReadingLangAuto, onReadingLangChange, type ReadingLang,
} from '../lib/i18n';

type Props = {
  /** 언어가 **실제로 바뀌었을 때만** 불린다 — 화면이 그 언어 풀이를 다시 받아 오게. */
  onChange?: (lang: ReadingLang) => void;
  /** 오른쪽 정렬 등 바깥 여백 조정용 */
  style?: object;
};

/**
 * 지금 풀이 언어를 보여 주고, 누르면 목록에서 고르게 한다.
 *
 * @param onChange 언어가 바뀐 뒤 호출(같은 언어를 다시 고르면 부르지 않는다 — 헛된 재조회 방지)
 */
export function ReadingLangChip({ onChange, style }: Props) {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  // ★훅은 조기 return 위에(React #310) — 이 파일엔 조기 return 이 없지만 규칙을 지켜 둔다.
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState<ReadingLang>(() => readingLang());
  const [auto, setAuto] = useState<boolean>(() => isReadingLangAuto());

  // 설정 화면에서 바꿔도 이 칩이 따라오도록 구독한다(두 자리가 어긋나 보이면 그게 곧 버그다).
  useEffect(() => onReadingLangChange(() => { setCur(readingLang()); setAuto(isReadingLangAuto()); }), []);

  const pick = async (l: ReadingLang | null) => {
    const before = readingLang();
    await setReadingLang(l);
    const after = readingLang();
    setOpen(false);
    if (after !== before) onChange?.(after);   // ★같은 언어면 다시 안 받는다
  };

  return (
    <>
      <PressableScale
        style={[styles.chip, style]}
        onPress={() => setOpen(true)}
        accessibilityLabel={t('reading.langChipA11y', '풀이 언어 바꾸기')}
      >
        {/* 이모지는 글리프와 달리 fontSize 만큼 실제로 커진다([[glyph-icons-dont-scale]]) */}
        <Text style={[styles.chipTx, { fontSize: fs(12) }]}>🌐 {READING_LANG_LABEL[cur]}</Text>
      </PressableScale>

      <Modal statusBarTranslucent visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dim} onPress={() => setOpen(false)}>
          {/* 안쪽을 눌러도 닫히지 않게 — 바깥 Pressable 로 전파를 막는다 */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={[styles.title, { fontSize: fs(17) }]}>{t('settings.readingLanguage', '풀이 언어')}</Text>
            <Text style={[styles.hint, { fontSize: fs(12), lineHeight: Math.round(fs(12) * 1.6) }]}>
              {t('reading.langSheetHint', '화면 글자는 그대로 두고 풀이 본문만 바꿔요. 이미 본 풀이는 남아 있고, 다시 결제하지 않아요.')}
            </Text>
            <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: space(4) }}>
              {/* 기본값 — 앱 언어를 따라간다 */}
              <PressableScale style={[styles.row, auto && styles.rowOn]} onPress={() => pick(null)}>
                <Text style={[styles.rowTx, { fontSize: fs(15) }, auto && styles.rowTxOn]}>
                  {t('settings.readingLangAuto', '앱 언어와 같게')}
                </Text>
                {auto ? <Text style={[styles.check, { fontSize: fs(15) }]}>✓</Text> : null}
              </PressableScale>
              {READING_LANGS.map((k) => {
                const on = !auto && cur === k;
                return (
                  <PressableScale key={k} style={[styles.row, on && styles.rowOn]} onPress={() => pick(k)}>
                    <Text style={[styles.rowTx, { fontSize: fs(15) }, on && styles.rowTxOn]}>{READING_LANG_LABEL[k]}</Text>
                    {on ? <Text style={[styles.check, { fontSize: fs(15) }]}>✓</Text> : null}
                  </PressableScale>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start', paddingHorizontal: space(3), paddingVertical: space(1.5),
    borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card,
  },
  chipTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: space(6), paddingTop: space(6), paddingBottom: space(10), maxHeight: '72%',
  },
  title: { ...font.title, color: colors.ink, fontWeight: '900', marginBottom: space(2) },
  hint: { ...font.caption, color: colors.inkSoft, marginBottom: space(4) },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: space(3.5), paddingHorizontal: space(4),
    borderRadius: radius.md, marginBottom: space(1.5), backgroundColor: colors.sunk,
  },
  rowOn: { borderWidth: 1, borderColor: colors.juLine },
  rowTx: { ...font.body, color: colors.ink },
  rowTxOn: { color: colors.ju, fontWeight: '800' },
  check: { ...font.body, color: colors.ju, fontWeight: '800' },
});
