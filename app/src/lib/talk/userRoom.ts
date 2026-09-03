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
  /**
   * ★`assistant` = **@ 로 부른 AI 선생님**의 답 (Boss 2026-08-27).
   *   유저끼리 방이라도 `@노쌤` 이라고 쓰면 그 사람이 들어와 한 마디 한다.
   */
  role: 'user' | 'system' | 'assistant';
  /** ★사진 한 장(storage 경로). 없으면 null (Boss 2026-08-27 *"사진공유"*). */
  imagePath?: string | null;
  /** ★AI 가 말했으면 그 상담가 id(`consultants.id`). 사람이면 null. */
  speakerId?: string | null;
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

/**
 * `talk_messages` 한 행 → 화면이 쓰는 `UserMsg`.
 * ★★**한 곳에서만** 만든다 — 종전엔 «불러오기» 와 «realtime» 이 각자 변환했고,
 *   그래서 `assistant`(@ 로 부른 AI)를 한쪽만 고치면 **새로고침 전후가 달라 보인다**
 *   ([[duplicate-ui-single-source]] — 사본은 반드시 갈린다).
 */
function toMsg(m: any): UserMsg {
  return {
    id: Number(m.id),
    // ★세 갈래를 **그대로** 옮긴다 — `system` 이 아니면 전부 `user` 로 뭉개면
    //   @ 로 부른 AI 의 답이 **내 말처럼** 보인다.
    role: m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user',
    body: String(m.body ?? ''),
    senderId: String(m.owner_id ?? ''),
    sentAt: String(m.sent_at ?? ''),
    imagePath: m.image_path ? String(m.image_path) : null,
    speakerId: m.speaker_id ? String(m.speaker_id) : null,
  };
}

/** 이 방의 지난 말들(오래된 것부터). */
export async function loadUserMessages(sessionId: string, limit = 120): Promise<UserMsg[]> {
  const r = await withTimeout(
    supabase.from('talk_messages')
      .select('id, role, body, owner_id, sent_at, image_path, speaker_id').eq('session_id', sessionId)
      // ★최근 것부터 받아 뒤집는다 — 오래된 쪽부터 자르면 **최근 대화가 사라진다**
      //   (2026-08-26 에 실제로 그랬다: `ascending:true` + limit 이라 최근이 잘렸다).
      .order('sent_at', { ascending: false }).limit(limit),
    8000,
  );
  if (!r || r.error || !Array.isArray(r.data)) return [];
  return (r.data as any[]).slice().reverse().map(toMsg);
}

/**
 * 대화에 올릴 **사진 한 장**을 저장소에 넣는다 (Boss 2026-08-27 *"실제 사람이랑 대화할때는 사진공유"*).
 *
 * ■ ⚠️왜 `avatars` 버킷인가
 *   새 버킷을 만들면 정책(RLS)·CORS·수명을 **또 한 벌** 관리해야 한다. 이미 있는 공개 버킷에
 *   **경로로 갈라** 둔다(`rooms/<방>/<난수>.<확장자>`).
 * ■ ⚠️★주소를 아는 사람은 볼 수 있다(공개 버킷)
 *   그래서 파일 이름을 **난수**로 둔다 — 추측으로는 못 찾는다.
 *   ⚠️«비밀 사진» 을 위한 자리가 아니다. 정말 가려야 하는 것은 서명 URL 이 필요하다(아직 없음).
 * ■ 2MB 상한 — 프로필 사진과 같은 규칙. 대화에 큰 파일이 오가면 데이터·저장소가 같이 샌다.
 *
 * @param sessionId 방
 * @param file      브라우저 File(웹). ⚠️모바일은 `expo-image-picker` 가 붙은 뒤에 지원한다
 * @returns storage 경로. 실패하면 null
 */
export async function uploadRoomPhoto(sessionId: string, file: Blob & { type?: string }): Promise<string | null> {
  if (file.size > 2 * 1024 * 1024) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;                       // 로그인 없이는 올릴 자리가 없다(경로가 uid 로 시작한다)
  const type = file.type ?? 'image/jpeg';
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  // ★난수 이름 — 순번이면 남의 사진을 세어 볼 수 있다
  const name = (globalThis.crypto?.randomUUID?.() ?? String(Math.random()).slice(2)).replace(/-/g, '');
  // ⚠️★2026-08-28 — **첫 폴더가 uid 가 아니면 정책에 막힌다**(`foldername(name)[1] = auth.uid()`).
  //   `rooms/<방>/…` 은 그 조건을 못 넘어 **업로드가 조용히 실패**하고 있었다
  //   (커뮤니티 사진을 붙이다 같은 벽에 부딪혀 발견했다 — 형제였다).
  //   ★방 id 는 파일 이름에 남긴다: 어느 방 사진인지 여전히 알 수 있다.
  const path = `${user.id}/rooms/${sessionId}-${name}.${ext}`;
  const up = await withTimeout(
    supabase.storage.from('avatars').upload(path, file, { upsert: false, contentType: type }),
    15000,
  );
  if (!up || up.error) { console.warn('[userRoom] 사진 올리기 실패', up?.error?.message); return null; }
  return path;
}

/**
 * 한 마디 보낸다. ⚠️**운을 안 쓴다**(Edge 를 안 탄다 — 위 머리말).
 * @returns 성공 여부
 */
export async function sendUserMessage(sessionId: string, body: string, myId: string, imagePath?: string | null): Promise<boolean> {
  const text = body.trim();
  // ★사진만 보내는 것도 허용한다 — 카톡에서 사진 한 장만 보내는 일은 흔하다.
  if (!text && !imagePath) return false;
  const r = await withTimeout(
    supabase.from('talk_messages').insert({
      session_id: sessionId, owner_id: myId, role: 'user', body: text, source: 'script',
      image_path: imagePath ?? null,
    }),
    8000,
  );
  if (!r || r.error) { console.warn('[userRoom] 보내기 실패', r?.error?.message); return false; }
  /**
   * ★★«마지막 대화 시각» 은 **서버(트리거)가 올린다** — 여기서 안 올린다(2026-09-03).
   * ■ 왜 뺐나 — 앱이 올리면 **내가 보낼 때만** 올라간다. 상대가 보낸 말·AI 답은 아무도 안 올려
   *   실측 79 세션 중 **32개**가 최신 메시지보다 뒤처졌다(최대 43시간).
   *   그 값으로 목록이 «날짜를 적고 정렬까지» 하니 두 가지가 같이 틀렸다.
   * ■ ⇒ `trg_touch_last_at` 이 메시지가 들어오는 **모든 길**에서 올린다.
   *   ⚠️여기서 또 올리면 두 곳이 같은 일을 한다 — 갈릴 자리를 남기지 않는다.
   */
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
        onMsg(toMsg(p.new));
      })
    .subscribe();
  return () => { void supabase.removeChannel(ch); };
}

/**
 * ★★**상대가 입력 중임을 알린다** (Boss 2026-09-02
 *   *"상대가 채팅을 입력중이면 입력중인 말풍선 안에 점새개가 찍히는 애니메이션 있어야해"*).
 *
 * ■ DB 를 안 쓴다 — realtime **broadcast** 로 그 순간에만 흘려보낸다.
 *   «입력 중» 은 **남길 이유가 없는 사실**이다. 표에 쓰면 지우는 일이 생기고, 지우다 남으면
 *   «영영 입력 중인 사람» 이 된다.
 * ■ ⚠️채널 이름에 **`sessionId` 를 넣는다** — 이름을 고정하면 방을 옮겨도 같은 채널을 붙들어
 *   엉뚱한 방의 신호를 받는다(2026-08-27 대화창 크래시의 근본 원인이 그것이었다).
 * ■ ⚠️메시지 채널(`room:*`)과 **다른 이름**을 쓴다 — 한 채널에 섞으면 구독 해제가 서로를 끊는다.
 *
 * @param sessionId 방
 * @param myId      나(내 신호는 내가 무시해야 한다 — 아래 구독에서 거른다)
 */
export function sendTyping(sessionId: string, myId: string): void {
  try {
    const ch = supabase.channel(`typing:${sessionId}`);
    void ch.subscribe((st) => {
      if (st !== 'SUBSCRIBED') return;
      void ch.send({ type: 'broadcast', event: 'typing', payload: { from: myId } })
        .finally(() => { void supabase.removeChannel(ch); });
    });
  } catch { /* 알림용이라 실패해도 대화는 그대로 간다 */ }
}

/**
 * 남이 입력 중이라는 신호를 받는다.
 * @returns 해지 함수
 * ⚠️★내 신호는 **걸러 낸다** — 안 그러면 내가 칠 때마다 내 화면에 점 세 개가 뜬다.
 */
export function subscribeTyping(sessionId: string, myId: string, onTyping: () => void): () => void {
  const ch = supabase
    .channel(`typing:${sessionId}`)
    .on('broadcast', { event: 'typing' }, (p: any) => {
      if (p?.payload?.from && p.payload.from !== myId) onTyping();
    })
    .subscribe();
  return () => { void supabase.removeChannel(ch); };
}

/** 이 방의 사람들(나 포함). 이름·사진은 `profiles` 에서 온다. */
export type RoomPerson = {
  id: string; name: string; avatarPath: string | null;
  /** ★이 사람이 **어디까지 읽었나**. 내 말의 「1」을 세는 유일한 근거 */
  lastReadAt: string;
};

/**
 * 내 읽음 시각을 지금으로 올린다.
 * ★서버가 `now()` 로 찍는다 — 앱이 값을 보내면 **미래 시각**으로 남의 「1」을 지울 수 있다.
 *   (같은 이유로 상담가 방의 `markRead` 도 서버 시각을 쓴다.)
 */
export async function markRoomRead(sessionId: string): Promise<void> {
  const r = await withTimeout(supabase.rpc('mark_room_read', { p_session: sessionId }), 8000);
  if (r?.error) console.warn('[userRoom] 읽음 표시 실패', r.error.message);
}

/**
 * 내가 보낸 말의 **안 읽은 사람 수**.
 *
 * Boss 2026-08-27: *"1 로 하고 1이 사라지면 읽은거야 · 여러명 방에선 인원수에 맞는 숫자(본인 제외)"*
 * @param people  방 사람들(나 포함 — 안에서 뺀다)
 * @param myId    나
 * @param sentAt  그 말의 시각
 * @returns 아직 안 읽은 사람 수. 0 이면 표시하지 않는다
 */
export function unreadBy(people: RoomPerson[], myId: string, sentAt: string): number {
  const t = Date.parse(sentAt);
  if (!Number.isFinite(t)) return 0;
  return people.filter((p) => p.id !== myId && Date.parse(p.lastReadAt) < t).length;
}

/**
 * 방 사람들의 **읽음 시각이 바뀌면** 알려 준다.
 * ⚠️이게 없으면 상대가 읽어도 내 화면의 「1」이 **안 사라진다** — 다시 열어야 바뀐다.
 */
export function subscribeRoomRead(sessionId: string, onChange: () => void): () => void {
  const ch = supabase
    .channel(`roomread:${sessionId}`)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'talk_members', filter: `session_id=eq.${sessionId}` },
      () => onChange())
    .subscribe();
  return () => { void supabase.removeChannel(ch); };
}

/**
 * 방에 누가 있는지.
 * ⚠️`profiles` 를 **한 번에** 읽는다(사람마다 물으면 인원수만큼 왕복이 생긴다).
 */
export async function roomPeople(sessionId: string): Promise<RoomPerson[]> {
  const m = await withTimeout(supabase.from('talk_members').select('user_id, last_read_at').eq('session_id', sessionId), 8000);
  if (!m || m.error || !Array.isArray(m.data) || !m.data.length) return [];
  const ids = (m.data as any[]).map((x) => String(x.user_id));
  /**
   * ★★이름·사진을 **두 곳에서** 가져와 합친다 (2026-09-02).
   * ■ 왜 나뉘었나 — 친구가 `is_premium`·`is_admin` 까지 보던 것을 막으려고
   *   `profiles` 의 친구 정책을 떼고, 공개 6칸만 담은 뷰 `friend_profiles` 로 갈랐다.
   *   ⇒ `profiles` 는 이제 **내 행만** 나오고, 친구는 **뷰에서만** 나온다.
   * ■ ⚠️★`ids` 에는 **나도 들어 있다.** 뷰만 쓰면 뷰는 친구만 주므로
   *   «방 목록에서 내 이름과 사진만 사라지는» 상태가 된다 — 그래서 둘 다 읽어 합친다.
   * ■ 보이는 범위는 종전과 같다(뷰 안에 같은 `is_friend_of` 가 박혀 있다).
   */
  const [pFriends, pMe] = await Promise.all([
    withTimeout(supabase.from('friend_profiles').select('id, nickname, display_name, avatar_path').in('id', ids), 8000),
    withTimeout(supabase.from('profiles').select('id, nickname, display_name, avatar_path').in('id', ids), 8000),
  ]);
  const rows = [
    ...(pFriends && !pFriends.error && Array.isArray(pFriends.data) ? pFriends.data : []),
    ...(pMe && !pMe.error && Array.isArray(pMe.data) ? pMe.data : []),
  ] as any[];
  return ids.map((id) => {
    const r = rows.find((x) => String(x.id) === id);
    const mem = (m.data as any[]).find((x) => String(x.user_id) === id);
    return {
      id,
      name: String(r?.nickname || r?.display_name || '이름 없음'),
      avatarPath: r?.avatar_path ?? null,
      lastReadAt: String(mem?.last_read_at ?? '1970-01-01T00:00:00Z'),
    };
  });
}
