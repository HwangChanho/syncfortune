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
import { readFileSync, readdirSync } from 'node:fs';

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

// ── S4 ★**화면을 다 덮는 오버레이**도 안전영역을 스스로 빼야 한다 ──────────────
//   Boss 2026-09-01 *"여기도 위에가 짤리잖아 앱이랑 웹이랑 패드랑 지금 대응이 제대로 안되고 있어
//   ui그릴때 고민해서 하네스에등록해"*
//   ⚠️실측: 친구 프로필 시트(`PersonSheet`)가 `absoluteFillObject` 로 화면을 끝까지 덮으면서
//     상태바 아래로 파고들어 **시계와 아바타가 겹쳤다.**
//   ★위 S1~S3 은 «화면»(Stack.Screen)만 본다 — 오버레이는 화면이 아니라 그 검사에 안 걸린다.
//     같은 결함의 **다른 자리**다.
//   ★단, «가운데 정렬» 오버레이는 대상이 아니다(스플래시·자르기 창처럼 위에 안 붙는다).
//     ⇒ 뿌리가 `justifyContent:'center'`·`alignItems:'center'` 면 면제한다 — 규칙이
//       실제 위험(위에 붙는 것)만 겨냥해야 거짓 빨간불이 안 난다.
{
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(`${ROOT}${dir}`, { withFileTypes: true })) {
      if (e.isDirectory()) walk(`${dir}/${e.name}`);
      else if (e.name.endsWith('.tsx')) files.push(`${dir}/${e.name}`);
    }
  };
  walk('app/src/components');

  for (const f of files) {
    const src = readFileSync(`${ROOT}${f}`, 'utf8');
    // 주석을 뺀 코드에서만 본다(주석 속 예시에 속지 않게)
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const m = /(?:root|overlay|backdrop|scrim):\s*\{[^}]*absoluteFillObject[^}]*\}/.exec(code);
    if (!m) continue;
    const rootStyle = m[0];
    // 가운데 정렬 = 위에 안 붙는다 → 면제
    if (/justifyContent:\s*'center'/.test(rootStyle) && /alignItems:\s*'center'/.test(rootStyle)) continue;
    const name = f.split('/').pop();
    // ★면제 주석은 **S1~S3 과 같은 규칙**으로 존중한다 — 이유 없는 면제는 통과시키지 않는다.
    //   (안 그러면 규칙마다 면제 방법이 달라져 «어디에 뭘 적어야 하나» 를 아무도 모른다.)
    const ex4 = src.match(/\/\/[^\S\n]*safe-area-safe:[^\S\n]*(.*)/);
    if (ex4) {
      if (!ex4[1]?.trim()) bad(`${name}: 면제 주석에 **이유가 없다** — 이유 없는 면제는 규칙을 지운 것과 같다`);
      else ok(`${name}: 면제 — ${ex4[1].trim()}`);
      continue;
    }
    if (/useSafeAreaInsets\s*\(/.test(code) && /insets\.top/.test(code)) ok(`${name}: 전면 오버레이가 insets.top 반영`);
    else bad(`${name}: **화면을 다 덮는데** 상단 안전영역을 안 뺀다 — 상태바 아래로 파고들어 시계와 겹친다`);
  }
}

console.log(fail ? `\n❌ check:safearea 실패 ${fail}건` : '\n✅ check:safearea 통과 — 헤더 숨김 화면 전부 insets.top 반영·고정 상단여백 없음');
process.exit(fail ? 1 : 0);
