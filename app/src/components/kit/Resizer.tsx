/**
 * app/src/components/kit/Resizer.tsx — 웹에서 **칸 폭을 손으로 조절**하는 손잡이
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-27 *"웹은 각 구간별로 좌우 클릭해서 크기 조절할수 있게하고
 *   다 닫으면 한줄로 되면서 닫았다가 다시 마우스로 드레그하면 열려서 크기 조절할수 있게"*
 *
 * ■ ★왜 필요했나 — **고정 폭이 글자를 잘랐다**
 *   웹 2칸에서 목록 칸이 `282` 로 고정이라, 아이콘 넷(208px)을 빼면 이름에 41px 만 남아
 *   「황찬호」가 **「황…」** 으로 잘렸다(2026-08-27 실측). 화면 크기도 사람마다 다르다.
 *   ⇒ 폭을 **쓰는 사람이 정하게** 한다. 그게 이 손잡이다.
 *
 * ■ 접힘 = 폭 0 이 아니라 **얇은 띠**
 *   0 으로 만들면 다시 열 손잡이가 사라진다(Boss: *"닫았다가 다시 마우스로 드레그하면 열려서"*).
 *   ⇒ 접혀도 이 막대는 남는다. 눌러서 펴거나, 그대로 끌어서 폭을 되찾을 수 있다.
 *
 * ■ ⚠️웹 전용이다
 *   폰에는 마우스가 없고 칸도 하나뿐이다. 부르는 쪽에서 `Platform.OS === 'web'` 로 가른다.
 *   ★여기서 다시 가르지 않는다 — 조건이 두 곳에 있으면 반드시 갈린다.
 */
import { useRef } from 'react';
import { View, StyleSheet, PanResponder, Pressable } from 'react-native';
import { colors, space } from '../../lib/theme';

/** 손잡이 자체의 폭 — 잡기 쉬우면서 칸을 안 먹는 값. */
export const RESIZER_W = 10;

/**
 * @param width      지금 칸 폭(px)
 * @param min        이보다 좁아지면 **접힌 것**으로 본다
 * @param max        상한 — 대화 칸이 사라질 만큼 넓히지 못하게
 * @param collapsed  접혀 있는가(부모가 들고 있는 상태)
 * @param onResize   드래그 중 새 폭. ⚠️**부모가 상태를 갖는다** — 여기서 들고 있으면
 *                   부모의 레이아웃과 어긋난다(둘이 각자 «지금 폭» 을 알면 반드시 갈린다)
 * @param onToggle   눌렀다 = 접기/펴기
 */
export function Resizer({ width, min, max, collapsed, onResize, onToggle }: {
  width: number;
  min: number;
  max: number;
  collapsed?: boolean;
  onResize: (w: number) => void;
  onToggle?: () => void;
}) {
  // ★드래그 시작 시점의 폭을 기억한다 — 매 이동마다 «시작 + 이동량» 으로 계산해야
  //   손가락과 칸이 어긋나지 않는다(누적으로 더하면 조금씩 밀린다).
  const startW = useRef(width);
  // ★움직였는가 — 안 움직였으면 **누른 것**으로 본다(드래그와 클릭을 가른다)
  const moved = useRef(false);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2,
      onPanResponderGrant: () => { startW.current = width; moved.current = false; },
      onPanResponderMove: (_e, g) => {
        if (Math.abs(g.dx) > 2) moved.current = true;
        const next = Math.round(startW.current + g.dx);
        // ⚠️상·하한을 **여기서** 건다 — 부모가 걸면 드래그가 «먹히다 마는» 느낌이 난다
        onResize(Math.max(0, Math.min(next, max)));
      },
      onPanResponderRelease: () => {
        // ★안 움직였으면 클릭 — 접기/펴기
        if (!moved.current) { onToggle?.(); return; }
        // ★min 아래로 끌었으면 **접는다**(0 으로 붙인다). 어중간하게 좁은 칸은 아무 쓸모가 없다.
        if (width < min) onToggle?.();
      },
    }),
  ).current;

  return (
    <View {...pan.panHandlers} style={styles.hit}>
      {/* Pressable 은 **키보드·스크린리더**를 위한 것 — 마우스는 위 PanResponder 가 받는다 */}
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? '칸 펴기' : '칸 접기'}
        style={styles.hit}
      >
        <View style={[styles.bar, collapsed && styles.barOn]} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // ★잡는 면적은 넓게, 보이는 선은 가늘게 — 손이 닿기 쉬우면서 눈에는 거슬리지 않게
  hit: {
    width: RESIZER_W, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center',
    // 웹에서만 있는 속성 — 커서가 «끌 수 있다» 를 알려 준다
    ...(({ cursor: 'col-resize', userSelect: 'none' } as unknown) as object),
  },
  bar: { width: 2, alignSelf: 'stretch', backgroundColor: colors.line, marginVertical: space(2) },
  // 접혀 있으면 **더 또렷하게** — 여기가 다시 여는 자리라는 표시
  barOn: { width: 4, backgroundColor: colors.ju, borderRadius: 2 },
});
