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

export function GzCell({ char, kind, size, scale = 1, onPress, hangeul, grid }: { char: string; kind: 'stem' | 'branch'; size: 'sm' | 'xs'; scale?: number; onPress?: () => void; hangeul?: boolean; grid?: boolean }) {
  const { fs, ls } = useFontScale();
  const styles = useMemo(() => makeStyles(fs), [fs]); // 글자 크기 적용(명식 간지 글자)
  const el = kind === 'stem' ? stemElement(char) : branchElement(char);
  const ko = kind === 'stem' ? stemReading(char) : branchReading(char);
  const txt = { color: elementText[el] };
  // scale=1 → 정적 스타일(타임라인 카드). scale>1 → 확장명식 반응형(층 끄면 칸·글자 비례 확대). fs=설정 글자크기(칸·글자 동시 확대).
  // ★칸 폭을 **글자 크기 설정에 연동**한다(daniel 2026-07-30 "칸 크기도 글씨크기에 영향 받으면 좋겠는데"
  //   · "아래 대운세운월운도 동일하게 옆으로 커져야해").
  //   ⚠️종전엔 `fs(43)` 이었는데 fs 는 2026-07-29 부터 **항등**이라 칸이 43 에 고정됐다 —
  //     글자는 전역 패치로 커지는데 칸은 그대로여서 좁아 보이고 넘쳤다. → ls() 로 배율을 받는다.
  //   가로는 한자 여유를 위해 **높이보다 넉넉히**(옆으로 길게).
  //   ★★용도가 둘이라 폭을 나눈다(daniel 2026-07-30 IMG_8304 "여긴 왜 이렇게 되는거야"):
  //     · grid=true  = **확장명식 표** — 화면 폭을 5~8칸이 나눠 쓴다. 폭을 키우면 칸이 서로 붙고 넘친다.
  //       (실제로 52 로 키웠더니 색 블록이 화면 끝까지 붙어버렸다.) → 종전 폭 유지 + 자체 scale 반응형.
  //     · grid=false = **대운·세운·월운 스크롤 카드** — 가로 스크롤이라 여유가 있다 → 넓게 + 글자 배율 연동.
  const baseW = grid ? fs(size === 'sm' ? 43 : 39) : ls(size === 'sm' ? 52 : 47);
  const baseF = fs(size === 'sm' ? 22 : 19), baseLH = fs(size === 'sm' ? 26 : 22); // ★크기↑(daniel 07-24)
  const cellDyn = scale !== 1 ? { width: Math.round(baseW * scale) } : { width: Math.round(baseW) };
  const textDyn = scale !== 1 ? { fontSize: Math.round(baseF * scale), lineHeight: Math.round(baseLH * scale) } : null;
  const koDyn = scale !== 1 ? { fontSize: ls(11), lineHeight: 13 } : null; // 한글음도 크기↑(daniel 07-24)
  // ★한글 모드(daniel 2026-07-24) = 한글음(갑·자)을 주(主)로, 한자는 아래 작게(스왑). 기본=한자 주.
  const main = hangeul ? ko : char;
  const subv = hangeul ? char : ko;
  const inner = (
    <View style={[size === 'sm' ? styles.gzCellSm : styles.gzCellXs, cellDyn, { backgroundColor: elementColor[el] }]}>
      {/* ★numberOfLines={1} 필수(daniel 2026-07-29 "글자크기가 너무 위아래로 길어").
          전역 줄간격 보정(installMinLineHeight)은 **줄이 감기는 텍스트**를 위한 것이라
          fontSize 의 1.25~1.5 배를 바닥값으로 깐다. 그런데 간지는 **한 글자**라 줄간격이 필요 없고,
          그 보정이 그대로 셀 높이가 되어 상자가 세로로 길쭉해졌다.
          numberOfLines={1} 이면 보정이 **건너뛴다**(그 규칙이 이미 들어 있다). */}
      <Text numberOfLines={1} style={[size === 'sm' ? styles.gzTextSm : styles.gzTextXs, textDyn, txt]}>{main}</Text>
      <Text numberOfLines={1} style={[styles.gzKo, koDyn, txt]}>{subv}</Text>
    </View>
  );
  return onPress ? <PressableScale onPress={onPress}>{inner}</PressableScale> : inner;
}

// GzCell 전용 스타일 — 원래 MyeongsikScreen의 거대한 makeStyles(fs) 안에 있던 5개 키를 값 그대로 옮김.
//   fs(글자 크기 설정 배율)를 인자로 받아 재계산 — 호출부에서 useMemo([fs])로 캐시(위 컴포넌트 참고).
const makeStyles = (fs: (n: number) => number) => StyleSheet.create({
  // ★간지 칸 크기↑(daniel 2026-07-24 '만세력 텍스트 크게') — 칸 폭·글자·한글음 모두 확대.
  gzCellSm: { width: 43, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 3, marginVertical: 1.5 },
  gzTextSm: { fontSize: fs(22), fontWeight: '800', lineHeight: fs(26) },
  gzCellXs: { width: 39, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 2, marginVertical: 1.5 },
  gzTextXs: { fontSize: fs(19), fontWeight: '700', lineHeight: fs(22) },
  gzKo: { fontSize: fs(11), fontWeight: '700', lineHeight: fs(13), opacity: 0.85 },   // 한자 아래 한글음
});
