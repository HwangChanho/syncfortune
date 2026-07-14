// src/app/(app)/settings.tsx — 설정 (글자 크기·언어)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 설정에서 글자 크기 조절. 통변 등 본문 가독성을 위한 전역 배율(fontScale) 선택 + 언어.
//   글자 크기는 즉시 반영(미리보기 문장으로 확인). 언어는 i18n.changeLanguage.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Linking } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import Constants from 'expo-constants'; // 앱 버전(app.json)
import { Alert } from '../../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import { useRouter, useFocusEffect } from 'expo-router';
import { getNotifStatus, requestNotifPermission, type NotifStatus } from '../../lib/backend/notifications'; // 알림 권한 상태·요청(설정 토글)
import { useTranslation } from 'react-i18next';
import { setAppLang } from '../../lib/i18n'; // 언어 변경 + persist(재시작 후 유지)
import { useFontScale, FONT_STEPS } from '../../lib/ui/fontScale';
import { isAdmin } from '../../lib/core/admin'; // 관리자 메뉴 노출 판정(실제 권한은 서버 RPC)
import { useAuth } from '../../lib/useAuth';               // 계정(세션)
import { useSubscription } from '../../lib/billing/subscription';  // 프리미엄 상태·구매
import { waitForPremium, markPremiumOwnedNow } from '../../lib/billing/premiumStore';   // 복원=서버 is_premium 확정(단일소스·07-07) + 웹훅 실패 시 영수증 검증분 낙관표시(#2)
import { requireLoginForPurchase } from '../../lib/billing/requireLogin'; // 결제 전 로그인 게이트
import { priceStringRC, PRODUCT_PREMIUM, restorePurchasesRC } from '../../lib/billing/purchases';  // 프리미엄 현지가 + 구매 복원(3.1.1 필수)
import { PREMIUM_PRICE, loadCredits } from '../../lib/billing/coupons';  // 프리미엄 폴백 가격(₩) + 이용권 잔여 재로딩(복원 후)
import { supabase } from '../../lib/supabase';             // 로그아웃
import { BusyOverlay } from '../../components/BusyOverlay'; // 긴 콜백(로그아웃·삭제) 로딩 오버레이
import { setAuthBusy } from '../../lib/ui/authBusy'; // 로그아웃 전환 전역 블로킹(먹통 방지)
import { colors, radius, space, shadow, font, getLoadingVideoEnabled, setLoadingVideoEnabled, getReadingVideoEnabled, setReadingVideoEnabled, setThemeAccent, getThemeAccent, activeAccentElement, ACCENT_SWATCH, type AccentMode } from '../../lib/theme'; // ★다크/라이트 토글 제거(daniel 2026-07-15) — setThemePref/getThemePref/ThemePref 미사용

const LANGS: { key: string; label: string }[] = [
  { key: 'ko', label: '한국어' }, { key: 'en', label: 'English' }, { key: 'ja', label: '日本語' },
];

// 앱 정보(출시) — 버전·약관·개인정보·오픈소스. ★daniel: 약관/개인정보 URL 을 실제 호스팅 주소로 교체(App Store 심사 필수).
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const TERMS_URL = 'https://hwangchanho.github.io/syncfortune/legal/terms-ko.html';     // GitHub Pages(정식)
const PRIVACY_URL = 'https://hwangchanho.github.io/syncfortune/legal/privacy-ko.html'; // GitHub Pages — App Store 개인정보 URL
const OSS_LICENSES = 'React Native · Expo (MIT)\niztro · lunar-javascript (MIT)\nRevenueCat Purchases · Google Mobile Ads\nreact-i18next · React Navigation (MIT)\nreact-native-svg · safe-area-context (MIT)\n\n각 라이브러리는 해당 저장소의 라이선스를 따릅니다.';
const SUPPORT_EMAIL = 'cksgh0316@gmail.com'; // 버그 제보·문의 수신(daniel 2026-07-08)

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { session, isRegistered } = useAuth();
  const { isPremium, purchasePremium, refresh } = useSubscription();
  const { scale, setScale, fs } = useFontScale();
  const [busy, setBusy] = useState<string | null>(null); // 전체화면 로딩 오버레이 메시지(긴 콜백)
  const [admin, setAdmin] = useState(false); // 관리자 — 메뉴 노출용(실제 권한은 서버 RPC). 제어(비용분석·테스트/관리자모드)는 /admin 내부로 통합(daniel 07-01)
  const [premPrice, setPremPrice] = useState(''); // 프리미엄 현지통화 가격(RC) — 미설정 시 ₩ 폴백
  const [accent, setAccentState] = useState<AccentMode>(getThemeAccent()); // ★테마 강조색(자동=일간 오행 / 오행 직접 / 골드)
  const [loadingVid, setLoadingVid] = useState<boolean>(getLoadingVideoEnabled()); // 로딩(인트로) 영상 on/off — off=八字 한자만(daniel 07-03)
  const [readingVid, setReadingVid] = useState<boolean>(getReadingVideoEnabled()); // 풀이 로딩(자물쇠 화면) 테마영상 on/off — off=링+자물쇠만(daniel 07-13)
  const [notifStatus, setNotifStatus] = useState<NotifStatus>('undetermined'); // 알림 권한 상태(행 라벨·동작 분기)
  const [restoring, setRestoring] = useState(false); // 구매 복원 진행 중(연타 가드·버튼 로딩)
  // 알림 권한 상태 로드 — 포커스마다(기기 설정 다녀와서 켜/끄면 ON/OFF 즉시 반영, daniel 07-02)
  useFocusEffect(useCallback(() => { getNotifStatus().then(setNotifStatus).catch(() => {}); }, []));

  // 관리자/테스트모드 노출 = session 반응형. 로그아웃(session=null) 즉시 false로 내려 관리자 메뉴가 바로 사라지게(daniel) — 빈 deps면 마운트 1회라 창 전환 전까지 살아있었음.
  useEffect(() => { if (!session) { setAdmin(false); return; } isAdmin().then(setAdmin).catch(() => {}); }, [session]);
  // 프리미엄 현지 통화 가격(RC) 로드 — USD 기준 등록 시 사용자 지역 통화로 자동 표시.
  useEffect(() => { priceStringRC(PRODUCT_PREMIUM, `₩${PREMIUM_PRICE.toLocaleString()}`).then(setPremPrice).catch(() => {}); }, []);

  // 로그아웃 — 토큰 폐기(네트워크) 동안 오버레이. 완료 시 세션 변경으로 화면 전환.
  async function doLogout() {
    // ★전역 블로킹 오버레이(로그아웃 클린업 먹통 방지, daniel 07-02) — signOut 즉시 표시, SIGNED_OUT 핸들러가 클린업 후 해제.
    setAuthBusy(true);
    try { await supabase.auth.signOut(); } catch { setAuthBusy(false); }
  }

  // 구매 복원 — App Store 3.1.1 필수(비소모성 평생 프리미엄을 새 기기/재설치에서 복구).
  //   RevenueCat restorePurchases → 프리미엄 활성 여부 → refresh()(=refreshPremium(userId))로 프리미엄 재평가 +
  //   loadCredits()로 이용권 잔여 재로딩 → 전 화면(배너·배지·페이월) 반영. 결과를 커스텀 Alert로 안내. 연타 가드.
  async function onRestore() {
    if (restoring) return;                                  // 연타 가드(중복 복원 요청 차단)
    setRestoring(true);
    try {
      const rcPremium = await restorePurchasesRC();         // RC 복원 → 엔타이틀먼트 인식(appUserID=계정 → 웹훅이 서버 is_premium 세팅)
      // ★단일소스(07-07): 복원도 서버 is_premium 로 확정 — RC 캐시 오탐(샌드박스 유령 프리미엄) 방지. RC 인식 시 웹훅 반영을 폴링 확인.
      const uid = session?.user?.id;
      const confirmed = rcPremium && uid ? await waitForPremium(uid, { tries: 6 }) : false; // ~6s 서버 폴링(성공 시 store 갱신)
      if (confirmed) {
        await refresh();                                     // 서버 is_premium 확인됨 → 서버값으로 재평가(단일소스 유지)
      } else if (rcPremium) {
        // ★#2 복원 예외(영수증 검증됨): RC 영수증은 유효한데 서버 is_premium 이 아직 꺼져 있으면(웹훅 실패/지연) 복구 불가였다
        //   → 복원 경로에 한해 낙관표시(markPremiumOwnedNow)로 프리미엄을 켠다. 일반 게이트(refreshPremium)는 서버 단일소스 유지 —
        //   *복원만* 예외(App Store 3.1.1: 영수증=구매 진실). 여기서 refresh() 로 덮지 않는다(서버 미반영이라 owns=false 로 도로 꺼짐).
        //   웹훅이 도달하면 다음 refreshPremium(포그라운드·재로그인)이 서버로 확정, 끝내 미도달이면 그때 정정된다.
        markPremiumOwnedNow();
      } else {
        await refresh();                                     // 영수증 없음(복원분 없음) → 서버값으로 재평가(owns=false 정정)
      }
      await loadCredits();                                  // 이용권(크레딧) 잔여 재로딩(웹훅 반영분)
      Alert.alert(
        t('settings.restore', '구매 복원'),
        confirmed ? t('settings.restoreDone', '구매가 복원되었습니다.')
          : rcPremium ? t('settings.restorePending', '구매가 확인됐어요. 서버 반영까지 잠시 걸릴 수 있어요 — 잠시 후 다시 확인해 주세요.')
          : t('settings.restoreNone', '복원할 구매 내역이 없습니다.'),
      );
    } catch {
      Alert.alert(t('settings.restore', '구매 복원'), t('settings.restoreFail', '구매 복원에 실패했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setRestoring(false);
    }
  }

  // 알림 켜기/안내 — 상태별 분기(daniel 07-02: 시스템 프롬프트가 안 뜨던 문제 근본 대응).
  //   미결정 → 시스템 프롬프트 1회. 거부/이미 켜짐 → 앱에서 못 바꾸므로 기기 설정으로 유도(Linking.openSettings).
  async function onNotif() {
    const cur = await getNotifStatus();
    setNotifStatus(cur);
    const openIosSettings = { text: t('settings.openSettings', '설정 열기'), onPress: () => { Linking.openSettings().catch(() => {}); } };
    const cancel = { text: t('common.cancel', '취소'), style: 'cancel' as const };
    if (cur === 'unavailable') { Alert.alert(t('settings.notif', '알림'), t('settings.notifUnavailable', '이 기기에서는 알림을 사용할 수 없어요.')); return; }
    if (cur === 'granted') { // 이미 켜짐 → 끄려면 기기 설정에서(앱에서 직접 못 끔)
      Alert.alert(t('settings.notif', '알림'), t('settings.notifOnMsg', '알림이 켜져 있어요. 끄려면 기기 설정에서 바꿀 수 있어요.'), [cancel, openIosSettings]); return;
    }
    if (cur === 'undetermined') { // 프롬프트 가능 → 시스템 권한창
      const after = await requestNotifPermission();
      setNotifStatus(after);
      if (after !== 'granted') Alert.alert(t('settings.notif', '알림'), t('settings.notifDeniedMsg', '알림을 받으려면 기기 설정에서 팔자 알림을 켜 주세요.'), [cancel, openIosSettings]);
      return;
    }
    // denied → iOS는 재프롬프트 불가 → 기기 설정으로
    Alert.alert(t('settings.notif', '알림'), t('settings.notifDeniedMsg', '알림을 받으려면 기기 설정에서 팔자 알림을 켜 주세요.'), [cancel, openIosSettings]);
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
      {/* ★익명 세션 상시라 session 아닌 isRegistered 로 구분 — 등록 유저만 계정카드, 익명/미로그인은 로그인 유도(Apple 5.1.1: 등록은 선택·언제든 가능) */}
      {isRegistered ? (
        <>
          <View style={styles.acctCard}>
            <Text style={styles.acctEmail} numberOfLines={1}>{session?.user?.email}</Text>
            <PressableScale onPress={doLogout}><Text style={styles.acctAction}>{t('common.logout')}</Text></PressableScale>
          </View>
        </>
      ) : (
        <PressableScale style={styles.acctLoginBtn} onPress={() => router.push('/login')}>
          <Text style={styles.acctLoginTx}>{t('settings.loginCta')}</Text>
          <Text style={styles.acctLoginSub}>{t('settings.loginBenefit', '로그인하면 구매한 콘텐츠가 다른 기기·재설치에서도 이어져요 (선택)')}</Text>
        </PressableScale>
      )}

      {/* ── 관리자(is_admin 전용) — 제어(비용분석·테스트/관리자모드)는 ⚙관리자 화면 내부로 통합(daniel 07-01) ── */}
      {(admin || __DEV__) && (
        <PressableScale style={styles.adminLink} onPress={() => router.push('/admin')}>
          <Text style={styles.adminLinkTx}>⚙ 관리자{__DEV__ && !admin ? ' (dev)' : ''}</Text>
        </PressableScale>
      )}

      {/* ── 프리미엄 ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.premium')}</Text>
      {isPremium ? (
        <View style={styles.premCardOn}><Text style={styles.premOnTx}>{t('settings.premiumActive')}</Text></View>
      ) : (
        // ★프리미엄 구매는 마켓에서만(daniel 07-02: 계정창에선 구매 제거·상태만 표시). 여기선 마켓으로 유도.
        <PressableScale style={styles.premBuyBtn} onPress={() => router.push('/market')}>
          <Text style={styles.premBuyTx}>{t('settings.premiumGoMarket', '마켓에서 프리미엄 보기 ›')}</Text>
        </PressableScale>
      )}
      {/* 프리미엄 적용 범위(daniel 07-02): 앞으로 나올 프리미엄 콘텐츠까지 무료 + 프리미엄 콘텐츠 한정 명확화 */}
      <Text style={styles.premScope}>{t('settings.premiumScope')}</Text>
      {/* 구매 복원 — App Store 3.1.1 필수(비소모성 평생 프리미엄 복구). 로그인/프리미엄 여부와 무관하게 항상 노출·접근 가능. */}
      <PressableScale style={[styles.restoreBtn, restoring && styles.restoreBtnOff]} onPress={onRestore} disabled={restoring}>
        <Text style={styles.restoreTx}>{restoring ? t('settings.restoring', '복원 중…') : t('settings.restore', '구매 복원')}</Text>
      </PressableScale>

      {/* ── 글자 크기 ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.fontSize')}</Text>
      <View style={styles.row}>
        {FONT_STEPS.map((s) => {
          const on = Math.abs(scale - s.scale) < 0.001;
          return (
            <PressableScale key={s.key} style={[styles.opt, on && styles.optOn]} onPress={() => setScale(s.scale)}>
              <Text style={[styles.optTx, on && styles.optTxOn, { fontSize: 13 * s.scale }]}>{t(`settings.size_${s.key}`)}</Text>
            </PressableScale>
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
            <PressableScale key={l.key} style={[styles.opt, on && styles.optOn]} onPress={() => setAppLang(l.key as 'ko' | 'en' | 'ja')}>
              <Text style={[styles.optTx, on && styles.optTxOn]}>{l.label}</Text>
            </PressableScale>
          );
        })}
      </View>

      {/* ── ★테마 강조색 — 대표명식 일간의 오행 색(daniel 2026-07-15). 자동=일간 / 오행 직접 / 골드 ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.accent', '테마 강조색')}</Text>
      <Text style={styles.accentDesc}>{t('settings.accentDesc', '대표명식 일간의 오행 색으로 앱을 물들여요. 직접 고를 수도 있어요.')}</Text>
      <View style={styles.accentWrap}>
        {(['auto', '木', '火', '土', '金', '水', 'gold'] as AccentMode[]).map((k) => {
          const on = accent === k;
          const swColor = k === 'auto' ? (ACCENT_SWATCH[activeAccentElement] ?? ACCENT_SWATCH.gold) : ACCENT_SWATCH[k];
          const label = k === 'auto' ? t('settings.accentAuto', '자동(일간)')
            : k === 'gold' ? t('settings.accentGold', '골드')
            : ({ 木: '목', 火: '화', 土: '토', 金: '금', 水: '수' } as Record<string, string>)[k];
          return (
            <PressableScale key={k} style={[styles.accentChip, on && styles.accentChipOn]} onPress={() => {
              setThemeAccent(k); setAccentState(k);
              Alert.alert(t('settings.accent', '테마 강조색'), t('settings.themeRestart', '앱을 다시 켜면 적용돼요.'));
            }}>
              <View style={[styles.accentDot, { backgroundColor: swColor }, on && styles.accentDotOn]} />
              <Text style={[styles.accentChipTx, on && styles.accentChipTxOn]}>{label}</Text>
            </PressableScale>
          );
        })}
      </View>

      {/* ── 로딩 화면(인트로 영상 on/off) — daniel 07-03. 끄면 八字 한자만. 변경은 다음 실행부터 적용 ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.loadingScreen', '로딩 화면')}</Text>
      <View style={styles.row}>
        {[true, false].map((on) => {
          const sel = loadingVid === on;
          return (
            <PressableScale key={String(on)} style={[styles.opt, sel && styles.optOn]} onPress={() => {
              setLoadingVideoEnabled(on); setLoadingVid(on);
              Alert.alert(t('settings.loadingScreen', '로딩 화면'), t('settings.themeRestart', '앱을 다시 켜면 적용돼요.'));
            }}>
              <Text style={[styles.optTx, sel && styles.optTxOn]}>{on ? t('settings.loadingVideoOn', '호랑이 영상') : t('settings.loadingVideoOff', '八字 한자')}</Text>
            </PressableScale>
          );
        })}
      </View>

      {/* ── 풀이 로딩 영상(자물쇠 화면 테마영상) on/off — daniel 07-13. 끄면 링+자물쇠 애니만. 다음 풀이부터 즉시 적용 ── */}
      <Text style={[styles.h, { marginTop: space(5) }]}>{t('settings.readingVideo', '풀이 로딩 영상')}</Text>
      <View style={styles.row}>
        {[true, false].map((on) => {
          const sel = readingVid === on;
          return (
            <PressableScale key={String(on)} style={[styles.opt, sel && styles.optOn]} onPress={() => { setReadingVideoEnabled(on); setReadingVid(on); }}>
              <Text style={[styles.optTx, sel && styles.optTxOn]}>{on ? t('settings.readingVideoOn', '테마 영상') : t('settings.readingVideoOff', '심플(영상 없이)')}</Text>
            </PressableScale>
          );
        })}
      </View>

      {/* ── 알림 ── daniel 07-02: 시스템 권한 프롬프트가 안 뜨던 문제 → 명시적 켜기 진입점(미결정=프롬프트, 거부=기기설정) */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.notif', '알림')}</Text>
      <PressableScale style={styles.notifRow} onPress={onNotif}>
        <View style={{ flex: 1, marginRight: space(3) }}>
          <Text style={styles.infoLabel}>{t('settings.notifDaily', '매일 오늘의 운세 알림')}</Text>
          <Text style={styles.notifSub}>
            {notifStatus === 'granted' ? t('settings.notifOn', '켜짐 · 매일 오전 9시')
              : notifStatus === 'denied' ? t('settings.notifDenied', '꺼짐 · 눌러서 기기 설정에서 켜기')
              : notifStatus === 'unavailable' ? t('settings.notifNA', '이 기기에서 사용 불가')
              : t('settings.notifOff', '꺼짐 · 눌러서 켜기')}
          </Text>
        </View>
        <Text style={[styles.notifState, notifStatus === 'granted' && { color: colors.ju }]}>{notifStatus === 'granted' ? 'ON' : 'OFF'}</Text>
      </PressableScale>

      <Text style={styles.note}>{t('settings.note')}</Text>

      {/* ── 앱 정보(버전·약관·개인정보·오픈소스) — 출시 준비 ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.appInfo', '앱 정보')}</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>{t('settings.version', '버전')}</Text><Text style={styles.infoVal}>{APP_VERSION}</Text></View>
        <PressableScale style={styles.infoRow} onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}><Text style={styles.infoLabel}>{t('settings.terms', '이용약관')}</Text><Text style={styles.infoArrow}>›</Text></PressableScale>
        <PressableScale style={styles.infoRow} onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}><Text style={styles.infoLabel}>{t('settings.privacy', '개인정보처리방침')}</Text><Text style={styles.infoArrow}>›</Text></PressableScale>
        {/* 버그 제보·문의(daniel 07-08) — 메일 프리필(앱 버전 포함=디버그). 메일 앱 없으면 주소 안내 폴백 */}
        <PressableScale style={styles.infoRow} onPress={() => {
          const subject = encodeURIComponent('[팔자] 버그 제보 · 문의');
          const body = encodeURIComponent(`\n\n\n──────────\n앱 버전: ${APP_VERSION}\n(위에 버그 내용이나 문의를 적어 주세요)`);
          Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() =>
            Alert.alert(t('settings.bugReport', '버그 제보 · 문의'), `${t('settings.bugReportFail', '메일 앱을 열 수 없어요. 아래 주소로 보내 주세요.')}\n${SUPPORT_EMAIL}`));
        }}><Text style={styles.infoLabel}>{t('settings.bugReport', '버그 제보 · 문의')}</Text><Text style={styles.infoArrow}>›</Text></PressableScale>
        <PressableScale style={[styles.infoRow, styles.infoRowLast]} onPress={() => Alert.alert(t('settings.license', '오픈소스 라이선스'), OSS_LICENSES)}><Text style={styles.infoLabel}>{t('settings.license', '오픈소스 라이선스')}</Text><Text style={styles.infoArrow}>›</Text></PressableScale>
      </View>

      {/* 계정 삭제(App Store 필수) — 파괴적 동작이라 맨 하단 배치(daniel). ★등록 유저만(익명은 '계정' 없음 — 데이터는 앱 삭제로 제거) */}
      {isRegistered && (
        <PressableScale style={styles.delAcctBtn} onPress={onDeleteAccount}>
          <Text style={styles.delAcctTx}>{t('settings.deleteAccount')}</Text>
        </PressableScale>
      )}

      {/* 긴 콜백(로그아웃·계정삭제) 동안 입력 차단 + 로딩 표시 */}
      <BusyOverlay visible={!!busy} message={busy ?? undefined} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' }, // 전역 배경 노출
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
  acctLoginSub: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(1) }, // 로그인=선택·크로스디바이스 안내(Apple 5.1.1)
  // 관리자 링크
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
  premScope: { ...font.caption, color: colors.inkFaint, marginTop: space(2.5), lineHeight: 17 },
  // 구매 복원(3.1.1) — 보조(외곽선) 버튼. 프리미엄 구매 CTA와 경합하지 않게 은은하게.
  restoreBtn: { alignSelf: 'flex-start', marginTop: space(3), paddingVertical: space(2.5), paddingHorizontal: space(4), borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  restoreBtnOff: { opacity: 0.5 },
  restoreTx: { color: colors.inkSoft, fontWeight: '700', fontSize: 14 },
  // 알림 행(설정에서 켜기·상태 표시)
  notifRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), ...shadow.soft },
  notifSub: { ...font.caption, color: colors.inkFaint, marginTop: space(1) },
  notifState: { fontWeight: '900', fontSize: 14, color: colors.inkFaint },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), alignItems: 'center' },
  // 칩 = 균일 높이 + 내용 중앙 정렬(글자 크기가 달라도 라벨이 가운데 오게, daniel)
  opt: { minHeight: 46, paddingHorizontal: space(4), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  optOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  optTx: { fontSize: 14, fontWeight: '700', color: colors.inkSoft, textAlign: 'center' },
  // ★테마 강조색 픽커
  accentDesc: { ...font.caption, color: colors.inkFaint, marginTop: space(1), marginBottom: space(3), lineHeight: 17 },
  accentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  accentChip: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), backgroundColor: colors.card, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space(3.25), paddingVertical: space(2.25) },
  accentChipOn: { borderColor: colors.ju, backgroundColor: colors.juSoft },
  accentDot: { width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  accentDotOn: { borderWidth: 2, borderColor: colors.ink },
  accentChipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  accentChipTxOn: { color: colors.ink },
  optTxOn: { color: colors.bg },
  preview: { marginTop: space(4), padding: space(4), borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.juLine, ...shadow.card },
  previewBody: { color: colors.ink },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(6), lineHeight: 18 },
});
