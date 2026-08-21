// app/src/lib/talk/rooms.ts — 오픈채팅방 (목록·만들기·대화)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-21: AI 선생들끼리 / 유저 여러 명 + AI.
//
// ■ ★AI 답은 **Edge 만** 만든다
//   `room_messages` 에 `ai_id` 로 쓰는 건 RLS 가 막는다(앱은 `user_id` 로만 쓸 수 있다).
//   ⇒ 사람이 한마디 하면 앱은 **Edge 를 깨우기만** 하고, 답은 서버가 넣는다.
//     앱이 AI 이름으로 쓸 수 있으면 상담가가 하지 않은 말을 지어낼 수 있다.
//
// ■ ⚠️원가는 **응답 AI 수 × 턴수**다
//   방 30턴에 AI 3명이면 ₩399(1:1 10턴 ₩43 의 9배).
//   상한은 서버 값(`ai_per_turn`·`daily_turn_cap`)이라 앱이 정하지 않는다 —
//   여기서 보내는 값은 **만들 때의 초기값**일 뿐이고, 서버가 다시 상한을 건다.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';

export type Room = {
  id: string;
  kind: 'solo' | 'open';
  title: string;
  topic: string | null;
  ownerId: string;
  aiIds: string[];
  isPublic: boolean;
  lastAt: string;
  /** 이 방의 사람 수(공개 방 목록에서 "몇 명이 있나"를 보여 준다) */
  members?: number;
};

export type RoomMessage = {
  id: number;
  /** 사람이면 userId, AI 면 aiId — ★둘 중 하나만 있다(DB 제약이 지킨다) */
  userId: string | null;
  aiId: string | null;
  body: string;
  sentAt: string;
};

/** 서버 행 → 앱 타입. 컬럼 이름이 바뀌면 여기만 고친다. */
function toRoom(r: any): Room {
  return {
    id: String(r.id), kind: r.kind === 'solo' ? 'solo' : 'open',
    title: String(r.title ?? ''), topic: r.topic ?? null,
    ownerId: String(r.owner_id), aiIds: Array.isArray(r.ai_ids) ? r.ai_ids : [],
    isPublic: !!r.is_public, lastAt: String(r.last_at),
  };
}

/** 내가 만들었거나 들어가 있는 방. */
export async function myRooms(): Promise<Room[]> {
  const r = await withTimeout(
    supabase.from('rooms').select('id, kind, title, topic, owner_id, ai_ids, is_public, last_at')
      .eq('closed', false).order('last_at', { ascending: false }).limit(50),
    8000,
  );
  if (!r || r.error || !Array.isArray(r.data)) {
    if (r?.error) console.warn('[rooms] 목록 실패', r.error.message);
    return [];
  }
  return (r.data as any[]).map(toRoom);
}

/**
 * 공개 방 목록.
 * ★내가 안 들어간 방도 보인다 — RLS 가 `is_public` 을 허용하기 때문이다.
 *   들어가야 말할 수 있다(쓰기 정책이 `room_members` 를 요구한다).
 */
export async function publicRooms(): Promise<Room[]> {
  const r = await withTimeout(
    supabase.from('rooms').select('id, kind, title, topic, owner_id, ai_ids, is_public, last_at')
      .eq('kind', 'open').eq('is_public', true).eq('closed', false)
      .order('last_at', { ascending: false }).limit(30),
    8000,
  );
  if (!r || r.error || !Array.isArray(r.data)) return [];
  return (r.data as any[]).map(toRoom);
}

/**
 * 방을 만든다.
 * @param kind    solo = 나 + AI / open = 여러 사람 + AI
 * @param aiIds   참여 AI — ★방마다 다르다(연애 상담방에 차 언니가 있을 이유가 없다)
 * @param isPublic 공개 목록에 띄울지(open 만 의미 있다)
 */
export async function createRoom(
  kind: 'solo' | 'open', title: string, topic: string, aiIds: string[], isPublic: boolean,
): Promise<Room | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('rooms')
    .insert({
      kind, title: title.trim().slice(0, 40) || '이름 없는 방',
      topic: topic.trim().slice(0, 120) || null,
      owner_id: user.id, ai_ids: aiIds,
      is_public: kind === 'open' ? isPublic : false,   // ★solo 는 공개될 수 없다(나 혼자 쓰는 방)
    })
    .select('id, kind, title, topic, owner_id, ai_ids, is_public, last_at').single();
  if (error || !data) { console.warn('[rooms] 생성 실패', error?.message); return null; }
  // ★만든 사람도 **참여자로 넣는다** — 안 넣으면 쓰기 정책(`room_members` 요구)에 자기 방인데 못 쓴다
  await supabase.from('room_members').insert({ room_id: data.id, user_id: user.id, role: 'owner' });
  return toRoom(data);
}

/** 공개 방에 들어간다. ★본인만 넣을 수 있다(RLS). 이미 있으면 조용히 통과. */
export async function joinRoom(roomId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from('room_members')
    .upsert({ room_id: roomId, user_id: user.id }, { onConflict: 'room_id,user_id' });
  if (error) { console.warn('[rooms] 참여 실패', error.message); return false; }
  return true;
}

/** 방 하나 + 지난 메시지. */
export async function loadRoom(roomId: string): Promise<{ room: Room; messages: RoomMessage[] } | null> {
  const r = await withTimeout(
    supabase.from('rooms').select('id, kind, title, topic, owner_id, ai_ids, is_public, last_at')
      .eq('id', roomId).maybeSingle(),
    8000,
  );
  if (!r || r.error || !r.data) return null;
  const m = await withTimeout(
    supabase.from('room_messages').select('id, user_id, ai_id, body, sent_at')
      .eq('room_id', roomId).order('sent_at', { ascending: true }).limit(80),
    8000,
  );
  const messages = m && !m.error && Array.isArray(m.data)
    ? (m.data as any[]).map((x) => ({
        id: Number(x.id), userId: x.user_id ?? null, aiId: x.ai_id ?? null,
        body: String(x.body ?? ''), sentAt: String(x.sent_at),
      }))
    : [];
  return { room: toRoom(r.data), messages };
}

/**
 * 한마디 하고 **AI 를 깨운다**.
 *
 * ★두 단계다: ①사람 메시지를 앱이 넣고 ②Edge 가 AI 답을 넣는다.
 *   ⚠️①이 실패하면 ②를 부르지 않는다 — 없는 말에 답이 달리면 방이 이상해진다.
 *
 * @returns AI 들이 한 말(없으면 빈 배열 — 끼어들지 않기로 한 것이다)
 */
export async function sayInRoom(roomId: string, body: string): Promise<{
  ok: boolean; replies: { aiId: string; name: string; body: string }[]; error?: string;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, replies: [], error: 'unauthorized' };
  const ins = await supabase.from('room_messages')
    .insert({ room_id: roomId, user_id: user.id, body: body.trim().slice(0, 300) });
  if (ins.error) return { ok: false, replies: [], error: ins.error.message };

  // ⚠️타임아웃을 건다 — AI 여럿이 차례로 답하므로 1:1 보다 오래 걸린다(45 → 90초)
  const r = await withTimeout(supabase.functions.invoke('room', { body: { roomId } }), 90_000);
  if (!r) return { ok: true, replies: [], error: 'timeout' };      // 내 말은 들어갔다
  if (r.error) { console.warn('[rooms] AI 응답 실패', r.error); return { ok: true, replies: [] }; }
  const d = r.data as any;
  if (d?.paused || d?.capped) return { ok: true, replies: [], error: d.message };
  return { ok: true, replies: Array.isArray(d?.replies) ? d.replies : [] };
}
