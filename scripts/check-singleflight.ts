#!/usr/bin/env tsx
// scripts/check-singleflight.ts — 통변 생성 **단일화** 불변식 하네스. daniel 2026-08-01.
// ─────────────────────────────────────────────────────────────────────────
// 왜 만들었나 — 추측이 아니라 **실측으로 확인된 돈 유출**이다.
//   api_usage 집계(2026-07-29~30): 자미 12궁이 **전부 2회씩**, 사주 16영역도 대부분 2회
//   (성격내면은 4회) LLM 호출됐다. 호출 간격 2~12초 = 나란히 도는 두 워커.
//   사용자 과금은 언락(claimUnlock)이 막았지만 **우리 API 비용이 두 배로 나갔다.**
//
// 기존 방어가 왜 전부 뚫렸나 — 셋 다 '동시'를 못 막는 종류였다:
//   · 앱 genLock          기기 메모리다. 화면 재진입·앱 재시작·다른 기기면 존재하지 않는다.
//   · generate_set dedupe '읽고 → 판단하고 → 쓰기'였다. 동시 둘이 같은 값을 읽고 둘 다 시작한다.
//   · interpret 캐시확인   '없으면 만든다'였다. 동시 둘이면 **둘 다 없다고 본다**.
//   ⇒ 트리거를 줄이는 것만으로는 안 된다. 마지막 길목에 **중재자**가 있어야 한다.
//
// ▶ 강제하는 불변식
//   R1 interpret 에 gen_locks 선점/해제 헬퍼가 있다(acquireGenLock · releaseGenLock · awaitPeerReading).
//   R2 선점에 실패한 요청은 **LLM 으로 폴백하지 않는다** — 진 쪽이 만들면 그게 이중호출이다.
//   R3 락을 잡은 뒤의 모든 종료 경로가 해제한다(정상·목업·예외). 안 놓으면 그 영역이 3분 잠긴다.
//   R4 generate_set 의 중복 차단은 **원자적**이다(claim_gen_job RPC) — read-then-write upsert 금지.
//   R5 llm_busy 는 실패가 아니다 — generate_set 이 이걸로 세트를 죽이면 안 되고,
//      앱 길목(interpretResult)이 'busy' 로 따로 분류해야 한다(오류 문구 → 사용자 재시도 → 또 트리거).
//   R6 클라 runAll 의 생성 트리거는 **위임·폴백 양쪽 다** genLock 을 지난다.
//
// ⚠️이 하네스는 코드 구조만 본다. 락이 **정말 무는지**는 DB 로 실측했다(2026-08-01, 13/13 통과):
//   gen_locks 중복 삽입 0행 · claim_gen_job 두 번째 호출 'busy' · stale 이어받기 시 done 보존.
//   재실측이 필요하면 그 SQL 을 다시 돌릴 것(LLM 무관 = 비용 0).
//
// 사용: npm run check:singleflight   (위반 있으면 exit 1)
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const INTERPRET = 'supabase/functions/interpret/index.ts';
const GENSET = 'supabase/functions/generate_set/index.ts';
const RESULT = 'app/src/lib/backend/interpretResult.ts';
const READING = 'app/src/screens/ReadingScreen.tsx';

const read = (p: string) => readFileSync(p, 'utf8');
const problems: string[] = [];
const notes: string[] = [];

// ── R1 · R2 · R3 : interpret 의 생성 락 ─────────────────────────────────
{
  const src = read(INTERPRET);

  // R1 헬퍼 존재
  //   ⚠️`includes('acquireGenLock')` 로 보면 안 된다 — 이름이 `acquireGenLockXX` 로 바뀌어도 통과한다
  //     (음성 테스트에서 실제로 안 물었다). **함수 선언 형태 그대로** 매칭한다.
  for (const fn of ['acquireGenLock', 'releaseGenLock', 'awaitPeerReading']) {
    if (!new RegExp(`async function ${fn}\\s*\\(`).test(src)) {
      problems.push(`${INTERPRET}: 헬퍼 없음 — async function ${fn}(\n      → 생성 단일화가 통째로 사라졌습니다. 자미 12궁이 다시 2배로 호출됩니다.`);
    }
  }

  // R1 실제 호출(정의만 있고 안 부르면 무의미)
  if (!/await\s+acquireGenLock\(/.test(src)) {
    problems.push(`${INTERPRET}: acquireGenLock 을 **부르지 않습니다**(정의만 있음).\n      → 길목에 중재자가 없으면 동시 요청이 각자 LLM 을 호출합니다.`);
  }

  // R2 진 쪽이 LLM 으로 폴백하지 않는지 — 선점 실패 분기가 반드시 return 으로 끝나야 한다
  const lose = src.indexOf('if (!won)');
  if (lose < 0) {
    problems.push(`${INTERPRET}: 선점 실패(!won) 분기가 없습니다.\n      → 진 쪽도 생성으로 흘러가면 그게 정확히 이중호출입니다.`);
  } else {
    const block = src.slice(lose, lose + 1600);
    // ⚠️'return 이 하나라도 있나'로 보면 안 된다 — 앞쪽 `if (peer) return` 하나 때문에
    //   정작 마지막 탈출구를 `void` 로 바꿔도 통과했다(음성 테스트에서 실제로 안 물었다).
    //   **두 탈출구를 각각** 확인한다: ①동료 결과 수령 ②그것도 없을 때의 busy 응답.
    if (!/if\s*\(peer\)\s*return\s+Response\.json/.test(block)) {
      problems.push(`${INTERPRET}: 선점 실패 시 동료 결과를 받아 **반환**하지 않습니다.\n      → 기다려 놓고 값을 안 돌려주면 사용자는 빈 화면을 봅니다.`);
    }
    if (!/return\s+Response\.json\(\{\s*\n?\s*unavailable:\s*true,\s*code:\s*'llm_busy'/.test(block)) {
      problems.push(
        `${INTERPRET}: 선점 실패의 마지막 탈출구가 return 이 아닙니다(llm_busy 응답).\n` +
        `      → 진 쪽이 아래 생성 코드로 떨어지면 그게 정확히 이중호출입니다.`,
      );
    }
  }

  // R3 해제 — 잡은 뒤 나가는 경로가 전부 놓는지(정상 return · 목업 return · catch)
  const releases = (src.match(/releaseGenLock\(/g) ?? []).length - 1; // 정의부 1개 제외
  // ★규칙 개정(2026-08-05 목업 정책 · 08-06 보정): 목업 반환은 **락 선점보다 앞**이다.
  //   ⚠️08-06 변경 — 목업도 **결제 게이트는 지난다**(daniel "테스트 모드일 때도 운 차감이 보여야").
  //     즉 지금 스킵되는 것은 '락·저장'이지 '차감'이 아니다. 락 기준 위치 불변식만 그대로 유효하다.
  //   그러므로 '목업 해제' 는 더 이상 존재하지 않는다 — 대신 위치 불변식을 검사한다:
  //   목업 return 이 acquireGenLock 보다 뒤에 있으면(락을 물고 목업 반환) 3분 멈춤이 되살아난다.
  const mockPos = src.indexOf("Response.json({ source: 'mock'");
  const lockPos = src.indexOf('acquireGenLock(', src.indexOf('function acquireGenLock') + 30); // 정의부 다음 첫 호출
  if (mockPos >= 0 && lockPos >= 0 && mockPos > lockPos) {
    bad(`${INTERPRET}: 목업 반환이 락 선점(acquireGenLock) 뒤에 있습니다 — 락을 물고 나가면 3분 멈춤.`);
  }
  if (releases < 2) {
    problems.push(
      `${INTERPRET}: releaseGenLock 호출이 ${releases}곳뿐입니다(최소 2: 정상 완료·예외 — 목업은 락 이전 반환).\n` +
      `      → 한 경로라도 빠지면 그 영역이 3분간 "만들어지는 중"으로 굳어 재시도가 막힙니다(멈춤).`,
    );
  }
  if (!/catch \(e\)[\s\S]{0,1400}releaseGenLock\(/.test(src)) {
    problems.push(`${INTERPRET}: catch 에서 락을 놓지 않습니다.\n      → 생성이 실패했는데 락이 남으면 사용자가 다시 눌러도 llm_busy 만 돌아옵니다.`);
  }
  notes.push(`[서버] ${INTERPRET} — 선점 1 · 해제 ${releases}곳`);
}

// ── R4 : generate_set 의 원자적 선점 ────────────────────────────────────
{
  const src = read(GENSET);
  if (!/rpc\(\s*['"]claim_gen_job['"]/.test(src)) {
    problems.push(`${GENSET}: claim_gen_job RPC 를 쓰지 않습니다.\n      → 중복 차단이 read-then-write 로 되돌아가면 동시 요청 둘이 모두 루프를 시작합니다(실측된 사고).`);
  }
  // read-then-write 회귀 감지: 상태를 읽고 그 판단으로 gen_jobs 를 upsert 하던 옛 구조
  if (/gen_jobs['"]\)\s*\.upsert\(/.test(src)) {
    problems.push(`${GENSET}: gen_jobs 를 직접 upsert 합니다(옛 read-then-write 구조).\n      → 선점은 claim_gen_job 한 문장으로만 하십시오.`);
  }
  // R5 llm_busy 를 실패로 오인하면 잘 도는 세트를 죽인다
  //   ⚠️`/llm_busy/` 로만 보면 **주석에 적힌 단어**가 통과시킨다(음성 테스트에서 실제로 안 물었다).
  //     실패 판정식에서 busy 를 **제외하는 표현** 자체를 확인한다.
  if (!/code\s*!==\s*'llm_busy'/.test(src)) {
    problems.push(
      `${GENSET}: 실패 판정에서 llm_busy 를 제외하지 않습니다(code !== 'llm_busy').\n` +
      `      → llm_busy 는 unavailable:true 를 공유하므로, 거르지 않으면 **정상 진행 중인 잡을 error 로 죽입니다.**`,
    );
  }
  notes.push(`[서버] ${GENSET} — 원자적 선점(claim_gen_job) · llm_busy 예외 처리`);
}

// ── R5 : 앱 길목이 busy 를 실패와 구분 ──────────────────────────────────
{
  const src = read(RESULT);
  //   ⚠️단어가 아니라 **판정식**을 본다 — 주석의 'llm_busy' 가 통과시켰다(음성 테스트).
  if (!/code\s*===\s*'llm_busy'/.test(src) || !/kind:\s*'busy'/.test(src)) {
    problems.push(
      `${RESULT}: llm_busy 를 별도(kind:'busy')로 분류하지 않습니다.\n` +
      `      → 14개 화면이 이 헬퍼로 응답을 정규화합니다. 여기서 '실패'로 뭉개면 전 화면이\n` +
      `        "생성이 어려워요"를 띄우고, 사용자는 실패한 줄 알고 다시 눌러 또 트리거합니다.`,
    );
  }
  notes.push(`[클라] ${RESULT} — busy ≠ 실패(길목 1곳에서 14화면 커버)`);
}

// ── R6 : 클라 runAll 이 위임 경로에서도 잠그는지 ────────────────────────
{
  const src = read(READING);
  const i = src.indexOf('async function runAll(');
  const body = i < 0 ? '' : src.slice(i, src.indexOf('async function runAllLocal'));
  if (!body) {
    problems.push(`${READING}: runAll 을 찾지 못했습니다(구조 변경?).`);
  } else {
    const acq = body.indexOf('acquireGen(');
    const invoke = body.indexOf(`invoke('generate_set'`);
    if (acq < 0) {
      problems.push(`${READING}: runAll 에 acquireGen 이 없습니다.\n      → 같은 순간 몰리는 트리거(워치독·AppState 복귀·자동생성·버튼)가 각각 위임을 날립니다.`);
    } else if (invoke >= 0 && acq > invoke) {
      problems.push(
        `${READING}: acquireGen 이 generate_set 위임 **뒤**에 있습니다.\n` +
        `      → 이게 원래 구멍이었습니다: 잠금이 catch(폴백) 안에만 있어 정상 경로는 무잠금이었습니다.`,
      );
    }
    if (!/finally\s*\{[\s\S]{0,500}releaseGen\(/.test(body)) {
      problems.push(`${READING}: runAll 이 finally 에서 releaseGen 하지 않습니다.\n      → 예외로 빠져나가면 락이 남아 이후 '생성'이 조용히 무시됩니다(멈춤).`);
    }
  }
  // 재진입 시 '생성' 버튼 깜빡임 방지 — 서버 답(jobLoaded) 전에 단정하지 않는다
  if (!/const showStart = jobLoaded &&/.test(src)) {
    problems.push(
      `${READING}: showStart 가 jobLoaded 를 기다리지 않습니다.\n` +
      `      → 재진입 직후 서버에 묻기도 전에 '생성' 버튼이 떠서, 사용자가 그걸 누르면\n` +
      `        이미 도는 생성 위에 또 트리거가 걸립니다(daniel 신고 "로딩화면 초기화").`,
    );
  }
  notes.push(`[클라] ${READING} — 위임·폴백 공통 잠금 + jobLoaded 게이트`);
}

console.log(`\n🔒 통변 생성 단일화(single-flight) 불변식`);
notes.forEach((n) => console.log('   ' + n));

if (problems.length) {
  console.error(`\n❌ 위반 ${problems.length}건\n`);
  problems.forEach((p) => console.error('   ' + p + '\n'));
  console.error('   ※ 규칙: (명식×영역×언어) 당 LLM 은 동시에 하나. 진 쪽은 기다린다 — 절대 만들지 않는다.');
  console.error('     실측 근거: 2026-07-30 자미 12궁 전부 2회 호출(api_usage). 사용자 과금이 아니라 우리 API 비용이 샜다.\n');
  process.exit(1);
}
console.log(`   ✅ 생성 경로가 단일화돼 있습니다(선점·해제·busy 구분·클라 잠금).\n`);
