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
  avatar: string | null;
  specialty: string[];
  /** 가상 전용 — 안내할 콘텐츠 키(`contentSections` 의 key). 순서가 곧 노출 순서다 */
  routes: string[];
  sortOrder: number;
  /**
   * 홈 블록 친구면 그 블록 키(Boss 2026-08-19 *"홈에있던것들 전부"*).
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
  { id: 'wealth_guide', kind: 'virtual', name: '재물 안내', tagline: '돈·일·재물 그릇', avatar: null, specialty: ['wealth', 'work'], routes: ['wealth', 'career', 'job', 'jobfit', 'talent'], sortOrder: 10 },
  { id: 'love_guide', kind: 'virtual', name: '인연 안내', tagline: '연애·궁합·인연', avatar: null, specialty: ['love'], routes: ['love', 'crush', 'reunion', 'compat', 'lovestyle', 'relationmap'], sortOrder: 20 },
  { id: 'flow_guide', kind: 'virtual', name: '흐름 안내', tagline: '오늘·이달·올해의 결', avatar: null, specialty: ['today'], routes: ['today', 'month', 'newyear', 'future10', 'timeline', 'luck'], sortOrder: 30 },
  { id: 'self_guide', kind: 'virtual', name: '나 안내', tagline: '성격·기질·타고난 결', avatar: null, specialty: ['self'], routes: ['selfAnalysis', 'persona', 'mbti', 'egen', 'dayPillar', 'image'], sortOrder: 40 },
  { id: 'myeongun', kind: 'live', name: '명운 선생', tagline: '무엇이든 물어보세요', avatar: null, specialty: ['all'], routes: [], sortOrder: 90 },
];

let _cache: Consultant[] | null = null;

/** 서버 행 → 앱 타입. 컬럼 이름이 바뀌면 여기만 고친다. */
function fromRow(r: any): Consultant {
  return {
    id: String(r.id),
    kind: r.kind === 'live' ? 'live' : 'virtual',   // ★모르는 값은 안전한 쪽(virtual = 원가 0)으로
    name: String(r.name ?? ''),
    tagline: r.tagline ?? null,
    avatar: r.avatar ?? null,
    specialty: Array.isArray(r.specialty) ? r.specialty : [],
    routes: Array.isArray(r.routes) ? r.routes : [],
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
      supabase.from('consultants').select('id,kind,name,tagline,avatar,specialty,routes,sort_order').order('sort_order'),
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
