// app/src/components/CrushRich.tsx — 짝사랑(무료) 리치 콘텐츠 셸 (결정론·온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 모델: "무료를 결정론+비주얼로 풍부하게 → 유료 자연 구매". FreeFunnel 의 render 로 주입되는
//   짝사랑('그 사람과 이어질까') 전용 무료 본문. supabase/Edge 절대 호출 안 함 — computeChart 산출 saju 만으로 전부 계산.
//   재회 리치(ReunionRich)와 완전히 같은 결·같은 엔진(inyeonGauge/PossibilityGauge)을 재사용하되, 카피만
//   '짝사랑(일방 → 이어질까)' 프레임으로 바꾼다(중복 재발명 금지 = 규칙6·유지보수). 기존 CrushTiming(12개월 달력)을
//   그대로 품고, 그 위에 게이지·끌림 신호·개운 티저를 얹어 '가능성·시기·다가갈 타이밍'을 무료로 보여주고
//   → 골드 CTA(유료 깊은 짝사랑 풀이 /crush)로 자연 유도한다.
//
// ▶ 담는 무료 요소(전부 결정론, 한자·십신·용어는 화면 텍스트에 노출 금지 = 일상어):
//   ① 짝사랑 성사 게이지(0~100) — 원국 도화 + 현재 운의 도화 발동 + 배우자궁(인연 자리) 개폐 + 재/관 인연星 발동 합산.
//      ★점수 산출 = lib/love/inyeonGauge.computeInyeonSignals(재회·애정·짝사랑 공통 엔진 — 짝사랑 성사 = 같은 도화·인연星 끌림 신호).
//      미터 UI = PossibilityGauge(공용 컴포넌트).
//   ② 끌림 신호 — 도화 발동(합/충)[= 일지 개폐] + 홍염(타고난 끌림·매력)[일간 파생]을 일상어로.
//   ③ 매력·인연이 도는 달 — 기존 CrushTiming(12개월 달력) 그대로 품음.
//   ④ 다가가기 개운 미리보기(티저) — 좋은 색·요일 중 딱 하나만 무료 공개, 나머지·구체 실천은 🔒(유료).
//   ⑤ 무료 vs 유료 잠긴 가치 명시(퍼널 훅) — 무료=가능성·시기·다가갈 타이밍 / 유료=그 사람 마음·다가가는 법·이어질 이유.
//
// ▶ ★daniel 스탠스(APPROVED): 짝사랑 성사 = 도화(왕지 子午卯酉) 합·충 + 홍염(끌림·매력) + 인연星(남명 재성/여명 관성).
//   crush.tsx(유료) 헤더·CrushTiming(07-05 도화 충+합) 스탠스와 동일. 발명 아님 — 표준 통설 테이블 산출만(LLM 미사용).
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart, Branch, Stem, Element, PillarPos } from '@spec/chart';
import { colors, radius, space, font } from '../lib/theme';
import { CrushTiming } from './CrushTiming';                 // 기존 12개월 '매력·인연이 도는 달' 달력(그대로 품음)
import { PossibilityGauge } from './PossibilityGauge';       // 공용 가능성 게이지(추출 — 재회·애정·짝사랑 공유)
import { computeInyeonSignals } from '../lib/love/inyeonGauge'; // 인연 게이지 결정론 신호(재회·애정·짝사랑 공통 엔진)

// ── 짝사랑 표시 전용 테이블(문구 매핑용 — 점수 산출 테이블은 lib/love/inyeonGauge 로 이관). ★daniel 검수 ──
const ALL_STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];    // 개운 티저 짝/홀 선택용
// 홍염(끌림·매력)살 = 일간 기준 이성 매력·끼(도화와 별개). engine/sinsal.ts HONGYEOM 표와 동일 값(로컬 재정의 —
//   render 에 넘어오는 saju엔 신살 분석이 실려오지 않아, 일간에서 직접 파생. natal 지지에 이 글자가 있으면 '타고난 끌림').
const HONGYEOM: Record<Stem, Branch> = { 甲: '午', 乙: '午', 丙: '寅', 丁: '未', 戊: '辰', 己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申' };
// 오행 → 다가가기 개운(방위·색·요일, 일상어). 배우자성(인연星) 오행 기준(ReunionRich ELEM_GAEUN과 동일 결·값).
const ELEM_GAEUN: Record<Element, { dir: string; color: string; day: string }> = {
  木: { dir: '동쪽', color: '맑은 청록빛', day: '목요일' },
  火: { dir: '남쪽', color: '따뜻한 붉은빛', day: '화요일' },
  土: { dir: '가까운 곳', color: '포근한 노란·베이지빛', day: '토요일' },
  金: { dir: '서쪽', color: '맑은 흰·은빛', day: '금요일' },
  水: { dir: '북쪽', color: '깊은 남색빛', day: '수요일' },
};

/**
 * 짝사랑 무료 리치 본문. FreeFunnel 의 render 로 주입(대표 명식 saju).
 * @param saju 대표 명식의 사주(결정론 산출 + timeUnknown/sex 병합됨 — FreeFunnel 참고).
 */
export function CrushRich({ saju }: { saju: SajuChart }) {
  // 모든 결정론 값은 saju 변경 시에만 1회 산출(성능·단일 소스). 게이지 카운트업 리렌더와 분리.
  const d = useMemo(() => {
    // ① 인연 게이지 신호(재회·애정·짝사랑 공통 엔진) — sex/timeUnknown 은 saju 병합값을 읽음(opts 미전달 = 기존 동작).
    const sig = computeInyeonSignals(saju);
    const { score, tone, gungOpen, gungBond, gungFriction, inyeonEl, dm } = sig;

    // 경향 라벨/문구(§4 경향·단정 금지 + 처방 동반 + 전향적). tone 경계 = 기존 score 66/34 와 동일.
    const tendency = tone === 'open' ? '열려 있어요' : tone === 'warming' ? '서서히 열려요' : '지금은 조용해요';
    const gaugeCaption = tone === 'open'
      ? '지금 그 사람과 이어질 흐름이 활짝 열려 있어요. 마음이 있다면 자연스럽게 다가가 보세요.'
      : tone === 'warming'
        ? '이어질 흐름이 서서히 데워지고 있어요. 서두르기보다 결이 무르익는 달을 노려 마음을 살짝 표현해 보세요.'
        : '지금은 흐름이 차분한 편이에요. 조급해하기보다 나를 가꾸며 끌림이 도는 때를 준비하면 좋아요.';

    // ② 끌림 신호 (가) 도화 발동(합/충) = 일지(인연 자리) vs 지금 운의 충(열림)/합(맺힘)/형(엇갈림) '결'(일상어)
    const dohwaLabel = gungOpen ? '지금 끌림이 강하게 도는 결이에요'
      : gungBond ? '지금 인연이 맺히려는 결이에요'
        : gungFriction ? '지금 살짝 엇갈리며 움직이는 결이에요'
          : '지금은 조용한 결이에요';
    const dohwaSub = gungOpen ? '설렘과 계기가 강하게 이는 시기예요. 마음을 표현하면 통하기 쉬워요.'
      : gungBond ? '서로 가까워지려는 결이에요. 가볍게 다가가면 자연스럽게 이어지기 좋아요.'
        : gungFriction ? '밀고 당기는 결이에요. 조급함보다 여유로 다가가면 흐름이 부드러워져요.'
          : '끌림이 아직 은근해요. 무리하기보다 나를 가꾸며 다음 흐름을 기다려요.';

    // ② 끌림 신호 (나) 홍염(타고난 끌림·매력) — 일간 파생 홍염 글자가 natal 지지에 있으면 '타고난 매력'.
    //    시각 미상이면 시지(時支) 제외(잘못된 판정 방지) — 코드베이스 관례(FreeFunnel이 saju에 병합).
    const timeUnknown = (saju as any)?.timeUnknown === true;
    const posList: PillarPos[] = timeUnknown ? ['년', '월', '일'] : ['년', '월', '일', '시'];
    const natalBranches = posList.map((p) => saju.pillars?.[p]?.branch).filter(Boolean) as Branch[];
    const hasHongyeom = natalBranches.includes(HONGYEOM[dm]);
    const charmLabel = hasHongyeom ? '타고난 끌림(매력)이 있어요' : '은근하게 스며드는 매력이에요';
    const charmSub = hasHongyeom
      ? '은은한 분위기로 사람을 끄는 매력이 있어, 마음을 표현하면 상대가 끌리기 쉬워요.'
      : '화려하기보다 서서히 스며드는 매력이라, 자주 마주치며 편안함을 쌓으면 마음이 열려요.';

    // ④ 다가가기 개운 티저 — 색/요일 중 딱 하나만 공개(방위는 잠금 → 유료 가치 보존). 일간으로 결정론 선택.
    const gaeun = ELEM_GAEUN[inyeonEl];
    const teaser = ALL_STEMS.indexOf(dm) % 2 === 1
      ? { label: '다가가기 좋은 요일', value: gaeun.day }
      : { label: '다가가기 좋은 색', value: gaeun.color };

    return { score, tone, tendency, gaugeCaption, dohwaLabel, dohwaSub, charmLabel, charmSub, teaser };
  }, [saju]);

  const bright = d.tone === 'open';

  return (
    <>
      {/* ① 핵심 훅 — 짝사랑 성사 게이지(공용 애니 미터, accent 미전달 = 골드 기본) */}
      <PossibilityGauge score={d.score} label={d.tendency} tone={d.tone} title="그 사람과 이어질 가능성" caption={d.gaugeCaption} />

      {/* ② 끌림 신호 — 도화 발동(합/충)[일지 개폐] + 홍염(타고난 매력)[일간 파생] */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>끌림 신호</Text>
        {/* (가) 지금 도화(끌림)가 도는 결 */}
        <Text style={[styles.gungLabel, bright && styles.gungLabelBright]}>{d.dohwaLabel}</Text>
        <Text style={styles.cardBody}>{d.dohwaSub}</Text>
        <View style={styles.divider} />
        {/* (나) 타고난 끌림·매력(홍염) */}
        <Text style={styles.charmLabel}>{d.charmLabel}</Text>
        <Text style={styles.cardBody}>{d.charmSub}</Text>
      </View>

      {/* ③ 매력·인연이 도는 달 — 기존 12개월 달력(그대로 품음) */}
      <CrushTiming saju={saju} />

      {/* ④ 다가가기 개운 미리보기(티저) + 잠긴 가치 명시(퍼널) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>다가가기 개운 미리보기</Text>
        <View style={styles.teaserRow}>
          <Text style={styles.teaserLabel}>{d.teaser.label}</Text>
          <Text style={styles.teaserValue}>{d.teaser.value}</Text>
        </View>
        <Text style={styles.lockNote}>🔒 좋은 방위 · 나머지 색·요일 · 다가가는 구체 실천법은 깊은 풀이에서</Text>
        <View style={styles.divider} />
        {/* 무료 vs 유료 잠긴 가치 명시(퍼널 훅 — 골드 CTA 바로 위) */}
        <Text style={styles.funnelLine}>무료로는 <Text style={styles.accent}>가능성·시기·다가갈 타이밍</Text>까지 볼 수 있어요.</Text>
        <Text style={styles.funnelLine}>깊은 풀이에선 <Text style={styles.accent}>그 사람 마음·다가가는 법·이어질 이유</Text>까지 짚어 드려요.</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // 공통 카드(CrushTiming/ReunionRich 와 동일 결 — sunk 배경·라운드·여백·하단 간격)
  card: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(4) },
  cardTitle: { ...font.body, fontWeight: '800', color: colors.ju, marginBottom: space(2.5), fontSize: 14 },
  cardBody: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(1) },
  accent: { color: colors.ju, fontWeight: '800' },

  // ── 끌림 신호(도화 발동 + 홍염) ──
  gungLabel: { ...font.body, color: colors.inkSoft, fontWeight: '800', fontSize: 15, marginBottom: space(1.5) },
  gungLabelBright: { color: colors.ju },
  charmLabel: { ...font.body, color: colors.inkSoft, fontWeight: '800', fontSize: 15, marginBottom: space(1.5) },

  // ── 개운 티저 ──
  teaserRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: space(2) },
  teaserLabel: { ...font.caption, color: colors.inkFaint, fontSize: 12 },
  teaserValue: { color: colors.ju, fontSize: 16, fontWeight: '900', marginLeft: space(2) },
  lockNote: { ...font.caption, color: colors.inkFaint, fontSize: 11, lineHeight: 16 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: space(3), opacity: 0.6 },
  funnelLine: { ...font.caption, color: colors.inkSoft, lineHeight: 19, marginBottom: space(1), fontSize: 12 },
});
