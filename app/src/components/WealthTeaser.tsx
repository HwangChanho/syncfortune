// app/src/components/WealthTeaser.tsx — '재물 딥리포트' 무료 온디바이스 티저(결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 프리미엄 퍼널(jobfit/career 티저와 같은 결): 유료 LLM 딥리포트(kind='wealth') '위'에
//   결정론 무료 '재물 밑그림'을 먼저 보여줘 자연스러운 유료 전환을 만든다. supabase/Edge 절대 호출 안 함.
//
// ▶ 신호 소스 = wealthGauge.computeWealthSignals(saju) — 정재/편재/식상 활성으로 '재물 결 방향'만(soft).
//   ★그릇 등급·감당·유입 시기·처방은 여기서 안 보여준다(그건 유료 L1 wealthReport). 드리프트 방지.
// ▶ 담는 무료 요소(전부 결정론, 한자·십신 용어 화면 노출 금지 = 일상어):
//   ① 재물 성향(안정형/확장형/혼재/그릇형성) — wealthGauge tilt.
//   ② 버는 힘(직접 만드는 힘 vs 굴리고 운용하는 힘) — 식상생재 통로 유무.
//   ③ funnel: 무료=재물 밑그림 / 유료=그릇 크기·유입 시기·지키는 법.
// ▶ §4 안전(가드5 재물): 어느 결도 '더 낫다'·부자/가난 단정 아님 — 강점 프레이밍(전향적).
//   ※ 일상어 매핑은 표현 계층 → daniel 카피 조정 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';
import { computeWealthSignals, type WealthTilt } from '../lib/content/wealthGauge';

// 재물 성향(tilt) → 화면 라벨/설명(일상어·전부 '강점'으로 전향 프레이밍 §4·daniel 검수 슬롯).
const TILT_LABEL: Record<WealthTilt, string> = {
  stable: '차곡차곡 모으고 지키는 결',
  expansive: '크게 벌이고 굴리는 결',
  mixed: '모으는 결과 굴리는 결을 겸비',
  weak: '그릇부터 키우면 재물이 따라오는 결',
};
const TILT_SUB: Record<WealthTilt, string> = {
  stable: '한 걸음씩 쌓아 안정적으로 불리는 힘이 있어요.',
  expansive: '기회를 보면 과감히 움직여 판을 키우는 힘이 있어요.',
  mixed: '지킬 땐 지키고 벌일 땐 벌이는 균형 감각이 있어요.',
  weak: '지금은 버는 것보다 실력·바탕을 쌓을수록 재물이 붙는 때예요.',
};

/**
 * '재물 딥리포트' 무료 티저 — SpecialContentScreen freeHook 로 히어로 아래·항상 노출.
 * @param saju 대표 명식 사주(원국 + timeUnknown 병합). computeWealthSignals 로 재물 결 방향 산출.
 */
export function WealthTeaser({ saju }: { saju: SajuChart & { timeUnknown?: boolean } }) {
  const d = useMemo(() => computeWealthSignals(saju), [saju]);

  if (!saju?.pillars) return null; // 방어 — 명식 없으면 티저 생략

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>타고난 재물 밑그림을 무료로 짚어 봤어요</Text>
      <Text style={styles.leadSub}>재물 그릇 크기·언제 크게 들어오는지·지키는 법은 아래에서 열 수 있어요.</Text>

      <View style={styles.card}>
        {/* ① 재물 성향(방향 tilt) */}
        <View style={styles.itemRow}>
          <Text style={styles.itemCap}>재물 성향</Text>
          <View style={styles.itemBody}>
            <Text style={styles.itemMain}>{TILT_LABEL[d.tilt]}</Text>
            <Text style={styles.itemSub}>{TILT_SUB[d.tilt]}</Text>
          </View>
        </View>

        {/* ② 버는 힘(식상생재 통로 유무) */}
        <View style={[styles.itemRow, styles.itemRowBorder]}>
          <Text style={styles.itemCap}>버는 힘</Text>
          <View style={styles.itemBody}>
            <Text style={styles.itemMain}>{d.makeForce ? '직접 만들어 파는 힘' : '자원을 굴리고 운용하는 힘'}</Text>
            <Text style={styles.itemSub}>
              {d.makeForce
                ? '아이디어·결과물을 만들어 그걸로 버는 통로가 열려 있어요.'
                : '이미 있는 자원·기회를 굴리고 운용해 버는 결이에요.'}
            </Text>
          </View>
        </View>
      </View>

      {/* ③ funnel — 무료/유료 경계 명시(전향적) */}
      <Text style={styles.funnel}>
        지금은 <Text style={styles.funnelFree}>재물 밑그림</Text> 미리보기예요 · 전체 풀이에선 <Text style={styles.funnelPaid}>재물 그릇 크기</Text>, 언제 크게 들어오는지, 새지 않게 지키는 법까지 짚어 드려요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(4) },
  lead: { ...font.heading, color: colors.ink, textAlign: 'center' },
  leadSub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(1), marginBottom: space(3) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4) },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  itemRowBorder: { marginTop: space(3), paddingTop: space(3), borderTopWidth: 1, borderTopColor: colors.line },
  itemCap: { ...font.caption, color: colors.inkSoft, width: 56, marginTop: 2 },
  itemBody: { flex: 1 },
  itemMain: { ...font.heading, color: colors.ju, fontWeight: '800' },
  itemSub: { ...font.caption, color: colors.inkSoft, marginTop: space(1), lineHeight: 18 },
  funnel: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginTop: space(3), textAlign: 'center' },
  funnelFree: { color: colors.ink, fontWeight: '700' },
  funnelPaid: { color: colors.ju, fontWeight: '700' },
});
