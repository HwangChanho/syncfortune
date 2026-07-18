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
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ContentGrid } from '../../components/ContentGrid';
import { colors, space, font } from '../../lib/theme';

export default function ContentsScreen() {
  const { t } = useTranslation();
  return (
    // 전역 ContentBackdrop(오행 배경색)이 비치게 투명(홈과 동일 처리).
    <View style={styles.bg}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>{t('nav.contents', '풀이')}</Text>
        <Text style={styles.sub}>{t('contents.sub', '보고 싶은 주제를 골라 보세요')}</Text>
        <View style={styles.divider} />
        <ContentGrid />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },
  screen: { backgroundColor: 'transparent' },
  // padding space(5) = ContentGrid 의 section marginHorizontal:-space(5) 와 짝(가로 스크롤이 화면 끝까지 닿게).
  wrap: { padding: space(5), paddingTop: space(12), paddingBottom: space(10) },
  title: { ...font.display, textAlign: 'left' as const },
  sub: { ...font.body, color: colors.inkSoft, marginTop: space(2), textAlign: 'left' as const },
  divider: { width: 44, height: 3, borderRadius: 2, backgroundColor: colors.ju, marginTop: space(4), marginBottom: space(6) },
});
