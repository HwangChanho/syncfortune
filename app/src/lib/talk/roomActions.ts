// app/src/lib/talk/roomActions.ts — 대화방 **나가기 · 상단고정** (단일 원본)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27:
//   *"채팅 목록에서 방을 나갈수있고 그러면 대화내용이랑 다 삭제 돼야하고"*
//   *"상단고정은 가장 최신 등록한 순으로 위에 고정 되고 다시 스와이프해서 해제 하면
//     지금 즐겨찾기 처럼 해제가 돼야하고 원래 있어야할 위치로 가면 돼"*
//
// ■ ★왜 여기 모으나
//   같은 두 동작이 **세 자리**에서 불린다(웹 우클릭 · 앱 스와이프 · 대화방 머리의 지우기).
//   각자 구현하면 «웹에서 나간 방이 앱에선 남아 있는» 류가 생긴다([[duplicate-ui-single-source]]).
//
// ■ ★고정은 «시각» 이다 — 불리언이 아니라
//   Boss 가 「가장 **최신** 등록한 순」 이라고 못 박았다. 불리언으로는 그 순서를 못 낸다.
//   `pinned_at desc nulls last, last_at desc` 한 줄로 두 요구가 같이 풀리고,
//   **해제 = null** 이면 자동으로 원래 자리(`last_at`)로 돌아간다 — 원래 자리를 기억할 필요가 없다.
//
// ■ ⚠️나가기는 **되돌릴 수 없다**
//   세션을 지우면 메시지는 FK CASCADE 로 함께 사라진다. 확인 없이 부르지 말 것.
//   (`talk.tsx` 는 이미 `Alert` 대신 자체 확인창을 쓴다 — 웹에서 `Alert` 가 안 뜨거나 두 번 뜬 이력.)
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';

/**
 * 이 방을 나간다 — **대화 내용까지 함께 사라진다**(FK CASCADE).
 *
 * @param sessionId 나갈 방
 * @returns 성공 여부. 실패하면 화면을 **비우지 말 것**(지운 것처럼 보이는데 남아 있게 된다)
 */
export async function leaveRoom(sessionId: string): Promise<{ ok: boolean; error?: string }> {
  const r = await withTimeout(
    supabase.from('talk_sessions').delete().eq('id', sessionId),
    8000,
  );
  if (!r) return { ok: false, error: 'timeout' };
  if (r.error) { console.warn('[room] 나가기 실패', r.error.message); return { ok: false, error: r.error.message }; }
  return { ok: true };
}

/**
 * 상단고정 켜기/끄기.
 *
 * @param sessionId 대상 방
 * @param on true = 지금 시각으로 고정 · false = 해제(원래 자리로 돌아간다)
 * @returns 성공 여부
 */
export async function pinRoom(sessionId: string, on: boolean): Promise<boolean> {
  // ★시각은 **서버가 아니라 여기서** 찍어도 된다 — 순서만 맞으면 되고, 정렬은 상대값이다.
  //   (읽음 처리와 다르다. 그건 `now()` 여야 미래 시각으로 배지를 지우는 일이 없다.)
  const r = await withTimeout(
    supabase.from('talk_sessions')
      .update({ pinned_at: on ? new Date().toISOString() : null })
      .eq('id', sessionId),
    8000,
  );
  if (!r || r.error) { console.warn('[room] 고정 변경 실패', r?.error?.message); return false; }
  return true;
}
