// app/src/lib/backend/community.ts — 커뮤니티(UGC) 클라이언트 API + 비속어 필터 (Apple 1.2 준수)
// ─────────────────────────────────────────────────────────────────────────
// 백엔드: community_posts/comments/likes/reports/blocks + RPC(toggle_like·report·block·admin_hide).
//   Apple 1.2 준수 UI 축(화면에서 사용): ①신고 ②차단 ③비속어 필터(제출 차단) ④본인 삭제 ⑤이용약관 동의.
//   작성자 uid = 익명세션 포함 authenticated. author_name = 서버 트리거가 profiles.display_name 스냅샷.
// ─────────────────────────────────────────────────────────────────────────
import type { SharedSaju, SharedZiwei } from './communityChart';
import { supabase } from '../supabase';
import { loadRepChart } from '../engine/myChart';   // 일주 뱃지(opt-in) — 순수 TS·네이티브 의존 없음
import { computeChart } from '../engine/engine';

// 게시물 첨부 명식의 **계약·화이트리스트 변환은 communityChart.ts** 에 있다(의존 없는 순수 모듈 —
//   그래야 `npm run check:sharedchart` 가 supabase/react-native 없이 실제 함수를 호출해 유출을 잡는다).
//   호출부 편의를 위해 여기서 re-export 한다: 글쓰기 화면은 createPost 와 변환 함수를 같이 쓴다.
export type { SharedSaju, SharedZiwei } from './communityChart';
export { toSharedSaju, toSharedZiwei } from './communityChart';

export type CommunityPost = {
  id: string; author_id: string | null; author_name: string; category: string;
  title: string; body: string; like_count: number; comment_count: number; created_at: string;
  // P1(daniel 2026-08-05): kind='daily'=일진 스레드(cron 자동 개설·author_id null) / ilju=작성자 일주 뱃지(opt-in·2자)
  kind?: 'normal' | 'daily'; daily_date?: string | null; ilju?: string | null;
  topic?: string | null;   // P2 후기 태그 — contentSections item key(라벨·라우트는 클라 단일 출처)
  // 첨부 명식(선택) — 목록 조회(listPosts)에는 실리지 않는다(아래 LIST_COLS). 상세(getPost)에서만 채워진다.
  chart_saju?: SharedSaju | null;
  chart_ziwei?: SharedZiwei | null;
  show_luck?: boolean;
};
export type CommunityComment = { id: string; post_id: string; author_id: string; author_name: string; body: string; created_at: string; ilju?: string | null };

// 목록용 컬럼 — **chart_* 를 명시적으로 제외**한다. 목록은 명식을 그리지 않는데 select('*') 로 두면
//   글 30개 × 첨부 명식이 통째로 딸려와 스크롤 진입이 느려진다(첨부 명식은 상세에서만 필요).
const LIST_COLS = 'id,author_id,author_name,category,title,body,like_count,comment_count,created_at,kind,daily_date,ilju,topic';
const POST_COLS = `${LIST_COLS},chart_saju,chart_ziwei,show_luck`;

// 카테고리(고정) — key 저장, 라벨은 i18n(community.cat.*).
export const COMMUNITY_CATEGORIES = ['free', 'love', 'saju', 'review', 'question'] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

// ── 비속어 필터(★daniel 검수 슬롯 — 최소 시드. 서버 자동숨김[신고 5]과 이중 방어) ──
//   완벽한 필터는 불가 — 명백한 욕설/혐오만 1차 차단하고, 나머지는 신고·차단·모더레이션으로.
const PROFANITY: string[] = [
  '씨발', '시발', '병신', '지랄', '개새끼', '좆', '보지', '자지', '꺼져', '섹스',
  'fuck', 'shit', 'bitch', 'asshole', 'cunt',
];
/** 명백한 비속어 포함 여부(제출 차단용). 공백·특수문자만 제거 후 부분일치. */
export function containsProfanity(text: string): boolean {
  // ⚠️★한글 보존(치명 버그 수정 2026-07-17): 기존 `\W`(=[^A-Za-z0-9_])는 **한글도 non-word 라 제거**해서
  //   "하이" → "" (빈 문자열)이 되고, 한글 비속어 "씨발"도 → "" → ""(빈).includes("")(빈) = **항상 true**
  //   → **모든 한글 게시물이 비속어로 오탐·차단**됐다(커뮤니티 글이 한 번도 등록 안 되던 근본 원인).
  //   → 문자(\p{L})·숫자(\p{N})만 남기고 공백·구두점·기호만 제거한다(우회 방지 의도는 유지, 한글은 보존).
  //   ※ \p{L} 유니코드 프로퍼티는 Hermes 호환이 불확실 → 영숫자(\w)+한글(완성형·자모) 명시 범위로.
  const strip = (s: string) => (s || '').toLowerCase().replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ]+/g, '');
  const norm = strip(text);
  return PROFANITY.some((w) => { const ws = strip(w); return ws.length > 0 && norm.includes(ws); });
}

async function uid(): Promise<string | null> {
  // ★getSession(로컬 세션 = insert 요청에 실제로 실리는 그 토큰)에서 uid를 얻는다.
  //   getUser()는 서버 재검증이라 insert 세션과 미묘하게 어긋날 수 있고, 그러면 넣은 author_id ≠ 서버 auth.uid()
  //   → RLS(author_id = auth.uid()) 위반으로 insert 실패(community_posts 0 rows·에러가 모달에 가려 '무반응'으로 보임).
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

/** 게시글 목록(카테고리 필터·최신순·페이지). 숨김·차단 유저 글은 RLS가 제외. 첨부 명식은 제외(LIST_COLS). */
export async function listPosts(category?: CommunityCategory, limit = 30, beforeIso?: string): Promise<CommunityPost[]> {
  let q = supabase.from('community_posts').select(LIST_COLS).order('created_at', { ascending: false }).limit(limit);
  if (category) q = q.eq('category', category);
  if (beforeIso) q = q.lt('created_at', beforeIso);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CommunityPost[];
}

/** 게시글 1개(첨부 명식 포함 — 상세만). */
export async function getPost(id: string): Promise<CommunityPost | null> {
  const { data } = await supabase.from('community_posts').select(POST_COLS).eq('id', id).maybeSingle();
  return (data as CommunityPost) ?? null;
}

/**
 * 글 작성(비속어 1차 차단). author_id/name 은 서버 트리거가 설정.
 * @param chart 첨부 명식(선택). **반드시 toSharedSaju/toSharedZiwei 를 거친 값**만 넘긴다 —
 *   원시 ChartInput 이나 SajuChart 원본(전 생애 대운 포함)을 그대로 넘기면 안 된다(위 화이트리스트 주석).
 *   호출부(글쓰기 화면)는 relation='self' 명식만 고를 수 있게 하고 동의를 받은 뒤 넘긴다.
 */
/**
 * 작성자 일주(2자) — 프로필 opt-in(show_ilju) + 대표 명식이 있을 때만.
 * ★글자 2자(60가지)만 저장 — 생일 역산 불가(명식공유 화이트리스트와 같은 원칙).
 * 실패는 조용히 null(뱃지는 장식 — 글쓰기를 막을 이유가 없다).
 */
async function myIljuIfEnabled(me: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('profiles').select('show_ilju').eq('id', me).single();
    if (!data?.show_ilju) return null;
    const saved = await loadRepChart();
    if (!saved) return null;
    const p = computeChart(saved.input).saju.pillars['일'];
    return `${p.stem}${p.branch}`;
  } catch { return null; }
}

export async function createPost(
  category: CommunityCategory, title: string, body: string,
  chart?: { saju: SharedSaju; ziwei?: SharedZiwei | null; showLuck: boolean },
  topic?: string | null,   // P2: 후기(review) 글이 가리키는 콘텐츠 key(contentSections)
): Promise<string> {
  if (containsProfanity(title) || containsProfanity(body)) throw new Error('PROFANITY');
  const me = await uid();
  if (!me) throw new Error('세션이 필요해요.');
  const ilju = await myIljuIfEnabled(me);
  const { data, error } = await supabase.from('community_posts')
    .insert({
      author_id: me, category, title: title.trim(), body: body.trim(), ilju, topic: category === 'review' ? (topic ?? null) : null,
      chart_saju: chart?.saju ?? null,
      chart_ziwei: chart?.ziwei ?? null,
      // 첨부가 없으면 항상 false — 시기 공개 플래그가 명식 없이 남아 있을 이유가 없다.
      show_luck: chart ? chart.showLuck : false,
    }).select('id').single();
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
  const ilju = await myIljuIfEnabled(me);
  const { error } = await supabase.from('community_comments').insert({ post_id: postId, author_id: me, body: body.trim(), ilju });
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
/** 체감 투표(멱등 upsert) — 일진 스레드 등 어떤 글에도 붙는다(플랫폼 범용). */
export async function pollVote(postId: string, choice: 1 | 2 | 3 | 4 | 5): Promise<void> {
  const { error } = await supabase.rpc('community_poll_vote', { p_post: postId, p_choice: choice });
  if (error) throw error;
}

/** 투표 집계 — 행이 아니라 숫자만(익명). my=내 선택(없으면 null). */
export async function pollStats(postId: string): Promise<{ counts: Record<number, number>; total: number; my: number | null }> {
  const { data, error } = await supabase.rpc('community_poll_stats', { p_post: postId });
  if (error) throw error;
  const counts: Record<number, number> = {};
  let my: number | null = null; let total = 0;
  for (const r of (data ?? []) as { choice: number; cnt: number; my_choice: number | null }[]) {
    counts[r.choice] = Number(r.cnt); total += Number(r.cnt);
    if (r.my_choice != null) my = r.my_choice;
  }
  return { counts, total, my };
}

/** 설정 닉네임 저장(2~12자·욕설 차단). 빈 문자열 = 해제(결정론 익명이름으로 복귀). */
export async function setNickname(nick: string): Promise<void> {
  const v = nick.trim();
  if (v && (v.length < 2 || v.length > 12)) throw new Error('LENGTH');
  if (v && containsProfanity(v)) throw new Error('PROFANITY');
  const me = await uid();
  if (!me) throw new Error('세션이 필요해요.');
  const { error } = await supabase.from('profiles').update({ nickname: v || null }).eq('id', me);
  if (error) throw error;
}

/** 커뮤니티 프로필(닉네임·일주 뱃지 설정) 조회 — 설정 화면용. */
export async function getCommunityProfile(): Promise<{ nickname: string | null; show_ilju: boolean }> {
  const me = await uid();
  if (!me) return { nickname: null, show_ilju: false };
  const { data } = await supabase.from('profiles').select('nickname,show_ilju').eq('id', me).single();
  return { nickname: (data?.nickname as string | null) ?? null, show_ilju: !!data?.show_ilju };
}

/** 일주 뱃지 표시 on/off. */
export async function setShowIlju(on: boolean): Promise<void> {
  const me = await uid();
  if (!me) throw new Error('세션이 필요해요.');
  const { error } = await supabase.from('profiles').update({ show_ilju: on }).eq('id', me);
  if (error) throw error;
}

export async function moderationQueue(): Promise<ModItem[]> {
  const { data, error } = await supabase.rpc('community_moderation_queue');
  if (error) throw error;
  return (data ?? []) as ModItem[];
}
