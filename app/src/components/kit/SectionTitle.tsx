// app/src/components/kit/SectionTitle.tsx — 시안 섹션 제목 (「무료로 체험해보세요!」 같은 줄)
// ─────────────────────────────────────────────────────────────────────────
// 시안(`니운내운.pdf` p04 등)의 규칙: 섹션 제목은 **카드 밖**에 좌측 정렬로 크고 굵게 놓인다.
//   카드 안에 제목을 넣던 종전 방식과 다르다 — 밖에 두면 "여기서부터 다른 묶음"이 한눈에 보인다.
// ★크기는 `fs()` 를 타지 않는다 — 전역 Text 패치가 이미 배율을 곱한다(fontScale.tsx 머리말 참조).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { colors, space, font } from '../../lib/theme';

/**
 * 섹션 제목 한 줄.
 *
 * @param children 제목 문구(예: `무료로 체험해보세요!`)
 * @param sub      선택 — 제목 아래 한 줄 설명
 * @param right    선택 — 우측에 놓을 요소(예: '더보기')
 */
export function SectionTitle({ children, sub, right }: { children: string; sub?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.title}>{children}</Text>
        {right ?? null}
      </View>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space(6), marginBottom: space(3) },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2) },
  // 시안 실측: 본문(15)보다 확실히 크고 아주 굵다. 자간을 살짝 좁혀 덩어리로 읽히게.
  title: { ...font.title, fontSize: 20, lineHeight: 28, fontWeight: '900', color: colors.ink, letterSpacing: -0.3 },
  sub: { ...font.caption, color: colors.inkSoft, marginTop: space(1) },
});
