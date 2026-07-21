#!/usr/bin/env tsx
// scripts/check-reading-video.ts
// ─────────────────────────────────────────────────────────────────────────
// 풀이영상 온오프 회귀 방지 하네스 (daniel 07-19~20 반복버그: "껐는데 자꾸 씨발 계속 나오잖아").
//   근본원인은 매번 동일 = '영상 렌더 지점 중 하나가 getReadingVideoEnabled 게이트를 안 탐'
//   (07-19 UnlockOverlay·인트로 / 07-20 DoorReveal). 사람이 매번 놓치는 종류 → 하네스로 못박는다.
//
// ★설계 원칙(메모리 error-harness-prebuild-check): '이름'이 아니라 '렌더'로 판정한다.
//   = 실제로 <VideoView>(expo-video 플레이어)를 그리는 파일을 전수로 찾아, 각자 올바른 게이트를 참조하는지 본다.
//   그래야 컴포넌트명이 바뀌거나 새 화면이 영상을 직접 그려도 빠짐없이 걸린다.
//
// 2축(app/src/lib/theme.ts):
//   · 풀이영상  getReadingVideoEnabled()   — 풀이 공개 연출(DoorReveal 문열림·UnlockOverlay 자물쇠). 끄면 영상 없이 즉시 공개.
//   · 인트로     getLoadingMode()==='video' — 앱 실행 스플래시(VideoSplash 왕궁문→호랑이). ★별개 축, 호출부(_layout)에서 게이트.
//
// 규칙:
//   R1) <VideoView> 를 렌더하는 파일은 아래 '알려진 분류'에 등록돼 있어야 한다.
//       → 새 파일이 영상을 그리면 FAIL(개발자에게 "이건 풀이영상이냐 인트로냐, 게이트 배선했냐"를 강제).
//   R2) 풀이영상 파일은 getReadingVideoEnabled 를 반드시 참조한다(자체 게이트 = 끄면 안 뜸).
//   R3) 인트로 스플래시(VideoSplash)의 오케스트레이터(app/_layout.tsx)는 getLoadingMode 를 참조한다.
// ─────────────────────────────────────────────────────────────────────────
import * as fs from 'fs';
import * as path from 'path';

// npm 스크립트는 레포 루트에서 실행 → cwd 기준. (다른 곳에서 돌려도 app/src 를 찾도록 상향 탐색 폴백)
function resolveSrc(): string {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    const cand = path.join(dir, 'app', 'src');
    if (fs.existsSync(cand)) return cand;
    dir = path.dirname(dir);
  }
  return path.resolve('app/src');
}
const SRC = resolveSrc();
const rel = (p: string) => path.relative(SRC, p).replace(/\\/g, '/');

// ── 알려진 분류(새 <VideoView> 파일이 생기면 여기 등록 + 게이트 배선 강제) ──────────────────
const READING_VIDEO_FILES = ['components/DoorReveal.tsx', 'components/UnlockOverlay.tsx']; // 풀이영상 = getReadingVideoEnabled 필수
const INTRO_SPLASH_FILES = ['components/VideoSplash.tsx'];                                 // 인트로 = getLoadingMode(호출부)
const KNOWN = new Set([...READING_VIDEO_FILES, ...INTRO_SPLASH_FILES]);

// ── src 전체 walk → 실제로 <VideoView 를 렌더하는(=JSX) .tsx 파일 수집 ──────────────────────
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}
// <VideoView 뒤에 공백/자닫힘/닫힘이 와야 렌더(import 의 'VideoView' 문자열은 '<' 가 없어 제외).
const RENDER_RE = /<VideoView[\s/>]/;

const fails: string[] = [];
const videoFiles = walk(SRC).filter((p) => RENDER_RE.test(fs.readFileSync(p, 'utf8'))).map(rel);

// R1: 모든 <VideoView> 렌더 파일이 알려진 분류인가(미분류 신규 = 게이트 누락 위험 → 강제 검토)
for (const f of videoFiles) {
  if (!KNOWN.has(f)) {
    fails.push(`[R1] 새 <VideoView> 렌더 파일 미분류: ${f}\n        → 풀이영상이면 READING_VIDEO_FILES 에, 인트로면 INTRO_SPLASH_FILES 에 등록하고 게이트(getReadingVideoEnabled / getLoadingMode)를 배선하라.`);
  }
}

// R2: 풀이영상 파일은 getReadingVideoEnabled 자체 게이트
for (const f of READING_VIDEO_FILES) {
  const p = path.join(SRC, f);
  if (!fs.existsSync(p)) { fails.push(`[R2] 풀이영상 파일 없음(이동/삭제?): ${f} — 분류 목록을 갱신하라.`); continue; }
  if (!fs.readFileSync(p, 'utf8').includes('getReadingVideoEnabled')) {
    fails.push(`[R2] 풀이영상 게이트 누락: ${f} 가 getReadingVideoEnabled 를 참조하지 않음\n        → 설정에서 껐는데 영상이 뜨는 반복버그 재발. 렌더 전에 게이트를 확인하거나 컴포넌트 내부에서 OFF 시 즉시 onDone/무영상 처리하라.`);
  }
}

// R3: 인트로 스플래시 오케스트레이터가 getLoadingMode 참조(인트로 끄기 'text'/'off' 가 먹히게)
const layout = path.join(SRC, 'app', '_layout.tsx');
if (!fs.existsSync(layout) || !fs.readFileSync(layout, 'utf8').includes('getLoadingMode')) {
  fails.push(`[R3] 인트로 게이트 누락: app/_layout.tsx 가 getLoadingMode 를 참조하지 않음 → 인트로 모드('text'/'off')가 안 먹힐 수 있음.`);
}

// ── 출력(다른 check:* 와 동일 관례: FAIL 시 exit 1) ──────────────────────────────────────
if (fails.length) {
  console.error('❌ check:reading-video FAIL — 영상 게이트 배선 문제 ' + fails.length + '건\n' + fails.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log(`✓ check:reading-video PASS — <VideoView> 렌더 ${videoFiles.length}곳(풀이영상 ${READING_VIDEO_FILES.length}·인트로 ${INTRO_SPLASH_FILES.length}) 전부 올바른 게이트 배선.`);
