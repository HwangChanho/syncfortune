// app/src/lib/sounds.ts — 사운드 관리 유틸리티 (expo-av)
// ─────────────────────────────────────────────────────────────────────────
// 앱 내 주요 인터랙션(카드 뒤집기, 버튼 클릭 등) 시 효과음 재생.
// ⚠️ expo-av 는 *네이티브 모듈*(ExponentAV) — 추가 후 dev client 를 재빌드해야 동작한다
//   (`npx expo run:ios`). 재빌드 전엔 최상위 import 가 모듈 로드 시점에 크래시하므로,
//   여기선 playSound 내부에서 *지연 로드(require)* + try/catch 로 감싸 부재 시 무음 처리한다.
//   → 사운드 파일·네이티브 재빌드가 준비되기 전에도 앱 전체가 안전하게 뜬다.
// ─────────────────────────────────────────────────────────────────────────

// 실제 사운드 파일이 assets/sounds 폴더에 준비되면 아래 주석을 해제하세요.
const SOUND_ASSETS: Record<string, any> = {
  // flip: require('../../assets/sounds/flip.mp3'),
  // click: require('../../assets/sounds/click.mp3'),
  // transition: require('../../assets/sounds/transition.mp3'),
};

export async function playSound(key: string) {
  if (!SOUND_ASSETS[key]) {
    // 등록된 사운드 자산 없음 — 무음(아직 파일 미준비)
    return;
  }
  try {
    // 지연 로드: expo-av 네이티브 모듈이 없으면(재빌드 전) 이 단계에서 throw → catch 로 무음.
    const { Audio } = require('expo-av');
    const { sound } = await Audio.Sound.createAsync(SOUND_ASSETS[key]);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (error) {
    // 네이티브 모듈 미포함(dev client 재빌드 전) 또는 재생 실패 — 무음 처리(앱 크래시 방지)
    console.log('Sound playback skipped:', error);
  }
}
