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
import { View, Text, Animated, Easing, StyleSheet, Pressable } from 'react-native'; // ★Modal 제거(VideoView Modal내 iOS 렌더실패)
import { useVideoPlayer, VideoView } from 'expo-video'; // 번들 mp4 재생(이미 VideoSplash 에서 사용 — 신규 네이티브 의존 없음)
import { PressableScale } from './PressableScale';
import { useRouter } from 'expo-router';
import { colors, space, radius, font, getReadingVideoEnabled } from '../lib/theme';

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
export function UnlockOverlay({ visible, message, allowBackground = true, videoKey: videoKeyProp, minMs = 3200 }: { visible: boolean; message?: string; allowBackground?: boolean; videoKey?: VideoKey; minMs?: number }) {
  // 풀이 로딩영상 on/off(daniel 07-13·설정) — OFF면 테마영상 무시하고 링+자물쇠 연출로 폴백(아래 videoKey 로직 자동 반영).
  const videoKey = getReadingVideoEnabled() ? videoKeyProp : undefined;
  const router = useRouter();
  const spin = useRef(new Animated.Value(0)).current;   // 골드 링 회전(분석 중)
  const pulse = useRef(new Animated.Value(0)).current;   // 자물쇠 펄스
  const [open, setOpen] = useState(false);               // 🔒 → 🔓 전환(0.6초 후 열림)

  // A(daniel 2026-07-08 '영상먼저'): 한 번 뜨면 최소 minMs 동안 유지 → 캐시/빠른 완료여도 로딩 연출이 '깜빡'하지 않고 온전히 재생 후 뷰 공개.
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!visible) return;              // 뜰 때만 타이머 시작(내려갈 땐 held 가 minMs 까지 표시 유지)
    setHeld(true);
    const t = setTimeout(() => setHeld(false), minMs);
    return () => clearTimeout(t);
  }, [visible, minMs]);
  const show = visible || held;        // 부모가 busy=false 로 내려도 minMs 전이면 계속 표시

  // 진행률 %(daniel 2026-07-13): LLM 생성은 실제 진행신호가 없어 *완만 램프*(0→95% 점근) + 완료(visible=false) 시 100%.
  //   자물쇠 로딩('영상먼저' 대기)이 죽은 대기처럼 안 느껴지게 — 대략적 진척감. 285ms마다 남은거리의 4.5%씩(초반 빠르고 후반 느림).
  const [pct, setPct] = useState(0);
  useEffect(() => {
    if (!show) { setPct(0); return; }            // 닫히면 리셋
    if (!visible) { setPct(100); return; }        // 생성 완료(부모 busy=false) → 100%, held 동안 잠깐 노출 후 페이드
    const id = setInterval(() => setPct((p) => (p >= 95 ? 95 : Math.min(95, p + Math.max(0.6, (95 - p) * 0.045)))), 285);
    return () => clearInterval(id);
  }, [show, visible]);

  // ★테마 영상 플레이어 — 훅 규칙상 *항상* 호출(조건부 금지). 실제 보일 때(show && videoKey)만 소스를 넘겨
  //   그때만 재생/오디오가 나게 한다. show=false 면 소스를 null 로 → 재생 중지·이전 플레이어 릴리스.
  const videoSource = (show && videoKey) ? CONTENT_VIDEOS[videoKey] : null;
  const player = useVideoPlayer(videoSource, (p) => {
    // 루프 재생 + 앰비언트 사운드 유지(무음 아님). 소스 null 이면 재생할 게 없어 무해(try 로 보호).
    try { p.loop = true; p.muted = false; p.play(); } catch { /* 소스 없음/재생 불가 — 텍스트만 노출 */ }
  });

  useEffect(() => {
    // 영상 모드(videoKey)에선 링·자물쇠를 렌더하지 않으므로 애니 루프도 돌리지 않는다(불필요한 연산 절약).
    if (!show || videoKey) { setOpen(false); return; }
    spin.setValue(0); pulse.setValue(0);
    const spinLoop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true }));
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    spinLoop.start(); pulseLoop.start();
    const openT = setTimeout(() => setOpen(true), 600);   // 잠시 흔들다 열림
    return () => { spinLoop.stop(); pulseLoop.stop(); clearTimeout(openT); };
  }, [show, videoKey]);

  if (!show) return null;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    // ★VideoView 는 RN Modal 안에서 iOS 렌더 실패(오디오만 남·영상 안 뜸)→ Modal 대신 전체화면 absolute View로.
    //   작동하는 VideoSplash 와 동일 패턴(absoluteFill). daniel 2026-07-15 '영상 켰는데 소리만·자물쇠 안보임' 수정.
    <View style={[StyleSheet.absoluteFill, styles.overlay, videoKey && styles.overlayVideo, styles.rootZ]}>
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
        {/* 진행률 %(daniel 2026-07-13) — 자물쇠 로딩이 죽은 대기처럼 안 느껴지게. 완료 시 100%. */}
        <Text style={[styles.pct, videoKey && { color: colors.onImage }]}>{Math.round(pct)}%</Text>
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
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlayStrong, alignItems: 'center', justifyContent: 'center' },
  rootZ: { zIndex: 1000, elevation: 1000 }, // Modal 대체 전체화면 오버레이 — 화면 최상단에(생성 중 콘텐츠 위 덮기)

  overlayVideo: { backgroundColor: '#0B0A1A' }, // 영상 로드 전/레터박스 시 미드나잇(밝은 플래시 방지)
  videoScrim: { backgroundColor: 'rgba(0,0,0,0.45)' }, // 영상 위 어둠막 — 메시지/버튼 가독성(daniel 가시성 QA 톤)
  center: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: space(6) },
  ring: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 3, borderColor: colors.ju, borderTopColor: 'transparent', borderRightColor: 'transparent' },
  lock: { fontSize: 52 },
  pct: { fontSize: 42, fontWeight: '900', color: colors.ju, letterSpacing: 0.5, marginBottom: space(2) }, // 진행률 % — 골드 강조(영상 위=onImage 오버라이드)
  msg: { ...font.heading, color: colors.ink, fontWeight: '800' },
  sub: { ...font.caption, color: colors.inkSoft, marginTop: space(2), textAlign: 'center', lineHeight: 19 },
  exitBtn: { marginTop: space(6), borderWidth: 1.5, borderColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(2.75) },
  exitTx: { color: colors.ju, fontSize: 14, fontWeight: '700' },
});
