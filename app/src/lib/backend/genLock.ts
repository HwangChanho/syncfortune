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

// 진행 중인 (콘텐츠×명식) 키 → 획득 시각(ms). 모듈 레벨이라 컴포넌트 마운트/언마운트와 무관하게 유지된다.
const active = new Map<string, number>();

// ★stale 타임아웃(daniel 07-11: '쿠폰으로 열기→앱 멈춤' 근본): interpret 이 느리거나(실측 27~34초) 응답 없이
//   hang 하면 generate 의 finally(releaseGen)가 안 돌아 락이 *영구 누수* → 이후 탭마다 acquireGen 실패 →
//   135초 캐시 폴링만 반복(멈춤). 획득 후 이 시간이 지난 락은 '죽은 것'으로 보고 재획득을 허용해 영구 멈춤을 차단한다.
//   값은 캐시 폴링(135초)보다 넉넉히 위 → 정상적인 느린 생성엔 절대 개입하지 않고, 진짜 누수만 회수(서버 consume_credit
//   가 이중차감을 막으므로 만에 하나 겹쳐도 과금 안전).
const STALE_MS = 150000;

/**
 * 생성 잠금 획득.
 * @param key `${kind}:${chartId}` 형태의 고유 키(콘텐츠·명식·필요 시 기간/관계 하위키 포함).
 * @returns 획득 성공(true)이면 호출자가 반드시 finally 에서 releaseGen(key) 로 해제해야 한다.
 *          이미 같은 키가 *살아있는* 생성 중이면 false — 호출자는 생성하지 말고 즉시 반환(2차 LLM 호출 차단).
 *          단, STALE_MS 초과로 죽은(누수) 락이면 회수하고 true(영구 멈춤 방지).
 */
export function acquireGen(key: string): boolean {
  const acquiredAt = active.get(key);
  if (acquiredAt !== undefined && Date.now() - acquiredAt < STALE_MS) return false; // 살아있는 락
  active.set(key, Date.now()); // 신규 획득 or 누수 락 회수
  return true;
}

/** 생성 잠금 해제 — 완료·중단·오류 모두 finally 에서 호출(누수 방지). */
export function releaseGen(key: string): void {
  active.delete(key);
}

/** 진행 중 여부 조회(옵션 — UI 가드 등). 상태 변경 없음. stale 락은 '진행 아님'으로 본다. */
export function isGenActive(key: string): boolean {
  const acquiredAt = active.get(key);
  return acquiredAt !== undefined && Date.now() - acquiredAt < STALE_MS;
}
