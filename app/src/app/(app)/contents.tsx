// src/app/(app)/contents.tsx — 하단탭 '풀이'(콘텐츠 전체 목록)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-18 IA 개편: 홈에 쌓여 있던 카드 그리드(35장)를 이 탭으로 옮겼다.
//   · 홈 = 나(성격유형 히어로)·오늘(기운)·명식 선택 — '지금 내 상태'
//   · 풀이(여기) = 볼 수 있는 콘텐츠 전부 — '무엇을 볼까'
//   daniel 지시 그대로 **리스트만** 옮겼다(오늘의 운세·명식 선택 등은 홈에 남김).
//
// ★라우트 이름이 /contents 인 이유: 기존 /reading(사주 원국풀이 화면)과 한 글자 차이인 /readings 는
//   딥링크·grep·라우터 매칭에서 서로 오인하기 쉽다. 탭 라벨만 '풀이'(i18n nav.contents)로 둔다.
//
// 목록 데이터 = lib/content/contentSections.ts / 렌더·진입 게이트 = components/ContentGrid.tsx (단일 출처).
// 이 파일은 화면 껍데기(스크롤·타이틀)만 담당한다.
// ─────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ContentGrid } from '../../components/ContentGrid';
import { NextStepCard } from '../../components/NextStepCard'; // '다음 단계' 퍼널 히어로(나열→저니)
import { ChartPicker } from '../../components/ChartPicker';
import { PressableScale } from '../../components/PressableScale';
import { colors, space, font, radius } from '../../lib/theme';

export default function ContentsScreen() {
  const { t } = useTranslation();
  const [reload, setReloadKey] = useState(0); // 명식 전환 시 그리드(배지·티저)·다음단계 카드 재계산 트리거
  const [cat, setCat] = useState<'saju' | 'ziwei' | 'taro'>('saju'); // ★풀이 3대 카테고리(daniel 2026-07-24)
  return (
    // 전역 ContentBackdrop(오행 배경색)이 비치게 투명(홈과 동일 처리).
    <View style={styles.bg}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>{t('nav.contents', '풀이')}</Text>
        <Text style={styles.sub}>{t('contents.sub', '보고 싶은 주제를 골라 보세요')}</Text>
        {/* ★장식 구분선 제거(daniel 2026-07-26 IMG_8186) — 타이틀·부제·구분선·세그먼트·명식·뷰토글이
            상단을 다 먹어 첫 콘텐츠가 화면 절반 아래에서 시작했다. 정보가 아닌 요소부터 걷어낸다. */}
        {/* ★풀이 3대 카테고리(daniel 2026-07-24) — 사주·자미두수·타로를 메인으로. 탭으로 그리드 필터. */}
        <View style={styles.catSeg}>
          {([['saju', '사주'], ['ziwei', '자미두수'], ['taro', '타로']] as const).map(([k, l]) => (
            <PressableScale key={k} style={[styles.catChip, cat === k && styles.catChipOn]} onPress={() => setCat(k)}>
              <Text style={[styles.catChipTx, cat === k && styles.catChipTxOn]}>{l}</Text>
            </PressableScale>
          ))}
        </View>
        {cat === 'ziwei' ? <Text style={styles.catIntro}>사주와는 별개의 운명 체계 — 태어난 시각으로 12궁(명궁·재물·관록·배우자 등)에 별을 배치해 삶의 각 영역을 봐요.</Text> : null}
        {cat === 'taro' ? <Text style={styles.catIntro}>78장 타로 카드로 오늘의 질문에 답을 얻어요(주제별 하루 1회).</Text> : null}
        {/* ★대표 명식 — 이 탭에서도 최상단(daniel 2026-07-19). 카드 배지·티저가 적용 명식 기준. */}
        <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
        {/* ★'다음 단계' 히어로(daniel 2026-07-26) — 35장 나열 대신 **지금 이 사람에게 맞는 딱 한 장**을 크게.
            여기서 들어가면 상세 하단 RelatedContent 가 이어받아 '타고타고' 굴러간다(같은 RELATED 큐레이션 재사용).
            사주 탭에서만 노출 — 자미/타로는 별도 체계라 동선이 섞이면 흐름이 어긋난다. */}
        {cat === 'saju' ? <NextStepCard reloadKey={reload} /> : null}
        <ContentGrid category={cat} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },
  screen: { backgroundColor: 'transparent' },
  // padding space(5) = ContentGrid 의 section marginHorizontal:-space(5) 와 짝(가로 스크롤이 화면 끝까지 닿게).
  wrap: { padding: space(5), paddingTop: space(9), paddingBottom: space(10) }, // ★paddingTop 12→9(daniel 07-26: 콘텐츠가 늦게 나옴)
  title: { ...font.display, textAlign: 'left' as const },
  sub: { ...font.body, color: colors.inkSoft, marginTop: space(2), marginBottom: space(5), textAlign: 'left' as const }, // 구분선 제거분 간격 흡수
  // ★풀이 3대 카테고리 세그먼트(daniel 07-24) — 사주/자미두수/타로
  catSeg: { flexDirection: 'row', gap: space(2), marginBottom: space(4) },
  catChip: { flex: 1, alignItems: 'center', paddingVertical: space(2.5), borderRadius: radius.md, backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line },
  catChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  catChipTx: { fontSize: 15, fontWeight: '800', color: colors.inkSoft, letterSpacing: 0.3 },
  catChipTxOn: { color: '#15132E' },
  catIntro: { ...font.caption, color: colors.inkSoft, lineHeight: 18, marginBottom: space(5), marginTop: -space(2) },
});
