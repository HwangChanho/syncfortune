// src/app/(app)/celeb/index.tsx — '세계를 움직이는 사람들' 그리드 + 무료 닮은꼴 (결정론 v2)
// ─────────────────────────────────────────────────────────────────────────
// 유명인(공개 생년월일) 목록 → 탭하면 /celeb/[id] 결정론 상세(나와의 사주 유사도).
// Edge LLM 호출 없음 — 온디바이스·API 0. ★완전 무료(daniel 07-07): 결정론이라 비용이 0이므로 유료 게이트/퍼널 없음.
//   (이용권을 사도 화면이 이미 무료라 '아무것도 안 주는 유료 판매' = App Store 3.1.1 리젝 리스크 → 마켓 판매·잠금 퍼널 제거.)
//   화면·상세 모두 무료 공개. interpret(kind=celeb)는 하드 거부(비용 벡터 차단) — 이 화면은 그 경로를 애초에 안 탄다.
//
// ★무료 구성:
//   ① 상단 티저 = "나와 가장 닮은 인물 1명 + 유사도%"(온디바이스 결정론) — 대표 명식 있을 때.
//   ② 그리드 = 16인 전원 노출. 명식 있으면 유사도순(전체 순위)으로 정렬 + 각 카드 유사도%까지 무료 공개.
//      (예전엔 '전체 순위=유료 가치'라 DB순서로 감췄으나, 무료 전환으로 순위·풀이를 그대로 공개.) 명식 없으면 DB순서.
//   재회(FreeFunnel/ReunionRich) 톤을 미러링: 미드나잇-골드·일상어·단정 금지(§4 재미·추정 프레임).
// ⚠️ 재미·추정 콘텐츠. 투자/정치 단정 절대 금지. 명예 존중.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { PressableScale } from '../../../components/PressableScale';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CELEB_DB } from '../../../lib/content/celebData';                 // 결정론 DB (celebData.ts)
import { computeChart } from '../../../lib/engine/engine';                  // 만세력 결정론 산출(엔진) — API 0
import { loadRepChart } from '../../../lib/engine/myChart';                 // 대표 명식(온디바이스, 로그인 불필요) — ReunionRich 와 동일 결
import { rankCelebs, matchGrade, type CelebMatchResult } from '../../../lib/content/celebMatch'; // 유사도 랭킹·등급(재사용, 재계산 금지)
import { colors, radius, space, shadow, font } from '../../../lib/theme';
import type { ChartInput } from '@spec/chart';
import { useLogContentVisit } from '../../../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회 기록

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
  useLogContentVisit('celeb'); // 진입 1회 방문 기록(daniel 2026-07-06)
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

  // ── 전체 랭킹(무료·결정론) — 대표 명식 있을 때 16인 전원을 유사도순으로 산출, repInput 바뀔 때만 재계산 ──
  //   무료 전환(07-07)으로 예전 '유료 가치'였던 전체 순위를 그대로 공개: [0]=티저(가장 닮은 인물), 전체=그리드 정렬·점수.
  //   명식 없거나 엔진 실패 시 null → 그리드는 DB순서 폴백(정상 노출).
  const ranked: CelebMatchResult[] | null = useMemo(() => {
    if (!repInput) return null;
    try {
      const myChart = computeChart(repInput);
      return rankCelebs(myChart, CELEB_DB);
    } catch {
      return null; // 엔진 산출 실패 시 티저·순위만 생략(그리드는 DB순서로 정상 노출)
    }
  }, [repInput]);

  // 상위 1인(무료 티저 = 가장 닮은 인물) — ranked 재사용(재계산·재구현 없이).
  const top: CelebMatchResult | null = ranked?.[0] ?? null;
  const grade = top ? matchGrade(top.score) : null;

  return (
    <View style={styles.bg}>
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

        {/* 전체 순위 안내(무료) — 명식 있으면 아래 그리드가 유사도순 + 각 카드 %까지 공개(예전 유료였던 순위를 무료로). */}
        {ranked && (
          <Text style={styles.rankNote}>
            나와 닮은 순서로 16인 전원의 순위·유사도를 무료로 공개해요. 카드를 탭하면 그 인물과 나를 자세히 비교해 볼 수 있어요.
          </Text>
        )}

        {/* 인물 그리드 — 명식 있으면 유사도순(전체 순위) + 카드별 % / 없으면 DB순서. 탭 → 결정론 상세(무료). */}
        <View style={styles.grid}>
          {(ranked ? ranked.map((r) => r.celeb) : CELEB_DB).map((c, i) => {
            // 명식 있을 때만 순위·유사도 표기(ranked[i] 가 이 카드 c 에 대응 — map 순서 보존). 등급 색 재사용(matchGrade).
            const g = ranked ? matchGrade(ranked[i].score) : null;
            return (
              <PressableScale
                key={c.id}
                style={styles.card}
                onPress={() => router.push(`/celeb/${c.id}`)}
              >
                {/* 순위 배지(무료 전체 순위 가시화) — 1위부터. 명식 있을 때만. */}
                {ranked && <Text style={styles.rankBadge}>{i + 1}위</Text>}
                <Text style={styles.flag}>{c.flag}</Text>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.role}>{c.role}</Text>
                {/* 유사도%(무료 공개) — 등급 색. 명식 있을 때만. */}
                {ranked && g && (
                  <Text style={[styles.cardScore, { color: g.color }]}>{ranked[i].score}% {g.emoji} 닮음</Text>
                )}
                <Text style={styles.blurb}>{c.blurb}</Text>
              </PressableScale>
            );
          })}
        </View>

        {/* 안전 면책 */}
        <Text style={styles.disclaimer}>
          * 공개된 생년월일 기반의 재미·추정 콘텐츠예요.{'\n'}
          출생 시각 미상이라 시주 제외. 투자·정치 판단의 근거가 아닙니다.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' }, // 전역 ContentBackdrop 비쳐 보이게(07-20 배경통일 누락분)
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

  // ── 전체 순위 안내(무료) ──
  rankNote: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(5), textAlign: 'center' },

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
  // 순위 배지(무료 전체 순위 가시화) — 카드 우상단 골드 라벨
  rankBadge: { ...font.label, color: colors.ju, fontWeight: '900', alignSelf: 'flex-start', marginBottom: space(0.5) },
  flag: { fontSize: 36, marginBottom: space(1) },
  name: { ...font.heading, color: colors.ink },
  role: { ...font.label, color: colors.ju, marginTop: 2 },
  // 카드별 유사도%(무료 공개) — 등급 색은 인라인
  cardScore: { ...font.caption, fontWeight: '800', marginTop: space(1) },
  blurb: { ...font.caption, color: colors.inkSoft, marginTop: space(1), lineHeight: 17 },
  disclaimer: { ...font.caption, color: colors.inkFaint, marginTop: space(4), lineHeight: 17, textAlign: 'center' },
});
