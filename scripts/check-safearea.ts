// scripts/check-safearea.ts — 헤더 숨김 화면의 상단 안전영역 하네스
// ─────────────────────────────────────────────────────────────────────────
// ★2026-07-27 실제 신고(daniel IMG_8215 "글씨 크게하니깐 UI 다 짤려"):
//   홈 타이틀이 **상태바 위로 잘렸다.** 근인은 `paddingTop: space(12)` 같은 **고정 상수**였다
//   (주석에도 "헤더 숨김 → status bar 여백 확보"라고 적혀 있었다 = 상태바 높이를 눈대중으로 박은 값).
//   상수는 ①글자 배율(앱에 4단계 설정이 있다) ②기기별 노치·다이내믹아일랜드 ③가로/세로
//   어느 것도 반영하지 못한다. 글자를 키우면 헤더가 커지는데 여백은 그대로 → 위가 잘린다.
//
// ★왜 하네스인가: 이 결함은 **기본 글자 크기에서는 멀쩡해 보인다.** 개발·QA 가 기본값으로만 보면
//   절대 안 걸리고, 접근성 설정을 쓰는 사용자에게서만 터진다. 사람 눈으로 지킬 수 없는 종류다.
//
// 지키는 것: `headerShown: false` 로 자체 상단을 그리는 화면은
//   S1 useSafeAreaInsets 를 쓰고
//   S2 상단 여백에 insets.top 을 실제로 반영하며
//   S3 상단 여백에 **고정 상수만** 쓰지 않는다(space(8) 이상 = 상태바를 대신하려는 값으로 본다)
//
// 실행: npm run check:safearea
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const LAYOUT = 'app/src/app/(app)/_layout.tsx';

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

// _layout 에서 headerShown:false 인 라우트를 뽑는다(대상이 늘어나도 자동 포함 — 하네스가 낡지 않게).
const layout = readFileSync(`${ROOT}${LAYOUT}`, 'utf8');
const targets = [...layout.matchAll(/<Stack\.Screen\s+name="([a-zA-Z/[\]-]+)"[^>]*headerShown:\s*false/g)].map((m) => m[1]);

console.log(`\n[대상] headerShown:false 화면 ${targets.length}개 — ${targets.join(', ')}`);
if (targets.length === 0) bad('headerShown:false 화면을 하나도 못 찾았다 — 패턴이 바뀌어 하네스가 헛돈다(역검증 실패)');

for (const name of targets) {
  const path = `app/src/app/(app)/${name}.tsx`;
  let src: string;
  try { src = readFileSync(`${ROOT}${path}`, 'utf8'); } catch { console.log(`  · ${name}: 파일 없음(스킵)`); continue; }
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  // ── 면제 ─────────────────────────────────────────────────────────
  // ★인셋을 **다른 컴포넌트에 위임한** 화면이 있다(예: `chats.tsx` 는 `TalkHome` 한 줄짜리 껍데기다).
  //   거기에 인셋을 또 주면 여백이 두 번 들어가 헤더가 뜬다 — 규칙을 지키려다 화면을 깨는 셈이다.
  //   ⇒ `// safe-area-safe: <이유>` 로 면제하되 **이유를 반드시 적게** 한다.
  //     `check:keyboard` 의 `// keyboard-safe:` 와 같은 방식이다(두 하네스가 다른 문법을 쓰면 아무도 못 외운다).
  // ⚠️★`\s*` 를 쓰면 **개행을 먹어 다음 줄을 이유로 읽는다** — 음성 테스트에서 잡혔다
  //   (이유를 비웠는데 바로 아래 `import` 문이 이유로 통과했다).
  //   `[^\S\n]*` = 개행이 아닌 공백만. 하네스는 자기 정규식부터 반증해야 한다.
  const ex = src.match(/\/\/[^\S\n]*safe-area-safe:[^\S\n]*(.*)/);
  if (ex) {
    if (!ex[1]?.trim()) { bad(`${name}: 면제 주석에 **이유가 없다** — 이유 없는 면제는 규칙을 지운 것과 같다`); }
    else { ok(`${name}: 면제 — ${ex[1].trim()}`); }
    continue;
  }

  // S1·S2
  const hasHook = /useSafeAreaInsets\s*\(/.test(code);
  const usesTop = /insets\.top/.test(code);
  if (hasHook && usesTop) ok(`${name}: insets.top 반영`);
  else bad(`${name}: 상단 안전영역 미반영(${!hasHook ? 'useSafeAreaInsets 없음' : 'insets.top 미사용'}) — 글자를 키우면 헤더가 상태바 위로 잘린다`);

  // S3 — 상태바를 대신하려는 큰 고정 여백이 남아 있으면 경고(작은 여백은 정상 레이아웃)
  const fixed = [...code.matchAll(/paddingTop:\s*space\(([0-9.]+)\)/g)].map((m) => Number(m[1])).filter((n) => n >= 8);
  if (fixed.length) bad(`${name}: 고정 상단여백 space(${fixed.join('), space(')}) 이 남아 있다 — 상태바 높이를 상수로 대신하면 같은 잘림이 재발한다`);
}

console.log(fail ? `\n❌ check:safearea 실패 ${fail}건` : '\n✅ check:safearea 통과 — 헤더 숨김 화면 전부 insets.top 반영·고정 상단여백 없음');
process.exit(fail ? 1 : 0);
