#!/usr/bin/env tsx
// scripts/check-reading-video.ts — (재정의 2026-08-25) 영상 규칙 — **장식은 금지 · 콘텐츠는 허용**
// ─────────────────────────────────────────────────────────────────────────
// 종전 이 하네스는 "영상 렌더는 반드시 on/off 게이트를 탄다"를 강제했다(07-19~20 반복버그
// "껐는데 계속 나온다"). daniel 2026-08-05 "풀이 로딩영상이랑 로딩화면 영상 다 없애버려"로
// 영상이 **전면 제거**되면서 게이트 강제는 뜻을 잃었다 — 이제 지킬 불변식은 반대다:
// **영상이 조용히 되살아나면 안 된다.** (mp4 는 require 만 남아도 번들에 실린다 — 11MB.)
//
// ★★2026-08-25 Boss 정정 — 내가 **두 가지를 뭉쳐 놓고 있었다**:
//   *"저건 풀이진입 영상이랑 로딩화면 이야기고 **월별 년별 전체 운세풀이 영상은 다른거**잖아"*
//   맞다. 08-05 에 없앤 것은 **장식**(로딩·진입 연출)이고, 그때 문제는 두 가지였다:
//     ①번들에 mp4 가 실려 **11MB** 가 붙었다  ②껐는데 계속 나오는 게이트 버그
//   **콘텐츠 영상**(월별·년별 운세 풀이)은 그 둘 다 아니다 — 사용자가 **보러 오는 것**이고,
//   원격(Storage)에서 스트리밍하면 번들도 안 붙는다.
//   ⇒ 규칙을 **장식/콘텐츠로 가른다.** 지켜야 할 불변식은 *"번들에 mp4 를 넣지 마라"* 와
//     *"로딩·스플래시 장식을 되살리지 마라"* 이지, "영상을 쓰지 마라"가 아니었다.
//
// 규칙:
//   V1) 영상 재생은 **원격 URL 로만** — 로딩·스플래시 자리에서는 여전히 금지
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

console.log('■ check:reading-video — **장식 영상은 금지 · 콘텐츠 영상은 허용(원격만)**\n');

{ // V1 영상 재생 — 콘텐츠는 허용 · **장식 자리에서는 금지**
  //   ★장식 = 스플래시·로딩·진입 연출. 이름으로 판별한다(그 자리 파일명이 그렇게 생겼다).
  const DECOR = /(splash|loading|doorreveal|videosplash|intro)/i;
  const users = files.filter((f) => /from ['"]expo-video['"]/.test(readFileSync(f, 'utf8')));
  const decor = users.filter((f) => DECOR.test(relative(ROOT, f)));
  if (decor.length) bad(`[V1] **장식 자리**에서 영상을 쓴다 ${decor.length}건 — 08-05 에 없앤 그것이다: ${decor.map((f) => relative(ROOT, f)).join(', ')}`);
  else ok(users.length ? `[V1] 영상 사용 ${users.length}건 — 전부 콘텐츠 자리(장식 아님)` : '[V1] 영상 사용 없음');
}
{ // V2 mp4 require
  const hits = files.filter((f) => /require\([^)]*\.mp4['"]\)|from ['"][^'"]*\.mp4['"]/.test(readFileSync(f, 'utf8')));
  // ★이 규칙은 **그대로 둔다** — 번들 11MB 사고의 원인이 바로 이것이다.
  //   콘텐츠 영상도 **원격 URL 로** 재생한다(번들에 넣지 않는다).
  if (hits.length) bad(`[V2] mp4 를 **번들에** 넣었다 ${hits.length}건(11MB 사고 재발) — 원격 URL 로 재생할 것: ${hits.map((f) => relative(ROOT, f)).join(', ')}`);
  else ok('[V2] mp4 번들 참조 없음(원격 재생만)');
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

console.log(fail ? `\n❌ check:reading-video FAIL ${fail}건` : '\n✅ check:reading-video 통과 — 장식 영상 없음 · 번들 mp4 없음');
process.exit(fail ? 1 : 0);
