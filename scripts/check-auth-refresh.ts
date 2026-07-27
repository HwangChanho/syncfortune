// scripts/check-auth-refresh.ts — 토큰 자동 갱신 배선 하네스
// ─────────────────────────────────────────────────────────────────────────
// ★2026-07-27 실제 사고로 만들어졌다(daniel "갑자기 아무것도 동작 안 되고 로그아웃도 안 돼 / 다 터지는데").
//   근인: `autoRefreshToken: true` 만 있고 **React Native 필수인 AppState 배선이 없었다.**
//   자동 갱신은 JS 타이머로 도는데 앱이 백그라운드로 가면 멎는다 → 액세스 토큰(기본 1h)이 만료된 채 복귀 →
//   **모든 인증 호출이 실패**한다. 풀이·코치는 물론 `signOut()` 까지(그것도 호출이라).
//   실측 근거: 사고 구간에 코치 요청이 서버에 0건 도달(코치는 LLM 호출 *전에* 행을 남기는데 그게 없었다).
//   app_logs 가 통째로 끊긴 것도 log_event 가 인증 RPC 라 같이 막힌 것.
//
// ★이 결함의 성질이 하네스를 정당화한다:
//   ①증상이 '네트워크 오류'처럼 보여 원인 추적이 어렵다 ②자주 재현되지 않는다(1시간 방치해야 한다)
//   ③supabase 클라이언트를 리팩터링하다 한 줄 빠지면 조용히 사라진다. 사람이 지킬 수 없으니 기계가 지킨다.
//
// 지키는 것:
//   A1 startAutoRefresh/stopAutoRefresh 가 **둘 다** 배선돼 있다(하나만 있으면 켜지거나 안 꺼진다).
//   A2 AppState 변화에 연결돼 있다(타이머를 포그라운드에서만 돌리는 것이 핵심).
//   A3 autoRefreshToken 이 켜져 있다(배선만 있고 옵션이 꺼져 있으면 무의미).
//   A4 persistSession + storage 어댑터가 있다(세션이 안 남으면 갱신 대상 자체가 없다).
//
// 실행: npm run check:authrefresh
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = 'app/src/lib/supabase.ts';

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

const raw = readFileSync(`${ROOT}${SRC}`, 'utf8');
// 주석을 걷어낸 실제 코드만 본다 — 위 설명 주석에 함수명이 등장하는 건 정상이다.
const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\n[A1] 갱신 타이머 시작·정지가 둘 다 배선됨');
{
  const hasStart = /\bstartAutoRefresh\s*\(/.test(src);
  const hasStop = /\bstopAutoRefresh\s*\(/.test(src);
  if (hasStart && hasStop) ok('startAutoRefresh + stopAutoRefresh');
  else bad(`누락: ${!hasStart ? 'startAutoRefresh ' : ''}${!hasStop ? 'stopAutoRefresh' : ''} — 백그라운드에서 토큰이 만료된 채 복귀하면 모든 인증 호출이 실패한다`);
}

console.log('\n[A2] AppState 변화에 연결됨(포그라운드에서만 갱신)');
{
  if (!/AppState/.test(src)) bad('AppState 를 쓰지 않는다 — 갱신 타이머가 앱 상태와 무관하게 돈다(= 백그라운드에서 멎는 문제 그대로)');
  else if (!/AppState\.addEventListener\s*\(\s*['"]change['"]/.test(src)) bad("AppState.addEventListener('change', …) 이 없다 — 상태 변화에 반응하지 않는다");
  else ok("AppState 'change' 구독");
  // 시작 시점 상태 반영(콜드런치에서 한 번도 start 가 안 불리는 구멍 방지)
  if (/AppState\.currentState/.test(src)) ok('시작 시점 상태 반영(currentState)');
  else bad('AppState.currentState 로 초기 1회를 적용하지 않는다 — 콜드런치에서 갱신 타이머가 아예 안 켜질 수 있다');
}

console.log('\n[A3] autoRefreshToken 활성');
{
  if (/autoRefreshToken:\s*true/.test(src)) ok('autoRefreshToken: true');
  else bad('autoRefreshToken 이 true 가 아니다 — 배선이 있어도 갱신이 일어나지 않는다');
}

console.log('\n[A4] 세션 지속 + 저장소 어댑터');
{
  if (/persistSession:\s*true/.test(src)) ok('persistSession: true');
  else bad('persistSession 이 true 가 아니다 — 재실행마다 로그아웃된다');
  if (/storage:/.test(src)) ok('storage 어댑터 지정');
  else bad('storage 어댑터가 없다 — 네이티브에서 세션이 저장되지 않는다');
}

console.log(fail ? `\n❌ check:authrefresh 실패 ${fail}건` : '\n✅ check:authrefresh 통과 — 갱신 시작/정지·AppState 배선·옵션·세션저장 OK');
process.exit(fail ? 1 : 0);
