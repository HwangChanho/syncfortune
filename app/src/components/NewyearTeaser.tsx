// app/src/components/NewyearTeaser.tsx — 신년운세(유료) 위 무료 온디바이스 티저 (결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 프리미엄 퍼널(모든 유료 콘텐츠 공통): 유료 신년운세(LLM) 위에 '내년 신수'를 무료로 먼저 보여준다
//   → 재회(ReunionRich)/애정(LoveFlowGraph)/인생그래프(LifeGraphTeaser)와 동일 결.
//   · 무료 = 큰 삼재 배지(검색 유입 훅) + 내년 신수 게이지 + 올해의 키워드 미리보기 + 길월 달력 — 전부 온디바이스.
//   · 유료 = 내년 열두 달을 분야별(재물·애정·직업·건강)로 나눈 상세 + 개운법 + 복/악삼재 정밀 판정(LLM).
//
// ▶ 산출은 lib/content/newyearGauge(3층 곱연산 산식 + 복/악삼재 크로스)가 전부 결정론으로 한다 — 여기선 그리기만.
//   ★화면 텍스트엔 용신/한자/십신 같은 전문 용어를 절대 노출하지 않는다 = 일상어.
//   ★§4 웰빙: 삼재·낮은 신수를 흉으로 단정하지 않는다 — '정비·관리·다지는 해'로 전향적(관리축) + 복삼재 가능성 명시(공포 마케팅 회피).
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';
import { MonthFlowGraph } from './MonthFlowGraph'; // 12개월 흐름 곡선(공용·신년 카테고리 곡선과 단일 소스·DRY)
import { PossibilityGauge } from './PossibilityGauge';                   // 공용 가능성 게이지(재회·애정과 공유 — 애니 미터)
import { newyearSinsu, type SamjaeLabel } from '../lib/content/newyearGauge'; // 내년 신수 결정론 엔진

// ── 삼재 신호등 색·문구(§4: 절대 붉은/공포색 아님 — 관리축 톤. 초록=없음 / 노랑=가장자리 / 주황=절정) ──
// ⚠️★금색을 어둡게 바꿨다(2026-08-22) — 종전 #D9A441 은 **흰 카드 위 대비 2.25** 로 안 읽혔다.
//   미드나잇(어두운) 테마 시절 값이 라벤더 전환 뒤에도 남아 있던 것이다.
//   #A16C09 = 카드 4.50 · 배경 4.17 (계산해서 고른 값이지 눈으로 고르지 않았다).
// ⚠️★`title`·`sub` 는 값이 아니라 **문구 키**다(모듈 상수라 `t()` 를 여기서 못 부른다).
const SAMJAE_LIGHT: Record<SamjaeLabel, { color: string; title: string; sub: string }> = {
  none: { color: '#3E8E5A', title: 'ny.samjaeNone', sub: 'ny.samjaeNoneSub' },
  deul: { color: '#A16C09', title: 'ny.samjaeDeul', sub: 'ny.samjaeDeulSub' },
  nul:  { color: '#D4743B', title: 'ny.samjaeNul', sub: 'ny.samjaeNulSub' },
  nal:  { color: '#A16C09', title: 'ny.samjaeNal', sub: 'ny.samjaeNalSub' },
};

// 톤 → 게이지 경향 라벨/한 줄 문구(§4 경향·단정 금지 + 전향적). 재회/애정 게이지와 동일 결.
function toneCopy(tone: 'open' | 'warming' | 'quiet') {
  // ★순수 함수라 `t()` 를 못 부른다 — **키**를 돌려주고 화면이 푼다.
  if (tone === 'open') return { label: 'ny.toneOpen', caption: 'ny.capOpen' };
  if (tone === 'warming') return { label: 'ny.toneMild', caption: 'ny.capMild' };
  return { label: 'ny.toneCare', caption: 'ny.capCare' };
}

// ── '내년 좋은 달' 그래프는 MonthFlowGraph 공용 컴포넌트로 추출(daniel 07-08 DRY) — 신년 카테고리 곡선과 단일 소스.

/**
 * 신년운세 무료 리치 티저. newyear.tsx 히어로 아래(잠김/열림 무관)에 노출.
 * @param saju 대표 명식의 사주(원국 + 세운 목록 + 대운).
 * @param timeUnknown 시각 미상(원국 시주 제외 — 강도 판정에만 반영). love.tsx 관례처럼 opts 로 전달.
 */
export function NewyearTeaser({ saju, timeUnknown }: { saju: SajuChart; timeUnknown?: boolean }) {
  const { t } = useTranslation();
  // 모든 결정론 값은 saju/timeUnknown 변경 시에만 1회 산출(성능·단일 소스). 게이지 카운트업 리렌더와 분리.
  const d = useMemo(() => newyearSinsu(saju, { timeUnknown }), [saju, timeUnknown]);
  const light = SAMJAE_LIGHT[d.samjae];
  const tc = toneCopy(d.tone);
  const isSamjae = d.samjae !== 'none';

  // '좋은 달' 그래프 — 월별 방향점수(monthScores) 곡선 + 길월(goodMonths) 금색 점. 월운 없으면 그래프 생략(안내 문구 대체).
  const goodSet = new Set(d.goodMonths);

  return (
    <>
      {/* ① ★큰 삼재 배지(맨 위) — 검색 유입("2027 삼재 띠") 관문 + 라이트 유저가 유일하게 아는 개념 = freemium 훅 최대화.
          §4: 신호등 색은 관리축(초록/노랑/주황) — 붉은 공포색 금지. 삼재라도 '피하는 해'가 아니라 '정비하는 해'. */}
      <View style={[styles.samjaeCard, { borderColor: light.color }]}>
        <View style={styles.samjaeHead}>
          <View style={[styles.dot, { backgroundColor: light.color }]} />
          <Text style={[styles.samjaeTitle, { color: light.color }]}>{t('cp.yearN', '{{y}}년', { y: d.nextYear })} · {t(light.title)}</Text>
        </View>
        <Text style={styles.samjaeSub}>{t(light.sub)}</Text>
        {isSamjae && (
          <Text style={styles.samjaeManage}>{t('ny.manage', '삼재는 피하는 해가 아니라, 몸·관계·살림을 살피며 내실을 다지는 해로 봐요.')}</Text>
        )}
        {/* ② 업셀 — 삼재는 띠(민속 12분법) 공통 이야기 → 개인 사주로 다시 봐야 함(신수 게이지로 자연 연결) */}
        <Text style={styles.upsell}>{t('ny.upsell', '삼재는 같은 띠 모두의 이야기예요. 당신의 진짜 한 해는 사주 여덟 글자로 다시 계산해야 해요.')}</Text>
        {/* ③ 복/악 크로스 훅 — 판정은 페이월 뒤(무료는 들/눌/날까지만). 공포 마케팅 회피(복삼재 가능성 명시) */}
        {isSamjae && (
          <Text style={styles.upsell}><Text>{t('ny.bokA', '이 해가 이름뿐인 ')}</Text><Text style={styles.accent}>{t('ny.bokB', '복삼재')}</Text><Text>{t('ny.bokC', '인지, 실제로 챙길 게 있는 해인지는 깊은 풀이에서 콕 짚어 드려요.')}</Text></Text>
        )}
      </View>

      {/* ② 내년 신수 게이지(핵심 훅) — 삼재(띠)와 달리 '내 사주 8글자'로 계산한 내년 부합도(0~100) */}
      <PossibilityGauge score={d.score} label={t(tc.label)} tone={d.tone} title={t('ny.gaugeTitle', '내년 기운이 나와 맞는 정도')} caption={t(tc.caption)} accent={colors.ju} />

      {/* 올해의 키워드 미리보기 — 방향×강도 매트릭스에서 뽑은 한 줄(일상어) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('ny.keywordTitle', '내년 키워드 미리보기')}</Text>
        <Text style={styles.keyword}>{d.keyword}</Text>
      </View>

      {/* ③ 내년 좋은 달 그래프(1~12) — 월별 기운 곡선 + 좋은 달 금색 점 (daniel 07-07: 그리드→그래프) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('ny.goodMonths', '내년 좋은 달')}</Text>
        {d.monthScores.length === 12 && <MonthFlowGraph scores={d.monthScores} goodSet={goodSet} />}
        <Text style={styles.calNote}>
          {d.goodMonths.length
            ? t('ny.calNote', '곡선이 높은 달에 기운이 나와 잘 통해요(진하게 찬 점). 어떤 일에 좋은지는 깊은 풀이에서 달별로 짚어 드려요.')
            : t('ny.calNoteNone', '내년 좋은 달은 깊은 풀이에서 달별로 콕 짚어 드려요.')}
        </Text>
      </View>

      {/* 무료 vs 유료 가치 명시(퍼널 훅) — 곧바로 아래 게이트(₩9,900 CTA)로 이어진다 */}
      <View style={styles.funnelCard}>
        <Text style={styles.funnelLine}><Text>{t('rr.freeA', '무료로는 ')}</Text><Text style={styles.accent}>{t('ny.freeB', '내년 큰 기운 · 삼재 · 좋은 달')}</Text><Text>{t('rr.freeC', '까지 볼 수 있어요.')}</Text></Text>
        <Text style={styles.funnelLine}><Text>{t('rr.paidA', '깊은 풀이에선 ')}</Text><Text style={styles.accent}>{t('ny.paidB', '내년 열두 달을 재물·애정·직업·건강으로 나눠, 개운법과 복/악삼재까지')}</Text><Text>{t('rr.paidC', '까지 짚어 드려요.')}</Text></Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // 삼재 큰 배지(맨 위 훅) — 테마 테두리 강조
  samjaeCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, padding: space(4), marginBottom: space(4) },
  samjaeHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5) },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: space(2) },
  samjaeTitle: { ...font.heading, fontSize: 18, fontWeight: '900' },
  samjaeSub: { ...font.body, color: colors.ink, fontWeight: '700', fontSize: 14, marginBottom: space(2) },
  samjaeManage: { ...font.caption, color: colors.inkSoft, lineHeight: 19, fontSize: 12.5, marginBottom: space(2) },
  upsell: { ...font.caption, color: colors.inkSoft, lineHeight: 19, fontSize: 12, marginTop: space(1) },

  // 공통 카드(ReunionRich/LifeGraphTeaser 와 동일 결 — sunk 배경·라운드·여백)
  card: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(4) },
  cardTitle: { ...font.body, fontWeight: '800', color: colors.ju, marginBottom: space(2.5), fontSize: 14 },
  keyword: { ...font.body, color: colors.ink, fontWeight: '900', fontSize: 18, letterSpacing: 0.3 },
  accent: { color: colors.ju, fontWeight: '800' },

  // 길월 미니 달력(1~12, 6칸 × 2줄)
  calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginBottom: space(2.5) },
  cell: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  cellGood: { backgroundColor: colors.ju, borderColor: colors.ju },
  cellTx: { ...font.body, color: colors.inkFaint, fontSize: 14, fontWeight: '700' },
  cellTxGood: { color: colors.bg, fontWeight: '900' },
  calNote: { ...font.caption, color: colors.inkSoft, lineHeight: 18, fontSize: 12 },

  // 퍼널 가치 명시
  funnelCard: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(4) },
  funnelLine: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(1), fontSize: 12 },
});
