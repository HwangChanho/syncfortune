// app/src/app/(app)/my.tsx — 하단탭 「마이페이지」 (시안 `니운내운.pdf` p06)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 왜 생겼나 (Boss 2026-08-18 — 시안 4탭 채택)
//   종전엔 '나에 관한 것'이 세 군데로 흩어져 있었다 — 운 잔액은 마켓, 계정·언어·글자크기는 설정,
//   커뮤니티·우니는 각자 탭. 시안은 그걸 **한 화면**으로 모은다.
//   ⇒ 탭이 5개에서 4개로 줄어드는 대신, 사라진 탭들의 화면은 **전부 여기서 갈 수 있다**(기능 유실 0).
//
// ■ 구성 — ★2026-08-21 **콘티 4면 실측대로 다시 맞췄다**
//   ①헤더: 워드마크 좌 · 🔔 · ⚙️
//   ②프로필: **사각 라운드 사진(좌)** + 닉네임 + 상태메시지 + 「프로필 편집」
//   ③운 카드: **연보라 그라데이션** · 「내 운」 · 큰 잔액 · 「운 충전 / 사용 내역」 · 우측 → 원
//   ④메뉴 3묶음 — 내 활동 4 · 운 관리 3 · 설정 3
//
//   ⚠️★어제 내가 추측으로 넣은 항목은 **거의 다 틀렸다**(운세 기록·찜한 콘텐츠·쿠폰함·내 명식…).
//     콘티가 정본이다. 지금 항목은 콘티에서 그대로 옮긴 것이고, 갈 곳이 없던 셋은 화면을 만들었다
//     (`/myposts`·`/mycomments`·`/myteachers`).
//
// ★잔액은 `useCoinBalance(session)` **한 곳**에서만 읽는다([[coin-balance-single-hook]]).
//   화면마다 따로 조회하면 같은 화면 안에서 숫자가 갈린다(실제로 겪은 사고).
// ⚠️조회 실패(null)를 0으로 그리지 않는다 — 0원이라고 오해해 충전을 유도하면 그게 곧 과금 유도다.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';   // ★상단 안전영역 — 헤더가 없는 화면이라 직접 받는다(고정 여백은 글자확대 시 잘린다)
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { elementAvatar } from '../../lib/ui/brandAsset';
import { PressableScale } from '../../components/PressableScale';
import { BrandWordmark } from '../../components/BrandWordmark';
import { useAuth } from '../../lib/useAuth';
import { useCoinBalance } from '../../lib/billing/coins';
import { colors, radius, space, font, shadow } from '../../lib/theme';
import { useFeatureOn } from '../../lib/core/features';
import { useWideWeb } from '../../components/WebShell';   // 커뮤니티 노출 = 원격 플래그(BottomNav 와 같은 판정)

/** 운 카드 그라데이션 — 콘티의 연보라. ★강조색(오행)과 무관하게 **고정**이다:
 *  이 카드는 '돈'을 말하는 자리라 테마마다 색이 바뀌면 무엇을 뜻하는 카드인지 흐려진다. */
const GRAD = ['#EFEAFB', '#E4E9FA'] as const;

/** 메뉴 한 줄. `admin` 이면 관리자에게만 보인다. */
type Row = { key: string; icon: string; label: string; route: string; admin?: boolean };
/** 묶음 — 콘티는 메뉴를 **세 덩이**로 나눈다(한 줄로 열 개를 늘어놓으면 아무것도 안 읽힌다). */
type Group = { key: string; title: string; rows: Row[] };

export default function MyPageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const balance = useCoinBalance(session);   // null = 조회 실패/비로그인 (0 과 구분)
  const commOn = useFeatureOn('community');
  const insets = useSafeAreaInsets();
  const wideWeb = useWideWeb();   // 넓은 웹 = 사이드바가 워드마크를 이미 갖고 있다   // ★관리자 전용 — 판정을 여기서 새로 만들지 않는다(BottomNav 와 같은 훅)

  // 표시 이름 — 로그인 이메일 앞부분을 쓴다(닉네임 설정은 설정 화면에 있다).
  const who = (session?.user?.email ?? '').split('@')[0];

  // ★항목을 **새로 만들지 않았다** — 있던 일곱 줄을 콘티의 세 묶음으로 나누고, 흩어져 있던
  //   「내 명식」 진입만 여기에 얹었다(설정 안에만 있어 찾기 어려웠다).
  //   ⚠️어느 줄이 어느 묶음인지는 **콘티가 정본**이다. 이 배치는 뜻이 통하는 최소 안이고,
  //     콘티와 다르면 Boss 검수에서 고친다(내가 항목을 지어내지는 않는다).
  // ★콘티에서 그대로 옮긴 항목이다. 이름·순서·묶음을 바꾸지 말 것 —
  //   바꿀 일이 생기면 콘티를 고치고 여기를 따라오게 한다(반대로 하면 다시 어긋난다).
  const groups: Group[] = [
    { key: 'act', title: t('my.grpAct', '내 활동'), rows: [
      { key: 'chats',    icon: '🗨', label: t('my.chats', '대화 기록'), route: '/chats' },
      { key: 'teachers', icon: '♡', label: t('my.teachers', '찜한 선생님'), route: '/myteachers' },
      { key: 'posts',    icon: '✎', label: t('my.posts', '작성한 글'), route: '/myposts' },
      { key: 'comments', icon: '💬', label: t('my.comments', '댓글과 답글'), route: '/mycomments' },
    ] },
    { key: 'woon', title: t('my.grpWoon', '운 관리'), rows: [
      { key: 'charge',  icon: '⊕', label: t('my.charge', '운 충전하기'), route: '/coins' },
      { key: 'history', icon: '🧾', label: t('my.useHistory', '운 사용 내역'), route: '/coinhistory' },
      // ⚠️「구독 관리」가 갈 곳은 **광고 제거**다 — 이 앱의 유일한 기간제 상품(`adfree_30`).
      //   콘티에 있다고 없는 화면으로 보내면 눌렀을 때 빈 화면이 된다.
      { key: 'sub',     icon: '✓', label: t('my.subs', '구독 관리'), route: '/market' },
    ] },
    { key: 'set', title: t('my.grpSet', '설정'), rows: [
      { key: 'notify',   icon: '🔔', label: t('my.notifySet', '알림 설정'), route: '/notifications' },
      { key: 'account',  icon: '🛡', label: t('my.account', '계정 및 보안'), route: '/settings' },
      { key: 'support',  icon: '☎', label: t('my.support', '고객센터'), route: '/bugreport' },
    ] },
  ];


  return (
    <ScrollView style={styles.wrap} contentContainerStyle={[styles.body, { paddingTop: insets.top + space(4) }]}>
      {/* ① 헤더 — 워드마크 좌 · 알림 · 설정 (콘티)
          ⚠️★넓은 웹에서는 워드마크를 **숨긴다** — 사이드바(`WebShell`)에 이미 있어서
            그대로 두면 같은 글자가 한 화면에 두 번 뜬다(실측으로 드러났다).
            콘티는 폰 한 면이라 이 중복이 보이지 않는다. */}
      <View style={styles.top}>
        {wideWeb ? <View style={{ flex: 1 }} /> : <BrandWordmark style={{ flex: 1 }} />}
        <PressableScale hitSlop={10} onPress={() => router.push('/notifications')}>
          <Text style={styles.topIcon}>🔔</Text>
        </PressableScale>
        <PressableScale hitSlop={10} onPress={() => router.push('/settings')}>
          <Text style={styles.topIcon}>⚙︎</Text>
        </PressableScale>
      </View>

      {/* ② 프로필 — ★사진이 **왼쪽**이고 사각 라운드다(콘티). 가운데 정렬 원형이 아니다 */}
      <View style={styles.profile}>
        {/* ⚠️★`cover` 가 아니라 `contain` 이다(Boss 2026-08-23 *"프로필사진 위치에 있는 이미지가 제대로 안되어있어"*).
            자산 `av-*.png` 는 **405×495 세로 인물**인데 상자는 64×64 정사각이라,
            `cover` 는 넘치는 위아래를 **잘라낸다** — 머리나 발이 잘린 채 가운데 띠만 보였다.
            ⚠️로고 때(340×470 을 108×34 에)와 **같은 부류**다: 비율이 안 맞는 그림은
              찌그러지지 않고 **작아지거나(contain) 잘린다(cover)** — 둘 다 고장으로 안 읽힌다.
            ⇒ 전체가 보이게 `contain`. 64 안에서 52×64 로 들어가 옆에 6px 씩만 남는다. */}
        <ExpoImage source={elementAvatar()} style={styles.pic} contentFit="contain" transition={160} />
        <View style={styles.profileMid}>
          <Text style={styles.nick} numberOfLines={1}>
            {who || t('my.helloGuest', '안녕하세요')}
          </Text>
          {/* 상태메시지 — 아직 저장 기능이 없어 기본 문구를 쓴다(빈 줄로 두면 카드가 무너진다) */}
          <Text style={styles.status} numberOfLines={2}>{t('my.statusDefault', '오늘도 나에게 좋은 일이 가득하길 ✨')}</Text>
          <PressableScale style={styles.editBtn} onPress={() => router.push('/settings')}>
            <Text style={styles.editTx}>{t('my.editProfile', '프로필 편집')}</Text>
          </PressableScale>
        </View>
      </View>

      {/* ③ 운 카드 — 연보라 그라데이션 · 우측 원형 화살표(콘티) */}
      <PressableScale onPress={() => router.push('/coins')}>
        <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.wallet}>
          <View style={styles.walletMid}>
            <Text style={styles.walletTitle}>{t('my.woonCard', '내 운')}</Text>
            <View style={styles.balRow}>
              {/* 조회 실패면 숫자를 지어내지 않고 '—' 를 둔다 */}
              <Text style={styles.bal}>{balance == null ? '—' : balance.toLocaleString()}</Text>
              <Text style={styles.balUnit}>{t('my.woon', '운')}</Text>
            </View>
            <Text style={styles.walletSub}>{t('my.walletLink', '운 충전 / 사용 내역')}</Text>
          </View>
          <View style={styles.walletGo}><Text style={styles.walletGoTx}>→</Text></View>
        </LinearGradient>
      </PressableScale>

      {/* ③ 메뉴 — 세 묶음 */}
      {groups.map((g) => {
        const rows = g.rows.filter((r) => !r.admin || commOn);
        if (!rows.length) return null;            // ★플래그로 다 빠지면 제목만 남는 일이 없게
        return (
          <View key={g.key} style={styles.group}>
            <Text style={styles.groupTx}>{g.title}</Text>
            <View style={styles.menu}>
              {rows.map((r, i) => (
                <PressableScale
                  key={r.key}
                  style={[styles.row, i < rows.length - 1 && styles.rowLine]}
                  onPress={() => router.push(r.route as never)}
                >
                  <Text style={styles.rowIcon}>{r.icon}</Text>
                  <Text style={styles.rowTx}>{r.label}</Text>
                  <Text style={styles.rowArrow}>›</Text>
                </PressableScale>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  // 하단 여백 170 = 광고 배너 50 + 하단 내비 86 + 홈 인디케이터 34(check:bottominset 기준)
  body: { paddingHorizontal: space(4), paddingBottom: 170 },

  top: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginBottom: space(4) },
  topIcon: { fontSize: 20, lineHeight: 26 },

  profile: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3.5), marginBottom: space(4) },
  // ★사각 라운드(콘티). 원형이 아니다 — 카톡 프로필과 같은 모양이라 '사람'으로 읽힌다
  // ★배경을 뺐다 — `contain` 이라 옆 여백이 생기는데 회색 면이 깔리면 '레터박스'로 보인다
  pic: { width: 64, height: 64, borderRadius: radius.md },
  profileMid: { flex: 1, minWidth: 0, gap: space(1) },
  nick: { fontSize: 17, lineHeight: 23, fontWeight: '900', color: colors.ink },
  status: { ...font.caption, color: colors.inkSoft, lineHeight: 18 },
  editBtn: {
    alignSelf: 'flex-start', marginTop: space(1),
    paddingHorizontal: space(3), paddingVertical: space(1.5),
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.juLine,
  },
  editTx: { ...font.caption, color: colors.ju, fontWeight: '800' },

  wallet: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    borderRadius: radius.lg, padding: space(5), marginBottom: space(5),
  },
  walletMid: { flex: 1, minWidth: 0 },
  // ⚠️그라데이션 위 글자는 **고정색**이다 — 오행 강조색을 쓰면 색마다 대비가 갈린다
  walletTitle: { ...font.caption, color: '#6B5FA8', fontWeight: '800' },
  balRow: { flexDirection: 'row', alignItems: 'baseline', gap: space(1.5), marginTop: space(1) },
  // 시안에서 이 화면의 주인공 — 홈의 점수와 같은 급으로 크게.
  bal: { fontSize: 30, lineHeight: 38, fontWeight: '900', color: '#2E2A4A', letterSpacing: -0.8 },
  balUnit: { ...font.label, color: '#2E2A4A', fontWeight: '800' },
  walletSub: { ...font.caption, color: '#6B5FA8', marginTop: space(1.5) },
  walletGo: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  walletGoTx: { fontSize: 16, color: '#6B5FA8', fontWeight: '900' },

  group: { marginBottom: space(4) },
  // 묶음 제목 — 카드 **밖**에 둔다(안에 넣으면 첫 줄과 붙어 메뉴처럼 읽힌다)
  groupTx: { ...font.caption, color: colors.ju, fontWeight: '800', marginBottom: space(1.5), marginLeft: space(1) },
  menu: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: space(4), ...shadow.soft },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(4) },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowIcon: { fontSize: 16, lineHeight: 22 },
  rowTx: { ...font.body, color: colors.ink, flex: 1 },
  rowArrow: { ...font.heading, color: colors.inkFaint },
});
