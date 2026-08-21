/**
 * check:bottominset — 스크롤 화면의 **마지막 요소가 '누를 것'인데** 하단 여백이
 * 전역 하단 크롬(광고 배너 + 네비바 + 홈 인디케이터)보다 작은 경우를 막는다.
 * ─────────────────────────────────────────────────────────────────────────
 * 왜 (daniel 2026-08-07 "명식 등록이 짤려"):
 *   `_layout` 이 모든 화면 아래에 AdBanner + BottomNav 를 깔아 두는데, 스크롤 콘텐츠의
 *   맨 끝은 그 아래로 들어간다. 여백이 모자라면 **마지막 요소가 통째로 사라진다.**
 *   명식 등록 화면은 마지막이 '명식 계산 · 등록' 버튼이라 **등록 자체가 불가능**했다.
 *   시뮬 실측: paddingBottom 48 → 버튼 안 보임 / 176 → 배너 위에 온전히 보임.
 *
 * ★판정을 좁히는 이유(오탐이 하네스를 죽인다 — 08-01 교훈):
 *   여백이 모자란 화면은 앱 전체에 많지만, 대부분 마지막이 '읽는 것'(추천 목록·설명)이라
 *   조금 가려도 기능이 죽지 않는다. **기능이 죽는 경우 = 마지막이 누를 것**뿐이라 거기만 본다.
 *   (같은 이유로 처음 만든 판이 멀쩡한 화면 13개를 잡아 폐기한 이력이 있다.)
 *
 * 판정 방식:
 *   1) 화면 파일(app/(app)/**, screens/**)에서 **최외곽** ScrollView 를 찾는다
 *      — `rfind('</ScrollView>')`. 첫 번째를 잡으면 **가로 칩 스크롤러**에 오탐난다(실제로 겪음).
 *   2) 닫는 태그 직전 구간에 Pressable 계열이 있으면 '마지막이 누를 것'으로 본다.
 *      주석 줄은 제외한다 — 주석의 낱말에 걸리는 사고 방지(08-01).
 *   3) 그 화면의 contentContainerStyle 이 가리키는 스타일의 paddingBottom 이
 *      MIN_BOTTOM 미만이면 실패.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** 하단 크롬 실측 합(pt): 광고 배너 50 + 네비바(패딩16+내용~30+패딩24=70) + 바 마진 16 + 홈 인디케이터 34. */
const MIN_BOTTOM = 170;
const ROOTS = ['app/src/app/(app)', 'app/src/screens'];
const PRESSABLE = /<(PressableScale|Pressable|TouchableOpacity|TouchableHighlight|Button)\b/;

/** .tsx 파일 경로 재귀 수집. */
function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/**
 * `styles.<name>` 의 paddingBottom 을 pt 로 돌려준다.
 * @returns space(n) → n*4 / 숫자 리터럴 → 그대로 / 못 찾으면 null
 */
function paddingBottomOf(src: string, name: string): number | null {
  const sm = new RegExp(`\\b${name}\\s*:\\s*\\{([^}]*)\\}`).exec(src);
  if (!sm) return null;
  const sp = /paddingBottom:\s*space\(([\d.]+)\)/.exec(sm[1]);
  if (sp) return parseFloat(sp[1]) * 4;
  const lit = /paddingBottom:\s*(\d+)/.exec(sm[1]);
  return lit ? parseInt(lit[1], 10) : null;
}

const bad: { file: string; pb: number | null }[] = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = readFileSync(file, 'utf8');
    const close = src.lastIndexOf('</ScrollView>'); // ★최외곽(가장 늦게 닫히는 것)
    if (close < 0) continue;

    // 닫는 태그 직전 = 마지막 자식들. 주석 줄은 판정에서 제외.
    const tail = src.slice(Math.max(0, close - 320), close)
      .split('\n')
      .filter((l) => !l.trim().startsWith('{/*') && !l.trim().startsWith('*') && !l.trim().startsWith('//'))
      .join('\n');
    if (!PRESSABLE.test(tail)) continue; // 마지막이 '읽는 것' → 가려도 기능은 산다

    // ⚠️★**가로 스크롤러를 세로로 재던 버그**(2026-08-21 `room.tsx` 에서 드러남).
    //   이 파일의 유일한 ScrollView 가 가로 칩 목록이었는데, 파일에서 **첫 번째**
    //   `contentContainerStyle` 을 집어 그 8pt 를 '화면 하단 여백'으로 읽고 실패시켰다.
    //   (하네스 주석이 §1 에서 경고해 둔 바로 그 오탐을, 스타일 참조 쪽에서 다시 저질렀다.)
    //   ⇒ ①`horizontal` 스크롤러는 **세로 여백 개념이 없으니** 판정에서 뺀다
    //     ②여백은 **그 스크롤러 자신의** contentContainerStyle 에서 읽는다(첫 매치가 아니라).
    const opens = [...src.matchAll(/<ScrollView\b[^>]*>/g)];
    const vertical = opens.filter((m) => !/\bhorizontal\b/.test(m[0]));
    if (!vertical.length) continue;                       // 가로 스크롤러뿐 = 이 판정의 대상이 아니다
    const outer = vertical[vertical.length - 1][0];       // 최외곽(가장 늦게 열린 세로 스크롤러)
    const ref = /contentContainerStyle=\{(?:\[)?styles\.([A-Za-z0-9_]+)/.exec(outer);
    const pb = ref ? paddingBottomOf(src, ref[1]) : null;
    if (pb === null || pb < MIN_BOTTOM) bad.push({ file, pb });
  }
}

console.log('📐 check:bottominset — 마지막이 버튼인 화면의 하단 여백');
console.log(`   기준 ${MIN_BOTTOM}pt = 광고 배너 50 + 네비바 86 + 홈 인디케이터 34(실측)`);
if (bad.length) {
  for (const b of bad) {
    console.log(`  ❌ ${b.file} — paddingBottom ${b.pb === null ? '지정 없음' : b.pb + 'pt'}`);
  }
  console.log('\n  스크롤 맨 아래가 배너·네비 뒤로 들어갑니다. 마지막이 버튼이면 **버튼이 통째로 사라져** 기능이 죽습니다.');
  console.log(`  → contentContainerStyle 의 paddingBottom 을 space(44)(=176pt) 이상으로.`);
  console.log(`\n❌ check:bottominset 실패 — ${bad.length}건`);
  process.exit(1);
}
console.log('  ✓ 마지막이 버튼인 화면 전부 하단 크롬만큼 여백 확보');
console.log('✅ check:bottominset 통과');
