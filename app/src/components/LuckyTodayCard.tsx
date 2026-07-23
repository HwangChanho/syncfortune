// app/src/components/LuckyTodayCard.tsx — 홈 블록: 오늘의 행운(색·방향·숫자·아이템)
// ─────────────────────────────────────────────────────────────────────────
// 2026-07-22 코드 큐. 홈 "지금 내 상태·오늘 중심" 리텐션 블록.
//   오늘 일진(日辰) 천간 오행 → 행운 색·방향·숫자·아이템(lib/content/luckyItem 재사용).
//   ★새 엔진·새 명리 판정 없음 — 이미 전체 화면(/luck)이 쓰는 luckyToday()/weakElementColor() 그대로.
//     홈엔 '오늘 요약'만 얹고, 탭하면 전체 화면(/luck)으로. 온디바이스·결정론·API 0(무료 티어 원칙 §9-5).
//
// 패턴 정합(BiorhythmCard·TodayRelationCard·PersonaTypeHero 와 동일):
//   · 자기완결형 — 스스로 대표 명식(rep chart)을 로드한다.
//   · reloadKey — 대표 명식 전환/홈 포커스 시 홈이 올려 재산출.
//   · 명식 없으면 렌더하지 않는다(return null) — 홈이 안내문으로 도배되지 않게(다른 블록과 동일 원칙).
//     ※ luckyToday()는 명식이 없어도 계산되지만, ①홈은 '내 상태' 화면이고 ②부족 오행 보완색이 개인화 포인트라
//       다른 홈 블록과 같은 '명식 게이트'를 따른다(명식 미등록 사용자는 상단 '명식 등록' 안내를 이미 본다).
//
// ⚠️상징 매핑(오행→색·방위·수리·소품)은 luckyItem.ts 의 전통 오행 상징(통설) — daniel 검수 슬롯.
// ⚠️문구(kicker·'자세히'·보완색 설명)는 Claude Code 초안 = ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from './PressableScale';
import { loadRepChart } from '../lib/engine/myChart';
import { computeChart } from '../lib/engine/engine'; // canonical 빌더 단일화(daniel 07-23·drift 방지)
import { luckyToday, weakElementColor } from '../lib/content/luckyItem';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';

/**
 * 홈 블록: 오늘의 행운.
 * @param reloadKey 대표 명식 전환/포커스 시 홈이 올려 재산출(다른 홈 블록과 동일 계약).
 */
export function LuckyTodayCard({ reloadKey }: { reloadKey?: number }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale();
  // 오늘의 행운(색·방향·숫자·아이템) — 명식 불필요·오늘 일진 기준. 하루 동안 고정이라 마운트당 1회 계산.
  const lucky = useMemo(() => luckyToday(), []);
  // 내게 보탬이 되는 색(부족 오행 보완) — 명식 있을 때만. 명식 유무 게이트도 이 값으로 판정.
  const [weak, setWeak] = useState<{ elemLabel: string; hex: string; color: string } | null>(null);
  const [hasChart, setHasChart] = useState<boolean | null>(null); // null=로딩(첫 프레임 미노출)

  useEffect(() => {
    let alive = true;
    (async () => {
      const rep = await loadRepChart();
      if (!alive) return;
      setHasChart(!!rep);
      // computeChart(rep.input).saju = index.tsx 등과 동일한 canonical 명식 산출 경로(빌더 통일·daniel 07-23). pillars 로 부족 오행 계산.
      setWeak(rep ? weakElementColor(computeChart(rep.input).saju) : null);
    })().catch(() => { if (alive) { setHasChart(false); setWeak(null); } });
    return () => { alive = false; };
  }, [reloadKey]);

  // 명식 없음/로딩 중 = 미노출(다른 홈 블록과 동일 원칙).
  if (!hasChart) return null;

  return (
    <PressableScale style={styles.card} onPress={() => router.push('/luck')}>
      {/* 헤더 — 좌: 오늘의 행운(전체 화면과 동일 타이틀 키), 우: 자세히 진입(chevron만 = 다국어 중립) */}
      <View style={styles.head}>
        <Text style={styles.kicker}>{t('luck.title', '오늘의 행운')}</Text>
        <Text style={styles.more}>›</Text>
      </View>
      <Text style={[styles.sub, { fontSize: fs(12) }]}>
        {lucky.date} · {t('luck.todayEnergy', '오늘의 기운')} {lucky.elemLabel}
      </Text>

      {/* 대표 행운 색 스와치 + 색 이름 */}
      <View style={styles.swatchRow}>
        <View style={[styles.swatch, { backgroundColor: lucky.hex }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.swatchLabel}>{t('luck.color', '행운의 색')}</Text>
          <Text style={[styles.swatchValue, { fontSize: fs(17) }]} numberOfLines={1}>{lucky.color}</Text>
        </View>
        {/* 행운의 숫자 — 원형 배지(전체 화면과 동일 색 강조) */}
        <View style={styles.numWrap}>
          {lucky.nums.map((n) => (
            <View key={n} style={[styles.numBadge, { borderColor: lucky.hex }]}>
              <Text style={[styles.numTx, { color: lucky.hex, fontSize: fs(13) }]}>{n}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 방향 · 아이템 — 한 줄 요약(전체는 /luck) */}
      <View style={styles.metaRow}>
        <Text style={[styles.metaTx, { fontSize: fs(12.5) }]} numberOfLines={1}>
          <Text style={styles.metaLabel}>{t('luck.direction', '행운의 방향')}</Text>  {lucky.dir}
        </Text>
        <Text style={[styles.metaTx, { fontSize: fs(12.5), flexShrink: 1 }]} numberOfLines={1}>
          <Text style={styles.metaLabel}>{t('luck.item', '행운의 아이템')}</Text>  {lucky.item}
        </Text>
      </View>

      {/* 명식 개인화 — 내게 부족하기 쉬운 기운 보완색(상시). weakElementColor 재사용. */}
      {weak && (
        <View style={styles.weakRow}>
          <View style={[styles.weakDot, { backgroundColor: weak.hex }]} />
          <Text style={[styles.weakTx, { fontSize: fs(12) }]} numberOfLines={2}>
            <Text style={{ fontWeight: '800', color: colors.ju }}>{t('luck.weakHead', '내게 보탬이 되는 색')}</Text>
            {'  '}{weak.color}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // TodayRelationCard·BiorhythmCard 와 동일한 카드 셸(홈 톤 통일)
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), marginBottom: space(4), ...shadow.card },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.4 },
  more: { ...font.caption, color: colors.ju, fontWeight: '800' },
  sub: { ...font.caption, color: colors.inkFaint, marginTop: space(1) },
  // 스와치 행 — 색 네모 + 색 이름 + 숫자 배지
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(3) },
  swatch: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  swatchLabel: { ...font.caption, color: colors.inkSoft },
  swatchValue: { fontWeight: '900', color: colors.ink, marginTop: 1 },
  numWrap: { flexDirection: 'row', gap: space(1.5) },
  numBadge: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  numTx: { fontWeight: '900' },
  // 방향·아이템 한 줄
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(3), flexWrap: 'wrap' },
  metaTx: { ...font.caption, color: colors.ink },
  metaLabel: { color: colors.inkSoft, fontWeight: '700' },
  // 보완색(개인화)
  weakRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(3), paddingTop: space(2.5), borderTopWidth: 1, borderTopColor: colors.line },
  weakDot: { width: 14, height: 14, borderRadius: 7 },
  weakTx: { ...font.caption, color: colors.ink, flex: 1, lineHeight: 17 },
});
