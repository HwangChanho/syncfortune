// app/src/lib/talk/talkNotes.ts — 대화 정리 읽기·지우기·고정·직접 담기
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-23 *"대화가 쌓이면 사람들이 보기 불편하니깐 중요내용은 따로 정리해주는 기능"*.
//
// ■ 이 파일이 하는 일
//   `talk_notes` 를 읽고 쓴다. **문장을 만들지 않는다** — 정리 문장은 Edge 가 답할 때 함께 뽑는다.
//   여기는 화면이 쓰는 창구일 뿐이다.
//
// ■ ★실패해도 화면을 막지 않는다
//   정리는 곁다리다. 조회가 실패하면 **빈 배열**로 돌려 정리 줄이 안 뜰 뿐, 대화는 그대로 열린다.
//   (부가 기능이 본류를 막으면 안 된다 — 이 프로젝트에서 여러 번 확인한 원칙.)
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';

/** 정리 갈래 — DB `talk_notes.kind` 와 같은 넷. 늘리지 않는다(늘면 정리가 아니라 목록이 된다). */
export type NoteKind = 'me' | 'when' | 'todo' | 'said';

/** 정리 한 줄. */
export type TalkNote = {
  id: number;
  kind: NoteKind;
  body: string;
  /** 출처 말풍선 id — 누르면 그리로 데려간다. 없을 수도 있다(옛 데이터·직접 담기 실패) */
  fromMessage: number | null;
  /** llm = 답할 때 뽑힌 것 · user = 길게 눌러 담은 것 */
  author: 'llm' | 'user';
  pinned: boolean;
};

/** 갈래 → 화면 라벨. ★한 곳에서만 정한다(화면마다 다르게 적으면 같은 것이 달라 보인다). */
export const NOTE_LABEL: Record<NoteKind, string> = {
  me: '나에 대해',
  when: '시기',
  todo: '해볼 것',
  said: '내가 말한 것',
};

/** 화면에 놓는 순서 — 시기가 위다. **나중에 다시 찾는 건 대개 시기**이기 때문이다. */
const ORDER: NoteKind[] = ['when', 'todo', 'me', 'said'];

/**
 * 이 대화의 정리를 읽는다.
 *
 * @param sessionId 대화 세션 id
 * @returns 고정된 것 먼저, 그다음 갈래 순(시기→해볼 것→나에 대해→내가 말한 것). 실패하면 빈 배열
 */
export async function listNotes(sessionId: string): Promise<TalkNote[]> {
  try {
    const r = await withTimeout(
      supabase.from('talk_notes')
        .select('id, kind, body, from_message, author, pinned')
        .eq('session_id', sessionId).eq('hidden', false)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30),
      8000,
    );
    const res = r as any;
    if (!res || res.error || !Array.isArray(res.data)) return [];
    const rows: TalkNote[] = (res.data as any[]).map((x) => ({
      id: Number(x.id),
      kind: (['me', 'when', 'todo', 'said'].includes(x.kind) ? x.kind : 'me') as NoteKind,
      body: String(x.body ?? ''),
      fromMessage: x.from_message == null ? null : Number(x.from_message),
      author: x.author === 'user' ? 'user' : 'llm',
      pinned: !!x.pinned,
    }));
    // 고정은 위, 그 안에서는 갈래 순으로 묶는다(같은 갈래가 흩어져 있으면 훑기 어렵다)
    return rows.sort((a, b) =>
      (Number(b.pinned) - Number(a.pinned)) || (ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)));
  } catch {
    return [];   // ★조회 실패 = 정리 줄이 안 뜰 뿐, 대화는 열린다
  }
}

/**
 * 정리 한 줄을 지운다.
 *
 * ⚠️행을 **지우지 않고 숨긴다** — 무엇을 지웠는지가 자료다(어떤 정리가 빗나갔는지 보이면
 *   프롬프트를 고칠 수 있다). 사용자에게는 지운 것과 똑같이 보인다.
 * @returns 성공 여부. 실패하면 화면이 되돌린다
 */
export async function hideNote(id: number): Promise<boolean> {
  try {
    const r = await withTimeout(supabase.from('talk_notes').update({ hidden: true }).eq('id', id), 8000) as any;
    return !!r && !r.error;
  } catch { return false; }
}

/**
 * 고정 토글.
 * @param id 정리 id / @param next 다음 상태
 * @returns 성공 여부
 */
export async function pinNote(id: number, next: boolean): Promise<boolean> {
  try {
    const r = await withTimeout(supabase.from('talk_notes').update({ pinned: next }).eq('id', id), 8000) as any;
    return !!r && !r.error;
  } catch { return false; }
}

/**
 * 사람이 직접 담는다(말풍선을 길게 눌러서).
 *
 * ★모델이 놓친 걸 사람이 줍는 길이다. 어떤 말을 줍는지가 다음 프롬프트의 재료가 된다.
 * @param sessionId 대화 / @param kind 갈래 / @param body 한 줄(길면 잘라 넣는다) / @param fromMessage 출처 말풍선
 * @returns 성공 여부. 이미 같은 것이 있으면 **성공으로 친다**(사용자에겐 담긴 것이 맞다)
 */
export async function addNote(
  sessionId: string, kind: NoteKind, body: string, fromMessage: number | null,
): Promise<boolean> {
  const text = body.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (text.length < 2) return false;
  try {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return false;
    const r = await withTimeout(
      supabase.from('talk_notes').upsert(
        { session_id: sessionId, owner_id: uid, kind, body: text, from_message: fromMessage, author: 'user' },
        { onConflict: 'session_id,kind,body', ignoreDuplicates: true },
      ),
      8000,
    ) as any;
    return !!r && !r.error;
  } catch { return false; }
}
