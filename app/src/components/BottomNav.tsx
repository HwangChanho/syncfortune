// app/src/components/BottomNav.tsx — 하단 탭 네비게이션(홈 / 풀이 / 커뮤니티 / 도우미 / 마켓)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 하단 네비로 전환. 마켓=운 충전·콘텐츠 구매. 도우미=팔자 도우미(콘텐츠 안내).
//   expo-router Stack 구조 유지 + 커스텀 바(최소 변경). 모든 화면 하단 고정(AdBanner 위).
//   ★현재 경로(usePathname)로 active. 탭은 replace 로 전환(스택 누적 방지).
//   ★네비바 실측 높이 export(getNavBarHeight) — 코치 등 키보드 입력바가 네비바 위에 정확히 붙게 하는 데 사용(전역 바라 KAV가 못 잡음).
//   ★커뮤니티 탭 = 원격 플래그(features.community) ON 일 때만 노출(현재 OFF=관리자 전용).
//
// ★★아이콘(daniel 2026-08-01 "하단 탭바는 아이콘으로 바꾸자")
//   · **이모지가 아니라 벡터 아이콘**이다. 이모지는 OS/폰트마다 모양·크기가 제각각이고 톤이 앱과 안 맞는다
//     (daniel 이 이전부터 이모지를 빼 온 이유). 여기서는 react-native-svg 로 **직접 그린 선 아이콘**을 쓴다.
//   · 새 아이콘 패키지를 넣지 않았다 — 의존성을 추가하면 네이티브 재빌드가 필요해서
//     지금의 '안정화 우선' 기조와 어긋난다. react-native-svg 는 이미 앱에 있고 여러 화면이 쓰고 있다.
//   · 라벨은 남긴다(아이콘만 두면 '풀이'와 '도우미'처럼 뜻이 겹치는 탭을 구분하기 어렵다). 라벨은 작게.
//   · active = 골드(colors.ju) 선·글자 + 상단 짧은 골드 바, inactive = 흐린 잉크.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { PressableScale } from './PressableScale';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFeatureOn } from '../lib/core/features';   // 커뮤니티 노출 = 원격 플래그(my.tsx 와 **같은 판정**)
import { colors, space } from '../lib/theme';

// 탭 전체 정의(순서 = 홈 → 운세 → 풀이 → 마이페이지).
//
// ★★2026-08-18 Boss 결정 — 시안(`니운내운.pdf`) 4탭 채택. 종전 5탭에서 이렇게 옮겼다.
//     · 커뮤니티 → 마이페이지 메뉴(플래그 ON 일 때만·지금은 관리자 전용)
//     · 우니(coach) → 마이페이지 「상담 내역」 + 홈 ⚡바로가기
//     · 마켓 → 마이페이지 「쿠폰함」(+ 운 충전은 지갑 카드의 주 버튼)
//   ⇒ **화면은 하나도 없애지 않았다.** 탭에서 뺀 것은 진입로일 뿐이라 딥링크·기존 push 는 그대로 산다.
//
// ★'운세'(fortune) = 종전 '풀이'(/contents) 탭의 콘텐츠 목록이다. 라우트를 그대로 두고 **라벨만** 바꿨다 —
//   라우트를 바꾸면 홈 배너·도우미·추천이 쓰는 딥링크(/contents?cat=love)가 전부 끊긴다.
// ★'풀이'(readings) = **내가 만든 풀이를 다시 읽는 곳**(신규). 시안 p10·p11 의 본문이 여기서 열린다.
// ★`match` = 이 탭이 '켜진' 것으로 볼 경로 접두사. 종전엔 활성 판정이 렌더 안 if 체인에 손으로
//   적혀 있어서, 탭을 바꾸면 **정의는 바뀌고 판정은 안 바뀌는** 상태가 됐다(4탭 전환에서 실제로 났다).
//   판정을 정의 옆에 두면 탭을 고칠 때 한 군데만 본다.
// ★★2026-08-19 — **3탭(카톡 구조)** 으로 재편(Boss *"하단에는 연락처 커뮤니티 설정 이렇게 구성"*).
//   시작 화면이 카톡형 친구목록이 되면서, 종전 4탭이 하던 일이 친구목록 안으로 들어왔다:
//     · '운세'(/contents 55종)  → 가상 상담사 넷이 주제별로 안내한다
//     · '풀이'(/myreadings)     → 대화 이력이 곧 내가 본 풀이다
//   ⚠️★그래도 **화면을 없애지 않았다.** 탭에서 뺀 것은 진입로일 뿐이고, 두 곳 모두
//     설정(§'내 기록')에 진입로를 남겨 뒀다 — 이 저장소는 "옮길 곳을 먼저 만들고 뺀다"를
//     이미 비싸게 배웠다(홈 블록 접기 때 바이오리듬이 도달 불가가 될 뻔했다).
//     ⇒ 탭에서 빼기 전에 `check:reach` 가 대체 진입로를 확인한다.
// ★★2026-08-20 Boss 손그림 — 탭이 **넷**이다(3 → 4). 둘째가 말풍선 = 대화 목록.
//   앞선 말씀과도 맞는다: *"친구목록 대화리스트 탭해서 들어가면 대화 상세"*.
//   ⇒ 연락처(누구와 이야기할 수 있나)와 대화(누구와 이야기했나)는 **다른 질문**이라 탭이 갈린다.
export const ALL_TABS = [
  { key: 'home', route: '/', match: '' },                      // 연락처(친구목록) — '/' 는 접두사로 못 잡는다(아래 isTabActive)
  { key: 'chats', route: '/chats', match: '/chats' },          // 대화 목록(talk_sessions)
  { key: 'community', route: '/community', match: '/community' },
  // ⚠️★2026-08-21 실측: 시안 p06 마이페이지(`my.tsx`)가 **어디서도 링크되지 않아 도달 불가**였다.
  //   탭이 곧장 `/settings` 로 갔기 때문이다. 만든 화면이 조용히 죽어 있던 것
  //   ([[list-truncation-hides-content]] 과 같은 종류 — 화면은 있는데 길이 없다).
  //   ⇒ 탭은 `/my` 로 보내고, 설정은 그 안의 줄로 간다(기능 유실 0 — `check:reach` 가 확인한다).
  { key: 'my', route: '/my', match: '/my' },
] as const;

/**
 * ★`/my` 탭이 자기 밑의 화면들에서도 켜져 있어야 하는 경로들.
 *   설정·충전·내역으로 들어가면 탭 불이 꺼져 "내가 어디 있지"가 된다.
 *   ⚠️`ALL_TABS.match` 에 넣지 않는 이유: 그 목록은 **탭이 가는 곳**이라 한 탭에 하나여야 한다.
 */
const MY_SUBPATHS = ['/settings', '/coins', '/coinhistory', '/myreadings', '/favorites', '/notifications'] as const;

/**
 * 지금 경로가 이 탭에 속하는가.
 * @param key  탭 키
 * @param path `usePathname()` 값
 * ⚠️`/my` 와 `/myreadings` 는 접두사가 겹친다 — 긴 것부터 보고, 정확 일치도 함께 본다.
 */
export function isTabActive(key: TabKey, path: string): boolean {
  if (key === 'home') return path === '/' || path === '/index';
  // `/my` 밑의 화면(설정·충전·기록)에서도 「내 운」이 켜져 있어야 한다
  if (MY_SUBPATHS.some((m) => path === m || path.startsWith(m + '/') || path.startsWith(m + '?'))) return key === 'my';
  const me = ALL_TABS.find((tb) => tb.key === key)?.match ?? '';
  // 더 긴 match 를 가진 다른 탭이 이 경로를 가져가면 이 탭은 꺼진다(/my vs /myreadings)
  const winner = ALL_TABS
    .filter((tb) => tb.match && (path === tb.match || path.startsWith(tb.match + '/') || path.startsWith(tb.match + '?')))
    .sort((a, b) => b.match.length - a.match.length)[0];
  return !!winner && winner.match === me;
}

type TabKey = (typeof ALL_TABS)[number]['key'];

/** 아이콘 공통 — 24 그리드 · 선(stroke)만 · 채움 없음. 색은 부모가 정한다(active=골드). */
const ICON = { size: 23, viewBox: '0 0 24 24', width: 1.7 } as const;

/**
 * 탭 아이콘 — 뜻이 한눈에 읽히는 최소 형태로 직접 그렸다.
 *   home=집 · contents=문서(풀이 글) · community=사람 둘 · coach=나침반(길 안내) · market=쇼핑백
 * ★도우미를 말풍선이 아니라 **나침반**으로 둔 이유: 팔자 도우미는 대화형 챗이 아니라
 *   '무엇을 볼지 안내'하는 기능으로 바뀌었다(API 0원 전환). 말풍선은 채팅을 기대하게 만든다.
 */
export function TabIcon({ name, color }: { name: TabKey; color: string }) {
  const p = { stroke: color, strokeWidth: ICON.width, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={ICON.size} height={ICON.size} viewBox={ICON.viewBox}>
      {/* 연락처 = 사람 하나 + 목록 줄(카톡 친구목록 자리). ★집 모양을 버린 이유 =
          이제 첫 화면이 '홈'이 아니라 **사람 목록**이라, 집 아이콘은 무엇이 열릴지 잘못 알려 준다. */}
      {name === 'home' && (<>
        <Circle cx="8.6" cy="8.4" r="3.1" {...p} />
        <Path d="M3.2 19.6c0-3.2 2.4-5.2 5.4-5.2s5.4 2 5.4 5.2" {...p} />
        <Path d="M16.4 9.2h4.4M16.4 13h4.4M16.4 16.8h4.4" {...p} />
      </>)}
      {/* 대화 = 말풍선(Boss 손그림의 둘째 칸) */}
      {name === 'chats' && (<>
        <Path d="M4.2 6.6a2.4 2.4 0 0 1 2.4-2.4h10.8a2.4 2.4 0 0 1 2.4 2.4v7.2a2.4 2.4 0 0 1-2.4 2.4H9.8l-4 3.4v-3.4H6.6a2.4 2.4 0 0 1-2.4-2.4z" {...p} />
      </>)}
      {/* 커뮤니티 = 사람 둘 */}
      {name === 'community' && (<>
        <Circle cx="9.2" cy="8.6" r="3" {...p} />
        <Path d="M3.6 19.6c0-3.1 2.5-5 5.6-5s5.6 1.9 5.6 5" {...p} />
        <Path d="M16 6.2a3 3 0 0 1 0 5.9M17.4 14.9c2 .6 3.2 2.2 3.2 4.4" {...p} />
      </>)}
      {/* 설정 = 톱니 */}
      {name === 'my' && (<>
        <Circle cx="12" cy="12" r="3.1" {...p} />
        <Path d="M12 3.4v2.2M12 18.4v2.2M20.6 12h-2.2M5.6 12H3.4M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6M18.1 18.1l-1.6-1.6M7.5 7.5 5.9 5.9" {...p} />
      </>)}
    </Svg>
  );
}

let _navBarHeight = 82; // 실측 전 근사값. onLayout 으로 갱신(아이콘 추가로 높이가 바뀌어도 자동 반영).
// ★★2026-08-20 Boss *"하단에 탭바 아래로 딱 붙여"* — 떠 있던 16pt 를 **0** 으로.
//   종전엔 바가 화면 아래에서 16pt 떠 있어 카드처럼 보였다. 카톡·대부분의 앱은 붙어 있다.
//   ⚠️0 이어도 **안전영역은 따로 지킨다**(아래 렌더의 `insets.bottom`) —
//     0 으로 두고 인셋까지 빼면 홈 인디케이터가 탭을 덮는다.
const NAV_MARGIN_BOTTOM = 0;
// ★Android 시스템 내비 회피(daniel 2026-08-04 "안드로이드/iOS 다를 수 있는 부분 찾아서 고쳐").
//   iOS 는 marginBottom 16 고정 모양을 daniel 이 승인했지만, Android 는 edge-to-edge 라
//   3버튼 내비(인셋 ~48)가 고정 16 여백을 **덮는다**(배너 틈과 같은 뿌리 — 인셋을 아무도 안 받던 문제).
//   Android 만 max(16, 인셋)로 띄우고, getNavBarHeight() 도 같은 값을 쓰게 모듈 변수로 공유한다.
let _navMarginBottom = NAV_MARGIN_BOTTOM;
/** 하단 네비바 실측 높이(px) — 키보드 입력바 위치 계산용(코치 등). 마운트 후 정확값. */
/**
 * 네비바가 **실제로 차지하는 세로 공간**(pt).
 * ⚠️`onLayout` 높이는 **margin 을 포함하지 않는다** — bar 에 `marginBottom: space(4)` 가 있어
 *   그만큼이 빠져 있었다. 이 값을 '키보드 위 입력바' 위치 계산에 쓰는 화면(coach)이 있어,
 *   16pt 가 빠지면 입력바가 그만큼 **떠 보인다**(daniel 2026-08-04 IMG_8351).
 *   ⇒ 레이아웃 높이에 margin 을 더해 '점유 높이'를 돌려준다.
 */
export function getNavBarHeight(): number { return _navBarHeight + _navMarginBottom; }

export function BottomNav() {
  const router = useRouter();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  // Android 만 시스템 내비 인셋 반영(iOS 는 승인된 고정 여백 유지). 렌더마다 모듈 변수 동기화.
  // ★붙이되 **안전영역만큼은** 띄운다(iOS 홈 인디케이터 · Android 3버튼 내비).
  //   종전엔 iOS 만 고정 16pt 였는데, 붙이기로 한 이상 두 OS 가 같은 규칙을 쓰는 게 맞다.
  const marginBottom = Math.max(NAV_MARGIN_BOTTOM, insets.bottom);
  _navMarginBottom = marginBottom;
  const { t } = useTranslation();
  // ★★커뮤니티 탭은 **원격 플래그**로 가린다(2026-08-19 3탭 전환에서 복구).
  //   ⚠️내가 3탭으로 바꾸면서 이 판정을 빠뜨렸다 — `my.tsx` 주석에는
  //     *"커뮤니티 노출 = 원격 플래그(BottomNav 와 같은 판정)"* 라고 적혀 있는데 **여기엔 없었다.**
  //     지금은 플래그가 켜져 있어 결과가 같지만, **끄는 순간 갈린다**(메뉴는 숨고 탭은 남는다).
  //   ⇒ 주석이 '같다'고 말하는 것은 보장이 아니다([[duplicate-ui-single-source]]).
  //     `check:featuregate` 가 두 곳이 같은 판정을 쓰는지 지킨다.
  const commOn = useFeatureOn('community');
  const tabs = ALL_TABS.filter((tb) => tb.key !== 'community' || commOn);
  return (
    <View style={[styles.bar, { marginBottom }]} onLayout={(e) => { _navBarHeight = e.nativeEvent.layout.height; }}>
      {tabs.map((tb) => {
        const on = isTabActive(tb.key, path);
        return (
          <PressableScale key={tb.key} style={styles.tab} onPress={() => { if (!on) router.replace(tb.route); }} hitSlop={6}>
            {on && <View style={styles.activeBar} />}
            <TabIcon name={tb.key} color={on ? colors.ju : colors.inkFaint} />
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>{t(`nav.${tb.key}`)}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // 네비바 배경 = 카드 서피스(라이트=연베이지, 다크=#221F44) — 배경(한지/달밤) 위에서 바로 도드라지게(daniel 07-03)
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.card, paddingBottom: space(3), paddingTop: space(3) }, // ★붙인 뒤엔 24pt 아래 패딩이 과하다(12pt). marginBottom 은 렌더에서

  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  // active 상단 짧은 골드 바
  activeBar: { position: 'absolute', top: -space(4), width: 30, height: 2.5, borderRadius: 2, backgroundColor: colors.ju }, // paddingTop 과 일치

  // ★아이콘이 뜻을 지고 라벨은 보조 — 그래서 15 → 11.5 로 낮췄다. lineHeight 를 짝으로 두지 않으면 잘린다.
  label: { fontSize: 11.5, lineHeight: 15, fontWeight: '700', color: colors.inkFaint },
  labelOn: { color: colors.ju, fontWeight: '800' },
});
