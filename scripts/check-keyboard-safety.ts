// scripts/check-keyboard-safety.ts — 텍스트 입력창 키보드 가림 가드 (정적·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 왜 하네스인가(daniel 2026-07-18 사건): 커뮤니티 댓글 입력창이 키보드에 통째로 덮여
//   무엇을 쓰는지 보이지 않았다("댓글 입력할때 키보드가 입력창을 가려"). 원인은 단순 —
//   입력바를 flex 하단에 놓기만 하고 키보드를 고려하지 않은 것. 타입체크로는 절대 안 잡히고,
//   시뮬에서 키보드를 직접 띄워 보지 않으면 리뷰에서도 놓친다.
//   → daniel 지시: "이런식의 텍스트 필드 배치할때 키보드 무조건 고려하도록 하네스에 등록해놔".
//
// ★이 앱에서 표준 KeyboardAvoidingView 가 잘 안 먹는 이유:
//   전역 BottomNav(하단 탭바)가 _layout 에 있어 화면 컴포넌트 *밖*이다. KAV 는 그 존재를 모르므로
//   네비바 높이만큼 어긋난다. 그래서 검증된 패턴 = Keyboard 리스너로 높이를 받아
//   `lift = kbH − getNavBarHeight()` 만큼 입력바를 직접 올린다(coach.tsx·communityPost.tsx).
//
// 규칙(이 하네스가 강제):
//   R1. TextInput 을 렌더하는 파일은 아래 중 **하나 이상**을 갖춰야 한다.
//       ① Keyboard.addListener('keyboardWillShow'|'keyboardDidShow')  ← 이 앱의 표준(lift 패턴)
//       ② KeyboardAvoidingView                                        ← 전역 네비바 밖 화면에선 가능
//       ③ automaticallyAdjustKeyboardInsets                           ← iOS ScrollView 자동 인셋
//       ④ `keyboard-safe:` 면제 주석 + 이유                            ← 구조상 가려질 수 없는 경우
//   R2. 하단 고정 입력바(position:'absolute' + bottom)에 TextInput 이 있으면 ①(리스너)이어야 한다.
//       — absolute 로 바닥에 못박은 입력바는 KAV·자동인셋이 못 올린다. 정확히 이번 버그의 형태.
//
// 면제 쓰는 법(오탐일 때):  // keyboard-safe: 입력창이 화면 최상단이라 키보드에 가려질 수 없음
//
// 실행: npm run check:keyboard  (preflight 에 포함)
// ─────────────────────────────────────────────────────────────────────────
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ROOT = process.cwd();
let failed = 0;
const fail = (m: string) => { console.error(`  ❌ ${m}`); failed++; };
const pass = (m: string) => console.log(`  ✅ ${m}`);
const warn = (m: string) => console.log(`  ⚠️  ${m}`);

console.log('■ check:keyboard — 텍스트 입력창이 키보드에 가려지지 않는지');

// ── 대상 수집: TextInput 을 실제로 렌더하는 파일 ─────────────────────
function grep(pattern: string, paths = "'app/src/**/*.tsx'"): string[] {
  try {
    return execSync(`git grep -lE ${JSON.stringify(pattern)} -- ${paths}`, { cwd: ROOT }).toString().trim().split('\n').filter(Boolean);
  } catch (e: any) {
    // git grep 은 매치 0건이면 exit 1 → stdout 비어 있음
    const out = e?.stdout?.toString().trim();
    return out ? out.split('\n').filter(Boolean) : [];
  }
}

// `<TextInput` 로 실제 렌더하는 파일만(타입 import 만 한 파일 제외)
const files = grep('<TextInput');
if (files.length === 0) {
  fail('TextInput 렌더 파일 0건 — 패턴이 바뀌어 하네스가 아무것도 안 보고 있음(역검증 실패)');
  console.log('\n❌ check:keyboard 실패 1건');
  process.exit(1);
}

// 키보드 대응 수단 판정
const HAS_LISTENER = /Keyboard\.addListener\(\s*(showEvt|hideEvt|['"`]keyboard(Will|Did)(Show|Hide))/;
const HAS_LISTENER_LOOSE = /keyboard(Will|Did)Show/;      // 이벤트명을 변수로 뺀 형태까지 포함
const HAS_KAV = /KeyboardAvoidingView/;
const HAS_AUTO_INSET = /automaticallyAdjustKeyboardInsets/;
const HAS_EXEMPT = /keyboard-safe:/;
// 하단 고정 '입력바' = 스타일 **키 이름이 입력바스러운 것**(input/compose/comment/reply/chat/sendBar)이면서
//   그 스타일 객체가 position:'absolute' + bottom 인 형태.
//   ★키 이름으로 좁히는 이유: 단순히 "파일 어딘가에 absolute+bottom"으로 잡으면 FAB(글쓰기 버튼)·
//     가운데 정렬 타이틀까지 걸려 오탐이 난다(community.tsx 가 실제로 그랬다). 오탐투성이 하네스는
//     무시당하고 결국 무력화되므로, 잡는 대상을 '입력바'로 한정한다.
const ABS_BOTTOM_INPUT_BAR = /\b\w*(input|compose|comment|reply|chat|send)\w*\s*:\s*\{[^}]*position:\s*['"]absolute['"][^}]*\bbottom:/i;

// ⑤ 공통 셸 위임 — 화면이 직접 스크롤을 그리지 않고 키보드를 처리하는 공통 틀에 얹는 경우.
//   ★셸이 실제로 회피 수단을 갖췄는지 **먼저 검증**한다. 안 그러면 셸이 나중에 깨졌을 때
//     그 위에 얹힌 화면 전부가 조용히 무방비가 된다(하네스가 거짓 안심을 주는 최악의 형태).
const SHELLS = ['app/src/components/SpecialContentScreen.tsx'];
const healthyShells: string[] = [];
for (const s of SHELLS) {
  const src = readFileSync(`${ROOT}/${s}`, 'utf8');
  if (HAS_AUTO_INSET.test(src) || HAS_KAV.test(src) || HAS_LISTENER_LOOSE.test(src)) {
    healthyShells.push(s.split('/').pop()!.replace('.tsx', ''));
  } else {
    fail(`공통 셸 ${s} 에 키보드 회피가 없음 — 이 셸에 얹힌 모든 화면이 무방비가 된다`);
  }
}

console.log(`\n[R1] TextInput 렌더 파일은 키보드 회피 수단을 갖춰야(리스너 / KAV / 자동인셋 / 공통셸 / 면제 주석)`);
const covered: string[] = [];
const viaShell: string[] = [];
const exempt: string[] = [];
const missing: string[] = [];
const absBarNoListener: string[] = [];

for (const f of files) {
  const src = readFileSync(`${ROOT}/${f}`, 'utf8');
  const hasListener = HAS_LISTENER.test(src) || HAS_LISTENER_LOOSE.test(src);
  const onShell = healthyShells.some((sh) => new RegExp(`\\b${sh}\\b`).test(src)); // 검증된 셸 위에 얹힌 화면
  if (onShell && !hasListener && !HAS_KAV.test(src) && !HAS_AUTO_INSET.test(src)) viaShell.push(f);
  const ok = hasListener || HAS_KAV.test(src) || HAS_AUTO_INSET.test(src) || onShell;
  if (ok) {
    covered.push(f);
    // R2: absolute 하단 입력바인데 리스너가 아니면(KAV·자동인셋만) 못 올린다.
    if (ABS_BOTTOM_INPUT_BAR.test(src) && !hasListener) absBarNoListener.push(f);
  } else if (HAS_EXEMPT.test(src)) {
    exempt.push(f);
  } else {
    missing.push(f);
    if (ABS_BOTTOM_INPUT_BAR.test(src)) absBarNoListener.push(f);
  }
}

if (missing.length) {
  fail(`키보드 회피가 없는 TextInput 화면 ${missing.length}건 — 입력창이 키보드에 덮일 수 있음:`);
  missing.forEach((f) => console.error(`       ${f}`));
  console.error('       → coach.tsx / communityPost.tsx 의 lift 패턴을 복제하거나,');
  console.error('         가려질 수 없는 구조면 `// keyboard-safe: <이유>` 주석으로 면제하라.');
} else {
  pass(`TextInput 렌더 ${files.length}개 파일 모두 키보드 회피 있음(직접 ${covered.length - viaShell.length} · 공통셸 위임 ${viaShell.length} · 면제 ${exempt.length})`);
}
if (exempt.length) exempt.forEach((f) => warn(`면제(keyboard-safe): ${f}`));
if (viaShell.length) viaShell.forEach((f) => console.log(`  · 공통셸(${healthyShells.join('/')}) 위임: ${f}`));

console.log(`\n[R2] 하단 고정 입력바(absolute+bottom)는 Keyboard 리스너로 직접 올려야(KAV·자동인셋은 absolute 를 못 올림)`);
if (absBarNoListener.length) {
  fail(`absolute 하단 입력바인데 Keyboard 리스너가 없음 ${absBarNoListener.length}건 — 2026-07-18 댓글 버그와 같은 형태:`);
  absBarNoListener.forEach((f) => console.error(`       ${f}`));
} else {
  pass('absolute 하단 입력바는 전부 리스너로 올리고 있음(또는 해당 없음)');
}

// ── 역검증: 표준 패턴(lift)이 살아 있는지 ────────────────────────────
console.log('\n[역검증] 표준 lift 패턴이 코드에 실재(하네스가 헛돌지 않음)');
const liftUsers = grep('getNavBarHeight\\(\\)');
liftUsers.length > 0
  ? pass(`getNavBarHeight() 사용 ${liftUsers.length}건 — 표준 패턴 실재(${liftUsers.map((f) => f.split('/').pop()).join(', ')})`)
  : fail('getNavBarHeight() 사용 0건 = 표준 패턴이 사라짐(하네스 기준이 무의미해짐)');

console.log(failed ? `\n❌ check:keyboard 실패 ${failed}건` : '\n✅ check:keyboard 통과');
process.exit(failed ? 1 : 0);
