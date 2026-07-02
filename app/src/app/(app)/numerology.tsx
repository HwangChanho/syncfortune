// src/app/(app)/numerology.tsx — 수비학(피타고리안) · 무료 · 온디바이스
// ─────────────────────────────────────────────────────────────────────────
// daniel: API 비용 안 드는 표준 의미는 무료로. 수비학 숫자 의미는 피타고리안 표준(고정)이라
//   온디바이스 템플릿으로 충분(사주처럼 nuance 통변 불필요) → Edge 호출 없이 무료 산출.
//   생년월일 → 생명수·생일수·개인해 수(numerology.ts) + 표준 의미(LIFE_PATH/BIRTHDAY/PERSONAL_YEAR_MEANING).
//   ⚠️ 의미 문구 tone = daniel★ 검수 슬롯(numerology.ts 주석 참고).
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { loadRepChart, type SavedChart } from '../../lib/engine/myChart';
import { buildNumerology, LIFE_PATH_MEANING, BIRTHDAY_MEANING, PERSONAL_YEAR_MEANING, meaningFor } from '../../lib/content/numerology';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { ContentHero } from '../../components/SpecialContentScreen';
import { ChartPicker } from '../../components/ChartPicker';
import { ShareReadingButton } from '../../components/ShareReadingButton';
import { Reveal } from '../../components/Reveal'; // 카드 순차 등장(daniel 재미)

export default function NumerologyScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const [rep, setRep] = useState<SavedChart | null>(null);

  // 대표 명식 로드(포커스마다 — 명식 전환 반영)
  useFocusEffect(useCallback(() => {
    let alive = true;
    loadRepChart().then((c) => { if (alive) setRep(c); });
    return () => { alive = false; };
  }, []));

  // 생년월일 → 피타고리안 수(이름 기반 3수는 로마자 필요 — v1은 날짜 기반 무료)
  const n = useMemo(() => {
    if (!rep) return null;
    const [dp] = (rep.input.birthDateTime ?? '').split(' ');
    const [y, mo, d] = dp.split('-').map(Number);
    if (!y || !mo || !d) return null;
    return buildNumerology({ year: y, month: mo, day: d });
  }, [rep]);

  const lp = n ? meaningFor(LIFE_PATH_MEANING, n.lifePath) : null;
  const bd = n ? meaningFor(BIRTHDAY_MEANING, n.birthday) : null;
  const py = n ? meaningFor(PERSONAL_YEAR_MEANING, n.personalYear) : null;
  const thisYear = new Date().getFullYear();

  return (
    <View style={styles.bg}>
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        {/* 상단 명식 헤더 — 현재 명식 표시·전환 */}
        <ChartPicker onChange={() => loadRepChart().then(setRep)} />
        <ContentHero image={require('../../../assets/icons/numerology.jpg')} title={t('numerology.title', '수비학')} sub={t('numerology.sub', '생년월일에 담긴 수로 보는 인생 방향·재능·올해 흐름')} />

        {!n ? (
          <Text style={styles.note}>{t('numerology.empty', '명식을 등록하면 생년월일로 수비학을 보여드려요.')}</Text>
        ) : (
          <>
            <Reveal delay={0}><NumCard hi label={t('numerology.lifePath', '생명수 — 인생의 큰 줄기')} big={n.lifePath} kw={lp!.keyword} text={lp!.text} fs={fs} /></Reveal>
            <Reveal delay={110}><NumCard label={t('numerology.birthday', '생일수 — 타고난 재능')} big={n.birthday} kw={bd!.keyword} text={bd!.text} fs={fs} /></Reveal>
            <Reveal delay={220}><NumCard label={`${thisYear} · ${t('numerology.personalYear', '개인해 — 올해 흐름')}`} big={n.personalYear} kw={py!.keyword} text={py!.text} fs={fs} /></Reveal>
            {n.masterNumbers.length > 0 && (
              <Text style={styles.master}>{t('numerology.master', '✦ 마스터수(11·22·33) 보유 — 잠재력이 큰 대신 다루기 까다로운 수예요.')}</Text>
            )}
            {/* 결과 공유(앱게이트) */}
            <ShareReadingButton kind="numerology" title="수비학" content={{ lifePath: n.lifePath, keyword: lp!.keyword, summary: lp!.text }} />
          </>
        )}
        <Text style={styles.note}>{t('numerology.note', '※ 피타고리안 수비학(서양 표준)으로 산출했어요. 이름 기반 수(표현·영혼수)는 추후 추가됩니다.')}</Text>
      </ScrollView>
    </View>
  );
}

/** 수 카드 — 큰 숫자 + 키워드 + 설명. hi=생명수(강조). */
function NumCard({ label, big, kw, text, fs, hi }: { label: string; big: number; kw: string; text: string; fs: (n: number) => number; hi?: boolean }) {
  // 큰 숫자 카운트업(0→big) — 수비학 고유 재미(daniel ②콘텐츠별 메타포). 리스너로 정수 갱신(JS 스레드, useNativeDriver 불가).
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    const v = new Animated.Value(0);
    const id = v.addListener(({ value }) => setDisp(Math.round(value)));
    Animated.timing(v, { toValue: big, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [big]);
  return (
    <View style={[styles.card, hi && styles.cardHi]}>
      <Text style={styles.cardLabel}>{label}</Text>
      <View style={styles.cardRow}>
        <Text style={[styles.bigNum, hi && { color: colors.ju, borderColor: colors.ju }]}>{disp}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kw, { fontSize: fs(16) }]}>{kw}</Text>
          <Text style={[styles.text, { fontSize: fs(14), lineHeight: fs(21) }]}>{text}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' }, // 전역 ContentBackdrop 이 비쳐 보이게(daniel 07-02)
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  cardHi: { borderWidth: 1.5, borderColor: colors.ju },
  cardLabel: { ...font.caption, color: colors.inkFaint, marginBottom: space(3), fontWeight: '700' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
  bigNum: { fontSize: 48, fontWeight: '900', color: colors.ink, width: 72, textAlign: 'center', borderWidth: 2, borderColor: colors.juLine, borderRadius: radius.md, paddingVertical: space(1) },
  kw: { fontWeight: '800', color: colors.ink, marginBottom: space(1) },
  text: { ...font.body, color: colors.inkSoft },
  master: { ...font.caption, color: colors.ju, textAlign: 'center', marginTop: space(1), marginBottom: space(2), fontWeight: '700' },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4), lineHeight: 18 },
});
