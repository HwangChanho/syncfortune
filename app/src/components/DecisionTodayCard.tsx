// app/src/components/DecisionTodayCard.tsx — 홈 블록: 오늘의 결정 도우미
// ─────────────────────────────────────────────────────────────────────────
// daniel 07-25 코드 큐 '결정도우미(결정장애)'. "오늘 이거 결정해도 될까?"에 한 화면으로 답한다.
//   ★새 명리 판정 0 — 전부 lib/content/decisionToday(= dailyEnergy 재배열)에서 온다. 온디바이스·API 0(무료 §9-5).
//
// 패턴 정합(LuckyTodayCard·BiorhythmCard·TodayRelationCard 와 동일):
//   · 자기완결형 — 스스로 대표 명식을 로드
//   · reloadKey — 대표 명식 전환/홈 포커스 시 홈이 올려 재산출
//   · 명식 없으면 렌더하지 않는다(return null) — 홈이 안내문으로 도배되지 않게
// ⚠️문구·유형 매핑 = Claude Code 초안 → ★daniel 검수 슬롯. §4: 단정·공포 금지(경향·처방 톤).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from './PressableScale';
import { useRouter } from 'expo-router'; // 카드 탭 → 모먼트 상세(/moment)로(daniel 07-26: 오늘의 행운처럼 타고 들어가 명식 변경)
import { loadRepChart } from '../lib/engine/myChart';
import { computeChart } from '../lib/engine/engine';       // canonical 빌더 단일화(drift 방지)
import { getDailyFortune, dailyEnergy } from '../lib/content/dailyFortune'; // 오늘 일진(干支)·오늘 기운 — 다른 홈 블록과 같은 출처
import { decisionFromEnergy, momentFromEnergy, VERDICT_STYLE, type DecisionToday, type MomentPick } from '../lib/content/decisionToday';
import { luckyToday, type LuckyToday } from '../lib/content/luckyItem'; // 오늘 기운(일진 오행) → 코디·음식·소품 추천(daniel 07-26)
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';
import type { Stem, Branch } from '@spec/chart';

/**
 * 홈 블록: 오늘의 결정 도우미.
 * @param reloadKey 대표 명식 전환/포커스 시 홈이 올려 재산출(다른 홈 블록과 동일 계약).
 */
export function DecisionTodayCard({ reloadKey }: { reloadKey?: number }) {
  const router = useRouter();
  const { fs, ls } = useFontScale();
  const [data, setData] = useState<DecisionToday | null>(null);
  const [moment, setMoment] = useState<MomentPick | null>(null); // ★모먼트 — 설레는 제안 한 줄(daniel 07-26)

  // 오늘 일진 — 하루 고정이라 마운트당 1회
  const today = useMemo(() => getDailyFortune(0), []);
  // 오늘 기운(일진 오행) 상징 → 코디·음식·소품 추천. 명식 불필요·하루 고정(오늘의 행운 카드와 같은 출처).
  const lucky = useMemo<LuckyToday | null>(() => { try { return luckyToday(); } catch { return null; } }, [today]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const rep = await loadRepChart();
      if (!alive) return;
      if (!rep) { setData(null); return; }
      const saju = computeChart(rep.input).saju;
      // 오늘 일주 간지(예: '庚子') → 천간·지지. 홈의 다른 블록과 동일한 출처(getDailyFortune.dayGanZhi).
      const gz = String(today?.dayGanZhi ?? '');
      if (gz.length < 2) { setData(null); return; }
      // 오늘 기운(daniel 승인 로직) 산출 → 결정 관점으로 재배열(순수 함수). 새 명리 판정 0.
      //   ★같은 energy 로 모먼트(설레는 제안)까지 뽑는다 — 재계산 없음, 둘이 같은 신호를 근거로 함.
      const energy = dailyEnergy(saju, gz[0] as Stem, gz[1] as Branch);
      setData(decisionFromEnergy(energy));
      setMoment(momentFromEnergy(energy));
    })().catch(() => { if (alive) setData(null); });
    return () => { alive = false; };
  }, [reloadKey, today]);

  // 명식 없음/산출 실패 = 미노출(다른 홈 블록과 동일 원칙)
  if (!data) return null;
  const vs = VERDICT_STYLE[data.verdict];

  return (
    <PressableScale style={styles.card} onPress={() => router.push('/moment')}>
      {/* 헤더 — 좌: 타이틀, 우: 판정 배지 */}
      <View style={styles.head}>
        <Text style={[styles.kicker, { fontSize: fs(12) }]}>모먼트</Text>
        <View style={[styles.badge, { backgroundColor: vs.hex + '1F', borderColor: vs.hex + '66' }]}>
          <Text style={[styles.badgeTx, { color: vs.hex, fontSize: fs(12) }]}>{vs.label}</Text>
        </View>
      </View>

      {/* 한 줄 결론 + 근거 */}
      <Text style={[styles.title, { fontSize: fs(17), lineHeight: ls(24) }]}>{data.title}</Text>
      <Text style={[styles.reason, { fontSize: fs(13), lineHeight: ls(20) }]}>{data.reason}</Text>

      {/* ★오늘의 모먼트(daniel 2026-07-26 "달달한 걸 추가") — 판정보다 먼저 눈에 들어오게 상단에.
          근거는 결정 판정과 **같은 dailyEnergy 신호**(도화·합·천을귀인·역마 / 충형·공망)라 서로 어긋나지 않는다. */}
      {moment ? (
        <View style={styles.momentBox}>
          <Text style={[styles.momentTitle, { fontSize: fs(14), lineHeight: ls(20) }]}>{moment.title}</Text>
          <Text style={[styles.momentBody, { fontSize: fs(12.5), lineHeight: ls(19) }]}>{moment.body}</Text>
        </View>
      ) : null}

      {/* 유형별 요약 — 홈 카드는 **판정 칩만**(전체 조언·근거는 상세 /moment).
          ★판정별로 묶여서 온다(decisionFromEnergy 가 go→hold→wait 로 정렬) — 좋아요/미루기가 번갈아 나오지 않게. */}
      <View style={styles.chipRow}>
        {data.items.map((it) => {
          const s = VERDICT_STYLE[it.verdict];
          return (
            <View key={it.kind} style={[styles.chip, { borderColor: s.hex + '55' }]}>
              <Text style={[styles.chipTx, { fontSize: fs(11) }]}>{it.label}</Text>
              <View style={[styles.dot, { backgroundColor: s.hex }]} />
            </View>
          );
        })}
      </View>

      {/* ★오늘의 추천(daniel 2026-07-26 "음식 추천 코디 추천 같은 추천 컨텐츠 더 넣자") —
          결정 판정과 성격이 달라(좋다/나쁘다가 아니라 '무엇을') 아래 구획으로 분리한다.
          데이터는 luckyToday()(일진 오행 상징) **단일 출처** 재사용 — 오늘의 행운 카드와 값이 어긋나지 않게. */}
      {lucky ? (
        <View style={styles.recWrap}>
          <Text style={[styles.recHead, { fontSize: fs(11) }]}>오늘 어울리는 것</Text>
          <View style={styles.recRow}>
            {/* 색 스와치로 '코디'를 글자 없이도 알아보게(오늘의 행운과 같은 hex) */}
            <View style={[styles.swatch, { backgroundColor: lucky.hex }]} />
            <Text style={[styles.recLabel, { fontSize: fs(12) }]}>코디</Text>
            <Text style={[styles.recTx, { fontSize: fs(12), lineHeight: ls(18) }]} numberOfLines={2}>{lucky.wear}</Text>
          </View>
          <View style={styles.recRow}>
            <View style={[styles.swatch, styles.swatchGhost]} />
            <Text style={[styles.recLabel, { fontSize: fs(12) }]}>음식</Text>
            <Text style={[styles.recTx, { fontSize: fs(12), lineHeight: ls(18) }]} numberOfLines={2}>{lucky.food}</Text>
          </View>
          <View style={styles.recRow}>
            <View style={[styles.swatch, styles.swatchGhost]} />
            <Text style={[styles.recLabel, { fontSize: fs(12) }]}>소품</Text>
            <Text style={[styles.recTx, { fontSize: fs(12), lineHeight: ls(18) }]} numberOfLines={2}>{lucky.item}</Text>
          </View>
        </View>
      ) : null}

      {/* 상세(/moment)에서 명식 전환·전체 판정·근거 신호까지 볼 수 있다(daniel 07-26) */}
      <Text style={[styles.more, { fontSize: fs(11) }]}>자세히 보고 명식 바꾸기 ›</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(4), ...shadow.card },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2) },
  kicker: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.5 },
  badge: { borderWidth: 1, borderRadius: 999, paddingVertical: space(1), paddingHorizontal: space(2.5) },
  badgeTx: { fontWeight: '800' },
  title: { ...font.heading, color: colors.ink, fontWeight: '900', marginBottom: space(1.5) },
  reason: { ...font.body, color: colors.inkSoft, marginBottom: space(3) },
  // 모먼트 — 카드 안에서 살짝 도드라지게(연한 골드 틴트). 결정 판정과 성격이 달라 블록으로 분리.
  momentBox: { backgroundColor: colors.juSoft, borderRadius: radius.md, paddingVertical: space(3.5), paddingHorizontal: space(4), marginBottom: space(3.5) },
  momentTitle: { ...font.body, color: colors.ink, fontWeight: '800' },
  momentBody: { ...font.caption, color: colors.inkSoft, marginTop: space(1) },
  // 접힘 — 유형별 판정을 점(dot)으로 한눈에
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), borderWidth: 1, borderRadius: 999, paddingVertical: space(1), paddingHorizontal: space(2.5), backgroundColor: colors.sunk },
  chipTx: { ...font.caption, color: colors.ink, fontWeight: '700' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  // 펼침 — 유형별 조언
  list: { gap: space(3) },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2.5) },
  rowBadge: { borderWidth: 1, borderRadius: 6, paddingVertical: space(0.5), paddingHorizontal: space(1.5), minWidth: 44, alignItems: 'center', marginTop: 2 },
  rowBadgeTx: { fontWeight: '800' },
  rowLabel: { ...font.body, color: colors.ink, fontWeight: '800' },
  rowTip: { ...font.caption, color: colors.inkSoft, marginTop: 2 },
  more: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(3), fontWeight: '700' },
  // 오늘의 추천(코디·음식·소품) — 결정 판정과 구분되게 상단 구분선 + 낮은 채도
  recWrap: { marginTop: space(4), paddingTop: space(4), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, gap: space(2) },
  recHead: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.5, marginBottom: space(1) },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: space(2.5) },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  swatchGhost: { backgroundColor: colors.line }, // 색이 의미 없는 항목(음식·소품)은 중립 점으로 정렬만 맞춘다
  recLabel: { ...font.caption, color: colors.inkSoft, fontWeight: '800', width: 34 },
  recTx: { ...font.caption, color: colors.ink, flex: 1 },
});
