// app/src/lib/talk/adultGate.ts — **성인 확인** 단일 원본
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26 *"19금 대화도 성인인증 된 대상이면 가능하면 좋겠어"*.
//
// ■ 종전엔 속궁합 화면 **안에만** 있었다
//   `SokgunghapScreen` 이 `pref.sok17ok` 를 자기 파일에서 읽고 썼다. 대화창에도 필요해지면서
//   같은 키를 두 곳에서 다루게 되는데, 그러면 한쪽만 고쳐져 **한 화면은 열리고 한 화면은 막히는**
//   일이 생긴다. ⇒ 여기로 모은다.
//
// ■ ⚠️★이것은 «본인인증»이 아니라 «자기 확인»이다
//   화면에서 «성인입니다» 를 누른 것을 기기에 저장할 뿐, 신분 확인이 아니다.
//   ⇒ 이 값을 근거로 **법적으로 성인임을 주장하는 문구를 쓰면 안 된다.**
//     진짜 본인인증(PASS·아이핀)이 붙으면 그때 `verified` 를 따로 둔다.
//
// ■ 이 게이트가 여는 것 / 열지 않는 것
//   여는 것   : 성적 궁합·애정 관법을 **에두르지 않고** 말하는 것(속궁합이 이미 하는 수준)
//   안 여는 것: 노골적 성행위 묘사 — 스토어 심사(Apple 1.1.4)에서 걸린다.
//              열려 있다고 해서 «무엇이든» 이 되는 게 아니라 **말투의 솔직함**이 열리는 것이다.
// ═══════════════════════════════════════════════════════════════════════════
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/** ★키를 바꾸지 말 것 — 속궁합에서 이미 확인한 사람이 대화창에서 또 확인하지 않아야 한다. */
const KEY = 'pref.sok17ok';

/**
 * ⚠️★★**웹에서는 `expo-secure-store` 가 동작하지 않는다** (2026-08-30 실측으로 잡은 사고).
 *
 * ■ 증상: Boss *"성인대화 토글 켰는데 계속 꺼진 상태로 나와"*.
 * ■ 원인: SecureStore 는 **네이티브 전용**이다. 웹에서는 저장도 읽기도 조용히 아무 일도 안 한다
 *   (예외도 안 난다 — `?.()` 로 부르고 있어 «없는 함수» 가 그냥 undefined 로 지나간다).
 *   ★그런데 이 토글은 08-28 결정으로 **웹에만 있다**(앱에서는 숨김) ⇒ **켤 수 있는 유일한 곳에서
 *     저장이 안 되는** 상태였다. 기능이 통째로 죽어 있었는데 오류 한 줄 없었다.
 * ■ ⇒ 웹은 `localStorage`, 네이티브는 SecureStore. **같은 키**를 쓴다.
 *   ⚠️`localStorage` 는 사생활 보호 창·차단 설정에서 **접근만으로 예외**가 날 수 있어 try 로 감싼다.
 */
const isWeb = Platform.OS === 'web';
const webGet = (): string | null => { try { return globalThis.localStorage?.getItem(KEY) ?? null; } catch { return null; } };
const webSet = (v: string): void => { try { globalThis.localStorage?.setItem(KEY, v); } catch { /* 차단됨 */ } };
const webDel = (): void => { try { globalThis.localStorage?.removeItem(KEY); } catch { /* 차단됨 */ } };

/** 이 기기에서 성인 확인을 했는가(동기 — 첫 렌더에서 쓴다). */
export function adultConfirmed(): boolean {
  if (isWeb) return webGet() === '1';
  try { return (SecureStore as any).getItem?.(KEY) === '1'; } catch { return false; }
}

/** 성인 확인을 저장한다. */
export function markAdultConfirmed(): void {
  if (isWeb) { webSet('1'); return; }
  try { (SecureStore as any).setItem?.(KEY, '1'); } catch { /* noop */ }
  SecureStore.setItemAsync(KEY, '1').catch(() => {});
}

/** 확인을 무른다(설정에서 끌 수 있게). */
export function clearAdultConfirmed(): void {
  if (isWeb) { webDel(); return; }
  try { (SecureStore as any).setItem?.(KEY, '0'); } catch { /* noop */ }
  SecureStore.deleteItemAsync(KEY).catch(() => {});
}
