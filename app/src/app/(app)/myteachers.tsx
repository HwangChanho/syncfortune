// app/src/app/(app)/myteachers.tsx — 「내 활동 › 찜한 선생님」 (콘티 4면)
// ═══════════════════════════════════════════════════════════════════════════
// ★즐겨찾기는 **온디바이스**다(`favorites.ts`) — 서버에 없다.
//   그래서 로그인 없이도 보인다. '로그인하세요'를 띄우면 거짓말이 된다.
// ⚠️`PINNED_IDS`(노쌤)는 **찜 여부와 무관하게 늘 위**다 — 여기서도 같은 규칙을 쓴다.
//   목록마다 다른 순서를 쓰면 같은 사람이 화면마다 다른 자리에 있다.
// ═══════════════════════════════════════════════════════════════════════════
// safe-area-safe: 상단 인셋을 직접 준다(탭 밖 화면).
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Image as ExpoImage } from 'expo-image';
import { PressableScale } from '../../components/PressableScale';
import { listConsultants, consultantsSnapshot, type Consultant } from '../../lib/talk/consultants';
import { loadFavorites, isFavorite, toggleFavorite, subscribeFavorites } from '../../lib/talk/favorites';
import { colors, space, radius, font, shadow } from '../../lib/theme';
import { elementColor, elementText } from '../../lib/engine/ohaeng';

const EL = ['木', '火', '土', '金', '水'] as const;

export default function MyTeachersScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [people, setPeople] = useState<Consultant[]>(consultantsSnapshot());
  const [tick, setTick] = useState(0);          // 찜 변경 → 다시 그린다
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.all([listConsultants(), loadFavorites()]);
      if (!alive) return;
      setPeople(consultantsSnapshot()); setLoading(false);
    })();
    const off = subscribeFavorites(() => setTick((n) => n + 1));
    return () => { alive = false; off(); };
  }, []);

  // ★찜한 사람만. `isFavorite` 가 고정(노쌤)도 true 로 돌려주므로 순서 규칙이 저절로 지켜진다
  const rows = people.filter((p) => isFavorite(p.id));
  void tick;                                    // 구독 갱신용 — 값 자체는 쓰지 않는다

  /** 사진 없는 상담가의 색 — 방 화면과 **같은 방식**(id 해시)으로 고정한다 */
  const slotEl = (id: string) => {
    let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return EL[h % EL.length];
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={[styles.body, { paddingTop: insets.top + space(3) }]}>
      <View style={styles.head}>
        <PressableScale style={styles.back} onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.backTx}>‹</Text>
        </PressableScale>
        <Text style={styles.h1}>{t('my.teachers', '찜한 선생님')}</Text>
      </View>

      {loading ? <ActivityIndicator color={colors.ju} style={{ marginTop: space(8) }} />
        : !rows.length ? <Text style={styles.empty}>{t('my.noTeachers', '아직 찜한 선생님이 없어요.\n친구목록에서 별을 눌러 보세요.')}</Text>
        : rows.map((p) => {
          const el = slotEl(p.id);
          return (
            <View key={p.id} style={styles.row}>
              <PressableScale style={styles.rowMain} onPress={() => router.push(`/talk?c=${p.id}` as never)}>
                {p.avatar
                  ? <ExpoImage source={{ uri: p.avatar }} style={styles.av} contentFit="cover" transition={160} />
                  : (
                    <View style={[styles.av, { backgroundColor: elementColor[el], alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: elementText[el], fontWeight: '900', fontSize: 18 }}>{p.name.slice(0, 1)}</Text>
                    </View>
                  )}
                <View style={styles.mid}>
                  <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                  {p.tagline ? <Text style={styles.sub} numberOfLines={1}>{p.tagline}</Text> : null}
                </View>
              </PressableScale>
              {/* ★찜 해제는 여기서만 — 누르면 줄이 사라지지만 다시 찜하면 돌아온다(되돌릴 길이 있다) */}
              <PressableScale style={styles.star} hitSlop={8} onPress={() => toggleFavorite(p.id)}>
                <Text style={styles.starTx}>★</Text>
              </PressableScale>
            </View>
          );
        })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: space(4), paddingBottom: 176 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginBottom: space(3) },
  back: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  backTx: { fontSize: 28, lineHeight: 30, color: colors.ink },
  h1: { ...font.title, flex: 1 },
  empty: { ...font.body, color: colors.inkFaint, paddingVertical: space(8), textAlign: 'center', lineHeight: 22 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.md,
    paddingHorizontal: space(3.5), paddingVertical: space(3), marginBottom: space(2), ...shadow.soft,
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: space(3), flex: 1, minWidth: 0 },
  av: { width: 44, height: 44, borderRadius: 22 },
  mid: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...font.body, color: colors.ink, fontWeight: '800' },
  sub: { ...font.caption, color: colors.inkFaint },
  star: { paddingHorizontal: space(2), paddingVertical: space(1) },
  starTx: { fontSize: 18, color: colors.ju },
});
