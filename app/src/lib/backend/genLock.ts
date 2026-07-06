// app/src/lib/backend/genLock.ts — 콘텐츠 풀이 생성 중복 잠금(모듈 레벨·크로스마운트)
// ─────────────────────────────────────────────────────────────────────────
// ReadingScreen.tsx 의 `genActive: Set<string>`(:80) 패턴을 *단일 유료 콘텐츠 화면*에서 공유(DRY).
//   대상: love · career · newyear · lifegraph · gaeun · SpecialContentScreen · CompatScreen · TimelineScreen.
//
// 왜(문제):
//   풀이 생성 루프(invoke)는 컴포넌트 언마운트와 무관하게 계속 돈다(서버 Edge 가 결과를 캐시). 그래서
//   "백그라운드 생성 중 → 홈으로 나가기 → 재진입" 하면 두 번째 마운트가 캐시가 아직 비어 있는 것을 보고
//   *또 generate 를 호출* → 같은 명식·같은 콘텐츠에 대해 LLM 이 이중 호출되어 *이중 과금*이 난다(daniel).
//
// 해결:
//   키(`${kind}:${chartId}` 계열)로 이미 생성 중이면 두 번째 진입은 생성하지 않는다(자물쇠도 안 띄우고 캐시만).
//   ReadingScreen 이 자기 모듈에 둔 Set 과 동일한 계약 — 다만 여러 화면이 공유하도록 util 로 뺐다.
//   ★ReadingScreen(saju/ziwei) 은 자체 Set 을 그대로 유지(건드리지 않음). 키 네임스페이스(kind)가 달라 충돌 없음.
//
// 사용:
//   import { acquireGen, releaseGen } from '../lib/backend/genLock';
//   if (!acquireGen(key)) return;               // 이미 생성 중 → 2차 생성 차단
//   try { /* …invoke·setReading… */ } finally { releaseGen(key); }  // 완료·중단·오류 모두 해제
// ─────────────────────────────────────────────────────────────────────────

// 진행 중인 (콘텐츠×명식) 키 집합. 모듈 레벨이라 컴포넌트 마운트/언마운트와 무관하게 유지된다.
const active = new Set<string>();

/**
 * 생성 잠금 획득.
 * @param key `${kind}:${chartId}` 형태의 고유 키(콘텐츠·명식·필요 시 기간/관계 하위키 포함).
 * @returns 획득 성공(true)이면 호출자가 반드시 finally 에서 releaseGen(key) 로 해제해야 한다.
 *          이미 같은 키가 생성 중이면 false — 호출자는 생성하지 말고 즉시 반환할 것(2차 LLM 호출 차단).
 */
export function acquireGen(key: string): boolean {
  if (active.has(key)) return false;
  active.add(key);
  return true;
}

/** 생성 잠금 해제 — 완료·중단·오류 모두 finally 에서 호출(누수 방지). */
export function releaseGen(key: string): void {
  active.delete(key);
}

/** 진행 중 여부 조회(옵션 — UI 가드 등). 상태 변경 없음. */
export function isGenActive(key: string): boolean {
  return active.has(key);
}
