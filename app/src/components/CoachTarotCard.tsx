// app/src/components/CoachTarotCard.tsx — 코치 답변에 곁들이는 '가볍게 뽑은 카드' 한 장
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-27(IMG_8198): "사주 자미두수도 다 보면 좋고 **가볍게 타로도** 보면 좋겠어.
//   카드는 이미지랑 애니메이션 활용해서 귀여운 카드들로"
//   코치는 이미 사주+자미를 함께 읽는다(COACH_SYSTEM 원칙1). 빠진 건 타로였다.
//
// ★★블렌딩하지 않는다(기획서 §9 규칙2의 취지) — 사주·자미 판정에 타로를 섞으면 근거가 뭉개진다.
//   그래서 타로는 **코치 답변과 분리된 별도 카드**로, '가볍게'라는 성격을 문구·크기로 명시한다.
//   LLM 프롬프트에도 들어가지 않는다(서버 왕복 0·비용 0·온디바이스 결정론).
//
// ★★시드 뽑기 — `drawCard()` 는 `Math.random()` 이라 **리렌더마다 카드가 바뀐다.**
//   대화 화면은 스크롤·키보드·새 질문마다 리렌더되므로 그대로 쓰면 카드가 계속 뒤바뀌어 신뢰가 깨진다.
//   질문 문자열 + 날짜로 시드를 만들어 **그 질문의 그날 카드는 항상 같게** 한다(같은 질문 = 같은 카드).
//
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PressableScale } from './PressableScale';
import { DECK, cardImage, cardMeaning } from '../lib/tarot';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, font, shadow } from '../lib/theme';

/** 문자열 → 32bit 해시(FNV-1a). 결정론 시드용 — 암호 용도 아님. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const CARD_W = 92;
const CARD_H = 158;   // 타로 비율(≈0.58)

/**
 * 코치 답변 아래에 붙는 카드 1장. 탭하면 뒤집힌다.
 * @param seed 이 카드를 고정할 키 — 보통 질문 원문. 같은 seed = 같은 날 = 같은 카드.
 */
export function CoachTarotCard({ seed }: { seed: string }) {
  const { fs, ls } = useFontScale();
  const [open, setOpen] = useState(false);
  const flip = useRef(new Animated.Value(0)).current;

  // 질문 + 날짜(YYYY-MM-DD) 시드 — 같은 질문이라도 날이 바뀌면 새 카드
  const pick = useMemo(() => {
    const day = new Date().toISOString().slice(0, 10);
    const h = hash32(`${seed}|${day}`);
    const card = DECK[h % DECK.length];
    const reversed = ((h >>> 16) & 1) === 1;   // 상위 비트로 정/역(하위 비트와 상관 줄이기)
    return { card, reversed };
  }, [seed]);

  const onFlip = () => {
    if (open) return;
    setOpen(true);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } catch { /* 네이티브 미포함 */ }
    Animated.timing(flip, { toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  // 앞/뒤 각각 180° 구간만 보이게 — 겹친 두 면을 회전시켜 카드 뒤집기
  const backRot = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const frontRot = flip.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '0deg'] });
  const backOpacity = flip.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [1, 1, 0, 0] });
  const frontOpacity = flip.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [0, 0, 1, 1] });

  const img = cardImage(pick.card.id);
  const meaning = cardMeaning(pick.card, pick.reversed, 'general');

  return (
    <View style={styles.wrap}>
      <Text style={[styles.kicker, { fontSize: fs(10.5) }]}>가볍게 뽑은 카드</Text>
      <View style={styles.row}>
        <PressableScale onPress={onFlip} hitSlop={6}>
          <View style={{ width: CARD_W, height: CARD_H }}>
            {/* 뒷면 — 금선 패턴(별도 에셋 없이 테마 색으로. 귀여운 전용 덱은 daniel 승인 후 별도 작업) */}
            <Animated.View style={[styles.face, styles.back, { opacity: backOpacity, transform: [{ perspective: 800 }, { rotateY: backRot }] }]}>
              <View style={styles.backInner}>
                <Text style={styles.backGlyph}>✦</Text>
              </View>
            </Animated.View>
            {/* 앞면 — 78장 덱 이미지. 역방향이면 뒤집어 보여준다(관례) */}
            <Animated.View style={[styles.face, { opacity: frontOpacity, transform: [{ perspective: 800 }, { rotateY: frontRot }] }]}>
              {img ? (
                <Image source={img} style={[styles.img, pick.reversed && styles.imgRev]} resizeMode="cover" />
              ) : (
                <View style={[styles.img, styles.imgFallback]} />
              )}
            </Animated.View>
          </View>
        </PressableScale>

        <View style={styles.text}>
          {open ? (
            <>
              <Text style={[styles.name, { fontSize: fs(14) }]}>
                {pick.card.ko}{pick.reversed ? ' (역방향)' : ''}
              </Text>
              <Text style={[styles.meaning, { fontSize: fs(13), lineHeight: 20 }]}>{meaning}</Text>
              {/* 성격을 분명히 — 위 코치 답(사주·자미)과 **다른 재미 레이어**임을 감춘 채 섞지 않는다 */}
              <Text style={[styles.note, { fontSize: fs(11) }]}>위 이야기와 별개로, 오늘 재미로 뽑은 한 장이에요.</Text>
            </>
          ) : (
            <Text style={[styles.hint, { fontSize: fs(13), lineHeight: 20 }]}>카드를 눌러 뒤집어 보세요.</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space(3.5), paddingTop: space(3.5), borderTopWidth: 1, borderTopColor: colors.juLine },
  kicker: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 1, marginBottom: space(2.5) },
  row: { flexDirection: 'row', gap: space(3.5), alignItems: 'flex-start' },
  face: { ...StyleSheet.absoluteFillObject, borderRadius: radius.md, overflow: 'hidden', backfaceVisibility: 'hidden', ...shadow.card },
  back: { backgroundColor: colors.ju, alignItems: 'center', justifyContent: 'center', padding: 5 },
  backInner: { flex: 1, alignSelf: 'stretch', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  img: { width: '100%', height: '100%' },
  imgRev: { transform: [{ rotate: '180deg' }] },     // 역방향 = 그림을 뒤집어 보여주는 게 타로 관례
  imgFallback: { backgroundColor: colors.juSoft },
  text: { flex: 1, paddingTop: space(1) },
  name: { ...font.body, color: colors.ink, fontWeight: '900' },
  meaning: { ...font.body, color: colors.inkSoft, marginTop: space(1.5) },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(2) },
  hint: { ...font.body, color: colors.inkSoft },
});
