// scripts/check-adminkeys.ts — **공개 URL 에 올리기 전, 키가 섞였는지 기계가 본다**
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-13: *"https://hairpin-admin.pages.dev/ 이거처럼 일반 url로 관리자 페이지 만들어"*
//
// ■ 왜 이 하네스가 필요한가
//   관리자 콘솔이 **누구나 열 수 있는 공개 주소**(syncfortune-admin.pages.dev)로 나갔다.
//   페이지 자체는 로그인·is_admin 으로 잠겨 있지만, **HTML 소스는 전 세계가 읽는다.**
//   여기에 `service_role` 키가 한 번이라도 섞이면 그 순간 **DB 전체가 열린다** —
//   RLS 를 통째로 우회하는 키이기 때문이다. 되돌려도 이미 읽혔다고 봐야 한다.
//
//   즉 이건 "실수하면 고치면 되는" 종류가 아니라 **비가역**이다. 그래서 사람이 아니라 기계가 본다.
//
// ■ ★판정은 **이름이 아니라 값**으로 한다 ([[harness-judge-expression-not-name]])
//   `grep service_role` 로 판정하면 두 가지가 다 틀린다:
//     · 거짓 양성 — 이 파일 주석에도 "service_role 은 절대 두지 않는다"고 적혀 있다(2건).
//       문자열만 보면 **경고문 때문에 배포가 막힌다.**
//     · 거짓 음성 — 변수명을 `KEY` 로 바꿔 담으면 **문자열이 안 나온다.**
//   ⇒ 실제 판정은 **JWT 를 찾아 페이로드를 디코드하고 `role` 클레임을 읽는다.**
//     키가 무슨 이름으로 담겼든, 어디에 있든, role 이 anon 이 아니면 잡힌다.
//
// ■ 함께 보는 것
//   · Supabase 말고 다른 비밀(Anthropic·FCM·Play 서비스계정)이 섞였는지
//   · anon key 가 **우리 프로젝트의 것**인지(다른 프로젝트 키를 붙여넣는 실수)
//
// 실행: npm run check:adminkeys   (deploy:admin 이 배포 **전에** 자동으로 부른다)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';

/** 공개 배포되는 정적 파일들 — 여기 있는 것은 전부 "전 세계가 읽는다"고 가정한다. */
const PUBLIC_FILES = ['docs/admin/index.html'];

let bad = 0;
const fail = (msg: string) => { bad++; console.log(`   ❌ ${msg}`); };
const pass = (msg: string) => console.log(`   ✅ ${msg}`);

console.log('\n🔑 공개 배포물에 비밀이 섞였는가 — JWT 페이로드를 디코드해 판정\n');

for (const f of PUBLIC_FILES) {
  if (!existsSync(f)) { console.log(`   ⏭  ${f} — 파일 없음`); continue; }
  const src = readFileSync(f, 'utf8');
  console.log(`  [${f}]`);

  // ── ① JWT 를 전부 찾아 role 클레임을 읽는다 (이름 무관) ──────────────────
  const jwts = [...src.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{20,})\.[A-Za-z0-9_-]{10,}/g)];
  if (!jwts.length) {
    pass('JWT 없음');
  } else {
    for (const m of jwts) {
      let role = '?', ref = '?';
      try {
        const p = JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')) as { role?: string; ref?: string };
        role = p.role ?? '(없음)'; ref = p.ref ?? '(없음)';
      } catch { role = '(디코드 실패)'; }

      if (role === 'anon') pass(`JWT role=anon · 프로젝트 ${ref} — 공개 가능(앱 번들에도 이미 있는 값)`);
      else {
        fail(`JWT role=${role} — **공개 파일에 두면 안 되는 키입니다**`);
        console.log(`      service_role 은 RLS 를 통째로 우회합니다. 공개 주소에 한 번 나가면 되돌릴 수 없습니다.`);
        console.log(`      → 이 키를 지우고, 이미 배포됐다면 Supabase 대시보드에서 **키를 회전**하십시오.`);
      }
    }
  }

  // ── ①-b ★Supabase **새 형식** 키 (JWT 가 아니다 — 2026-08-13 음성 테스트로 발견) ──
  //   Supabase 는 JWT 형식(`eyJ…`) 외에 접두사 형식 키를 함께 쓴다:
  //     · `sb_publishable_…` = 공개 가능(anon 대체)
  //     · `sb_secret_…`      = **RLS 우회**(service_role 대체) ← 절대 공개 금지
  //   위 ① 은 JWT 만 디코드하므로 이 형식을 **통째로 놓친다.**
  //   실제로 이 저장소의 `.env` 는 service_role 을 **41자 `sb_secret_…`** 로 갖고 있어,
  //   그것을 심은 음성 테스트가 **통과해 버렸다.** 형식이 하나라고 가정하면 안 된다.
  if (/\bsb_secret_[A-Za-z0-9_-]{6,}/.test(src)) {
    fail('Supabase **sb_secret_** 키가 들어 있습니다 — RLS 를 우회하는 키입니다');
    console.log(`      공개 주소에 한 번 나가면 되돌릴 수 없습니다. 지우고 **키를 회전**하십시오.`);
  } else {
    pass('sb_secret_ 형식 키 없음');
  }

  // ── ② Supabase 외의 비밀 ────────────────────────────────────────────────
  // 각 서비스의 키는 고정 접두사를 쓴다 — 접두사는 값의 일부라 변수명을 바꿔도 남는다.
  const SECRETS: [string, RegExp][] = [
    ['Anthropic API 키', /sk-ant-[A-Za-z0-9_-]{20,}/],
    ['OpenAI API 키', /\bsk-[A-Za-z0-9]{32,}/],
    ['Google 서비스계정 개인키', /-----BEGIN (RSA )?PRIVATE KEY-----/],
    ['FCM 레거시 서버키', /\bAAAA[A-Za-z0-9_-]{20,}:APA91[A-Za-z0-9_-]{20,}/],
    ['GitHub 토큰', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ];
  let found = false;
  for (const [name, re] of SECRETS) {
    if (re.test(src)) { fail(`${name} 가 들어 있습니다`); found = true; }
  }
  if (!found) pass('Supabase 외 비밀 없음(Anthropic·OpenAI·개인키·FCM·GitHub)');

  // ── ③ 붙여넣은 anon key 가 **우리 프로젝트**의 것인가 ────────────────────
  // 다른 프로젝트 키를 붙여넣으면 화면은 뜨는데 데이터가 안 나온다 — 조용히 깨진다.
  if (existsSync('.env')) {
    const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
    const projRef = (env.SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
    if (projRef && jwts.length) {
      const refs = jwts.map((m) => {
        try { return (JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')) as { ref?: string }).ref; } catch { return undefined; }
      });
      if (refs.every((r) => r === projRef)) pass(`프로젝트 일치 — ${projRef}`);
      else fail(`프로젝트 불일치 — 파일 ${refs.join(',')} ≠ .env ${projRef} (화면은 떠도 데이터가 안 나옵니다)`);
    }
  }
}

console.log(bad ? `\n❌ check:adminkeys 실패 — ${bad}건. **배포하지 마십시오.**\n`
  : '\n✅ check:adminkeys 통과 — 공개해도 되는 값만 들어 있습니다\n');
if (bad) process.exitCode = 1;
