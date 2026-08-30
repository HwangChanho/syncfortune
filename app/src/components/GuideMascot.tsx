// app/src/components/GuideMascot.tsx — 안내자 메달리온 · 모션(daniel 2026-07-13 · 08-30 호랑이 폐기)
// ─────────────────────────────────────────────────────────────────────────
// 목적: '운세 목록 앱'이 아니라 *캐릭터가 있는 친근한 자기이해 도구*로 각인(App Store 4.3 대응 결).
//   배치: AI 코치 화면(title 위 아바타) + 홈 상단(브랜드 마스코트). daniel 선택 = 아기 백호.
// 모션 2층:
//   (a) 이미지 자체 = AI img2vid(SVD) 애니메이티드 webp — 호랑이가 숨쉬듯 움직임(온디바이스·영구 무료·부메랑 무한루프).
//   (b) 인앱 = 얕은 부유(bob) + 골드 후광 맥동(halo·2겹). active(코치 '생각중')이면 후광 강화.
//   (b)는 전부 useNativeDriver=true(transform/opacity) — JS 스레드 부하 0.
// 이미지: `avatars` 버킷의 상담가 얼굴(`consultants/<id>.jpg`) — 마스코트 전용 그림을 따로 두지 않는다.
//   원형 메달리온 + 골드 링(colors.ju #C9A14A) → 배경이 안 맞는 라이트 테마에서도 '포트레잇'으로 의도적.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { Animated, View, Easing, type ViewStyle } from 'react-native';
import { Image } from 'expo-image'; // 정적 png·애니메이티드 webp 모두 재생 + 다운샘플(디코딩 랙 방지)
import { colors } from '../lib/theme';
import { SUPABASE_URL } from '../lib/supabase';

// ★★2026-08-30 — 호랑이를 걷어냈다(Boss *"기존 호랑이 이미지들은 다 없애고"*).
//   그 자리에 들어가는 것은 **이미 상담가로 존재하는 두 사람**의 그림이다:
//     · 오늘의 운세 화면 → `fortune_today`
//     · 도우미(코치)     → `guide_nabi`(이름은 「운이」)
//   ⇒ 마스코트용 그림을 **따로 두지 않는다.** 따로 두면 상담가 목록의 얼굴과 언젠가 갈린다
//     (같은 사람이 화면마다 다른 얼굴이 되는 것이 이 저장소가 겪은 «중복 구현»의 전형이다).
//   ⚠️`A()` 는 `assets/img/` 버킷용이라 여기 못 쓴다 — 상담가 그림은 `avatars` 버킷에 있다.
const AVATAR_BASE = `${SUPABASE_URL}/storage/v1/object/public/avatars/`;

/** 이 마스코트가 누구인가 — 상담가 id 를 그대로 쓴다(새 키 체계를 만들지 않는다). */
export type MascotWho = 'fortune_today' | 'guide_nabi';

/**
 * 후광이 **레이아웃 박스 밖으로 삐져나가는 비율**(한쪽 기준, size 대비).
 * ─────────────────────────────────────────────────────────────────────
 * 컨테이너는 `size`인데 후광은 `size×1.72`를 `position:absolute`로 그리고,
 * 맥동으로 최대 1.16배까지 커진다 → 한쪽 삐져나감 = (1.72×1.16 − 1)/2 ≈ 0.498.
 * ★화면 좌/우 끝에 `alignSelf:'flex-start'|'flex-end'`로 붙일 때는
 *   `size × 이 값`만큼 여백이 없으면 **후광이 잘린다**
 *   (daniel 2026-08-02 "예 왜 왼쪽에 박혀있어" — 좌측정렬로 바꾸자 잘려 나갔다).
 * 가운데 정렬일 땐 좌우 대칭이라 문제가 없어 눈에 안 띄었다.
 */
export const MASCOT_HALO_OVERHANG = (1.72 * 1.16 - 1) / 2;

type Props = {
  who?: MascotWho;  // 누구를 그릴 것인가. 기본 = 안내자 「운이」(guide_nabi)
  size?: number;    // 원형 메달리온 지름(px). 기본 64. 코치=72, 홈 헤더=40 권장.
  active?: boolean; // true = '생각 중' 상태(코치 답 생성) → 광채·움직임 강화.
  glow?: boolean;   // 골드 후광 표시 여부(기본 true). 조밀한 자리에선 false.
  style?: ViewStyle;
};

/**
 * 아기 백호 마스코트(모션). 순수 표현 컴포넌트 — 상태/네트워크 없음, 어디든 배치 가능.
 * @param size   메달리온 지름
 * @param active 코치 답 생성 중이면 true(더 활발히 움직임)
 * @param glow   후광 on/off
 */
export function GuideMascot({ who = 'guide_nabi', size = 64, active = false, glow = true, style }: Props) {
  // 0..1 두 개의 구동값 — 부유(bob)·후광(halo). ref 로 리렌더와 무관하게 유지.
  const bob = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ① 부유: sin ease 로 위↔아래 왕복(자연스러운 가감속). active면 주기 단축.
    const bobDur = active ? 1400 : 2400;
    const loopBob = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: bobDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: bobDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    // ② 후광: 밝아졌다 흐려짐. active면 더 빠르고 밝게(집중 표현).
    const haloDur = active ? 900 : 1600;
    const loopHalo = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, { toValue: 1, duration: haloDur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(halo, { toValue: 0, duration: haloDur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loopBob.start();
    loopHalo.start();
    // 언마운트/상태변경 시 루프 정지(메모리·배터리 누수 방지).
    return () => {
      loopBob.stop();
      loopHalo.stop();
    };
  }, [active, bob, halo]);

  // 부유: 위아래 미세 이동(영상 자체 모션과 겹치지 않게 얕게). 회전(sway)은 영상 재생 중 어색해서 뺌.
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [size * 0.03, -size * 0.03] });

  // 후광 맥동: active면 더 진하게. 안쪽(진한)·바깥(옅은) 2겹으로 부드러운 경계.
  const haloOpacityIn = halo.interpolate({ inputRange: [0, 1], outputRange: active ? [0.32, 0.62] : [0.18, 0.42] });
  const haloOpacityOut = halo.interpolate({ inputRange: [0, 1], outputRange: active ? [0.14, 0.30] : [0.08, 0.2] });
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.16] });

  const haloIn = size * 1.28;  // 안쪽 후광 지름
  const haloOut = size * 1.72; // 바깥 후광 지름(더 옅게)

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {glow ? (
        <>
          {/* 바깥 후광(옅음) — falloff 흉내용 큰 원 */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', width: haloOut, height: haloOut, borderRadius: haloOut / 2,
              backgroundColor: colors.ju, opacity: haloOpacityOut, transform: [{ scale: haloScale }],
            }}
          />
          {/* 안쪽 후광(진함) */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', width: haloIn, height: haloIn, borderRadius: haloIn / 2,
              backgroundColor: colors.ju, opacity: haloOpacityIn, transform: [{ scale: haloScale }],
            }}
          />
        </>
      ) : null}
      {/* 마스코트 본체 — 원형 메달리온(얕은 부유). 내부는 AI 영상(webp)이 자체 재생. 골드 링으로 경계 명확. */}
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Image
          source={{ uri: `${AVATAR_BASE}consultants/${who}.jpg` }}
          style={{ width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(1, size * 0.025), borderColor: colors.ju }}
          contentFit="cover"
        />
      </Animated.View>
    </View>
  );
}
