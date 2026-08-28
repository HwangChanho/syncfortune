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
  /** 본문을 연 횟수 — `bump_post_view()` 로만 오른다(0039). 목록에 뜬 것은 세지 않는다 */
  view_count?: number;
  title: string; body: string; like_count: number; comment_count: number; created_at: string;
  // P1(daniel 2026-08-05): kind='daily'=일진 스레드(cron 자동 개설·author_id null) / ilju=작성자 일주 뱃지(opt-in·2자)
  kind?: 'normal' | 'daily'; daily_date?: string | null; ilju?: string | null;
  topic?: string | null;   // P2 후기 태그 — contentSections item key(라벨·라우트는 클라 단일 출처)
  // 첨부 명식(선택) — 목록 조회(listPosts)에는 실리지 않는다(아래 LIST_COLS). 상세(getPost)에서만 채워진다.
  chart_saju?: SharedSaju | null;
  chart_ziwei?: SharedZiwei | null;
  show_luck?: boolean;
  /** ★첨부 사진 **경로**(URL 아님) — `postImageUrl()` 로 바꿔 그린다 */
  image_path?: string | null;
};
export type CommunityComment = { id: string; post_id: string; author_id: string; author_name: string; body: string; created_at: string; ilju?: string | null };

// 목록용 컬럼 — **chart_* 를 명시적으로 제외**한다. 목록은 명식을 그리지 않는데 select('*') 로 두면
//   글 30개 × 첨부 명식이 통째로 딸려와 스크롤 진입이 느려진다(첨부 명식은 상세에서만 필요).
const LIST_COLS = 'id,author_id,author_name,category,title,body,like_count,comment_count,view_count,created_at,kind,daily_date,ilju,topic,image_path';
const POST_COLS = `${LIST_COLS},chart_saju,chart_ziwei,show_luck`;

// 카테고리(고정) — key 저장, 라벨은 i18n(community.cat.*).
//
// ★2026-08-21 콘티대로 **일곱**으로 바꿨다(연애·직장진로·재물·일상·자유·타로·자미두수).
//   ⚠️콘티의 칩 줄 맨 앞 「추천·인기」는 **카테고리가 아니라 정렬**이다 —
//     글의 성격이 아니라 '무엇을 먼저 보여줄까'라서 카테고리에 섞으면 안 된다(`CommunitySort`).
//   ⚠️바뀐 값이라 **기존 글이 있으면 마이그레이션이 필요**했겠지만, 실측 결과 `community_posts` 가
//     0건이라 옮길 것이 없다. 나중에 또 바꿀 땐 이 확인을 먼저 한다.
export const COMMUNITY_CATEGORIES = ['love', 'career', 'wealth', 'daily', 'free', 'tarot', 'ziwei'] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

/** 정렬 — 콘티의 「추천 / 인기」. 추천 = 최신순(기본), 인기 = 좋아요 많은 순. */
export type CommunitySort = 'recommend' | 'popular';

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
export async function listPosts(
  category?: CommunityCategory, limit = 30, beforeIso?: string, sort: CommunitySort = 'recommend',
): Promise<CommunityPost[]> {
  // ★'인기'도 최신순을 2차 정렬로 둔다 — 좋아요가 같을 때 순서가 매번 바뀌면 목록이 흔들린다
  let q = supabase.from('community_posts').select(LIST_COLS).limit(limit);
  q = sort === 'popular'
    ? q.order('like_count', { ascending: false }).order('created_at', { ascending: false })
    : q.order('created_at', { ascending: false });
  if (category) q = q.eq('category', category);
  if (beforeIso) q = q.lt('created_at', beforeIso);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CommunityPost[];
}

/**
 * **내가 쓴 글** (콘티 4면 「내 활동 › 작성한 글」).
 *
 * ★목록과 같은 컬럼(`LIST_COLS`)을 쓴다 — 화면이 같은 카드를 그리므로 모양이 갈리면 안 된다.
 * ⚠️RLS 는 '남의 글 숨김·차단'을 거르지만 **내 글은 내가 언제나 본다**(작성자 본인).
 */
export async function myPosts(limit = 50): Promise<CommunityPost[]> {
  const me = await uid();
  if (!me) return [];
  const { data, error } = await supabase.from('community_posts').select(LIST_COLS)
    .eq('author_id', me).order('created_at', { ascending: false }).limit(limit);
  if (error) { console.warn('[community] 내 글 조회 실패', error.message); return []; }
  return (data ?? []) as CommunityPost[];
}

/** 내 댓글 한 줄 — 어느 글에 달았는지 함께 보여 줘야 뜻이 통한다. */
export type MyComment = CommunityComment & { post_title: string | null };

/**
 * **내가 단 댓글** (콘티 「내 활동 › 댓글과 답글」).
 *
 * ★글 제목을 조인해서 가져온다 — 댓글만 나열하면 무슨 얘기였는지 알 수 없다.
 * ⚠️조인한 글이 지워졌으면 제목이 null 이다. 그때는 화면이 '삭제된 글'로 적는다(빈칸으로 두지 않는다).
 */
export async function myComments(limit = 50): Promise<MyComment[]> {
  const me = await uid();
  if (!me) return [];
  const { data, error } = await supabase.from('community_comments')
    .select('id, post_id, author_id, author_name, body, created_at, ilju, community_posts(title)')
    .eq('author_id', me).order('created_at', { ascending: false }).limit(limit);
  if (error) { console.warn('[community] 내 댓글 조회 실패', error.message); return []; }
  return (data ?? []).map((r: any) => ({
    id: r.id, post_id: r.post_id, author_id: r.author_id, author_name: r.author_name,
    body: r.body, created_at: r.created_at, ilju: r.ilju ?? null,
    post_title: r.community_posts?.title ?? null,
  }));
}

/**
 * 조회수 +1 — ★**본문을 열었을 때만** 부른다(목록에 뜬 것은 조회가 아니다).
 *
 * ⚠️★`supabase.rpc()` 는 **실패해도 throw 하지 않는다** — 그래서 `try/catch` 로는 아무것도 못 잡는다.
 *   처음에 그렇게 써서 `check:rpcerror` 가 잡아 줬다. 반드시 `error` 를 **읽어야** 한다.
 * ★읽은 뒤에는 던지지 않는다(의도) — 조회수 때문에 글이 안 열리면 그게 더 나쁜 고장이다.
 *   대신 조용히 삼키지 않고 로그에 남긴다.
 */
export async function bumpView(postId: string): Promise<void> {
  const { error } = await supabase.rpc('bump_post_view', { p_post: postId });
  if (error) console.warn('[community] 조회수 증가 실패(무시)', error.message);
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

/**
 * ★후기 태그(`topic`)는 **카테고리와 직교한다**(2026-08-21).
 *   전에는 `category==='review'` 일 때만 저장했는데, 콘티에는 「후기」 카테고리가 없다.
 *   ⇒ 카테고리에서 빼되 **기능은 죽이지 않는다** — '무슨 얘기냐'(카테고리)와
 *     '어떤 콘텐츠에 대한 글이냐'(태그)는 애초에 다른 축이라, 연애 글에도 후기를 달 수 있는 게 맞다.
 */
export async function createPost(
  category: CommunityCategory, title: string, body: string,
  chart?: { saju: SharedSaju; ziwei?: SharedZiwei | null; showLuck: boolean },
  topic?: string | null,   // P2: 후기(review) 글이 가리키는 콘텐츠 key(contentSections)
  /** ★올린 사진의 **경로**(URL 아님 · Boss 2026-08-28). 화면이 공개 URL 로 바꿔 그린다. */
  imagePath?: string | null,
): Promise<string> {
  if (containsProfanity(title) || containsProfanity(body)) throw new Error('PROFANITY');
  const me = await uid();
  if (!me) throw new Error('세션이 필요해요.');
  const ilju = await myIljuIfEnabled(me);
  const { data, error } = await supabase.from('community_posts')
    .insert({
      author_id: me, category, title: title.trim(), body: body.trim(), ilju, topic: topic ?? null,   // ★카테고리와 무관하게 붙일 수 있다(아래 주석)
      chart_saju: chart?.saju ?? null,
      chart_ziwei: chart?.ziwei ?? null,
      // 첨부가 없으면 항상 false — 시기 공개 플래그가 명식 없이 남아 있을 이유가 없다.
      show_luck: chart ? chart.showLuck : false,
      image_path: imagePath ?? null,
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

/**
 * 댓글 등록.
 * ★2026-08-28 — **만든 행을 돌려준다**(Boss *"댓글 남기면 바로 갱신이 안돼"*).
 *   종전엔 `void` 라 화면이 «다시 읽어 오는 것» 말고는 새 댓글을 보여 줄 방법이 없었다.
 *   다시 읽기는 왕복이 한 번 더 드는 데다, 그 사이 화면은 **아무 일도 안 일어난 것처럼** 보인다.
 *   ⇒ 삽입 결과를 받아 그 자리에서 붙인다(목록 재조회는 그 뒤에 조용히).
 */
export async function addComment(postId: string, body: string): Promise<CommunityComment> {
  if (containsProfanity(body)) throw new Error('PROFANITY');
  const me = await uid();
  if (!me) throw new Error('세션이 필요해요.');
  const ilju = await myIljuIfEnabled(me);
  const { data, error } = await supabase.from('community_comments')
    .insert({ post_id: postId, author_id: me, body: body.trim(), ilju })
    .select('*').single();
  if (error) throw error;
  return data as CommunityComment;
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

/**
 * 커뮤니티 글에 붙일 **사진 한 장**을 올린다 (Boss 2026-08-28 *"사진도 올릴수 있게하고"*).
 * ═════════════════════════════════════════════════════════════════════════
 * ■ ★대화 사진(`talk_messages.image_path`)과 **같은 방식**이다 — 버킷·경로 규칙을 새로 만들지 않는다.
 *   `avatars` 공개 버킷 · `community/<uid>/<난수>.<ext>`.
 * ■ ⚠️**공개 버킷**이다 — 주소를 알면 볼 수 있다. 난수 이름으로 «추측»만 막는다.
 *   그래서 화면에서 **주의사항을 먼저 고지**한다(올린 사진은 공개된다는 뜻).
 * ■ ⚠️크기를 서버가 아니라 여기서 자른다 — 4MB 를 넘기면 올리지 않는다.
 *
 * @param file 브라우저 File/Blob
 * @returns 저장 경로(실패면 null)
 */
export async function uploadPostImage(
  file: Blob & { name?: string; type?: string },
): Promise<{ ok: boolean; path?: string; error?: 'unauthorized' | 'too_large' | 'failed' }> {
  const me = await uid();
  if (!me) return { ok: false, error: 'unauthorized' };
  if (file.size > 4 * 1024 * 1024) return { ok: false, error: 'too_large' };
  const type = file.type || 'image/jpeg';
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const name = (globalThis.crypto?.randomUUID?.() ?? String(Math.random()).slice(2)).replace(/-/g, '');
  // ⚠️★**첫 폴더가 내 uid 여야 한다** — 스토리지 정책이 `foldername(name)[1] = auth.uid()` 다.
  //   처음엔 `community/<uid>/…` 로 썼다가 **업로드가 통째로 막혔다**(실측).
  //   경로를 바꾸는 쪽이 정책을 넓히는 것보다 안전하다 — 남의 칸을 못 건드리는 성질이 그대로 남는다.
  const path = `${me}/community/${name}.${ext}`;
  const up = await supabase.storage.from('avatars').upload(path, file, { upsert: false, contentType: type });
  if (up.error) { console.warn('[community] 사진 올리기 실패', up.error.message); return { ok: false, error: 'failed' }; }
  return { ok: true, path };
}

/** 저장 경로 → 공개 URL. ⚠️`avatars` 버킷이다(대화 사진과 같은 곳). */
export function postImageUrl(path?: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
