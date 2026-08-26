#!/usr/bin/env node
// scripts/bump-build.mjs — 빌드번호를 **두 곳에 한 번에** 올린다
// ═══════════════════════════════════════════════════════════════════════════
// 2026-08-27: vc124 를 올리다 `check:buildnum` 에 막혔다 —
//   `android/app/build.gradle` 의 versionCode 만 올리고 `buildInfo.ts` 의 APP_BUILD 를 안 올렸다.
//
// ■ ★왜 «주석으로 시키는 것» 으로는 부족했나
//   buildInfo.ts 는 이미 이렇게 적어 두고 있었다:
//     *"버전을 올릴 때: build.gradle 의 versionCode 와 **이 값을 같이** 올린다"*
//   그런데도 어긋났다. **사람이 두 곳을 기억해야 하는 구조가 곧 드리프트**다.
//   하네스(`check:buildnum`)는 잡아 주지만 **preflight 에서** 잡는다 —
//   그때는 이미 55초 빌드 + 51MB 업로드를 지난 뒤다(실제로 vc124 AAB 가 그렇게 올라갔다).
//   ⇒ 검사보다 **앞**에, 애초에 갈라지지 않게 하는 명령을 둔다.
//
// ■ 왜 gradle 을 «단일 출처» 로 못 삼나
//   `android/` 는 prebuild 산출물이라 .gitignore 다 — JS 가 그 파일을 import 할 수 없고,
//   `Constants.nativeBuildVersion` 은 expo-constants 17 에서 undefined 로 온다(실측).
//   ⇒ 두 곳은 남기되 **쓰기를 한 명령으로 묶는다.**
//
// 실행:
//   node scripts/bump-build.mjs        # 현재값 +1
//   node scripts/bump-build.mjs 130    # 특정 값으로
//   node scripts/bump-build.mjs --show # 조회만
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GRADLE = path.join(ROOT, 'app/android/app/build.gradle');
const JS = path.join(ROOT, 'app/src/lib/core/buildInfo.ts');

const G_RE = /(versionCode\s+)(\d+)/;
const J_RE = /(export const APP_BUILD\s*=\s*)(\d+)/;

/**
 * 파일에서 빌드번호를 읽는다.
 * @param {string} file 경로
 * @param {RegExp} re   1그룹=앞부분 · 2그룹=숫자
 * @returns {{src:string, val:number, m:RegExpExecArray}}
 */
function read(file, re) {
  if (!fs.existsSync(file)) throw new Error(`없는 파일: ${path.relative(ROOT, file)}`);
  const src = fs.readFileSync(file, 'utf8');
  const m = re.exec(src);
  if (!m) throw new Error(`${path.relative(ROOT, file)} 에서 빌드번호를 못 찾았습니다`);
  return { src, val: Number(m[2]), m };
}

const g = read(GRADLE, G_RE);
const j = read(JS, J_RE);

const arg = process.argv[2];
if (arg === '--show') {
  console.log(`  build.gradle versionCode = ${g.val}`);
  console.log(`  buildInfo.ts  APP_BUILD  = ${j.val}`);
  console.log(g.val === j.val ? '  ✅ 일치' : '  ✗ 어긋남 — `node scripts/bump-build.mjs <값>` 으로 맞추세요');
  process.exit(g.val === j.val ? 0 : 1);
}

// ★기준은 **둘 중 큰 쪽**이다. 한쪽만 올라간 상태에서 +1 하면 이미 쓴 번호를 또 쓸 수 있다
//   (Play 는 같은 versionCode 를 두 번 안 받는다).
const base = Math.max(g.val, j.val);
const next = arg ? Number(arg) : base + 1;
if (!Number.isInteger(next) || next <= 0) { console.error(`  ✗ 숫자가 아닙니다: ${arg}`); process.exit(1); }
if (next < base) console.warn(`  ⚠️내림: ${base} → ${next} (Play 는 내린 번호를 거부합니다)`);

fs.writeFileSync(GRADLE, g.src.slice(0, g.m.index) + g.m[1] + next + g.src.slice(g.m.index + g.m[0].length));
fs.writeFileSync(JS, j.src.slice(0, j.m.index) + j.m[1] + next + j.src.slice(j.m.index + j.m[0].length));

// ★쓴 뒤 **다시 읽어** 확인한다 — 정규식이 엉뚱한 곳을 잡았어도 여기서 드러난다
const g2 = read(GRADLE, G_RE), j2 = read(JS, J_RE);
if (g2.val !== next || j2.val !== next) {
  console.error(`  ✗ 쓰기 확인 실패 — gradle=${g2.val} js=${j2.val} (원했던 값 ${next})`);
  process.exit(1);
}
console.log(`  ✅ 빌드번호 ${base} → ${next} (build.gradle · buildInfo.ts 둘 다)`);
