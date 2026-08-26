// scripts/check-webmodules.ts — 웹 번들에서 **expo 모듈 이름이 겹치지 않는다**
// ═══════════════════════════════════════════════════════════════════════════
// 2026-08-26 · Boss *"앱이든 웹이든 자꾸 화면을 그리다 문제가 생긴데 전체 뷰 점검해"* 로 전 화면을
// 훑다가 잡았다. 콘솔에 `o.default.stop is not a function` 이 계속 떴다.
//
// ■ 무슨 일이었나
//   expo 의 웹 모듈은 **클래스 이름을 키 삼아** 전역에 한 번만 등록한다:
//     globalThis.expo.modules[Klass.name] ??= new Klass()   ← 이미 있으면 **그것을 돌려준다**
//   프로덕션 압축이 클래스 이름을 한 글자로 바꾸면서 **셋이 전부 `s`** 가 됐다:
//     expo-image · expo-network · expo-speech
//   ⇒ 먼저 등록한 하나만 살고 나머지 둘은 **엉뚱한 인스턴스**를 받는다.
//     `TTSButton` 의 언마운트 정리가 `Speech.stop()` 대신 **expo-image 인스턴스**를 부르고 있었다.
//     `ExpoImage.prefetch` 도 웹에서 조용히 아무 일도 안 했다(전부 `catch` 로 감싸여 있어 안 보였다).
//
// ■ ★왜 «조용한 실패» 가 더 무서운가
//   화면이 죽지 않으니 아무도 모른다. 그리고 **어느 모듈이 이길지는 압축 순서가 정한다** —
//   다음 빌드에서 순서가 바뀌면 무엇이 깨질지 예측할 수 없다.
//   ⇒ 뿌리는 `app/metro.config.js` 의 `keep_classnames`, 여기서는 **산출물로 확인**한다.
//
// ■ ⚠️이건 **소스가 아니라 빌드 결과**를 본다
//   설정이 옳아 보여도 실제 산출물이 그런지는 다른 문제다([[build-artifact-verify-hermes]]).
//   `app/dist` 가 없으면 «검사 못 함» 이라고 말한다 — «통과» 라고 하지 않는다.
//
// ★음성 테스트: `npx tsx scripts/check-webmodules.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const DIST = 'app/dist/_expo/static/js/web';
const METRO = 'app/metro.config.js';

export type Judge = { ok: boolean; names: string[]; dup: Record<string, number>; msg: string };

/**
 * 번들 문자열에서 `registerWebModule(X)` 의 X 들을 뽑아 **겹치는지** 본다.
 * @param src 번들 소스
 */
export function judgeBundle(src: string): Judge {
  const names = [...src.matchAll(/registerWebModule\)?\(\s*([A-Za-z_$][\w$]*)\s*\)/g)].map((m) => m[1]);
  const count: Record<string, number> = {};
  for (const n of names) count[n] = (count[n] ?? 0) + 1;
  const dup = Object.fromEntries(Object.entries(count).filter(([, v]) => v > 1));
  if (!names.length) {
    return { ok: false, names, dup, msg: 'registerWebModule 호출을 하나도 못 찾았다 — 번들 형태가 바뀌었으면 이 하네스를 고칠 것' };
  }
  if (Object.keys(dup).length) {
    return { ok: false, names, dup, msg: `★모듈 이름이 겹친다: ${JSON.stringify(dup)} — 먼저 등록한 하나만 살고 나머지는 **엉뚱한 인스턴스**를 받는다` };
  }
  // 한 글자 이름이 남아 있으면 아직 위험하다(다음 빌드에서 겹칠 수 있다)
  const short = names.filter((n) => n.length <= 2);
  if (short.length > 1) {
    return { ok: false, names, dup, msg: `★한 글자 이름이 ${short.length}개 남았다(${short.join(', ')}) — 지금은 안 겹쳐도 **다음 빌드에서 겹친다**` };
  }
  return { ok: true, names, dup, msg: '' };
}

if (process.argv.includes('--selftest')) {
  const cases: [string, string, boolean][] = [
    ['정상(이름 유지)', "registerWebModule(ExpoSpeech);registerWebModule(ImageModule);registerWebModule(ExpoNetworkModule)", true],
    // ⚠️실제로 있었던 모습 — 셋이 전부 `s`
    ['충돌(압축된 한 글자)', "registerWebModule(s);registerWebModule(t);registerWebModule(s);registerWebModule(s)", false],
    ['한 글자 여럿(겹치기 직전)', "registerWebModule(s);registerWebModule(t);registerWebModule(ExpoSpeech)", false],
    ['호출 없음(번들 형태 변경)', 'nothing here', false],
  ];
  let ok = true;
  for (const [label, src, want] of cases) {
    const got = judgeBundle(src).ok;
    if (got !== want) ok = false;
    console.log(`  ${got === want ? '✅' : '❌'} ${label} → ${got ? '통과' : '잡음'} (기대 ${want ? '통과' : '잡음'})`);
  }
  console.log(ok ? '✅ selftest 통과' : '❌ selftest 실패');
  process.exit(ok ? 0 : 1);
}

// ── 본검사 ──────────────────────────────────────────────────────────────────
const fails: string[] = [];

// ① 설정이 켜져 있는가(뿌리)
{
  const raw = fs.existsSync(METRO) ? fs.readFileSync(METRO, 'utf8') : null;
  if (raw == null) fails.push(`${METRO} 이 없다`);
  else {
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    if (!/keep_classnames\s*:\s*true/.test(code)) {
      fails.push(`${METRO} — keep_classnames 가 꺼져 있다. expo 웹 모듈이 서로를 덮어쓴다`);
    }
  }
}

// ② 산출물이 실제로 그런가 — ⚠️없으면 «통과» 가 아니라 «검사 못 함»
if (!fs.existsSync(DIST)) {
  console.log('⏭  check:webmodules — app/dist 가 없어 **산출물을 검사하지 못했다**(웹 빌드 후 다시 돌릴 것)');
  if (fails.length) { console.error('\n' + fails.map((f) => `  [W1] ${f}`).join('\n')); process.exit(1); }
  process.exit(0);
}
{
  const f = fs.readdirSync(DIST).find((n) => /^entry-.*\.js$/.test(n));
  if (!f) fails.push(`${DIST} 에 entry 번들이 없다`);
  else {
    const j = judgeBundle(fs.readFileSync(path.join(DIST, f), 'utf8'));
    if (!j.ok) fails.push(`${f} — ${j.msg}`);
    else console.log(`   산출물 확인: ${j.names.join(' · ')}`);
  }
}

if (!fails.length) {
  console.log('✅ check:webmodules — expo 웹 모듈 이름이 서로 겹치지 않는다(설정 + 산출물 둘 다 확인)');
  process.exit(0);
}
console.error(`❌ check:webmodules — ${fails.length}건\n`);
for (const f of fails) console.error(`  [W1] ${f}`);
process.exit(1);
