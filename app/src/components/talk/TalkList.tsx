// app/src/components/talk/TalkList.tsx — 카톡형 친구목록 (상담사)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-19: 시작 화면을 카톡 친구목록으로. 각 친구가 사주 상담사다.
//
// ■ 시안 톤을 따른다 — 새 색을 만들지 않는다
//   아바타는 오행 팔레트(`elementColor`)에서 가져오고, 면·글자는 `colors` 토큰만 쓴다.
//   그래야 테마(오행)가 바뀌면 이 화면도 함께 바뀐다.
//
// ■ 가상/실제를 **한 줄로 구분해 보여 준다**
//   가상 상담사는 정해진 대사로 콘텐츠를 안내하는 도우미다. 사람이라고 믿고 물었다가
//   정해진 답만 나오면 신뢰를 잃는다 ⇒ 목록에서부터 역할이 드러나게 적는다.
//   ⚠️문구(무엇이라고 부를지)는 Boss 결정 슬롯이라 i18n 키로 뺐다.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../PressableScale';
import { A } from '../../lib/ui/remoteAsset';
import { colors, space, radius, font, shadow } from '../../lib/theme';
import { elementColor } from '../../lib/engine/ohaeng';
import type { Consultant } from '../../lib/talk/consultants';

/** 아바타가 없을 때 쓰는 오행 색 — id 로 고정 배정(매번 바뀌면 사람이 안 외워진다). */
const FALLBACK_EL = ['木', '火', '土', '金', '水'] as const;
function elemOf(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return FALLBACK_EL[h % FALLBACK_EL.length];
}

/**
 * 상담사 목록.
 *
 * @param items    보여 줄 상담사들(이미 정렬돼 있다)
 * @param onOpen   눌렀을 때
 * @param selected 웹 2칸에서 지금 열려 있는 상담사(모바일은 undefined)
 */
export function TalkList({ items, onOpen, selected }: {
  items: Consultant[];
  onOpen: (c: Consultant) => void;
  selected?: string;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.body}>
      <Text style={styles.head}>{t('talk.listTitle', '상담')}</Text>
      {items.map((c) => {
        const on = selected === c.id;
        return (
          <PressableScale key={c.id} style={[styles.row, on && styles.rowOn]} onPress={() => onOpen(c)}>
            {c.avatar
              ? <ExpoImage source={A(c.avatar)} style={styles.av} contentFit="cover" transition={140} />
              : <View style={[styles.av, { backgroundColor: elementColor[elemOf(c.id)] }]} />}
            <View style={styles.col}>
              <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {c.tagline ?? ''}
                {c.tagline ? ' · ' : ''}
                {t(c.kind === 'live' ? 'talk.kindLive' : 'talk.kindVirtual')}
              </Text>
            </View>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space(4), paddingBottom: space(20) },
  head: { fontSize: 22, lineHeight: 30, fontWeight: '900', color: colors.ink, letterSpacing: -0.4, marginBottom: space(4) },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: space(3.5), marginBottom: space(2.5), ...shadow.soft,
  },
  // 웹 2칸에서 '지금 보고 있는 사람'
  rowOn: { backgroundColor: colors.juSoft },
  av: { width: 52, height: 52, borderRadius: radius.md },
  col: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...font.body, color: colors.ink, fontWeight: '800' },
  sub: { ...font.caption, color: colors.inkFaint },
});
