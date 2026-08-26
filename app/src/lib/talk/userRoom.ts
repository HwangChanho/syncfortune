// app/src/lib/talk/userRoom.ts — **사람끼리의 대화방**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27:
//   *"기본적으로 친구추가하면 서로 채팅도 가능하게 하자"*
//   *"따로 거하게 만들필요없이 그냥 일반 채팅방에 여러사람이 들어와있을수 있게 초대하면"*
//   *"유저끼리 단순 대화는 운 소모가 필요없어"*
//
// ■ ★운이 0인 이유는 «면제» 가 아니라 **안 지나가기 때문**이다
//   사람끼리의 말은 Edge 함수(`talk`)를 **안 탄다.** 앱이 `talk_messages` 에 바로 넣는다.
//   LLM 을 안 부르니 원가가 0이고, 그래서 차감 코드에 예외를 넣을 필요조차 없다.
//   ⇒ «안 지나가는 길은 안 막아도 된다.» 예외 분기가 없다는 것이 이 설계의 안전장치다.
//
// ■ ⚠️쓰기는 **RPC 로만** 방을 만든다
//   `open_user_room` 안에 «친구인가» 확인이 있다. 앱이 직접 `talk_members` 에 넣을 수 있으면
//   **남의 방에 스스로를 넣을 수 있다** — 그래서 insert 정책을 아예 안 만들었다(0050).
//
// ■ ★실시간이 없으면 그건 대화가 아니다
//   `talk_messages` 를 realtime publication 에 넣었다(0050). 상대가 말하면 **바로** 뜬다.
//   ⚠️구독은 **방마다** 건다 — 전부 받아서 거르면 남의 방 이벤트까지 흘러 온다.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';

/** 사람 방의 메시지 한 줄. `system` = 「누가 나갔습니다」 같은 안내. */
export type UserMsg = {
  id: number;
  role: 'user' | 'system';
  body: string;
  /** 보낸 사람(내 것인지 가르는 유일한 근거) */
  senderId: string;
  sentAt: string;
};

/**
 * 친구와의 1:1 방을 연다(없으면 만든다).
 *
 * ★같은 친구를 다시 열면 **같은 방**으로 돌아간다(카톡처럼) — 서버가 «둘만 있는 방» 을 찾아 준다.
 * @param otherId 상대 사용자 id
 * @returns 세션 id. 친구가 아니거나 실패하면 null
 */
export async function openUserRoom(otherId: string): Promise<string | null> {
  const r = await withTimeout(supabase.rpc('open_user_room', { p_other: otherId }), 8000);
  if (!r || r.error) { console.warn('[userRoom] 방 열기 실패', r?.error?.message); return null; }
  return (r.data as string) ?? null;
}

/**
 * 이 방에 친구를 부른다.
 * @returns 성공 여부. ⚠️**내 친구만** 부를 수 있다(서버가 확인한다)
 */
export async function inviteToRoom(sessionId: string, otherId: string): Promise<boolean> {
  const r = await withTimeout(supabase.rpc('invite_to_room', { p_session: sessionId, p_other: otherId }), 8000);
  if (!r || r.error) { console.warn('[userRoom] 초대 실패', r?.error?.message); return false; }
  return r.data === true;
}

/**
 * 방을 나간다.
 *
 * @returns `'left'` = 나만 빠졌다(남은 사람에게 안내가 남는다) ·
 *          `'deleted'` = 방이 사라졌다 · `null` = 실패
 * ★어느 쪽인지 **호출부가 알아야 한다** — 화면을 닫을지 목록만 고칠지가 갈린다.
 */
export async function leaveUserRoom(sessionId: string): Promise<'left' | 'deleted' | null> {
  const r = await withTimeout(supabase.rpc('leave_room', { p_session: sessionId }), 8000);
  if (!r || r.error) { console.warn('[userRoom] 나가기 실패', r?.error?.message); return null; }
  const v = r.data as string;
  return v === 'left' || v === 'deleted' ? v : null;
}

/** 이 방의 지난 말들(오래된 것부터). */
export async function loadUserMessages(sessionId: string, limit = 120): Promise<UserMsg[]> {
  const r = await withTimeout(
    supabase.from('talk_messages')
      .select('id, role, body, owner_id, sent_at').eq('session_id', sessionId)
      // ★최근 것부터 받아 뒤집는다 — 오래된 쪽부터 자르면 **최근 대화가 사라진다**
      //   (2026-08-26 에 실제로 그랬다: `ascending:true` + limit 이라 최근이 잘렸다).
      .order('sent_at', { ascending: false }).limit(limit),
    8000,
  );
  if (!r || r.error || !Array.isArray(r.data)) return [];
  return (r.data as any[]).slice().reverse().map((m) => ({
    id: Number(m.id),
    role: m.role === 'system' ? 'system' : 'user',
    body: String(m.body ?? ''),
    senderId: String(m.owner_id ?? ''),
    sentAt: String(m.sent_at ?? ''),
  }));
}

/**
 * 한 마디 보낸다. ⚠️**운을 안 쓴다**(Edge 를 안 탄다 — 위 머리말).
 * @returns 성공 여부
 */
export async function sendUserMessage(sessionId: string, body: string, myId: string): Promise<boolean> {
  const text = body.trim();
  if (!text) return false;
  const r = await withTimeout(
    supabase.from('talk_messages').insert({
      session_id: sessionId, owner_id: myId, role: 'user', body: text, source: 'script',
    }),
    8000,
  );
  if (!r || r.error) { console.warn('[userRoom] 보내기 실패', r?.error?.message); return false; }
  // 목록의 «마지막 대화 시각» 을 올린다 — 안 하면 새 말을 해도 방이 아래에 머문다
  void supabase.from('talk_sessions').update({ last_at: new Date().toISOString() }).eq('id', sessionId);
  return true;
}

/**
 * 이 방에 오는 말을 **실시간으로** 받는다.
 *
 * @param sessionId 구독할 방 — ⚠️**방마다** 건다(전부 받아 거르면 남의 방 이벤트가 흘러 온다)
 * @param onMsg     새 말이 왔을 때
 * @returns 해제 함수
 */
export function subscribeUserRoom(sessionId: string, onMsg: (m: UserMsg) => void): () => void {
  const ch = supabase
    .channel(`room:${sessionId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'talk_messages', filter: `session_id=eq.${sessionId}` },
      (p) => {
        const m = p.new as any;
        onMsg({
          id: Number(m.id),
          role: m.role === 'system' ? 'system' : 'user',
          body: String(m.body ?? ''),
          senderId: String(m.owner_id ?? ''),
          sentAt: String(m.sent_at ?? ''),
        });
      })
    .subscribe();
  return () => { void supabase.removeChannel(ch); };
}

/** 이 방의 사람들(나 포함). 이름·사진은 `profiles` 에서 온다. */
export type RoomPerson = { id: string; name: string; avatarPath: string | null };

/**
 * 방에 누가 있는지.
 * ⚠️`profiles` 를 **한 번에** 읽는다(사람마다 물으면 인원수만큼 왕복이 생긴다).
 */
export async function roomPeople(sessionId: string): Promise<RoomPerson[]> {
  const m = await withTimeout(supabase.from('talk_members').select('user_id').eq('session_id', sessionId), 8000);
  if (!m || m.error || !Array.isArray(m.data) || !m.data.length) return [];
  const ids = (m.data as any[]).map((x) => String(x.user_id));
  const p = await withTimeout(
    supabase.from('profiles').select('id, nickname, display_name, avatar_path').in('id', ids), 8000);
  const rows = (p && !p.error && Array.isArray(p.data) ? p.data : []) as any[];
  return ids.map((id) => {
    const r = rows.find((x) => String(x.id) === id);
    return {
      id,
      name: String(r?.nickname || r?.display_name || '이름 없음'),
      avatarPath: r?.avatar_path ?? null,
    };
  });
}
