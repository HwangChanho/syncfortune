// src/app/(app)/contents.tsx — 하단탭 '풀이'(콘텐츠 전체 목록)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-18 IA 개편: 홈에 쌓여 있던 카드 그리드(35장)를 이 탭으로 옮겼다.
//   · 홈 = 나(성격유형 히어로)·오늘(기운)·명식 선택 — '지금 내 상태'
//   · 풀이(여기) = 볼 수 있는 콘텐츠 전부 — '무엇을 볼까'
//
// ★라우트 이름이 /contents 인 이유: 기존 /reading(사주 원국풀이 화면)과 한 글자 차이인 /readings 는
//   딥링크·grep·라우터 매칭에서 서로 오인하기 쉽다. 탭 라벨만 '풀이'(i18n nav.contents)로 둔다.
//
// 목록 데이터 = lib/content/contentSections.ts / 렌더·진입 게이트 = components/ContentGrid.tsx (단일 출처).
// 이 화면은 껍데기(스크롤) + **상단 한 줄(검색 + 보기 토글)** 을 담당한다.
//
// ★상단을 계속 걷어내는 이유(daniel 07-26 → 08-06 재발): 타이틀·부제·구분선·세그먼트·명식·뷰토글이
//   차례로 쌓여 **첫 콘텐츠가 화면 절반 아래**에서 시작했다. 08-06 실측 49%.
//   → 화면 제목('풀이')은 하단 탭이 이미 강조하고 있고, 부제('보고 싶은 주제를 골라 보세요')는
//     검색 placeholder('무엇이 궁금하세요?')와 같은 말이라 **둘 다 제거**했다. 뷰 토글은 검색줄에 합쳤다.
// ─────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // ★상단 안전영역 — 고정 여백은 글자확대 시 잘린다(daniel 07-27)
import { useTranslation } from 'react-i18next';
import { ContentGrid } from '../../components/ContentGrid';
import { NextStepCard } from '../../components/NextStepCard'; // '다음 단계' 퍼널 히어로(나열→저니)
import { ChartPicker } from '../../components/ChartPicker';
import { PressableScale } from '../../components/PressableScale';
import { useHomeViewMode } from '../../lib/ui/homeView'; // ★훅은 **여기서만** 호출 — 아래로는 값만 내린다(ContentGrid 주석 참조)
import { colors, space, font, radius } from '../../lib/theme';

export default function ContentsScreen() {
  // ★고정 상단여백(space(12) 등)은 **글자 크기를 키우면 헤더가 상태바 위로 잘린다**(daniel 07-27 IMG_8215).
  //   상수는 기기 노치·다이내믹아일랜드·글자배율 어느 것도 반영하지 못한다 → 실제 안전영역을 쓴다.
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useHomeViewMode();
  const [reload, setReloadKey] = useState(0); // 명식 전환 시 그리드(배지·티저)·다음단계 카드 재계산 트리거
  // 검색어(daniel 2026-08-06 "너무 나열되어있어서 뭐가뭔지 모르겠어").
  const [q, setQ] = useState('');
  const searching = q.trim().length > 0;
  return (
    // 전역 ContentBackdrop(오행 배경색)이 비치게 투명(홈과 동일 처리).
    <View style={styles.bg}>
      {/* ── 상단 한 줄: 검색 + 보기 토글 — 스크롤 **밖** 고정 ─────────────────
          ① 51종을 스크롤로만 찾는 구조가 '나열'의 근원이었다. 이름 한 낱말로 바로 좁힌다(온디바이스·API 0).
          ② 스크롤 안에 두면 아래로 내려간 뒤엔 못 쓴다 — 정작 '못 찾겠을 때'는 한참 내려간 뒤다.
          ③ keyboard-safe: 검색창이 화면 최상단에 고정이라 키보드가 덮을 수 없다(check:keyboard R1 면제 사유). */}
      <View style={[styles.topBar, { paddingTop: insets.top + space(2) }]}>
        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            value={q}
            onChangeText={setQ}
            placeholder={t('contents.searchPlaceholder', '무엇이 궁금하세요?')}
            placeholderTextColor={colors.inkFaint}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            // ★지우기(✕)는 **직접 그린다**(아래 PressableScale) — RN 의 iOS 전용 지우기 버튼 속성을 쓰면
            //   안드로이드에만 지우기가 없어진다(check:platform P3 가 잡는 플랫폼 갈림). 그 속성은 아예 두지 않는다.
          />
          {searching && (
            <PressableScale style={styles.searchClear} onPress={() => setQ('')} accessibilityLabel={t('common.cancel', '취소')}>
              <Text style={styles.searchClearTx}>✕</Text>
            </PressableScale>
          )}
        </View>
        {/* 보기 방식(카드/리스트) — 검색 중에는 결과가 항상 리스트라 감춘다(누를 수 없는 버튼을 두지 않는다). */}
        {!searching && (
          <View style={styles.viewToggle}>
            {(['card', 'list'] as const).map((mode) => (
              <PressableScale
                key={mode}
                style={[styles.viewTogChip, viewMode === mode && styles.viewTogChipOn]}
                onPress={() => setViewMode(mode)}
                accessibilityLabel={t(mode === 'card' ? 'menu.viewCard' : 'menu.viewList')}
              >
                {/* 글자 없이 기호만 — 검색창 폭을 최대한 남긴다. 뜻은 accessibilityLabel 이 갖는다. */}
                <Text style={[styles.viewTogTx, viewMode === mode && styles.viewTogTxOn]}>{mode === 'card' ? '▦' : '☰'}</Text>
              </PressableScale>
            ))}
          </View>
        )}
      </View>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.wrap}
        keyboardShouldPersistTaps="handled" // 키보드가 떠 있어도 결과 탭이 **첫 번째 탭에** 먹게(안 주면 첫 탭은 키보드만 닫힘)
        keyboardDismissMode="on-drag"
      >
        {/* 검색 중에는 명식·다음단계를 접는다 — 결과만 보이는 게 검색의 목적. */}
        {!searching && (
          <>
            {/* ★대표 명식 — 이 탭에서도 최상단(daniel 2026-07-19). 카드 배지·티저가 적용 명식 기준. */}
            <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
            {/* ★'다음 단계' 히어로(daniel 2026-07-26) — 나열 대신 **지금 이 사람에게 맞는 딱 한 장**을 크게.
                여기서 들어가면 상세 하단 RelatedContent 가 이어받아 '타고타고' 굴러간다(같은 RELATED 큐레이션 재사용). */}
            <NextStepCard reloadKey={reload} />
          </>
        )}
        <ContentGrid query={q} viewMode={viewMode} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },
  screen: { backgroundColor: 'transparent' },
  // padding space(5) = ContentGrid 의 section marginHorizontal:-space(5) 와 짝(가로 스크롤이 화면 끝까지 닿게).
  wrap: { padding: space(5), paddingTop: space(2), paddingBottom: space(24) },
  // 상단 줄 — 스크롤 **밖**(항상 보임). 스크롤과 겹치지 않고 위아래로 놓이므로 배경을 깔지 않는다
  //   (colors.bg 를 깔면 전역 ContentBackdrop 의 오행 배경색과 이 줄만 색이 어긋난다).
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: space(2),
    paddingHorizontal: space(5), paddingBottom: space(2.5), backgroundColor: 'transparent',
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: space(4),
  },
  // ★fontSize 와 lineHeight 는 반드시 짝(고정 lineHeight 면 글자확대 시 잘림 — daniel 07-28). font.body 가 둘 다 갖는다.
  searchInput: { flex: 1, ...font.body, color: colors.ink, paddingVertical: space(2.5) },
  searchClear: { paddingHorizontal: space(1), paddingVertical: space(1) },
  searchClearTx: { fontSize: 15, fontWeight: '800', color: colors.inkFaint },
  // 보기 토글 — 검색줄 오른쪽 끝. 기호만이라 폭이 작다.
  viewToggle: { flexDirection: 'row', gap: space(1), backgroundColor: colors.overlay, borderRadius: radius.pill, padding: space(1), borderWidth: 1, borderColor: colors.line },
  viewTogChip: { paddingHorizontal: space(2.5), paddingVertical: space(2), borderRadius: radius.pill },
  viewTogChipOn: { backgroundColor: colors.ju }, // 활성 = 골드(라이트/다크 자동)
  viewTogTx: { fontSize: 14, fontWeight: '800', color: colors.inkSoft },
  viewTogTxOn: { color: '#15132E' },             // 골드 위 다크 텍스트
});
