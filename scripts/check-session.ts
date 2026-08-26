// scripts/check-session.ts — **로그인 세션 수명이 정해져 있는지** 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"로그인 세션은 최대 12시간 유지로 하자"*
//
// ■ ★실측으로 알게 된 것 — 고칠 곳은 **앱이 아니라 서버**였다
//   `supabase.ts` 의 `persistSession`·`autoRefreshToken` 은 «저장하고 갱신할까» 를 정할 뿐,
//   **세션이 언제 끝나는지는 GoTrue 서버 설정**(`sessions_timebox`)이 정한다.
//   조사 전 값: `sessions_timebox: 0` = **상한 없음(무기한)**.
//   ⇒ 클라이언트를 아무리 고쳐도 «12시간 뒤 로그아웃» 은 안 됐을 자리다.
//
// ■ ⚠️`jwt_exp`(3600) 과 헷갈리지 말 것
//   그건 **액세스 토큰**의 수명이고 리프레시로 계속 갱신된다 — 로그인 유지 기간이 아니다.
//   낱말이 비슷해서 «1시간이면 되겠네» 로 잘못 읽기 쉽다([[verify-facts-not-memory]]).
//
// 실행: npm run check:session   (네트워크 필요 — Management API)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

/** Boss 가 정한 상한(초). 바꾸려면 여기와 서버를 함께 바꾼다. */
export const WANT_TIMEBOX_SEC = 12 * 3600;

const isMain = process.argv[1]?.includes('check-session');
if (isMain) {
  console.log('\n⏳ 로그인 세션 수명\n');
  let token = '';
  try { token = readFileSync(`${homedir()}/.supabase/access-token`, 'utf8').trim(); } catch { /* 아래 */ }
  const ref = (() => { try { return /SUPABASE_URL=https:\/\/([a-z0-9]+)\./.exec(readFileSync('.env', 'utf8'))?.[1] ?? ''; } catch { return ''; } })();
  if (!token || !ref) { console.log('⏭  건너뜀 — 토큰/URL 없음\n'); process.exit(0); }

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const cfg = await res.json().catch(() => null) as any;
  if (!cfg || typeof cfg.sessions_timebox !== 'number') {
    console.log(`⏭  건너뜀 — 조회 실패(${res.status})\n`); process.exit(0);
  }

  let bad = 0;
  const say = (ok: boolean, name: string, note = '') => { if (!ok) bad++; console.log(`   ${ok ? '✅' : '❌'} ${name.padEnd(40)} ${note}`); };

  const tb = cfg.sessions_timebox as number;
  say(tb === WANT_TIMEBOX_SEC, `S1 세션 상한이 ${WANT_TIMEBOX_SEC / 3600}시간이다`,
    tb === 0 ? '★0 = **무기한**입니다(로그인이 안 끊깁니다)' : `${tb}초 = ${(tb / 3600).toFixed(1)}시간`);
  // ★jwt_exp 는 «로그인 유지» 가 아니다 — 헷갈려서 여기를 고치는 일이 없게 값을 보여 준다
  console.log(`   ℹ  jwt_exp ${cfg.jwt_exp}초 — **액세스 토큰** 수명(리프레시로 갱신된다). 로그인 유지 기간이 아니다.`);
  console.log(`   ℹ  sessions_inactivity_timeout ${cfg.sessions_inactivity_timeout}초 — 0 = 방치해도 안 끊긴다(별개 설정).`);

  if (bad) { console.log(`\n❌ ${bad}건 — Boss 가 정한 «최대 ${WANT_TIMEBOX_SEC / 3600}시간» 과 다릅니다.\n`); process.exit(1); }
  console.log('\n✅ 세션 수명이 정해진 대로입니다\n');
}
