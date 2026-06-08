// src/app/(app)/taro.tsx — 타로 (무료, 광고 진입, 한지·먹 테마). 메이저 22 1장 뽑기(온디바이스).
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { drawCard, type TarotCard } from '../../lib/tarot';
import { colors, radius, space, shadow, font } from '../../lib/theme';

export default function TaroScreen() {
  const { t } = useTranslation();
  const [card, setCard] = useState<(TarotCard & { reversed: boolean }) | null>(null);

  return (
    <View style={styles.c}>
      <Text style={styles.icon}>🃏</Text>
      <Text style={styles.title}>{t('menu.taro')}</Text>

      {card ? (
        <View style={styles.cardBox}>
          <Text style={[styles.cardName, card.reversed && styles.reversed]}>
            {card.name}{card.reversed ? ` (${t('taro.reversed')})` : ''}
          </Text>
          <Text style={styles.kw}>{card.keywords}</Text>
        </View>
      ) : (
        <Text style={styles.hint}>🔮</Text>
      )}

      <Pressable style={styles.btn} onPress={() => setCard(drawCard())}>
        <Text style={styles.btnText}>{card ? t('taro.reshuffle') : t('taro.draw')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space(3), padding: space(6), backgroundColor: colors.bg },
  icon: { fontSize: 48 },
  title: { ...font.title },
  hint: { fontSize: 40, marginVertical: space(5), opacity: 0.3 },
  cardBox: {
    alignItems: 'center', marginVertical: space(4), padding: space(5), borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, minWidth: 220, ...shadow.card,
  },
  cardName: { fontSize: 22, fontWeight: '700', color: colors.ju },
  reversed: { color: colors.inkFaint },
  kw: { ...font.body, marginTop: space(2.5), textAlign: 'center' },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), paddingHorizontal: space(8), marginTop: space(2), ...shadow.card },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
