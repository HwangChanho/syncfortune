// app/src/components/Future10Teaser.tsx — '10년 뒤 나의 모습'(future10) 무료 온디바이스 티저
// ─────────────────────────────────────────────────────────────────────────
// daniel 프리미엄 퍼널(재회 ReunionRich / 인생그래프 LifeGraphTeaser 와 동일 결):
//   유료 LLM 풀이(future10) '위'에 결정론 무료 미리보기를 먼저 보여줘 자연스러운 유료 전환을 만든다.
//   · 무료 = 10년 뒤 내가 어떤 '큰 흐름'에 들어서는지 + 그 흐름이 나와 맞는 정도(용신 부합) — 온디바이스·API 0.
//   · 유료 = 그때 '구체적으로' 무엇이 달라지는지 · 지금부터 무엇을 준비하면 좋은지(LLM).
//
// ▶ 무엇을 재사용하나(발명 아님 — 전부 READ-ONLY):
//   · lib/content/lifeGraph.ts : 대운별 '용신 부합도' 점수(0~100)를 이미 온디바이스로 산출한다.
//       여기선 그 points 를 그대로 읽어(재계산 X) '지금 대운'과 '10년 뒤 대운' 두 점만 쓴다.
//       ※ 대운 = 10년 블록(endAge = startAge+9)이라, '현재 나이 + 10'은 항상 바로 다음 대운에 든다
//          → '10년 뒤 대운' = 지금 대운의 다음 대운(current 플래그 기준 index+1).
//   · components/PossibilityGauge : 재회·애정과 공유하는 공용 게이지(애니 미터). '10년 뒤 부합도'를 0~100로.
//   ★곡선 가중치·정규화는 lifeGraph.ts 의 daniel 검수 슬롯(용신 부합 stance)을 그대로 따른다.
//   ★화면 텍스트엔 용신/대운/한자/십신 같은 전문 용어를 노출하지 않는다 = 일상어(흐름·시기·기운).
//   ★§4 전향적: 낮은 구간도 '안으로 다지는 시기'로 긍정 프레이밍하고, 구체 처방은 유료로 위임(단정 금지).
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { lifeGraph } from '../lib/content/lifeGraph';    // 결정론 대운별 용신 부합 점수 — 재사용만(재계산 X)
import { PossibilityGauge } from './PossibilityGauge';     // 공용 가능성 게이지(재회·애정 공유)
import type { GaugeTone } from '../lib/love/inyeonGauge';  // 'open' | 'warming' | 'quiet'
import { colors, radius, space, font } from '../lib/theme';

// 정규화 점수(0~100) → 흐름 라벨(일상어). LifeGraphTeaser 의 상대높이 라벨과 같은 결(상승/고름/다지기).
function flowLabel(score: number): string {
  if (score >= 66) return '기운이 차오르는 흐름';
  if (score >= 34) return '고르게 무르익는 흐름';
  return '안으로 다지는 흐름';
}

// 점수 → 게이지 톤·경향 라벨(§4 경향·단정 금지). 경계(66/34)는 재회/애정 게이지와 동일 결.
function toneOf(score: number): { tone: GaugeTone; label: string } {
  if (score >= 66) return { tone: 'open', label: '상승세' };
  if (score >= 34) return { tone: 'warming', label: '무르익음' };
  return { tone: 'quiet', label: '다지는 시기' };
}

/**
 * '10년 뒤 나의 모습'(future10) 무료 온디바이스 티저.
 *   future10.tsx(SpecialContentScreen)의 freeHook 으로 주입 — 히어로 아래·잠김/열림 무관 항상 노출.
 * @param saju 대표 명식의 사주(원국 + 대운 + structure.usefulGod). computeChart 산출값(+timeUnknown 병합).
 */
export function Future10Teaser({ saju }: { saju: SajuChart }) {
  // 모든 결정론 값은 saju 변경 시에만 1회 산출(성능·단일 소스). 게이지 카운트업 리렌더와 분리.
  const d = useMemo(() => {
    // ── 대운별 용신 부합 점수(재사용) — lifeGraph 가 이미 온디바이스로 산출 ──
    const pts = lifeGraph(saju).points;
    if (pts.length < 2) return null; // 대운 정보 부족(아주 드묾) — 티저 생략(LifeGraphTeaser 동일 가드 결)

    // 지금 대운 = current 플래그(못 찾으면 첫 대운 폴백). 10년 뒤 대운 = 그 다음 대운(대운=10년 블록이라
    //   현재 나이+10 은 항상 다음 블록). 이미 마지막 대운이면 더 갈 곳이 없어 그대로(안전 클램프).
    const curIdx = Math.max(0, pts.findIndex((p) => p.current));
    const futIdx = Math.min(curIdx + 1, pts.length - 1);
    const cur = pts[curIdx];
    const fut = pts[futIdx];

    // 게이지 = '10년 뒤' 대운의 용신 부합(그 점의 정규화 점수 그대로 — 아래 유료 곡선과 일치).
    const gauge = toneOf(fut.score);

    // 지금 vs 10년 뒤 '기운 방향'(전향적) — 부합 점수 변화로 오름/유지/다지기. 낮아짐도 준비기로 긍정 프레이밍(§4).
    const delta = fut.score - cur.score;
    const dirLine =
      delta >= 12 ? '지금보다 나에게 힘이 되는 기운이 더 크게 들어오는 방향이에요.'
      : delta <= -12 ? '지금의 무르익은 기운을 안으로 다지며 실속을 챙기는 방향이에요.'
      : '지금의 좋은 결이 10년 뒤에도 고르게 이어지는 흐름이에요.';

    // 게이지 아래 한 줄(전향적·처방 동반). 톤별로 '지금 무엇을 해두면 좋은지'를 부드럽게 — 구체는 유료.
    const caption =
      gauge.tone === 'open' ? '10년 뒤엔 나에게 힘이 되는 기운이 크게 들어오는 흐름이에요. 지금부터 방향을 잡아두면 그때 활짝 펴기 좋아요.'
      : gauge.tone === 'warming' ? '10년 뒤엔 흐름이 서서히 무르익어요. 지금 씨앗을 심어두면 그때 결실로 이어지기 좋아요.'
      : '10년 뒤엔 안으로 힘을 다지는 시기예요. 무리하기보다 기초를 탄탄히 해두면 그다음이 든든해져요.';

    return {
      cur, fut, gauge, caption, dirLine,
      curLabel: flowLabel(cur.score),
      futLabel: flowLabel(fut.score),
    };
  }, [saju]);

  if (!d) return null;

  return (
    <View style={styles.wrap}>
      {/* 리드(일상어) — 무엇을 보여주는지 + 유도 */}
      <Text style={styles.lead}>10년 뒤 당신이 어떤 흐름에 들어서는지</Text>
      <Text style={styles.leadSub}>지금과 무엇이 달라지는지, 큰 흐름을 미리 그려 봤어요. 그때의 자세한 이야기는 아래에서 열 수 있어요.</Text>

      {/* ① 지금 → 10년 뒤 진행 — 두 시기의 '결'을 화살표로(10년 뒤 쪽 강조) */}
      <View style={styles.card}>
        <View style={styles.progRow}>
          <View style={styles.progCol}>
            <Text style={styles.progWhen}>지금</Text>
            <Text style={styles.progAge}>{d.cur.startAge}~{d.cur.endAge}세</Text>
            <Text style={styles.progLabel}>{d.curLabel}</Text>
          </View>
          <Text style={styles.progArrow}>→</Text>
          <View style={styles.progCol}>
            <Text style={[styles.progWhen, styles.progWhenFut]}>10년 뒤</Text>
            <Text style={styles.progAge}>{d.fut.startAge}~{d.fut.endAge}세</Text>
            <Text style={[styles.progLabel, styles.progLabelFut]}>{d.futLabel}</Text>
          </View>
        </View>
      </View>

      {/* ② 10년 뒤 부합 게이지(공용 애니 미터·골드 기본) — 그 흐름이 나와 맞는 정도 0~100 */}
      <PossibilityGauge score={d.fut.score} label={d.gauge.label} tone={d.gauge.tone} title="10년 뒤, 기운이 나와 맞는 정도" caption={d.caption} />

      {/* ③ 방향 하이라이트(전향적) — 지금 대비 10년 뒤 기운 방향 + 준비 넛지 */}
      <View style={styles.card}>
        <Text style={styles.hlLine}>{d.dirLine}</Text>
        <Text style={styles.hlLineSoft}>큰 방향을 지금 잡아둘수록 10년 뒤가 한결 수월해져요.</Text>
      </View>

      {/* ── 무료 vs 유료 가치 명시(퍼널 훅) — 바로 아래 게이트(₩4,900 CTA)로 이어진다 ── */}
      <View style={styles.funnelCard}>
        <Text style={styles.funnelLine}>무료로는 <Text style={styles.accent}>10년 뒤 큰 흐름과 나와 맞는 정도</Text>를 볼 수 있어요.</Text>
        <Text style={styles.funnelLine}>깊은 풀이에선 <Text style={styles.accent}>그때 무엇이 구체적으로 달라지는지, 지금부터 무엇을 준비하면 좋은지</Text>까지 짚어 드려요.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(4) },
  // 리드(LifeGraphTeaser 와 동일 결)
  lead: { ...font.body, fontWeight: '800', color: colors.ju, fontSize: 16, marginBottom: space(1.5) },
  leadSub: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(3), fontSize: 12 },
  // 공통 카드(sunk 배경 — ReunionRich/LifeGraphTeaser 결)
  card: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(3) },
  // ── 지금 → 10년 뒤 진행 ──
  progRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progCol: { flex: 1, alignItems: 'center' },
  progWhen: { ...font.caption, color: colors.inkFaint, fontSize: 11, fontWeight: '700', marginBottom: space(1) },
  progWhenFut: { color: colors.ju },
  progAge: { ...font.body, color: colors.ink, fontSize: 15, fontWeight: '900', marginBottom: space(1) },
  progLabel: { ...font.caption, color: colors.inkSoft, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  progLabelFut: { color: colors.ju, fontWeight: '800' },
  progArrow: { color: colors.ju, fontSize: 20, fontWeight: '900', paddingHorizontal: space(2) },
  // ── 방향 하이라이트 ──
  hlLine: { ...font.body, color: colors.ink, fontSize: 14, fontWeight: '700', lineHeight: 21 },
  hlLineSoft: { ...font.caption, color: colors.inkSoft, fontSize: 12.5, lineHeight: 18, marginTop: space(1.5) },
  // ── 퍼널 가치 명시 ──
  funnelCard: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4) },
  funnelLine: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(1), fontSize: 12 },
  accent: { color: colors.ju, fontWeight: '800' },
});
