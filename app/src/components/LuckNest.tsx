// app/src/components/LuckNest.tsx — 운의 중첩(벤다이어그램식) 시각화
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-05: "만세력에 원국 → 일운 → 월운 → 년운 → 대운 이렇게 감싸는 형태면
//                     좋을 것 같은데. 벤다이어그램같이 원국이 제일 안쪽에 있고."
//
// ■ 표현: 중첩 라운드 박스(양파 단면) — 제일 안쪽 = 원국 팔자(미니 그리드),
//   바깥으로 일운 → 월운 → 년운(세운) → 대운 띠가 감싼다. 각 띠 상단에 라벨+간지+십신.
//   ⚠️명리 판정 0 — 이미 계산된 값(만세력 선택 상태)을 자리만 바꿔 그린다.
// ■ 데이터 없는 층은 띠를 만들지 않는다(시각 미상·운 미계산 명식은 원국 상자만).
//   층 토글(showLayers)과도 연동 — 끈 층은 감싸지 않는다.
// ■ 색: 층별 고정 색상(안→밖 짙어짐). 원국 = 카드 배경(주인공).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, space, radius, font } from '../lib/theme';

export type NestRing = {
  label: string;            // '일운' | '월운' | '년운' | '대운' (표시용 — 순서는 배열이 정함: [0]=제일 안쪽)
  stem: string;             // 천간
  branch: string;           // 지지
  sub?: string;             // 보조 표기(십신 등) — 없으면 생략
};

export type NestPillar = { pos: string; stem: string; branch: string };

// 층별 띠 색(안 → 밖, 점점 짙게) — 만세력 운 카드 톤과 같은 계열
const RING_TINT = ['#F3EFE6', '#EBE4D3', '#E2D8C0', '#D8CCAD'];
const RING_EDGE = ['#D8CFBE', '#CCC0A8', '#BFB093', '#B2A07E'];

/**
 * 운 중첩(양파) 다이어그램.
 * @param natal 원국 기둥(년월일시 순, 시각 미상이면 3주) — 제일 안쪽 상자에 미니 그리드로.
 * @param rings 감싸는 층들. **배열 순서 = 안쪽부터** (daniel 지정: 일운, 월운, 년운, 대운).
 */
export function LuckNest({ natal, rings }: { natal: NestPillar[]; rings: NestRing[] }) {
  // 원국 미니 그리드 — 전통 표기(오른쪽=년주)와 맞추기 위해 역순 렌더
  const core = (
    <View style={styles.core}>
      <View style={styles.coreRow}>
        {[...natal].reverse().map((p) => (
          <View key={p.pos} style={styles.corePillar}>
            <Text style={styles.corePos}>{p.pos}</Text>
            <Text style={styles.coreChar}>{p.stem}</Text>
            <Text style={styles.coreChar}>{p.branch}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.coreLabel}>원국</Text>
    </View>
  );

  // 바깥층부터 안쪽으로 감싸며 조립(reduceRight) — rings[0]=제일 안쪽이므로 뒤에서부터 두른다.
  return rings.reduceRight((child, r, i) => (
    <View key={r.label} style={[styles.ring, { backgroundColor: RING_TINT[i] ?? RING_TINT[3], borderColor: RING_EDGE[i] ?? RING_EDGE[3] }]}>
      <View style={styles.ringHead}>
        <Text style={styles.ringLabel}>{r.label}</Text>
        <Text style={styles.ringGz}>{r.stem}{r.branch}</Text>
        {r.sub ? <Text style={styles.ringSub}>{r.sub}</Text> : null}
      </View>
      {child}
    </View>
  ), core as React.ReactElement);
}

const styles = StyleSheet.create({
  ring: { borderWidth: 1, borderRadius: radius.lg, padding: space(2.5), paddingTop: space(1.5) },
  ringHead: { flexDirection: 'row', alignItems: 'baseline', gap: space(1.5), marginBottom: space(1.5), paddingHorizontal: space(0.5) },
  ringLabel: { ...font.caption, color: colors.inkSoft, fontWeight: '800' },
  ringGz: { fontSize: 15, lineHeight: 20, fontWeight: '900', color: colors.ink },
  ringSub: { ...font.caption, color: colors.inkFaint },
  // 원국 코어 — 흰 카드로 주인공 대비
  core: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(2), alignItems: 'center' },
  coreRow: { flexDirection: 'row', gap: space(2) },
  corePillar: { alignItems: 'center', minWidth: 34 },
  corePos: { fontSize: 10, lineHeight: 14, color: colors.inkFaint, fontWeight: '700', marginBottom: 2 },
  coreChar: { fontSize: 19, lineHeight: 24, fontWeight: '800', color: colors.ink },
  coreLabel: { ...font.caption, color: colors.ju, fontWeight: '800', marginTop: space(1.5) },
});
