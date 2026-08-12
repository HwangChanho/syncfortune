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
import { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // ★상단 안전영역 — 고정 여백은 글자확대 시 잘린다(daniel 07-27)
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router'; // 홈 배너 → 카테고리 딥링크(/contents?cat=love)
import { SECTIONS } from '../../lib/content/contentSections'; // 상단 카테고리 칩 = 섹션에서 파생(목록 이중관리 금지)
import { ContentGrid } from '../../components/ContentGrid';
import { MonthHeroCard } from '../../components/MonthHeroCard'; // 이달의 운세 **펼침** 카드(daniel 08-06 IMG_8409)
import { NextStepCard } from '../../components/NextStepCard'; // '다음 단계' 퍼널 히어로(나열→저니)
import { ChartPicker } from '../../components/ChartPicker';
import { loadRepChart } from '../../lib/engine/myChart'; // 명식 유무 판정(홈과 같은 관용구)
import { PressableScale } from '../../components/PressableScale';
import { useHomeViewMode } from '../../lib/ui/homeView'; // ★훅은 **여기서만** 호출 — 아래로는 값만 내린다(ContentGrid 주석 참조)
import { colors, space, font, radius } from '../../lib/theme';

export default function ContentsScreen() {
  // ★고정 상단여백(space(12) 등)은 **글자 크기를 키우면 헤더가 상태바 위로 잘린다**(daniel 07-27 IMG_8215).
  //   상수는 기기 노치·다이내믹아일랜드·글자배율 어느 것도 반영하지 못한다 → 실제 안전영역을 쓴다.
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useHomeViewMode();
  const [reload, setReloadKey] = useState(0); // 명식 전환 시 그리드(배지·티저)·다음단계 카드 재계산 트리거
  // 검색어(daniel 2026-08-06 "너무 나열되어있어서 뭐가뭔지 모르겠어").
  const [q, setQ] = useState('');
  // ★명식 유무 — 없으면 '가볍게 보기'로 안내한다(daniel 2026-08-13 "명식 없는걸로").
  //   왜 필요했나: `/light`(생년월일만으로 성격유형·일주) 는 잘 만들어져 있는데 **입구가 홈 하나뿐**이었다.
  //   풀이탭·마켓·공유링크로 들어온 사람은 그 존재를 영영 모른다 — 여기가 '매장 안'인데
  //   명식이 없으면 카드 54장이 전부 등록 폼으로 이어진다.
  //   기본값 true = 첫 프레임에 안내가 번쩍이지 않게(대개 명식이 있다).
  const [hasChart, setHasChart] = useState(true);
  useEffect(() => { let alive = true; loadRepChart().then((r) => { if (alive) setHasChart(!!r); }).catch(() => {}); return () => { alive = false; }; }, [reload]);
  const searching = q.trim().length > 0;
  // ── 카테고리(주제) 선택 ────────────────────────────────────────────────
  // daniel 2026-08-06: "상단에 연애 재물 사람 등등 카테고리별로 있어서 선택할 수 있게 하고
  //   하위에는 상단에 무료 컨텐츠만 노출" — 무료로 먼저 맛보고 궁금해질 때 유료로 넘어가는 퍼널.
  //   딥링크(`/contents?cat=love`)로도 들어온다 — 홈 배너가 주제별로 여기를 가리킨다.

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
            {/* ★대표 명식 = **제일 위**(daniel 2026-08-07 "풀이에서 명식을 제일 상단으로 올려").
                아래의 모든 것(이달의 운세·다음 단계·카드 배지·티저)이 **이 명식 기준**으로 계산된다 —
                누구 것인지 먼저 보이지 않으면 그 아래 내용이 무엇에 대한 것인지 알 수 없다. */}
            {hasChart ? (
              <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
            ) : (
              /* ★명식이 없을 때 = 명식 선택기 대신 **먼저 결과를 보여주는 길**.
                 홈 배너와 같은 문구를 쓴다(같은 약속을 두 번 다르게 말하지 않는다). */
              <PressableScale style={styles.lightCard} onPress={() => router.push('/light')}>
                <Text style={styles.lightTitle}>{t('home.noChartTitle', 'AI가 분석하는 나 — 여기서 시작')}</Text>
                <Text style={styles.lightSub}>{t('home.noChartSub2', '생년월일만 넣으면 성격유형과 일주를 바로 볼 수 있어요. 가입도, 저장도 안 해요.')}</Text>
                <View style={styles.lightBtn}><Text style={styles.lightBtnTx}>{t('home.lightCta', '가볍게 보기')}</Text></View>
              </PressableScale>
            )}
            {/* ★이달의 운세 = 풀이탭의 앵커(daniel 2026-08-06).
                비유(daniel): 홈 배너 = 백화점 밖 사람을 **금액 없이** 들어오게 / 풀이탭 = 매장 안.
                  매장에 들어온 사람에게 처음 내미는 것도 **무료**여야 한다 — 이달의 운세(무료·온디바이스)를
                  배너 크기로 먼저 보여주고, 아래 '다음 단계'가 그와 이어지는 콘텐츠로 데려간다. */}
            <MonthHeroCard reloadKey={reload} />
            {/* ★'다음 단계' 히어로(daniel 2026-07-26) — 나열 대신 **지금 이 사람에게 맞는 딱 한 장**을 크게.
                여기서 들어가면 상세 하단 RelatedContent 가 이어받아 '타고타고' 굴러간다(같은 RELATED 큐레이션 재사용). */}
            <NextStepCard reloadKey={reload} />
          </>
        )}
        {/* ── 카테고리 목록 — 누르면 **새 화면**에서 하위 항목(daniel 2026-08-06) ──────────
            "카테고리 이렇게 나누고 타고 들어가면 새로운 뷰에서 하위항목 나오게 하자".
            종전엔 한 화면에 전 섹션(50여 장)을 이어 붙여 '들어왔다'는 감각이 없었다.
            검색 중에는 카테고리 대신 결과만(검색은 전 영역이 대상). */}
        {searching ? (
          <ContentGrid query={q} viewMode={viewMode} />
        ) : (
          <View style={styles.catList}>
            {SECTIONS.map((sec) => (
              <PressableScale key={sec.key} style={styles.catCard} onPress={() => router.push(`/category/${sec.key}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catCardTitle}>{t(sec.titleKey)}</Text>
                  {sec.descKey ? <Text style={styles.catCardDesc} numberOfLines={1}>{t(sec.descKey)}</Text> : null}
                </View>
                {/* ★항목 수는 빼 둔다(daniel 2026-08-06) — 숫자가 적으면 빈약해 보이고, 많아도 의미가 없다. */}
                <Text style={styles.catCardArrow}>›</Text>
              </PressableScale>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── '가볍게 보기' 안내(명식 없을 때만) — 홈 배너와 같은 톤 ──
  lightCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), alignItems: 'center', gap: space(1.5), marginBottom: space(3) },
  lightTitle: { color: colors.ju, fontWeight: '900', fontSize: 16, lineHeight: 23, textAlign: 'center' },
  lightSub: { color: colors.inkSoft, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  lightBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(6), marginTop: space(2) },
  lightBtnTx: { color: colors.bg, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  bg: { flex: 1, backgroundColor: 'transparent' },
  screen: { backgroundColor: 'transparent' },
  // padding space(5) = ContentGrid 의 section marginHorizontal:-space(5) 와 짝(가로 스크롤이 화면 끝까지 닿게).
  wrap: { padding: space(5), paddingTop: space(2), paddingBottom: space(24) },
  // 상단 줄 — 스크롤 **밖**(항상 보임). 스크롤과 겹치지 않고 위아래로 놓이므로 배경을 깔지 않는다
  //   (colors.bg 를 깔면 전역 ContentBackdrop 의 오행 배경색과 이 줄만 색이 어긋난다).
  // ★alignItems:'stretch' — 토글이 검색창과 **같은 높이**가 되게(center 로 두면 토글이 더 커져
  //   보조 버튼이 주인공인 검색창보다 도드라진다. 실측 08-06).
  topBar: {
    flexDirection: 'row', alignItems: 'stretch', gap: space(2),
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
  // 카테고리 카드 — 한 줄에 하나. 제목 + 부제 + 항목 수 + ›
  catList: { gap: space(2.5) },
  catCard: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    paddingVertical: space(4), paddingHorizontal: space(4),
  },
  catCardTitle: { fontSize: 17, lineHeight: 24, fontWeight: '900', color: colors.ink, letterSpacing: 0.2 },
  catCardDesc: { fontSize: 12.5, lineHeight: 18, color: colors.inkSoft, marginTop: 2 },
  catCardCount: { fontSize: 13, lineHeight: 18, fontWeight: '800', color: colors.inkFaint },
  catCardArrow: { fontSize: 22, lineHeight: 26, fontWeight: '700', color: colors.inkFaint },
  // (구) 카테고리 칩 — 카드 구조로 대체됨. 스타일은 되돌릴 때를 위해 남겨 둔다.
  catBar: { flexGrow: 0, backgroundColor: 'transparent' },
  catRow: { gap: space(2), paddingHorizontal: space(5), paddingBottom: space(3) },
  catChip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill, backgroundColor: colors.overlay, borderWidth: 1, borderColor: colors.line },
  catChipOn: { backgroundColor: colors.ju, borderColor: colors.ju }, // 선택 = 골드(라이트/다크 자동)
  // ★lineHeight 는 fontSize 와 **반드시 짝**(daniel 07-28 교훈) — 없으면 글자확대 배율에서 위아래가 잘린다.
  //   08-06 실물(IMG_8409)에서 '전체·인기·연애'가 '저체·이기·여애'로 잘려 보였다.
  catTx: { fontSize: 13.5, lineHeight: 19, fontWeight: '800', color: colors.inkSoft, letterSpacing: 0.2 },
  catTxOn: { color: '#15132E' },
  // 보기 토글 — 검색줄 오른쪽 끝. 기호만이라 폭이 작다.
  //   ★활성 표시를 **연한 골드 배경 + 골드 글자**로(꽉 찬 골드는 보조 버튼이 검색창보다 튄다).
  viewToggle: { flexDirection: 'row', gap: space(1), backgroundColor: colors.overlay, borderRadius: radius.pill, padding: space(1), borderWidth: 1, borderColor: colors.line },
  viewTogChip: { justifyContent: 'center', paddingHorizontal: space(2.5), borderRadius: radius.pill }, // 세로 패딩 없음 = 부모(stretch) 높이에 맞춤
  viewTogChipOn: { backgroundColor: colors.juSoft },
  viewTogTx: { fontSize: 14, fontWeight: '800', color: colors.inkFaint },
  viewTogTxOn: { color: colors.ju },
});
