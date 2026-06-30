// src/app/(app)/dayPillar.tsx — 일주론 (무료·온디바이스, 60갑자 일주별 기질)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 태어난 날 간지(일주)별 특징을 섹션형으로 깊게(개요·성격·연애·직업·남/여·조언).
//   내 일주는 상단 풀상세, 60목록은 탭→아코디언. 콘텐츠=Claude Code 직통 초안=daniel 검수.
//   태그(키워드)↔본문 간격 넉넉히(daniel). 하단 면책 필수. API 0.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ImageBackground, Animated, Easing, InteractionManager } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../../lib/engine';
import { loadRepChart, listCharts, type SavedChart } from '../../lib/myChart';
import { isAdmin } from '../../lib/admin';
import { DAY_PILLAR, STRESS, dayPillarKey, compatibleIlju, type DayPillarTrait } from '../../lib/dayPillar';
import { DAY_PILLAR_LIVE } from '../../lib/dayPillarLive'; // 일주별 '어떻게 살아야 하나' 실천 4계명(별도 파일·daniel 검수 슬롯)
import { stemReading, branchReading } from '../../lib/ohaeng';
import { iljuImage } from '../../lib/dayPillarEmblem'; // 60갑자 AI 일러스트(내 일주 배경)
import { useFontScale } from '../../lib/fontScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { ContentHero } from '../../components/SpecialContentScreen'; // 이미지 히어로(보는 맛)
import { ShareReadingButton } from '../../components/ShareReadingButton'; // 이슈17: 풀이 결과 공유(앱게이트)
import { ListSkeleton } from '../../components/Skeleton'; // 로딩 중 콘텐츠 형태 스켈레톤(daniel 2026-06-28)

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

  // 대표 명식 로드 → 내 일주키 + 성별 추출(온디바이스, PII는 기기 밖으로 안 나감).
  //   ★전환 멈칫 제거(daniel): 등록 명식마다 computeChart 가 도는 무거운 루프라, 전환 애니가 끝난 뒤
  //     (InteractionManager) 실행한다. 그 사이엔 ListSkeleton 이 즉시 떠 화면이 매끄럽게 넘어간다.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
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
    });
    return () => task.cancel(); // 전환 중 이탈 시 취소
  }, []);

  // 내 일주키(한자 2글자) — 대표 명식의 일간·일지
  const myKey = useMemo(() => {
    if (!rep) return null;
    const day = computeChart(rep.input).saju.pillars['일'];
    return dayPillarKey(day?.stem, day?.branch);
  }, [rep]);

  // 이슈18: 내 일주 엠블럼 '등장' 애니 — myKey 준비되면 페이드+살짝 확대(0.92→1)로 떠오름.
  const emblemIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (myKey) { emblemIn.setValue(0); Animated.timing(emblemIn, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }
  }, [myKey, emblemIn]);

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
        {/* 어떻게 살아야 하나 — 일주별 실천 4계명(개운·처방). DAY_PILLAR_LIVE(별도 파일·daniel 검수 슬롯). */}
        {DAY_PILLAR_LIVE[k] ? (
          <View style={styles.section}>
            <Text style={styles.secLabel}>{t('dayPillar.s_live', '인생 꿀팁')}</Text>
            {DAY_PILLAR_LIVE[k].map((line, i) => (
              <View key={i} style={styles.liveRow}>
                {/* 번호(골드) + 명령형 한 문장 */}
                <Text style={[styles.liveNum, { fontSize: fs(14) }]}>{i + 1}</Text>
                <Text style={[styles.liveTx, bodyDyn]}>{line}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {/* 스트레스 해소(daniel: 일주별) — 일간 오행·일지 기질 기반 관리축 */}
        {STRESS[k] ? (
          <View style={styles.section}>
            <Text style={styles.secLabel}>{t('dayPillar.s_stress', '스트레스 해소')}</Text>
            <Text style={[styles.detailTx, bodyDyn]}>{STRESS[k]}</Text>
          </View>
        ) : null}
        {/* 잘 맞는 일주 5(daniel) — 천간합·지지합·삼합 기준, 한자 표기 */}
        <View style={styles.section}>
          <Text style={styles.secLabel}>{t('dayPillar.s_match', '잘 맞는 일주')}</Text>
          {compatibleIlju(k[0], k[1]).map((m) => (
            <View key={m.key} style={styles.matchRow}>
              <Text style={[styles.matchKey, bodyDyn]}>{label(m.key)}</Text>
              <Text style={styles.matchReason}>{m.reason}</Text>
            </View>
          ))}
        </View>
      </>
    );
  };

  if (!loaded) return <ListSkeleton />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* 헤더 타이틀 — 화면에서 직접 박아 확실하게(+다국어) */}
      <Stack.Screen options={{ headerTitle: '' }} />{/* 상단 타이틀 제거(daniel) — 히어로가 제목 표시 */}
      <ContentHero image={require('../../../assets/icons/dayPillar.jpg')} title={t('dayPillar.title')} sub={t('dayPillar.sub')} />
      {/* daniel #20: 일주론은 '태어난 날(일주)' 기준 경향 — 정확한 풀이엔 사주 전체가 필요함을 설명 상단에 명시 */}
      <Text style={{ ...font.caption, color: colors.ju, marginBottom: space(4), lineHeight: 19 }}>
        {t('dayPillar.fullChartNote', '※ 일주론은 ‘태어난 날(일주)’ 하나로 보는 큰 경향이에요. 정확한 풀이는 사주 전체(원국)를 함께 봐야 해요.')}
      </Text>

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
            {/* 내 일주 60갑자 일러스트(글자 뒤 배경 + 어두운 스크림 = 가독성). 없으면 텍스트만(daniel) */}
            {(() => { const mi = iljuImage(myKey[0], myKey[1]); return mi ? (
              <Animated.View style={{ opacity: emblemIn, transform: [{ scale: emblemIn.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
                <ImageBackground source={mi} style={styles.mineHero} imageStyle={styles.mineHeroImg} resizeMode="cover">
                  <View style={styles.mineScrim} />
                  <Text style={styles.mineKeyHero}>{label(myKey)}</Text>
                </ImageBackground>
              </Animated.View>
            ) : (
              <Text style={styles.mineKey}>{label(myKey)}</Text>
            ); })()}
            <View style={styles.kwRow}>
              {DAY_PILLAR[myKey].keywords.map((w) => (<View key={w} style={styles.kw}><Text style={styles.kwTx}>{w}</Text></View>))}
            </View>
            {/* 태그↔본문 사이 넉넉한 간격(daniel) */}
            <View style={styles.gap} />
            {renderSections(myKey, rep?.input.sex ?? sex)}
          </View>
          {/* 이슈17: 내 일주론 공유(앱게이트) */}
          <ShareReadingButton kind="dayPillar" title={`${label(myKey)} 일주론`} content={DAY_PILLAR[myKey]} />
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
  wrap: { padding: space(6), paddingBottom: space(12) }, // 콘텐츠 좌우여백 통일(daniel)
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
  mineCard: { borderColor: colors.ju, borderWidth: 1.5, backgroundColor: colors.juSoft, ...shadow.card },
  mineKey: { fontSize: 22, fontWeight: '800', color: colors.ju, marginBottom: space(3) },
  mineHero: { height: 160, borderRadius: radius.md, overflow: 'hidden', justifyContent: 'flex-end', marginBottom: space(3) }, // 60갑자 일러스트 배경
  mineHeroImg: { borderRadius: radius.md },
  mineScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,18,40,0.42)' }, // 어두운 스크림 — 글자 가독성
  mineKeyHero: { fontSize: 26, fontWeight: '800', color: colors.ju, padding: space(3), textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 6 }, // 배경 위 간지(골드+그림자)
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
  // 어떻게 살아야 하나 — 4계명 행(번호 골드 + 명령형 문장)
  liveRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space(2) },
  liveNum: { fontWeight: '800', color: colors.ju, marginRight: space(2.5), marginTop: 1, minWidth: 16 },
  liveTx: { ...font.body, color: colors.inkSoft, flex: 1 },
  matchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space(2), borderBottomWidth: 1, borderBottomColor: colors.line },
  matchKey: { fontSize: 17, fontWeight: '700', color: colors.ink },
  matchReason: { fontSize: 12, color: colors.inkSoft },
  // 면책
  disclaimer: { marginTop: space(3), padding: space(4), borderRadius: radius.md, backgroundColor: colors.juSoft, borderWidth: 1, borderColor: colors.line },
  disclaimerTx: { ...font.caption, color: colors.inkFaint, lineHeight: 19 },
});
