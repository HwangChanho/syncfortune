// src/app/(app)/taegil.tsx — 택일(좋은 날 찾기) — 달력형(무료·온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 목적별 향후 90일을 *달력*으로 — 좋은 날을 색으로 강조, 날짜 탭하면 그 날 상세(점수·이유).
//   규칙5: 무료=온디바이스(lib/auspiciousDate, API 0). §4: 흉 단정 금지 — 좋은 날만 강조(낮은 날은 강조·탭 없음).
//   stance(충 회피·합 가점·목적별 십신·12운성·공망)는 lib에 표준 통설 — daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../../lib/engine/engine';
import { loadMyChart } from '../../lib/engine/myChart';
import { findAuspiciousDays, PURPOSES, purposeLabel, type Purpose, type AuspiciousDay } from '../../lib/content/auspiciousDate';
import { appLang } from '../../lib/i18n';
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { ContentHero } from '../../components/SpecialContentScreen'; // 이미지 히어로(보는 맛)
import { ChartPicker } from '../../components/ChartPicker'; // 상단 명식 헤더 — 현재 적용 명식 표시·전환
import { ShareReadingButton } from '../../components/ShareReadingButton'; // 이슈17: 풀이 결과 공유(앱게이트)
import { TTSButton } from '../../components/TTSButton'; // 풀이 음성 읽기(온디바이스 TTS·무료)
import type { ChartInput } from '@spec/chart';
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회 기록

const WEEKDAYS: Record<string, string[]> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  ja: ['日', '月', '火', '水', '木', '金', '土'],
};
const pad = (n: number) => String(n).padStart(2, '0');

// 날짜 라벨 — "6월 20일 (금)" / "Jun 20 (Fri)" / "6月20日 (金)"
function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  const full = { ko: ['일', '월', '화', '수', '목', '금', '토'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], ja: ['日', '月', '火', '水', '木', '金', '土'] };
  const l = appLang();
  const wd = (full[l as keyof typeof full] ?? full.ko)[new Date(d + 'T00:00:00').getDay()];
  if (l === 'en') return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1]} ${Number(day)} (${wd})`;
  if (l === 'ja') return `${Number(m)}月${Number(day)}日 (${wd})`;
  return `${Number(m)}월 ${Number(day)}일 (${wd})`;
}

// 한 달 그리드 — 좋은 날(상대 임계 goodT/bestT 이상)만 색 강조 + 탭. 과거·낮은 점수는 일반 숫자(§4: 흉 강조 안 함).
//   ★임계를 절대값(68/80) 대신 *목적별 점수분포 상대값*으로 — 그래야 목적을 바꾸면 다른 날이 뜬다(daniel).
function MonthGrid({ year, month, byDate, goodT, bestT, sel, onSel, todayStr }: {
  year: number; month: number; byDate: Record<string, AuspiciousDay>; goodT: number; bestT: number; sel: string | null; onSel: (d: string) => void; todayStr: string;
}) {
  const firstDow = new Date(year, month, 1).getDay();
  const dim = new Date(year, month + 1, 0).getDate();
  const wk = WEEKDAYS[appLang()] ?? WEEKDAYS.ko;
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  return (
    <View style={styles.month}>
      <Text style={styles.monthTitle}>{year}. {month + 1}</Text>
      <View style={styles.weekRow}>{wk.map((w, i) => <Text key={i} style={[styles.weekHead, i === 0 && styles.sun]}>{w}</Text>)}</View>
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={styles.cell} />;
          const date = `${year}-${pad(month + 1)}-${pad(day)}`;
          const d = byDate[date];
          const best = !!d && d.score >= bestT;
          const good = !!d && d.score >= goodT;
          const past = date < todayStr;
          const on = sel === date;
          return (
            <PressableScale key={i} style={styles.cell} onPress={() => good && onSel(date)} disabled={!good}>
              <View style={[styles.dot, best && styles.dotBest, good && !best && styles.dotGood, on && styles.dotSel]}>
                <Text style={[styles.dayNum, past && styles.dayPast, good && styles.dayGood]}>{day}</Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

export default function TaegilScreen() {
  useLogContentVisit('taegil'); // 진입 1회 방문 기록(daniel 2026-07-06)
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale(); // 본문(읽는 글) 글자 크기 전역 배율
  const [me, setMe] = useState<ChartInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [purpose, setPurpose] = useState<Purpose>('wedding');
  const [sel, setSel] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    loadMyChart().then((c) => { if (alive) { setMe(c); setLoading(false); } });
    return () => { alive = false; };
  }, []));

  // 향후 2년(730일) 전체 점수 → 날짜 맵(달력 색칠). 목적·명식 바뀌면 재계산.
  // daniel: 택일을 2년 단위로 — 730일 산출 후 24개월 달력으로 렌더.
  const byDate = useMemo(() => {
    if (!me) return {} as Record<string, AuspiciousDay>;
    const saju = computeChart(me).saju;
    const out: Record<string, AuspiciousDay> = {};
    findAuspiciousDays(saju, purpose, 730).forEach((d) => { out[d.date] = d; });
    return out;
  }, [me, purpose]);

  // ★상대 임계 — 목적별 점수 분포의 상위 %를 '좋음/아주 좋음'으로. 절대값(68/80)이면 합·왕 날만 항상 떠
  //   목적을 바꿔도 같은 날이 나오던 문제(daniel) → 목적마다 분포가 달라 다른 날이 뜬다. 바닥값(60/72)로 너무 낮은 날 방지.
  const { goodT, bestT } = useMemo(() => {
    const ss = Object.values(byDate).map((d) => d.score).filter((s) => s > 0).sort((a, b) => b - a);
    if (ss.length < 12) return { goodT: 68, bestT: 80 };
    const at = (p: number) => ss[Math.min(ss.length - 1, Math.floor(ss.length * p))];
    return { goodT: Math.max(60, at(0.16)), bestT: Math.max(72, at(0.05)) };
  }, [byDate]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const selDay = sel ? byDate[sel] : null;

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (!me) return (
    <View style={styles.center}>
      <Text style={styles.msg}>{t('compat.needChart', '먼저 명식을 등록해 주세요.')}</Text>
      <PressableScale style={styles.btn} onPress={() => router.push('/register')}>
        <Text style={styles.btnText}>{t('compat.registerMyChart', '내 명식 등록')}</Text>
      </PressableScale>
    </View>
  );

  return (
    <View style={styles.bg}>
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        {/* 상단 명식 헤더 — 현재 적용된 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단) */}
        <ChartPicker onChange={() => loadMyChart().then(setMe)} />
        <ContentHero image={require('../../../assets/icons/taegil.jpg')} title={t('taegil.title', '택일 — 좋은 날 찾기')} sub={t('taegil.sub', '하려는 일을 고르면, 앞으로 2년 달력에서 내 사주에 잘 맞는 날을 색으로 짚어 드려요.')} />

        {/* 목적 칩 — 바꾸면 선택 날 초기화 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {PURPOSES.map((p) => (
            <PressableScale key={p.key} style={[styles.chip, purpose === p.key && styles.chipOn]} onPress={() => { setPurpose(p.key); setSel(null); }}>
              <Text style={[styles.chipTx, purpose === p.key && styles.chipTxOn]}>{purposeLabel(p.key)}</Text>
            </PressableScale>
          ))}
        </ScrollView>

        {/* 범례 */}
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, styles.dotBest]} /><Text style={styles.legendTx}>{t('taegil.best', '아주 좋음')}</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, styles.dotGood]} /><Text style={styles.legendTx}>{t('taegil.good', '좋음')}</Text></View>
          <Text style={styles.legendHint}>{t('taegil.tapHint', '색칠된 날을 눌러 보세요')}</Text>
        </View>

        {/* 2년(24개월) 달력 — daniel: 2년 단위로 길일 확인 */}
        {Array.from({ length: 24 }, (_, off) => off).map((off) => {
          const base = new Date(today.getFullYear(), today.getMonth() + off, 1);
          return <MonthGrid key={off} year={base.getFullYear()} month={base.getMonth()} byDate={byDate} goodT={goodT} bestT={bestT} sel={sel} onSel={setSel} todayStr={todayStr} />;
        })}

        {/* 선택한 날 상세 */}
        {selDay && (
          <>
            <View style={styles.detailCard}>
              <View style={styles.dayHead}>
                <Text style={styles.detailDate}>{fmtDate(selDay.date)}</Text>
                <View style={[styles.badge, selDay.score >= bestT ? styles.badgeBest : styles.badgeGood]}>
                  <Text style={[styles.badgeTx, selDay.score >= bestT ? styles.badgeTxBest : styles.badgeTxGood]}>{selDay.score >= bestT ? t('taegil.best', '아주 좋음') : t('taegil.good', '좋음')}</Text>
                </View>
              </View>
              {selDay.reasons.map((r, i) => <Text key={i} style={[styles.reason, { fontSize: fs(14), lineHeight: fs(21) }]}>· {r}</Text>)}
            </View>
            {/* 풀이 음성 읽기(온디바이스 TTS·무료) — 선택한 길일의 추천 이유를 읽음(공유 카드와 동일 내용·ganzhi 등 내부값 제외) */}
            <TTSButton reading={{ date: selDay.date, score: selDay.score, reasons: selDay.reasons }} />
            {/* 이슈17: 선택한 길일 공유(앱게이트) */}
            <ShareReadingButton kind="taegil" title={`${fmtDate(selDay.date)} 택일`} content={{ date: selDay.date, score: selDay.score, reasons: selDay.reasons }} />
          </>
        )}

        <Text style={[styles.note, { fontSize: fs(12), lineHeight: fs(18) }]}>{t('taegil.note', '※ 사주에 맞춘 참고용 길일이에요. 실제 일정은 형편에 맞게 정하세요.')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' }, // 전역 ContentBackdrop 이 비쳐 보이게(daniel 07-02)
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: 'transparent' }, // 전역 ContentBackdrop 이 비쳐 보이게(daniel 07-02)
  msg: { ...font.body, color: colors.ink, textAlign: 'center', marginBottom: space(5) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  chips: { gap: space(2), paddingVertical: space(1), marginBottom: space(3) },
  chip: { paddingHorizontal: space(3.5), paddingVertical: space(2.25), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  chipTxOn: { color: colors.bg },
  // 범례
  legend: { flexDirection: 'row', alignItems: 'center', gap: space(4), marginBottom: space(3) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  legendDot: { width: 16, height: 16, borderRadius: 8 },
  legendTx: { ...font.caption, color: colors.inkSoft },
  legendHint: { ...font.caption, color: colors.inkFaint, marginLeft: 'auto' },
  // 달력
  month: { marginBottom: space(5) },
  monthTitle: { fontSize: 16, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  weekRow: { flexDirection: 'row', marginBottom: space(1) },
  weekHead: { width: `${100 / 7}%`, textAlign: 'center', ...font.caption, color: colors.inkFaint, fontWeight: '700' },
  sun: { color: '#E5749B' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dotBest: { backgroundColor: colors.ju },                       // 아주 좋음 = 골드 채움
  dotGood: { backgroundColor: 'rgba(212,165,75,0.26)' },         // 좋음 = 연한 골드
  dotSel: { borderWidth: 2, borderColor: colors.ink },           // 선택 = 테두리
  dayNum: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  dayPast: { color: colors.inkFaint, opacity: 0.5 },             // 과거 = 흐림
  dayGood: { color: colors.ink, fontWeight: '800' },             // 좋은 날 = 진하게
  // 선택 상세
  detailCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, padding: space(4.5), marginBottom: space(3), ...shadow.card },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2) },
  detailDate: { fontSize: 16, fontWeight: '800', color: colors.ink },
  badge: { borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) },
  badgeBest: { backgroundColor: colors.ju },
  badgeGood: { backgroundColor: 'rgba(212,165,75,0.22)' },
  badgeTx: { fontSize: 11.5, fontWeight: '900' },
  badgeTxBest: { color: colors.bg },
  badgeTxGood: { color: colors.ju },
  reason: { ...font.body, color: colors.inkSoft, marginTop: space(1), lineHeight: 21, fontSize: 14 },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4), lineHeight: 18 },
});
