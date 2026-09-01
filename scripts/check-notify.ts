// scripts/check-notify.ts — 알림이 **말없이 실패하는 것**을 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-09-01 *"알림 관련해서도 버그 찾아"*)
//
// ■ ★★가장 큰 것 — **거부 사유를 버려서 실패가 「성공」으로 찍혔다**
//   Expo 는 실패 티켓마다 이유를 준다(DeviceNotRegistered · MismatchSenderId …).
//   `push-dispatch` 는 발송 경로가 **셋**인데(캠페인 · 커뮤니티 · 개인 알림),
//   2026-08-07 에 **캠페인 하나만** 고쳤다. 나머지 둘은 `ok` 개수만 세고
//   나머지를 통째로 버린 뒤 `status='sent'` 로 닫았다 ⇒
//   **친구신청·메시지 알림이 거부돼도 「보냈음」 으로 남는다.** 왜 안 왔는지 물을 데가 없다.
//   ★★«같은 필요의 여러 길 중 한쪽만 고쳐진다» 의 또 한 예 — 이번엔 길이 **셋**이었다.
//
// ■ ★죽은 토큰을 **안 지웠다**
//   앱을 지우면 토큰이 죽는다(DeviceNotRegistered). 그런데 프로필에 그대로 남아
//   **그 사람은 영영 알림을 못 받는다** — 그리고 아무 데도 오류가 안 뜬다.
//
// ■ ★사진만 보내면 푸시 본문이 **빈 칸**이었다
//   `sendUserMessage` 는 사진 한 장만 보내는 걸 허용한다(`body=''`).
//   트리거가 그 빈 글자를 그대로 실어 **제목만 있는 알림**이 떴다.
//
// 무엇을 지키나
//   N1 큐 두 곳에 **사유를 적을 칸**(`error`)이 있다
//   N2 `push-dispatch` 의 **모든** 발송 경로가 사유를 보존한다(`ok` 만 세고 버리지 않는다)
//   N3 죽은 토큰(DeviceNotRegistered)을 **떼어 낸다**
//   N4 메시지 알림이 **빈 본문**을 안 보낸다(사진만 보낸 경우)
//   N5 알림 트리거가 **PUBLIC·anon 에 안 열려** 있다
//   N6 푸시 토큰이 **한 계정에만** 붙어 있다(한 기기가 21계정에 붙은 이력)
//
// ★DB 는 조회로, Edge 소스는 파일로 잰다(`supabase/` 는 gitignore — 없으면 «건너뜀» 이라 말한다).
// ★음성 테스트: `npx tsx scripts/check-notify.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

// ── 판정기(순수) ────────────────────────────────────────────────────────────

/**
 * 발송 경로가 **거부 사유를 버리는가**.
 * ★«이름» 이 아니라 **표현식 모양**으로 본다 — `ok` 만 세고 실패 티켓을 안 읽는 자리를 찾는다.
 * @param src push-dispatch 원문
 * @returns 사유를 버리는 자리 수(0이어야 한다)
 */
export function discardsReasons(src: string): number {
  // `arr.filter(x => x?.status === 'ok').length` 를 쓰면서 그 배치에서
  // 실패 티켓을 한 번도 안 읽는 자리 = 버리는 자리.
  const naive = src.match(/\.filter\(\s*\(?\s*x\s*\)?\s*=>\s*x\?\.status\s*===\s*'ok'\s*\)\.length/g) ?? [];
  const reads = /details\?\.error/.test(src) ? 1 : 0;
  // 판독기(readTickets)가 있으면 그 안의 한 곳은 정당하다.
  return reads ? Math.max(0, naive.length - 1) : naive.length;
}

/** 죽은 토큰을 떼는 코드가 있는가. */
export function clearsDeadTokens(src: string): boolean {
  return /DeviceNotRegistered/.test(src) && /push_token:\s*null/.test(src);
}

/** 메시지 알림 트리거가 빈 본문을 막는가. */
export function guardsEmptyBody(def: string): boolean {
  // 빈 글자를 다른 문구로 바꿔 주는 자리가 있어야 한다.
  return /nullif\s*\(\s*trim\s*\(\s*new\.body/.test(def) && /image_path/.test(def);
}

/** 트리거 함수가 PUBLIC·anon 에 열려 있는가. */
export function grantedToPublic(acl: string): boolean {
  return /(^|\s)=X\//.test(acl) || /\banon=X\//.test(acl);
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
async function run() {
  // (1) Edge 소스 — 파일이 있을 때만
  const edge = 'supabase/functions/push-dispatch/index.ts';
  if (!existsSync(edge)) {
    console.log('⏭  N2·N3 건너뜀 — `supabase/` 가 없다(gitignore). **못 쟀다**, 통과가 아니다');
  } else {
    const src = readFileSync(edge, 'utf8');
    const n = discardsReasons(src);
    if (n > 0) {
      fail('N2', `발송 경로 ${n}곳이 **거부 사유를 버린다**(\`ok\` 개수만 센다).\n        `
        + '⚠️거부돼도 `status=\'sent\'` 로 닫히므로 «왜 안 왔는지» 를 물을 데가 없다.\n        '
        + '★캠페인 경로는 2026-08-07 에 고쳤다 — **같은 판독을 세 곳이 쓴다**(`readTickets`)');
    }
    if (!clearsDeadTokens(src)) {
      fail('N3', '죽은 토큰(`DeviceNotRegistered`)을 **안 뗀다**.\n        '
        + '⚠️앱을 지운 사람의 토큰이 프로필에 남아 **영영 실패**한다 — 오류는 아무 데도 안 뜬다');
    }
  }

  // (2) DB
  const tokPath = `${homedir()}/.supabase/access-token`;
  if (!existsSync(tokPath)) { console.log('⏭  DB 검사 건너뜀 — 자격증명 없음'); return; }
  const tok = readFileSync(tokPath, 'utf8').trim();
  const ref = (/SUPABASE_PROJECT_REF=(\S+)/.exec(readFileSync('.env', 'utf8')) ?? [])[1];
  if (!ref) { console.log('⏭  DB 검사 건너뜀 — 프로젝트 ref 없음'); return; }
  const q = async (sql: string): Promise<any[]> => {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    });
    if (!r.ok) throw new Error(await r.text());
    return await r.json();
  };

  // N1 사유를 적을 칸
  const cols = await q(`select table_name, count(*) filter (where column_name='error') as has_err
    from information_schema.columns
    where table_schema='public' and table_name in ('user_notify_queue','community_notify_queue')
    group by 1`);
  for (const c of cols) {
    if (Number(c.has_err) === 0) {
      fail('N1', `\`${c.table_name}\` 에 **사유를 적을 칸(\`error\`)이 없다**.\n        `
        + '⚠️칸이 없으면 발송이 거부돼도 «성공» 과 구분이 안 된다');
    }
  }
  if (cols.length < 2) fail('N1', `알림 큐 테이블을 ${cols.length}개만 찾았다 — **못 쟀다**`);

  // N4 빈 본문
  const trg = await q(`select pg_get_functiondef(oid) as d from pg_proc where proname='notify_friend_message'`);
  if (!trg.length) fail('N4', '`notify_friend_message` 가 없다 — **못 쟀다**');
  else if (!guardsEmptyBody(trg[0].d)) {
    fail('N4', '메시지 알림이 **빈 본문**을 그대로 보낸다.\n        '
      + '⚠️사진만 보내면 `body=\'\'` 다 — 상대 잠금화면에 **제목만** 뜬다(고장으로 읽힌다)');
  }

  // N5 트리거 권한 — ★★**이름 목록이 아니라 «트리거 함수 전부»** 를 본다.
  //   목록으로 두면 새로 만든 함수가 조용히 빠진다. 실제로 2026-09-01 에
  //   손으로 둘만 닫아 뒀더니 **여섯이 열린 채**였다(하네스가 그 중 하나를 잡아 전수조사로 이어졌다).
  const fns = await q(`select proname, coalesce(array_to_string(proacl::text[],' '),'') as acl
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prorettype='trigger'::regtype`);
  if (!fns.length) fail('N5', '트리거 함수를 한 개도 못 찾았다 — **못 쟀다**(조회가 틀렸을 수 있다)');
  for (const f of fns) {
    if (grantedToPublic(f.acl)) {
      fail('N5', `\`${f.proname}\` 이 **PUBLIC·anon 에 열려** 있다.\n        `
        + '⚠️Supabase 는 새 함수에 **기본으로** EXECUTE 를 준다 — 안 적으면 열린다.\n        '
        + '★지금 터지는 구멍은 아니다(트리거 함수는 직접 못 부른다). 정의가 바뀌는 날 열린다');
    }
  }

  // N6 토큰이 여러 계정에 붙어 있나
  const dup = await q(`select count(*)::int as n from (
    select push_token from profiles where push_token is not null group by 1 having count(*) > 1) t`);
  if (Number(dup[0]?.n ?? 0) > 0) {
    fail('N6', `푸시 토큰 ${dup[0].n}개가 **여러 계정에 붙어** 있다.\n        `
      + '⚠️한 기기가 남의 알림을 받는다(2026-08-31 에 토큰 하나가 **21계정**에 붙어 있었다).\n        '
      + '★`set_push_token` 이 등록 시 다른 계정에서 먼저 떼야 한다');
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const naive = `arr.filter((x) => x?.status === 'ok').length`;
  const cases = [
    { name: 'N2 사유를 읽으면 통과',
      run: () => discardsReasons(`${naive} ... x?.details?.error`) === 0 },
    { name: 'N2 ★세 곳이 `ok` 만 세면 문다(판독기 1곳 제외)',
      run: () => discardsReasons(`${naive}\n${naive}\n${naive}\nx?.details?.error`) === 2 },
    { name: 'N2 ★사유를 아예 안 읽으면 전부 센다',
      run: () => discardsReasons(`${naive}\n${naive}`) === 2 },
    { name: 'N3 죽은 토큰을 떼면 통과',
      run: () => clearsDeadTokens(`DeviceNotRegistered ... push_token: null`) === true },
    { name: 'N3 ★사유만 읽고 안 떼면 문다',
      run: () => clearsDeadTokens(`DeviceNotRegistered 만 있다`) === false },
    { name: 'N3 ★떼기만 하고 사유를 안 보면 문다',
      run: () => clearsDeadTokens(`push_token: null`) === false },
    { name: 'N4 빈 본문을 막으면 통과',
      run: () => guardsEmptyBody(`nullif(trim(new.body), '') ... image_path`) === true },
    { name: 'N4 ★그냥 coalesce 만 하면 문다',
      run: () => guardsEmptyBody(`left(coalesce(new.body,''),80)`) === false },
    { name: 'N4 ★사진을 안 가르면 문다',
      run: () => guardsEmptyBody(`nullif(trim(new.body), '')`) === false },
    { name: 'N5 PUBLIC 이면 문다', run: () => grantedToPublic('=X/postgres postgres=X/postgres') === true },
    { name: 'N5 anon 이어도 문다', run: () => grantedToPublic('postgres=X/postgres anon=X/postgres') === true },
    { name: 'N5 닫혀 있으면 통과', run: () => grantedToPublic('postgres=X/postgres service_role=X/postgres') === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  await run();
  if (out.length) {
    console.error(`❌ check:notify — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:notify — 거부 사유가 남고, 죽은 토큰은 떨어지고, 빈 알림은 안 나간다');
}
