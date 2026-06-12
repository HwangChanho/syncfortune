// app/src/lib/ads.ts — 광고 (AdMob: 전면·보상형). lazy-require + 폴백.
// ─────────────────────────────────────────────────────────────────────────
// 무료 수익화(ADR-043): 무료 기능 진입 = 보상형/전면 광고, 만세력 10개↑ 추가 = 보상형 게이트.
// react-native-google-mobile-ads 는 *네이티브 모듈* — 미포함 빌드(재빌드 전 dev client)엔 없으므로
//   lazy require 가드: 모듈 없음 → 광고 없이 통과(흐름 안 막음). AdBanner 와 동일 패턴.
// unitId: __DEV__ = 구글 공식 테스트 ID 강제. 프로덕션 빌드 = app/.env 의 EXPO_PUBLIC_ADMOB_*(미설정 시 테스트 폴백).
//   ★daniel: AdMob 콘솔 실 unit ID 를 app/.env 에 주입(.env.example 참조). app.json 의 app id(~) 도 실값 교체.
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';

// 네이티브 모듈 lazy require — 미포함 빌드에서 import 크래시 방지.
let Ads: any = null;
try { Ads = require('react-native-google-mobile-ads'); } catch { Ads = null; }

// 구글 공식 테스트 unit — env 미설정 시 폴백(개발·미설정 빌드에서 광고 흐름 확인용).
const TEST_REWARDED = { ios: 'ca-app-pub-3940256099942544/1712485313', android: 'ca-app-pub-3940256099942544/5224354917' };
const TEST_INTERSTITIAL = { ios: 'ca-app-pub-3940256099942544/4411468910', android: 'ca-app-pub-3940256099942544/1033173712' };
// 프로덕션 unit — app/.env 의 EXPO_PUBLIC_ADMOB_*(EXPO_PUBLIC_* 만 번들 인라인) 주입, 미설정 시 테스트 폴백.
//   unit ID 는 시크릿 아님(클라 노출 정상)이나 공개 레포에 박지 않고 .env 로 주입한다.
const PROD_REWARDED: Record<string, string> = {
  ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS ?? TEST_REWARDED.ios,
  android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID ?? TEST_REWARDED.android,
};
const PROD_INTERSTITIAL: Record<string, string> = {
  ios: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS ?? TEST_INTERSTITIAL.ios,
  android: process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID ?? TEST_INTERSTITIAL.android,
};

// 무료 진입 시 전면광고. 모듈 없음/로드 실패 시 조용히 통과(흐름 안 막음).
export async function showInterstitialAd(): Promise<void> {
  if (!Ads?.InterstitialAd) return; // 재빌드 전 = 광고 없이 통과
  const { InterstitialAd, AdEventType, TestIds } = Ads;
  const unitId = __DEV__ ? TestIds.INTERSTITIAL : (PROD_INTERSTITIAL[Platform.OS] ?? TestIds.INTERSTITIAL);
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; cleanup(); resolve(); } };
    const ad = InterstitialAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true });
    const offLoaded = ad.addAdEventListener(AdEventType.LOADED, () => { ad.show().catch(finish); });
    const offClosed = ad.addAdEventListener(AdEventType.CLOSED, finish);
    const offError = ad.addAdEventListener(AdEventType.ERROR, finish);
    function cleanup() { offLoaded(); offClosed(); offError(); }
    const timer = setTimeout(finish, 12000); // 로드 지연/실패해도 흐름 보장
    ad.load();
    // finish 시 타이머 정리 — resolve 후 중복 호출 무해하지만 명시 정리
    const _clear = () => clearTimeout(timer);
    Promise.resolve().then(() => { if (done) _clear(); });
  });
}

// 보상형 광고 — 끝까지 시청(EARNED_REWARD) 시 true. 닫기/실패/모듈없음 = false.
//   만세력 추가 게이트·무료 통변 리워드에서 사용(true 일 때만 보상 지급).
export async function showRewardedAd(): Promise<boolean> {
  if (!Ads?.RewardedAd) return false; // 재빌드 전 = 보상 없음(호출처가 폴백 판단)
  const { RewardedAd, RewardedAdEventType, AdEventType, TestIds } = Ads;
  const unitId = __DEV__ ? TestIds.REWARDED : (PROD_REWARDED[Platform.OS] ?? TestIds.REWARDED);
  return new Promise<boolean>((resolve) => {
    let earned = false;
    let done = false;
    const finish = (v: boolean) => { if (!done) { done = true; cleanup(); resolve(v); } };
    const ad = RewardedAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true });
    const offLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => { ad.show().catch(() => finish(false)); });
    const offEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; });
    const offClosed = ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned)); // 닫을 때 적립 여부로 확정
    const offError = ad.addAdEventListener(AdEventType.ERROR, () => finish(false));
    function cleanup() { offLoaded(); offEarned(); offClosed(); offError(); }
    setTimeout(() => finish(earned), 30000); // 안전 타임아웃(영상 길이 고려)
    ad.load();
  });
}
