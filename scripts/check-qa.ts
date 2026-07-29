// scripts/check-qa.ts — 질문별 소제목(qa) 파이프라인 하네스
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-29: "질문별 소제목으로 끊어서 보여주는 방식으로 해줘"
//
// ★왜 하네스인가: qa 는 **4단계를 전부 통과해야** 화면에 뜬다 —
//   ①프롬프트가 qa 를 요구  ②sanitize 가 객체배열을 지우거나 건너뛰지 않음
//   ③L3 재렌더에도 같은 지시(기존 풀이 소급)  ④렌더러가 qa 를 그림.
//   한 곳만 빠져도 **에러 없이 그냥 안 보인다**. 실제로 이 프로젝트에서
//   "저장은 됐는데 안 그려지는 필드"(headline 유실, 07-26)가 이미 한 번 났다.
//
// 실행: npm run check:qa
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => readFileSync(`${ROOT}${p}`, 'utf8');
const strip = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''); // 주석 속 예시에 헛통과 방지

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

console.log('\n🔎 질문별 소제목(qa) 파이프라인\n');

// ── ① 프롬프트가 qa 배열을 요구하는가 ────────────────────────────────────
{
  const mc = read('supabase/functions/_shared/mustCover.ts');
  if (/"qa"/.test(mc) && /배열 필드/.test(mc)) ok('① 프롬프트가 qa 배열을 요구');
  else bad('① mustCoverBlock 이 qa 출력을 지시하지 않는다 — 모델이 만들 이유가 없다');
  if (/질문이 N개면 qa 도 N개/.test(mc)) ok('① 항목 누락 금지 지시 포함');
  else bad('① 질문 개수 일치 지시가 없다 — 모델이 조용히 일부만 답한다');
}

// ── ② sanitize 가 객체 배열 내부를 정화하는가 ────────────────────────────
{
  const it = strip(read('supabase/functions/interpret/index.ts'));
  if (/typeof x === 'object'[\s\S]{0,200}clean\(x\[kk\]\)/.test(it)) ok('② sanitizeReading 이 객체배열 내부 문자열까지 정화');
  else bad('② sanitizeReading 이 객체배열을 건너뛴다 — qa 에 R##·이모지가 그대로 나간다');
}

// ── ③ L3 재렌더에도 같은 지시가 가는가(기존 풀이 소급) ───────────────────
{
  const bu = strip(read('supabase/functions/_shared/buildUserPrompt.ts'));
  const it = strip(read('supabase/functions/interpret/index.ts'));
  if (/buildRenderPrompt\(analysis: any, category/.test(bu) && /mustCoverBlock\(category\)/.test(bu)) ok('③ L3 렌더 프롬프트에 필수질문 주입');
  else bad('③ buildRenderPrompt 가 category 를 안 받는다 — 기존 풀이엔 qa 가 영영 안 생긴다');
  if (/buildRenderPrompt\(analysis, category\)/.test(it)) ok('③ renderL3 가 category 를 전달');
  else bad('③ renderL3 호출이 category 를 안 넘긴다');
  const m = it.match(/const L3_VER = (\d+)/);
  if (m && Number(m[1]) >= 3) ok(`③ L3_VER=${m[1]} (재렌더 트리거됨)`);
  else bad(`③ L3_VER 이 ${m?.[1] ?? '?'} — bump 안 하면 기존 풀이가 재렌더되지 않는다`);
}

// ── ④ 렌더러가 qa 를 그리는가 ────────────────────────────────────────────
{
  const prose = strip(read('app/src/components/ReadingProse.tsx'));
  const scr = strip(read('app/src/screens/ReadingScreen.tsx'));
  if (/export function ReadingQA/.test(prose)) ok('④ ReadingQA 컴포넌트 존재');
  else bad('④ ReadingQA 컴포넌트가 없다');
  if (/<ReadingQA\s+qa=/.test(scr)) ok('④ ReadingScreen 이 ReadingQA 를 렌더');
  else bad('④ 렌더 지점에 <ReadingQA/> 가 없다 — 만들어만 놓고 안 그린다(07-26 headline 유실과 같은 유형)');
  if (/ReadingQA/.test(scr.split('\n').filter((l) => l.startsWith('import')).join('\n'))) ok('④ import 연결됨');
  else bad('④ ReadingQA import 누락');
}

console.log(fail ? `\n❌ check:qa 실패 ${fail}건` : '\n✅ check:qa 통과 — 프롬프트→정화→L3소급→렌더 4단 연결');
process.exit(fail ? 1 : 0);
