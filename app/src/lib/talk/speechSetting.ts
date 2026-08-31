// app/src/lib/talk/speechSetting.ts — 말투를 **회원이 설정에서 정한다**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-31 (스크린샷): *"말편하게 하라니깐 저러는데 저건왜그래"*
//                            *"그냥 설정에서 반말모드 존댓말모드 설정할수 있게하고
//                              저건 묻지 않는걸로 하자"*
//
// ■ 무엇이 어색했나 — **묻는 방향이 뒤집혔다**
//   상담가 「말 편하게 해도 될까요?」 → 회원 「어」 → 상담가 「편하게 말씀해도 괜찮아요.」
//   회원이 허락을 구한 것으로 읽은 것이다.
//   ★대화 **중에** 합의를 판정하려 하니 방향·시점이 흔들렸다(이력이 요약으로 접히면 더 그렇다).
//   ⇒ 물어서 알아내지 말고 **정해 둔 값을 읽는다.**
//
// ■ ★값은 **서버(`profiles.speech_casual`)** 에 둔다 — 기기가 아니라.
//   말투를 실제로 쓰는 건 Edge(`talk`)다. 기기에만 있으면 매 요청에 실어 보내야 하고,
//   그러면 «옛 앱은 안 보낸다» 는 갈림이 생긴다. 서버가 하나의 답을 갖게 한다.
//
// ■ ⚠️`speechLevel.ts` 와 **나누어 둔 이유**
//   그 파일은 `check:banmal` 이 **직접 import** 해서 진짜 함수를 돌린다 — 의존성이 0이어야 한다.
//   여기에 `supabase` 를 들이면 하네스가 그 파일을 못 부르고 «사본» 을 검사하게 된다.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../supabase';

/** 마지막으로 읽은 값 — 화면이 서버 왕복을 기다리지 않게. */
let cached: boolean | null = null;

/**
 * 지금 설정을 읽는다.
 * @returns 반말이면 true · 로그인 전이거나 못 읽으면 false(안전한 기본값)
 */
export async function getSpeechCasual(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from('profiles')
      .select('speech_casual').eq('id', user.id).maybeSingle();
    cached = (data as any)?.speech_casual === true;
    return cached;
  } catch {
    return cached ?? false;   // 못 읽었다고 말투를 바꾸지 않는다 — 마지막으로 안 값을 쓴다
  }
}

/** 마지막으로 읽은 값(왕복 없이). 아직 안 읽었으면 존댓말로 본다. */
export function speechCasualSnapshot(): boolean { return cached === true; }

/**
 * 설정을 바꾼다.
 * @param casual 반말이면 true
 * @returns 저장 성공 여부.
 *   ⚠️★실패를 **삼키지 않는다** — 화면이 스위치를 되돌릴 수 있어야 한다.
 *     `profiles` 는 쓰기 정책·컬럼 GRANT 가 없으면 **조용히 실패**한다([[rls-write-policy-missing]]).
 */
export async function setSpeechCasual(casual: boolean): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from('profiles')
      .update({ speech_casual: casual }).eq('id', user.id);
    if (!error) cached = casual;
    return !error;
  } catch {
    return false;
  }
}
