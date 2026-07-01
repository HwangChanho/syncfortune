// app/src/lib/sounds.ts — 사운드 유틸리티 (현재 무음 stub)
// ─────────────────────────────────────────────────────────────────────────
// 효과음은 추후 expo-audio(expo-av 후속)로 구현 예정. 지금은 사운드 파일 미준비라
//   playSound 는 안전한 no-op. expo-av 는 Expo SDK 52(Xcode 26.5) 호환 문제로 제거(2026-06).
//   → 사운드 파일 준비 시 expo-audio 로 재도입.
// ─────────────────────────────────────────────────────────────────────────

/** 효과음 재생 — 사운드 자산/네이티브 준비 전까지 무음 no-op. 호출처(playSound('click') 등) 유지. */
export async function playSound(_key: string): Promise<void> {
  // TODO: 사운드 파일 준비 시 expo-audio 로 구현
  return;
}
