// app/src/components/InyeonYieojimCard.tsx — 애정 '이어짐' 카드(스펙 §8·결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 07-22 관법(ground truth): 짝사랑/대시가 실제 '이어질/성사될지'를 세운별로 판정.
//   엔진 = inyeonYieojim(spouseDual). ★공통 게이트=배우자궁(일지) 세운 합. 남/여 비대칭(남 식상生財/여 재성통관).
// ▶ love.tsx 무료 섹션(SpouseDualCards 옆). 화면 텍스트 일상어(한자·명리 용어 금지)·§4 경향 톤(단정 금지).
// ⚠️문구=daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SajuChart } from '@spec/chart';
import { inyeonYieojim } from '../lib/love/spouseDual';
import { colors, radius, space, font, shadow } from '../lib/theme';

const thisYear = (): number => new Date().getFullYear();
const yrs = (list: number[]): string => list.map((y) => `${y}년`).join(' · ');

/**
 * 애정 '이어짐' 카드 — 세운별 짝사랑/대시 성사 시기(결정론).
 * @param accent 강조색(애정=핑크 주입).
 */
export function InyeonYieojimCard({ saju, sex, accent = colors.ju }: { saju: SajuChart; sex?: string; accent?: string }) {
  const { t } = useTranslation();
  const rows = useMemo(() => inyeonYieojim(saju, sex, thisYear(), 10), [saju, sex]);

  const mineYears = rows.filter((r) => r.mine).map((r) => r.year);        // 내가 다가가 이어짐
  const theirsYears = rows.filter((r) => r.theirs).map((r) => r.year);    // 상대가 다가와 이어짐
  const expressYears = rows.filter((r) => r.sikSang && !r.gungOpen && !r.mine).map((r) => r.year);   // 표현만(정착 약)
  const popularYears = rows.filter((r) => r.starActive && !r.theirs).map((r) => r.year);             // 인기만(정착 약)

  return (
    <View style={styles.wrap}>
      <Text style={[styles.h, { color: colors.ink }]}>{t('yieojim.title', '인연이 이어지는 시기')}</Text>
      <Text style={styles.sub}>{t('yieojim.sub', '짝사랑이든 대시든, 실제로 이어지려면 ‘인연 자리(배우자궁)’가 그때 열려 있어야 해요.')}</Text>

      {/* 💗 내가 먼저 다가가 이어지기 좋은 해 */}
      <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: accent }]}>
        <Text style={[styles.rowHead, { color: accent }]}>💗 {t('yieojim.mine', '내가 먼저 다가가 이어지기 좋은 해')}</Text>
        <Text style={styles.rowBody}>
          {mineYears.length ? yrs(mineYears) : t('yieojim.mineNone', '다음 10년엔 약해요 — 내가 먼저 표현해 다가가는 힘(식상)이 원국에 옅어, 특정 시기(그 기운이 들어올 때)에 집중돼요.')}
        </Text>
        {expressYears.length ? <Text style={styles.hint}>{t('yieojim.express', '마음은 이는데 정착까진 약한 해')}: {yrs(expressYears)}</Text> : null}
      </View>

      {/* ✨ 좋은 인연이 다가와 이어지기 좋은 해 */}
      <View style={styles.card}>
        <Text style={[styles.rowHead, { color: colors.ju }]}>✨ {t('yieojim.theirs', '좋은 인연이 다가와 이어지기 좋은 해')}</Text>
        <Text style={styles.rowBody}>
          {theirsYears.length ? yrs(theirsYears) : t('yieojim.theirsNone', '다음 10년엔 인연이 다가와 정착까지 이어지는 뚜렷한 시기가 약해요.')}
        </Text>
        {popularYears.length ? <Text style={styles.hint}>{t('yieojim.popular', '관심·인기는 오지만 정착까진 약한 해')}: {yrs(popularYears)}</Text> : null}
      </View>

      <Text style={styles.note}>{t('yieojim.note', '※ 참고 경향이에요. 실제 인연은 만나는 사람에 따라 달라져요. 어느 쪽이든 최종적으로 이어지려면 ‘인연 자리’가 열리는 해가 열쇠예요.')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(3) },
  h: { ...font.title, marginBottom: space(1) },
  sub: { ...font.caption, color: colors.inkSoft, marginBottom: space(3), lineHeight: 19 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  rowHead: { fontSize: 15, fontWeight: '800', marginBottom: space(2) },
  rowBody: { ...font.body, color: colors.ink, fontSize: 14, lineHeight: 22 },
  hint: { ...font.caption, color: colors.inkFaint, marginTop: space(2), lineHeight: 17 },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(1), marginBottom: space(2), lineHeight: 18 },
});
