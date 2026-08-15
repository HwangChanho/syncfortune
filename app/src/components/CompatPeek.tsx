// app/src/components/CompatPeek.tsx — 궁합 미리보기(무료·온디바이스·API 0원)
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-15: *"관계 지도에서 탭하면 상대와 나의 궁합이 나오게"*
//
// ■ 무엇을 보여주고 무엇을 안 보여주나
//   보여준다: **점수 + 등급 그림 + 그 점수의 근거**(daniel 6기준을 사람 말로).
//   안 한다:  이유·시기·처방 = 그건 궁합 통변(유료·LLM)의 몫이다. 여기서 흉내 내면
//             유료 콘텐츠가 무료로 새는 게 아니라, **얕은 말이 깊은 말인 척**하게 된다.
//   ⇒ 미리보기는 정직하게 "숫자는 요약"이라 말하고 궁합으로 잇는다(`compatHook`).
//
// ■ 왜 컴포넌트로 뺐나
//   지도의 **점 탭**과 아래 **리스트 펼침**이 같은 것을 보여줘야 한다. 두 벌로 그리면
//   한쪽만 고쳐지는 날이 반드시 온다([[duplicate-ui-single-source]]).
//
// ■ 숫자의 출처
//   `compatScore(dx)` — 궁합 화면이 쓰는 **바로 그 함수**(산식 정본 = `engine/compatScore.ts`).
//   지도 노드의 `chemi` 와도 같은 값이다. 같은 사람이 화면마다 다른 점수로 보이면 안 된다.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';   // 뷰 크기 다운샘플 + 디스크 캐시

import { compatScore, tierLabel } from '../lib/content/compatScore';
import { COMPAT_TIER_IMG } from '../lib/content/compatImages';
import { compatBasis, compatHook, type Lang } from '../lib/content/relationMapPhrases';
import { PressableScale } from './PressableScale';
import { colors, radius, space } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';
import type { CompatibilityDx } from '@engine/compatibility';

type Props = {
  /** 상대 이름(명식 라벨) */
  name: string;
  /** 역할 생활어 이름 — 있으면 이름 옆에 작게 */
  roleName?: string;
  /** 두 명식의 궁합 진단(지도 노드가 이미 갖고 있다 — 다시 계산하지 않는다) */
  dx: CompatibilityDx;
  /** 화면 언어 */
  lang: Lang;
  /**
   * 등급 그림을 뺀다 — **리스트 펼침**에서 쓴다.
   * 그 카드엔 이미 역할 그림이 있어서, 등급 그림까지 얹으면 한 카드에 큰 그림이 둘이라
   * 읽는 사람이 스크롤만 하게 된다(등급은 라벨로 남는다).
   */
  compact?: boolean;
  /** '궁합 제대로 보기' — 궁합 화면으로 (상대를 심어 두고 이동) */
  onOpen: () => void;
};

/**
 * 궁합 요약 카드. 점수·등급·근거·유도 한 장.
 *
 * @param dx 상위(지도)가 계산해 둔 진단. **여기서 명식을 다시 세우지 않는다** — 61명 리스트에서
 *           카드를 펼칠 때마다 엔진을 돌리면 스크롤이 끊긴다.
 */
export function CompatPeek({ name, roleName, dx, lang, compact, onOpen }: Props) {
  const { fs } = useFontScale();
  const styles = mkStyles(fs);

  const s = compatScore(dx);
  const lines = compatBasis(lang, s);
  const hook = compatHook(lang, name, s.score);
  const img = COMPAT_TIER_IMG[s.tier.key];

  return (
    <View style={styles.wrap}>
      {/* 등급 그림 — 궁합 화면과 **같은 그림**이라 두 화면이 한 흐름으로 읽힌다 */}
      {img && !compact ? <ExpoImage source={img} style={styles.img} contentFit="cover" transition={200} /> : null}

      <View style={styles.head}>
        <Text style={styles.score}>{s.score}<Text style={styles.unit}> / 100</Text></Text>
        <View style={styles.headRight}>
          <Text style={styles.tier} numberOfLines={1}>{s.tier.emoji} {tierLabel(s.tier, lang)}</Text>
          {!!roleName && <Text style={styles.role} numberOfLines={1}>{roleName}</Text>}
        </View>
      </View>

      {/* ★근거 — 숫자만 두면 사람을 점수로 재는 화면이 된다. 무엇을 보고 나온 값인지 적는다. */}
      {lines.map((l, i) => (
        <View key={i} style={styles.line}>
          <Text style={[styles.sign, l.sign === '-' && styles.signMinus]}>{l.sign === '+' ? '＋' : '－'}</Text>
          <Text style={styles.lineTx}>{l.text}</Text>
        </View>
      ))}

      {/* 유도 — 정직하게: 숫자는 요약, 이유·시기·처방은 궁합에서 */}
      <Text style={styles.hookBody}>{hook.body}</Text>
      <PressableScale style={styles.cta} onPress={onOpen}>
        <Text style={styles.ctaTx}>{hook.cta}</Text>
      </PressableScale>
    </View>
  );
}

const mkStyles = (fs: (n: number) => number) => StyleSheet.create({
  wrap: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(4), marginTop: space(3) },
  img: { width: '100%', height: 150, borderRadius: radius.sm, marginBottom: space(3) },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headRight: { flexShrink: 1, alignItems: 'flex-end', marginLeft: space(2) },
  // 점수는 고정 크기가 아니라 fs() — 글자확대 설정에서 이 숫자만 안 커지면 어색하다
  score: { color: colors.ink, fontSize: fs(34), lineHeight: fs(42), fontWeight: '900' },
  unit: { color: colors.inkSoft, fontSize: fs(13), lineHeight: fs(20), fontWeight: '700' },
  tier: { color: colors.ju, fontSize: fs(14), lineHeight: fs(21), fontWeight: '800' },
  role: { color: colors.inkSoft, fontSize: fs(12), lineHeight: fs(19) },
  line: { flexDirection: 'row', marginTop: space(2) },
  sign: { color: colors.ju, fontSize: fs(13), lineHeight: fs(21), fontWeight: '800', width: 18 },
  signMinus: { color: colors.inkSoft },
  lineTx: { flex: 1, color: colors.ink, fontSize: fs(13), lineHeight: fs(21) },
  hookBody: { color: colors.inkSoft, fontSize: fs(12), lineHeight: fs(19), marginTop: space(4) },
  cta: { marginTop: space(3), backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  ctaTx: { color: '#fff', fontSize: fs(15), lineHeight: fs(21), fontWeight: '800' },
});
