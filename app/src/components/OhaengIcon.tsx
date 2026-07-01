import React from 'react';
import Svg, { Circle, Path, G, Rect } from 'react-native-svg';
import { elementColor } from '../lib/engine/ohaeng';

type OhaengType = '木' | '火' | '土' | '金' | '水';

interface OhaengIconProps {
  type: OhaengType;
  size?: number;
}

/**
 * OhaengIcon - 오행별 상징 아이콘 (SVG)
 * @param type 木, 火, 土, 金, 水 중 하나
 * @param size 아이콘 크기 (기본 24)
 */
export function OhaengIcon({ type, size = 24 }: OhaengIconProps) {
  const color = elementColor[type];
  const viewBox = "0 0 24 24";

  const renderIcon = () => {
    switch (type) {
      case '木': // Wood: 성장, 수직 (나무 형상)
        return (
          <G>
            <Path d="M12 3V21M12 8L7 13M12 8L17 13M8 21H16" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </G>
        );
      case '火': // Fire: 상승, 삼각형 (불꽃 형상)
        return (
          <G>
            <Path d="M12 2C12 2 7 9 7 13C7 16 9 19 12 21C15 19 17 16 17 13C17 9 12 2 12 2Z" fill="none" stroke={color} strokeWidth="2" />
            <Path d="M10 14C10 14 11 12 12 12C13 12 14 14 14 14" stroke={color} strokeWidth="2" strokeLinecap="round" />
          </G>
        );
      case '土': // Earth: 안정, 사각형 (대지 형상)
        return (
          <G>
            <Rect x="5" y="5" width="14" height="14" rx="2" stroke={color} strokeWidth="2" fill="none" />
            <Path d="M5 12H19M12 5V19" stroke={color} strokeWidth="1" opacity="0.6" />
          </G>
        );
      case '金': // Metal: 결실, 원형 (금속/열매 형상)
        return (
          <G>
            <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth="2" fill="none" />
            <Path d="M12 8V16M8 12H16" stroke={color} strokeWidth="2" strokeLinecap="round" />
          </G>
        );
      case '水': // Water: 흐름, 파동 (물결 형상)
        return (
          <G>
            <Path d="M4 10C6 10 7 12 9 12C11 12 12 10 14 10C16 10 17 12 19 12" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <Path d="M4 15C6 15 7 17 9 17C11 17 12 15 14 15C16 15 17 17 19 17" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            <Path d="M4 5C6 5 7 7 9 7C11 7 12 5 14 5C16 5 17 7 19 7" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </G>
        );
      default:
        return null;
    }
  };

  return (
    <Svg width={size} height={size} viewBox={viewBox}>
      {renderIcon()}
    </Svg>
  );
}
