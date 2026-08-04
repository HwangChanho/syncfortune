// scripts/check-platform.ts — Android/iOS 플랫폼 갈림 하네스
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-04 "다른 부분도 안드로이드 iOS 기준 다를 수 있는 부분 찾아서 고쳐".
// 발단 = 배너 광고가 Android 에서만 탭바에 안 붙던 버그(insets.bottom 잔재).
// 그날 전수조사에서 나온 갈림 유형을 규칙으로 못박는다 — 새 코드가 같은 구멍을 다시 파면 여기서 잡힌다.
//
// ⚠️판정은 '이름'이 아니라 '표현식'으로([[harness-judge-expression-not-name]]) —
//   JSX 태그 문자열을 직접 뜯고, 주석 속 단어(`<Modal> 안에서` 같은 산문)에 속지 않게
//   실제 태그(`<Modal` + 공백/줄바꿈)만 센다. 음성 테스트 완료(아래 각 규칙 주석).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => { failed++; console.log(`  ✗ ${m}`); };

// app/src 의 모든 tsx 수집
const files: string[] = [];
(function walk(d: string) {
  for (const n of readdirSync(d)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(p)) files.push(p);
  }
})(join(ROOT, 'app/src'));

// JSX <Modal …> 여는 태그들.
// ★주석을 **먼저 벗겨내고** 스캔한다 — 첫 판이 HomeOrderEditModal 9행의 산문
//   "RN <Modal> 안에서" 를 태그로 오인해 오탐을 냈다(하네스 자신이 '이름 판정' 함정을 밟음).
//   줄주석·블록주석·JSX 주석 전부 제거된다. (⚠️이 설명을 블록주석으로 쓰면 예시 별표-슬래시가
//   주석을 조기 종료시켜 파일이 깨진다 — 실제로 한 번 깨졌다. 그래서 줄주석.)
function modalTags(src: string): string[] {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const out: string[] = [];
  const re = /<Modal[\s>]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const end = code.indexOf('>', m.index);
    if (end > 0) out.push(code.slice(m.index, end + 1));
  }
  return out;
}

console.log('📱 check:platform — Android/iOS 갈림 방지\n');

// ── P1: transparent Modal 은 statusBarTranslucent 필수 ─────────────────────
// 없으면 Android 에서 상태바 띠가 dim 밖에 남는다(iOS 는 자동으로 덮음).
// 음성테스트: ChartPicker 의 statusBarTranslucent 를 지우면 이 규칙이 문다(2026-08-04 확인).
{
  const viol: string[] = [];
  for (const f of files) {
    for (const tag of modalTags(readFileSync(f, 'utf8'))) {
      if (/\btransparent\b/.test(tag) && !/statusBarTranslucent/.test(tag)) viol.push(relative(ROOT, f));
    }
  }
  if (viol.length) bad(`[P1] transparent Modal 에 statusBarTranslucent 없음 ${viol.length}건: ${[...new Set(viol)].join(', ')}`);
  else ok('[P1] transparent Modal 전부 statusBarTranslucent');
}

// ── P2: 모든 Modal 은 onRequestClose 필수(Android 뒤로가기 계약) ────────────
// 닫히면 안 되는 오버레이(결제 중 등)도 **명시적 no-op** 으로 의도를 남긴다.
// 음성테스트: BusyOverlay 의 onRequestClose 를 지우면 이 규칙이 문다(2026-08-04 확인).
{
  const viol: string[] = [];
  for (const f of files) {
    for (const tag of modalTags(readFileSync(f, 'utf8'))) {
      if (!/onRequestClose/.test(tag)) viol.push(relative(ROOT, f));
    }
  }
  if (viol.length) bad(`[P2] onRequestClose 없는 Modal ${viol.length}건(Android 뒤로가기 먹통): ${[...new Set(viol)].join(', ')}`);
  else ok('[P2] Modal 전부 onRequestClose(no-op 포함)');
}

// ── P3: clearButtonMode(iOS 전용)를 쓰면 Android 대체 지우기 UI 가 같은 파일에 있어야 ──
{
  const viol: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (/clearButtonMode/.test(src) && !/Android[^\n]*지우기|수동 지우기|clear.*button.*android/i.test(src)) viol.push(relative(ROOT, f));
  }
  if (viol.length) bad(`[P3] clearButtonMode(iOS 전용)만 있고 Android 지우기 대체 없음: ${viol.join(', ')}`);
  else ok('[P3] clearButtonMode 사용처에 Android 대체 지우기 존재');
}

// ── P4: AndroidManifest 의 adjustResize 유지 ────────────────────────────────
// automaticallyAdjustKeyboardInsets 는 iOS 전용 — Android 키보드 회피는 전적으로
// windowSoftInputMode="adjustResize" 가 담당한다(이걸 빼면 화면 10곳이 Android 에서 키보드에 덮인다).
{
  const manifest = readFileSync(join(ROOT, 'app/android/app/src/main/AndroidManifest.xml'), 'utf8');
  if (/windowSoftInputMode="adjustResize"/.test(manifest)) ok('[P4] AndroidManifest windowSoftInputMode=adjustResize 유지');
  else bad('[P4] AndroidManifest 에 adjustResize 가 없다 — iOS 전용 자동인셋에 기대던 화면들이 Android 에서 키보드에 덮인다');
}

// ── P5: AdBanner 는 insets.bottom 을 다시 쓰면 안 된다(2026-08-04 수정 회귀 가드) ──
{
  const src = readFileSync(join(ROOT, 'app/src/components/AdBanner.tsx'), 'utf8');
  // 주석 제거 후 판정(수정 경위 주석에 'insets.bottom' 단어가 남아 있다)
  const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  if (/insets\.bottom/.test(code)) bad('[P5] AdBanner 가 insets.bottom 을 다시 쓴다 — 배너↔탭바 틈 회귀(탭바 위 요소는 인셋 금지)');
  else ok('[P5] AdBanner 에 insets.bottom 없음(틈 회귀 방지)');
}

// ── P6: BottomNav 는 Android 시스템 내비 인셋을 반영해야 한다 ───────────────
{
  const src = readFileSync(join(ROOT, 'app/src/components/BottomNav.tsx'), 'utf8');
  if (/Math\.max\(NAV_MARGIN_BOTTOM,\s*insets\.bottom\)/.test(src)) ok('[P6] BottomNav 가 Android 인셋(3버튼 내비) 반영');
  else bad('[P6] BottomNav 가 시스템 내비 인셋을 안 받는다 — Android 3버튼 기기에서 탭바가 덮인다');
}

console.log(failed ? `\n❌ check:platform 실패 ${failed}건` : '\n✅ check:platform 통과 — Android/iOS 갈림 없음');
process.exit(failed ? 1 : 0);
