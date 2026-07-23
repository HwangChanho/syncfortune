// app/src/lib/core/testMode.ts — 클라 테스트모드 상태 + readings 목업 필터
// ─────────────────────────────────────────────────────────────────────────
// 왜 이 파일이 있나(daniel 07-23 신고 대응):
//   테스트모드에서 interpret 가 저장한 목업 풀이(readings.tier='mock')는 *구조/레이아웃 표시용*이다
//   (Option C 서버생성 16영역이 화면 공백 없이 뜨게 하려고 저장). 서버(interpret)는 이미 캐시 서빙 시
//   tier!=='mock' 로 걸러 실모드엔 목업을 안 준다. 그러나 **클라의 direct readings 로드**(today·month·
//   career·love·홈배너·ReadingScreen 등 13곳)는 tier 필터가 없어, 테스트모드를 꺼도 목업이 실제
//   콘텐츠로 그대로 서빙됐다(신고: "【daily_…·headline】 목업 자리표시 …" 노출).
//
// 해결(단일 책임·유지보수):
//   ① 클라에 test_mode 를 캐시하는 전용 플래그(setClientTestMode/isTestMode).
//      - ads.ts 의 adTestMode() 를 재사용하지 않는 이유: 그건 VERIFY_ADS(광고검증 상수)와 OR 로 묶여 있어
//        '광고 디버그'와 '목업 노출'이 뒤엉킨다(단일 책임 위배). test_mode 소스는 profiles.test_mode 하나로
//        두고, 로그인/세션변경(_layout) + 관리자 토글(admin) 에서 이 플래그에 그대로 동기화한다.
//      - 캐시(모듈 전역)로 두는 이유: readings 로드 13곳마다 profiles 를 매번 재조회하면 지연·부하.
//        세션당 1회 셋(ads/logger 컨텍스트와 같은 지점·같은 라이프사이클)이면 충분하다.
//   ② excludeMock(query): 테스트모드 OFF 일 때만 `.neq('tier','mock')` 를 덧붙이는 쿼리 래퍼.
//      ON 이면 목업을 그대로 남긴다(generate_set 16영역 구조표시가 목업 행을 읽어야 공백이 안 남).
//
// ★NULL 안전: readings.tier 는 NOT NULL DEFAULT 'free'(migration 0001, 라이브 확인 tier_nullable=NO·null_rows=0).
//   실 풀이는 'paid'(또는 'free'), 목업만 'mock' → `.neq('tier','mock')` 는 실 행을 절대 누락시키지 않는다
//   (Postgres 에서 NULL <> 'mock' = NULL=falsy 라 NULL 행이 있으면 사라지지만, tier 는 NULL 이 불가능).
// ─────────────────────────────────────────────────────────────────────────

// 클라 테스트모드 캐시 — profiles.test_mode 를 로그인/세션변경·관리자 토글 시 여기에 반영.
//   기본 false: 미로그인/일반 유저는 항상 실모드(목업 제외). test_mode 는 서버 RPC 로만 켤 수 있어
//   프로덕션 유저는 이 값이 false 로 고정 → 목업이 새어나갈 경로가 없다.
let clientTestMode = false;

/** 클라 테스트모드 설정 — _layout(세션 변경) · admin(토글)에서 profiles.test_mode 로 호출. */
export function setClientTestMode(v: boolean): void {
  clientTestMode = v;
}

/** 현재 클라 테스트모드 여부(readings 목업 필터 판정에 사용). */
export function isTestMode(): boolean {
  return clientTestMode;
}

/**
 * readings 목업 필터 래퍼 — 테스트모드 OFF 면 `.neq('tier','mock')` 를 덧붙여 목업(tier='mock') 행을 제외한다.
 *   ON 이면 쿼리를 그대로 반환(목업 유지 = generate_set 16영역 구조표시 보존).
 *
 * 사용법: `.select(...).eq(...)` 필터 체인을 감싼 뒤 `.maybeSingle()`/`.then()`/await 를 이어서 붙인다.
 *   const { data } = await excludeMock(supabase.from('readings').select('content').eq('chart_id', id)).maybeSingle();
 *
 * 타입: 인자로 받은 쿼리빌더 타입 Q 를 그대로 반환하므로 이후 체이닝·await 의 타입이 온전히 유지된다.
 *   `.neq` 호출부만 supabase 제네릭(컬럼명 리터럴 제약)과의 마찰을 피하려 any 캐스팅(런타임엔 모든
 *   PostgrestFilterBuilder 에 `.neq` 존재 — select/eq/like/in 이후 항상 필터빌더).
 * @param q  `.select()` 이후의 readings 쿼리빌더(필터 체인 도중/끝)
 * @returns  OFF → `.neq('tier','mock')` 가 붙은 동일 빌더 / ON → 원본 빌더
 */
export function excludeMock<Q>(q: Q): Q {
  return isTestMode() ? q : ((q as any).neq('tier', 'mock') as Q);
}
