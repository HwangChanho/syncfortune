// app/src/components/BiorhythmCard.tsx — 홈 블록: 바이오리듬(온디바이스·사주 무관·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 07-21 코드 큐(daniel). 대표 명식의 생년월일로 3주기(신체23/감정28/지성33일) sine 곡선을 그린다.
//   PersonaTypeHero 와 동일 패턴: 자기완결형(자기 rep 차트 로드) · 명식 없으면 미노출.
// ⚠️명리 아님(순수 산술) — daniel stance 무관. 상태 라벨 문구만 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line as SvgLine, Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { loadRepChart } from '../lib/engine/myChart';
import { solarBirth, bioAt, bioSeries, bioState, type BioValues } from '../lib/content/biorhythm';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';

// 3주기 고정색(오행 팔레트에서 차용 — 火 신체 / 土 감정 / 水 지성). 오늘 값 라벨·곡선 공용.
const AXES = [
  { key: 'physical', label: '신체', color: '#E1483A' },
  { key: 'emotional', label: '감정', color: '#C79A2E' },
  { key: 'intellectual', label: '지성', color: '#3B6EC4' },
] as const;

/** 홈 블록: 바이오리듬. reloadKey = 대표 명식 전환/포커스 시 홈이 올려 재산출. */
export function BiorhythmCard({ reloadKey }: { reloadKey?: number }) {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const [birth, setBirth] = useState<Date | null>(null);
  const [today, setToday] = useState<BioValues | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      const b = ch ? solarBirth((ch.input as any)?.birthDateTime, (ch.input as any)?.calendar) : null;
      setBirth(b);
      setToday(b ? bioAt(b, new Date()) : null);
    })().catch(() => { if (alive) { setBirth(null); setToday(null); } });
    return () => { alive = false; };
  }, [reloadKey]);

  // 명식 없음/생일 파싱 실패 = 미노출(홈이 안내문으로 도배되지 않게 — PersonaTypeHero 와 동일 원칙).
  if (!birth || !today) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.kicker}>{t('bio.kicker', '바이오리듬')}</Text>
        <Text style={styles.sub}>{t('bio.sub', '오늘의 신체·감정·지성 리듬')}</Text>
      </View>

      {/* ±14일 곡선(오늘 = 중앙 세로선) */}
      <BioGraph birth={birth} />

      {/* 오늘 3값 + 상태 */}
      <View style={styles.rows}>
        {AXES.map((ax) => {
          const v = today[ax.key];
          return (
            <View key={ax.key} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: ax.color }]} />
              <Text style={[styles.rowLabel, { fontSize: fs(13) }]}>{t(`bio.${ax.key}`, ax.label)}</Text>
              <Text style={[styles.rowVal, { color: ax.color, fontSize: fs(14) }]}>{v > 0 ? `+${v}` : v}%</Text>
              <Text style={[styles.rowState, { fontSize: fs(12) }]}>{t(`bio.state.${bioState(v)}`, bioState(v))}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.note}>{t('bio.note', '※ 사주와 무관한 참고용 리듬이에요. 0 부근은 컨디션이 바뀌는 전환일.')}</Text>
    </View>
  );
}

// ── ±14일 3주기 곡선 SVG(오늘=중앙) ─────────────────────────────────────────
function BioGraph({ birth }: { birth: Date }) {
  const W = 320, H = 120, padX = 10, padTop = 8, padBottom = 8;
  const span = 14;
  const ser = bioSeries(birth, new Date(), span);
  const n = ser.offsets.length;                     // 29 (=2*14+1)
  const innerW = W - padX * 2, midY = padTop + (H - padTop - padBottom) / 2, ampY = (H - padTop - padBottom) / 2;
  const x = (i: number) => padX + (innerW * i) / (n - 1);
  const y = (v: number) => midY - (Math.max(-100, Math.min(100, v)) / 100) * ampY;
  const pathOf = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const cx = x((n - 1) / 2);                         // 오늘(offset 0) = 중앙

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* 0 기준선 */}
      <SvgLine x1={padX} y1={midY} x2={W - padX} y2={midY} stroke={colors.line} strokeWidth={1} />
      {/* 오늘 세로선 */}
      <SvgLine x1={cx} y1={padTop} x2={cx} y2={H - padBottom} stroke={colors.inkFaint} strokeWidth={1} strokeDasharray="3 3" />
      {AXES.map((ax) => (
        <Path key={ax.key} d={pathOf(ser[ax.key])} fill="none" stroke={ax.color} strokeWidth={2} strokeLinejoin="round" strokeOpacity={0.9} />
      ))}
      {/* 오늘 점 3개 */}
      {AXES.map((ax) => {
        const v = ser[ax.key][(n - 1) / 2];
        return <Circle key={ax.key} cx={cx} cy={y(v)} r={3} fill={ax.color} />;
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(4), ...shadow.card },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space(2) },
  kicker: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.4 },
  sub: { ...font.caption, color: colors.inkFaint, fontSize: 11.5 },
  rows: { marginTop: space(2), gap: space(1.5) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowLabel: { color: colors.inkSoft, fontWeight: '700', width: 40 },
  rowVal: { fontWeight: '900', width: 52 },
  rowState: { color: colors.inkFaint, fontWeight: '700' },
  note: { ...font.caption, color: colors.inkFaint, fontSize: 11, marginTop: space(2.5), lineHeight: 16 },
});
