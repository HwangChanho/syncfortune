// app/src/lib/talk/adultVerify.ts — **본인인증으로 확인된 성인인가** (서버가 아는 사실)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-31: *"회원가입에 pass 넣고 성인대화도 그걸 기준으로"* · *"성인 대화 켤때 요구해"*
//
// ■ ★`adultGate.ts` 와 **다른 것**이다 — 헷갈리면 게이트가 무너진다
//   · `adultGate`  = «내가 성인이라고 눌렀다»  → 기기에 저장되는 **선호**
//   · 여기          = «본인인증으로 확인됐다»   → 서버가 가진 **사실**
//   화면의 스위치는 선호를 끄고 켜지만, **켤 수 있는 자격**은 여기가 정한다.
//   ⚠️서버(`talk` Edge)도 요청 body 를 안 믿고 `profiles.adult_verified_at` 을 직접 읽는다 —
//     즉 이 파일이 거짓말을 해도 대화가 열리지는 않는다. 여기는 **화면을 위한 조회**다.
//
// ■ 왜 가입이 아니라 «켤 때» 인가 (Boss 결정)
//   지금 병목은 «익명 → 로그인» 이다(앱 사용자 92명 중 90명이 익명).
//   가입 문턱을 더 높이면 그 병목이 더 좁아진다. 필요한 사람에게 필요한 순간에만 묻는다.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../supabase';

/**
 * 이 계정이 **본인인증으로 확인된 성인**인가.
 *
 * @returns 확인됐으면 true. 미확인·비로그인·조회 실패는 전부 false
 *   (⚠️실패를 true 로 떨어뜨리지 않는다 — 못 물어봤다는 이유로 열면 게이트가 아니다).
 */
export async function isAdultVerified(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_adult_verified');
    if (error) return false;
    return data === true;
  } catch {
    return false;   // 네트워크·모듈 문제 = 모름 = 닫는다
  }
}

/**
 * 본인인증(PASS)을 띄우고, 끝나면 서버에 기록되게 한다.
 *
 * ⚠️★아직 **계약 대기**다(본인확인기관 키). 그때까지는 `false` 를 돌려주고 화면은
 *   «준비 중» 으로 안내한다 — 없는 기능을 있는 척하지 않는다.
 *
 * ■ 붙일 때 바뀌는 것은 **이 함수 본문 하나**다
 *   ① PASS 창(웹뷰/리다이렉트) 호출 → ② 본인확인기관 콜백이 우리 Edge 로 옴
 *   ③ Edge 가 DI 를 받아 `sha256(pepper||DI)` 로 해시 → `mark_adult_verified(uid, hash)`
 *   ★DI 원문·CI·이름·생년월일은 **저장하지 않는다**(해시만). 자세한 근거는 마이그레이션 주석에.
 *
 * @returns 인증이 끝나 성인으로 확인됐으면 true
 */
export async function requestAdultVerification(): Promise<boolean> {
  return false;   // ← 계약·키가 오면 여기만 채운다
}

/** 본인인증이 붙었는가(화면 문구를 «준비 중»으로 가를 때 쓴다). */
export const ADULT_VERIFY_READY = false;
