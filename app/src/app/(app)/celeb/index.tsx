// src/app/(app)/celeb/index.tsx — '세계를 움직이는 사람들' 그리드 + 무료 닮은꼴 티저 (결정론 v2)
// ─────────────────────────────────────────────────────────────────────────
// 유명인(공개 생년월일) 목록 → 탭하면 /celeb/[id] 결정론 상세(나와의 사주 유사도).
// Edge LLM 호출 없음 — 온디바이스·API 0. 유료 게이트/가격/LLM 은 이 화면에서 건드리지 않음(불변).
//
// ★무료 훅(daniel): 화면 상단에 "나와 가장 닮은 인물 1명 + 유사도%" 를 무료로 공개(온디바이스 결정론).
//   → 전체 순위(16인 전원 랭킹)와 각 인물의 자세한 풀이(성향·공통점·배울 점)는 유료로 유도(퍼널).
//   재회(FreeFunnel/ReunionRich) 톤을 미러링: 미드나잇-골드·일상어·단정 금지(§4 재미·추정 프레임).
//   ⚠️ 그리드는 DB 순서 그대로 유지(정렬 X) — 상위 1인만 노출해 '전체 순위'의 유료 가치를 보존한다.
// ⚠️ 재미·추정 콘텐츠. 투자/정치 단정 절대 금지. 명예 존중.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ImageBackground } from 'react-native';
import { PressableScale } from '../../../components/PressableScale';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CELEB_DB } from '../../../lib/content/celebData';                 // 결정론 DB (celebData.ts)
import { computeChart } from '../../../lib/engine/engine';                  // 만세력 결정론 산출(엔진) — API 0
import { loadRepChart } from '../../../lib/engine/myChart';                 // 대표 명식(온디바이스, 로그인 불필요) — ReunionRich 와 동일 결
import { rankCelebs, matchGrade, type CelebMatchResult } from '../../../lib/content/celebMatch'; // 유사도 랭킹·등급(재사용, 재계산 금지)
import { bgSource, colors, radius, space, shadow, font } from '../../../lib/theme';
import type { ChartInput } from '@spec/chart';

// ── 오행 → 일상어 '기질' 한 마디 (한자·용어 노출 없이) ─────────────────────
//   출처: 오행 표준 대응(myeongriGlossary 와 동일 결 — 木 성장 / 火 표현 / 土 포용 / 金 결단 / 水 지혜).
//   ★daniel 검수 슬롯: 문구·톤 조정. 화면엔 이 '일상어'만 노출(오행 한자는 매핑 키로만 쓰고 렌더 안 함).
const ELEM_PLAIN: Record<string, string> = {
  木: '새로 벌이고 키워 가는',
  火: '밝게 드러내고 열정을 내는',
  土: '품고 안정시키는',
  金: '분명하게 맺고 결단하는',
  水: '유연하게 흐르며 지혜로운',
};

/**
 * 닮은 점을 '일상어' 한 문장으로 (한자·용어 노출 금지·재미 톤·단정 회피).
 * celebMatch 의 reasons(가장 강한 신호가 앞)를 그대로 재사용해 결정론적으로 생성.
 * @param top 상위 1인 매칭 결과(CelebMatchResult)
 */
function plainResonance(top: CelebMatchResult): string {
  const r = top.reasons[0];
  if (!r) return '타고난 기운을 견주면 닮은 결이 은근히 보여요.';
  // 라벨 괄호 안 오행 글자만 추출 → 일상어 변환에만 사용(오행 한자 자체는 화면에 노출하지 않음).
  const elem = r.label.match(/([木火土金水])/)?.[1];
  const elemWord = elem ? ELEM_PLAIN[elem] : '';
  switch (r.type) {
    case 'ilju_exact':
      return '타고난 뿌리 자리가 통째로 겹쳐요. 기질의 결이 유독 많이 닮은 사이예요.';
    case 'ilgan_same':
      return '중심을 이루는 기운이 같아요. 세상을 대하는 태도의 뿌리가 닮았을 수 있어요.';
    case 'ilgan_elem':
      return elemWord
        ? `둘 다 ${elemWord} 기운이 중심이에요. 비슷한 결로 움직이는 편이에요.`
        : '중심 기운의 결이 닮았어요.';
    case 'dominant_match':
      return elemWord
        ? `두 분 모두 ${elemWord} 기운이 가장 도드라져요. 닮은 에너지를 타고났어요.`
        : '가장 강한 기운이 같아요.';
    case 'ohaeng_close':
      return '타고난 기운의 조합이 비슷해요. 삶을 대하는 결에 공통점이 생기기 쉬워요.';
    case 'tengod_close':
      return '사람을 대하고 일을 풀어가는 방식의 결이 닮았어요.';
    default:
      return '기운을 견주면 닮은 면이 은근히 보여요.';
  }
}

export default function CelebIndex() {
  const { t } = useTranslation();
  const router = useRouter();

  // 대표 명식 input — 화면 포커스마다 재로딩(명식 교체 동기화). null=아직 로드 전 or 명식 없음.
  const [repInput, setRepInput] = useState<ChartInput | null>(null);
  const [resolved, setResolved] = useState(false); // 로드 완료 여부(명식 없음 안내 분기용)

  useFocusEffect(useCallback(() => {
    let alive = true;
    loadRepChart()
      .then((c) => { if (alive) { setRepInput(c?.input ?? null); setResolved(true); } })
      .catch(() => { if (alive) { setRepInput(null); setResolved(true); } });
    return () => { alive = false; };
  }, []));

  // ── 상위 1인 매칭(무료 티저) — 대표 명식 있을 때만, repInput 바뀔 때만 재계산 ──
  //   rankCelebs 가 전체 16인 랭킹을 산출하므로 [0] 이 곧 '가장 닮은 인물'. 재계산·재구현 없이 재사용.
  const top: CelebMatchResult | null = useMemo(() => {
    if (!repInput) return null;
    try {
      const myChart = computeChart(repInput);
      return rankCelebs(myChart, CELEB_DB)[0] ?? null;
    } catch {
      return null; // 엔진 산출 실패 시 티저만 생략(그리드는 정상 노출)
    }
  }, [repInput]);

  const grade = top ? matchGrade(top.score) : null;

  return (
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap}>
        {/* 타이틀 */}
        <Text style={styles.title}>{t('celeb.title', '세계를 움직이는 사람들')}</Text>
        <Text style={styles.sub}>
          {t('celeb.sub', '내 사주와 유명인의 사주를 견주는 재미 — 일간·오행·십신 구조로 닮은꼴을 찾아요')}
        </Text>

        {/* ★무료 티저 — 나와 가장 닮은 인물 1명 + 유사도% (온디바이스·결정론·API 0). 탭 → 그 인물 상세 비교 */}
        {top && grade && (
          <PressableScale style={styles.teaser} onPress={() => router.push(`/celeb/${top.celeb.id}`)}>
            <Text style={styles.teaserLabel}>{t('celeb.topLabel', '나와 가장 닮은 인물')}</Text>
            <View style={styles.teaserHead}>
              <Text style={styles.teaserFlag}>{top.celeb.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.teaserName}>{top.celeb.name}</Text>
                <Text style={styles.teaserRole}>{top.celeb.role}</Text>
              </View>
              {/* 유사도% — 등급 색으로 강조(matchGrade 재사용) */}
              <View style={styles.teaserPctWrap}>
                <Text style={[styles.teaserPct, { color: grade.color }]}>{top.score}%</Text>
                <Text style={styles.teaserPctSub}>{grade.emoji} 닮음</Text>
              </View>
            </View>
            {/* 유사도 막대(작은 비주얼) — 채움 폭 = 점수%. 등급 색. */}
            <View style={styles.simTrack}>
              <View style={[styles.simFill, { width: `${Math.max(4, top.score)}%`, backgroundColor: grade.color }]} />
            </View>
            {/* 닮은 점 한 줄(일상어·단정 회피) */}
            <Text style={styles.teaserBody}>{plainResonance(top)}</Text>
            <Text style={styles.teaserMore}>탭하면 이 인물과 나를 자세히 비교해 볼 수 있어요 ›</Text>
          </PressableScale>
        )}

        {/* 명식 미등록 — 티저 대신 등록 유도(그리드는 아래 그대로 노출) */}
        {resolved && !repInput && (
          <PressableScale style={styles.noChartHook} onPress={() => router.push('/register')}>
            <Text style={styles.noChartTitle}>명식을 등록하면 나와 가장 닮은 인물을 찾아드려요</Text>
            <Text style={styles.noChartTx}>내 생년월일시로 사주를 먼저 등록해 주세요 ›</Text>
          </PressableScale>
        )}

        {/* 퍼널 — 전체 순위·각 인물 자세한 풀이는 유료(기존 유료 플로우로 유도, 게이트 불변) */}
        {top && (
          <Text style={styles.funnel}>
            🔒 전체 순위와 각 인물의 자세한 풀이(성향 · 나와의 공통점 · 배울 점)는 유료로 더 깊이 만나 볼 수 있어요.
          </Text>
        )}

        {/* 인물 그리드 — DB 순서 그대로(정렬 X: 전체 순위는 유료 가치로 보존) */}
        <View style={styles.grid}>
          {CELEB_DB.map((c) => (
            <PressableScale
              key={c.id}
              style={styles.card}
              onPress={() => router.push(`/celeb/${c.id}`)}
            >
              <Text style={styles.flag}>{c.flag}</Text>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.role}>{c.role}</Text>
              <Text style={styles.blurb}>{c.blurb}</Text>
            </PressableScale>
          ))}
        </View>

        {/* 안전 면책 */}
        <Text style={styles.disclaimer}>
          * 공개된 생년월일 기반의 재미·추정 콘텐츠예요.{'\n'}
          출생 시각 미상이라 시주 제외. 투자·정치 판단의 근거가 아닙니다.
        </Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  title: { fontSize: 24, fontWeight: '900', color: colors.ink, textAlign: 'center', marginTop: space(2) },
  sub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(2), marginBottom: space(5), lineHeight: 19 },

  // ── 무료 티저 카드(상위 1인) ──
  teaser: {
    backgroundColor: colors.juSoft,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.ju,
    padding: space(5),
    marginBottom: space(4),
    ...shadow.card,
  },
  teaserLabel: { ...font.label, color: colors.ju, fontWeight: '800', marginBottom: space(2.5) },
  teaserHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  teaserFlag: { fontSize: 44 },
  teaserName: { fontSize: 18, fontWeight: '900', color: colors.ink },
  teaserRole: { ...font.caption, color: colors.inkSoft, marginTop: 2 },
  teaserPctWrap: { alignItems: 'center', minWidth: 64 },
  teaserPct: { fontSize: 30, fontWeight: '900', letterSpacing: 0.5 },
  teaserPctSub: { ...font.caption, color: colors.inkSoft, marginTop: -2 },
  // 유사도 막대
  simTrack: { height: 10, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', marginTop: space(3.5) },
  simFill: { height: '100%', borderRadius: radius.pill, minWidth: 6 },
  teaserBody: { ...font.body, color: colors.ink, lineHeight: 22, marginTop: space(3) },
  teaserMore: { ...font.caption, color: colors.ju, fontWeight: '700', marginTop: space(2) },

  // ── 명식 미등록 유도 ──
  noChartHook: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.juLine,
    padding: space(5),
    marginBottom: space(4),
    ...shadow.card,
  },
  noChartTitle: { ...font.body, fontWeight: '800', color: colors.ink, textAlign: 'center', lineHeight: 22 },
  noChartTx: { ...font.caption, color: colors.ju, fontWeight: '700', textAlign: 'center', marginTop: space(2) },

  // ── 퍼널 ──
  funnel: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(5), textAlign: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space(3) },
  card: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.juLine,
    padding: space(4),
    marginBottom: space(3),
    ...shadow.card,
  },
  flag: { fontSize: 36, marginBottom: space(1) },
  name: { ...font.heading, color: colors.ink },
  role: { ...font.label, color: colors.ju, marginTop: 2 },
  blurb: { ...font.caption, color: colors.inkSoft, marginTop: space(1), lineHeight: 17 },
  disclaimer: { ...font.caption, color: colors.inkFaint, marginTop: space(4), lineHeight: 17, textAlign: 'center' },
});
