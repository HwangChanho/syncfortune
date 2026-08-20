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

import { ALL_TABS, TabIcon, isTabActive } from './BottomNav';   // ★탭 정의·아이콘은 하단 내비와 **같은 출처**
import { useFeatureOn } from '../lib/core/features';           // 커뮤니티 노출 = 원격 플래그(BottomNav 와 **같은 판정**)
import { CONTENT_ROUTES } from '../lib/content/contentSections'; // 읽는 화면 판정 — 손으로 안 적고 콘텐츠 목록에서 파생
import { colors, radius, space } from '../lib/theme';

/** 사이드바가 서는 최소 폭. 이보다 좁으면 폰 레이아웃(하단 탭)이 맞다. */
export const WEB_WIDE = 900;
/** **글을 읽는 화면**의 최대 폭 — 줄이 길어지면 눈이 다음 줄을 놓친다. */
export const WEB_COLUMN = 760;
/**
 * **그리드·목록 화면**의 최대 폭 — 가로를 실제로 쓰는 화면.
 *
 * ★1160 → 1560 (daniel 2026-08-17: *"오른쪽 컨텐츠 영역 양끝에 여백이 너무 많아"*)
 *   실측(1710px 창): 사이드바 248 → 쓸 수 있는 폭 1462 인데 컬럼이 1160 이라
 *   **좌·우 여백이 각 151px**(합 302 = 화면의 21%)이었다. 격자 화면에서 그만큼은 낭비다.
 *
 * ★고정 폭이 문제의 근원이다 — 화면이 커질수록 여백이 **같이 커진다.**
 *   그래서 값만 올리지 않고 `stage` 에 좌우 패딩(`STAGE_PAD`)을 줘서
 *   **평소엔 패딩만큼만 남고**, 초광폭(≈2000px+)에서만 이 상한이 걸리게 했다.
 *   결과(1710px): 컬럼 1414 · 여백 각 24 — 격자 카드가 그만큼 커진다.
 *
 * ⚠️읽는 화면(`WEB_READ`)은 **일부러 좁게 둔다** — 줄이 길어지면 눈이 다음 줄을 놓친다
 *   (브런치·29CM 방향: 히어로는 넓게, 본문은 좁게). 여백이 남는 게 그 화면에선 정상이다.
 */
export const WEB_STAGE = 1560;
/** 스테이지 좌우 숨통 — 컬럼이 사이드바·화면 끝에 붙지 않게. 여백은 '남는 것'이 아니라 이 값이어야 한다. */
export const STAGE_PAD = 24;
/** 3열까지 펼칠 수 있는 폭(그리드 화면 기준). */
export const WEB_XWIDE = 1180;
const SIDEBAR = 248;

/**
 * 가로를 **쓰는** 화면 목록 — 카드 그리드·지도·목록.
 * ★여기에 없는 화면은 전부 '글'로 본다(760px). 화면마다 폭을 고르게 하지 않는 이유는
 *   그러면 곧 화면마다 폭이 갈리기 때문이다 — 정책은 한 표에서만 바뀐다.
 */
// ⚠️`/chats` 는 **2칸 화면**이라 반드시 여기 있어야 한다(2026-08-20) —
//   빠지면 좁은 컬럼(WEB_COLUMN) 안에 두 칸을 욱여넣어 왼쪽 목록이 화면 한가운데 뜬다.
//   `check:widepane` 이 '2칸을 쓰는 라우트'가 여기 등록됐는지 지킨다.
const WIDE_ROUTES = ['/', '/chats', '/contents', '/category', '/relationmap', '/charts', '/market', '/community'];
/**
 * **폼 화면** — 입력이 주인 화면은 더 좁아야 한다.
 * 글은 760 이 편하지만, 입력창이 760 으로 늘어나면 라벨과 입력 사이가 멀어져 한 덩어리로 안 읽힌다.
 */
const FORM_ROUTES = ['/register', '/light'];
export const WEB_FORM = 560;
/**
 * **콘텐츠(읽는) 화면**의 지면 — 히어로가 넓게 깔리고 본문은 그 안에서 좁아진다(브런치·29CM 식).
 * 라우트 목록은 `contentSections` 에서 파생된다 — 콘텐츠가 늘면 자동으로 따라온다.
 *
 * ★1000 → **1360** (daniel 2026-08-17 여백 지적 · 2026-08-18 본문 캡 완료 후 적용).
 *   실측(1710px 창): 여백이 **각 231px** 이었다.
 *
 * ★**순서가 중요했다.** 처음엔 캡 없이 먼저 넓혔다가 되돌렸다 —
 *   "본문은 `SpecialContentScreen` 이 680 으로 캡하니 안전"이라 봤는데, 그 근거인 grep 이
 *   **import 경로**(`from '…/SpecialContentScreen'`)에 걸린 것이었다. 실제로 그 컴포넌트로 렌더하는
 *   화면은 12개뿐이고 **17개는 `ContentHero` 만 가져와 본문을 자기가 그렸다**(캡 없음).
 *   그래서 넓히자 본문 문장이 **1269px**(한글 80자/줄)까지 퍼졌다.
 *   ⇒ 17개에 `useReadBody()` 를 붙여 캡을 채운 **뒤에** 지면을 넓혔다.
 *   ★교훈: grep 히트 수를 '사용처 수'로 읽지 말 것 — 같은 모듈에서 **다른 것**을 가져오는 파일이 섞인다.
 *
 * ※`WEB_BODY`(680)와 짝이다: **지면은 넓고 글은 좁다.** 히어로·전폭 요소가 지면을 쓰고 글만 묶인다.
 */
export const WEB_READ = 1360;

/**
 * 읽는 화면 **본문(글)** 의 최대 폭 — 지면(`WEB_READ`)과 다르다.
 * 한글 본문은 이 폭에서 한 줄이 40~45자로 떨어진다. 더 넓으면 눈이 다음 줄을 놓친다.
 */
export const WEB_BODY = 680;

/**
 * 읽는 화면의 **본문 캡** — 히어로는 지면 전체, 글은 좁게(브런치·29CM 방향).
 *
 * @returns 넓은 웹이면 `{ width:'100%', maxWidth: WEB_BODY, alignSelf:'center' }`, 그 밖에서는 **undefined**
 *          (폰·네이티브는 그대로 지나간다 — 오버라이드 객체를 만들지 않는다)
 *
 * @example
 * const readBody = useReadBody();
 * <ContentHero … />            // 히어로는 지면 전체
 * <View style={readBody}>…</View>   // 글은 좁게
 *
 * ★왜 훅으로 뽑았나(2026-08-17): 이 캡이 `SpecialContentScreen` 안에만 인라인으로 있었고,
 *   `ContentHero` 만 가져다 쓰는 화면 **17개**에는 없었다. 그래서 지면을 넓히자 그 17개의
 *   본문 문장이 **1269px**(한글 80자/줄)까지 퍼졌다 — 실측으로 발견.
 *   ⇒ 캡을 한 곳에 두고 두 계열이 같은 값을 쓰게 한다(`check:readbody` 가 누락을 감시).
 */
export function useReadBody(): { width: '100%'; maxWidth: number; alignSelf: 'center' } | undefined {
  const wide = useWideWeb();
  return wide ? { width: '100%', maxWidth: WEB_BODY, alignSelf: 'center' } : undefined;
}

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
  // ★★웹은 **연락처와 대화가 한 뷰**다(Boss 2026-08-20 *"연락처랑 대화를 하나의 뷰에 넣으라니깐 칸 나눠서"*).
  //   연락처 화면이 이미 [친구목록 | 대화] 두 칸이라, 대화가 **거기 안에 있다.**
  //   ⇒ 사이드바에 「대화」를 또 두면 **같은 것으로 가는 문이 둘**이고,
  //     누르면 왼쪽 칸만 바뀌어서 사용자는 무엇이 달라졌는지 모른다.
  //   ⚠️폰은 다르다 — 화면이 좁아 두 칸을 못 쓰므로 탭으로 갈린다(`BottomNav` 는 4탭 그대로).
  //     즉 **웹에서만** 감춘다. 라우트(`/chats`)는 살아 있다(딥링크·폰 공용).
  const commOn = useFeatureOn('community');
  const tabs = ALL_TABS.filter((tb) =>
    tb.key !== 'chats' && (tb.key !== 'community' || commOn));

  return (
    <View style={styles.side}>
      {/* ★부제는 뺐다(Boss 2026-08-20) — 카톡형 친구목록에선 사이드바가 '설명하는 자리'가 아니라
          '이름표'다. 서비스 설명은 랜딩(`WebLanding`)이 맡는다(거기 문구는 그대로다). */}
      <View style={styles.brand}>
        <Text style={styles.brandTx}>니운내운</Text>
      </View>
      {tabs.map((tb) => {
        // ★판정은 BottomNav 와 **같은 함수**를 쓴다(2026-08-18).
        //   종전엔 여기 따로 `startsWith(tb.route)` 를 적어 뒀는데, `/my` 가 `/myreadings` 까지
        //   삼켜 두 탭이 동시에 켜진다([[duplicate-ui-single-source]] — 같은 판정을 두 번 쓰면 갈린다).
        const on = isTabActive(tb.key, pathname ?? '');
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
  // ★좌우 패딩 = 컬럼이 사이드바·화면 끝에 붙지 않게 하는 **최소 숨통**(daniel 2026-08-17 여백 지적).
  //   종전엔 패딩이 없고 컬럼 maxWidth(1160)만 있어서, 남는 공간이 그대로 여백이 됐다(각 151px).
  //   이제 여백은 '남는 것'이 아니라 이 값이다 — 화면이 커져도 컬럼이 먼저 자란다.
  stage: {
    flex: 1, alignItems: 'center', paddingHorizontal: STAGE_PAD,
    ...(Platform.OS === 'web' ? ({ height: '100%', overflow: 'hidden' } as any) : {}),
  },
  // 컬럼이 화면 높이를 다 쓰게 flex:1 — 안쪽 화면들이 자기 스크롤을 갖는다. maxWidth 는 라우트가 정한다.
  column: { flex: 1, width: '100%', ...(Platform.OS === 'web' ? ({ height: '100%' } as any) : {}) },

  side: {
    width: SIDEBAR, paddingTop: space(7), paddingHorizontal: space(3),
    borderRightWidth: 1, borderRightColor: colors.line, backgroundColor: colors.card,
  },
  brand: { paddingHorizontal: space(3), marginBottom: space(6) },
  brandTx: { color: colors.ink, fontSize: 21, lineHeight: 28, fontWeight: '800' },

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
