// app/src/components/TalentTeaser.tsx — '나의 타고난 재능' 무료 온디바이스 티저(결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 프리미엄 퍼널: 유료 재능 딥리포트 '위'에 결정론 무료 '지배 오행 재능 결'을 먼저 보여줘 전환 유도.
//   신호 = 팔자 8글자 오행 분포의 최강 오행(온디바이스·ElementBalance 와 동일 산법). Edge/Supabase 호출 0.
// EL_TALENT 매핑(오행→재능 일상어)은 daniel 검수 확정본(2026-07-16) — lib/content/elementPhrases.ts에서
//   가져온다(홈 카드 티저와 단일 출처 — 상세 검수 코멘트는 그 파일 참조).
//   §4 안전(가드4): 강점 프레이밍(전향적)·우열 아님·단정 금지.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { elementColor } from '../lib/engine/ohaeng';
import { EL_TALENT, dominantElement } from '../lib/content/elementPhrases';
import { colors, radius, space, font } from '../lib/theme';

const EL_KO: Record<string, string> = { 木: '나무', 火: '불', 土: '흙', 金: '쇠', 水: '물' };

/** 타고난 재능 무료 티저 — SpecialContentScreen freeHook. 최강 오행 → 재능 결(결정론). */
export function TalentTeaser({ saju }: { saju: SajuChart & { timeUnknown?: boolean } }) {
  const dom = useMemo(() => dominantElement(saju), [saju]);

  // dom=null → 동률이거나 산출 불가(daniel 2026-07-16: "강한 기운은 글자 수로 보는 게 아니야" → 카운트로 못 정하면 표시 안 함).
  //   틀린 최강 오행을 보여주느니 티저를 생략한다. 통근 기반 재설계는 daniel 스탠스 대기(노션 Q107).
  if (!saju?.pillars || !dom) return null;
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
