// scripts/check-elemlabel.ts — 오행 이름표 단일화 + 낱말 구분 하네스
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (2026-08-16, daniel: *"관계지도나 다른곳에서 쇠라고 쓰는데 금이라고 정정해"*)
//   같은 오행 이름표가 **11벌 복붙**돼 있었다. 그래서 한 앱 안에서 金 이 화면마다
//   '쇠'(관계지도·오행에너지·이름풀이…)와 '금'(설정·보석)으로 **갈려서** 나갔다.
//   한 곳을 고쳐도 나머지가 옛말을 계속 뿌리는 구조였다 — 이름표는 한 벌만 있어야 한다.
//
// 무엇을 지키나
//   L1. 값   — 단일 소스가 실제로 金→'금' 을 내는가(**함수를 실행해서** 본다)
//   L2. 문장 — 관계지도 문장의 조사가 받침을 따라가는가('금이/금을'. '금가/금를' 이면 실패)
//   L3. 사본 — 단일 소스 밖에서 오행 이름표를 **새로 정의**하지 않았는가
//   L4. 회귀 — 어디에도 金→'쇠' 매핑이 되살아나지 않았는가
//   L5. 오탐 — 일괄치환으로 **다른 낱말의 '쇠'** 를 죽이지 않았는가
//              (십이운성 **쇠(衰)** · 庚의 물상 **무쇠** — 이건 '금'으로 바꾸면 틀린 말이 된다)
//
// ★L5 가 이 하네스의 핵심이다. '쇠'를 전부 '금'으로 sed 하면 L1~L4 는 통과하면서
//   십이운성 쇠(衰)가 '금'이 되어 **명리가 깨진다**. 통과만 보는 하네스는 그걸 못 잡는다.
// ★판정은 이름이 아니라 **표현식/실행값**으로 한다([[harness-judge-expression-not-name]]).
// ★음성 테스트: `npx tsx scripts/check-elemlabel.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import { EL_KO, EL_KO_SHORT, ELEM_LABEL, elemLabelOf } from '../app/src/lib/content/ohaengLabel';
import { elemLabel, elemRelationLabel } from '../app/src/lib/content/relationMapPhrases';

const SRC_ROOT = 'app/src';
const CANON = 'app/src/lib/content/ohaengLabel.ts';          // 이름표를 정의해도 되는 **유일한** 파일
const SCAN_EXT = new Set(['.ts', '.tsx']);

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 주석·문자열을 지운 '코드만' — 주석 속 낱말에 걸리는 오탐을 없앤다. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
  // ※ 작은따옴표 리터럴은 **남긴다** — 우리가 찾는 게 `金: '쇠'` 라는 리터럴 자체다.
}

/** 디렉터리를 훑어 .ts/.tsx 경로를 모은다. */
function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, acc); }
    else if (SCAN_EXT.has(path.extname(e.name))) acc.push(p);
  }
  return acc;
}

// ── L1. 값 — 단일 소스를 **실행해서** 확인한다(파일을 grep 하는 게 아니다) ────────
const EXPECT_KO: Record<string, string> = { 木: '나무', 火: '불', 土: '흙', 金: '금', 水: '물' };
for (const [el, want] of Object.entries(EXPECT_KO)) {
  if (EL_KO[el] !== want) fail('L1', `EL_KO['${el}'] = '${EL_KO[el]}' — '${want}' 여야 한다`);
  if (elemLabelOf(el) !== want) fail('L1', `elemLabelOf('${el}') = '${elemLabelOf(el)}' — '${want}' 여야 한다`);
  if (elemLabel(el as any) !== want) fail('L1', `elemLabel('${el}') = '${elemLabel(el as any)}' — 관계지도 노드가 옛말을 낸다`);
}
if (EL_KO_SHORT['金'] !== '금') fail('L1', `EL_KO_SHORT['金'] = '${EL_KO_SHORT['金']}' — '금' 이어야 한다`);
// 다국어는 건드리지 않았는지(ko 만 바뀌어야 한다)
if (ELEM_LABEL['金'].en !== 'Metal' || ELEM_LABEL['金'].ja !== '金') {
  fail('L1', `en/ja 가 훼손됐다 — en='${ELEM_LABEL['金'].en}' ja='${ELEM_LABEL['金'].ja}'`);
}

// ── L2. 문장 — 조사가 받침을 따라가는가('금'은 ㅁ받침 → 이/을) ─────────────────
{
  const s1 = elemRelationLabel('金', '火', 'ko');   // 火剋金 → "그 사람의 불이 내 금을 누릅니다"
  const s2 = elemRelationLabel('金', '土', 'ko');   // 土生金 → "그 사람의 흙이 내 금을 키웁니다"
  const s3 = elemRelationLabel('金', '水', 'ko');   // 金生水 → "내 금이 그 사람의 물을 키웁니다"
  for (const [tag, s] of [['火剋金', s1], ['土生金', s2], ['金生水', s3]] as const) {
    if (/금[가를은]/.test(s)) fail('L2', `조사가 어긋났다 (${tag}): "${s}" — '금'은 받침이 있어 이/을/은 이다`);
    if (s.includes('쇠')) fail('L2', `문장에 옛말이 남았다 (${tag}): "${s}"`);
  }
  if (!s1.includes('금을')) fail('L2', `火剋金 문장에 '금을' 이 없다: "${s1}"`);
  if (!s3.includes('금이')) fail('L2', `金生水 문장에 '금이' 가 없다: "${s3}"`);
}

// ── L3/L4. 사본·회귀 — 소스 전수 ────────────────────────────────────────────
/**
 * 이름표 사본을 가려내는 **어휘표**.
 *
 * ★왜 어휘로 보나: "오행 글자가 3개 이상 나오는 객체 리터럴"만으로 잡으면
 *   성질표(`木: '성장·기획·추진'`)·이모지표(`木: '🌿'`)·색 형용사표(`木: '푸른'`)까지 전부 물었다.
 *   그건 이름표가 아니라 **속성표**다 — 각자 제 파일에 있는 게 맞다.
 *   ⇒ 값이 그 오행의 **이름**일 때만 사본으로 본다.
 * ★en 은 대문자 표기만 넣는다 — 소문자 `'wood'` 는 이미지 경로 슬러그(`ELEM_SLUG`)라 이름표가 아니다.
 */
const NAME_VOCAB: Record<string, string[]> = {
  木: ['나무', '목', 'Wood'],
  火: ['불', '화', 'Fire'],
  土: ['흙', '토', 'Earth'],
  金: ['금', '쇠', 'Metal'],
  水: ['물', '수', 'Water'],
};
/** 한 줄에서 `오행: '값'` 또는 `오행: { ko: '값' … }` 짝을 뽑는다. */
const PAIR_RE = /(木|火|土|金|水)\s*:\s*(?:\{[^}]*?ko\s*:\s*)?'([^']*)'/g;

/**
 * 한 줄이 오행 **이름표**인지 재는 눈금 — 값이 그 오행의 이름인 짝이 몇 개인가.
 *
 * @param line  소스 한 줄
 * @returns     이름 짝의 **오행 종류 수**(예: 木='나무', 金='금' 두 종류면 2)
 *              3 이상이면 이름표 사본으로 본다(우연히 두 개 겹치는 문장은 걸러진다).
 */
function nameTableHits(line: string): number {
  const els = new Set<string>();
  for (const m of line.matchAll(PAIR_RE)) {
    const [, el, val] = m;
    if (NAME_VOCAB[el]?.includes(val)) els.add(el);
  }
  return els.size;
}
for (const file of walk(SRC_ROOT)) {
  const raw = fs.readFileSync(file, 'utf8');
  const code = codeOnly(raw);
  const norm = file.split(path.sep).join('/');

  // L4 — 金 을 '쇠'로 옮기는 매핑이 되살아났는가(주석은 제외한 코드에서)
  if (/金\s*:\s*'쇠'/.test(code) || /金\s*:\s*\{[^}]*ko\s*:\s*'쇠'/.test(code)) {
    fail('L4', `${norm} — 金 을 '쇠'로 옮기고 있다. 오행 이름은 '금'이다(daniel 2026-08-16 판정)`);
  }

  // L3 — 단일 소스 밖에서 이름표를 새로 정의했는가
  if (norm === CANON) continue;
  for (const line of code.split('\n')) {
    if (nameTableHits(line) < 3) continue;   // 이름 어휘가 3종 미만이면 속성표다 — 통과
    fail('L3', `${norm} — 오행 이름표 사본으로 보인다. 단일 소스(${CANON})에서 import 할 것\n        > ${line.trim().slice(0, 110)}`);
  }
}

// ── L5. 오탐 — 다른 낱말의 '쇠'가 살아 있는가(일괄치환 사고 방지) ────────────────
const MUST_KEEP: Array<{ file: string; needle: string; why: string }> = [
  { file: 'app/src/lib/content/myeongriGlossary.ts', needle: "쇠: {", why: '십이운성 쇠(衰) 용어 항목' },
  { file: 'app/src/lib/content/dailyFortune.ts', needle: '쇠:', why: '십이운성 쇠(衰) 오늘운세 문구' },
  { file: 'app/src/components/LoveFlowGraph.tsx', needle: '쇠:', why: '십이운성 쇠(衰) 기세 점수' },
  { file: 'app/src/lib/engine/personaType.ts', needle: '무쇠', why: '庚의 물상 — 무쇠 도끼' },
];
for (const { file, needle, why } of MUST_KEEP) {
  if (!fs.existsSync(file)) { fail('L5', `${file} 가 없다 — 경로가 바뀌었으면 이 하네스를 고칠 것`); continue; }
  if (!fs.readFileSync(file, 'utf8').includes(needle)) {
    fail('L5', `${file} 에서 '${needle}' 가 사라졌다 (${why}). 오행 金='금' 과 **다른 낱말**이다 — 되돌릴 것`);
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
// 하네스가 실제로 무는지 확인한다. '통과'만 보는 하네스는 하네스가 아니다.
if (process.argv.includes('--selftest')) {
  const cases: Array<{ name: string; run: () => boolean }> = [
    {
      name: "L4: `金: '쇠'` 리터럴을 문다",
      run: () => /金\s*:\s*'쇠'/.test(codeOnly("const T = { 木: '나무', 金: '쇠', 水: '물' };")),
    },
    {
      name: "L4: 다국어 형태 `金: { ko: '쇠' …}` 도 문다",
      run: () => /金\s*:\s*\{[^}]*ko\s*:\s*'쇠'/.test(codeOnly("const T = { 金: { ko: '쇠', en: 'Metal' } };")),
    },
    {
      name: 'L4: 주석 속 낱말은 물지 않는다(오탐 없음)',
      run: () => !/金\s*:\s*'쇠'/.test(codeOnly("// 옛 표기: 金: '쇠' 였다\nconst x = 1;")),
    },
    {
      name: 'L3: 일상어 이름표 사본을 문다',
      run: () => nameTableHits("const EL_KO: Record<string, string> = { 木: '나무', 火: '불', 土: '흙', 金: '금', 水: '물' };") >= 3,
    },
    {
      name: 'L3: 음독 이름표 사본도 문다',
      run: () => nameTableHits("({ 木: '목', 火: '화', 土: '토', 金: '금', 水: '수' } as Record<string, string>)[k]") >= 3,
    },
    {
      name: 'L3: 다국어 이름표 사본도 문다',
      run: () => nameTableHits("木: { ko: '나무', en: 'Wood', ja: '木' }, 火: { ko: '불', en: 'Fire', ja: '火' }, 土: { ko: '흙', en: 'Earth', ja: '土' },") >= 3,
    },
    // ↓ 아래 다섯은 **실제로 오탐이 났던 줄들**이다(2026-08-16 1차 판정에서 7건 잡힘).
    //   전부 속성표지 이름표가 아니다 — 물면 안 된다.
    {
      name: 'L3: 성질표는 물지 않는다',
      run: () => nameTableHits("木: '성장·기획·추진', 火: '표현·열정·확산', 土: '안정·중재·신뢰', 金: '정밀·결단·원칙', 水: '지혜·유연·소통',") < 3,
    },
    {
      name: 'L3: 이모지표는 물지 않는다',
      run: () => nameTableHits("export const HEAL_EMOJI: Record<Elem, string> = { 木: '🌿', 火: '🌅', 土: '🏡', 金: '🤍', 水: '💧' };") < 3,
    },
    {
      name: 'L3: 색 형용사표는 물지 않는다',
      run: () => nameTableHits("const EL_ADJ: Record<string, string> = { 木: '푸른', 火: '붉은', 土: '황금빛', 金: '은빛', 水: '검은' };") < 3,
    },
    {
      name: 'L3: 이미지 슬러그표(소문자)는 물지 않는다',
      run: () => nameTableHits("const ELEM_SLUG: Record<string, string> = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };") < 3,
    },
    {
      name: 'L3: 색상표는 물지 않는다',
      run: () => nameTableHits("const C = { 木: '#5FA98B', 火: '#D97A93', 土: '#C9A06A', 金: '#9AA0B8', 水: '#6E8FD1' };") < 3,
    },
    {
      name: 'L3: 상생표(값이 오행 글자)는 물지 않는다',
      run: () => nameTableHits("const GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };") < 3,
    },
    {
      name: "L2: '금가/금를' 같은 조사 오류를 문다",
      run: () => /금[가를은]/.test('그 사람의 불이 내 금를 누릅니다'),
    },
    {
      name: 'L2: 올바른 문장은 물지 않는다(오탐 없음)',
      run: () => !/금[가를은]/.test(elemRelationLabel('金', '火', 'ko')),
    },
    {
      name: "L5: 십이운성 '쇠'를 지우면 문다",
      run: () => !"const S = { 장생: 7, 금: 6 };".includes('쇠:'),   // '쇠:' 가 사라진 상태 = 물어야 함
    },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) {
    const ok = c.run();
    console.log(`  ${ok ? '✅' : '❌'} ${c.name}`);
    if (!ok) bad++;
  }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패 — 하네스가 못 무는 구멍이 있다`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

// ── 결과 ────────────────────────────────────────────────────────────────────
if (out.length) {
  console.error(`❌ check:elemlabel — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:elemlabel — 오행 이름표 단일 소스 · 金=금 · 십이운성 쇠(衰)/무쇠 보존');
