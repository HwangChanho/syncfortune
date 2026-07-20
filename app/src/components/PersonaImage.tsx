// app/src/components/PersonaImage.tsx — 성격유형 카드 이미지(서버 fetch·expo-image).
// ─────────────────────────────────────────────────────────────────────────
// Boss 결정(2026-07-20): 이미지는 Supabase Storage 에서 받아온다(재빌드 없이 교체 가능).
//   expo-image 가 URL 로드 + 디스크캐시(첫 로드 후 번들만큼 빠름). **홈 히어로·상세가 공통으로 쓰는 단일 출처.**
//   URL 이 없거나(성별 미상·미지원 글자) 로드 실패(오프라인 첫 진입 등)면 → **오행색 간지 네모 2글자 폴백**
//   (만세력·오늘의 기운과 같은 시각 언어라 이질감 0). 폴백이 있어 네트워크 실패에도 화면이 비지 않는다.
// ─────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { personaImageUrl } from '../lib/content/personaImages';
import { stemElement, branchElement, elementColor, elementText } from '../lib/engine/ohaeng';
import { radius } from '../lib/theme';

export function PersonaImage({ dayStem, monthBranch, sex, width, height }: {
  dayStem: string;
  monthBranch: string;
  sex?: '남' | '여';
  width: number;
  height: number;
}) {
  const url = personaImageUrl(dayStem, monthBranch, sex);
  const [failed, setFailed] = useState(false);

  // 정상 경로 — 서버 이미지
  if (url && !failed) {
    return (
      <ExpoImage
        source={{ uri: url }}
        style={{ width, height, borderRadius: radius.md }}
        contentFit="cover"
        transition={200}
        onError={() => setFailed(true)} // 로드 실패 → 폴백으로 전환
      />
    );
  }

  // 폴백 — 오행색 간지 네모 2글자(일간=천간 오행색 / 월지=지지 오행색)
  const stemEl = stemElement(dayStem);
  const branchEl = branchElement(monthBranch);
  const bw = (width - 6) / 2;              // 두 글자 나란히(사이 6)
  const bh = Math.min(bw * 1.25, height);  // 세로형 네모, 슬롯 높이 초과 방지
  return (
    <View style={[styles.fallback, { width, height }]}>
      <View style={[styles.box, { width: bw, height: bh, backgroundColor: elementColor[stemEl] }]}>
        <Text style={[styles.tx, { color: elementText[stemEl], fontSize: bw * 0.62 }]}>{dayStem}</Text>
      </View>
      <View style={[styles.box, { width: bw, height: bh, backgroundColor: elementColor[branchEl] }]}>
        <Text style={[styles.tx, { color: elementText[branchEl], fontSize: bw * 0.62 }]}>{monthBranch}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  box: { borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tx: { fontWeight: '800' },
});
