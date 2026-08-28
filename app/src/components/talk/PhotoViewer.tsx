// app/src/components/talk/PhotoViewer.tsx — 사진 **한 장을 화면 가득**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-25 *"사진 각각 클릭하면 전체 이미지로 나오게"*.
// 프로필 창(`ProfileSheet`)에서 배경·프로필 사진을 눌렀을 때 이 화면이 뜬다.
//
// ★일부러 «검은 화면에 사진 하나»만 둔다 — 사진을 보는 자리에 다른 것을 얹으면
//   그건 사진 보기가 아니라 또 하나의 카드가 된다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from 'react';
import { Text, StyleSheet, Modal, Pressable, useWindowDimensions, Platform, BackHandler } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  /**
   * ★★**뒤로가기로 나갈 수 있어야 한다** (Boss 2026-08-28
   *   *"사진 탭하면 전체화면으로 볼수있게 하고 뒤로가기 누르면 나갈수도 있게"*).
   *
   * ■ 안드로이드 — `Modal` 의 `onRequestClose` 가 이미 받지만, **명시적으로도** 건다.
   *   (다른 바운더리가 먼저 먹는 경우가 있었다 · [[register-back-and-destination]])
   * ■ ⚠️**웹** — `Modal` 은 브라우저 히스토리를 모른다. 그래서 뒤로가기를 누르면
   *   사진이 닫히는 게 아니라 **앱이 이전 화면으로 통째로 넘어간다.**
   *   ⇒ 열 때 히스토리를 하나 쌓고, `popstate` 에서 닫는다. 닫을 때 우리가 쌓은 것만 되돌린다.
   * ■ ⚠️훅은 **조기 return 위**에 둔다 — 아래 두면 렌더마다 훅 개수가 달라져 화면이 죽는다(React #310).
   */
  useEffect(() => {
    if (!uri) return;
    if (Platform.OS === 'web') {
      let ours = false;
      try { globalThis.history?.pushState?.({ photo: 1 }, ''); ours = true; } catch { /* 무시 */ }
      const onPop = () => onClose();
      globalThis.addEventListener?.('popstate', onPop);
      return () => {
        globalThis.removeEventListener?.('popstate', onPop);
        // ★우리가 쌓은 항목이 아직 남아 있으면(=닫기 버튼으로 닫힘) 되돌린다
        try { if (ours && globalThis.history?.state?.photo) globalThis.history.back(); } catch { /* 무시 */ }
      };
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [uri, onClose]);

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
          <Text style={styles.closeTx}>{t('common.close', '닫기')}</Text>
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
