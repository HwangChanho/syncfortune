// app/src/components/reading/ReadingHero.tsx — 풀이 본문 히어로 (시안 `니운내운.pdf` p10·p11)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 시안 실측
//   · 배경 = 오행 배경색에서 위로 갈수록 밝아지는 그라데이션
//   · **아치** = 위로 볼록한 흰 곡선. 곡선 위에 점 5개. 양 끝은 아래로 내려와 원으로 끝난다
//   · 제목 2줄(아주 굵고 큼) + 부제 1줄
//
// ■ 점 5개를 **오행으로 칠했다**(시안은 흰 점)
//   같은 자리에 정보를 넣을 수 있는데 장식으로 두면 아깝다. 왼쪽부터 목·화·토·금·수 순서로 놓고
//   내 명식에 **많은 오행일수록 크게** 그린다 — 아치가 곧 '내 기운의 지도'가 된다.
//   ⚠️크기만 바꾸고 순서는 고정한다(매번 자리가 바뀌면 비교가 안 된다).
//
// ■ 제목은 **지어내지 않는다**
//   시안의 「흐름을 따르는 지혜」 같은 시적 타이틀은 일주 60종마다 필요한데, 그건 daniel 검수 슬롯이다
//   (CLAUDE.md §3 — Claude 는 명리를 발명하지 않는다).
//   ⇒ 지금은 **있는 데이터**로 정확히 쓴다: 제목 = 일주 엠블럼(예: 「검푸른 원숭이」),
//     부제 = `DAY_PILLAR[일주].overview` 의 첫 문장. 타이틀 60종이 오면 `title` 로 갈아 끼우면 된다.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, space, font } from '../../lib/theme';
import { elementColor } from '../../lib/engine/ohaeng';

/** 아치 위 점 순서 — 목→화→토→금→수(상생 순). 자리를 고정해야 명식끼리 비교가 된다. */
const EL_ORDER = ['木', '火', '土', '金', '水'] as const;

/** 아치가 그려지는 좌표계(viewBox). 실제 크기는 부모가 정한다. */
const VB = { w: 320, h: 210 };

/**
 * 풀이 본문 히어로.
 *
 * @param title    큰 제목(2줄까지 자연스럽게 접힌다)
 * @param sub      한 줄 부제
 * @param counts   오행 개수(木火土金水). 없으면 점을 같은 크기로 그린다
 */
export function ReadingHero({ title, sub, counts }: {
  title: string;
  sub?: string;
  counts?: Record<string, number>;
}) {
  const max = counts ? Math.max(1, ...EL_ORDER.map((e) => counts[e] ?? 0)) : 1;

  return (
    <View style={styles.wrap}>
      {/* 배경 — 위가 밝다. 오행 팔레트를 그대로 쓰므로 대표명식 오행이 바뀌면 하늘색도 따라 바뀐다 */}
      <LinearGradient
        colors={[colors.juSoft, colors.bg]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 아치 — 제목 뒤로 지나간다(제목이 아치 안에 앉는 시안 구도) */}
      <Svg width="100%" height={VB.h} viewBox={`0 0 ${VB.w} ${VB.h}`} style={styles.arc} pointerEvents="none">
        {/* 반원 + 양 끝 수직 꼬리 */}
        <Path
          d={`M 26 ${VB.h} L 26 150 A 134 122 0 0 1 294 150 L 294 ${VB.h}`}
          stroke={colors.juLine} strokeWidth={2.2} fill="none" strokeLinecap="round"
        />
        {/* 곡선 위 오행 점 — 많은 기운일수록 크다 */}
        {EL_ORDER.map((el, i) => {
          // 반원을 5등분한 각도(왼쪽 아래 → 위 → 오른쪽 아래)
          const t = (i + 0.5) / EL_ORDER.length;
          const rad = Math.PI * (1 - t);
          const cx = 160 + Math.cos(rad) * 134;
          const cy = 150 - Math.sin(rad) * 122;
          const n = counts?.[el] ?? 0;
          const r = 5 + (n / max) * 5;                 // 5~10 — 없는 오행도 점은 남긴다(자리를 비우지 않는다). 4 는 실물에서 거의 안 보였다
          // ⚠️`金` 처럼 밝은 오행은 흰 테두리를 두르면 배경에 녹아 사라진다(실물에서 확인) → 잉크색 테두리
          return <Circle key={el} cx={cx} cy={cy} r={r} fill={elementColor[el]} stroke={colors.juLine} strokeWidth={1.4} />;
        })}
      </Svg>

      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {sub ? <Text style={styles.sub} numberOfLines={2}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 280, justifyContent: 'flex-end', overflow: 'hidden' },
  arc: { position: 'absolute', left: 0, right: 0, top: 0 },
  body: { paddingHorizontal: space(6), paddingBottom: space(8), alignItems: 'center' },
  // 시안에서 이 화면의 주인공 — 홈 점수와 같은 급.
  title: { fontSize: 30, lineHeight: 40, fontWeight: '900', color: colors.ju, textAlign: 'center', letterSpacing: -0.8 },
  sub: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(2), lineHeight: 22 },
});
