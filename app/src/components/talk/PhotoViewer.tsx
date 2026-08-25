// app/src/components/talk/PhotoViewer.tsx — 사진 **한 장을 화면 가득**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-25 *"사진 각각 클릭하면 전체 이미지로 나오게"*.
// 프로필 창(`ProfileSheet`)에서 배경·프로필 사진을 눌렀을 때 이 화면이 뜬다.
//
// ★일부러 «검은 화면에 사진 하나»만 둔다 — 사진을 보는 자리에 다른 것을 얹으면
//   그건 사진 보기가 아니라 또 하나의 카드가 된다.
// ═══════════════════════════════════════════════════════════════════════════
import { Text, StyleSheet, Modal, Pressable, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { PressableScale } from '../PressableScale';
import { space, font } from '../../lib/theme';

/**
 * @param uri     볼 사진. null 이면 닫힌 상태
 * @param caption 아래에 작게 적을 말(이름 등). 없으면 안 그린다
 * @param onClose 닫기
 */
export function PhotoViewer({ uri, caption, onClose }: { uri: string | null; caption?: string | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  if (!uri) return null;
  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      {/* 어디를 눌러도 닫힌다 — 전체 보기에서 나가는 길이 하나뿐이면 갇힌 느낌이 든다 */}
      <Pressable style={styles.wrap} onPress={onClose}>
        <ExpoImage
          source={{ uri }}
          style={{ width, height: height * 0.72 }}
          contentFit="contain"                 // ★`cover` 로 자르지 않는다 — 전체를 보러 온 자리다
          transition={160}
        />
        {caption ? <Text style={styles.cap} numberOfLines={1}>{caption}</Text> : null}
        <PressableScale style={styles.close} onPress={onClose} hitSlop={12}>
          <Text style={styles.closeTx}>닫기</Text>
        </PressableScale>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  cap: { ...font.label, color: 'rgba(255,255,255,0.85)', marginTop: space(3), fontWeight: '700' },
  close: { marginTop: space(2), paddingVertical: space(2), paddingHorizontal: space(5) },
  closeTx: { ...font.caption, color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
});
