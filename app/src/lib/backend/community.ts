// app/src/lib/backend/community.ts — 커뮤니티(UGC) 클라이언트 API + 비속어 필터 (Apple 1.2 준수)
// ─────────────────────────────────────────────────────────────────────────
// 백엔드: community_posts/comments/likes/reports/blocks + RPC(toggle_like·report·block·admin_hide).
//   Apple 1.2 준수 UI 축(화면에서 사용): ①신고 ②차단 ③비속어 필터(제출 차단) ④본인 삭제 ⑤이용약관 동의.
//   작성자 uid = 익명세션 포함 authenticated. author_name = 서버 트리거가 profiles.display_name 스냅샷.
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase';

export type CommunityPost = {
  id: string; author_id: string; author_name: string; category: string;
  title: string; body: string; like_count: number; comment_count: number; created_at: string;
};
export type CommunityComment = { id: string; post_id: string; author_id: string; author_name: string; body: string; created_at: string };

// 카테고리(고정) — key 저장, 라벨은 i18n(community.cat.*).
export const COMMUNITY_CATEGORIES = ['free', 'love', 'saju', 'review', 'question'] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

// ── 비속어 필터(★daniel 검수 슬롯 — 최소 시드. 서버 자동숨김[신고 5]과 이중 방어) ──
//   완벽한 필터는 불가 — 명백한 욕설/혐오만 1차 차단하고, 나머지는 신고·차단·모더레이션으로.
const PROFANITY: string[] = [
  '씨발', '시발', '병신', '지랄', '개새끼', '좆', '보지', '자지', '꺼져', '섹스',
  'fuck', 'shit', 'bitch', 'asshole', 'cunt',
];
/** 명백한 비속어 포함 여부(제출 차단용). 공백·특수문자 제거 후 부분일치. */
export function containsProfanity(text: string): boolean {
  const norm = (text || '').toLowerCase().replace(/[\s\W_]+/g, '');
  return PROFANITY.some((w) => norm.includes(w.replace(/[\s\W_]+/g, '')));
}

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/** 게시글 목록(카테고리 필터·최신순·페이지). 숨김·차단 유저 글은 RLS가 제외. */
export async function listPosts(category?: CommunityCategory, limit = 30, beforeIso?: string): Promise<CommunityPost[]> {
  let q = supabase.from('community_posts').select('*').order('created_at', { ascending: false }).limit(limit);
  if (category) q = q.eq('category', category);
  if (beforeIso) q = q.lt('created_at', beforeIso);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CommunityPost[];
}

/** 게시글 1개. */
export async function getPost(id: string): Promise<CommunityPost | null> {
  const { data } = await supabase.from('community_posts').select('*').eq('id', id).maybeSingle();
  return (data as CommunityPost) ?? null;
}

/** 글 작성(비속어 1차 차단). author_id/name 은 서버 트리거가 설정. */
export async function createPost(category: CommunityCategory, title: string, body: string): Promise<string> {
  if (containsProfanity(title) || containsProfanity(body)) throw new Error('PROFANITY');
  const me = await uid();
  if (!me) throw new Error('세션이 필요해요.');
  const { data, error } = await supabase.from('community_posts')
    .insert({ author_id: me, category, title: title.trim(), body: body.trim() }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from('community_posts').delete().eq('id', id);
  if (error) throw error;
}

/** 댓글 목록(오래된 순). */
export async function listComments(postId: string): Promise<CommunityComment[]> {
  const { data, error } = await supabase.from('community_comments').select('*')
    .eq('post_id', postId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CommunityComment[];
}

export async function addComment(postId: string, body: string): Promise<void> {
  if (containsProfanity(body)) throw new Error('PROFANITY');
  const me = await uid();
  if (!me) throw new Error('세션이 필요해요.');
  const { error } = await supabase.from('community_comments').insert({ post_id: postId, author_id: me, body: body.trim() });
  if (error) throw error;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('community_comments').delete().eq('id', id);
  if (error) throw error;
}

/** 좋아요 토글 → 새 좋아요 수. */
export async function toggleLike(postId: string): Promise<number> {
  const { data, error } = await supabase.rpc('community_toggle_like', { p_post: postId });
  if (error) throw error;
  return (data as number) ?? 0;
}

/** 내가 좋아요한 글 id 집합(보이는 글들의 하트 상태 표시용). */
export async function likedPostIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const me = await uid();
  if (!me) return new Set();
  const { data } = await supabase.from('community_likes').select('post_id').eq('user_id', me).in('post_id', ids);
  return new Set((data ?? []).map((r: any) => r.post_id));
}

/** 신고(post|comment) — 서버가 report_count 증가 + 임계 5 자동 숨김. */
export async function reportContent(type: 'post' | 'comment', id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('community_report', { p_type: type, p_id: id, p_reason: reason });
  if (error) throw error;
}

/** 유저 차단 — 이후 그 유저 글/댓글이 RLS로 안 보임. */
export async function blockUser(blockedId: string): Promise<void> {
  const { error } = await supabase.rpc('community_block', { p_blocked: blockedId });
  if (error) throw error;
}

/** 관리자 숨김/복원(모더레이션). */
export async function adminHide(type: 'post' | 'comment', id: string, hidden: boolean): Promise<void> {
  const { error } = await supabase.rpc('community_admin_hide', { p_type: type, p_id: id, p_hidden: hidden });
  if (error) throw error;
}

// ── 관리자 모더레이션 대시보드 ──
export type ModItem = { kind: 'post' | 'comment'; id: string; author_id: string; author_name: string; content: string; report_count: number; hidden: boolean; created_at: string };
/** 신고된 콘텐츠 큐(report_count>0·숨김 포함). is_admin 만 통과(서버 게이트). */
export async function moderationQueue(): Promise<ModItem[]> {
  const { data, error } = await supabase.rpc('community_moderation_queue');
  if (error) throw error;
  return (data ?? []) as ModItem[];
}
