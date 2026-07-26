// app/src/components/ReadingProse.tsx — 풀이 본문 공통 렌더러(가독성 P0)
// ─────────────────────────────────────────────────────────────────────────
// 풀이 가시성 개선 P0 = 축2(시각 위계) + 축3(접이식) / 기획 [[reading-visibility-plan]].
//   **프롬프트·출력계약을 건드리지 않고** 같은 내용을 읽기 쉽게만 만든다(회귀 위험 0·비용 0).
//
// 왜 공통 컴포넌트인가:
//   풀이 본문을 그리는 곳이 3군데(SpecialContentScreen=유료 29종 / ReadingScreen=사주16·자미12 / CompatScreen)인데
//   전부 `<Text>{긴 통짜 문자열}</Text>` 한 덩어리였다. 각자 고치면 또 갈라지므로(=드리프트) 한 벌로 모은다.
//   여기 한 줄이 전 상품에 동시에 먹는다(daniel 확정 = 파일럿 아닌 전 상품).
//
// 하는 일 3가지:
//   ① 문단화 — 통짜 본문을 문장 경계에서 끊어 문단 간격을 준다(원문 불변·readingEmphasis.toParagraphs).
//   ② 강조   — 시기 표현·명리 핵심어를 첫 등장만 볼드(온디바이스·API 0).
//   ③ 접이식 — 긴 본문은 앞부분만 펼치고 '더 보기'(부담↓). 기본 끔 — 켜는 쪽이 명시적으로 결정한다.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { PressableScale } from './PressableScale';
import { useFontScale } from '../lib/ui/fontScale';
import { toParagraphs, emphasize } from '../lib/ui/readingEmphasis';
import { colors, radius, space, font } from '../lib/theme';

/** 접기를 켰을 때 '펼침' 상태로 보여줄 문단 수. 이보다 문단이 많아야 접기가 의미 있다. */
const COLLAPSED_PARAS = 2;
/** 이 길이(자) 미만이면 접기를 아예 걸지 않는다 — 짧은 글에 '더 보기'는 방해만 된다. */
const COLLAPSE_MIN_LEN = 300;

export function ReadingProse({
  text, accent = colors.ju, collapsible = false, baseSize = 15, style,
}: {
  text: string;                       // 본문 원문(통짜 허용)
  accent?: string;                    // 강조색 — 콘텐츠별 themeColor(정체성 유지)
  collapsible?: boolean;              // 긴 본문 '더 보기' 접기(기본 false)
  baseSize?: number;                  // 기준 글자 크기(fs 배율 적용 전). 기본 15 = 기존 본문과 동일
  style?: StyleProp<ViewStyle>;
}) {
  const { fs } = useFontScale();
  const [open, setOpen] = useState(false);

  // 문단 분해 — text 가 바뀔 때만(렌더마다 정규식 재실행 방지)
  const paras = useMemo(() => toParagraphs(text), [text]);
  // 강조 세그먼트 — seen Set 을 이 본문 전체에서 공유해 '첫 등장만' 볼드가 문단을 넘나들며 지켜지게 한다.
  const segs = useMemo(() => {
    const seen = new Set<string>();
    return paras.map((p) => emphasize(p, seen));
  }, [paras]);

  // 접기 조건: 켜져 있고 + 문단이 충분히 많고 + 글이 실제로 길 때만(짧으면 그냥 다 보여준다)
  const canCollapse = collapsible && paras.length > COLLAPSED_PARAS && text.length >= COLLAPSE_MIN_LEN;
  const shown = canCollapse && !open ? segs.slice(0, COLLAPSED_PARAS) : segs;

  // ★행간 1.75(기존 15/25≈1.67 → 살짝 넓힘). 문단 간격까지 더해져 '벽 텍스트' 체감이 걷힌다.
  const bodyDyn: TextStyle = { fontSize: fs(baseSize), lineHeight: Math.round(fs(baseSize) * 1.75) };

  if (!paras.length) return null;

  return (
    <View style={style}>
      {shown.map((segments, i) => (
        <Text key={i} style={[styles.para, bodyDyn, i > 0 && { marginTop: space(3.5) }]}>
          {segments.map((sg, j) =>
            sg.em
              // 강조 = 색이 아니라 **굵기 + 살짝 짙은 먹**. 색으로 칠하면 링크로 오인되고 과밀해 보인다.
              ? <Text key={j} style={styles.em}>{sg.t}</Text>
              : <Text key={j}>{sg.t}</Text>,
          )}
        </Text>
      ))}
      {canCollapse && (
        <PressableScale style={[styles.moreBtn, { borderColor: accent + '55' }]} onPress={() => setOpen((v) => !v)} hitSlop={8}>
          <Text style={[styles.moreTx, { color: accent, fontSize: fs(13) }]}>
            {open ? '접기 ▴' : `더 보기 ▾`}
          </Text>
        </PressableScale>
      )}
    </View>
  );
}

/**
 * 풀이 한 줄 결론(headline) — 본문에 묻히던 소제목을 **카드 배지**로 끌어올린다(축2 (b) 핵심 미돌출).
 * 목표① '열고 3초 안에 핵심'의 주역. 좌측 강조바 + 옅은 틴트 배경으로 본문과 층을 분리한다.
 */
export function ReadingHeadline({ text, accent = colors.ju }: { text: string; accent?: string }) {
  const { fs } = useFontScale();
  if (!text || !text.trim()) return null;
  return (
    <View style={[styles.headWrap, { borderLeftColor: accent, backgroundColor: accent + '12' }]}>
      <Text style={[styles.headTx, { fontSize: fs(18), lineHeight: Math.round(fs(18) * 1.5) }]}>{text.trim()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  para: { ...font.body, color: colors.ink },
  // 강조 — 굵기로만(색 사용 금지: 링크 오인·과밀 방지). ink 는 이미 최고 대비(#1C1C1E on #FFF).
  em: { fontWeight: '800', color: colors.ink },
  // '더 보기' — 본문 흐름을 끊지 않게 좌측 정렬 소형 아웃라인
  moreBtn: { alignSelf: 'flex-start', marginTop: space(3), paddingVertical: space(1.5), paddingHorizontal: space(3), borderRadius: radius.md, borderWidth: 1 },
  moreTx: { fontWeight: '800' },
  // 한 줄 결론 배지 — 좌측 컬러바 + 틴트. 본문(카드)보다 한 단 위 위계.
  headWrap: { borderLeftWidth: 3, borderRadius: radius.md, paddingVertical: space(3.5), paddingHorizontal: space(4), marginBottom: space(4) },
  headTx: { ...font.heading, color: colors.ink, fontWeight: '800' },
});
