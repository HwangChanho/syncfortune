#!/usr/bin/env tsx
// scripts/check-reading-video.ts — (재정의 2026-08-05) 영상 '부활' 방지 하네스
// ─────────────────────────────────────────────────────────────────────────
// 종전 이 하네스는 "영상 렌더는 반드시 on/off 게이트를 탄다"를 강제했다(07-19~20 반복버그
// "껐는데 계속 나온다"). daniel 2026-08-05 "풀이 로딩영상이랑 로딩화면 영상 다 없애버려"로
// 영상이 **전면 제거**되면서 게이트 강제는 뜻을 잃었다 — 이제 지킬 불변식은 반대다:
// **영상이 조용히 되살아나면 안 된다.** (mp4 는 require 만 남아도 번들에 실린다 — 11MB.)
//
// 규칙:
//   V1) app/src 에 expo-video import 금지(VideoView/useVideoPlayer 렌더 부활 차단)
//   V2) app/src 에 .mp4 require/import 금지(번들 자산 부활 차단)
//   V3) 제거된 컴포넌트 파일 부활 금지(DoorReveal/VideoSplash)
//   V4) app/assets 에 mp4 파일 잔존 금지(참조 없어도 파일이 남으면 다음 사람이 다시 연결한다)
// 음성테스트: src 파일에 `.mp4` require 를 임시로 넣으면 V2 가 문다(2026-08-05 확인).
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let fail = 0;
const ok = (m: string) => console.log(`  ✅ ${m}`);
const bad = (m: string) => { console.error(`  ❌ ${m}`); fail++; };

const files: string[] = [];
(function walk(d: string) {
  for (const n of readdirSync(d)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) files.push(p);
  }
})(join(ROOT, 'app/src'));

console.log('■ check:reading-video — 로딩/풀이 영상 부활 방지(2026-08-05 전면 제거 이후)\n');

{ // V1 expo-video
  const hits = files.filter((f) => /from ['"]expo-video['"]/.test(readFileSync(f, 'utf8')));
  if (hits.length) bad(`[V1] expo-video import 부활 ${hits.length}건: ${hits.map((f) => relative(ROOT, f)).join(', ')}`);
  else ok('[V1] expo-video import 없음');
}
{ // V2 mp4 require
  const hits = files.filter((f) => /require\([^)]*\.mp4['"]\)|from ['"][^'"]*\.mp4['"]/.test(readFileSync(f, 'utf8')));
  if (hits.length) bad(`[V2] mp4 번들 참조 부활 ${hits.length}건(번들 크기 되돌아감): ${hits.map((f) => relative(ROOT, f)).join(', ')}`);
  else ok('[V2] mp4 require/import 없음');
}
{ // V3 제거 컴포넌트
  const ghosts = ['app/src/components/DoorReveal.tsx', 'app/src/components/VideoSplash.tsx'].filter((p) => existsSync(join(ROOT, p)));
  if (ghosts.length) bad(`[V3] 제거된 영상 컴포넌트 부활: ${ghosts.join(', ')}`);
  else ok('[V3] DoorReveal/VideoSplash 없음');
}
{ // V4 assets mp4
  const found: string[] = [];
  (function walkA(d: string) {
    if (!existsSync(d)) return;
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walkA(p);
      else if (n.endsWith('.mp4')) found.push(relative(ROOT, p));
    }
  })(join(ROOT, 'app/assets'));
  if (found.length) bad(`[V4] assets 에 mp4 잔존 ${found.length}건: ${found.join(', ')}`);
  else ok('[V4] assets mp4 없음');
}

console.log(fail ? `\n❌ check:reading-video FAIL ${fail}건` : '\n✅ check:reading-video 통과 — 영상 부활 없음');
process.exit(fail ? 1 : 0);
