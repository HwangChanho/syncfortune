// src/app/(app)/settings.tsx — 설정 (글자 크기·언어)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 설정에서 글자 크기 조절. 통변 등 본문 가독성을 위한 전역 배율(fontScale) 선택 + 언어.
//   글자 크기는 즉시 반영(미리보기 문장으로 확인). 언어는 i18n.changeLanguage.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MyProfileCard } from '../../components/settings/MyProfileCard';
import { loadRepChart } from '../../lib/engine/myChart';
import { PressableScale } from '../../components/PressableScale';
import Constants from 'expo-constants'; // 앱 버전(app.json)
import { Alert } from '../../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import { useRouter, useFocusEffect } from 'expo-router';
import { getNotifStatus, requestNotifPermission, type NotifStatus } from '../../lib/backend/notifications'; // 알림 권한 상태·요청(설정 토글)
import { useTranslation } from 'react-i18next';
import { setAppLang } from '../../lib/i18n'; // 언어 변경 + persist(재시작 후 유지)
import { useFontScale, FONT_STEPS } from '../../lib/ui/fontScale';
import { useAuth } from '../../lib/useAuth';               // 계정(세션)
import { TextInput, Switch } from 'react-native'; // 커뮤니티 닉네임·일주 뱃지(daniel 2026-08-05 전면 익명+설정 닉네임)
import { getCommunityProfile, setNickname as saveNickname, setShowIlju } from '../../lib/backend/community';
import { useSubscription } from '../../lib/billing/subscription';  // 프리미엄 상태·구매
import { waitForPremium, markPremiumOwnedNow } from '../../lib/billing/premiumStore';   // 복원=서버 is_premium 확정(단일소스·07-07) + 웹훅 실패 시 영수증 검증분 낙관표시(#2)
import { useCoinBalance } from '../../lib/billing/coins';   // ★운 잔액 — 공용 훅(표시 규칙 단일화)
import { restorePurchasesRC } from '../../lib/billing/purchases';  // 구매 복원(App Store 3.1.1 필수)
import { loadCredits } from '../../lib/billing/coupons';  // 프리미엄 폴백 가격(₩) + 이용권 잔여 재로딩(복원 후)
import { supabase } from '../../lib/supabase';             // 로그아웃
import { BusyOverlay } from '../../components/BusyOverlay'; // 긴 콜백(로그아웃·삭제) 로딩 오버레이
import { setAuthBusy } from '../../lib/ui/authBusy'; // 로그아웃 전환 전역 블로킹(먹통 방지)
import { colors, radius, space, shadow, font, getLoadingMode, setLoadingMode, type LoadingMode } from '../../lib/theme'; // ★다크/라이트 토글 제거·로딩 3모드(video/text/off, daniel 2026-07-15)

const LANGS: { key: string; label: string }[] = [
  { key: 'ko', label: '한국어' }, { key: 'en', label: 'English' }, { key: 'ja', label: '日本語' },
];

// 앱 정보(출시) — 버전·약관·개인정보·오픈소스. ★daniel: 약관/개인정보 URL 을 실제 호스팅 주소로 교체(App Store 심사 필수).
// ★버전 표기에 **빌드 번호**를 붙인다(2026-08-09).
//   종전엔 versionName('1.0.0')만 떠서 vc59 와 vc60 을 화면에서 구분할 수 없었다 —
//   "업데이트했는데 안 돼요"가 실제로는 **구버전에서 시도한 것**이었는지 확인할 방법이 없었다.
//   nativeBuildVersion = 실제 설치된 네이티브 빌드(Android versionCode / iOS buildNumber).
// ⚠️`Constants.nativeBuildVersion` 은 expo-constants 17 에서 **undefined** 로 온다(실측 — `(?)` 로 떴다).
//   → JS 단일 출처 상수를 쓰고, build.gradle 과의 일치는 `check:buildnum` 하네스가 강제한다.
// ★괄호 안 빌드번호는 뺐다(Boss 2026-08-20). 사용자에게 `1.0.5 (100)` 의 괄호는 읽을 정보가 아니다.
//   ⚠️버리는 게 아니라 **옮겨져 있다** — 버그 제보가 `build_no` 로 따로 올린다(`bugreport.tsx:71` 실측).
//     그래서 어느 빌드에서 난 문제인지는 여전히 알 수 있다.
const APP_VERSION = String(Constants.expoConfig?.version ?? '1.0.0');
const TERMS_URL = 'https://hwangchanho.github.io/syncfortune/legal/terms-ko.html';     // GitHub Pages(정식)
const PRIVACY_URL = 'https://hwangchanho.github.io/syncfortune/legal/privacy-ko.html'; // GitHub Pages — App Store 개인정보 URL
const OSS_LICENSES = 'React Native · Expo (MIT)\niztro · lunar-javascript (MIT)\nRevenueCat Purchases · Google Mobile Ads\nreact-i18next · React Navigation (MIT)\nreact-native-svg · safe-area-context (MIT)\n\n각 라이브러리는 해당 저장소의 라이선스를 따릅니다.';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();   // Stack 헤더를 껐으므로 상단 여백은 화면이 책임진다
  // 대표 명식 이름 — 프로필 이름을 안 정했을 때의 기본값
  const [repName, setRepName] = useState<string | null>(null);
  useEffect(() => { void loadRepChart().then((c) => setRepName(c?.label ?? null)); }, []);
  const { t, i18n } = useTranslation();
  // ── 커뮤니티(전면 익명·닉네임은 설정에서만) ──
  const [nick, setNick] = useState('');
  const [ilju, setIlju] = useState(false);
  const [nickSaved, setNickSaved] = useState<null | 'ok' | 'err'>(null);
  useEffect(() => { getCommunityProfile().then((p) => { setNick(p.nickname ?? ''); setIlju(p.show_ilju); }).catch(() => {}); }, []);
  const router = useRouter();
  const { session, isRegistered } = useAuth();
  const { refresh } = useSubscription();
  const coins = useCoinBalance(session);   // 보유 운(null=미로그인·조회 실패). 표시 규칙은 훅 한 곳에.
  const { rawScale, setScale, fs } = useFontScale();   // ★설정 화면은 **사용자가 고른 값**으로 판정한다
  //   (`scale` 은 웹 폭 보정이 곱해진 실제 배율이라 FONT_STEPS 와 안 맞는다 — 어떤 단계도 안 켜진다)
  const [busy, setBusy] = useState<string | null>(null); // 전체화면 로딩 오버레이 메시지(긴 콜백)
  const [loadingMode, setLoadingModeState] = useState<LoadingMode>(getLoadingMode()); // 로딩(인트로) 화면 video(호랑이)/text(八字)/off(없음, daniel 07-15)
  // 홈 배치 순서 편집은 홈 화면의 '⠿ 홈 배치 편집' 모달로 이동(daniel 07-21) — 계정뷰에서 제거.
  const [notifStatus, setNotifStatus] = useState<NotifStatus>('undetermined'); // 알림 권한 상태(행 라벨·동작 분기)
  const [restoring, setRestoring] = useState(false); // 구매 복원 진행 중(연타 가드·버튼 로딩)
  // 알림 권한 상태 로드 — 포커스마다(기기 설정 다녀와서 켜/끄면 ON/OFF 즉시 반영, daniel 07-02)
  useFocusEffect(useCallback(() => { getNotifStatus().then(setNotifStatus).catch(() => {}); }, []));

  // 관리자/테스트모드 노출 = session 반응형. 로그아웃(session=null) 즉시 false로 내려 관리자 메뉴가 바로 사라지게(daniel) — 빈 deps면 마운트 1회라 창 전환 전까지 살아있었음.
  // 프리미엄 현지 통화 가격(RC) 로드 — USD 기준 등록 시 사용자 지역 통화로 자동 표시.
  // ★프리미엄 현지가 조회 제거(daniel 2026-07-30) — setState 만 하고 **화면에 그리는 곳이 0** 이었다.
  //   게다가 premium_lifetime 은 스토어에 등록조차 없어 매 진입마다 헛된 스토어 왕복이었다.

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
      if (after !== 'granted') Alert.alert(t('settings.notif', '알림'), t('settings.notifDeniedMsg', '알림을 받으려면 기기 설정에서 니운내운 알림을 켜 주세요.'), [cancel, openIosSettings]);
      return;
    }
    // denied → iOS는 재프롬프트 불가 → 기기 설정으로
    Alert.alert(t('settings.notif', '알림'), t('settings.notifDeniedMsg', '알림을 받으려면 기기 설정에서 니운내운 알림을 켜 주세요.'), [cancel, openIosSettings]);
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
    // ★상단 인셋은 화면이 직접 준다 — Stack 헤더를 껐기 때문이다(2026-08-20 4탭 전환).
    //   ⚠️안 주면 폰에서 상태바 아래로 글자가 파고든다(웹에선 0이라 티가 안 난다).
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" style={styles.screen}
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + space(4) }]}>
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

      {/* ── 관리자 진입점 제거(daniel 2026-08-12 "앱에서 admin.tsx 빼고 나머지도 웹으로 옮겨") ──
          관리자 기능은 전부 **웹 콘솔**로 옮겼다: https://hwangchanho.github.io/syncfortune/admin/
          · 앱 번들에서 관리자 화면(752줄)이 사라져 **심사자가 볼 수 있는 면이 줄고** 용량도 준다.
          · 권한은 원래부터 **서버**(`is_caller_admin()`)가 판정했으므로 보안이 약해지지 않는다 —
            앱 화면은 그 답을 그리기만 했다. 같은 RPC 를 웹이 그대로 부른다.
          ⚠️`is_admin` 을 보는 **다른** 코드(광고·커뮤니티 신고관리 등)는 그대로 둔다 — 화면만 뺀 것이다. */}

      {/* ── 내 프로필 (Boss 2026-08-20) ──
          여기서 정한 이름·사진이 **친구목록 상단 "나"** 에 그대로 쓰인다.
          ⚠️커뮤니티 닉네임과는 다른 값이다 — 거긴 전면 익명이라 목적이 반대다. */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('profile.title', '내 프로필')}</Text>
      <MyProfileCard fallbackName={repName} />

      {/* ── 내 기록 ──────────────────────────────────────────────────────
          ★★2026-08-19 3탭 전환에서 **탭에서 빠진 화면들의 대체 진입로**다(Boss
            *"만세력이나 기타 설정들은 설정에서 진입"*).
          ⚠️이 블록을 지우면 만세력·콘텐츠 목록·내 풀이가 **도달 불가**가 된다 —
            화면은 멀쩡히 살아 있는데 아무 데서도 들어갈 수 없는 상태가 되고,
            그건 삭제보다 나쁘다(코드는 남아 유지보수 비용은 그대로다).
            `check:reach` 가 이 진입로들을 지킨다. */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.myRecords', '내 기록')}</Text>
      <View style={styles.infoCard}>
        <PressableScale style={styles.infoRow} onPress={() => router.push('/charts')}>
          <Text style={styles.infoLabel}>{t('menu.manse', '만세력')}</Text><Text style={styles.infoArrow}>›</Text>
        </PressableScale>
        <PressableScale style={styles.infoRow} onPress={() => router.push('/myreadings')}>
          <Text style={styles.infoLabel}>{t('nav.readings', '풀이')}</Text><Text style={styles.infoArrow}>›</Text>
        </PressableScale>
        <PressableScale style={styles.infoRow} onPress={() => router.push('/contents')}>
          <Text style={styles.infoLabel}>{t('nav.fortune', '운세')}</Text><Text style={styles.infoArrow}>›</Text>
        </PressableScale>
        {/* ★홈의 「⚡바로가기」가 없어지면서 여기로 옮겼다(2026-08-19). 상담사 톡이 이 역할을 대신하지만
            **쓰던 사람의 이력이 남아 있어** 진입로를 끊지 않는다 — 없앨지는 Boss 판단이다. */}
        <PressableScale style={[styles.infoRow, styles.infoRowLast]} onPress={() => router.push('/coach')}>
          <Text style={styles.infoLabel}>{t('nav.coach', '우니')}</Text><Text style={styles.infoArrow}>›</Text>
        </PressableScale>
      </View>

      {/* ── 코인 ──
          ★프리미엄 폐지(daniel 2026-07-28) — 이 자리에 있던 '코인 충전하기'를 코인 잔액·충전으로 교체했다.
            계정 화면에서 지금 얼마 있는지 바로 보이는 게 결제 이해에 가장 직접적이다. */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.coins', '운')}</Text>
      <PressableScale style={styles.coinRow} onPress={() => router.push('/coins')}>
        <Text style={[styles.coinLabel, { fontSize: fs(14) }]}>{t('coins.balance', '보유 운')}</Text>
        {/* null=조회 실패 → '—'. 0으로 표시하면 이미 충전한 사용자를 혼란시킨다(07-28 재결제 사고와 같은 유형) */}
        <Text style={[styles.coinNum, { fontSize: fs(17) }]}>{coins == null ? '—' : `${coins.toLocaleString('ko-KR')} 운`}</Text>
        <Text style={[styles.coinGo, { fontSize: fs(13) }]}>{t('coins.charge', '운 충전하기')} ›</Text>
      </PressableScale>
      {/* 구매 복원 — App Store 3.1.1 필수(비소모성 평생 프리미엄 복구). 로그인/프리미엄 여부와 무관하게 항상 노출·접근 가능. */}
      <PressableScale style={[styles.restoreBtn, restoring && styles.restoreBtnOff]} onPress={onRestore} disabled={restoring}>
        <Text style={styles.restoreTx}>{restoring ? t('settings.restoring', '복원 중…') : t('settings.restore', '구매 복원')}</Text>
      </PressableScale>

      {/* ── 글자 크기 ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.fontSize')}</Text>
      <View style={styles.row}>
        {FONT_STEPS.map((s) => {
          const on = Math.abs(rawScale - s.scale) < 0.001;
          return (
            <PressableScale key={s.key} style={[styles.opt, on && styles.optOn]} onPress={() => setScale(s.scale)}>
              <Text style={[styles.optTx, on && styles.optTxOn, { fontSize: 13 * s.scale }]}>{t(`settings.size_${s.key}`)}</Text>
            </PressableScale>
          );
        })}
      </View>
      {/* 미리보기 — 현재 배율이 통변 본문에 어떻게 보이는지 */}
      <View style={styles.preview}>
        <Text style={[styles.previewBody, { fontSize: fs(15), lineHeight: 25 }]}>{t('settings.preview')}</Text>
      </View>

      {/* ── 커뮤니티(전면 익명 — 닉네임만 노출·미설정이면 자동 익명이름) ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.community', '커뮤니티')}</Text>
      <View style={styles.nickRow}>
        <TextInput
          style={styles.nickInput}
          value={nick}
          onChangeText={(v) => { setNick(v); setNickSaved(null); }}
          placeholder={t('settings.nickPh', '닉네임 (2~12자, 비우면 자동 익명이름)')}
          placeholderTextColor={colors.inkFaint}
          maxLength={12}
          autoCorrect={false}
        />
        <PressableScale
          style={styles.nickSave}
          onPress={async () => {
            try { await saveNickname(nick); setNickSaved('ok'); }
            catch (e) {
              setNickSaved('err');
              const m = (e as Error)?.message;
              Alert.alert(t('common.error'), m === 'PROFANITY' ? t('settings.nickBad', '사용할 수 없는 단어가 있어요.') : m === 'LENGTH' ? t('settings.nickLen', '닉네임은 2~12자예요.') : t('common.retryLater', '잠시 후 다시 시도해 주세요.'));
            }
          }}
        >
          <Text style={styles.nickSaveTx}>{nickSaved === 'ok' ? t('settings.nickDone', '저장됨') : t('common.save', '저장')}</Text>
        </PressableScale>
      </View>
      <View style={styles.iljuRow}>
        <Text style={styles.iljuLabel}>{t('settings.showIlju', '내 일주 뱃지 보이기')}</Text>
        <Switch value={ilju} onValueChange={(v) => { setIlju(v); setShowIlju(v).catch(() => setIlju(!v)); }} trackColor={{ true: colors.ju }} />
      </View>
      <Text style={styles.iljuHint}>{t('settings.iljuHint', '글·댓글 옆에 태어난 날의 두 글자만 표시돼요. 생년월일은 알 수 없어요.')}</Text>

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

      {/* ── ⚠️★「테마 색」 픽커를 **뺐다**(2026-08-22) ──────────────────────────
           Boss 결정: 콘티대로 **라벤더 한 색**. 화면 팔레트가 더 이상 오행에 따라 바뀌지 않는다.
           ⇒ 이 픽커는 눌러도 **아무 일도 일어나지 않는** 컨트롤이 됐다. 남겨 두면
             바로 위 주석이 스스로 경고한 그것이 된다 — *"화면이 하는 일과 설명이 어긋나면
             그게 곧 거짓말이다."* 실제로 설명문("오행에 맞춰 화면 색이 달라져요")이 이미 거짓이었다.
           ★오행 색 자체는 없어지지 않았다 — 아바타·명식 표시(`lib/engine/ohaeng`)는 그대로다.
             바뀐 건 **화면 팔레트**뿐이다.
           ★되돌리려면: `theme.ts` 의 `const EP = LAVENDER` 한 줄 + 이 블록. ── */}

      {/* ── 로딩 화면(인트로) — video 호랑이영상 / text 八字한자 / off 없음(바로 앱). daniel 07-15. 변경은 다음 실행부터 적용 ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.loadingScreen', '로딩 화면')}</Text>
      <View style={styles.row}>
        {/* ★영상 옵션 제거(daniel 2026-08-05 "로딩화면 영상 다 없애버려") — text/off 2옵션. 저장값이 'video'였던 유저는 text 로 표시·동작. */}
        {(['text', 'off'] as LoadingMode[]).map((m) => {
          const sel = loadingMode === m || (m === 'text' && loadingMode === 'video');
          const label = m === 'text' ? t('settings.loadingVideoOff', '앱 이름만') : t('settings.loadingOff', '끄기');
          return (
            <PressableScale key={m} style={[styles.opt, sel && styles.optOn]} onPress={() => {
              setLoadingMode(m); setLoadingModeState(m);
              Alert.alert(t('settings.loadingScreen', '로딩 화면'), t('settings.themeRestart', '앱을 다시 켜면 적용돼요.'));
            }}>
              <Text style={[styles.optTx, sel && styles.optTxOn]}>{label}</Text>
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

{/* ── 앱 정보(버전·약관·개인정보·오픈소스) — 출시 준비 ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.appInfo', '앱 정보')}</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>{t('settings.version', '버전')}</Text><Text style={styles.infoVal}>{APP_VERSION}</Text></View>
        <PressableScale style={styles.infoRow} onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}><Text style={styles.infoLabel}>{t('settings.terms', '이용약관')}</Text><Text style={styles.infoArrow}>›</Text></PressableScale>
        <PressableScale style={styles.infoRow} onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}><Text style={styles.infoLabel}>{t('settings.privacy', '개인정보처리방침')}</Text><Text style={styles.infoArrow}>›</Text></PressableScale>
        {/* 버그 제보 — daniel 2026-08-13: mailto 대신 **DB 전송**(bug_reports).
            메일 앱이 없거나 계정이 없는 기기에서도 보낼 수 있고, 관리자 콘솔에서 한자리에 모아 본다.
            메일 주소는 bugreport 화면으로 옮겼다 — 전송 실패 시 거기서 폴백으로 안내한다(주소는 한 곳에만). */}
        <PressableScale style={styles.infoRow} onPress={() => router.push('/bugreport?from=settings')}>
          <Text style={styles.infoLabel}>{t('settings.bugReport', '버그 제보 · 문의')}</Text><Text style={styles.infoArrow}>›</Text></PressableScale>
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
  // ★하단 여백 = 하단 크롬(광고 배너 50 + 네비바 86 + 홈 인디케이터 34 ≈ 170pt) 이상.
  //   이 화면은 **'계정 삭제'가 마지막 요소**라 여백이 모자라면 버튼이 통째로 가린다
  //   (명식 등록 화면에서 실측·확인된 것과 같은 원인 — daniel 2026-08-07).
  //   계정 삭제는 App Store 심사 요구사항이라 도달 불가는 반려 사유가 될 수 있다.
  wrap: { padding: space(5), paddingBottom: space(44) },
  h: { ...font.heading, marginBottom: space(3) },
  // 계정
  // 커뮤니티 닉네임·일주 뱃지 줄(daniel 2026-08-05)
  nickRow: { flexDirection: 'row', gap: space(2), alignItems: 'center' },
  nickInput: { flex: 1, backgroundColor: colors.sunk, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space(3.5), paddingVertical: space(2.5), fontSize: 14, lineHeight: 18, color: colors.ink },
  nickSave: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(4) },
  nickSaveTx: { color: colors.bg, fontWeight: '800', fontSize: 13, lineHeight: 17 },
  iljuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space(3) },
  iljuLabel: { ...font.body, color: colors.ink },
  iljuHint: { ...font.caption, color: colors.inkFaint, marginTop: space(1) },
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
  // 계정 삭제 — 약하게 노출(파괴적), 우측 정렬 텍스트 링크
  delAcctBtn: { alignSelf: 'flex-end', marginTop: space(2), paddingVertical: space(1), paddingHorizontal: space(1) },
  delAcctTx: { color: '#E5484D', fontSize: 13, fontWeight: '600' },
  // 프리미엄
  premBuyBtn: { backgroundColor: colors.ju, borderRadius: radius.md, padding: space(4), alignItems: 'center', ...shadow.card },
  premBuyTx: { color: colors.bg, fontWeight: '900', fontSize: 16 },
  premBuySub: { color: colors.bg, opacity: 0.85, fontSize: 12, marginTop: space(1) },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, paddingVertical: space(4), paddingHorizontal: space(4.5) },
  coinLabel: { ...font.body, color: colors.inkSoft, flex: 1 },
  coinNum: { ...font.title, color: colors.ju, fontWeight: '900' },
  coinGo: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
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
  optTxOn: { color: colors.onJu },
  preview: { marginTop: space(4), padding: space(4), borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.juLine, ...shadow.card },
  previewBody: { color: colors.ink },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(6), lineHeight: 18 },
  // ── 홈 배치 순서 편집(daniel 07-19) — 번호 + 라벨 + 위/아래 버튼 한 줄 ──
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingVertical: space(2.5), paddingHorizontal: space(3.5) },
  orderIdx: { width: 18, textAlign: 'center', fontSize: 12, fontWeight: '800', color: colors.ju },
  orderLabel: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink },
  orderBtn: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay, borderWidth: 1, borderColor: colors.line },
  orderBtnOff: { opacity: 0.35 }, // 맨 위/맨 아래 = 이동 불가(비활성 표시)
  orderBtnTx: { fontSize: 14, fontWeight: '800', color: colors.ink },
  orderBtnTxOff: { color: colors.inkFaint },
  orderReset: { alignSelf: 'flex-start', marginTop: space(1), paddingVertical: space(2), paddingHorizontal: space(3.5), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.juSoft },
  orderResetTx: { fontSize: 13, fontWeight: '800', color: colors.ju },
});
