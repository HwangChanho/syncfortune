// app/src/components/kit/Icon.tsx — 상단바 아이콘 **단일 원본**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-24 *"앱 상단에 아이콘들 크기가 너무 작어"*
//
// ■ ★왜 글자를 버리고 SVG 로 가나 (크기만 키우면 안 되는 이유)
//   종전엔 `⌕`(U+2315) · `×`(U+00D7) · `＋`(U+FF0B) · `⋮`(U+22EE) 를 `<Text fontSize:26>` 으로
//   그렸다. 이것들은 **글리프가 em 박스를 다 안 쓴다** — 특히 `⌕` 는 박스 한가운데 작게 그려지고
//   `×` 는 x-높이라, 26 을 줘도 화면에서는 12~16px 짜리 콩알로 보였다. 게다가 **폰트마다 다르다**
//   (웹은 폰트 폴백이 또 달라 아예 네모로 뜰 수도 있다).
//   ⇒ 숫자를 올려도 *서로 크기가 안 맞는* 문제는 안 풀린다. **획을 우리가 그린다.**
//
// ■ 규격
//   24×24 좌표계에 **굵기 2**. `size` 는 실제 픽셀(기본 24)이고 획 굵기도 같이 자란다.
//   ⇒ 어떤 아이콘을 골라도 **시각적 무게가 같다**(글리프였을 땐 이게 안 맞았다).
//
// ■ 쓰는 곳
//   친구목록(`TalkList`)·대화목록(`ChatList`) 상단, 대화방 머리의 지우기.
//   ⚠️두 목록에 **같은 스타일이 복제**돼 있었다 — 여기 한 곳만 고치면 둘 다 따라오게 한다.
// ═══════════════════════════════════════════════════════════════════════════
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors } from '../../lib/theme';

/** 그릴 수 있는 아이콘. 늘릴 때는 **24×24 · 굵기 2** 규격을 지킨다. */
export type IconName = 'search' | 'close' | 'plus' | 'more' | 'trash' | 'gear' | 'bell' | 'menu';

/**
 * 상단바 아이콘 하나.
 *
 * @param name   무엇을 그릴지
 * @param size   실제 픽셀(기본 24). 획 굵기가 같이 자란다
 * @param color  선 색(기본 `colors.inkSoft`)
 */
export function Icon({ name, size = 24, color = colors.inkSoft }: {
  name: IconName; size?: number; color?: string;
}) {
  // 24 기준 굵기 2 를 유지 — size 를 키우면 획도 같이 굵어져야 가늘어 보이지 않는다
  const sw = (2 * size) / 24;
  const common = { stroke: color, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'search' && (<>
        <Circle cx={10.5} cy={10.5} r={6.5} {...common} />
        <Line x1={15.4} y1={15.4} x2={20.5} y2={20.5} {...common} />
      </>)}
      {name === 'close' && (<>
        <Line x1={4.6} y1={4.6} x2={19.4} y2={19.4} {...common} />
        <Line x1={19.4} y1={4.6} x2={4.6} y2={19.4} {...common} />
      </>)}
      {name === 'plus' && (<>
        <Line x1={12} y1={4.5} x2={12} y2={19.5} {...common} />
        <Line x1={4.5} y1={12} x2={19.5} y2={12} {...common} />
      </>)}
      {/* 세로 점 셋 — 점은 획이 아니라 **채움**이라 굵기와 무관하게 또렷하다 */}
      {name === 'more' && [4.8, 12, 19.2].map((cy) => (
        <Circle key={cy} cx={12} cy={cy} r={2.05} fill={color} />
      ))}
      {name === 'trash' && (<>
        <Path d="M4.5 6.5h15" {...common} />
        <Path d="M9.5 6.5V4.5h5v2" {...common} />
        <Path d="M6.5 6.5l1 13h9l1-13" {...common} />
        <Path d="M10 10v6M14 10v6" {...common} />
      </>)}
      {name === 'menu' && [5.8, 12, 18.2].map((y) => (
        <Line key={y} x1={3.5} y1={y} x2={20.5} y2={y} {...common} />
      ))}
      {name === 'bell' && (<>
        <Path d="M6 9.5a6 6 0 0 1 12 0c0 4 1.4 5.4 2 6.2.2.3 0 .8-.4.8H4.4c-.4 0-.6-.5-.4-.8.6-.8 2-2.2 2-6.2Z" {...common} />
        <Path d="M10 19.2a2.2 2.2 0 0 0 4 0" {...common} />
      </>)}
      {name === 'gear' && (<>
        <Circle cx={12} cy={12} r={3.2} {...common} />
        <Path d="M12 3.4v2.6M12 18v2.6M20.6 12h-2.6M6 12H3.4M18.1 5.9l-1.8 1.8M7.7 16.3l-1.8 1.8M18.1 18.1l-1.8-1.8M7.7 7.7L5.9 5.9" {...common} />
      </>)}
    </Svg>
  );
}
