// app/src/components/UnlockOverlay.tsx — 스페셜/유료 unlock 연출(자물쇠 풀림) 풀스크린 오버레이
// ─────────────────────────────────────────────────────────────────────────
// daniel: unlock 해서 들어가는 콘텐츠는 자물쇠가 풀리는 애니 한 겹을 보여주고, 그 사이 LLM 분석을 미리 돌린다.
//   → 부모가 generate(LLM) 시작 시 visible=true. 회전 골드 링 + 자물쇠(🔒→🔓) 펄스 + 메시지.
//   LLM 완료(부모 busy=false)되면 visible=false → 자연 페이드아웃. Modal 이라 위치 무관(어디 두든 최상단).
// ─────────────────────────────────────────────────────────────────────────
// ★콘텐츠별 테마 로딩 영상(daniel 2026-07): videoKey 를 주면 그 콘텐츠 전용 연출 영상을
//   전체화면 배경(cover·루프·앰비언트 사운드)으로 깔고, 그 위에 어둠막(scrim) + 메시지만 얹는다.
//   영상이 시각적 주인공이므로 이때는 링·자물쇠 이모지를 생략(중복 연출 제거). VideoSplash 와 동일한 expo-video 패턴.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Animated, Easing, StyleSheet, Pressable } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video'; // 번들 mp4 재생(이미 VideoSplash 에서 사용 — 신규 네이티브 의존 없음)
import { PressableScale } from './PressableScale';
import { useRouter } from 'expo-router';
import { colors, space, radius, font } from '../lib/theme';

// videoKey → 번들된 콘텐츠 테마 로딩 영상(720×1280·5초·앰비언트 사운드). 현재 5종만 준비됨.
//   ★매핑 근거: 생성에 시간이 걸리는 *유료* 콘텐츠 종류별 전용 로딩 연출.
//     saju=사주 풀이 / ziwei=자미두수 / compat=궁합 / timeline=인생 타임라인 / child=자녀운.
//   그 외 유료 콘텐츠(love·newyear·lifegraph·gaeun·career·dream·roots 등)는 videoKey 미지정 → 기본 링+자물쇠 연출(영상 없음).
type VideoKey = 'saju' | 'ziwei' | 'compat' | 'timeline' | 'child';
const CONTENT_VIDEOS: Record<VideoKey, any> = {
  saju: require('../../assets/content-videos/content-saju.mp4'),
  ziwei: require('../../assets/content-videos/content-ziwei.mp4'),
  compat: require('../../assets/content-videos/content-compat.mp4'),
  timeline: require('../../assets/content-videos/content-timeline.mp4'),
  child: require('../../assets/content-videos/content-child.mp4'),
};

// allowBackground=true(기본): API 생성처럼 시간이 걸리는 콘텐츠 — '홈으로 나가기' 노출(나가도 백그라운드 진행·완료 시 푸시).
// videoKey: 지정 시 해당 콘텐츠 테마 영상을 로딩 배경으로 재생(미지정=기존 링+자물쇠).
export function UnlockOverlay({ visible, message, allowBackground = true, videoKey }: { visible: boolean; message?: string; allowBackground?: boolean; videoKey?: VideoKey }) {
  const router = useRouter();
  const spin = useRef(new Animated.Value(0)).current;   // 골드 링 회전(분석 중)
  const pulse = useRef(new Animated.Value(0)).current;   // 자물쇠 펄스
  const [open, setOpen] = useState(false);               // 🔒 → 🔓 전환(0.6초 후 열림)

  // ★테마 영상 플레이어 — 훅 규칙상 *항상* 호출(조건부 금지). 실제 보일 때(visible && videoKey)만 소스를 넘겨
  //   그때만 재생/오디오가 나게 한다. visible=false(예: 부모 busy 종료)면 소스를 null 로 → 재생 중지·이전 플레이어 릴리스.
  //   (useVideoPlayer 는 소스가 바뀌면 새 플레이어를 만들고 이전 것을 자동 해제 — visible 토글이 곧 정지/해제.)
  const videoSource = (visible && videoKey) ? CONTENT_VIDEOS[videoKey] : null;
  const player = useVideoPlayer(videoSource, (p) => {
    // 루프 재생 + 앰비언트 사운드 유지(무음 아님). 소스 null 이면 재생할 게 없어 무해(try 로 보호).
    try { p.loop = true; p.muted = false; p.play(); } catch { /* 소스 없음/재생 불가 — 텍스트만 노출 */ }
  });

  useEffect(() => {
    // 영상 모드(videoKey)에선 링·자물쇠를 렌더하지 않으므로 애니 루프도 돌리지 않는다(불필요한 연산 절약).
    if (!visible || videoKey) { setOpen(false); return; }
    spin.setValue(0); pulse.setValue(0);
    const spinLoop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true }));
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    spinLoop.start(); pulseLoop.start();
    const openT = setTimeout(() => setOpen(true), 600);   // 잠시 흔들다 열림
    return () => { spinLoop.stop(); pulseLoop.stop(); clearTimeout(openT); };
  }, [visible, videoKey]);

  if (!visible) return null;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      {/* 영상 모드에선 컨테이너 배경을 미드나잇으로(영상 로드 전 밝은 플래시 방지 — VideoSplash 와 동일 톤) */}
      <View style={[styles.overlay, videoKey && styles.overlayVideo]}>
        {videoKey ? (
          // ── 영상 배경 모드: ① 전체화면 테마 영상(cover·루프) → ② 그 위 어둠막(텍스트 가독성) ──
          //   레이어 순서(뒤→앞): VideoView(absoluteFill) < scrim(absoluteFill) < 아래 메시지/버튼(정상 흐름·중앙).
          <>
            <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
            <View style={[StyleSheet.absoluteFill, styles.videoScrim]} pointerEvents="none" />
          </>
        ) : (
          // ── 기본 모드: 회전 골드 링 + 자물쇠(🔒→🔓) 펄스 ──
          <View style={styles.center}>
            <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
            <Animated.Text style={[styles.lock, { transform: [{ scale }] }]}>{open ? '🔓' : '🔒'}</Animated.Text>
          </View>
        )}
        {/* 공통: 메시지 + 안내 + 홈 나가기. 영상 위에선 어두운 영상이라 항상 밝은 글씨(onImage)로 — 라이트모드에서도 가독성 확보(ink=어두움 회피). */}
        <Text style={[styles.msg, videoKey && { color: colors.onImage }]}>{message ?? '운명을 여는 중…'}</Text>
        {/* daniel: 정확한 통변엔 시간이 걸림을 안내(무거운 풀이 대기 안심) */}
        <Text style={[styles.sub, videoKey && { color: colors.onImageSoft }]}>정확한 통변을 위해 일정 시간이 소요됩니다{allowBackground ? '\n나가 있어도 백그라운드에서 계속 풀이되고, 완료되면 알림으로 알려드릴게요' : '\n잠시만 기다려 주세요'}</Text>
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
  overlayVideo: { backgroundColor: '#0B0A1A' }, // 영상 로드 전/레터박스 시 미드나잇(밝은 플래시 방지)
  videoScrim: { backgroundColor: 'rgba(0,0,0,0.45)' }, // 영상 위 어둠막 — 메시지/버튼 가독성(daniel 가시성 QA 톤)
  center: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: space(6) },
  ring: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 3, borderColor: colors.ju, borderTopColor: 'transparent', borderRightColor: 'transparent' },
  lock: { fontSize: 52 },
  msg: { ...font.heading, color: colors.ink, fontWeight: '800' },
  sub: { ...font.caption, color: colors.inkSoft, marginTop: space(2), textAlign: 'center', lineHeight: 19 },
  exitBtn: { marginTop: space(6), borderWidth: 1.5, borderColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(2.75) },
  exitTx: { color: colors.ju, fontSize: 14, fontWeight: '700' },
});
