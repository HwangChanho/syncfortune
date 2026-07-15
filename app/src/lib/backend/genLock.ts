// app/src/lib/backend/genLock.ts — 콘텐츠 풀이 생성 중복 잠금(모듈 레벨·크로스마운트)
// ─────────────────────────────────────────────────────────────────────────
// 생성 중복 잠금을 *모든 유료 콘텐츠 화면*이 공유(DRY).
//   대상: love · career · newyear · lifegraph · gaeun · SpecialContentScreen · CompatScreen · TimelineScreen
//        · ReadingScreen(saju/ziwei — daniel 07-16부터 통일, 아래 참고).
//
// 왜(문제):
//   풀이 생성 루프(invoke)는 컴포넌트 언마운트와 무관하게 계속 돈다(서버 Edge 가 결과를 캐시). 그래서
//   "백그라운드 생성 중 → 홈으로 나가기 → 재진입" 하면 두 번째 마운트가 캐시가 아직 비어 있는 것을 보고
//   *또 generate 를 호출* → 같은 명식·같은 콘텐츠에 대해 LLM 이 이중 호출되어 *이중 과금*이 난다(daniel).
//
// 해결:
//   키(`${kind}:${chartId}` 계열)로 이미 생성 중이면 두 번째 진입은 생성하지 않는다(자물쇠도 안 띄우고 캐시만).
//   ★daniel 07-16: ReadingScreen(saju/ziwei) 도 이 모듈로 통일했다(그동안 예외였던 자체
//   `genActive: Set<string>` 제거 — 감사로 최고 위험 확인). 자체 Set 은 타임스탬프가 없어 Edge interpret
//   invoke 가 hang 하면 finally(release)가 영영 안 돌아 락이 *세션 내내* 누수 → 이후 "생성"을 눌러도 조용히
//   return(사주 ₩19,900·자미 ₩14,900 이 먹통처럼 보임, 앱 완전 종료로만 풀림). 아래 STALE_MS(150초)로
//   이 화면도 죽은 락을 자동 회수한다.
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
