// app/src/lib/talk/consultants.ts — 상담사 목록 (서버 `consultants` 테이블)
// ═══════════════════════════════════════════════════════════════════════════
// 시작 화면(카톡 친구목록)이 읽는 값. **관리자가 등록하면 배포 없이 늘어난다** — 그게 이 설계의 요점이다.
//
// ■ 왜 캐시를 두나
//   목록은 앱을 열 때마다 보이는데 거의 안 바뀐다. 매번 왕복하면 첫 화면이 그만큼 늦다.
//   ⇒ 메모리에 한 번 담고, 실패하면 **씨앗(seed)** 으로 떨어진다 — 네트워크가 없어도 화면은 뜬다.
//
// ■ ⚠️`kind` 는 서버 값만 믿는다
//   `virtual`(원가 0) / `live`(LLM) 은 **과금 경로**를 가른다. 앱이 정하게 두면
//   클라이언트를 고쳐 유료 대화를 무료로 부를 수 있다. 여기서는 서버가 준 값을 그대로 옮기기만 한다.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';

export type Consultant = {
  id: string;
  kind: 'virtual' | 'live';
  name: string;
  tagline: string | null;
  /** ★상담가 **본인 채널**(유튜브 등) — "실제 상담가가 만드는 서비스"라는 신뢰 신호(Boss 2026-08-25) */
  linkUrl?: string | null;
  linkLabel?: string | null;
  avatar: string | null;
  /** 프로필 창의 **배경 사진**(카카오톡식). 없으면 오행 색면으로 채운다 */
  cover?: string | null;
  specialty: string[];
  /** 프로필 사진 **URL**(경로 아님 — `fromRow` 가 이미 바꿔 놨다) */
  avatarUrlOnly?: never;
  /** 가상 전용 — 안내할 콘텐츠 키(`contentSections` 의 key). 순서가 곧 노출 순서다 */
  routes: string[];
  sortOrder: number;
  /**
   * 이 상담가가 대화에서 보여 줄 홈 블록 키들(Boss 2026-08-20 다섯으로 압축).
   * ★친구목록에서 블록을 뺀 대신 **사람 아래로 묶은** 자리다 — 비우면 그 블록은 도달 불가가 된다.
   */
  blocks: string[];
  /** 친구목록의 묶음 — `teacher`(선생님 AI) / `friend`(함께하면 좋은 친구들) */
  group: 'teacher' | 'friend';
  /**
   * (구) 홈 블록 자체가 친구였을 때의 키. 다섯 압축 뒤로는 쓰지 않는다.
   * ★서버 `consultants` 에 없다 — **앱이 만든 친구**다. 홈 블록은 온디바이스 화면이라
   *   서버가 알 필요가 없고, `homeOrder`(운영자가 정하는 순서)를 그대로 따라야 하기 때문이다.
   *   ⇒ 이 값이 있으면 대화창은 말풍선 대신 그 블록 화면을 띄운다.
   */
  block?: string;
};

/**
 * 씨앗 — 서버를 못 읽었을 때 쓰는 최소 목록.
 * ★마이그레이션 `0026` 의 시드와 **같은 내용**이다. 둘이 갈리면 오프라인에서 다른 앱이 된다.
 */
const SEED: Consultant[] = [
  // 선생님 AI
  { id: 'nossem', kind: 'live', name: '노쌤의 사주상담소', tagline: '사주 · 명리 공부', avatar: null, specialty: ['saju'], routes: ['saju', 'gaeun'], blocks: ['studysaju', 'free3', 'persona', 'self'], group: 'teacher', sortOrder: 10 },
  { id: 'love_seoyun', kind: 'live', name: '연애세포 서윤쌤', tagline: '연애·궁합', avatar: null, specialty: ['love'], routes: ['compat', 'love', 'crush', 'reunion', 'lovestyle'], blocks: ['relation', 'relmap'], group: 'teacher', sortOrder: 20 },
  { id: 'guide_minjae', kind: 'live', name: '사주 보는 길잡이 민재', tagline: '사업·재물', avatar: null, specialty: ['wealth'], routes: ['wealth', 'career', 'jobfit', 'talent'], blocks: [], group: 'teacher', sortOrder: 30 },
  { id: 'tarot_harin', kind: 'live', name: '타로마스터 하린', tagline: '타로', avatar: null, specialty: ['tarot'], routes: ['taro'], blocks: [], group: 'teacher', sortOrder: 40 },
  { id: 'tarot_doyun', kind: 'live', name: '타로하는 도윤', tagline: '고민 정리', avatar: null, specialty: ['tarot'], routes: ['taro', 'dream', 'taemong'], blocks: [], group: 'teacher', sortOrder: 50 },
  { id: 'ziwei_yujin', kind: 'live', name: '자미두수 유진', tagline: '자미두수 · 공부', avatar: null, specialty: ['ziwei'], routes: ['ziwei', 'timeline', 'lifegraph'], blocks: ['ziwei', 'studyziwei'], group: 'teacher', sortOrder: 60 },
  { id: 'astro_taehyun', kind: 'live', name: '별자리 자미 태현', tagline: '운의 타이밍', avatar: null, specialty: ['astro'], routes: ['astrology', 'numerology', 'newyear'], blocks: ['decision'], group: 'teacher', sortOrder: 70 },
  // 함께하면 좋은 친구들 — ★사주와 무관한 주제다(일상 대화 허용이 이들을 받쳐 준다)
  // ★「오늘의 운세」 — 하루 콘텐츠의 **자기 자리**(Boss 2026-08-26).
  //   종전엔 성태현 안에 `blocks=['today','month']` 로 숨어 있어 그 사람을 알아야 도달했다.
  //   ⚠️내일의 운세는 **별도 블록이 아니다** — `TodayFortuneBlock` 이 오늘/내일 토글을 내장한다.
  //   ★`virtual` = 두 블록 다 온디바이스 결정론이라 **원가 ₩0**(LLM 을 안 부른다).
  { id: 'fortune_today', kind: 'virtual', name: '오늘의 운세', tagline: '오늘 · 내일 · 이달', avatar: null, specialty: ['today'], routes: ['today', 'month'], blocks: ['today', 'month'], group: 'friend', sortOrder: 100 },
  { id: 'beauty_jjinya', kind: 'live', name: '메이크업 아티스트 찐야', tagline: '메이크업', avatar: null, specialty: ['beauty'], routes: [], blocks: [], group: 'friend', sortOrder: 110 },
  { id: 'color_bombom', kind: 'live', name: '퍼스널컬러 봄봄', tagline: '어울리는 색', avatar: null, specialty: ['color'], routes: [], blocks: [], group: 'friend', sortOrder: 120 },
  { id: 'car_unni', kind: 'live', name: '차(량) 잘 아는 언니', tagline: '차 고르기', avatar: null, specialty: ['car'], routes: [], blocks: [], group: 'friend', sortOrder: 130 },
  { id: 'travel_jini', kind: 'live', name: '여행홀릭 지니', tagline: '여행', avatar: null, specialty: ['travel'], routes: [], blocks: [], group: 'friend', sortOrder: 140 },
  { id: 'heal_yuri', kind: 'live', name: '힐링하는 유리', tagline: '마음 돌보기', avatar: null, specialty: ['heal'], routes: [], blocks: [], group: 'friend', sortOrder: 150 },
];

let _cache: Consultant[] | null = null;

/**
 * 아바타 경로 → 공개 URL.
 * ⚠️★`A()`(`lib/ui/remoteAsset`)를 쓰면 안 된다 — 그건 `assets/img/` 버킷을 가리키는데
 *   상담가 사진은 **`avatars` 버킷**이다. 잘못 쓰면 404 가 나고 **조용히 안 뜬다**
 *   (오류도 안 나서 "사진을 올렸는데 왜 안 나오지"만 남는다).
 * ★버전 쿼리: 관리자가 **같은 경로에 덮어쓰므로** 없으면 CDN 이 옛 사진을 계속 준다.
 *   목록을 읽는 시점 기준이라 앱을 다시 열면 새 사진이 온다.
 */
function avatarUrl(path: string): string {
  const base = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  return `${base}?v=${Math.floor(Date.now() / 60000)}`;   // 1분 단위 — 매 렌더마다 바뀌면 캐시가 무의미하다
}

/** 서버 행 → 앱 타입. 컬럼 이름이 바뀌면 여기만 고친다. */
function fromRow(r: any): Consultant {
  return {
    id: String(r.id),
    kind: r.kind === 'live' ? 'live' : 'virtual',   // ★모르는 값은 안전한 쪽(virtual = 원가 0)으로
    name: String(r.name ?? ''),
    tagline: r.tagline ?? null,
    // ★경로가 아니라 **완성된 URL** 로 내려준다 — 화면이 어느 버킷인지 알 필요가 없다
    avatar: r.avatar ? avatarUrl(String(r.avatar)) : null,
    cover: r.cover ? avatarUrl(String(r.cover)) : null,
    specialty: Array.isArray(r.specialty) ? r.specialty : [],
    routes: Array.isArray(r.routes) ? r.routes : [],
    blocks: Array.isArray(r.blocks) ? r.blocks : [],
    linkUrl: r.link_url ?? null,
    linkLabel: r.link_label ?? null,
    // ★모르는 값은 'teacher' 로 — 새 묶음이 생겨도 목록에서 사라지지 않는다
    group: r.group_key === 'friend' ? 'friend' : 'teacher',
    sortOrder: Number(r.sort_order ?? 100),
  };
}

/**
 * 상담사 목록을 읽는다.
 *
 * @param force true 면 캐시를 무시하고 다시 읽는다(관리자가 방금 바꿨을 때)
 * @returns 노출 순서대로 정렬된 목록. 서버 실패 시 씨앗
 */
export async function listConsultants(force = false): Promise<Consultant[]> {
  if (_cache && !force) return _cache;
  try {
    const r = await withTimeout(
      // ★★`enabled` 를 **쿼리에서** 거른다(2026-08-19 실물에서 잡힘).
      //   RLS 의 공개 정책은 `using (enabled)` 라 일반 사용자에겐 안 보이지만,
      //   관리자 정책이 `for all` 이라 **관리자에게는 비활성 상담사까지 보인다**
      //   (정책은 OR 로 합쳐진다). 실제로 준비 중인 「노쎔」이 친구목록에 떠 있었다.
      //   ⇒ RLS 는 '볼 권한'을 정하고, 쿼리는 '지금 보여줄 것'을 정한다. 둘은 다르다.
      supabase.from('consultants').select('id,kind,name,tagline,avatar,cover,specialty,routes,blocks,group_key,sort_order, link_url, link_label')
        .eq('enabled', true).order('sort_order'),
      8000,
    );
    if (!r || r.error || !Array.isArray(r.data) || !r.data.length) return _cache ?? SEED;
    _cache = r.data.map(fromRow);
    return _cache;
  } catch {
    return _cache ?? SEED;   // 네트워크가 없어도 첫 화면은 뜬다
  }
}

/** 지금 캐시된 목록(동기 — 첫 렌더용). 아직 안 읽었으면 씨앗. */
export function consultantsSnapshot(): Consultant[] {
  return _cache ?? SEED;
}

/** 한 명 찾기. 없으면 null(라우트가 사라진 상담사를 열었을 때). */
export function findConsultant(id: string): Consultant | null {
  return consultantsSnapshot().find((c) => c.id === id) ?? null;
}
