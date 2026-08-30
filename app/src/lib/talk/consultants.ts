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
import i18n from 'i18next';   // 상담가 이름·소개의 언어별 값(copy_overrides)을 읽는다
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
   * 상담가 나이(만). **회원이 이보다 어리면 기본 반말**(Boss 2026-08-26).
   * ⚠️`null` = 정하지 않음 → **항상 존댓말**. 안전한 쪽이 기본값이다.
   *   (노쌤은 실존 인물이라 비워 두었다 — Boss 가 채울 자리다.)
   * ★판정은 `speechLevel.isCasual` 한 곳에서만 한다.
   */
  age?: number | null;
  /**
   * 이 사람을 **뭐라고 부를지**(프로필 창 표시). 비면 묶음 기본값(선생님 AI / 무료 친구).
   * ★Boss 2026-08-26 *"노쎔은 선생님 AI 아니고 역술인으로 해둬"* —
   *   `group` 을 바꾸면 **그 사람만 따로 떨어진 칸**이 생긴다(노쌤은 목록 첫 줄에 있어야 한다).
   *   ⇒ 묶음은 그대로 두고 **부르는 말만** 따로 둔다.
   * ⚠️「선생님 AI」는 **AI 임을 밝히는 자리**이기도 하다 — 바꾸는 것은 Boss 판단이다.
   */
  roleLabel?: string | null;
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
  { id: 'nossem', kind: 'live', name: '노쌤의 사주상담소', tagline: '사주 · 명리 공부', avatar: null, specialty: ['saju'], routes: ['saju', 'gaeun'], blocks: ['studysaju', 'free3', 'persona', 'self'], group: 'teacher', sortOrder: 10, age: 39, roleLabel: '역술인' },
  { id: 'love_seoyun', kind: 'live', name: '연애세포 서윤쌤', tagline: '연애·궁합', avatar: null, specialty: ['love'], routes: ['compat', 'love', 'crush', 'reunion', 'lovestyle'], blocks: ['relation', 'relmap'], group: 'teacher', sortOrder: 20, age: 33 },
  { id: 'guide_minjae', kind: 'live', name: '사주 보는 길잡이 민재', tagline: '사업·재물', avatar: null, specialty: ['wealth'], routes: ['wealth', 'career', 'jobfit', 'talent'], blocks: [], group: 'teacher', sortOrder: 30, age: 41 },
  { id: 'tarot_harin', kind: 'live', name: '타로마스터 하린', tagline: '타로', avatar: null, specialty: ['tarot'], routes: ['taro'], blocks: [], group: 'teacher', sortOrder: 40, age: 36 },
  { id: 'tarot_doyun', kind: 'live', name: '타로하는 도윤', tagline: '고민 정리', avatar: null, specialty: ['tarot'], routes: ['taro', 'dream', 'taemong'], blocks: [], group: 'teacher', sortOrder: 50, age: 30 },
  { id: 'ziwei_yujin', kind: 'live', name: '자미두수 유진', tagline: '자미두수 · 공부', avatar: null, specialty: ['ziwei'], routes: ['ziwei', 'timeline', 'lifegraph'], blocks: ['ziwei', 'studyziwei'], group: 'teacher', sortOrder: 60, age: 47 },
  { id: 'astro_taehyun', kind: 'live', name: '별자리 자미 태현', tagline: '운의 타이밍', avatar: null, specialty: ['astro'], routes: ['astrology', 'numerology', 'newyear'], blocks: ['decision'], group: 'teacher', sortOrder: 70, age: 38 },
  // 함께하면 좋은 친구들 — ★사주와 무관한 주제다(일상 대화 허용이 이들을 받쳐 준다)
  // ★「오늘의 운세」 — 하루 콘텐츠의 **자기 자리**(Boss 2026-08-26).
  //   종전엔 성태현 안에 `blocks=['today','month']` 로 숨어 있어 그 사람을 알아야 도달했다.
  //   ⚠️내일의 운세는 **별도 블록이 아니다** — `TodayFortuneBlock` 이 오늘/내일 토글을 내장한다.
  //   ★`virtual` = 두 블록 다 온디바이스 결정론이라 **원가 ₩0**(LLM 을 안 부른다).
  { id: 'fortune_today', kind: 'virtual', name: '오늘의 운세', tagline: '오늘 · 내일 · 이달', avatar: null, specialty: ['today'], routes: ['today', 'month'], blocks: ['today', 'month'], group: 'friend', sortOrder: 100 },
  { id: 'beauty_jjinya', kind: 'live', name: '메이크업 아티스트 찐야', tagline: '메이크업', avatar: null, specialty: ['beauty'], routes: [], blocks: [], group: 'friend', sortOrder: 110, age: 28 },
  { id: 'color_bombom', kind: 'live', name: '퍼스널컬러 봄봄', tagline: '어울리는 색', avatar: null, specialty: ['color'], routes: [], blocks: [], group: 'friend', sortOrder: 120, age: 31 },
  // ★콘텐츠 안내 전용(Boss 2026-08-28) — 열여섯 살·고양이 결. 풀이는 하지 않는다.
  //   ⚠️`specialty: ['guide']` 가 **명식을 안 받는 표식**이다(서버가 이걸로 가른다).
  { id: 'guide_nabi', kind: 'live', name: '운이', tagline: '뭐 볼지 골라줄게', avatar: null, specialty: ['guide'], routes: [], blocks: [], group: 'friend', sortOrder: 105, age: 16 },
  { id: 'car_unni', kind: 'live', name: '차(량) 잘 아는 언니', tagline: '차량 딜러', avatar: null, specialty: ['car'], routes: [], blocks: [], group: 'friend', sortOrder: 130, age: 35 },
  { id: 'travel_jini', kind: 'live', name: '여행홀릭 지니', tagline: '여행', avatar: null, specialty: ['travel'], routes: [], blocks: [], group: 'friend', sortOrder: 140, age: 29 },
  { id: 'heal_yuri', kind: 'live', name: '힐링하는 유리', tagline: '마음 돌보기', avatar: null, specialty: ['heal'], routes: [], blocks: [], group: 'friend', sortOrder: 150, age: 34 },
];

// ⚠️★캐시는 **서버 원문**을 담는다(번역된 결과가 아니라).
//   번역을 구워 두면 언어를 바꿔도 **이름·소개가 한국어 그대로** 남는다 —
//   «고쳤는데 왜 그대로냐» 의 전형이다. 매핑은 읽을 때마다 한다(22행이라 비용은 무시할 수준).
let _raw: any[] | null = null;

/**
 * 아바타 경로 → 공개 URL.
 * ⚠️★`A()`(`lib/ui/remoteAsset`)를 쓰면 안 된다 — 그건 `assets/img/` 버킷을 가리키는데
 *   상담가 사진은 **`avatars` 버킷**이다. 잘못 쓰면 404 가 나고 **조용히 안 뜬다**
 *   (오류도 안 나서 "사진을 올렸는데 왜 안 나오지"만 남는다).
 * ★버전 쿼리: 관리자가 **같은 경로에 덮어쓰므로** 없으면 CDN 이 옛 사진을 계속 준다.
 *   목록을 읽는 시점 기준이라 앱을 다시 열면 새 사진이 온다.
 */
function avatarUrl(path: string, ver?: string | null): string {
  const base = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  // ★버전은 **그 행이 바뀐 시각**이다 — 사진·영상이 바뀔 때만 바뀐다.
  //   ⚠️종전엔 `Math.floor(Date.now()/60000)`(1분 단위)였다. 사진(50KB)일 땐 견딜 만했지만
  //     **배경 영상(최대 8MB)** 에서는 주소가 바뀔 때마다 **다시 받고 재생이 처음으로 돌아간다.**
  //   ⚠️그래서 쓰는 쪽(관리자 콘솔·`covers:upload`·`avatars:upload`)이 media 를 갈 때
  //     `updated_at` 을 **함께 갱신해야 한다** — 안 하면 CDN 이 옛 파일을 계속 준다.
  //     실측(2026-08-26): 사진은 08-25 인데 `updated_at` 은 08-21 이었다 = 자동으로 안 따라간다.
  const v = ver ? Date.parse(ver) : NaN;
  return `${base}?v=${Number.isFinite(v) ? v : Math.floor(Date.now() / 60000)}`;
}

/**
 * DB 값 위에 **번역이 있으면 그것을** 쓴다.
 *
 * ⚠️★2026-08-27 실측으로 드러난 것 — 영어로 바꿔도 **상담가 이름·소개는 한국어 그대로**였다.
 *   화면 문구(`copy/*.ts`)를 아무리 번역해도 이건 안 바뀐다. **DB 값**이기 때문이다.
 *   ⇒ 이미 있는 `copy_overrides(키, 언어, 값)` 길을 그대로 쓴다 —
 *     `consultant.<id>.name` · `consultant.<id>.tagline` 키가 있으면 그 언어 값을 쓰고,
 *     **없으면 DB 원문**(한국어)을 쓴다. 언어를 늘려도 스키마도 이 코드도 안 바뀐다.
 *   ★한국어에서는 키를 **일부러 안 넣는다** — 정본이 두 곳이 되면 관리자 콘솔에서 이름을 고쳐도
 *     화면이 안 바뀌는 «고쳤는데 왜 그대로냐» 가 생긴다.
 *
 * @param key  `consultant.<id>.name` 같은 오버라이드 키
 * @param raw  DB 원문(번역이 없으면 이것을 쓴다)
 */
function tr(key: string, raw: string | null | undefined): string {
  const v = raw ?? '';
  if (i18n.language?.startsWith('ko')) return v;          // ★한국어는 DB 가 정본
  return i18n.exists(key) ? String(i18n.t(key)) : v;
}

/** 서버 행 → 앱 타입. 컬럼 이름이 바뀌면 여기만 고친다. */
function fromRow(r: any): Consultant {
  const id = String(r.id);
  return {
    id,
    kind: r.kind === 'live' ? 'live' : 'virtual',   // ★모르는 값은 안전한 쪽(virtual = 원가 0)으로
    name: tr(`consultant.${id}.name`, r.name),
    tagline: r.tagline ? tr(`consultant.${id}.tagline`, r.tagline) : null,
    // ★경로가 아니라 **완성된 URL** 로 내려준다 — 화면이 어느 버킷인지 알 필요가 없다
    avatar: r.avatar ? avatarUrl(String(r.avatar), r.updated_at) : null,
    cover: r.cover ? avatarUrl(String(r.cover), r.updated_at) : null,
    specialty: Array.isArray(r.specialty) ? r.specialty : [],
    routes: Array.isArray(r.routes) ? r.routes : [],
    blocks: Array.isArray(r.blocks) ? r.blocks : [],
    linkUrl: r.link_url ?? null,
    linkLabel: r.link_label ?? null,
    // ★모르는 값은 'teacher' 로 — 새 묶음이 생겨도 목록에서 사라지지 않는다
    group: r.group_key === 'friend' ? 'friend' : 'teacher',
    // ★숫자가 아니면 null — 서버가 안 주거나 이상한 값이면 «모른다»(=존댓말)로 떨어진다
    age: Number.isFinite(Number(r.age)) ? Number(r.age) : null,
    roleLabel: (typeof r.role_label === 'string' && r.role_label.trim()) ? r.role_label.trim() : null,
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
  if (_raw && !force) return _raw.map(fromRow);
  try {
    const r = await withTimeout(
      // ★★`enabled` 를 **쿼리에서** 거른다(2026-08-19 실물에서 잡힘).
      //   RLS 의 공개 정책은 `using (enabled)` 라 일반 사용자에겐 안 보이지만,
      //   관리자 정책이 `for all` 이라 **관리자에게는 비활성 상담사까지 보인다**
      //   (정책은 OR 로 합쳐진다). 실제로 준비 중인 「노쎔」이 친구목록에 떠 있었다.
      //   ⇒ RLS 는 '볼 권한'을 정하고, 쿼리는 '지금 보여줄 것'을 정한다. 둘은 다르다.
      supabase.from('consultants').select('id,kind,name,tagline,avatar,cover,specialty,routes,blocks,group_key,sort_order, link_url, link_label, age, role_label, updated_at')
        .eq('enabled', true).order('sort_order'),
      8000,
    );
    if (!r || r.error || !Array.isArray(r.data) || !r.data.length) return _raw ? _raw.map(fromRow) : SEED;
    _raw = r.data;
    return _raw.map(fromRow);
  } catch {
    return _raw ? _raw.map(fromRow) : SEED;   // 네트워크가 없어도 첫 화면은 뜬다
  }
}

/** 지금 캐시된 목록(동기 — 첫 렌더용). 아직 안 읽었으면 씨앗. */
export function consultantsSnapshot(): Consultant[] {
  return _raw ? _raw.map(fromRow) : SEED;
}

/** 한 명 찾기. 없으면 null(라우트가 사라진 상담사를 열었을 때). */
export function findConsultant(id: string): Consultant | null {
  return consultantsSnapshot().find((c) => c.id === id) ?? null;
}

/**
 * 상담가 → 프로필 창에 넣을 값. **여기가 단일 출처다.**
 *
 * ⚠️2026-08-26 — 대화 말풍선의 얼굴을 눌러도 프로필이 열리게 하면서(Boss 요청),
 *   목록과 대화가 **각자 변환**하면 «같은 사람인데 창 내용이 다른» 일이 생긴다.
 *   실제로 이 저장소는 그 실수를 여러 번 했다([[duplicate-ui-single-source]]) — 그래서 함수로 뺐다.
 *
 * @param c       상담가
 * @param element 사진이 없을 때 채울 오행(목록이 쓰던 값과 같아야 얼굴색이 안 바뀐다)
 * @param onTalk  「대화하기」를 눌렀을 때(창을 닫고 그 방으로). 없으면 그 버튼을 안 그린다.
 */
export function toProfileTarget(
  c: Consultant,
  element?: string,
  onTalk?: () => void,
) {
  // ★반환 타입을 **손으로 적지 않는다.** 적는 순간 `group` 같은 좁은 타입('teacher'|'friend')이
  //   넓은 `string` 으로 새어 나가 받는 쪽과 어긋난다(첫 판에서 실제로 그랬다).
  //   추론에 맡기면 `Consultant` 의 타입이 그대로 전달된다.
  return {
    name: c.name, tagline: c.tagline, avatar: c.avatar, cover: c.cover,
    linkUrl: c.linkUrl, linkLabel: c.linkLabel, element,
    // ★기본 프로필(Boss 2026-08-26) — 나이·묶음. 없는 사람은 창이 그 줄을 안 그린다
    age: c.age ?? null, group: c.group, roleLabel: c.roleLabel ?? null,
    ...(onTalk ? { onTalk } : {}),
  };
}
