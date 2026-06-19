// src/app/(app)/dayPillar.tsx — 일주론 (무료·온디바이스, 60갑자 일주별 기질)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 태어난 날 간지(일주)별 특징을 섹션형으로 깊게(개요·성격·연애·직업·남/여·조언).
//   내 일주는 상단 풀상세, 60목록은 탭→아코디언. 콘텐츠=Claude Code 직통 초안=daniel 검수.
//   태그(키워드)↔본문 간격 넉넉히(daniel). 하단 면책 필수. API 0.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../../lib/engine';
import { loadRepChart, listCharts, type SavedChart } from '../../lib/myChart';
import { isAdmin } from '../../lib/admin';
import { DAY_PILLAR, STRESS, dayPillarKey, type DayPillarTrait } from '../../lib/dayPillar';
import { stemReading, branchReading } from '../../lib/ohaeng';
import { useFontScale } from '../../lib/fontScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { ContentHero } from '../../components/SpecialContentScreen'; // 이미지 히어로(보는 맛)

// 천간 순서(일간 그룹핑용) — 갑·을·…·계. 각 천간당 일주 6개(60갑자).
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

// 한자 일주키 → '신축(辛丑)' 표기
function label(key: string): string {
  return `${stemReading(key[0])}${branchReading(key[1])}(${key})`;
}

// 표시 섹션 — 공통(개요·성격·연애·직업) + 선택 성별(남/여) + 조언. field = DayPillarTrait 키.
function sectionList(sex: '남' | '여'): { tk: string; field: keyof DayPillarTrait }[] {
  return [
    { tk: 'dayPillar.s_overview', field: 'overview' },
    { tk: 'dayPillar.s_personality', field: 'personality' },
    { tk: 'dayPillar.s_love', field: 'love' },
    { tk: 'dayPillar.s_career', field: 'career' },
    sex === '남' ? { tk: 'dayPillar.s_male', field: 'male' } : { tk: 'dayPillar.s_female', field: 'female' },
    { tk: 'dayPillar.s_advice', field: 'advice' },
  ];
}

export default function DayPillarScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const [rep, setRep] = useState<SavedChart | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sex, setSex] = useState<'남' | '여'>('남');       // 보기 성별 — 대표 명식 성별로 초기화
  const [open, setOpen] = useState<Set<string>>(new Set()); // 펼쳐진 일주(아코디언)
  const [admin, setAdmin] = useState(false);                // 관리자만 60갑자 전체·남녀 토글 열람
  // 일반 유저가 볼 일주 = 등록한 명식들의 일주만(명식별 성별·라벨 포함). 관리자는 전체 60을 본다.
  const [myItems, setMyItems] = useState<{ key: string; sex: '남' | '여'; label: string }[]>([]);

  // 대표 명식 로드 → 내 일주키 + 성별 추출(온디바이스, PII는 기기 밖으로 안 나감)
  useEffect(() => {
    (async () => {
      const ch = await loadRepChart();
      setRep(ch);
      if (ch) setSex(ch.input.sex); // 내 성별로 기본 보기 설정
      isAdmin().then(setAdmin).catch(() => {}); // 관리자면 전체 60·남녀 토글 노출
      // 등록된 모든 명식의 일주 + 성별(일반 유저 목록용). 같은 일주 중복은 명식 단위로 허용(label 로 구분).
      const charts = await listCharts();
      const items = charts.map((c) => {
        const day = computeChart(c.input).saju.pillars['일'];
        const key = dayPillarKey(day?.stem, day?.branch);
        return key ? { key, sex: c.input.sex, label: c.label } : null;
      }).filter(Boolean) as { key: string; sex: '남' | '여'; label: string }[];
      setMyItems(items);
      setLoaded(true);
    })().catch(() => setLoaded(true));
  }, []);

  // 내 일주키(한자 2글자) — 대표 명식의 일간·일지
  const myKey = useMemo(() => {
    if (!rep) return null;
    const day = computeChart(rep.input).saju.pillars['일'];
    return dayPillarKey(day?.stem, day?.branch);
  }, [rep]);

  const toggle = (k: string) => setOpen((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const bodyDyn = { fontSize: fs(15), lineHeight: fs(25) };

  // 한 일주의 전체 섹션 렌더. sx = 성별 기준(관리자=토글 sex / 일반=각 명식 성별).
  const renderSections = (k: string, sx: '남' | '여' = sex) => {
    const d = DAY_PILLAR[k];
    return (
      <>
        {sectionList(sx).map((s) => (
          <View key={s.field} style={styles.section}>
            <Text style={styles.secLabel}>{t(s.tk)}</Text>
            <Text style={[styles.detailTx, bodyDyn]}>{d[s.field] as string}</Text>
          </View>
        ))}
        {/* 스트레스 해소(daniel: 일주별) — 일간 오행·일지 기질 기반 관리축 */}
        {STRESS[k] ? (
          <View style={styles.section}>
            <Text style={styles.secLabel}>{t('dayPillar.s_stress', '스트레스 해소')}</Text>
            <Text style={[styles.detailTx, bodyDyn]}>{STRESS[k]}</Text>
          </View>
        ) : null}
      </>
    );
  };

  if (!loaded) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* 헤더 타이틀 — 화면에서 직접 박아 확실하게(+다국어) */}
      <Stack.Screen options={{ title: t('dayPillar.title') }} />
      <ContentHero image={require('../../../assets/icons/dayPillar.png')} title={t('dayPillar.title')} sub={t('dayPillar.sub')} />

      {/* 남/여 보기 토글 — 관리자만(전체 열람). 일반 유저는 본인/명식 성별로 고정 표시. */}
      {admin && (
        <View style={styles.toggle}>
          {(['남', '여'] as const).map((g) => (
            <Pressable key={g} style={[styles.toggleBtn, sex === g && styles.toggleOn]} onPress={() => setSex(g)}>
              <Text style={[styles.toggleTx, sex === g && styles.toggleTxOn]}>{t(g === '남' ? 'dayPillar.male' : 'dayPillar.female')}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 내 일주 — 풀상세 강조 카드(대표 명식 있을 때) */}
      {myKey && (
        <View style={styles.mineWrap}>
          <Text style={styles.mineLabel}>{t('dayPillar.mine')}</Text>
          <View style={[styles.card, styles.mineCard]}>
            <Text style={styles.mineKey}>{label(myKey)}</Text>
            <View style={styles.kwRow}>
              {DAY_PILLAR[myKey].keywords.map((w) => (<View key={w} style={styles.kw}><Text style={styles.kwTx}>{w}</Text></View>))}
            </View>
            {/* 태그↔본문 사이 넉넉한 간격(daniel) */}
            <View style={styles.gap} />
            {renderSections(myKey, rep?.input.sex ?? sex)}
          </View>
        </View>
      )}

      {/* 일주 목록 — 관리자: 전체 60(천간별 그룹) / 일반: 등록된 명식의 일주만. 내 일주는 골드 강조. */}
      <Text style={styles.browseH}>{admin ? t('dayPillar.browseAll') : t('dayPillar.mineList')}</Text>
      {admin && <Text style={styles.browseHint}>{t('dayPillar.tapHint')}</Text>}
      {admin ? (
        STEMS.map((stem) => {
          const keys = Object.keys(DAY_PILLAR).filter((k) => k[0] === stem); // 이 천간의 일주 6개
          return (
            <View key={stem} style={styles.group}>
              <Text style={styles.groupH}>{stemReading(stem)}({stem}) {t('dayPillar.dayGroup')}</Text>
              {keys.map((k) => {
                const isOpen = open.has(k);
                return (
                  <Pressable key={k} onPress={() => toggle(k)} style={[styles.card, styles.row, k === myKey && styles.rowMineHi]}>
                    <View style={styles.rowHead}>
                      <Text style={styles.rowKey}>{label(k)}</Text>
                      <Text style={styles.chevron}>{isOpen ? '∧' : '∨'}</Text>
                    </View>
                    <View style={styles.kwRow}>
                      {DAY_PILLAR[k].keywords.map((w) => (<View key={w} style={styles.kw}><Text style={styles.kwTx}>{w}</Text></View>))}
                    </View>
                    {isOpen && (<><View style={styles.gap} />{renderSections(k, sex)}</>)}
                  </Pressable>
                );
              })}
            </View>
          );
        })
      ) : (
        // 일반 유저 — 등록된 명식들의 일주만(각 명식 성별로). 같은 일주 여러 명식은 label 로 구분.
        myItems.map((it, i) => {
          const ok = `${it.key}_${i}`; // 명식별 고유 토글 키(같은 일주 중복 대비)
          const isOpen = open.has(ok);
          return (
            <Pressable key={ok} onPress={() => toggle(ok)} style={[styles.card, styles.row, it.key === myKey && styles.rowMineHi]}>
              <View style={styles.rowHead}>
                <Text style={styles.rowKey}>{it.label} · {label(it.key)}</Text>
                <Text style={styles.chevron}>{isOpen ? '∧' : '∨'}</Text>
              </View>
              <View style={styles.kwRow}>
                {DAY_PILLAR[it.key].keywords.map((w) => (<View key={w} style={styles.kw}><Text style={styles.kwTx}>{w}</Text></View>))}
              </View>
              {isOpen && (<><View style={styles.gap} />{renderSections(it.key, it.sex)}</>)}
            </Pressable>
          );
        })
      )}
      {!admin && myItems.length === 0 && <Text style={styles.browseHint}>{t('dayPillar.noChart')}</Text>}

      {/* 면책 — 일주론은 경향일 뿐, 정확한 풀이는 원국 전체 비교 필요(daniel 필수 코멘트) */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerTx}>{t('dayPillar.disclaimer')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  h: { ...font.title, marginBottom: space(1) },
  sub: { ...font.caption, color: colors.inkSoft, marginBottom: space(4), lineHeight: 19 },
  // 남/여 토글 — pill 2분할
  toggle: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.pill, padding: space(1), marginBottom: space(5), borderWidth: 1, borderColor: colors.juLine },
  toggleBtn: { flex: 1, paddingVertical: space(2.5), borderRadius: radius.pill, alignItems: 'center' },
  toggleOn: { backgroundColor: colors.ju },
  toggleTx: { fontSize: 15, fontWeight: '700', color: colors.inkSoft },
  toggleTxOn: { color: colors.bg },
  // 내 일주 강조
  mineWrap: { marginBottom: space(6) },
  mineLabel: { fontSize: 14, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4) },
  mineCard: { borderColor: colors.ju, borderWidth: 1.5, backgroundColor: 'rgba(34,31,68,0.5)', ...shadow.card },
  mineKey: { fontSize: 22, fontWeight: '800', color: colors.ju, marginBottom: space(3) },
  browseH: { fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: space(1) },
  browseHint: { ...font.caption, color: colors.inkFaint, marginBottom: space(3) },
  group: { marginBottom: space(5) },
  groupH: { fontSize: 15, fontWeight: '800', color: colors.ju, marginBottom: space(2), opacity: 0.9 },
  // 일주 행
  row: { marginBottom: space(2) },
  rowMineHi: { borderColor: colors.ju, borderWidth: 1.5 }, // 내 일주는 목록에서도 골드 테두리
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2.5) },
  rowKey: { fontSize: 16, fontWeight: '800', color: colors.ink },
  chevron: { fontSize: 16, color: colors.inkFaint, fontWeight: '700' },
  // 키워드 칩
  kwRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5) },
  kw: { backgroundColor: 'rgba(201,161,74,0.14)', borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) },
  kwTx: { fontSize: 12, fontWeight: '700', color: colors.ju },
  // 태그↔본문 간격(daniel: 더 벌려달라)
  gap: { height: space(4) },
  // 섹션 — 라벨 + 본문
  section: { marginBottom: space(4) },
  secLabel: { fontSize: 13, fontWeight: '800', color: colors.ju, marginBottom: space(1.5), letterSpacing: 0.3 },
  detailTx: { ...font.body, color: colors.inkSoft },
  // 면책
  disclaimer: { marginTop: space(3), padding: space(4), borderRadius: radius.md, backgroundColor: 'rgba(34,31,68,0.4)', borderWidth: 1, borderColor: colors.line },
  disclaimerTx: { ...font.caption, color: colors.inkFaint, lineHeight: 19 },
});
