// app/src/components/WebShell.tsx — 넓은 화면(웹)에서 앱을 '데스크톱 레이아웃'으로 감싼다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-15: *"웹용 UI로 디자인 UX 개편할 거야"* (iOS 4.3(b) 리젝 대비 웹 전환)
//
// ■ 무엇이 문제였나 (1440px 로 띄워 실측)
//   폰 앱이 그대로 늘어났다 — 카드·배너·문구가 **1560px 전폭**으로 퍼지고,
//   하단 탭바가 화면을 가로지르고, 하우스 광고 이미지는 크롭이 깨져 무슨 그림인지 안 보였다.
//   읽는 줄 길이가 폰의 3배가 되니 "만들다 만 화면"으로 읽힌다.
//
// ■ 왜 화면을 51개 고치지 않고 여기 한 곳인가
//   이 프로젝트의 '길목' 패턴이다(로깅·광고 게이트와 같은 자리).
//   본문 폭과 내비게이션은 **레이아웃의 성질**이지 화면마다의 선택이 아니다.
//   여기서 폭을 잡으면 홈·풀이·관계 지도·만세력이 전부 따라온다.
//
// ■ 경계 (건드리지 않는 것)
//   · **네이티브(iOS/Android)는 무영향** — `Platform.OS === 'web'` 이 아니면 children 을 그대로 돌려준다.
//   · **모바일 웹(<900px)도 무영향** — 폰 폭에서는 지금 레이아웃이 이미 정답이다.
//   ⇒ 바뀌는 건 **넓은 웹 화면 하나뿐**이다.
//
// ⚠️여기서 '보기 좋은 값'을 화면마다 열지 않는다(maxWidth 를 prop 으로 받지 않는다).
//   열면 화면마다 폭이 갈리고, 그게 [[duplicate-ui-single-source]] 가 말하는 그 실패다.
// ═══════════════════════════════════════════════════════════════════════════
import type { ReactNode } from 'react';
import { Platform, View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ALL_TABS, TabIcon } from './BottomNav';   // ★탭 정의·아이콘은 하단 내비와 **같은 출처**
import { useFeatureOn } from '../lib/core/features';
import { CONTENT_ROUTES } from '../lib/content/contentSections'; // 읽는 화면 판정 — 손으로 안 적고 콘텐츠 목록에서 파생
import { colors, radius, space } from '../lib/theme';

/** 사이드바가 서는 최소 폭. 이보다 좁으면 폰 레이아웃(하단 탭)이 맞다. */
export const WEB_WIDE = 900;
/** **글을 읽는 화면**의 최대 폭 — 줄이 길어지면 눈이 다음 줄을 놓친다. */
export const WEB_COLUMN = 760;
/** **그리드·목록 화면**의 최대 폭 — 가로를 실제로 쓰는 화면. */
export const WEB_STAGE = 1160;
/** 3열까지 펼칠 수 있는 폭(그리드 화면 기준). */
export const WEB_XWIDE = 1180;
const SIDEBAR = 248;

/**
 * 가로를 **쓰는** 화면 목록 — 카드 그리드·지도·목록.
 * ★여기에 없는 화면은 전부 '글'로 본다(760px). 화면마다 폭을 고르게 하지 않는 이유는
 *   그러면 곧 화면마다 폭이 갈리기 때문이다 — 정책은 한 표에서만 바뀐다.
 */
const WIDE_ROUTES = ['/', '/contents', '/category', '/relationmap', '/charts', '/market', '/community'];
/**
 * **폼 화면** — 입력이 주인 화면은 더 좁아야 한다.
 * 글은 760 이 편하지만, 입력창이 760 으로 늘어나면 라벨과 입력 사이가 멀어져 한 덩어리로 안 읽힌다.
 */
const FORM_ROUTES = ['/register', '/light'];
export const WEB_FORM = 560;
/**
 * **콘텐츠(읽는) 화면**의 지면 — 히어로가 넓게 깔리고 본문은 그 안에서 좁아진다(브런치·29CM 식).
 * 라우트 목록은 `contentSections` 에서 파생된다 — 콘텐츠가 늘면 자동으로 따라온다.
 */
export const WEB_READ = 1000;

/** 지금 '넓은 웹'인가 — 레이아웃이 하단 탭 대신 사이드바를 써야 하는 상태. */
export function useWideWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WEB_WIDE;
}

/**
 * 이 화면에서 카드를 **몇 열로** 놓을 것인가.
 * @returns 1 = 폰(네이티브·모바일 웹) · 2~3 = 넓은 웹
 * ★화면이 직접 `Platform.OS`·픽셀을 보지 않게 한다. 판단은 여기 한 곳.
 */
export function useWebCols(): number {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < WEB_WIDE) return 1;
  return width >= WEB_XWIDE ? 3 : 2;
}

/**
 * 넓은 웹에서 좌측 내비 + 가운데 본문 컬럼으로 감싼다.
 * @param children 앱의 화면 스택(그대로 넘어온다 — 화면은 자기가 웹인지 모른다)
 */
export function WebShell({ children }: { children: ReactNode }) {
  const wide = useWideWeb();
  const pathname = usePathname();
  if (!wide) return <>{children}</>;
  // 그리드 화면이면 가로를 쓰고, 글 화면이면 줄 길이를 지킨다
  const isWideRoute = WIDE_ROUTES.some((r) => (r === '/' ? pathname === '/' : pathname?.startsWith(r)));
  const isForm = FORM_ROUTES.some((r) => pathname?.startsWith(r));
  const isContent = !!pathname && CONTENT_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  return (
    <View style={styles.row}>
      <WebSidebar />
      {/* 본문 — 가운데 정렬 컬럼. 바깥 여백은 앱 배경이 그대로 비친다(전역 ContentBackdrop) */}
      <View style={styles.stage}>
        <View style={[styles.column, { maxWidth: isWideRoute ? WEB_STAGE : isForm ? WEB_FORM : isContent ? WEB_READ : WEB_COLUMN }]}>{children}</View>
      </View>
    </View>
  );
}

/** 좌측 고정 내비 — 하단 탭바의 데스크톱 대응물(같은 탭·같은 아이콘·같은 라우팅). */
function WebSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const commOn = useFeatureOn('community');
  const tabs = ALL_TABS.filter((tb) => tb.key !== 'community' || commOn);

  return (
    <View style={styles.side}>
      <View style={styles.brand}>
        <Text style={styles.brandTx}>니운내운</Text>
        <Text style={styles.brandSub}>사주와 자미두수를 결합한 해석</Text>
      </View>
      {tabs.map((tb) => {
        // 홈만 정확히 일치로 본다 — '/' 는 startsWith 로 보면 모든 경로에 걸린다
        const on = tb.route === '/' ? pathname === '/' : !!pathname?.startsWith(tb.route);
        return (
          <Pressable
            key={tb.key}
            style={({ hovered }: any) => [styles.item, on && styles.itemOn, hovered && !on && styles.itemHover]}
            onPress={() => router.replace(tb.route as never)}
          >
            <TabIcon name={tb.key} color={on ? colors.ju : colors.inkFaint} />
            <Text style={[styles.itemTx, on && styles.itemTxOn]}>{t(`nav.${tb.key}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * 바텀시트를 **가운데 다이얼로그**로 바꾸는 조각(넓은 웹 전용).
 *
 * 화면 아래에서 올라오는 시트는 **엄지 반경** 안에 손잡이를 두려는 폰 패턴이다.
 * 마우스에는 반경이 없고, 1440px 화면 아래쪽에 붙은 패널은 오히려 멀다 —
 * 웹에서 같은 역할을 하는 건 가운데 뜨는 다이얼로그다.
 *
 * @returns `backdrop`/`sheet` — 각 시트의 기존 스타일 **뒤에 덧붙이면** 된다(좁은 화면이면 null).
 * ★시트마다 값을 정하지 않는다. 폭·모서리·최대높이는 여기서만 바뀐다.
 */
export function useSheetLayout(): { backdrop: object | null; sheet: object | null } {
  const wide = useWideWeb();
  if (!wide) return { backdrop: null, sheet: null };
  return {
    backdrop: { justifyContent: 'center', alignItems: 'center', padding: space(6) },
    sheet: {
      width: '100%', maxWidth: 560, maxHeight: '84%', alignSelf: 'center',
      borderRadius: radius.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    },
  };
}

/**
 * ★웹에서 **문서가 아니라 본문만** 스크롤하게 못박는다(2026-08-16).
 *
 * 이걸 안 하면 문서 전체가 길어져 **사이드바까지 같이 밀려 올라간다.**
 * 그 상태로 화면에 들어오면(스크롤이 아래에 남아 있으면) **빈 영역만 보여서 "흰 화면"으로 읽힌다** —
 * 실제로 그렇게 오진했다. DOM 에는 내용이 다 있었고 위로 올리면 멀쩡했다.
 * 데스크톱 앱은 좌측 내비가 고정이고 본문만 흐른다 — 그게 맞는 모양이기도 하다.
 */
const WEB_VIEWPORT = Platform.OS === 'web' ? ({ height: '100vh', maxHeight: '100vh', overflow: 'hidden' } as any) : null;

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', ...(WEB_VIEWPORT ?? {}) },
  stage: { flex: 1, alignItems: 'center', ...(Platform.OS === 'web' ? ({ height: '100%', overflow: 'hidden' } as any) : {}) },
  // 컬럼이 화면 높이를 다 쓰게 flex:1 — 안쪽 화면들이 자기 스크롤을 갖는다. maxWidth 는 라우트가 정한다.
  column: { flex: 1, width: '100%', ...(Platform.OS === 'web' ? ({ height: '100%' } as any) : {}) },

  side: {
    width: SIDEBAR, paddingTop: space(7), paddingHorizontal: space(3),
    borderRightWidth: 1, borderRightColor: colors.line, backgroundColor: colors.card,
  },
  brand: { paddingHorizontal: space(3), marginBottom: space(6) },
  brandTx: { color: colors.ink, fontSize: 21, lineHeight: 28, fontWeight: '800' },
  brandSub: { color: colors.inkSoft, fontSize: 12, lineHeight: 18, marginTop: 4 },

  item: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    paddingVertical: space(3), paddingHorizontal: space(3), borderRadius: radius.md, marginBottom: 4,
  },
  // ★hover 는 웹에만 있는 어포던스다 — 없으면 '누를 수 있는지' 모른다
  itemHover: { backgroundColor: colors.sunk },
  itemOn: { backgroundColor: colors.juSoft },
  itemTx: { color: colors.inkSoft, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  itemTxOn: { color: colors.ju, fontWeight: '800' },
});
