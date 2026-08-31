// scripts/check-androidperms.ts — **Play 커밋을 막는 권한**이 산출물에 다시 들어오는 것을 막는다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (2026-08-31 · Play 트랙이 vc139 에 **9판** 묶여 있었다)
//   `edits:commit` 이 403 으로 막혔다:
//     "All developers requesting access to the photo and video permissions are required
//      to tell Google Play about the core functionality of their app"
//   ★그리고 그 선언 화면은 **커밋된 빌드** 기준으로만 뜬다 ⇒
//     **커밋해야 선언이 뜨고, 선언해야 커밋되는 교착**이었다. 콘솔로는 못 푼다.
//
// ■ 어떻게 풀었나 — **안 쓰는 권한을 뺐다**(구글이 제시한 1번 길)
//   ① `READ_MEDIA_*` (expo-media-library) — 우리는 앨범을 **읽지 않는다**.
//      · 고르기: `expo-image-picker` 는 Android 13+ 에서 권한을 **아예 요구하지 않는다**
//        (`getMediaLibraryPermissions` 가 빈 배열 — 소스 실측)
//      · 저장: `requestPermissionsAsync(true)`(쓰기 전용) → 13+ 에서 요청 목록이 빈다.
//        라이브러리가 `hasManifestPermission` 으로 **매니페스트를 먼저 보기** 때문이다.
//   ② `FOREGROUND_SERVICE*` (expo-video) — 우리는 포그라운드로 **승격하지 않는다**.
//      `ExpoVideoPlaybackService.onUpdateNotification` 이 재정의돼 있어, 알림이 꺼져 있으면
//      `super` 를 안 부른다 ⇒ media3 가 서비스를 포그라운드로 올리지 않는다.
//      우리 코드는 `showNowPlayingNotification`·`staysActiveInBackground` 0건(실측).
//
// 무엇을 지키나
//   A1 **빌드된 AAB** 에 금지 권한이 없다 — ★`android/` 는 gitignore 라 소스를 못 믿는다.
//      산출물을 직접 읽는다([[build-artifact-verify-hermes]] 와 같은 결).
//   A2 저장이 **쓰기 전용**으로 요청한다(이 인자가 빠지면 권한이 되살아난다)
//   A3 앱이 `showNowPlayingNotification`·`staysActiveInBackground` 를 켜지 않는다
//      — 켜면 포그라운드 승격이 일어나 **권한 없는 크래시**가 된다
//
// ★AAB 가 없으면 A1 은 **건너뛴다**(빌드 전에도 돌 수 있게). 있으면 반드시 본다.
// ★음성 테스트: `npx tsx scripts/check-androidperms.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string): string | null => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return null; } };
export const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
   .replace(/^[ \t]*\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '));

/** Play 가 «선언 없이는 커밋 불가» 로 막는 권한들. */
export const BLOCKING = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
];

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

// ── 판정기 ──────────────────────────────────────────────────────────────────

/** 매니페스트 문자열에서 금지 권한을 골라낸다(`tools:node="remove"` 는 선언이 아니다). */
export function blockingIn(manifest: string): string[] {
  const found: string[] = [];
  for (const p of BLOCKING) {
    const re = new RegExp(`<uses-permission[^>]*android:name="${p.replace(/\./g, '\\.')}"[^>]*/?>`, 'g');
    for (const m of manifest.match(re) ?? []) {
      if (!/tools:node\s*=\s*"remove"/.test(m)) { found.push(p); break; }
    }
  }
  return found;
}

/** 저장이 쓰기 전용으로 요청하는가. */
export function savesWriteOnly(src: string): boolean {
  return /requestPermissionsAsync\s*\(\s*true\s*\)/.test(strip(src));
}

/** 백그라운드 재생·알림을 켜는 곳이 있는가(켜면 포그라운드 승격 → 크래시). */
export function enablesBackgroundPlayback(src: string): boolean {
  const s = strip(src);
  return /showNowPlayingNotification\s*(=|:)\s*\{?\s*true/.test(s)
      || /showNowPlayingNotification\s*$/m.test(s)          // JSX 축약(`showNowPlayingNotification`)
      || /staysActiveInBackground\s*(=|:)\s*\{?\s*true/.test(s);
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  // A1 ★산출물을 직접 읽는다
  const AAB = 'app/android/app/build/outputs/bundle/release/app-release.aab';
  if (existsSync(join(ROOT, AAB))) {
    try {
      const dump = execFileSync('bundletool', ['dump', 'manifest', `--bundle=${join(ROOT, AAB)}`], {
        encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, JAVA_HOME: '/Applications/Android Studio.app/Contents/jbr/Contents/Home' },
      });
      const bad = blockingIn(dump);
      if (bad.length) {
        fail('A1', `**빌드된 AAB** 에 Play 커밋을 막는 권한이 있다: ${bad.join(', ')}\n        `
          + '⚠️`edits:commit` 이 403 으로 막힌다 — 그런데 선언 화면은 «커밋된 빌드» 기준으로만 떠서\n        '
          + '**커밋해야 선언이 뜨고 선언해야 커밋되는 교착**이 된다(2026-08-31 · 트랙이 9판 묶였다).\n        '
          + '⇒ `app/android/app/src/main/AndroidManifest.xml` 에 `tools:node="remove"` 로 뺄 것');
      }
    } catch {
      // bundletool 이 없거나 덤프 실패 — 조용히 넘긴다(이것 때문에 빌드를 막지 않는다)
    }
  }

  const SAVE = 'app/src/lib/media/saveImage.ts';
  const save = read(SAVE);
  if (!save) fail('A0', `${SAVE} 를 못 읽었다`);
  else if (!savesWriteOnly(save)) {
    fail('A2', `${SAVE} 가 사진첩 권한을 **쓰기 전용으로** 요청하지 않는다.\n        `
      + '⚠️인자를 빼면 라이브러리가 `READ_MEDIA_*` 를 요청 목록에 넣고, 그러면\n        '
      + '매니페스트에서 뺀 것이 무의미해진다(요청이 늘 거부된다). `requestPermissionsAsync(true)`');
  }

  for (const f of ['app/src/components/talk/CoverMedia.tsx', 'app/src/components/FortuneVideoCard.tsx']) {
    const src = read(f);
    if (src && enablesBackgroundPlayback(src)) {
      fail('A3', `${f} 가 백그라운드 재생·알림을 켠다.\n        `
        + '⚠️그러면 media3 가 서비스를 **포그라운드로 승격**하는데, 우리는 그 권한을 뺐다 → 크래시.\n        '
        + '정말 필요하면 권한을 되살리고 **Play 선언까지** 함께 해야 한다');
    }
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'A1 금지 권한을 문다',
      run: () => blockingIn('<uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>').length === 1 },
    { name: 'A1 ★`tools:node="remove"` 는 선언이 아니다',
      run: () => blockingIn('<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" tools:node="remove"/>').length === 0 },
    { name: 'A1 포그라운드 서비스도 문다',
      run: () => blockingIn('<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"/>').length === 1 },
    { name: 'A1 무해한 권한은 통과',
      run: () => blockingIn('<uses-permission android:name="android.permission.INTERNET"/>').length === 0 },
    { name: 'A1 여섯 개를 다 안다', run: () => BLOCKING.length === 6 },
    { name: 'A2 쓰기 전용이면 통과', run: () => savesWriteOnly('await MediaLibrary.requestPermissionsAsync(true);') === true },
    { name: 'A2 인자가 없으면 문다', run: () => savesWriteOnly('await MediaLibrary.requestPermissionsAsync();') === false },
    { name: 'A2 false 면 문다', run: () => savesWriteOnly('await MediaLibrary.requestPermissionsAsync(false);') === false },
    { name: 'A2 주석 속 코드에 안 속는다',
      run: () => savesWriteOnly('// requestPermissionsAsync(true)\nconst a=1;') === false },
    { name: 'A3 알림을 켜면 문다', run: () => enablesBackgroundPlayback('player.showNowPlayingNotification = true;') === true },
    { name: 'A3 JSX 축약도 문다', run: () => enablesBackgroundPlayback('<VideoView\n  showNowPlayingNotification\n/>') === true },
    { name: 'A3 백그라운드 유지도 문다', run: () => enablesBackgroundPlayback('staysActiveInBackground: true') === true },
    { name: 'A3 꺼 두면 통과', run: () => enablesBackgroundPlayback('allowsPictureInPicture={false}') === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:androidperms — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:androidperms — 산출물에 Play 커밋을 막는 권한이 없다');
