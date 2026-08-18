// app/src/app/(app)/favorites.tsx — 「찜한 콘텐츠」 (시안 p06 마이페이지 메뉴)
// ═══════════════════════════════════════════════════════════════════════════
// 찜한 카드를 목록에서 **콘텐츠 목록과 같은 모양**으로 보여준다.
//   ★`ContentGrid` 를 재사용하지 않는 이유: 그리드는 섹션 단위로 도는 컴포넌트라
//     '내가 고른 것들'이라는 평평한 묶음과 맞지 않는다. 대신 진입은 같은 라우트를 쓴다.
//
// ⚠️여기서 하트를 지우면 **목록에서 그 줄이 곧바로 사라진다** — 실수로 눌렀을 때 되돌릴 길이 필요해
//   토글로만 두고 '삭제' 같은 별도 동작은 만들지 않는다(다시 누르면 돌아온다).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { SECTIONS, type MenuItem } from '../../lib/content/contentSections';
import { loadFavorites, subscribeFavorites, toggleFavorite } from '../../lib/content/favorites';
import { PressableScale } from '../../components/PressableScale';
import { colors, radius, space, font, shadow } from '../../lib/theme';

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [keys, setKeys] = useState<Set<string> | null>(null);   // null = 아직 로딩

  useEffect(() => {
    void loadFavorites().then(setKeys);
    return subscribeFavorites(setKeys);
  }, []);

  // 찜한 키 → 카드. 목록 순서는 `SECTIONS` 를 따른다(찜한 순서가 아니라 **주제 순서**라 매번 같은 자리에 있다).
  const items: MenuItem[] = keys
    ? SECTIONS.flatMap((s) => s.items).filter((it) => keys.has(it.key))
    : [];

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={[styles.body, { paddingTop: insets.top + space(4) }]}>
      <Text style={styles.title}>{t('my.fav', '찜한 콘텐츠')}</Text>

      {keys === null ? null : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTx}>{t('fav.empty', '아직 찜한 콘텐츠가 없어요.')}</Text>
          <Text style={styles.emptySub}>{t('fav.emptySub', '콘텐츠 카드의 ♡ 를 누르면 여기에 모여요.')}</Text>
          <PressableScale style={styles.cta} onPress={() => router.replace('/contents')}>
            <Text style={styles.ctaTx}>{t('myReadings.goPick', '운세 보러 가기')}</Text>
          </PressableScale>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((it, i, arr) => (
            <View key={it.key} style={[styles.row, i < arr.length - 1 && styles.rowLine]}>
              <PressableScale style={styles.rowMain} onPress={() => router.push(it.route as never)}>
                {it.image ? <ExpoImage source={it.image} style={styles.thumb} contentFit="cover" transition={120} /> : <View style={styles.thumb} />}
                <View style={styles.rowL}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{t(it.labelKey)}</Text>
                  {it.descKey ? <Text style={styles.rowSub} numberOfLines={1}>{t(it.descKey)}</Text> : null}
                </View>
              </PressableScale>
              {/* 하트는 목록 안에서도 끌 수 있다 — 콘텐츠에 들어갔다 나올 필요가 없게 */}
              <PressableScale hitSlop={8} style={styles.fav} onPress={() => void toggleFavorite(it.key)}>
                <Text style={styles.favTx}>♥</Text>
              </PressableScale>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  // 하단 여백 170 = 광고 배너 50 + 하단 내비 86 + 홈 인디케이터 34(check:bottominset 기준)
  body: { paddingHorizontal: space(4), paddingBottom: 170 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '900', color: colors.ink, letterSpacing: -0.3, marginBottom: space(3) },
  center: { alignItems: 'center', paddingVertical: space(12), gap: space(2) },
  emptyTx: { ...font.body, color: colors.inkSoft, textAlign: 'center' },
  emptySub: { ...font.caption, color: colors.inkFaint, textAlign: 'center' },
  cta: { marginTop: space(2), backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(5), paddingVertical: space(2.5) },
  ctaTx: { ...font.label, color: colors.onJu, fontWeight: '800' },

  list: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: space(4), ...shadow.soft },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(3) },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(3) },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.sunk },
  rowL: { flex: 1, gap: 2 },
  rowTitle: { ...font.body, color: colors.ink, fontWeight: '700' },
  rowSub: { ...font.caption, color: colors.inkFaint },
  fav: { padding: space(2) },
  favTx: { fontSize: 18, lineHeight: 22, color: colors.ju },
});
