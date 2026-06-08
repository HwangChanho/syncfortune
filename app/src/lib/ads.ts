// app/src/lib/ads.ts — 광고 (AdMob). daniel 계정·SDK 연동 전 no-op 골격.
// ─────────────────────────────────────────────────────────────────────────
// 무료 기능 진입 시 전면광고(interstitial) — 광고 수익 + 자연스러운 유료 전환 압박(ADR-043).
// 무료=온디바이스(LLM 0)인데 광고로 수익화, 유료는 구독.
// ─────────────────────────────────────────────────────────────────────────

// 무료 진입 시 전면광고. AdMob 연동 전엔 no-op(광고 없이 통과).
export async function showInterstitialAd(): Promise<void> {
  // TODO(daniel): react-native-google-mobile-ads InterstitialAd.createForAdRequest → load → show.
  //   빈도 조절(매 진입 vs N회마다·쿨다운)은 정책으로. 현재 no-op(개발 중 광고 X).
  return;
}

// (구) 유료 통변용 리워드 광고 — entitlement.watchAdForReading 와 연동 예정.
export async function showRewardedAd(): Promise<boolean> {
  // TODO(daniel): RewardedAd. earned 콜백 시 true.
  throw new Error('광고는 준비 중입니다 (AdMob 연동 예정).');
}
