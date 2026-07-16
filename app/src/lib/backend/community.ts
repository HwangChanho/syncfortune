// app/src/lib/backend/community.ts — 커뮤니티(UGC) 클라이언트 API + 비속어 필터 (Apple 1.2 준수)
// ─────────────────────────────────────────────────────────────────────────
// 백엔드: community_posts/comments/likes/reports/blocks + RPC(toggle_like·report·block·admin_hide).
//   Apple 1.2 준수 UI 축(화면에서 사용): ①신고 ②차단 ③비속어 필터(제출 차단) ④본인 삭제 ⑤이용약관 동의.
//   작성자 uid = 익명세션 포함 authenticated. author_name = 서버 트리거가 profiles.display_name 스냅샷.
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, LuckCycle, AnnualPillar } from '@spec/chart';
import { supabase } from '../supabase';

// ── 게시물 첨부 명식(공유 스냅샷) ─────────────────────────────────────────
// ★여기가 보안 경계다. 게시물 읽기 권한 = authenticated 전원이고, 이 앱은 익명 세션을 상시 발급하므로
//   (Apple 5.1.1 대응) 실질적으로 **앱 설치자 누구나** 게시물 JSON 을 REST 로 그대로 읽는다.
//   그래서 "무엇을 넣는가"가 아니라 **"무엇만 넣는가"** 를 아래 타입·변환 함수가 화이트리스트로 강제한다.
//   화면에서 안 그리는 것은 방어가 아니다 — 안 올리는 것만이 방어다.
//
// 제외 대상과 이유:
//   - **원시 ChartInput(생년월일시·성별·출생지)**: 절대 금지. 계산이 끝난 결과만 싣는다(CLAUDE.md 규칙8).
//   - **luckCycles(전 생애 대운)**: ①대운은 성별에 따라 순행/역행이 갈리고 시작 나이가 절기까지의 일수로
//     정해져 **생일 역산의 재료**가 된다 ②대운 12 × 세운 10 × 월운 12 = 시간축 객체 1,440개 =
//     **실측 99KB/건**(pillars 는 0.9KB)이라 응답을 통째로 부풀린다. 화면이 그리는 건 *현재* 대운·세운뿐.
//   - **show_luck=false 면 currentLuck·annual 자체를 넣지 않는다**: 작성자가 시기 공개를 선택하지 않았는데
//     데이터만 실려 가면 화면에 안 보여도 API 로 읽힌다.
//   - **structure(격국·용신·병약·문파 판정 = 인코딩된 전문가 레이어)**: 앱 온디바이스 buildSajuChart 는
//     애초에 채우지 않지만(실측 확인), 나중에 채워지더라도 게시물로 새지 않도록 화이트리스트가 막는다.
//   - **ziwei.decades(자미 대한)·minorStars·brightness·사화**: 명반 요약 표시에 불필요.
// ⚠️ 그래도 **원국 여덟 글자만으로 생년월일 역산이 가능**하다(연주=60갑자·월일시주로 날짜 특정).
//   → 첨부는 relation='self'(본인) 명식만 허용하고, 작성 화면에서 이 사실을 고지한 뒤 동의받는다.
export type SharedSaju = {
  pillars: SajuChart['pillars'];           // 원국 여덟 글자(지장간·통근 포함 — 날것 보존, 규칙3)
  dayMaster: SajuChart['dayMaster'];       // 일간 = '나'
  interactions: SajuChart['interactions']; // 원국 내 합충형해
  currentLuck?: Omit<LuckCycle, 'annuals'>; // show_luck=true 일 때만. annuals(세운 10 × 월운 12) 절단
  annual?: Omit<AnnualPillar, 'months'>;    // show_luck=true 일 때만. months(월운 12) 절단
};
export type SharedZiwei = {
  bureau: string;
  lifePalaceBranch: string;
  palaces: { name: string; branch: string; majorStars: { name: string }[] }[];
};

/**
 * 온디바이스 계산 결과 → 게시물 첨부용 사주 스냅샷(화이트리스트).
 * @param saju computeChart(input).saju — 작성자 기기에서 계산이 끝난 SajuChart
 * @param showLuck 작성자가 대운·세운 공개를 선택했는가. false 면 시간축 필드를 **아예 만들지 않는다**.
 * @returns 서버에 올려도 되는 필드만 담은 객체(원시 PII·전 생애 시간축·해자 판정 없음)
 */
export function toSharedSaju(saju: SajuChart, showLuck: boolean): SharedSaju {
  const out: SharedSaju = {
    pillars: saju.pillars,
    dayMaster: saju.dayMaster,
    interactions: saju.interactions ?? [],
  };
  if (showLuck && saju.currentLuck) {
    const { annuals: _drop, ...luck } = saju.currentLuck; // 이 대운의 세운 10년(각각 월운 12) 절단
    out.currentLuck = luck;
  }
  if (showLuck && saju.annual) {
    const { months: _drop, ...ann } = saju.annual;        // 이 세운의 월운 12 절단
    out.annual = ann;
  }
  return out;
}

/**
 * 자미두수 산출물 → 게시물 첨부용 명반 스냅샷(화이트리스트).
 * @param ziwei computeChart(input).ziwei — iztro 산출물이라 any 로 방어적으로 다룬다
 * @returns 12궁 × (궁 이름·지지·주성 이름)만. 명반이 아니면(palaces 없음) null.
 */
export function toSharedZiwei(ziwei: any): SharedZiwei | null {
  if (!ziwei || !Array.isArray(ziwei.palaces)) return null;
  return {
    bureau: String(ziwei.bureau ?? ''),
    lifePalaceBranch: String(ziwei.lifePalaceBranch ?? ''),
    palaces: ziwei.palaces.map((p: any) => ({
      name: String(p?.name ?? ''),
      branch: String(p?.branch ?? ''),
      majorStars: (p?.majorStars ?? []).map((s: any) => ({ name: String(s?.name ?? '') })),
    })),
  };
}

export type CommunityPost = {
  id: string; author_id: string; author_name: string; category: string;
  title: string; body: string; like_count: number; comment_count: number; created_at: string;
  // 첨부 명식(선택) — 목록 조회(listPosts)에는 실리지 않는다(아래 LIST_COLS). 상세(getPost)에서만 채워진다.
  chart_saju?: SharedSaju | null;
  chart_ziwei?: SharedZiwei | null;
  show_luck?: boolean;
};
export type CommunityComment = { id: string; post_id: string; author_id: string; author_name: string; body: string; created_at: string };

// 목록용 컬럼 — **chart_* 를 명시적으로 제외**한다. 목록은 명식을 그리지 않는데 select('*') 로 두면
//   글 30개 × 첨부 명식이 통째로 딸려와 스크롤 진입이 느려진다(첨부 명식은 상세에서만 필요).
const LIST_COLS = 'id,author_id,author_name,category,title,body,like_count,comment_count,created_at';
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
/** 명백한 비속어 포함 여부(제출 차단용). 공백·특수문자 제거 후 부분일치. */
export function containsProfanity(text: string): boolean {
  const norm = (text || '').toLowerCase().replace(/[\s\W_]+/g, '');
  return PROFANITY.some((w) => norm.includes(w.replace(/[\s\W_]+/g, '')));
}

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
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
export async function createPost(
  category: CommunityCategory, title: string, body: string,
  chart?: { saju: SharedSaju; ziwei?: SharedZiwei | null; showLuck: boolean },
): Promise<string> {
  if (containsProfanity(title) || containsProfanity(body)) throw new Error('PROFANITY');
  const me = await uid();
  if (!me) throw new Error('세션이 필요해요.');
  const { data, error } = await supabase.from('community_posts')
    .insert({
      author_id: me, category, title: title.trim(), body: body.trim(),
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
