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
  text, accent = colors.ju, collapsible = false, baseSize = 15, style, onTermPress,
}: {
  text: string;                       // 본문 원문(통짜 허용)
  accent?: string;                    // 강조색 — 콘텐츠별 themeColor(정체성 유지)
  collapsible?: boolean;              // 긴 본문 '더 보기' 접기(기본 false)
  baseSize?: number;                  // 기준 글자 크기(fs 배율 적용 전). 기본 15 = 기존 본문과 동일
  style?: StyleProp<ViewStyle>;
  /** 명리 용어 탭(가독성 P2). 주면 용어가 점선 밑줄+탭 가능해진다. 없으면 굵게만(기존 동작). */
  onTermPress?: (term: string) => void;
}) {
  const { fs, ls } = useFontScale();
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
  const bodyDyn: TextStyle = { fontSize: fs(baseSize), lineHeight: Math.round(ls(baseSize) * 1.75) };

  if (!paras.length) return null;

  return (
    <View style={style}>
      {shown.map((segments, i) => (
        <Text key={i} style={[styles.para, bodyDyn, i > 0 && { marginTop: space(3.5) }]}>
          {segments.map((sg, j) => {
            if (!sg.em) return <Text key={j}>{sg.t}</Text>;
            // ★명리 용어(term)면 **탭하면 뜻이 뜨는** 안내 표시(가독성 P2 축4).
            //   점선 밑줄로 '누를 수 있다'를 알리되, 링크처럼 색을 칠하지는 않는다(과밀·오인 방지).
            if (sg.term && onTermPress) {
              return (
                <Text key={j} style={[styles.em, styles.termLink, { textDecorationColor: accent }]} onPress={() => onTermPress(sg.term!)} suppressHighlighting>
                  {sg.t}
                </Text>
              );
            }
            // 강조 = 색이 아니라 **굵기 + 살짝 짙은 먹**. 색으로 칠하면 링크로 오인되고 과밀해 보인다.
            return <Text key={j} style={styles.em}>{sg.t}</Text>;
          })}
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
  const { fs, ls } = useFontScale();
  if (!text || !text.trim()) return null;
  return (
    <View style={[styles.headWrap, { borderLeftColor: accent, backgroundColor: accent + '12' }]}>
      <Text style={[styles.headTx, { fontSize: fs(18), lineHeight: Math.round(ls(18) * 1.5) }]}>{text.trim()}</Text>
    </View>
  );
}

/**
 * 핵심 3줄(points) — 가독성 P1(축1 구조화 출력)의 표시부.
 *
 * 목표① '열고 3초 안에 핵심'. headline(한 줄 제목) 바로 아래에서 풀이의 뼈대를 2~3줄로 먼저 보여준다.
 * Edge 의 pointsDirective 가 만든 `points: string[]` 를 받는다.
 *
 * @param points 문자열 배열. **없거나 비어 있으면 아무것도 그리지 않는다** — 2026-07-26 이전에 저장된
 *               모든 풀이엔 이 필드가 없다(하위호환: 강제 재생성·캐시 무효 없이 신규 생성분부터 자연히 나타남).
 * @remarks 방어: 문자열이 아닌 원소·빈 문자열은 걸러낸다(LLM 이 객체를 넣어도 크래시하지 않게).
 */
export function ReadingPoints({ points, accent = colors.ju }: { points: unknown; accent?: string }) {
  const { fs, ls } = useFontScale();
  const list = Array.isArray(points)
    ? points.map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean).slice(0, 3)
    : [];
  if (!list.length) return null;
  return (
    <View style={[styles.pointsWrap, { borderColor: accent + '33' }]}>
      {list.map((p, i) => (
        <View key={i} style={[styles.pointRow, i > 0 && { marginTop: space(2.5) }]}>
          {/* 번호 배지 — 불릿보다 '몇 개짜리 요약인지'가 한눈에 들어온다 */}
          <View style={[styles.pointNum, { backgroundColor: accent + '1F', borderColor: accent + '55' }]}>
            <Text style={[styles.pointNumTx, { color: accent, fontSize: fs(11) }]}>{i + 1}</Text>
          </View>
          <Text style={[styles.pointTx, { fontSize: fs(14), lineHeight: Math.round(ls(14) * 1.6) }]}>{p}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * ★질문별 소제목 답(daniel 2026-07-29 "질문별 소제목으로 끊어서 보여주는 방식으로 해줘").
 *
 * 왜 필요했나: daniel 이 지정한 5개 묶음(재물·직장·인연·건강·인간관계)의 필수질문은 이미
 * 프롬프트로 주입돼 **답이 실제로 본문에 들어가 있었다**(DB 실측 확인). 그런데 산문에 녹아 있어
 * 독자가 "내 질문의 답이 어디 있는지" 찾지 못했다 = "카테고리별로 풀이가 안나오는데".
 * → 본문은 그대로 두고, 질문을 **소제목으로 세워** 그 아래 답을 붙인다.
 *
 * @param qa  [{q, a}] 배열. 신규 생성분·L3 재렌더분에만 있다 → 없으면 **미표시**(기존 저장 풀이 하위호환).
 * @param accent  일간 오행 강조색(화면과 동일 계열)
 * ⚠️ q 는 프롬프트에 별표(**)가 섞인 문구라 렌더 전에 제거한다(모델이 그대로 흘리는 경우 대비).
 */
export function ReadingQA({ qa, accent = colors.ju, onTermPress }: {
  qa: unknown; accent?: string; onTermPress?: (term: string) => void;
}) {
  const { fs, ls } = useFontScale();
  const list = Array.isArray(qa)
    ? qa
        .map((x: any) => ({
          q: typeof x?.q === 'string' ? x.q.replace(/\*\*/g, '').trim() : '',
          a: typeof x?.a === 'string' ? x.a.trim() : '',
        }))
        .filter((x) => x.q && x.a)
    : [];
  if (!list.length) return null;
  return (
    <View style={styles.qaWrap}>
      {list.map((it, i) => (
        <View key={i} style={[styles.qaItem, i > 0 && { marginTop: space(4) }]}>
          <View style={styles.qaQRow}>
            <View style={[styles.qaBar, { backgroundColor: accent }]} />
            <Text style={[styles.qaQ, { color: accent, fontSize: fs(15), lineHeight: Math.round(ls(15) * 1.45) }]}>
              {it.q}
            </Text>
          </View>
          <ReadingProse text={it.a} accent={accent} onTermPress={onTermPress} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // 질문별 소제목(ReadingQA) — 좌측 컬러바 + 굵은 질문, 그 아래 본문 톤 답
  qaWrap: { marginTop: space(2) },
  qaItem: {},
  qaQRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space(1.5) },
  qaBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginRight: space(2), minHeight: 18 },
  qaQ: { ...font.body, fontWeight: '800', flex: 1 },
  para: { ...font.body, color: colors.ink },
  // 강조 — 굵기로만(색 사용 금지: 링크 오인·과밀 방지). ink 는 이미 최고 대비(#1C1C1E on #FFF).
  em: { fontWeight: '800', color: colors.ink },
  // 탭 가능한 명리 용어 — 점선 밑줄로만 신호(색 칠하지 않음). 색 대신 형태로 구분해 과밀을 피한다.
  termLink: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  // '더 보기' — 본문 흐름을 끊지 않게 좌측 정렬 소형 아웃라인
  moreBtn: { alignSelf: 'flex-start', marginTop: space(3), paddingVertical: space(1.5), paddingHorizontal: space(3), borderRadius: radius.md, borderWidth: 1 },
  moreTx: { fontWeight: '800' },
  // 한 줄 결론 배지 — 좌측 컬러바 + 틴트. 본문(카드)보다 한 단 위 위계.
  headWrap: { borderLeftWidth: 3, borderRadius: radius.md, paddingVertical: space(3.5), paddingHorizontal: space(4), marginBottom: space(4) },
  headTx: { ...font.heading, color: colors.ink, fontWeight: '800' },
  // 핵심 3줄 — headline(틴트 배지) 과 본문(카드) 사이 위계. 테두리만 둬서 headline 보다 가볍게.
  pointsWrap: { borderWidth: 1, borderRadius: radius.md, paddingVertical: space(4), paddingHorizontal: space(4), marginBottom: space(4), backgroundColor: colors.sunk },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2.5) },
  pointNum: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  pointNumTx: { fontWeight: '800' },
  pointTx: { ...font.body, color: colors.ink, flex: 1, fontWeight: '600' },
});
