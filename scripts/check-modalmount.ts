// scripts/check-modalmount.ts — 전역 모달이 **닫힐 때 사라지지 않는지** 강제한다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 — App Store 심사 크래시(2.1(a) App Completeness · iOS 26.6.1 · 3건 동일)
//   스택이 이랬다:
//     _runAlongsideCompletions → -[UIViewController _presentViewController:…]
//       → objc_exception_throw → abort()
//   즉 **전환(transition)이 끝나는 완료 블록 안에서 또 present 가 일어나** UIKit 이 예외를 던졌다.
//   우리 코드 프레임은 `main` 뿐 — JS 가 부른 게 아니라 **네이티브 모달이 겹친 것**이다.
//
// ★이 저장소는 이 교훈을 **이미 알고 있었다.** `AppAlert.tsx` 에 이렇게 적혀 있다:
//     "⚠️ Modal 은 항상 마운트하고 visible 로만 토글한다 … 닫힘(fade) 애니메이션 도중
//      Modal 이 재마운트되면 iOS 네이티브 모달이 프리징(앱 멈춤)한다"
//   그런데 **형제 파일(`chartConfirm.tsx`)에는 적용되지 않았다** — `if (!state) return null`.
//   ⇒ 「고친 사람만 아는 규칙」은 반드시 되돌아온다. 그래서 하네스로 옮긴다.
//
// 무엇을 지키나
//   M1 루트(`app/_layout.tsx`)가 그리는 **전역 모달 호스트**는 `<Modal>` 을 언마운트하지 않는다
//      (= 렌더보다 앞에서 `return null` 로 빠지지 않는다. 닫을 땐 `visible` 로 토글한다)
//   M2 `BusyOverlay` 는 **`Modal` 이 아니다** — 로딩 막은 뷰컨트롤러가 필요 없다.
//      뷰컨트롤러를 하나 줄이면 그만큼 겹칠 상대가 준다(이번 크래시 대응의 핵심).
//
// ★판정은 «뜻» 으로 — 파일 이름을 나열하지 않고 `_layout.tsx` 가 **실제로 그리는 것**을 따라간다.
//   호스트를 새로 추가해도 자동으로 검사 대상이 된다(자리·이름으로 판정하면 리팩터링에 눈이 먼다).
// ★음성 테스트: `npx tsx scripts/check-modalmount.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string): string | null => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return null; } };
/** 주석·문자열을 지운다 — 주석에 적힌 예시가 «있는 것» 으로 세어지면 거짓 판정이 된다. */
export const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

// ── 판정기(음성 테스트가 같은 것을 쓴다) ────────────────────────────────────

/**
 * 이 소스가 «모달을 언마운트하는가».
 *
 * 판정 = `<Modal` 을 그리는데, **그보다 앞에서** 컴포넌트가 `return null` 로 빠지는가.
 * 그 형태면 닫히는 순간 Modal 자체가 트리에서 사라져 **재마운트**가 일어난다.
 *
 * ⚠️`visible={…}` 로 토글하는 것은 정상이다 — 그때는 앞에서 빠지지 않는다.
 */
export function unmountsModal(src: string): boolean {
  const s = strip(src);
  const at = s.indexOf('<Modal');
  if (at < 0) return false;                       // 모달을 안 그리면 해당 없음
  const before = s.slice(0, at);
  return /\breturn\s+null\s*;/.test(before);
}

/** 이 소스가 `Modal` 을 쓰는가(임포트 + 렌더 둘 다 봐야 주석·타입만 있는 경우에 안 속는다). */
export function usesModal(src: string): boolean {
  const s = strip(src);
  return /\bfrom\s+'react-native'/.test(s) && /\bModal\b/.test(s) && /<Modal[\s/>]/.test(s);
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  const LAYOUT = 'app/src/app/_layout.tsx';
  const layoutSrc = read(LAYOUT);
  if (!layoutSrc) fail('M0', `${LAYOUT} 를 못 읽었다 — 루트 레이아웃 경로가 바뀌었나`);
  else {
    const layout = strip(layoutSrc);
    // 루트가 **그리는** 로컬 컴포넌트만 따라간다(임포트만 하고 안 그리는 것은 제외)
    const hosts = [...layoutSrc.matchAll(/import\s+\{([^}]*)\}\s+from\s+'(\.[^']+)'/g)]
      .flatMap((m) => m[1].split(',').map((n) => ({ name: n.trim(), from: m[2] })))
      .filter((x) => /^[A-Z]/.test(x.name) && new RegExp(`<${x.name}[\\s/>]`).test(layout));

    let checked = 0;
    for (const h of hosts) {
      const base = normalize(join(dirname(LAYOUT), h.from));
      const src = read(base + '.tsx') ?? read(base + '.ts');
      if (!src || !usesModal(src)) continue;
      checked += 1;
      if (unmountsModal(src)) {
        fail('M1', `${h.name} (${base}.tsx) — **모달을 언마운트한다**(<Modal> 앞에 \`return null\`).\n        `
          + '닫힘 애니메이션 도중 재마운트되면 iOS 네이티브 모달이 프리징하거나, 다른 모달과 겹쳐 크래시한다.\n        '
          + '⇒ Modal 은 늘 마운트하고 `visible` 로 토글할 것(`AppAlert.tsx` 가 그 형태다)');
      }
    }
    if (!checked) fail('M1', '루트가 그리는 전역 모달 호스트를 하나도 못 찾았다 — 추적이 끊겼을 수 있다');
  }

  // M2 — 로딩 막은 Modal 이 아니어야 한다
  const busy = read('app/src/components/BusyOverlay.tsx');
  if (!busy) fail('M2', 'BusyOverlay.tsx 를 못 읽었다');
  else if (usesModal(busy)) {
    fail('M2', 'BusyOverlay 가 다시 `Modal` 이 됐다.\n        '
      + '로딩 막은 ①별도 뷰컨트롤러가 필요 없고 ②`absoluteFill` 로 화면을 덮고 터치를 막을 수 있다.\n        '
      + 'Modal 로 두면 뷰컨트롤러가 하나 늘어 **겹칠 상대**가 그만큼 늘어난다(심사 크래시의 그 부류)');
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const RN = "import { Modal, View } from 'react-native';\n";
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'M1: return null 뒤에 Modal → 문다',
      run: () => unmountsModal(RN + 'function H(){ if(!s) return null; return <Modal visible/>; }') === true },
    { name: 'M1: visible 토글이면 통과',
      run: () => unmountsModal(RN + 'function H(){ return <Modal visible={!!s}/>; }') === false },
    { name: 'M1: Modal **뒤**의 return null 에는 안 속는다',
      run: () => unmountsModal(RN + 'function H(){ return <Modal visible={!!s}>{s? <X/> : null}</Modal>; }\nfunction Other(){ return null; }') === false },
    { name: 'M1: 모달이 없으면 해당 없음',
      run: () => unmountsModal("function H(){ if(!s) return null; return <View/>; }") === false },
    { name: 'M1: 주석 속 return null 에 안 속는다',
      run: () => unmountsModal(RN + 'function H(){ /* 예전엔 return null; 이었다 */ return <Modal visible={!!s}/>; }') === false },
    { name: 'M2: Modal 을 쓰면 잡는다',
      run: () => usesModal(RN + 'const A = () => <Modal visible/>;') === true },
    { name: 'M2: View 만 쓰면 통과',
      run: () => usesModal("import { View } from 'react-native';\nconst A = () => <View/>;") === false },
    { name: 'M2: 주석에만 Modal 이 있으면 통과',
      run: () => usesModal("import { View } from 'react-native';\n// 예전엔 <Modal> 이었다\nconst A = () => <View/>;") === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:modalmount — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:modalmount — 전역 모달은 언마운트되지 않고(visible 토글) · 로딩 막은 Modal 이 아니다');
