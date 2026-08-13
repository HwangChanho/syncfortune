// scripts/check-healthsafe.ts — 건강 문구가 **의료 조언으로 넘어가지 않는가**
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-13: *"건강도 부위별로 좀더 디테일하게"* → 수위 「부위 + 관리법까지」 확정.
//
// ■ 왜 기계가 봐야 하나
//   건강은 CLAUDE.md §4 가 **명시적으로 금지**한 영역이다 — 의료 단정·진단·미래 질병 예측 금지.
//   그런데 부위를 말하기 시작하면 한 단어 차이로 선을 넘는다:
//     "눈이 뻐근해지기 쉬운 흐름"(관리축) ↔ "간이 안 좋아질 수 있다"(진단·예측)
//   문구는 3개 언어 × 오행 5종이라 사람이 매번 눈으로 훑기 어렵고, 나중에 누가 한 줄 고치면 조용히 뚫린다.
//
// ■ 무엇을 검사하나 (BODY_CARE 표를 **파일에서 직접 읽어** 본다)
//   ① **장부명 금지** — 간·심장·위장·폐·신장… (daniel 선택 수위: 장부명 없이 체감 부위만)
//   ② **질병·진단어 금지** — 질환·염증·암·진단·치료·병원·처방…
//   ③ **예측형 어미 금지** — "~에 걸린다"·"~할 위험"·"~을 조심하세요"(공포 유발)
//   ④ **관리법이 반드시 있다** — 진단으로 끝내지 않고 대응으로 닫는다(§4 가드5)
//   ⑤ **3개 언어 × 5오행 = 15칸이 모두 찼는가** — 빈칸은 조용히 한국어 폴백으로 나간다
//      ([[i18n-untranslated-shipped]]: 키가 있는 것과 그 언어인 것은 다르다)
//
// ★판정은 **이름이 아니라 실제 문구**로 한다 — 표를 파싱해 값을 읽는다.
//   (주석에 적힌 "장부명을 쓰지 않는다" 같은 경고문에 걸리면 거짓 양성이 된다 ⇒ 주석은 먼저 걷어낸다)
//
// 실행: npm run check:healthsafe
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const SRC = 'app/src/lib/content/dailyFortune.ts';
const raw = readFileSync(SRC, 'utf8');

// 주석을 걷어낸다 — 이 파일의 주석에는 "간·심장" 같은 **금지어 설명**이 그대로 들어 있다.
const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

// BODY_CARE 표만 잘라낸다
const block = code.match(/const BODY_CARE[\s\S]*?\n\};/)?.[0] ?? '';
let bad = 0;
const fail = (m: string) => { bad++; console.log(`   ❌ ${m}`); };
const pass = (m: string) => console.log(`   ✅ ${m}`);

console.log('\n🩺 건강 문구가 의료 조언으로 넘어가지 않는가 (§4)\n');

if (!block) {
  console.log('   ⏭  BODY_CARE 표를 찾지 못했습니다 — 건강 부위 기능이 없는 버전입니다');
  process.exit(0);
}

// ── 표 파싱: { area: '...', care: '...' } 를 언어·오행과 함께 뽑는다 ────────
type Cell = { lang: string; el: string; area: string; care: string };
const cells: Cell[] = [];
let curLang = '';
for (const line of block.split('\n')) {
  const lm = line.match(/^\s{2}(ko|en|ja):\s*\{/);
  if (lm) { curLang = lm[1]; continue; }
  const cm = line.match(/^\s*([木火土金水]):\s*\{\s*area:\s*'([^']*)'\s*,\s*care:\s*'([^']*)'/);
  if (cm && curLang) cells.push({ lang: curLang, el: cm[1], area: cm[2], care: cm[3] });
}

// ── ⑤ 15칸이 다 찼는가 ────────────────────────────────────────────────────
const ELS = ['木', '火', '土', '金', '水'], LANGS = ['ko', 'en', 'ja'];
const missing = LANGS.flatMap((l) => ELS.filter((e) => !cells.some((c) => c.lang === l && c.el === e)).map((e) => `${l}/${e}`));
if (missing.length) fail(`빈칸 ${missing.length}개 — ${missing.join(', ')} (한국어로 폴백되어 나갑니다)`);
else pass(`3개 언어 × 5오행 = ${cells.length}칸 모두 채워짐`);

// ── ①②③ 금지 표현 ────────────────────────────────────────────────────────
const BANNED: [string, RegExp][] = [
  // ① 장부명 — daniel 이 고른 수위는 "장부명 없이 체감 부위만"
  //   ★한 글자 장부(간·폐)는 **앞 글자로 좁힌다**. 한글엔 `\b` 가 없어서 그냥 넣으면
  //     "시**간**"·"인**간**"·"**폐**활량" 까지 물어 버린다(음성 테스트로 발견 — 처음엔 아예 빠져 있었다).
  //     `(?<![가-힣])간(?=[이을에은의가])` = 앞이 한글이 아니고 뒤에 조사가 붙은 '간' 만 잡는다.
  ['장부명', /((?<![가-힣])(간|폐)(?=[이을에은의가])|간장|심장|위장|비장|폐장|신장|대장|소장|담낭|방광|liver|kidney|stomach|lung|spleen|gallbladder|bladder|肝|心臓|胃|肺|腎)/i],
  // ② 질병·진단·치료
  ['질병·진단어', /(질환|질병|염증|암\b|당뇨|고혈압|진단|치료|처방|병원|약을|disease|illness|diagnos|treatment|prescri|hospital|病気|疾患|診断|治療|病院)/i],
  // ③ 예측·공포 유발
  ['예측·공포형', /(걸릴|걸린다|악화|위험합니다|위험해요|발병|조심하세요|주의하세요|risk of|you will get|悪化|発症)/i],
];
let hit = 0;
for (const c of cells) {
  for (const [name, re] of BANNED) {
    const m = `${c.area} ${c.care}`.match(re);
    if (m) { fail(`${c.lang}/${c.el} — ${name} '${m[0]}' 가 들어 있습니다`); hit++; }
  }
}
if (!hit) pass('장부명·질병어·예측형 표현 없음');

// ── ④ 관리법이 비어 있지 않은가 ──────────────────────────────────────────
const noCare = cells.filter((c) => c.care.trim().length < 6);
if (noCare.length) fail(`관리법이 없는 칸 ${noCare.length}개 — ${noCare.map((c) => `${c.lang}/${c.el}`).join(', ')} (진단으로 끝내면 안 됩니다)`);
else pass('모든 칸이 관리법으로 닫힘(가드5)');

// ── i18n: en/ja 칸에 한국어가 섞였는가 ────────────────────────────────────
const korean = cells.filter((c) => c.lang !== 'ko' && /[가-힣]/.test(`${c.area}${c.care}`));
if (korean.length) fail(`en/ja 에 한국어 ${korean.length}칸 — ${korean.map((c) => `${c.lang}/${c.el}`).join(', ')}`);
else pass('en/ja 에 한국어 섞임 없음');

console.log(bad ? `\n❌ check:healthsafe 실패 — ${bad}건\n` : '\n✅ check:healthsafe 통과 — 부위·관리법 수위를 지킵니다\n');
if (bad) process.exitCode = 1;
