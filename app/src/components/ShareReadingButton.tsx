// app/src/components/ShareReadingButton.tsx — 이슈17: 풀이 결과 공유 버튼(재사용)
// ─────────────────────────────────────────────────────────────────────────
// 풀이 화면 어디서나 동일하게 쓰는 공유 버튼. content(풀이 결과)를 스냅샷으로 공유한다.
//   미생성/오류 풀이는 숨김. 공유 링크는 앱 설치자만 열람(daniel) — lib/share 참고.
// ─────────────────────────────────────────────────────────────────────────
import { Pressable, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Alert } from '../lib/alert';
import { shareReading } from '../lib/share';
import { colors, radius, space } from '../lib/theme';

export function ShareReadingButton({ kind, category, title, content, style }: {
  kind: string;
  category?: string;
  title?: string;
  content: any;
  style?: StyleProp<ViewStyle>;
}) {
  // 풀이가 없거나 오류면 공유 버튼 미노출(공유할 결과가 없음).
  if (!content || (typeof content === 'object' && (content as any).error)) return null;
  return (
    <Pressable
      style={[styles.btn, style]}
      onPress={async () => {
        try { await shareReading({ kind, category, title, content }); }
        catch (e) { Alert.alert('!', (e as Error).message); }
      }}
    >
      <Text style={styles.tx}>🔗 이 풀이 공유하기</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { alignSelf: 'center', borderColor: colors.ju, borderWidth: 1, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(5), marginTop: space(4), marginBottom: space(2) },
  tx: { color: colors.ju, fontWeight: '700', fontSize: 14 },
});
