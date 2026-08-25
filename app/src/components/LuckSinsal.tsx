// app/src/components/LuckSinsal.tsx — **운에서 발생하는 살** 표시(만세력 원국·운세 탭)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-24 *"만세력에 운에서 발생하는 살도 보여지면 좋겠어"*
//
// ■ 두 조각으로 나눈 이유
//   `LuckSinsalTags` — 대운·세운 **칸 안**. 칸이 좁아 두 개까지만 적고 나머지는 `+n`.
//   `LuckSinsalLine` — 띠 **아래 한 줄**. 선택한 운의 **전부**를 적고 눌러서 뜻을 본다.
//   ★자르기만 하고 전체를 어디에도 안 두면 그건 **콘텐츠 소실**이다([[list-truncation-hides-content]]).
//     그래서 자른 자리(`+n`)와 펼친 자리(아래 줄)를 **짝으로** 만든다.
//
// ■ ⚠️중첩 <Text> 금지 — 웹에서 백지가 된다([[web-nested-text-crash]]).
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { sinsalAtLuck } from '@engine/sinsal';
import { PressableScale } from './PressableScale';
import { colors, radius, space, font } from '../lib/theme';

/** 칸 안에 넣는 아주 작은 꼬리표 — 최대 둘 + 나머지 개수. */
export function LuckSinsalTags({ names }: { names: string[] }) {
  if (!names?.length) return null;
  const head = names.slice(0, 2);
  const rest = names.length - head.length;
  return (
    <View style={styles.tagWrap}>
      {head.map((n) => <Text key={n} style={styles.tag} numberOfLines={1}>{n}</Text>)}
      {rest > 0 && <Text style={styles.more}>+{rest}</Text>}
    </View>
  );
}

/**
 * 띠 아래 한 줄 — 선택한 운이 데려오는 살 **전부**.
 *
 * @param label  무엇의 살인지(예: `27세 대운 庚午`) — 어느 운의 것인지 안 적으면 원국 신살과 헷갈린다
 * @param saju   원국
 * @param stem   운 천간 / @param branch 운 지지 — 둘 중 하나라도 없으면 아무것도 그리지 않는다
 * @param onTag  꼬리표를 눌렀을 때(용어 설명 시트)
 */
export function LuckSinsalLine({
  label, saju, stem, branch, onTag,
}: {
  label: string;
  saju: SajuChart;
  stem?: string;
  branch?: string;
  onTag: (name: string) => void;
}) {
  if (!stem || !branch) return null;
  const r = sinsalAtLuck(saju, stem as never, branch as never);
  return (
    // ★한 줄이 아니라 **칸**이다(Boss 2026-08-26 *"발생하는 살은 따로 공간을 만들어서 보여줘야해"*).
    //   종전엔 띠 바로 밑 한 줄이라 간지·십신 사이에 끼어 «이게 무엇의 살인지» 가 안 읽혔다.
    <View style={styles.box}>
      <Text style={styles.boxLbl} numberOfLines={1}>{label} 에서 오는 살</Text>
      {r.names.length ? (
        <View style={styles.lineTags}>
          {r.names.map((n) => (
            <PressableScale key={n} onPress={() => onTag(n)} style={styles.chip} hitSlop={6}>
              <Text style={styles.chipTx}>{n}</Text>
            </PressableScale>
          ))}
        </View>
      ) : (
        // ★없으면 **없다고 적는다**. 줄을 통째로 지우면 "계산을 안 했나?" 로 읽힌다.
        <Text style={styles.none}>이 운에는 따로 걸리는 살이 없어요</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // 살 전용 칸 — 띠와 **분명히 갈라진** 면. 배경·테두리로 «다른 것» 임을 말한다
  box: {
    marginTop: space(1.5), marginBottom: space(2.5),
    backgroundColor: colors.sunk, borderRadius: radius.md,
    paddingVertical: space(2.5), paddingHorizontal: space(3), gap: space(1.5),
  },
  boxLbl: { ...font.caption, color: colors.inkSoft, fontWeight: '800' },
  tagWrap: { alignItems: 'center', marginTop: 2 },
  tag: { fontSize: 9, lineHeight: 13, color: colors.ju, fontWeight: '700' },
  more: { fontSize: 8.5, lineHeight: 12, color: colors.inkFaint, fontWeight: '700' },

  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2), marginTop: space(1), marginBottom: space(2), paddingHorizontal: space(1) },
  lineLbl: { ...font.caption, fontSize: 11, color: colors.inkFaint, fontWeight: '800', paddingTop: 3 },
  lineTags: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) },
  chip: { backgroundColor: colors.juSoft, borderRadius: radius.pill, paddingHorizontal: space(2), paddingVertical: space(0.75) },
  chipTx: { fontSize: 11, lineHeight: 15, color: colors.ju, fontWeight: '700' },
  none: { ...font.caption, fontSize: 11, color: colors.inkFaint, flex: 1, paddingTop: 3 },
});
