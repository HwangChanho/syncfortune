// app/src/components/TalentTeaser.tsx — '나의 타고난 재능' 무료 온디바이스 티저(결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 프리미엄 퍼널: 유료 재능 딥리포트 '위'에 결정론 무료 '지배 오행 재능 결'을 먼저 보여줘 전환 유도.
//   신호 = 팔자 8글자 오행 분포의 최강 오행(온디바이스·ElementBalance 와 동일 산법). Edge/Supabase 호출 0.
// ★★daniel 검수 슬롯(§3.2 룰이 후보 생성→유저 판정): 아래 EL_TALENT 매핑(오행→재능 일상어)은 *제 후보 초안* — Boss 검수/수정.
//   §4 안전(가드4): 강점 프레이밍(전향적)·우열 아님·단정 금지.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { stemElement, branchElement, elementColor } from '../lib/engine/ohaeng';
import { colors, radius, space, font } from '../lib/theme';

// ★daniel 검수 후보 — 오행 → 재능 결(일상어). 표준 물상 기반 초안. Boss 확정 전까지 후보.
const EL_TALENT: Record<string, string> = {
  木: '기획하고 키워내는 재능',
  火: '표현하고 밝히는 재능',
  土: '중재하고 안정시키는 재능',
  金: '분석하고 매듭짓는 재능',
  水: '통찰하고 유연하게 흐르는 재능',
};
const EL_KO: Record<string, string> = { 木: '나무', 火: '불', 土: '흙', 金: '쇠', 水: '물' };

/** 타고난 재능 무료 티저 — SpecialContentScreen freeHook. 최강 오행 → 재능 결(결정론). */
export function TalentTeaser({ saju }: { saju: SajuChart & { timeUnknown?: boolean } }) {
  const dom = useMemo(() => {
    const counts: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    const p: any = saju?.pillars ?? {};
    [p.year, p.month, p.day, p.hour].forEach((pl: any) => {
      if (!pl) return; // 시주 미상이면 hour 없음 — 스킵(가능한 글자로만 산출)
      counts[stemElement(pl.stem)]++;
      counts[branchElement(pl.branch)]++;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]; // 최강 오행
  }, [saju]);

  if (!saju?.pillars) return null;
  const col = elementColor[dom] ?? colors.ju;

  return (
    <View style={styles.wrap}>
      <Text style={styles.lead}>내 안에서 가장 강한 기운의 재능</Text>
      <Text style={styles.leadSub}>먼저 무료로 짚어 봤어요. 재능을 어떻게 쓰고 키우는지는 아래에서 열려요.</Text>
      <View style={styles.card}>
        <Text style={styles.cardCap}>가장 강한 기운</Text>
        <Text style={[styles.el, { color: col }]}>{dom}<Text style={styles.elKo}> ({EL_KO[dom]})</Text></Text>
        <Text style={styles.talent}>{EL_TALENT[dom]}</Text>
      </View>
      <Text style={styles.funnel}>
        지금은 <Text style={styles.free}>가장 강한 재능</Text> 미리보기예요 · 전체 풀이에선 <Text style={styles.paid}>숨은 재능·쓰는 법·키우는 시기</Text>까지 짚어 드려요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(4) },
  lead: { ...font.heading, color: colors.ink, textAlign: 'center' },
  leadSub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(1), marginBottom: space(3) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), alignItems: 'center' },
  cardCap: { ...font.caption, color: colors.inkSoft },
  el: { ...font.display, marginTop: space(1) },
  elKo: { ...font.body, color: colors.inkSoft },
  talent: { ...font.body, color: colors.ink, marginTop: space(2), textAlign: 'center' },
  funnel: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginTop: space(3), textAlign: 'center' },
  free: { color: colors.ink, fontWeight: '700' },
  paid: { color: colors.ju, fontWeight: '700' },
});
