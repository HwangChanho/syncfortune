// app/src/components/GzCell.tsx — 간지 한 칸(오행색 배경 + 한자 + 한글음)
// ─────────────────────────────────────────────────────────────────────────
// MyeongsikScreen.tsx 내부 함수였던 GzCell을 추출(2026-07-16, 커뮤니티 게시판 SharedChart
//   재사용 목적 — 명식 표시가 여러 화면에서 필요해지며 단일 출처로 승격). 대운·세운·월운
//   타임라인/확장명식 공용. sm=대운/원국, xs=세운/월운.
//   onPress 주면 글자 탭 = 물상 설명(확장명식용). 타임라인 카드(선택 기능)에는 onPress 미전달(카드 탭=드릴다운 유지).
// ★렌더·스타일은 MyeongsikScreen 원본과 완전히 동일(한 글자도 바꾸지 않음) — 기존 화면이 그대로 보여야 한다.
//   MyeongsikScreen.tsx는 이 파일을 import해서 쓴다(로컬 재정의 금지 — 단일 출처).
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from './PressableScale';
import { useFontScale } from '../lib/ui/fontScale';
import { stemElement, branchElement, elementColor, elementText, stemReading, branchReading } from '../lib/engine/ohaeng';

export function GzCell({ char, kind, size, scale = 1, onPress }: { char: string; kind: 'stem' | 'branch'; size: 'sm' | 'xs'; scale?: number; onPress?: () => void }) {
  const { fs } = useFontScale();
  const styles = useMemo(() => makeStyles(fs), [fs]); // 글자 크기 적용(명식 간지 글자)
  const el = kind === 'stem' ? stemElement(char) : branchElement(char);
  const ko = kind === 'stem' ? stemReading(char) : branchReading(char);
  const txt = { color: elementText[el] };
  // scale=1 → 정적 스타일(타임라인 카드). scale>1 → 확장명식 반응형(층 끄면 칸·글자 비례 확대). fs=설정 글자크기(칸·글자 동시 확대).
  const baseW = fs(size === 'sm' ? 38 : 34), baseF = fs(size === 'sm' ? 19 : 16), baseLH = fs(size === 'sm' ? 22 : 19);
  const cellDyn = scale !== 1 ? { width: Math.round(baseW * scale) } : { width: Math.round(baseW) };
  const textDyn = scale !== 1 ? { fontSize: Math.round(baseF * scale), lineHeight: Math.round(baseLH * scale) } : null;
  const koDyn = scale !== 1 ? { fontSize: Math.round(fs(9) * scale), lineHeight: Math.round(fs(11) * scale) } : null;
  const inner = (
    <View style={[size === 'sm' ? styles.gzCellSm : styles.gzCellXs, cellDyn, { backgroundColor: elementColor[el] }]}>
      <Text style={[size === 'sm' ? styles.gzTextSm : styles.gzTextXs, textDyn, txt]}>{char}</Text>
      <Text style={[styles.gzKo, koDyn, txt]}>{ko}</Text>
    </View>
  );
  return onPress ? <PressableScale onPress={onPress}>{inner}</PressableScale> : inner;
}

// GzCell 전용 스타일 — 원래 MyeongsikScreen의 거대한 makeStyles(fs) 안에 있던 5개 키를 값 그대로 옮김.
//   fs(글자 크기 설정 배율)를 인자로 받아 재계산 — 호출부에서 useMemo([fs])로 캐시(위 컴포넌트 참고).
const makeStyles = (fs: (n: number) => number) => StyleSheet.create({
  gzCellSm: { width: 38, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 3, marginVertical: 1.5 },
  gzTextSm: { fontSize: fs(19), fontWeight: '800', lineHeight: fs(22) },
  gzCellXs: { width: 34, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 2, marginVertical: 1.5 },
  gzTextXs: { fontSize: fs(16), fontWeight: '700', lineHeight: fs(19) },
  gzKo: { fontSize: fs(9), fontWeight: '700', lineHeight: fs(11), opacity: 0.85 },   // 한자 아래 한글음
});
