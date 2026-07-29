// scripts/check-coverage.ts — 영역별 '필수 답변' 계약 하네스
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-28: "풀이에 카테고리별로 여기에 대한 답은 꼭 들어가야 해"
//
// ★왜 하네스인가: 이건 **제품 약속**이다. 그런데 약속을 지키는 장치가 전부 조용히 무너진다 —
//   ①영역명에 오타가 나면 표가 매칭되지 않아 **아무 일도 안 일어난다**(에러 없음)
//   ②프롬프트 주입 한 줄이 빠지면 지시가 사라진다(에러 없음)
//   ③검수 배선이 빠지면 결손이 있어도 로그조차 안 남는다(에러 없음)
//   ④질문의 검수 키워드가 빈 배열이면 **항상 통과**해 검수가 무력화된다(에러 없음)
//   전부 '조용한 실패'라 하네스가 아니면 알 방법이 없다.
//
// 지키는 것:
//   V1 daniel 지정 5묶음의 질문이 **하나도 빠지지 않고** 표에 있다
//   V2 표의 영역명이 전부 **실재하는 사주 영역**이다(오타=무효 매칭)
//   V3 프롬프트 주입 배선(buildUserPrompt → mustCoverBlock)
//   V4 생성 후 검수 배선(verifyReading → mustCoverFor · interpret 가 category 를 넘긴다)
//   V5 모든 질문에 검수 키워드가 있다(빈 배열 = 검수 무력화)
//   V6 건강 영역 안전(§4) — 의료 단정·질병 예측을 요구하는 문구가 없다
//   V7 **사주·자미 양쪽** 커버 — 같은 질문에 두 관점이 답해야 한다(daniel 2026-07-28)
//
// 실행: npm run check:coverage
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => { try { return readFileSync(`${ROOT}${p}`, 'utf8'); } catch { return null; } };
const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

const mc = read('supabase/functions/_shared/mustCover.ts');
if (!mc) {
  console.log('\n– supabase/ 없음 — check:coverage 스킵(gitignore 대상)');
  process.exit(0);
}

// MUST_COVER 파싱 — `영역: [ { q: '...', keys: [...] }, ... ]`
const table = new Map<string, { q: string; keys: string[] }[]>();
{
  const body = strip(mc).slice(strip(mc).indexOf('MUST_COVER'));
  const re = /^\s{2}([가-힣]+):\s*\[([\s\S]*?)\n\s{2}\],/gm;
  for (const m of body.matchAll(re)) {
    const items = [...m[2].matchAll(/\{\s*q:\s*'((?:[^'\\]|\\.)*)'\s*,\s*keys:\s*\[([^\]]*)\]/g)]
      .map((x) => ({ q: x[1], keys: [...x[2].matchAll(/'([^']*)'/g)].map((k) => k[1]) }));
    table.set(m[1], items);
  }
}

// ── V1 daniel 지정 질문이 전부 있나 ───────────────────────────────────────
// daniel 원문(2026-07-28)을 그대로 옮긴 검증 기준. 표현이 아니라 **주제**가 있는지 본다.
const REQUIRED: { group: string; topic: string; anyOf: string[] }[] = [
  { group: '1.재물운', topic: '언제 모이나', anyOf: ['모이', '언제'] },
  { group: '1.재물운', topic: '돈 버는 방법', anyOf: ['버는', '벌'] },
  { group: '1.재물운', topic: '맞는 투자방법', anyOf: ['투자'] },
  { group: '2.직장·진로', topic: '이직·취업 언제', anyOf: ['이직', '취업'] },
  { group: '2.직장·진로', topic: '맞는 천직', anyOf: ['천직', '맞는 일', '맞는 업', '업(業)'] },
  { group: '2.직장·진로', topic: '승진운', anyOf: ['승진'] },
  { group: '3.인연', topic: '맞는 배우자', anyOf: ['배우자'] },
  { group: '3.인연', topic: '궁합', anyOf: ['궁합'] },
  { group: '3.인연', topic: '언제 만나나', anyOf: ['만나'] },
  { group: '3.인연', topic: '언제 헤어지나', anyOf: ['헤어', '흔들'] },
  { group: '3.인연', topic: '이성에게 어필하는 방법', anyOf: ['어필'] },
  { group: '3.인연', topic: '내 매력', anyOf: ['매력'] },
  { group: '3.인연', topic: '재회 가능한지', anyOf: ['재회', '다시 이어'] },
  { group: '4.건강', topic: '주의해야 하는 점', anyOf: ['주의'] },
  { group: '4.건강', topic: '건강검진 시기', anyOf: ['검진', '점검'] },
  { group: '4.건강', topic: '개운·맞는 운동', anyOf: ['운동', '개운'] },
  { group: '5.인간관계', topic: '사람 대하는 방법 장단점', anyOf: ['장점', '단점'] },
  { group: '5.인간관계', topic: '자녀 교육방법', anyOf: ['교육'] },
  { group: '5.인간관계', topic: '귀인이 오는 시기', anyOf: ['귀인'] },
];
console.log('\n[V1] daniel 지정 질문이 전부 표에 있다');
{
  const allQ = [...table.values()].flat().map((x) => x.q).join(' | ');
  const missing = REQUIRED.filter((r) => !r.anyOf.some((k) => allQ.includes(k)));
  if (missing.length) for (const m of missing) bad(`${m.group} "${m.topic}" 가 MUST_COVER 에 없다 — 이 질문의 답이 풀이에서 빠진다`);
  else ok(`${REQUIRED.length}개 질문 전부 반영(영역 ${table.size}종)`);
  // 역검증 보호: 표를 하나도 못 읽었으면 위 검사가 전부 통과해 버린다
  if (table.size < 5) bad(`MUST_COVER 를 ${table.size}개밖에 못 읽었다 — 패턴이 바뀌어 하네스가 헛돈다`);
}

// ── V2 영역명이 실재하나(오타=조용한 무효) ────────────────────────────────
console.log('\n[V2] 표의 영역명이 실재하는 사주 영역이다');
{
  // 사주 16영역 = i18n category 블록 / 자미 12궁 = engine/ziwei.ts PALACE_NAME (각 정본에서 읽는다)
  const i18n = read('app/src/lib/i18n.ts') ?? '';
  const block = i18n.slice(i18n.indexOf('  category: {'), i18n.indexOf('  today: {'));
  const real = new Set([...block.matchAll(/([가-힣]+):\s*'/g)].map((m) => m[1]));
  const zw = read('engine/ziwei.ts') ?? '';
  const zwBlock = zw.slice(zw.indexOf('const PALACE_NAME'), zw.indexOf('const STAR_NAME'));
  const palaces = [...zwBlock.matchAll(/'([가-힣]+궁)'/g)].map((m) => m[1]);
  for (const p of palaces) real.add(p);
  if (palaces.length < 10) bad(`engine/ziwei.ts 에서 궁 이름을 ${palaces.length}개밖에 못 읽었다 — 하네스가 헛돈다`);
  if (real.size < 10) bad(`i18n 에서 영역명을 ${real.size}개밖에 못 읽었다 — 하네스가 헛돈다`);
  else {
    const ghost = [...table.keys()].filter((k) => !real.has(k));
    if (ghost.length) bad(`실재하지 않는 영역명: ${ghost.join(', ')} — 매칭이 안 돼 **아무 일도 안 일어난다**(오타 의심)`);
    else ok(`${table.size}개 영역 전부 실재(사주 영역 + 자미 ${palaces.length}궁 = ${real.size}종 중)`);
  }
}

// ── V3 프롬프트 주입 ──────────────────────────────────────────────────────
console.log('\n[V3] 프롬프트에 필수질문 블록이 주입된다');
{
  const b = strip(read('supabase/functions/_shared/buildUserPrompt.ts') ?? '');
  if (/mustCoverBlock\(category\)/.test(b)) ok('buildUserPrompt 가 mustCoverBlock(category) 주입');
  else bad('프롬프트 주입이 없다 — 모델이 필수질문을 아예 모른다(표만 있고 효과 0)');
}

// ── V4 생성 후 검수 배선 ──────────────────────────────────────────────────
console.log('\n[V4] 생성 후 커버리지 검수가 돈다');
{
  const v = strip(read('supabase/functions/_shared/verifyReading.ts') ?? '');
  const i = strip(read('supabase/functions/interpret/index.ts') ?? '');
  if (/mustCoverFor\(category\)/.test(v)) ok('verifyReading 이 커버리지 검사');
  else bad('verifyReading 이 커버리지를 안 본다 — 빠져도 로그조차 안 남는다');
  if (/verifyReading\(reading,\s*category\)/.test(i)) ok('interpret 가 category 를 넘긴다');
  else bad('interpret 가 category 를 안 넘긴다 — 검수는 있으나 항상 빈 결과(무력화)');
}

// ── V5 검수 키워드가 비어 있지 않다 ───────────────────────────────────────
console.log('\n[V5] 모든 질문에 검수 키워드가 있다');
{
  const empty: string[] = [];
  for (const [cat, items] of table) for (const it of items) if (!it.keys.length) empty.push(`${cat}: ${it.q}`);
  if (empty.length) for (const e of empty) bad(`키워드 없음 → 항상 통과(검수 무력화): ${e}`);
  else ok(`질문 ${[...table.values()].flat().length}개 전부 키워드 보유`);
}

// ── V6 건강 안전(§4) ──────────────────────────────────────────────────────
console.log('\n[V6] 건강 영역이 의료 단정을 요구하지 않는다(§4)');
{
  const health = (table.get('건강') ?? []).map((x) => x.q).join(' ');
  const DANGER = ['질병', '병명', '진단', '발병', '수술', '암', '완치'];
  const hit = DANGER.filter((d) => health.includes(d));
  if (hit.length) bad(`건강 질문에 의료 단정 유도 표현: ${hit.join(', ')} — §4 위반(진단·질병 예측 금지)`);
  else if (!health) bad('건강 영역 질문이 비어 있다');
  else {
    ok('질문 문구에 의료 단정 요구 없음(관리축·점검 시기까지만)');
    // ★안전 경고는 **질문과 분리된 자리**에 있어야 한다 — 질문에 섞으면 부정형까지 위험어로 잡힌다(오탐).
    if (/SAFETY_NOTE[\s\S]{0,400}건강:/.test(mc)) ok('건강 안전 주석(§4)이 프롬프트에 별도로 붙는다');
    else bad('건강 안전 주석이 없다 — 병명·진단 금지 지시가 프롬프트에 도달하지 않는다(§4)');
  }
}

// ── V7 사주·자미 양쪽에 적용되나 ──────────────────────────────────────────
// daniel 2026-07-28: "저 카테고리는 기본 사주풀이 자미두수 풀이에도 적용돼야 해"
// ★한쪽에만 있으면 조용히 반쪽이 된다 — 자미 풀이를 열었을 때만 답이 없고, 아무 에러도 안 난다.
console.log('\n[V7] 사주 영역과 자미 12궁 **양쪽**에 적용된다');
{
  const ZIWEI = ['재백궁', '관록궁', '부처궁', '명궁', '질액궁', '노복궁', '자녀궁'];
  const sajuQ = [...table.entries()].filter(([k]) => !k.endsWith('궁')).flatMap(([, v]) => v.map((x) => x.q)).join(' | ');
  const ziweiQ = [...table.entries()].filter(([k]) => k.endsWith('궁')).flatMap(([, v]) => v.map((x) => x.q)).join(' | ');

  const missZ = ZIWEI.filter((z) => !table.has(z));
  if (missZ.length) bad(`자미 궁 누락: ${missZ.join(', ')} — 자미 풀이에서만 답이 빠진다(에러 없음)`);
  else ok(`자미 ${ZIWEI.length}궁 등록`);

  // 5묶음 주제가 양쪽에 모두 있나(주제 단위 — 궁·영역 이름이 달라도 질문은 같아야 한다)
  const TOPICS = [['재물 시기', ['모이', '언제']], ['버는 방법', ['버는', '벌']], ['투자', ['투자']],
    ['취업·이직', ['취업', '이직']], ['천직', ['천직']], ['승진', ['승진']],
    ['배우자', ['배우자']], ['궁합', ['궁합']], ['재회', ['재회']], ['매력', ['매력']],
    ['건강 주의', ['주의']], ['점검 시기', ['점검', '검진']], ['운동·개운', ['운동', '개운']],
    ['대인 장단점', ['장점']], ['귀인', ['귀인']], ['자녀 교육', ['교육']]] as [string, string[]][];
  const onlyOne: string[] = [];
  for (const [name, keys] of TOPICS) {
    const inS = keys.some((k) => sajuQ.includes(k));
    const inZ = keys.some((k) => ziweiQ.includes(k));
    if (inS !== inZ) onlyOne.push(`${name}(${inS ? '사주만' : '자미만'})`);
  }
  if (onlyOne.length) bad(`한쪽에만 있는 주제: ${onlyOne.join(', ')} — 반대쪽 풀이에서 답이 빠진다`);
  else ok(`${TOPICS.length}개 주제 전부 사주·자미 양쪽 반영`);

  // 자미 프롬프트 주입 배선
  const b = strip(read('supabase/functions/_shared/buildUserPrompt.ts') ?? '');
  if (/mustCoverBlock\(palaceName\)/.test(b)) ok('buildZiweiPrompt 가 mustCoverBlock(palaceName) 주입');
  else bad('자미 프롬프트에 주입이 없다 — 표만 있고 자미 풀이엔 효과 0');

  // 자미 건강 궁(질액궁)에도 §4 안전 주석
  if (/질액궁:\s*HEALTH_NOTE/.test(mc)) ok('질액궁에도 건강 안전 주석(§4)');
  else bad('질액궁에 건강 안전 주석이 없다 — 자미 건강 통변에 §4 가드가 도달하지 않는다');
}


// ── 애정 3종(love·reunion·crush)에도 필수질문이 **실제로 주입**되는가 ──────
//   daniel 2026-07-30 IMG_8305: 애정 딥리포트에 '인연' 묶음 답이 안 나왔다.
//   원인 = MUST_COVER 에 키가 없었고, 키를 넣어도 **빌더가 mustCoverBlock 을 안 부르면 무효**다
//   (오늘 R60 에서 같은 유형을 겪었다: 모듈만 만들고 호출 안 함).
{
  const mc = read('supabase/functions/_shared/mustCover.ts') ?? '';
  const bp = read('supabase/functions/_shared/buildUserPrompt.ts') ?? '';
  for (const k of ['love', 'reunion', 'crush']) {
    const hasKey = new RegExp(`^\\s{2}${k}:\\s*\\[`, 'm').test(mc);
    const wired = new RegExp(`mustCoverBlock\\('${k}'\\)`).test(bp);
    if (hasKey && wired) ok(`${k} — 필수질문 정의 + 프롬프트 주입`);
    else if (!hasKey) bad(`${k} — MUST_COVER 에 정의가 없다(애정 풀이에 필수답이 안 나온다)`);
    else bad(`${k} — 정의는 있는데 **빌더가 mustCoverBlock 을 안 부른다**(있으나 마나)`);
  }
}

console.log(fail ? `\n❌ check:coverage 실패 ${fail}건` : '\n✅ check:coverage 통과 — 지정질문 반영·영역실재·주입·검수·키워드·건강안전 OK');
process.exit(fail ? 1 : 0);
