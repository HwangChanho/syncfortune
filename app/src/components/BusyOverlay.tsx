// app/src/components/BusyOverlay.tsx — 전체 화면 로딩 오버레이 (긴 콜백용)
// ─────────────────────────────────────────────────────────────────────────
// 로그인/로그아웃 등 네트워크 콜백이 끝날 때까지 입력을 막고 진행 상태를 보여준다.
//   visible 동안 화면 위에 반투명 한지 막 + 스피너 + 안내문. Modal 로 터치 차단.
// ─────────────────────────────────────────────────────────────────────────
import { Modal, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, radius, space, font } from '../lib/theme';

export function BusyOverlay({ visible, message }: { visible: boolean; message?: string }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={colors.ju} />
          {message ? <Text style={styles.tx}>{message}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: space(7), paddingHorizontal: space(9), alignItems: 'center', borderWidth: 1, borderColor: colors.juLine },
  tx: { ...font.body, color: colors.ink, marginTop: space(4) },
});
