// scripts/check-qa-sweep.ts — QA 전수검수에서 확정된 방어선
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-29: "기능적인거 문제 없는지 코드 전체 검수해 너가 qa팀 팀장이란 생각으로"
//
// ★여기 모은 것은 **오늘 실제로 사고가 났던 유형**을 다른 곳에 대입해 찾은 것들이다.
//   전부 "에러 없이 조용히" 잘못되는 종류라 눈·타입체크로는 안 잡힌다.
//
// 실행: npm run check:qa-sweep
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => { try { return readFileSync(`${ROOT}${p}`, 'utf8'); } catch { return null; } };
const walk = (d: string, out: string[] = []): string[] => {
  let ents: any[]; try { ents = readdirSync(`${ROOT}${d}`, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = `${d}/${e.name}`;
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
};

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

console.log('\n🔎 QA 전수검수 방어선\n');

// ── ① 공유 링크: 과거에 뿌려진 Edge 링크가 Pages 로 살아나는가 ───────────
// (앱만 고치면 **이미 카톡에 보낸 링크**는 계속 죽어 있다 — 오늘 실제로 그랬다)
{
  const sh = read('supabase/functions/share/index.ts') ?? '';
  if (/Response\.redirect\(to, 302\)/.test(sh)) ok('① 과거 공유 링크 → Pages 302 리다이렉트');
  else bad('① share 가 여전히 HTML 을 반환한다 — 이미 뿌려진 링크는 text/plain 이라 안 열린다');
  if (/hwangchanho\.github\.io/.test(sh)) ok('① 리다이렉트 대상이 Pages');
  else bad('① 리다이렉트 대상이 Pages 가 아니다');
}

// ── ② 글자 배율 전역 적용의 부작용: 텍스트 담는 고정 height ──────────────
// 배율 최대 1.45 에서 고정 height 는 글자를 자른다. width 가 함께 있는 원형 배지는 제외(타원 방지).
{
  const risky: string[] = [];
  for (const f of walk('app/src')) {
    if (/AdBanner/.test(f)) continue;                 // 광고 = SDK 규격 고정
    const src = read(f) ?? '';
    for (const m of src.matchAll(/\{[^{}]*\bheight:\s*(\d{2})\b[^{}]*\}/g)) {
      const h = Number(m[1]);
      if (h < 24 || h > 56) continue;                  // 이미지·스켈레톤 크기는 대상 아님
      if (/\bwidth:\s*\d/.test(m[0])) continue;        // 원형·정사각 배지
      risky.push(`${f.replace('/app/src/', '')} h=${h}`);
    }
  }
  if (!risky.length) ok('② 텍스트 컨테이너에 고정 height 없음(minHeight 로 전환됨)');
  else bad(`② 고정 height 가 남아 큰 글자에서 잘린다 — ${risky.slice(0, 4).join(' · ')}${risky.length > 4 ? ` 외 ${risky.length - 4}` : ''}`);
}

// ── ③ 침묵 catch: 저장·결제 경로에서 에러를 통째로 삼키는가 ──────────────
// (푸시 토큰 등록 실패를 catch 가 삼켜 '한 번도 작동 안 함'을 몰랐던 사고와 같은 유형)
{
  const silent: string[] = [];
  // ⚠️★**주석을 먼저 걷는다.** 안 걷으면 하네스가 «내가 옛 사고를 설명해 둔 문장」을 코드로 읽는다 —
  //   실제로 `purchases.ts:286` 의 *"(07-26 푸시 `catch {}` … 같은 계열의 사고)"* 라는 **주석 한 줄**이
  //   상시 빨간불을 만들고 있었다. 오늘만 네 번째 같은 유형이다(talkdomain·friendnotify·persona).
  //   ⇒ 소스를 읽는 하네스의 **기본값은 주석 제거**다.
  const strip = (t: string) => t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const f of walk('app/src')) {
    const src = strip(read(f) ?? '');
    for (const m of src.matchAll(/catch\s*\{\s*\}/g)) {
      const around = src.slice(Math.max(0, m.index! - 220), m.index!);
      if (/updateChart|insertChart|setRepresentative|spend|purchase|consume|grant/i.test(around)) {
        silent.push(f.replace('/app/src/', ''));
      }
    }
  }
  if (!silent.length) ok('③ 저장·결제 경로에 완전 침묵 catch 없음');
  else bad(`③ 저장·결제 실패를 삼키는 catch {} — ${[...new Set(silent)].join(', ')}`);
}

// ── ④ realtime 구독 테이블은 REPLICA IDENTITY FULL 이어야(RLS 있을 때) ──
// 코드에서 구독하는 테이블을 뽑아, 사람이 확인하도록 이름을 남긴다(DB 상태는 여기서 못 본다).
{
  const tables = new Set<string>();
  for (const f of walk('app/src')) {
    for (const m of (read(f) ?? '').matchAll(/table:\s*'([a-z_]+)'/g)) tables.add(m[1]);
  }
  const known = new Set(['gen_jobs']);               // FULL 로 전환 확인된 것
  const unknown = [...tables].filter((t) => !known.has(t));
  if (!unknown.length) ok(`④ realtime 구독 테이블 ${[...tables].join(',')} — REPLICA IDENTITY 확인됨`);
  else bad(`④ 새 realtime 구독 테이블: ${unknown.join(', ')} — RLS 가 있으면 REPLICA IDENTITY FULL 필요(아니면 이벤트가 조용히 드롭)`);
}

// ── ⑤ 유료 kind 가 서버 게이트에 등록됐는가(빠지면 무료로 생성) ──────────
{
  const edge = read('supabase/functions/interpret/index.ts') ?? '';
  const seg = edge.slice(edge.indexOf('COIN_PRICE'));
  const priced = new Set([...seg.slice(0, seg.indexOf('};')).matchAll(/(\w+):\s*\d+/g)].map((m) => m[1]));
  const grab = (name: string, span: number) => {
    const i = edge.indexOf(name); if (i < 0) return new Set<string>();
    return new Set([...edge.slice(i, i + span).matchAll(/(\w+):\s*'/g)].map((m) => m[1]));
  };
  const covered = new Set([...grab('const SERVER_GATED', 1400), ...grab('const SET_KIND', 200),
    'followup', 'coach', 'timeresolve', 'dream', 'compat', 'compat_ziwei',   // 자체 게이트
    'celeb', 'numerology',                                                    // 온디바이스 무료(하드 거부)
    'reading', 'ziwei', 'timeline', 'timeline5', 'timeline10']);              // 세트 게이트
  const miss = [...priced].filter((k) => !covered.has(k));
  if (!miss.length) ok(`⑤ 유료 kind ${priced.size}종 전부 서버 게이트 커버`);
  else bad(`⑤ 게이트 누락(무료 생성 구멍): ${miss.join(', ')}`);
}

console.log(fail ? `\n❌ check:qa-sweep 실패 ${fail}건` : '\n✅ check:qa-sweep 통과');
process.exit(fail ? 1 : 0);
