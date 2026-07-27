// app/src/app/(app)/biorhythm.tsx — 바이오리듬 상세
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-27: "홈은 모든 컨텐츠 다 [접고] 오늘의 운세 빼고" → 홈은 제목만 보이고 타고 들어가 본다.
//   ★그런데 바이오리듬은 **상세 화면이 없었다**(홈 카드가 유일한 노출처). 그대로 접었다면 콘텐츠가
//     아예 도달 불가가 된다 → 접기 전에 이 화면을 먼저 만든다.
//   내용은 홈에 있던 카드를 그대로 재사용한다(BiorhythmCard) — 판정·계산 중복 0.
//
// 바이오리듬은 생년월일 3주기(신체23·감정28·지성33일) sine — **사주와 무관한 부가 재미**다.
//   명리 판정이 아니므로 §3(명리 stance) 대상이 아니고, 문구도 그 성격을 유지한다.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { BiorhythmCard } from '../../components/BiorhythmCard';
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 진입 1회 방문 기록
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, space, font } from '../../lib/theme';

export default function BiorhythmScreen() {
  useLogContentVisit('biorhythm');
  const { fs } = useFontScale();
  return (
    <View style={styles.bg}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
        <Text style={[styles.h, { fontSize: fs(26) }]}>바이오리듬</Text>
        <Text style={[styles.sub, { fontSize: fs(13) }]}>태어난 날부터 이어지는 신체·감정·지성의 주기예요.</Text>
        <BiorhythmCard />
        <Text style={[styles.note, { fontSize: fs(12), lineHeight: fs(19) }]}>
          ※ 바이오리듬은 생년월일의 고정 주기(신체 23일·감정 28일·지성 33일)로 계산하는 부가 콘텐츠예요.
          사주 풀이와는 별개이니 가볍게 참고해 주세요.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },   // 전역 ContentBackdrop 투과
  screen: { backgroundColor: 'transparent' },
  wrap: { padding: space(5), paddingBottom: space(10) },
  h: { ...font.display, marginTop: space(2) },
  sub: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5), marginBottom: space(4) },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(4) },
});
