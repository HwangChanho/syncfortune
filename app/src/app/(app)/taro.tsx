// src/app/(app)/taro.tsx — 타로 (무료, 광고 진입, 한지·먹 테마). 메이저 22 1장 뽑기(온디바이스).
import { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ImageBackground, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { drawCard, type TarotCard } from '../../lib/tarot';
import { colors, radius, space, shadow, font } from '../../lib/theme';

export default function TaroScreen() {
  const { t } = useTranslation();
  const [card, setCard] = useState<(TarotCard & { reversed: boolean }) | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;

  function handleDraw() {
    if (isFlipped) {
      // 리셔플: 다시 뒷면으로
      Animated.timing(flipAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setCard(null);
        setIsFlipped(false);
      });
    } else {
      const newCard = drawCard();
      setCard(newCard);
      setIsFlipped(true);
      Animated.spring(flipAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start();
    }
  }

  const flipStyle = {
    transform: [
      { perspective: 1000 },
      {
        rotateY: flipAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '180deg'],
        }),
      },
    ],
  };

  const frontStyle = {
    transform: [{ rotateY: '180deg' }],
    opacity: flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
  };

  const backStyle = {
    opacity: flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] }),
  };

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bgImage} resizeMode="cover">
      <View style={styles.overlay}>
        <Text style={styles.title}>{t('menu.taro')}</Text>
        
        <View style={styles.cardContainer}>
          <Animated.View style={[styles.cardBase, flipStyle]}>
            {/* 뒷면 */}
            <Animated.View style={[styles.cardSide, styles.cardBack, backStyle]}>
              <View style={styles.backPattern}>
                <Text style={styles.backIcon}>🔮</Text>
              </View>
            </Animated.View>
            
            {/* 앞면 */}
            <Animated.View style={[styles.cardSide, styles.cardFront, frontStyle]}>
              {card && (
                <>
                  <Text style={styles.cardIcon}>✨</Text>
                  <Text style={[styles.cardName, card.reversed && styles.reversed]}>
                    {card.name}
                  </Text>
                  {card.reversed && <Text style={styles.reversedLabel}>{t('taro.reversed')}</Text>}
                  <View style={styles.divider} />
                  <Text style={styles.kw}>{card.keywords}</Text>
                </>
              )}
            </Animated.View>
          </Animated.View>
        </View>

        <Pressable style={styles.btn} onPress={handleDraw}>
          <Text style={styles.btnText}>{isFlipped ? t('taro.reshuffle') : t('taro.draw')}</Text>
        </Pressable>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: 'rgba(21,19,46,0.6)', justifyContent: 'center', alignItems: 'center', padding: space(6) },
  title: { ...font.title, color: colors.ink, marginBottom: space(10) },
  cardContainer: { width: 240, height: 360, marginBottom: space(12) },
  cardBase: { flex: 1, ...shadow.card },
  cardSide: {
    position: 'absolute', width: '100%', height: '100%',
    borderRadius: radius.lg, borderWidth: 2, borderColor: colors.juLine,
    justifyContent: 'center', alignItems: 'center', backfaceVisibility: 'hidden',
  },
  cardBack: { backgroundColor: colors.card },
  backPattern: {
    width: '90%', height: '94%', borderWidth: 1, borderColor: 'rgba(201,161,74,0.3)',
    borderRadius: radius.md, justifyContent: 'center', alignItems: 'center',
  },
  backIcon: { fontSize: 48, opacity: 0.5 },
  cardFront: { backgroundColor: colors.card, padding: space(5) },
  cardIcon: { fontSize: 32, marginBottom: space(4) },
  cardName: { fontSize: 24, fontWeight: '800', color: colors.ju, textAlign: 'center' },
  reversed: { color: colors.inkFaint },
  reversedLabel: { ...font.caption, color: colors.juDeep, marginTop: space(1) },
  divider: { width: 30, height: 2, backgroundColor: colors.juLine, marginVertical: space(5) },
  kw: { ...font.body, textAlign: 'center', lineHeight: 22, color: colors.ink },
  btn: {
    backgroundColor: colors.ju, borderRadius: radius.pill,
    paddingVertical: space(4), paddingHorizontal: space(10), ...shadow.card,
  },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
