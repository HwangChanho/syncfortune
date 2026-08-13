// scripts/check-genrecover.ts — **오래 걸리는 생성 화면은 복귀 시 결과를 주워야 한다**
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-12: *"궁합 풀이 했는데 95프로에서 멈췄어"*
//
// ■ 실측으로 규명된 사고 (app_logs · readings · api_usage, 2026-08-11 17:00~17:02 UTC)
//   17:00:27  `/compat` 진입 → 17:00:38 생성 시작
//   17:01:31  **app_background** — 50초 기다리다 앱을 나갔다
//   17:01:35  `readings` 에 `compat_love_壬午甲辰丙寅辛卯` **저장 완료** ← 서버는 성공했다
//   17:02:01  app_active 복귀 — 그런데 **화면은 여전히 95%**
//   `gen_locks` 0행(잠금 잔존 아님) · `gen_jobs` 최신 행 없음
//
// ■ 근본 원인
//   앱이 백그라운드로 가면 진행 중이던 fetch 가 죽는다. 서버는 개의치 않고 끝까지 만들어 **저장한다.**
//   복귀했을 때 **아무도 그 결과를 주우러 가지 않으면** 사용자에겐 "운을 쓰고 결과를 못 봤다"가 된다.
//   ⇒ 돈이 걸린 사고다([[double-charge-unlock-claim]] 계열).
//
// ★결정적 비대칭: `ReadingScreen` 은 예전부터 AppState 워치독이 있었고 **`CompatScreen` 에만 없었다.**
//   그래서 궁합만 깨졌고, 화면을 하나 더 만들면 또 빠뜨린다 — 기억으론 못 막으니 기계가 본다.
//
// ■ 무엇을 요구하는가
//   "LLM 생성을 **기다리는** 화면"이면 **AppState 'active' 복귀 시 캐시 재조회** 코드가 있어야 한다.
//   판정은 [[harness-judge-expression-not-name]] 교훈대로 **이름이 아니라 표현식**으로 한다 —
//   `AppState` 를 import 만 하고 안 쓰는 것으로는 통과되지 않는다.
//
// 실행: npm run check:genrecover
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';

/**
 * 검사 대상 — **오래 걸리는 서버 생성을 기다리는 화면**.
 * 새 생성 화면을 만들면 여기 추가한다(추가를 잊으면 이 하네스가 소용없으므로 아래 §자동탐지가 함께 운다).
 */
const WATCHED = [
  { file: 'app/src/screens/CompatScreen.tsx', why: '궁합 생성 — 실측 57초' },
  { file: 'app/src/screens/ReadingScreen.tsx', why: '사주·자미 풀이 생성 — 다건' },
  { file: 'app/src/screens/TimelineScreen.tsx', why: '인생 타임라인 — 유료(tier: paid) · 이 하네스의 §자동탐지가 찾아냈다' },
  // ★2026-08-13: 자동탐지 범위를 넓히자마자 드러난 8개(전부 expo-router 경로라 그동안 안 보였다).
  { file: 'app/src/app/(app)/love.tsx', why: '애정 흐름 — 실측 87~103초(가장 무겁다)' },
  { file: 'app/src/app/(app)/career.tsx', why: '직업 딥리포트 — 유료' },
  { file: 'app/src/app/(app)/gaeun.tsx', why: '개운 — 유료' },
  { file: 'app/src/app/(app)/lifegraph.tsx', why: '인생 그래프 — 유료' },
  { file: 'app/src/app/(app)/newyear.tsx', why: '신년운 — 유료(category 가 newyear_YYYY 동적)' },
];

/**
 * 면제 — **결과를 `readings` 에 명식별로 캐시하지 않는** 화면.
 * 복귀 회수의 전제(= chart_id × category 로 다시 읽기)가 성립하지 않으므로 이 하네스의 대상이 아니다.
 * ⚠️사유 없이 넣지 말 것. 여기 들어가면 영영 검사되지 않는다.
 */
const EXEMPT = [
  { file: 'app/src/app/(app)/dream.tsx', why: 'chartless — `dream_readings`(키워드 기준) 라 명식별 회수가 성립하지 않는다' },
  { file: 'app/src/app/(app)/taemong.tsx', why: 'chartless — 명식 없이 꿈 텍스트로만 생성' },
  { file: 'app/src/app/(app)/community.tsx', why: '서버 생성을 기다리지 않는다(DB 조회 없음)' },
];

/** 생성 대기 화면임을 알아보는 표시 — 이게 있는데 WATCHED 에 없으면 "빠뜨렸다"고 본다. */
const GEN_MARK = /UnlockOverlay|setGenProgress/;

const src = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);

/**
 * 복귀 회수 코드가 **실제로 동작하는 형태**로 있는지 본다.
 * 요구: ①AppState 변경 구독 ②'active' 판정 ③그 안에서 캐시/결과 재조회 호출
 * — 셋이 **같은 구독 블록 안**에 있어야 한다(따로 있으면 우연이다).
 */
function hasRecovery(code: string): { ok: boolean; why: string } {
  // ★공통 훅(`useResumeReading`)을 쓰는 화면도 인정한다 — 동작은 동일하고, 8곳에 같은 코드를 복사하는 것보다
  //   한 곳을 고치는 편이 안전하다([[duplicate-ui-single-source]]).
  //   ⚠️단 **훅 이름만 보고 통과시키지 않는다** — 훅 파일이 실제로 AppState 'active' 를 구독하는지 확인한다
  //   ([[harness-judge-expression-not-name]]: 이름이 아니라 동작으로 판정).
  if (/useResumeReading\s*\(/.test(code)) {
    const hookSrc = src('app/src/lib/backend/useResumeReading.ts');
    if (!hookSrc) return { ok: false, why: 'useResumeReading 을 쓰는데 훅 파일이 없습니다' };
    if (!/AppState\.addEventListener\('change'/.test(hookSrc) || !/['"]active['"]/.test(hookSrc)) {
      return { ok: false, why: 'useResumeReading 훅이 AppState active 를 구독하지 않습니다(속 빈 훅)' };
    }
    return { ok: true, why: '공통 훅 useResumeReading 으로 복귀 회수' };
  }

  const sub = code.indexOf("AppState.addEventListener('change'");
  if (sub < 0) return { ok: false, why: "AppState.addEventListener('change') 구독이 없습니다" };
  // 구독 블록 = 등록 지점부터 넉넉히 잡되(콜백이 길 수 있다) 다음 구독 전까지
  const next = code.indexOf("AppState.addEventListener('change'", sub + 10);
  const block = code.slice(sub, next > 0 ? next : Math.min(code.length, sub + 2200));
  if (!/['"]active['"]/.test(block)) return { ok: false, why: "구독은 있으나 'active'(복귀) 를 가리지 않습니다" };
  // 재조회 = 저장된 결과를 다시 읽어오는 호출. 이름이 달라도 되게 **패턴**으로 본다.
  const refetch = /(load|fetch|reload)[A-Za-z]*\s*\(|refetch\s*\(|tick\s*\(/.test(block);
  if (!refetch) return { ok: false, why: "'active' 복귀 시 **결과 재조회 호출이 없습니다**(구독만 있음)" };
  return { ok: true, why: '' };
}

let bad = 0;
console.log('\n🔁 생성 대기 화면이 복귀 시 결과를 주워 오는가\n');

for (const w of WATCHED) {
  const code = src(w.file);
  if (!code) { console.log(`   ❌ ${w.file} — 파일이 없습니다(경로가 바뀌었으면 WATCHED 를 고치세요)`); bad++; continue; }
  const r = hasRecovery(code);
  if (r.ok) { console.log(`   ✅ ${w.file.split('/').pop()} — ${w.why}`); continue; }
  bad++;
  console.log(`   ❌ ${w.file.split('/').pop()} — ${r.why}`);
  console.log(`      ${w.why}`);
  console.log(`      ⇒ 앱이 백그라운드로 가면 fetch 가 죽습니다. **서버는 계속 만들어 저장합니다.**`);
  console.log(`         복귀 시 캐시를 다시 읽지 않으면 사용자는 '운을 쓰고 결과를 못 본' 상태가 됩니다.`);
  console.log(`         AppState 'active' 에서 결과 재조회를 거세요(읽기 전용이라 재결제·재생성 없음).`);
}

// §자동탐지 — WATCHED 에 **추가하는 걸 잊은** 생성 화면을 찾는다(하네스가 스스로 갱신을 요구한다)
//
// ★★2026-08-13: 이 자동탐지가 **`app/src/screens` 만 훑고 있었다.**
//   앱 화면의 절반 이상은 expo-router 경로인 `app/src/app/(app)/` 에 있는데 거기를 안 봤다 —
//   그래서 하네스가 3개만 검사하고 **"통과"라고 말하는 동안 7개가 뚫려 있었다**
//   (career·dream·gaeun·lifegraph·love·newyear·taemong — 전부 유료 생성 화면).
//   daniel 이 "연애 풀이 로딩창이 도중에 사라짐"을 보고했는데 하네스는 초록불이었다.
//   ⇒ **탐지 범위가 좁은 하네스는 거짓 안심을 준다.** 통과보다 위험하다.
//   ⚠️새 화면 디렉터리가 생기면 여기에 추가할 것. 목록은 코드가 아니라 **파일시스템**이 정하게 둔다.
const SCAN_DIRS = ['app/src/screens', 'app/src/app/(app)'];
const missed: string[] = [];
for (const dir of SCAN_DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    const p = `${dir}/${f}`;
    if (!f.endsWith('.tsx') || WATCHED.some((w) => w.file === p) || EXEMPT.some((e) => e.file === p)) continue;
    const code = src(p);
    if (code && GEN_MARK.test(code)) missed.push(p);
  }
}
if (missed.length) {
  bad += missed.length;
  console.log('\n   ⚠️ 생성 대기 화면으로 보이는데 검사 목록에 없습니다:');
  for (const m of missed) console.log(`      ❌ ${m} — scripts/check-genrecover.ts 의 WATCHED 에 추가하세요`);
}

console.log(bad ? '\n❌ check:genrecover 실패\n' : '\n✅ check:genrecover 통과 — 생성 대기 화면이 복귀 시 결과를 회수함\n');
if (bad) process.exitCode = 1;
