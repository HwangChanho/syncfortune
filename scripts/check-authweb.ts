// scripts/check-authweb.ts — 로그인(소셜) 경로 불변식: 실패를 숨기지 않는다 · 웹 레이아웃은 게이트 뒤에
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (2026-08-16, daniel *"웹 로그인은 여전히 안되고"*)
//   원인을 찾는 데 오래 걸린 이유는 버그 자체가 아니라 **코드가 원인을 버렸기** 때문이다.
//   `auth-callback.tsx` 가 `try { … } catch { }` 로 모든 실패를 삼키고, `exchangeCodeForSession` 의
//   `error` 반환값도 보지 않은 채 곧장 홈으로 보냈다. 사용자에겐 "눌러도 아무 일이 없다"만 남고,
//   서버 로그에도 아무것도 안 남는다 — **관측 불가능한 실패**였다.
//   (실제 원인은 따로 있었다: 개발 오리진 `localhost:8081` 이 Supabase 리다이렉트 허용목록 밖.
//    그건 설정이라 코드로 못 막지만, **원인이 보이게** 만드는 것은 코드로 막을 수 있다.)
//
// 무엇을 지키나
//   A1. 콜백이 실패를 **로그로 남긴다**(logEvent 호출이 있다)
//   A2. 콜백이 실패를 **사용자에게 알린다**(Alert 호출이 있다)
//   A3. 콜백이 교환 결과의 `error` 를 **확인한다**(구조분해로 받아 쓴다)
//   A4. 콜백에 **알맹이 없는 catch** 가 없다(`catch {}` · `catch { /* 주석 */ }`)
//   W1. 로그인 화면의 웹 전용 스타일은 **게이트(`useWideWeb`) 뒤에서 조건부로** 붙는다
//       — 항상 넘기고 값만 undefined 로 두면 RN 이 네이티브 기본 스타일을 덮는다(실제로 당한 자리)
//
// ★판정은 **표현식**으로 한다([[harness-judge-expression-not-name]]).
// ★음성 테스트: `npx tsx scripts/check-authweb.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';

const CALLBACK = 'app/src/app/auth-callback.tsx';
const AUTH_SCREEN = 'app/src/screens/AuthScreen.tsx';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 주석을 지운 '코드만' — 주석에 적힌 예시 코드에 걸리는 오탐을 없앤다. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/**
 * **알맹이 없는 catch** 를 찾는다 — `catch {}` · `catch (e) {}` · 주석만 있는 블록.
 *
 * ★주석을 **먼저 걷어낸 뒤** 찾는다(2026-08-16 오탐 수정).
 *   처음엔 원본에서 찾았는데, 이 파일 머리말에 설명으로 적어 둔 `catch {}` 를 물었다.
 *   주석을 지워도 *주석만 있던 catch* 는 `{ }` 로 남아 여전히 잡히므로 잃는 것이 없다.
 *
 * @param src 소스 전문
 * @returns 걸린 catch 문자열들(사람이 읽게 공백 정리·70자 절단)
 */
function emptyCatches(src: string): string[] {
  const hits: string[] = [];
  const re = /catch\s*(?:\([^)]*\))?\s*\{([\s\S]*?)\}/g;
  for (const m of codeOnly(src).matchAll(re)) {
    if (!m[1].trim()) hits.push(m[0].replace(/\s+/g, ' ').slice(0, 70));
  }
  return hits;
}

// ── 콜백 라우트 ──────────────────────────────────────────────────────────────
if (!fs.existsSync(CALLBACK)) {
  fail('A0', `${CALLBACK} 이 없다 — 경로가 바뀌었으면 이 하네스를 고칠 것`);
} else {
  const raw = fs.readFileSync(CALLBACK, 'utf8');
  const code = codeOnly(raw);

  if (!/logEvent\s*\(/.test(code)) fail('A1', `${CALLBACK} — 실패를 서버 로그에 남기지 않는다(logEvent 호출 없음). 웹 사용자는 콘솔을 못 본다`);
  if (!/Alert\.alert\s*\(/.test(code)) fail('A2', `${CALLBACK} — 실패를 사용자에게 알리지 않는다(Alert 호출 없음). 조용한 복귀는 '무반응'으로 읽힌다`);
  // A3 — 교환/검증 결과의 error 를 실제로 받아서 쓰는가
  const usesError =
    /const\s*\{\s*error\s*[,}][\s\S]{0,80}?(exchangeCodeForSession|verifyOtp)/.test(code) ||
    /(exchangeCodeForSession|verifyOtp)[\s\S]{0,120}?\berror\b/.test(code);
  if (!usesError) fail('A3', `${CALLBACK} — exchangeCodeForSession/verifyOtp 의 error 를 확인하지 않는다(그냥 await 하면 실패가 사라진다)`);
  for (const c of emptyCatches(raw)) fail('A4', `${CALLBACK} — 알맹이 없는 catch 가 실패를 삼킨다: \`${c}\``);
}

// ── 로그인 화면 ──────────────────────────────────────────────────────────────
if (!fs.existsSync(AUTH_SCREEN)) {
  fail('W0', `${AUTH_SCREEN} 이 없다 — 경로가 바뀌었으면 이 하네스를 고칠 것`);
} else {
  const code = codeOnly(fs.readFileSync(AUTH_SCREEN, 'utf8'));
  if (!/useWideWeb\s*\(\s*\)/.test(code)) {
    fail('W1', `${AUTH_SCREEN} — 넓은 웹 판정(useWideWeb)이 없다. /login 은 WebShell 밖이라 스스로 폭을 잡지 않으면 화면 끝까지 늘어난다`);
  }
  // 웹 전용 스타일이 **조건부**로 붙는가(항상 넘기고 값만 undefined = 네이티브 기본값이 덮인다)
  // ★판정은 파일 전체가 아니라 **그 style 표현식 안**을 본다(2026-08-16 실사고):
  //   처음엔 "파일 어딘가에 `wide ?` 가 있는가"로 봤더니, 부제·안내가 이미 `wide ? … : null` 을 쓰고 있어
  //   게이트를 **떼어 내도 초록불**이 떴다. 이름·존재가 아니라 그 자리의 식을 봐야 한다.
  for (const m of code.matchAll(/style=\{([^{}]*cardWeb[^{}]*)\}/g)) {
    if (!m[1].includes('?')) {
      fail('W1', `${AUTH_SCREEN} — cardWeb 이 게이트 없이 항상 붙는다: \`style={${m[1].trim().slice(0, 60)}}\`\n        \`wide ? [...] : ...\` 로 조건부여야 네이티브가 안 바뀐다`);
    }
  }
  if (!/cardWeb/.test(code)) fail('W1', `${AUTH_SCREEN} — 웹 전용 카드 스타일(cardWeb)이 사라졌다. /login 은 스스로 폭을 잡아야 한다`);
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'A4: `catch {}` 를 문다', run: () => emptyCatches('try { f(); } catch {}').length === 1 },
    { name: 'A4: 주석만 있는 catch 도 문다', run: () => emptyCatches('try { f(); } catch { /* 무시 */ }').length === 1 },
    { name: 'A4: `catch (e) {}` 도 문다', run: () => emptyCatches('try { f(); } catch (e) {}').length === 1 },
    { name: 'A4: 처리하는 catch 는 물지 않는다', run: () => emptyCatches('try { f(); } catch (e) { log(e); }').length === 0 },
    // ↓ 실제로 났던 오탐(2026-08-16): 주석으로 적어 둔 설명을 코드로 오인했다
    { name: 'A4: 줄주석 속 `catch {}` 는 물지 않는다', run: () => emptyCatches('// 옛 코드는 catch {} 로 삼켰다\ntry { f(); } catch (e) { log(e); }').length === 0 },
    { name: 'A4: 블록주석 속 `catch {}` 도 물지 않는다', run: () => emptyCatches('/* catch {} 였다 */\ntry { f(); } catch (e) { log(e); }').length === 0 },
    { name: 'A1: logEvent 없는 파일을 문다', run: () => !/logEvent\s*\(/.test(codeOnly('const x = 1;')) },
    { name: 'A1: 주석 속 logEvent 는 안 쳐준다(오탐 방지의 반대 — 실제로 물어야 한다)', run: () => !/logEvent\s*\(/.test(codeOnly('// logEvent(1)\nconst x = 1;')) },
    { name: 'A3: error 를 안 보는 코드를 문다', run: () => !/(exchangeCodeForSession|verifyOtp)[\s\S]{0,120}?\berror\b/.test('await supabase.auth.exchangeCodeForSession(c); router.replace("/");') },
    { name: 'A3: error 를 보는 코드는 통과', run: () => /(exchangeCodeForSession|verifyOtp)[\s\S]{0,120}?\berror\b/.test('const { error } = await supabase.auth.exchangeCodeForSession(c); if (error) {}') },
    // W1 은 **그 style 표현식 안**만 본다 — 아래 두 케이스가 그걸 강제한다
    {
      name: 'W1: 게이트 없이 cardWeb 을 붙이면 문다',
      run: () => [...'<View style={[styles.card, styles.cardWeb]}>'.matchAll(/style=\{([^{}]*cardWeb[^{}]*)\}/g)].some(m => !m[1].includes('?')),
    },
    {
      name: 'W1: 조건부면 통과',
      run: () => [...'<View style={wide ? [styles.card, styles.cardWeb] : styles.card}>'.matchAll(/style=\{([^{}]*cardWeb[^{}]*)\}/g)].every(m => m[1].includes('?')),
    },
    {
      // ★실제로 놓쳤던 케이스: 같은 파일 다른 줄에 `wide ?` 가 있으면 초록불이 떴다
      name: 'W1: 파일 다른 곳의 `wide ?` 에 속지 않는다',
      run: () => {
        const src = '{wide ? <Text/> : null}\n<View style={[styles.card, styles.cardWeb]}>';
        return [...src.matchAll(/style=\{([^{}]*cardWeb[^{}]*)\}/g)].some(m => !m[1].includes('?'));
      },
    },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { const ok = c.run(); console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:authweb — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:authweb — 콜백이 실패를 남긴다(로그·알림·error 확인) · 로그인 화면 웹 폭은 게이트 뒤');
