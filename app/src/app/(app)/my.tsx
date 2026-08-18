// app/src/app/(app)/my.tsx — 하단탭 「마이페이지」 (시안 `니운내운.pdf` p06)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 왜 생겼나 (Boss 2026-08-18 — 시안 4탭 채택)
//   종전엔 '나에 관한 것'이 세 군데로 흩어져 있었다 — 운 잔액은 마켓, 계정·언어·글자크기는 설정,
//   커뮤니티·우니는 각자 탭. 시안은 그걸 **한 화면**으로 모은다.
//   ⇒ 탭이 5개에서 4개로 줄어드는 대신, 사라진 탭들의 화면은 **전부 여기서 갈 수 있다**(기능 유실 0).
//
// ■ 구성(시안 실측)
//   ① 아바타 + 「안녕하세요, ○○님」 + 한 줄 설명
//   ② 「나의 운 지갑」 카드 — 잔액 크게 · 「운 충전하기」(주) · 「결제/충전 내역」(보조)
//   ③ 메뉴 리스트 — 한 줄에 아이콘 + 이름 + ›
//
// ★잔액은 `useCoinBalance(session)` **한 곳**에서만 읽는다([[coin-balance-single-hook]]).
//   화면마다 따로 조회하면 같은 화면 안에서 숫자가 갈린다(실제로 겪은 사고).
// ⚠️조회 실패(null)를 0으로 그리지 않는다 — 0원이라고 오해해 충전을 유도하면 그게 곧 과금 유도다.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';   // ★상단 안전영역 — 헤더가 없는 화면이라 직접 받는다(고정 여백은 글자확대 시 잘린다)
import { PressableScale } from '../../components/PressableScale';
import { useAuth } from '../../lib/useAuth';
import { useCoinBalance } from '../../lib/billing/coins';
import { colors, radius, space, font, shadow } from '../../lib/theme';
import { useFeatureOn } from '../../lib/core/features';   // 커뮤니티 노출 = 원격 플래그(BottomNav 와 같은 판정)

/** 메뉴 한 줄. `admin` 이면 관리자에게만 보인다. */
type Row = { key: string; icon: string; label: string; route: string; admin?: boolean };

export default function MyPageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const balance = useCoinBalance(session);   // null = 조회 실패/비로그인 (0 과 구분)
  const commOn = useFeatureOn('community');
  const insets = useSafeAreaInsets();   // ★관리자 전용 — 판정을 여기서 새로 만들지 않는다(BottomNav 와 같은 훅)

  // 표시 이름 — 로그인 이메일 앞부분을 쓴다(닉네임 설정은 설정 화면에 있다).
  const who = (session?.user?.email ?? '').split('@')[0];

  const rows: Row[] = [
    { key: 'readings', icon: '📄', label: t('my.readings', '운세 기록'), route: '/myreadings' },
    { key: 'fav', icon: '♥', label: t('my.fav', '찜한 콘텐츠'), route: '/favorites' },
    { key: 'coupon', icon: '🎟', label: t('my.coupon', '쿠폰함'), route: '/market' },
    { key: 'coach', icon: '💬', label: t('my.coach', '상담 내역'), route: '/coach' },
    { key: 'community', icon: '👥', label: t('nav.community'), route: '/community', admin: true },   // 플래그 OFF 면 숨는다
    { key: 'settings', icon: '⚙️', label: t('my.settings', '설정 및 개인정보'), route: '/settings' },
  ];

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={[styles.body, { paddingTop: insets.top + space(4) }]}>
      {/* ① 인사 */}
      <View style={styles.hello}>
        <View style={styles.avatar}><Text style={styles.avatarTx}>🙂</Text></View>
        <Text style={styles.helloTx}>
          {who ? t('my.helloName', { name: who, defaultValue: '안녕하세요, {{name}}님' }) : t('my.helloGuest', '안녕하세요')}
        </Text>
        <Text style={styles.helloSub}>{t('my.helloSub', '나의 운을 관리하고 더 나은 하루를 만들어보세요.')}</Text>
      </View>

      {/* ② 운 지갑 */}
      <View style={styles.wallet}>
        <Text style={styles.walletTitle}>{t('my.wallet', '나의 운 지갑')}</Text>
        <View style={styles.balRow}>
          {/* 조회 실패면 숫자를 지어내지 않고 '—' 를 둔다 */}
          <Text style={styles.bal}>{balance == null ? '—' : balance.toLocaleString()}</Text>
          <Text style={styles.balUnit}>{t('my.woon', '운')}</Text>
        </View>
        <Text style={styles.walletSub}>{t('my.walletSub', '운은 다양한 상담과 콘텐츠에 사용돼요.')}</Text>

        <PressableScale style={styles.cta} onPress={() => router.push('/coins')}>
          <Text style={styles.ctaTx}>{t('my.charge', '운 충전하기')}</Text>
        </PressableScale>
        <PressableScale style={styles.ctaGhost} onPress={() => router.push('/coinhistory')}>
          <Text style={styles.ctaGhostTx}>{t('my.history', '결제/충전 내역')}</Text>
        </PressableScale>
      </View>

      {/* ③ 메뉴 */}
      <View style={styles.menu}>
        {rows.filter((r) => !r.admin || commOn).map((r, i, arr) => (
          <PressableScale
            key={r.key}
            style={[styles.row, i < arr.length - 1 && styles.rowLine]}
            onPress={() => router.push(r.route as never)}
          >
            <Text style={styles.rowIcon}>{r.icon}</Text>
            <Text style={styles.rowTx}>{r.label}</Text>
            <Text style={styles.rowArrow}>›</Text>
          </PressableScale>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  // 하단 여백 170 = 광고 배너 50 + 하단 내비 86 + 홈 인디케이터 34(check:bottominset 기준)
  body: { paddingHorizontal: space(4), paddingBottom: 170 },

  hello: { alignItems: 'center', marginBottom: space(5) },
  avatar: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: colors.juSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: space(3),
  },
  avatarTx: { fontSize: 38, lineHeight: 46 },
  helloTx: { fontSize: 20, lineHeight: 28, fontWeight: '900', color: colors.ju, letterSpacing: -0.3 },
  helloSub: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5) },

  wallet: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: space(5), marginBottom: space(4), ...shadow.soft,
  },
  walletTitle: { ...font.heading, color: colors.ju, fontWeight: '900' },
  balRow: { flexDirection: 'row', alignItems: 'baseline', gap: space(1.5), marginTop: space(2) },
  // 시안에서 이 화면의 주인공 — 홈의 점수와 같은 급으로 크게.
  bal: { fontSize: 34, lineHeight: 42, fontWeight: '900', color: colors.ink, letterSpacing: -1 },
  balUnit: { ...font.label, color: colors.inkSoft, fontWeight: '800' },
  walletSub: { ...font.caption, color: colors.inkFaint, marginTop: space(1) },
  cta: {
    marginTop: space(4), backgroundColor: colors.ju, borderRadius: radius.md,
    paddingVertical: space(3.5), alignItems: 'center',
  },
  ctaTx: { ...font.label, color: colors.onJu, fontWeight: '900' },
  ctaGhost: {
    marginTop: space(2), borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine,
    paddingVertical: space(3.5), alignItems: 'center',
  },
  ctaGhostTx: { ...font.label, color: colors.ju, fontWeight: '800' },

  menu: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: space(4), ...shadow.soft },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(4) },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowIcon: { fontSize: 16, lineHeight: 22 },
  rowTx: { ...font.body, color: colors.ink, flex: 1 },
  rowArrow: { ...font.heading, color: colors.inkFaint },
});
