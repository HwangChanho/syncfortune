// app/src/components/talk/ProfileSheet.tsx — 카카오톡식 **프로필 창**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26 *"사진 클릭하면 배경이미지 사진이미지 있는창 나오고 …"* ·
//   *"기본 프로필이 프로필 클릭하면 나오게 하자"* ·
//   *"배경화면은 5초 이하의 영상도 올릴수 있게하고 선생님들은 배경화면은 영상으로 놓자"*
//
// ■ ⚠️★**RN `Modal` 을 쓰지 않는다**(2026-08-26 전환)
//   iOS 에서 `VideoView` 가 Modal 안에 있으면 **소리만 남고 화면이 안 뜬다**
//   (2026-07-15 실물 사고 · `UnlockOverlay` 주석에 남아 있다).
//   배경을 영상으로 두려면 Modal 밖이어야 한다 ⇒ **전체를 덮는 View** 로 그린다.
//   그래서 이 컴포넌트는 **화면 루트에서만** 그려야 한다 — 칸(pane) 안에서 그리면
//   `absoluteFill` 이 그 칸을 채우고 창이 갇힌다([[overlay-absolutefill-parent]]).
//
// ■ ⚠️★배경이 **거의 전체 화면**인 이유
//   Boss 지시로 배경은 **전신(발끝까지) 9:16** 이다. 종전처럼 «폭의 52%» 짜리 띠에 넣으면
//   위아래가 잘려 **발이 날아간다** — 맨발로 찍은 뜻이 통째로 사라진다.
//   ⇒ 카카오톡처럼 배경이 화면을 채우고, 이름·버튼이 **그 위에** 앉는다.
//   ★넓은 웹에서는 폭을 묶는다(420) — 안 묶으면 9:16 이 가로로 늘어나 또 잘린다.
//
// ■ 두 겹은 그대로
//   ①프로필 창(여기) ②전체 보기(`PhotoViewer`) — 사진을 누르면 한 장만 크게.
//   ⚠️영상 배경은 전체 보기로 넘기지 않는다(이미 화면을 채우고 있다).
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { PressableScale } from '../PressableScale';
import { PhotoViewer } from './PhotoViewer';
import { CoverMedia, isVideoUri } from './CoverMedia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { originalImage, sizedImage } from '../../lib/media/imageUrl';   // 「전체 보기」만 원본 · 나머지는 그리는 크기만큼
import { colors, space, radius, font } from '../../lib/theme';
import { elementColor, elementText } from '../../lib/engine/ohaeng';

export type ProfileTarget = {
  name: string;
  tagline?: string | null;
  avatar?: string | null;
  /** 배경 — **사진 또는 5초 이하 영상**(확장자로 가른다) */
  cover?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  /** 사진이 없을 때 채울 오행(목록이 쓰던 값과 같아야 얼굴색이 안 바뀐다) */
  element?: string;
  /** ★기본 프로필 — 나이(Boss 2026-08-26). 없으면 그 줄을 안 그린다 */
  age?: number | null;
  /** 선생님 AI / 함께하면 좋은 친구 */
  group?: 'teacher' | 'friend';
  /** ★이 사람을 뭐라고 부를지 — 있으면 묶음 기본값 대신 이걸 쓴다(Boss 2026-08-26 «노쌤 = 역술인») */
  roleLabel?: string | null;
  /** 「대화하기」를 눌렀을 때. 없으면 그 버튼을 안 그린다(이미 그 방에 있는 경우) */
  onTalk?: () => void;
  /** 「꾸미기」 — 내 프로필일 때만 준다(설정으로 보낸다) */
  onEdit?: () => void;
};

/**
 * @param target 보여 줄 사람. null 이면 닫힘
 * @param onClose 닫기
 */
export function ProfileSheet({ target, onClose }: { target: ProfileTarget | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();   // ★아래 버튼이 탭바에 덮이지 않게(2026-08-30)
  const [photo, setPhoto] = useState<{ uri: string; cap: string } | null>(null);
  /**
   * ★★배경 **영상**을 전체로 보는 상태 (Boss 2026-08-27 *"클릭하면 영상이 재생 돼야해"*).
   * ⚠️`PhotoViewer` 를 못 쓴다 — 그건 RN `Modal` 인데 **iOS 에서 Modal 안의 `VideoView` 는
   *   소리만 남고 화면이 안 뜬다**(`CoverMedia` 주석 · 2026-07-15 실물 사고).
   *   ⇒ 여기 시트와 **같은 방식**(절대위치 + zIndex)으로 얹는다.
   */
  const [videoFull, setVideoFull] = useState(false);
  if (!target) return null;
  const el = target.element ?? '木';
  // ★9:16 을 지키려고 폭을 묶는다. 넓은 웹에서 가로로 늘리면 전신이 또 잘린다.
  const panelW = Math.min(width, Math.round(height * 0.62), 460);
  /**
   * ★★배경이 **영상**이면 패널 높이를 9:16 에 맞춘다 (Boss 2026-08-27 *"영상도 지금 부분짤려있고"*).
   *
   * ⚠️종전엔 패널이 `flex: 1`(화면 높이) 이라, 폭이 460 에 걸리는 순간 비율이 무너졌다 —
   *   세로로 긴 화면일수록 심해서 720×1280 영상이 **위아래가 크게 잘려** 나왔다.
   *   (height 800 이면 460/800 = 0.575 로 9:16(0.5625)과 비슷하지만, height 1200 이면 0.383 이다.)
   * ⇒ 영상일 때는 **폭에서 높이를 되돌려** 칸 자체를 9:16 으로 만든다. 그러면 `cover` 가 안 자른다.
   *   ★사진 배경은 비율이 제각각이라 그대로 둔다(자르는 게 자연스럽다).
   */
  const VIDEO_RATIO = 9 / 16;
  const panelH = Math.min(height, Math.round(panelW / VIDEO_RATIO));
  const av = Math.round(panelW * 0.22);
  const videoCover = isVideoUri(target.cover);

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      {/* ⚠️★★`flex: 0` 을 쓰면 **웹에서 패널이 통째로 사라진다**(2026-08-30 실측).
          react-native-web 은 `flex: 0` 을 **`flex: 0 1 0%`** 로 옮기는데, 그 `flex-basis: 0%` 가
          옆의 `height` 를 **덮어써서** 높이가 0 으로 무너진다 — 딤만 깔리고 내용이 안 보였다.
          (실측: 패널 `height: 818px` 인데 실제 높이 **0**.)
          ⚠️네이티브는 `flex: 0` = basis `auto` 라 멀쩡했다 — **웹에서만 조용히 죽는** 종류다.
          ★배경이 **영상인 상담가만** 이 분기를 탄다 ⇒ 영상 11명 전부 안 보이고
            배경이 없는 노쌤만 멀쩡했다(Boss *"노쎔말고 다 안돼"* — 그 말이 진단을 확증했다).
          ⇒ 세 값을 **따로** 적는다. `flexBasis: 'auto'` 여야 `height` 가 산다. */}
      <View style={[styles.panel, { width: panelW },
        videoCover ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' as const, height: panelH } : null]}>
        {/* ── 배경 ── 화면을 채운다. 사진이면 눌러서 전체 보기 */}
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: elementColor[el] }]}
          // ★영상이면 **전체로 재생**, 사진이면 전체 보기 (Boss 2026-08-27 *"클릭하면 영상이 재생 돼야해"*).
          //   ⚠️종전엔 `!videoCover` 라 **영상은 눌러도 아무 일도 안 했다.**
          onPress={() => {
            if (!target.cover) return;
            if (videoCover) setVideoFull(true);
            // ★목록·패널은 **줄인 것**으로 그리지만, 전체 보기는 원본이라야 안 뭉개진다
            else setPhoto({ uri: originalImage(target.cover) ?? target.cover, cap: target.name });
          }}
        >
          {/**
            * ★★배경이 **없을 때도 허전하지 않게** (Boss 2026-08-30 *"상담가들 프로필 눌렀는데 지금 아무것도 안나와"*).
            *
            * ■ 실측: 활성 14명 중 **배경 없음 3명**(오늘의 운세·나비·노쌤) · **얼굴까지 없음 2명**.
            *   배경이 없으면 오행 **색면 한 장**만 떠서 «고장 난 화면» 처럼 보였다.
            *   ★자료가 없는 것이지 코드가 깨진 게 아니다 — 그래도 **빈 화면을 보여 줄 이유는 없다.**
            * ■ ⇒ ①배경이 있으면 그대로 ②없고 얼굴이 있으면 **얼굴을 크게 깔고** 흐리게
            *   ③둘 다 없으면 이름 첫 글자를 크게 앉힌다. 어느 쪽이든 «채워진 화면» 이 된다.
            * ■ ⚠️얼굴을 배경으로 쓸 때는 **흐리게** 한다 — 또렷하면 아래 원형 얼굴과 겹쳐 두 번 보인다.
            */}
          {target.cover
            ? <CoverMedia uri={target.cover} />
            : target.avatar
              // ⚠️★흐리게 깔 배경에 **원본을 받지 않는다**(Boss 2026-08-30 *"한참뒤에 올라오는데"*).
              //   `blurRadius: 28` 로 뭉갤 그림이라 해상도가 필요 없다 — 폰 카메라 원본(수 MB)을
              //   받아서 뭉개는 것은 순수한 낭비고, 그 시간이 그대로 «안 열림» 으로 보인다.
              ? <ExpoImage source={{ uri: sizedImage(target.avatar, 480, 55) ?? target.avatar }} style={StyleSheet.absoluteFill}
                  contentFit="cover" blurRadius={28} transition={200} />
              : (
                <View style={[StyleSheet.absoluteFill, styles.emptyCover]} pointerEvents="none">
                  <Text style={[styles.emptyInitial, { color: elementText[el] }]}>
                    {(target.name || '?').trim().charAt(0)}
                  </Text>
                </View>
              )}
          {/* 아래를 어둡게 — 흰 글자가 밝은 배경 위에서 묻히지 않게 */}
          <View style={styles.scrim} pointerEvents="none" />
        </Pressable>

        {/* ── 닫기 ── 배경을 눌러도 닫히지만, 보이는 길이 하나 있어야 한다 */}
        <PressableScale style={styles.x} onPress={onClose} hitSlop={12}>
          <Text style={styles.xTx}>✕</Text>
        </PressableScale>

        {/* ── 아래에 얹히는 정보 ── */}
        {/* ⚠️★아래 여백을 **탭바만큼** 띄운다(Boss 2026-08-30 *"앱에서 짤려"*).
            종전엔 패널 바닥에서 고정 `space(7)` 이었는데, 이 시트는 탭바 **아래까지** 깔리므로
            그 값으로는 버튼이 탭바에 덮인다. 안전영역 + 탭바 높이를 확보한다.
            ★`Math.max` 로 잡는다 — 탭바가 없는 자리에서 여백이 줄지 않게. */}
        <View style={[styles.bottom, { bottom: Math.max(space(7), insets.bottom + 72) }]} pointerEvents="box-none">
          <PressableScale onPress={() => target.avatar && setPhoto({ uri: originalImage(target.avatar) ?? target.avatar, cap: target.name })}>
            {target.avatar
              // ★그리는 크기의 2배만 받는다(레티나). 여기는 지름 `av`(≈86px) 짜리 원이다.
              ? <ExpoImage source={{ uri: sizedImage(target.avatar, av * 2) ?? target.avatar }} style={[styles.av, { width: av, height: av, borderRadius: av * 0.32 }]} contentFit="cover" transition={160} />
              : (
                <View style={[styles.av, styles.center, { width: av, height: av, borderRadius: av * 0.32, backgroundColor: elementColor[el] }]}>
                  <Text style={{ color: elementText[el], fontWeight: '900', fontSize: av * 0.4 }}>{target.name.slice(0, 1)}</Text>
                </View>
              )}
          </PressableScale>

          <Text style={styles.name} numberOfLines={1}>{target.name}</Text>

          {/* ★기본 프로필 — 나이·분야·묶음을 한 줄로(Boss 2026-08-26).
              ⚠️없는 칸은 **그리지 않는다** — «— » 같은 빈 표시는 정보가 아니라 잡음이다. */}
          {(() => {
            const bits = [
              target.age != null ? `${target.age}세` : null,
              target.tagline?.trim() || null,
              // ★사람별 라벨이 먼저 — 없을 때만 묶음 기본값으로 떨어진다
              target.roleLabel?.trim()
                || (target.group === 'teacher' ? '선생님 AI' : target.group === 'friend' ? '무료 친구' : null),
            ].filter(Boolean);
            return bits.length ? <Text style={styles.meta} numberOfLines={2}>{bits.join(' · ')}</Text> : null;
          })()}

          <View style={styles.actions}>
            {target.onTalk ? (
              <PressableScale style={styles.btn} onPress={() => { onClose(); target.onTalk!(); }}>
                <Text style={styles.btnTx}>대화하기</Text>
              </PressableScale>
            ) : null}
            {target.linkUrl ? (
              <PressableScale style={[styles.btn, styles.btnAlt]} onPress={() => { void Linking.openURL(target.linkUrl!); }}>
                <Text style={[styles.btnTx, styles.btnTxAlt]}>{target.linkLabel?.trim() || '채널'} ↗</Text>
              </PressableScale>
            ) : null}
            {target.onEdit ? (
              <PressableScale style={[styles.btn, styles.btnAlt]} onPress={() => { onClose(); target.onEdit!(); }}>
                <Text style={[styles.btnTx, styles.btnTxAlt]}>꾸미기</Text>
              </PressableScale>
            ) : null}
          </View>
        </View>
      </View>

      {/* ★두 번째 겹 — 사진 한 장만 크게 */}
      <PhotoViewer uri={photo?.uri ?? null} caption={photo?.cap} onClose={() => setPhoto(null)} />

      {/* ★★배경 영상 **전체 보기** — Modal 을 쓰지 않는다(iOS 에서 Modal 안 VideoView 는 안 뜬다).
          어디를 눌러도 닫힌다 — 전체 보기에서 나가는 길이 하나뿐이면 갇힌 느낌이 든다(`PhotoViewer` 와 같은 규칙).
          `contain` 이라 **자르지 않는다** — 전부를 보러 온 자리다. */}
      {videoFull && videoCover && target.cover ? (
        <Pressable style={styles.full} onPress={() => setVideoFull(false)}>
          <View style={{ width, height: Math.round(height * 0.82) }} pointerEvents="none">
            <CoverMedia uri={target.cover} fit="contain" />
          </View>
          <Text style={styles.fullCap} numberOfLines={1}>{target.name}</Text>
          <PressableScale style={styles.fullX} onPress={() => setVideoFull(false)} hitSlop={12}>
            <Text style={styles.fullXTx}>닫기</Text>
          </PressableScale>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // ★Modal 이 아니라 **덮는 View** — 부모가 화면 루트여야 한다(위 머리말)
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', zIndex: 60 },
  panel: { flex: 1, alignSelf: 'center', overflow: 'hidden' },
  // 아래 절반만 어둡게 — 배경 사진은 살리고 글자는 읽히게
  // ★얼굴도 배경도 없을 때 — 이름 첫 글자를 크게. 색면 한 장보다 «누구인지» 가 보인다
  emptyCover: { alignItems: 'center', justifyContent: 'center' },
  emptyInitial: { fontSize: 160, fontWeight: '900', opacity: 0.22, includeFontPadding: false },
  scrim: { ...StyleSheet.absoluteFillObject, top: '45%', backgroundColor: 'rgba(0,0,0,0.45)' },
  // ★영상 전체 보기 — 시트(`root`)보다 **위**에 얹는다
  full: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', zIndex: 70 },
  fullCap: { ...font.label, color: 'rgba(255,255,255,0.85)', marginTop: space(3), fontWeight: '700' },
  fullX: { marginTop: space(2), paddingVertical: space(2), paddingHorizontal: space(5) },
  fullXTx: { ...font.caption, color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
  x: { position: 'absolute', top: space(5), right: space(4), width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  xTx: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: space(7), alignItems: 'center', paddingHorizontal: space(5) },
  av: { borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  center: { alignItems: 'center', justifyContent: 'center' },
  name: { ...font.title, color: '#FFFFFF', fontWeight: '900', marginTop: space(2) },
  meta: { ...font.caption, color: 'rgba(255,255,255,0.86)', textAlign: 'center', marginTop: space(1), lineHeight: 18 },
  actions: { flexDirection: 'row', gap: space(2), marginTop: space(4), flexWrap: 'wrap', justifyContent: 'center' },
  btn: { paddingVertical: space(2.5), paddingHorizontal: space(5), borderRadius: radius.pill, backgroundColor: colors.ju },
  btnAlt: { backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  btnTx: { ...font.label, color: colors.onJu, fontWeight: '800' },
  btnTxAlt: { color: '#FFFFFF' },
});
