// app/src/components/AttachCompareBar.tsx — 애착 2축 **비교** 막대 (단일 출처)
// ═══════════════════════════════════════════════════════════════════════════
// 왜 EgenTetoBar 를 안 쓰나: 에겐↔테토는 **하나의 축 위 한 점**(왼쪽 끝 ↔ 오른쪽 끝)이다.
//   애착은 불안·회피가 **서로 독립된 두 축**이고(전문가 §1), 각 축에 **점이 두 개**(명식 / 설문) 찍힌다.
//   같은 컴포넌트를 억지로 재사용하면 "축의 양 끝이 반대말"이라는 잘못된 의미가 붙는다.
//
// ★그래서 새로 만들되 **여기 하나만** 둔다 — [[duplicate-ui-single-source]] 의 재발 방지.
//   결과 화면·요약 카드·공유 카드가 생기면 전부 이 컴포넌트를 부른다. 색을 인자로 열지 않는다.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, space } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';

/** 명식(사주) 마커 색 — 앱 대표 톤(골드). 설문 마커 색 — 잉크. 둘을 **인자로 열지 않는다**(갈리는 지점). */
const C_CHART = '#C8A24A';
const C_SURVEY = colors.ink;

export type AttachCompareBarProps = {
  /** 축 이름 — '불안' / '회피'. */
  label: string;
  /** 명식에서 나온 점수 0~1. 미산출이면 undefined(마커를 안 그린다). */
  chart?: number;
  /** 설문에서 나온 점수 0~1. 미응답이면 undefined. */
  survey?: number;
  /** 축의 양 끝 설명 — 왼쪽(낮음) / 오른쪽(높음). */
  lowText: string;
  highText: string;
};

/**
 * 한 축을 그린다 — 트랙 1개 + 마커 2개(명식·설문).
 * @param props 위 타입 참조. chart/survey 가 없으면 그 마커만 빠진다(빈 화면이 되지 않는다).
 */
export function AttachCompareBar({ label, chart, survey, lowText, highText }: AttachCompareBarProps) {
  const { fs } = useFontScale();
  // 마커가 트랙 밖으로 삐져나가지 않게 양끝 6% 를 남긴다(점 지름 고려).
  // ★반환 타입을 `${number}%` 로 박는다 — 그냥 string 이면 RN 의 DimensionValue 와 안 맞아 style 이 타입에러가 난다.
  const pos = (v: number): `${number}%` => `${6 + Math.max(0, Math.min(1, v)) * 88}%`;
  const gap = chart != null && survey != null ? Math.abs(chart - survey) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.label, { fontSize: fs(15), lineHeight: fs(21) }]}>{label}</Text>
        {gap != null ? (
          // ★차이를 숫자로 같이 보여 준다 — 전문가 §6 *"불일치 자체가 콘텐츠"*.
          //   크면 나쁘다는 뜻이 아니라서 색을 경고색으로 쓰지 않는다.
          <Text style={[styles.gap, { fontSize: fs(12), lineHeight: fs(17) }]}>
            차이 {Math.round(gap * 100)}
          </Text>
        ) : null}
      </View>

      <View style={styles.track}>
        {chart != null ? <View style={[styles.dot, { left: pos(chart), backgroundColor: C_CHART }]} /> : null}
        {survey != null ? <View style={[styles.dot, { left: pos(survey), backgroundColor: C_SURVEY }]} /> : null}
      </View>

      <View style={styles.ends}>
        <Text style={[styles.end, { fontSize: fs(11), lineHeight: fs(16) }]}>{lowText}</Text>
        <Text style={[styles.end, { fontSize: fs(11), lineHeight: fs(16), textAlign: 'right' }]}>{highText}</Text>
      </View>
    </View>
  );
}

/** 범례 — 어느 색이 명식이고 어느 색이 설문인지. 축마다 반복하지 않도록 따로 뺐다. */
export function AttachCompareLegend() {
  const { fs } = useFontScale();
  const item = (c: string, t: string) => (
    <View style={styles.legItem}>
      <View style={[styles.legDot, { backgroundColor: c }]} />
      <Text style={[styles.legText, { fontSize: fs(12), lineHeight: fs(17) }]}>{t}</Text>
    </View>
  );
  return <View style={styles.legend}>{item(C_CHART, '명식')}{item(C_SURVEY, '설문')}</View>;
}

const DOT = 14;
const styles = StyleSheet.create({
  wrap: { marginBottom: space(4) },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2) },
  label: { color: colors.ink, fontWeight: '800' },
  gap: { color: colors.inkFaint, fontWeight: '700' },
  track: { height: DOT, borderRadius: DOT / 2, backgroundColor: colors.sunk, justifyContent: 'center' },
  // 마커는 트랙 높이와 같게 두고 left 로만 옮긴다 — marginLeft 로 중심 보정.
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2, marginLeft: -DOT / 2, borderWidth: 2, borderColor: colors.card },
  ends: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space(1) },
  end: { color: colors.inkFaint, flex: 1 },
  legend: { flexDirection: 'row', gap: space(4), marginBottom: space(3) },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  legDot: { width: 10, height: 10, borderRadius: 5 },
  legText: { color: colors.inkSoft, fontWeight: '600' },
});
