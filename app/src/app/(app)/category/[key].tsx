// src/app/(app)/category/[key].tsx — 카테고리 하위 항목 화면
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-08-06: "풀이 화면 카테고리 이렇게 나누고 **타고 들어가면 새로운 뷰에서 하위항목** 나오게 하자."
//
// 왜 별도 화면인가: 종전엔 풀이탭 한 화면에 전 섹션을 세로로 이어 붙였다(50여 장). 카테고리를 골라도
//   같은 화면에서 필터만 바뀌어 '들어왔다'는 감각이 없었다. 백화점 비유(daniel)로 치면 **층은 있는데
//   매장 문이 없는** 구조다. 카테고리를 고르면 그 매장 안으로 들어가고, 뒤로 나오면 다시 층 안내로 돌아온다.
//
// ★목록 렌더는 ContentGrid 를 그대로 쓴다(카드/리스트·배지·게이트·무료 우선 정렬이 전부 거기 있다).
//   여기서 또 그리면 같은 카드가 두 벌이 되어 언젠가 갈린다(이 프로젝트 반복 사고).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ContentGrid } from '../../../components/ContentGrid';
import { SECTIONS } from '../../../lib/content/contentSections';
import { useHomeViewMode } from '../../../lib/ui/homeView';
import { colors, space, font } from '../../../lib/theme';

export default function CategoryScreen() {
  const { key } = useLocalSearchParams<{ key?: string }>();
  const { t } = useTranslation();
  const { viewMode } = useHomeViewMode();
  const catKey = typeof key === 'string' ? key : '';
  const sec = SECTIONS.find((s) => s.key === catKey);

  return (
    <View style={styles.bg}>
      {/* 헤더 타이틀 = 카테고리 이름(뒤로 버튼은 네이티브 스택이 담당) */}
      <Stack.Screen options={{ title: sec ? (t(sec.titleKey) as string) : '' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
        {sec?.descKey ? <Text style={styles.desc}>{t(sec.descKey)}</Text> : null}
        {/* category 를 주면 ContentGrid 가 그 섹션만 그린다(무료 우선 정렬 포함). */}
        <ContentGrid viewMode={viewMode} category={catKey} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },
  screen: { backgroundColor: 'transparent' },
  // padding space(5) = ContentGrid 의 section marginHorizontal:-space(5) 와 짝(가로 스크롤이 화면 끝까지).
  wrap: { padding: space(5), paddingBottom: space(24) },
  desc: { ...font.body, color: colors.inkSoft, marginBottom: space(4) },
});
