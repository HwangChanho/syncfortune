/**
 * app/src/components/talk/ChartPickCard.tsx — 대화 안에서 **어떤 명식을 볼지 고른다**
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-27 *"대표명식이 등록되어있는데 사주나 자미두수 보는 선생님들이 인지를 못해.
 *   기본적으로 사주를 봐달라 또는 뭘해달라하면 **명식 체크칸이 떠서 어떤 명식을 봐줄까**로
 *   시작해야해. 아니면 직접 년월일시를 입력하면 그걸 기준으로 봐줘야하고"*
 *
 * ■ ★왜 필요했나 — **대표 명식이 실행마다 바뀌고 있었다**
 *   `loadRepChart()` 는 저장된 대표 id 가 없으면 **`charts[0]`** 으로 떨어진다.
 *   Boss 계정은 명식이 **50개**라, 목록 순서가 조금만 달라져도 매번 다른 사람을 본다.
 *   실측(2026-08-27): 최근 세션들의 `chart_id` 가 `2321d92d` · `b68aef72` · `f3deddf5` 로 **제각각**이었다.
 *   ⇒ 자동으로 아무거나 고르는 대신 **물어본다.** 이게 Boss 가 말한 처방이다.
 *   ([[talk-must-name-my-chart]] — «틀린 사주를 또렷하게 말하는» 것이 제일 나쁘다.)
 *
 * ■ 왜 말풍선이 아니라 카드인가
 *   `BirthDraftCard` 와 같은 이유다 — **고르는 일은 눈으로** 해야 엉뚱한 명식으로 안 간다.
 *   말로 «본인 걸로 볼까요?» 하고 «응» 을 받으면, 그 «응» 이 어느 명식인지 아무도 모른다.
 *
 * ■ ⚠️여기서 명식을 만들지 않는다
 *   새로 만들 일이면 `BirthDraftCard`(직접 입력)나 등록 화면으로 넘긴다.
 *   이 카드가 하는 일은 «이미 있는 것 중 하나를 고르는 것»뿐이다.
 */
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { PressableScale } from '../PressableScale';
import { colors, space, radius, font } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

/** 고를 수 있는 명식 한 줄. `label` 이 없으면 «이름 없음» 으로 보인다. */
export type PickableChart = {
  id: string;
  label?: string | null;
  /** 본인·가족·친구 등 — 같은 이름이 여럿일 때 가르는 힌트 */
  relation?: string | null;
};

/**
 * 화면에 한 번에 보여 줄 개수.
 * ★50개를 다 늘어놓으면 그건 고르는 게 아니라 **찾는 것**이 된다. 최근 것만 보이고
 *   나머지는 「전체 보기」로 넘긴다(만세력 화면이 이미 검색·분류를 갖고 있다).
 */
const MAX_SHOWN = 6;

/**
 * @param charts   고를 수 있는 명식들(최근 순으로 넘겨 준다)
 * @param current  지금 보고 있는 명식 id — 눌린 상태로 보여 준다
 * @param onPick   하나를 골랐다
 * @param onNew    ★직접 입력해서 새로 만들겠다(Boss: *"직접 년월일시를 입력하면 그걸 기준으로"*)
 * ★2026-08-29 `onAll` 을 없앴다 — 그 칩이 **만세력 화면으로 보내 버려서** 거기서는 «이 대화에 쓸
 *   명식» 을 고를 수가 없었다(Boss *"전체보기 누르면 만세력으로 넘어가버려서 고를수가 없어"*).
 *   ⇒ 목록을 **이 카드 안에서 펼친다.** 고르는 자리를 떠나게 하지 않는다.
 */
export function ChartPickCard({ charts, current, onPick, onNew }: {
  charts: PickableChart[];
  current?: string | null;
  onPick: (id: string) => void;
  onNew?: () => void;
}) {

  /**
   * ★★**고른 것을 스스로 기억한다**(Boss 2026-08-28 *"체크해도 체크가 안돼"*).
   *
   * ■ ⚠️왜 `current` prop 만으로는 안 되나 — 이 카드는 **대화 목록 state 에 element 로 박제**된다
   *   (`talk.tsx` 의 `items` 에 `node:` 로 들어간다). 그러면 만들어질 때의 props 가 **얼어붙는다** —
   *   부모가 `pickedLocal` 을 바꿔도 **이 element 는 다시 그려지지 않는다.**
   *   ⇒ 눌러도 체크가 안 켜졌다. 화면이 죽은 게 아니라 **props 가 죽어 있었다.**
   * ■ ★그래서 «누른 사실» 은 **여기서** 기억한다. 실제 반영(`onPick`)은 그대로 부모가 한다.
   * ■ ⚠️`current` 가 나중에 들어오면 따라간다(부모가 이미 고른 상태로 카드를 다시 그릴 때).
   */
  const [sel, setSel] = useState<string | null>(current ?? null);
  useEffect(() => { if (current) setSel(current); }, [current]);
  const { t } = useTranslation();
  /**
   * ★★목록을 **이 카드 안에서** 펼친다(Boss 2026-08-29).
   * ■ ⚠️`sel` 과 **같은 이유로 local state 여야 한다** — 이 카드는 대화 목록에 element 로 박제돼
   *   부모가 다시 그려 주지 않는다(위 주석). 부모 prop 으로 펼침을 관리하면 눌러도 안 펼쳐진다.
   */
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? charts : charts.slice(0, MAX_SHOWN);
  const rest = charts.length - MAX_SHOWN;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('chartPick.title', '어떤 명식을 볼까요?')}</Text>
      <Text style={styles.why}>
        {t('chartPick.why', '고른 명식으로 이 대화를 이어 갑니다. 나중에 바꿀 수도 있어요.')}
      </Text>

      {/* ★가로 스크롤이 아니라 **세로 목록** — 이름이 길어도 안 잘리고, 손가락이 닿는 면적이 넓다 */}
      {/* ★펼치면 **더 길게** 보여 주고 그 안에서 스크롤한다(Boss *"스크롤로 전체 다 보여야해"*).
          ⚠️화면을 다 먹지 않게 상한은 둔다 — 카드가 대화창을 통째로 덮으면 그것도 못 쓴다. */}
      <ScrollView style={[styles.list, expanded && styles.listOpen]} nestedScrollEnabled showsVerticalScrollIndicator>
        {shown.map((c) => {
          const on = !!sel && c.id === sel;
          return (
            <PressableScale
              key={c.id}
              style={[styles.item, on && styles.itemOn]}
              onPress={() => { setSel(c.id); onPick(c.id); }}
              hitSlop={6}
            >
              {/* 체크 — Boss 가 말한 «체크칸». 고른 것이 눈에 바로 들어와야 한다 */}
              <View style={[styles.check, on && styles.checkOn]}>
                {on ? <Text style={styles.checkTx}>✓</Text> : null}
              </View>
              <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>
                {c.label?.trim() || t('friends.noName', '이름 없음')}
              </Text>
              {c.relation ? <Text style={styles.rel} numberOfLines={1}>{c.relation}</Text> : null}
            </PressableScale>
          );
        })}
      </ScrollView>

      <View style={styles.row}>
        {onNew ? (
          <PressableScale style={styles.chip} onPress={onNew} hitSlop={6}>
            <Text style={styles.chipTx}>{t('chartPick.new', '직접 입력')}</Text>
          </PressableScale>
        ) : null}
        {rest > 0 ? (
          <PressableScale style={styles.chip} onPress={() => setExpanded((v) => !v)} hitSlop={6}>
            <Text style={styles.chipTx}>
              {expanded
                ? t('chartPick.fold', '접기')
                : t('chartPick.all', '전체 {{n}}개 보기', { n: charts.length })}
            </Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine,
    padding: space(4), gap: space(1), width: '100%',
  },
  title: { ...font.body, fontWeight: '800', color: colors.ink },
  why: { ...font.caption, color: colors.inkFaint, lineHeight: 16, marginTop: space(1) },
  // ★상한을 둔다 — 카드가 화면을 다 먹으면 대화가 안 보인다
  list: { marginTop: space(2), maxHeight: 232 },
  // ★펼쳤을 때 — 대략 열 줄. 대화창을 덮지 않는 선에서 최대한 길게
  listOpen: { maxHeight: 420 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: space(2),
    paddingVertical: space(2.5), paddingHorizontal: space(3),
    borderRadius: radius.sm, backgroundColor: colors.sunk,
    borderWidth: 1, borderColor: colors.line, marginBottom: space(1.5),
  },
  itemOn: { backgroundColor: colors.juSoft, borderColor: colors.ju },
  check: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card,
  },
  checkOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  checkTx: { color: colors.onJu, fontSize: 12, fontWeight: '900' },
  // ⚠️`minWidth: 0` 이 있어야 긴 이름이 «…» 로 줄어든다(없으면 옆 칸을 밀어낸다)
  name: { ...font.body, color: colors.ink, fontWeight: '700', flex: 1, minWidth: 0 },
  nameOn: { color: colors.ju },
  rel: { ...font.caption, color: colors.inkFaint, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(1) },
  chip: {
    paddingVertical: space(1.5), paddingHorizontal: space(2.5), borderRadius: radius.pill,
    backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line,
  },
  chipTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
});
