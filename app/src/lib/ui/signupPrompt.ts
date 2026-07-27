// app/src/lib/ui/signupPrompt.ts — 유료 풀이 진입 시 계정 연결 안내(비회원)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-27: "비회원은 무조건 회원가입으로 유도해서 시작해야할 것 같아"
//                  → "실제 풀이까지 진입할 때 뜨게 해줘"
//   앱 시작이 아니라 **유료 풀이에 들어가는 순간**에 띄운다. 그 지점이
//   ①계정이 실제로 필요해지는 자리이고(구매·복원) ②무료 콘텐츠 이용을 방해하지 않는다.
//
// ⚠️★심사 경계: 이 앱은 2026-07-08 에 **5.1.1(가입 강제)로 리젝된 이력**이 있다.
//   그래서 이건 **차단이 아니라 안내**다 — '나중에'로 그대로 계속 볼 수 있다.
//   무료·온디바이스 콘텐츠에는 절대 붙이지 말 것(check:anongate G3 가 감시한다).
//
// 빈도: **앱 실행당 1회**. 화면을 옮길 때마다 뜨면 안내가 아니라 방해가 되고,
//   그러면 사용자는 내용을 읽지 않고 닫는 습관이 든다(유도 효과 자체가 사라진다).
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { Alert } from './alert';
import { isRegisteredUser } from '../useAuth';
import { logEvent } from '../backend/logger';

// 앱 실행당 1회 — 모듈 스코프 플래그(앱을 다시 켜면 초기화된다).
let shownThisLaunch = false;

/**
 * 유료 풀이 진입 시 비회원에게 계정 연결을 권한다.
 * @param goLogin 로그인 화면으로 보내는 콜백
 * @param t i18n
 * @returns 안내를 띄웠으면 true(호출측은 흐름을 막지 않는다 — 참고용 반환값)
 */
export function promptSignupOnReadingEnter(goLogin: () => void, t: (k: any, d?: any) => string): boolean {
  if (shownThisLaunch) return false;
  if (isRegisteredUser()) return false;   // 이미 계정이 있으면 볼 이유가 없다
  shownThisLaunch = true;
  logEvent('signup_prompt_reading');       // 노출 로그 — 유도 효과를 나중에 실측할 수 있게
  Alert.alert(
    t('signupPrompt.title', '계정을 연결하면 이 풀이가 안전하게 보관돼요'),
    t('signupPrompt.msg', '지금은 임시 계정이라 앱을 지우거나 기기를 바꾸면 구매한 이용권과 풀이를 되찾기 어려워요. 연결하지 않아도 계속 보실 수 있어요.'),
    [
      { text: t('signupPrompt.later', '나중에'), style: 'cancel' },   // ★차단 아님(5.1.1)
      { text: t('signupPrompt.cta', '계정 연결'), onPress: goLogin },
    ],
  );
  return true;
}
