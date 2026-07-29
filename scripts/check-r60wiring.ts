// scripts/check-r60wiring.ts — R60 애정 이원분석 배선 하네스
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-29 "배포해" → 배포했는데 **아무 효과가 없었다.**
//   엔진·프롬프트 모듈은 만들었지만 `interpret` 이 그걸 **호출하지 않았고**,
//   Edge(_shared)에는 엔진 사본도 없었다(engine/ 은 Node 용이라 Deno 가 못 읽는다).
//   배포는 성공했고 타입체크도 통과했다 — **에러가 없어서 안 보였다.**
//   (07-26 headline 유실, qa 필드와 같은 유형: "만들어만 놓고 안 그린다")
//
// 지키는 것: 앱 산출 → body → Edge 수신 → 프롬프트 주입 **4단이 전부 연결**돼 있는가.
// 실행: npm run check:r60wiring
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => { try { return readFileSync(`${ROOT}${p}`, 'utf8'); } catch { return null; } };
const strip = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

console.log('\n🔎 R60 애정 이원분석 배선\n');

// ── ① 앱: 온디바이스 산출기 ────────────────────────────────────────────
{
  const b = read('app/src/lib/engine/romanceMirror.ts');
  if (!b) bad('① romanceMirror.ts 가 없다 — 앱이 R60 을 계산하지 않는다');
  else {
    const c = strip(b);
    if (/analyzeStarPalace/.test(c) && /concordanceOf/.test(c)) ok('① 앱 산출기가 성궁 + concordance 를 쓴다');
    else bad('① 산출기가 성궁/게이트를 안 쓴다');
    // 게이트가 STAR_PALACE_ONLY 면 경상 프로파일을 **보내지 않아야** 한다
    if (/render !== 'STAR_PALACE_ONLY'/.test(c)) ok('① 게이트 미달 시 경상 프로파일 미전송');
    else bad("① STAR_PALACE_ONLY 인데도 경상 프로파일을 서버로 보낸다 — 게이트 무력화");
  }
}

// ── ② 앱: 호출 지점이 body 에 싣는가 ──────────────────────────────────
{
  const sites = ['app/src/components/SpecialContentScreen.tsx', 'app/src/app/(app)/love.tsx'];
  for (const f of sites) {
    const c = strip(read(f) ?? '');
    if (/buildRomanceMirror\(/.test(c) && /romance/.test(c)) ok(`② ${f.split('/').pop()} 가 romance 를 body 에 싣는다`);
    else bad(`② ${f.split('/').pop()} 가 romance 를 안 보낸다 — 그 화면은 R60 이 적용되지 않는다`);
  }
}

// ── ③ Edge: 수신하는가 ────────────────────────────────────────────────
{
  const c = strip(read('supabase/functions/interpret/index.ts') ?? '');
  if (/romance:\s*bodyRomance/.test(c)) ok('③ Edge 가 body.romance 를 받는다');
  else bad('③ Edge 가 romance 를 수신하지 않는다 — 보내도 버려진다');
}

// ── ④ Edge: 프롬프트에 주입하는가 ─────────────────────────────────────
{
  const c = strip(read('supabase/functions/interpret/index.ts') ?? '');
  if (/buildMirrorRomanceBlock\(/.test(c)) ok('④ 프롬프트 블록 생성 호출됨');
  else bad('④ buildMirrorRomanceBlock 을 부르지 않는다 — 모듈만 있고 안 쓴다');
  if (/genUser\s*=\s*[^;]*romanceBlock/.test(c)) ok('④ genUser 에 실제로 붙는다');
  else bad('④ 블록을 만들고도 genUser 에 안 붙인다(만들어만 놓고 안 그리는 유형)');
  if (/MIRROR_GUARDRAILS/.test(c)) ok('④ 가드레일이 프롬프트에 포함된다');
  else bad('④ 가드레일이 빠졌다 — §9 하드 제약 무효');
}

console.log(fail ? `\n❌ check:r60wiring 실패 ${fail}건` : '\n✅ check:r60wiring 통과 — 앱 산출 → body → Edge 수신 → 프롬프트 4단 연결');
process.exit(fail ? 1 : 0);
