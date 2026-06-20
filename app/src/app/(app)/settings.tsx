// src/app/(app)/settings.tsx — 설정 (글자 크기·언어)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 설정에서 글자 크기 조절. 통변 등 본문 가독성을 위한 전역 배율(fontScale) 선택 + 언어.
//   글자 크기는 즉시 반영(미리보기 문장으로 확인). 언어는 i18n.changeLanguage.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Linking } from 'react-native';
import Constants from 'expo-constants'; // 앱 버전(app.json)
import { Alert } from '../../lib/alert'; // 커스텀 알림(앱 디자인)
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { setAppLang } from '../../lib/i18n'; // 언어 변경 + persist(재시작 후 유지)
import { useFontScale, FONT_STEPS } from '../../lib/fontScale';
import { isAdmin } from '../../lib/admin'; // 관리자 메뉴 노출 판정(실제 권한은 서버 RPC)
import { useAuth } from '../../lib/useAuth';               // 계정(세션)
import { useSubscription } from '../../lib/subscription';  // 프리미엄 상태·구매
import { requireLoginForPurchase } from '../../lib/requireLogin'; // 결제 전 로그인 게이트
import { restorePurchasesRC, priceStringRC, PRODUCT_PREMIUM } from '../../lib/purchases';  // 구매 복원·프리미엄 현지가
import { PREMIUM_PRICE } from '../../lib/coupons';  // 프리미엄 폴백 가격(₩)
import { supabase } from '../../lib/supabase';             // 로그아웃
import { BusyOverlay } from '../../components/BusyOverlay'; // 긴 콜백(로그아웃·삭제) 로딩 오버레이
import { colors, radius, space, shadow, font } from '../../lib/theme';

const LANGS: { key: string; label: string }[] = [
  { key: 'ko', label: '한국어' }, { key: 'en', label: 'English' }, { key: 'ja', label: '日本語' },
];

// 앱 정보(출시) — 버전·약관·개인정보·오픈소스. ★daniel: 약관/개인정보 URL 을 실제 호스팅 주소로 교체(App Store 심사 필수).
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const TERMS_URL = 'https://hwangchanho.github.io/syncfortune/legal/terms-ko.html';     // GitHub Pages(정식)
const PRIVACY_URL = 'https://hwangchanho.github.io/syncfortune/legal/privacy-ko.html'; // GitHub Pages — App Store 개인정보 URL
const OSS_LICENSES = 'React Native · Expo (MIT)\niztro · lunar-javascript (MIT)\nRevenueCat Purchases · Google Mobile Ads\nreact-i18next · React Navigation (MIT)\nreact-native-svg · safe-area-context (MIT)\n\n각 라이브러리는 해당 저장소의 라이선스를 따릅니다.';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const { isPremium, purchasePremium, refresh } = useSubscription();
  const { scale, setScale, fs } = useFontScale();
  const [busy, setBusy] = useState<string | null>(null); // 전체화면 로딩 오버레이 메시지(긴 콜백)
  const [admin, setAdmin] = useState(false); // 관리자 — 메뉴 노출용(실제 권한은 서버 RPC)
  const [premPrice, setPremPrice] = useState(''); // 프리미엄 현지통화 가격(RC) — 미설정 시 ₩ 폴백

  useEffect(() => { isAdmin().then(setAdmin).catch(() => {}); }, []);
  // 프리미엄 현지 통화 가격(RC) 로드 — USD 기준 등록 시 사용자 지역 통화로 자동 표시.
  useEffect(() => { priceStringRC(PRODUCT_PREMIUM, `₩${PREMIUM_PRICE.toLocaleString()}`).then(setPremPrice).catch(() => {}); }, []);

  // 로그아웃 — 토큰 폐기(네트워크) 동안 오버레이. 완료 시 세션 변경으로 화면 전환.
  async function doLogout() {
    setBusy(t('common.loggingOut'));
    try { await supabase.auth.signOut(); }
    finally { setBusy(null); }
  }

  // 프리미엄 구매 — 로그인 게이트(구매 계정 귀속) → RC 구독 → 갱신.
  async function onBuyPremium() {
    if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
    try {
      await purchasePremium();
      await refresh();
      Alert.alert(t('settings.premiumOkTitle'), t('settings.premiumOk'));
    } catch (e) {
      if ((e as Error).message === 'cancelled') return;     // 사용자 취소 — 조용히
      Alert.alert(t('settings.premiumTitle'), (e as Error).message);
    }
  }

  // 구매 복원(App Store 필수) — 로그인 게이트 → RC 복원 → 갱신.
  async function onRestore() {
    if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
    try {
      const ok = await restorePurchasesRC();
      await refresh();
      Alert.alert(t('purchase.restore'), ok ? t('purchase.restored') : t('purchase.restoreNone'));
    } catch (e) { Alert.alert(t('purchase.restore'), (e as Error).message); }
  }

  // 계정 삭제 — 이중 확인 → Edge(service role)가 데이터+계정 삭제 → 로그아웃(App Store 5.1.1 필수).
  function onDeleteAccount() {
    Alert.alert(t('settings.delTitle'), t('settings.delMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.delConfirm'), style: 'destructive', onPress: () => {
        // 2차 확인(되돌릴 수 없음)
        Alert.alert(t('settings.delTitle2'), t('settings.delMsg2'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('settings.delFinal'), style: 'destructive', onPress: async () => {
            setBusy(t('settings.deleting'));                    // 데이터·계정 삭제(Edge) 동안 오버레이
            try {
              const { data, error } = await supabase.functions.invoke('delete-account');
              if (error || data?.error) { Alert.alert(t('settings.delTitle'), t('settings.delFail')); return; }
              await supabase.auth.signOut();
              Alert.alert(t('settings.delDoneTitle'), t('settings.delDone'));
            } finally { setBusy(null); }
          } },
        ]);
      } },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* ── 계정 ── */}
      <Text style={styles.h}>{t('settings.account')}</Text>
      {session ? (
        <>
          <View style={styles.acctCard}>
            <Text style={styles.acctEmail} numberOfLines={1}>{session.user.email}</Text>
            <Pressable onPress={doLogout}><Text style={styles.acctAction}>{t('common.logout')}</Text></Pressable>
          </View>
          {/* 계정 삭제(App Store 필수) — 데이터·계정 영구 삭제 */}
          <Pressable style={styles.delAcctBtn} onPress={onDeleteAccount}>
            <Text style={styles.delAcctTx}>{t('settings.deleteAccount')}</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={styles.acctLoginBtn} onPress={() => router.push('/login')}>
          <Text style={styles.acctLoginTx}>{t('settings.loginCta')}</Text>
        </Pressable>
      )}

      {/* ── 관리자(is_admin 전용) ── */}
      {(admin || __DEV__) && (
        <>
          <Pressable style={styles.adminLink} onPress={() => router.push('/admin')}>
            <Text style={styles.adminLinkTx}>⚙ 관리자{__DEV__ && !admin ? ' (dev)' : ''}</Text>
          </Pressable>
          <Pressable style={styles.adminLink} onPress={() => router.push('/coststable')}>
            <Text style={styles.adminLinkTx}>📊 비용·수익 분석 (실측)</Text>
          </Pressable>
        </>
      )}

      {/* ── 프리미엄 ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.premium')}</Text>
      {isPremium ? (
        <View style={styles.premCardOn}><Text style={styles.premOnTx}>{t('settings.premiumActive')}</Text></View>
      ) : (
        <Pressable style={styles.premBuyBtn} onPress={onBuyPremium}>
          <Text style={styles.premBuyTx}>{t('settings.premiumBuy')}{premPrice ? ` · ${premPrice}` : ''}</Text>
          <Text style={styles.premBuySub}>{t('settings.premiumDesc')}</Text>
        </Pressable>
      )}
      {/* 구매 복원(App Store 필수) — 기기 변경·재설치 시 */}
      <Pressable style={styles.restoreBtn} onPress={onRestore}>
        <Text style={styles.restoreTx}>{t('purchase.restore')}</Text>
      </Pressable>

      {/* ── 글자 크기 ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.fontSize')}</Text>
      <View style={styles.row}>
        {FONT_STEPS.map((s) => {
          const on = Math.abs(scale - s.scale) < 0.001;
          return (
            <Pressable key={s.key} style={[styles.opt, on && styles.optOn]} onPress={() => setScale(s.scale)}>
              <Text style={[styles.optTx, on && styles.optTxOn, { fontSize: 13 * s.scale }]}>{t(`settings.size_${s.key}`)}</Text>
            </Pressable>
          );
        })}
      </View>
      {/* 미리보기 — 현재 배율이 통변 본문에 어떻게 보이는지 */}
      <View style={styles.preview}>
        <Text style={[styles.previewBody, { fontSize: fs(15), lineHeight: fs(25) }]}>{t('settings.preview')}</Text>
      </View>

      {/* ── 언어 ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.language')}</Text>
      <View style={styles.row}>
        {LANGS.map((l) => {
          const on = i18n.language?.startsWith(l.key);
          return (
            <Pressable key={l.key} style={[styles.opt, on && styles.optOn]} onPress={() => setAppLang(l.key as 'ko' | 'en' | 'ja')}>
              <Text style={[styles.optTx, on && styles.optTxOn]}>{l.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>{t('settings.note')}</Text>

      {/* ── 앱 정보(버전·약관·개인정보·오픈소스) — 출시 준비 ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.appInfo', '앱 정보')}</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>{t('settings.version', '버전')}</Text><Text style={styles.infoVal}>{APP_VERSION}</Text></View>
        <Pressable style={styles.infoRow} onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}><Text style={styles.infoLabel}>{t('settings.terms', '이용약관')}</Text><Text style={styles.infoArrow}>›</Text></Pressable>
        <Pressable style={styles.infoRow} onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}><Text style={styles.infoLabel}>{t('settings.privacy', '개인정보처리방침')}</Text><Text style={styles.infoArrow}>›</Text></Pressable>
        <Pressable style={[styles.infoRow, styles.infoRowLast]} onPress={() => Alert.alert(t('settings.license', '오픈소스 라이선스'), OSS_LICENSES)}><Text style={styles.infoLabel}>{t('settings.license', '오픈소스 라이선스')}</Text><Text style={styles.infoArrow}>›</Text></Pressable>
      </View>

      {/* 긴 콜백(로그아웃·계정삭제) 동안 입력 차단 + 로딩 표시 */}
      <BusyOverlay visible={!!busy} message={busy ?? undefined} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(12) },
  h: { ...font.heading, marginBottom: space(3) },
  // 계정
  acctCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), ...shadow.soft },
  // 앱 정보(버전·약관·개인정보·오픈소스)
  infoCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, marginTop: space(2), overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space(4), paddingVertical: space(3.5), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { ...font.body, color: colors.ink },
  infoVal: { ...font.body, color: colors.inkSoft },
  infoArrow: { ...font.body, color: colors.inkFaint, fontSize: 18 },
  acctEmail: { ...font.body, color: colors.ink, flexShrink: 1, marginRight: space(3) },
  acctAction: { color: colors.ju, fontWeight: '700', fontSize: 14 },
  acctLoginBtn: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, padding: space(4), alignItems: 'center', ...shadow.soft },
  acctLoginTx: { color: colors.ju, fontWeight: '800', fontSize: 15 },
  // 관리자 링크(cksgh0316)
  adminLink: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, padding: space(3.5), alignItems: 'center', marginTop: space(2) },
  adminLinkTx: { color: colors.ju, fontWeight: '800', fontSize: 14 },
  // 계정 삭제 — 약하게 노출(파괴적), 우측 정렬 텍스트 링크
  delAcctBtn: { alignSelf: 'flex-end', marginTop: space(2), paddingVertical: space(1), paddingHorizontal: space(1) },
  delAcctTx: { color: '#E5484D', fontSize: 13, fontWeight: '600' },
  // 프리미엄
  premBuyBtn: { backgroundColor: colors.ju, borderRadius: radius.md, padding: space(4), alignItems: 'center', ...shadow.card },
  premBuyTx: { color: colors.bg, fontWeight: '900', fontSize: 16 },
  premBuySub: { color: colors.bg, opacity: 0.85, fontSize: 12, marginTop: space(1) },
  premCardOn: { backgroundColor: colors.juSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, padding: space(4), alignItems: 'center' },
  premOnTx: { color: colors.ju, fontWeight: '800', fontSize: 15 },
  restoreBtn: { alignSelf: 'center', marginTop: space(2.5), paddingVertical: space(1) },
  restoreTx: { color: colors.inkSoft, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), alignItems: 'center' },
  // 칩 = 균일 높이 + 내용 중앙 정렬(글자 크기가 달라도 라벨이 가운데 오게, daniel)
  opt: { minHeight: 46, paddingHorizontal: space(4), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  optOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  optTx: { fontSize: 14, fontWeight: '700', color: colors.inkSoft, textAlign: 'center' },
  optTxOn: { color: colors.bg },
  preview: { marginTop: space(4), padding: space(4), borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.juLine, ...shadow.card },
  previewBody: { color: colors.ink },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(6), lineHeight: 18 },
});
