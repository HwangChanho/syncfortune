// app/src/components/UnlockOverlay.tsx — 스페셜/유료 unlock 연출(자물쇠 풀림) 풀스크린 오버레이
// ─────────────────────────────────────────────────────────────────────────
// daniel: unlock 해서 들어가는 콘텐츠는 자물쇠가 풀리는 애니 한 겹을 보여주고, 그 사이 LLM 분석을 미리 돌린다.
//   → 부모가 generate(LLM) 시작 시 visible=true. 회전 골드 링 + 자물쇠(🔒→🔓) 펄스 + 메시지.
//   LLM 완료(부모 busy=false)되면 visible=false → 자연 페이드아웃. Modal 이라 위치 무관(어디 두든 최상단).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Animated, Easing, StyleSheet, Pressable } from 'react-native';
import { PressableScale } from './PressableScale';
import { useRouter } from 'expo-router';
import { colors, space, radius, font } from '../lib/theme';

// allowBackground=true(기본): API 생성처럼 시간이 걸리는 콘텐츠 — '홈으로 나가기' 노출(나가도 백그라운드 진행·완료 시 푸시).
export function UnlockOverlay({ visible, message, allowBackground = true }: { visible: boolean; message?: string; allowBackground?: boolean }) {
  const router = useRouter();
  const spin = useRef(new Animated.Value(0)).current;   // 골드 링 회전(분석 중)
  const pulse = useRef(new Animated.Value(0)).current;   // 자물쇠 펄스
  const [open, setOpen] = useState(false);               // 🔒 → 🔓 전환(0.6초 후 열림)

  useEffect(() => {
    if (!visible) { setOpen(false); return; }
    spin.setValue(0); pulse.setValue(0);
    const spinLoop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true }));
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    spinLoop.start(); pulseLoop.start();
    const openT = setTimeout(() => setOpen(true), 600);   // 잠시 흔들다 열림
    return () => { spinLoop.stop(); pulseLoop.stop(); clearTimeout(openT); };
  }, [visible]);

  if (!visible) return null;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.center}>
          <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
          <Animated.Text style={[styles.lock, { transform: [{ scale }] }]}>{open ? '🔓' : '🔒'}</Animated.Text>
        </View>
        <Text style={styles.msg}>{message ?? '운명을 여는 중…'}</Text>
        {/* daniel: 정확한 통변엔 시간이 걸림을 안내(무거운 풀이 대기 안심) */}
        <Text style={styles.sub}>정확한 통변을 위해 일정 시간이 소요됩니다{allowBackground ? '\n나가 있어도 백그라운드에서 계속 풀이되고, 완료되면 알림으로 알려드릴게요' : '\n잠시만 기다려 주세요'}</Text>
        {allowBackground && (
          <PressableScale style={styles.exitBtn} onPress={() => router.replace('/')}>
            <Text style={styles.exitTx}>홈으로 나가기</Text>
          </PressableScale>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlayStrong, alignItems: 'center', justifyContent: 'center' },
  center: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: space(6) },
  ring: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 3, borderColor: colors.ju, borderTopColor: 'transparent', borderRightColor: 'transparent' },
  lock: { fontSize: 52 },
  msg: { ...font.heading, color: colors.ink, fontWeight: '800' },
  sub: { ...font.caption, color: colors.inkSoft, marginTop: space(2), textAlign: 'center', lineHeight: 19 },
  exitBtn: { marginTop: space(6), borderWidth: 1.5, borderColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(2.75) },
  exitTx: { color: colors.ju, fontSize: 14, fontWeight: '700' },
});
