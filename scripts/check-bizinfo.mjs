#!/usr/bin/env node
// scripts/check-bizinfo.mjs — **사업자 정보가 «사람이 보는 자리»에 실제로 적혀 있는가**
// ═══════════════════════════════════════════════════════════════════════════
// ■ 왜 만들었나 (2026-09-04 실측 사고)
//   웹 초기 HTML 에는 사업자·가격·환불 고지가 다 들어가 있었다(`#legal-static`).
//   그런데 그 푸터는 **1×1 px 로 화면 밖**이다 — 봇 전용이다(의도된 설계).
//   사람이 실제로 여는 자리 = 앱 「운 충전」 → 「환불 및 청약철회 정책」 링크
//   = `docs/legal/refund-ko.md` 인데, 거기 사업자 정보 표가 **전부 「(기재 예정)」** 이었다.
//   라이브 실측: `refund-ko.html` **200 OK · 「기재 예정」 7회 노출**.
//   ⇒ 「HTML 에 심었다」 ≠ 「사람이 볼 수 있다」. PG 심사관·소비자는 후자를 본다
//      ([[web-green-is-not-verified]] 와 같은 병 — 어느 면을 쟀는지가 전부다).
//
// ■ 무엇을 잡나
//   B1 단일 출처   — `inject-og.mjs` 가 사업자 정보를 **자기 안에 다시 정의**하지 않는다
//   B2 값 일치     — refund 문서 3종(ko/en/ja)에 BIZ 값이 **글자 그대로** 들어 있다
//   B3 미기재 잔여 — 「기재 예정 / (pending) / 記載予定」 이 남아 있지 않다
//   B4 상호 드리프트 — 약관의 운영자명이 **등록 상호**다(옛 표기 `SyncFortune` 금지)
//   B5 통신판매업  — 번호가 생기면 문서의 「준비 중」 문구가 **반드시** 사라진다
//   B6 도달 경로   — 앱이 링크하는 환불정책 URL 의 원본 마크다운이 실재한다
//   B7 앱 노출     — **앱 화면**이 사업자 정보를 실제로 그린다(봇 전용 푸터로 끝내지 않는다)
//   B8 재하드코딩  — 단일 출처 밖에 사업자등록번호를 또 적지 않는다
//   B9 고지가 = 청구가 — 웹 정적 고지의 상품 가격이 **웹 채널 가격**이다(스토어 정가가 아니라)
//
// 사용: npm run check:bizinfo   ·  자가검증: npm run check:bizinfo -- --selftest
// ⚠️네트워크·API 호출 없음(ABSOLUTE-0 무관) — 저장소 파일만 읽는다.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIZ, mailOrderLabel, BIZ_SOURCE, webPacks } from './biz-info.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELFTEST = process.argv.includes('--selftest');
const read = (rel) => (existsSync(path.join(ROOT, rel)) ? readFileSync(path.join(ROOT, rel), 'utf8') : null);

let bad = 0;
/** 실패 1건 기록. @param id 규칙 번호 @param msg 무엇이·왜 틀렸는지 */
const fail = (id, msg) => { bad++; console.log(`  ❌ [${id}] ${msg}`); };

// ── 판정식(순수 함수) ── ★이름이 아니라 **표현식**으로 판정한다.
//    파일을 옮기거나 이름을 바꿔도 규칙 자체는 그대로 돈다([[harness-judge-expression-not-name]]).

/** 문서에 아직 «미기재» 표시가 남아 있는가. 세 언어의 표기를 한 식으로 본다. */
export const hasPendingMark = (doc) => /\(기재 예정\)|\(pending\)|（記載予定）/.test(doc);

/** 문서가 값 하나를 글자 그대로 담고 있는가. ⚠️표 파이프·공백에 기대지 않는다(서식이 바뀌어도 산다). */
export const containsValue = (doc, v) => doc.includes(v);

/**
 * 코드에서 **주석을 걷어낸다** — 판정은 «도는 코드» 로만 한다.
 * ⚠️★2026-09-04 에 실제로 당했다: 「`coinPrices.ts` 를 직접 읽지 마라」 규칙이
 *   그 사실을 **설명하는 내 주석**에 걸려 빨간불이 났다. 이 저장소가 반복해 앓는 병이다.
 * @param src 소스 전문 @returns 주석을 공백으로 바꾼 소스(줄 수는 보존)
 */
export const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
     .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));

/**
 * 통신판매업 표기가 «지금 상태»와 맞는가.
 * - 번호가 없다 → 문서에 준비-중 문구가 있어야 한다(빈칸으로 두면 미표시가 된다)
 * - 번호가 생겼다 → 준비-중 문구가 **남아 있으면 안 된다**(값이 왔는데 문서가 안 따라온 것)
 * @param doc 문서 전문 @param lang 'ko'|'en'|'ja'
 */
export const mailOrderInSync = (doc, lang) => {
  const pending = mailOrderLabel(lang);
  return BIZ.mailOrderNo ? doc.includes(BIZ.mailOrderNo) && !doc.includes(pending) : doc.includes(pending);
};

// ── B1. 단일 출처 ────────────────────────────────────────────────────────
const inject = read('scripts/inject-og.mjs');
if (!inject) fail('B1', 'scripts/inject-og.mjs 가 없다 — 옮겼으면 이 하네스도 같이 옮겨라');
else {
  if (/const\s+BIZ\s*=\s*\{/.test(stripComments(inject)))
    fail('B1', 'inject-og.mjs 가 BIZ 를 **다시 정의**한다 — 값이 문서와 갈린다. `./biz-info.mjs` 에서 import 할 것');
  if (!/from\s+['"]\.\/biz-info\.mjs['"]/.test(inject))
    fail('B1', 'inject-og.mjs 가 단일 출처(`./biz-info.mjs`)를 안 쓴다');
}

// ── B2·B3·B5. 사람이 여는 문서 ──────────────────────────────────────────
const DOCS = [
  { f: 'docs/legal/refund-ko.md', lang: 'ko' },
  { f: 'docs/legal/refund-en.md', lang: 'en' },
  { f: 'docs/legal/refund-ja.md', lang: 'ja' },
];
/** 세 언어 공통으로 **글자 그대로** 있어야 하는 값(번역해선 안 되는 식별 정보). */
const MUST = [BIZ.name, BIZ.owner, BIZ.regNo, BIZ.addr, BIZ.tel, BIZ.email];

for (const { f, lang } of DOCS) {
  const doc = read(f);
  if (!doc) { fail('B2', `${f} 가 없다`); continue; }
  for (const v of MUST) if (!containsValue(doc, v)) fail('B2', `${f} 에 「${v}」 가 없다 — 전자상거래법 제10조 표시사항`);
  if (hasPendingMark(doc)) fail('B3', `${f} 에 「기재 예정」류가 남아 있다 — PG 심사관이 빈 표를 본다`);
  if (!mailOrderInSync(doc, lang))
    fail('B5', BIZ.mailOrderNo
      ? `${f} — 통신판매업 신고번호(${BIZ.mailOrderNo})가 생겼는데 문서가 안 따라왔다`
      : `${f} — 통신판매업 칸이 비어 있다. 번호가 없으면 「${mailOrderLabel(lang)}」 라고 적을 것`);
}

// ── B4. 상호 드리프트 ────────────────────────────────────────────────────
// ⚠️서비스명(「니운내운」)·저장소명(syncfortune)·등록 상호(「싱크코」)가 **셋 다 다르다.**
//   약관 하단 운영자 표기는 **등록 상호**여야 한다(PG 심사에서 상호 불일치는 흔한 반려 사유).
for (const f of ['docs/legal/terms-ko.md', 'docs/legal/terms-en.md', 'docs/legal/terms-ja.md']) {
  const doc = read(f);
  if (!doc) { fail('B4', `${f} 가 없다`); continue; }
  if (/(서비스 운영자|Service Operator|サービス運営者)\s*:\s*SyncFortune/.test(doc))
    fail('B4', `${f} 운영자명이 「SyncFortune」 — 등록 상호는 「${BIZ.name}」 다`);
  if (!doc.includes(BIZ.name)) fail('B4', `${f} 에 등록 상호 「${BIZ.name}」 가 없다`);
  if (!doc.includes(BIZ.regNo)) fail('B4', `${f} 에 사업자등록번호가 없다`);
}

// ── B6. 앱이 링크하는 그 문서가 실재하는가 ──────────────────────────────
// ★"URL 은 있는데 원본이 없다" 를 막는다 — Jekyll 은 없는 md 를 404 로 낸다.
const coins = read('app/src/app/(app)/coins.tsx') ?? '';
for (const m of coins.matchAll(/https:\/\/[^\s'"]*\/legal\/([a-z-]+)\.html/g)) {
  const src = `docs/legal/${m[1]}.md`;
  if (!existsSync(path.join(ROOT, src))) fail('B6', `coins.tsx 가 ${m[0]} 를 링크하는데 ${src} 가 없다`);
}
if (!/\/legal\/refund-ko\.html/.test(coins))
  fail('B6', '「운 충전」 화면이 환불정책을 링크하지 않는다 — 결제 화면의 법정 표시 경로다');

// ── B7. 앱 화면이 실제로 그리는가 ──────────────────────────────────────
// ★파일 **이름으로 찍지 않는다** — 화면을 옮기거나 쪼개도 규칙이 살아 있게,
//   「`lib/bizInfo` 를 쓰는 화면이 하나라도 있고, 그 화면이 필수 항목을 다 그린다」로 본다
//   ([[harness-goes-blind-on-refactor]] — 자리로 판정하면 리팩터링에 눈이 먼다).
const screens = [];
const walk = (dir) => {
  for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel); }
    else if (/\.tsx?$/.test(e.name)) screens.push(rel);
  }
};
walk('app/src');
/** 화면이 값 하나를 **JSX 로 그리는가**(단순 import 는 그리는 게 아니다). */
const rendersField = (src, expr) => new RegExp(`\\{\\s*${expr}\\s*\\}`).test(src);
const users = screens.filter((f) => /from\s+['"][./]*(lib\/)?bizInfo['"]/.test(read(f) ?? ''));
if (!users.length) {
  fail('B7', '앱 소스 어디서도 `lib/bizInfo` 를 쓰지 않는다 — 사업자 정보가 앱 화면에 안 뜬다(1×1 웹 푸터는 봇 전용)');
} else {
  const NEED = ['BIZ\\.name', 'BIZ\\.owner', 'BIZ\\.regNo', 'BIZ\\.addr', 'BIZ\\.tel', 'BIZ\\.email'];
  const ok = users.some((f) => { const src = read(f) ?? ''; return NEED.every((n) => rendersField(src, n)) && /mailOrderLabel\s*\(/.test(src); });
  if (!ok) fail('B7', `사업자 정보를 **전부** 그리는 화면이 없다(쓰는 파일: ${users.join(', ')}) — 상호·대표자·등록번호·통신판매업·주소·전화·이메일이 다 있어야 한다`);
}

// ── B8. 단일 출처 밖에 값을 또 적지 않았는가 ───────────────────────────
// ⚠️이 프로젝트가 반복해서 앓는 병이다 — 같은 값의 **사본**이 생기면 조용히 갈린다
//   ([[duplicate-ui-single-source]]). 문서(글자로 적는 정본)와 단일 출처만 허용한다.
const ALLOW = new Set([BIZ_SOURCE, 'scripts/check-bizinfo.mjs']);
const scanDirs = ['app/src', 'scripts', 'supabase'];
for (const d of scanDirs) {
  if (!existsSync(path.join(ROOT, d))) continue;
  const files = [];
  const walk2 = (dir) => {
    for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk2(rel); }
      else if (/\.(ts|tsx|mjs|js|sql|html)$/.test(e.name)) files.push(rel);
    }
  };
  walk2(d);
  for (const f of files) {
    if (ALLOW.has(f)) continue;
    const code = /\.(ts|tsx|mjs|js)$/.test(f) ? stripComments(read(f) ?? '') : (read(f) ?? '');
    if (code.includes(BIZ.regNo))
      fail('B8', `${f} 에 사업자등록번호가 **또** 적혀 있다 — 값은 ${BIZ_SOURCE} 한 곳에만 둔다`);
  }
}

// ── B9. 고지한 가격이 실제로 청구하는 가격인가 ─────────────────────────
// ⚠️2026-09-04 실측: 고지 「운 100개 — 9,900원」 ↔ 「운 충전」 화면 「100 운 ₩7,200」.
//   정적 고지는 **웹 산출물**에 들어간다 — 이 사이트가 받는 값을 적어야 한다.
//   ★판정은 «파일이 무엇을 import 했나» 가 아니라 **값**으로 한다: 차등이 선언된 팩은
//     반드시 그 웹가로 나와야 한다([[harness-judge-expression-not-name]]).
const priceSrc = read('app/src/lib/billing/coinPrices.ts');
if (!priceSrc) fail('B9', 'coinPrices.ts 가 없다 — 옮겼으면 이 하네스도 같이 옮겨라');
else {
  const declaredWeb = new Map([...priceSrc.matchAll(/(coin_\d+)\s*:\s*\{\s*web:\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]));
  const rows = webPacks();
  for (const [id, web] of declaredWeb) {
    const row = rows.find((r) => r.id === id);
    if (!row) { fail('B9', `${id} 에 웹가가 선언됐는데 고지 목록에 그 팩이 없다`); continue; }
    if (row.won !== web) fail('B9', `${id} — 고지가 ${row.won.toLocaleString('ko-KR')}원 ↔ 웹 청구가 ${web.toLocaleString('ko-KR')}원. 고지는 **웹가**여야 한다`);
  }
  if (!declaredWeb.size && rows.length === 0) fail('B9', '팩을 하나도 못 읽었다');
  // 정적 고지를 만드는 쪽이 **자기 정규식으로 정가를 다시 뽑지** 않는지도 본다(재발 경로 차단).
  //   ⚠️★2026-09-04 음성 테스트에서 배운 것: 「`matchAll(...won:\\d...)` 를 찾는다」로 짰더니
  //     `[^)]*` 가 패턴 안의 `(\d+)` 괄호에서 멈춰 **못 잡았다**(거짓 초록불).
  //   ⇒ 판정을 **더 굵게** 바꾼다 — 「가격 파일을 이 스크립트가 아예 열지 않는다」.
  //     값은 `webPacks()` 한 곳에서만 나온다. 열었다면 그 자체가 재발 경로다.
  const injectCode = inject ? stripComments(inject) : '';
  if (injectCode && /coinPrices/.test(injectCode))
    fail('B9', 'inject-og.mjs 가 `coinPrices.ts` 를 직접 읽는다 — 채널을 안 넘겨 스토어 정가가 실린다. `webPacks()` 만 쓸 것');
  if (injectCode && !/webPacks\s*\(/.test(injectCode))
    fail('B9', 'inject-og.mjs 가 `webPacks()` 를 안 쓴다 — 고지 가격의 출처가 불분명하다');
}

if (SELFTEST) {
  // ★음성 테스트 — 규칙이 실제로 «잡는지» 본다. 초록불만 보고 믿지 않는다.
  //   ⚠️규칙을 고칠 때마다 **처음부터 다시** 돌린다(2026-09-03 에 네 번 틀렸다).
  const cases = [
    { name: 'BIZ 재정의를 잡는다', ok: /const\s+BIZ\s*=\s*\{/.test("const BIZ = {\n name:'x'\n}") },
    { name: '★import 만 있는 파일은 안 잡는다', ok: !/const\s+BIZ\s*=\s*\{/.test("import { BIZ } from './biz-info.mjs';") },
    { name: '미기재 표시 ko 를 잡는다', ok: hasPendingMark('| 상호 | (기재 예정) |') },
    { name: '미기재 표시 en 을 잡는다', ok: hasPendingMark('| Company | (pending) |') },
    { name: '미기재 표시 ja 를 잡는다', ok: hasPendingMark('| 商号 | （記載予定） |') },
    { name: '★채워진 표는 안 잡는다', ok: !hasPendingMark(`| 상호 | ${BIZ.name} |`) },
    { name: '값 누락을 잡는다', ok: !containsValue('상호: 다른회사', BIZ.regNo) },
    { name: '★서식이 달라도 값이 있으면 통과', ok: containsValue(`- 사업자등록번호 ${BIZ.regNo}`, BIZ.regNo) },
    { name: '통신판매업: 번호 없을 때 빈칸이면 잡는다', ok: !mailOrderInSync('| 통신판매업 | |', 'ko') },
    { name: '통신판매업: 준비-중 문구가 있으면 통과', ok: mailOrderInSync(`| 통신판매업 | ${mailOrderLabel('ko')} |`, 'ko') },
    { name: '★언어별 문구를 갈라 본다', ok: mailOrderLabel('en') !== mailOrderLabel('ko') && mailOrderLabel('ja') !== mailOrderLabel('ko') },
    { name: '상호 드리프트를 잡는다', ok: /(서비스 운영자|Service Operator|サービス運営者)\s*:\s*SyncFortune/.test('**서비스 운영자: SyncFortune**') },
    { name: '★고친 뒤에는 안 잡는다', ok: !/(서비스 운영자|Service Operator|サービス運営者)\s*:\s*SyncFortune/.test(`**서비스 운영자: ${BIZ.name}**`) },
    { name: 'B6 이 링크에서 문서명을 뽑는다', ok: [...'https://x/legal/refund-ko.html'.matchAll(/https:\/\/[^\s'"]*\/legal\/([a-z-]+)\.html/g)][0]?.[1] === 'refund-ko' },
    { name: 'B7 은 JSX 로 그린 것만 «그렸다» 로 본다', ok: /\{\s*BIZ\.regNo\s*\}/.test('<Text>{BIZ.regNo}</Text>') },
    { name: '★B7: import 만 한 파일은 «그렸다» 가 아니다', ok: !/\{\s*BIZ\.regNo\s*\}/.test("import { BIZ } from './bizInfo';") },
    { name: 'B7 이 import 경로를 알아본다', ok: /from\s+['"][./]*(lib\/)?bizInfo['"]/.test("import { BIZ } from '../../lib/bizInfo';") },
    { name: '★B8 은 단일 출처 자신은 안 잡는다', ok: BIZ_SOURCE.endsWith('bizInfo.ts') },
    { name: 'B9 가 웹 차등가를 읽는다', ok: [...`coin_100:  { web: 7200,`.matchAll(/(coin_\d+)\s*:\s*\{\s*web:\s*(\d+)/g)][0]?.[2] === '7200' },
    { name: '★B9: 차등이 없는 팩은 정가 그대로', ok: webPacks().every((r) => r.won > 0) },
    { name: 'B9 가 직접 파싱을 잡는다(굵은 판정)', ok: /coinPrices/.test("readFileSync('app/src/lib/billing/coinPrices.ts')") },
    { name: '★B9: webPacks 만 쓰는 파일은 안 잡는다', ok: !/coinPrices/.test('const packs = webPacks();') },
    { name: '★B9: 옛 판정식이 왜 틀렸는지 고정', ok: !/matchAll\([^)]*won:\s*\\d/.test('matchAll(/coins:\\s*(\\d+),\\s*won:\\s*(\\d+)/g)') },
    { name: '★주석 속 낱말은 판정하지 않는다', ok: !/coinPrices/.test(stripComments('// coinPrices.ts 를 읽는다\nconst a=1;')) },
    { name: '★블록 주석도 걷어낸다', ok: !/coinPrices/.test(stripComments('/* coinPrices */ const a=1;')) },
    { name: '★코드에 있으면 그대로 잡는다', ok: /coinPrices/.test(stripComments("read('coinPrices.ts')")) },
    { name: '★URL 의 // 는 주석이 아니다', ok: /niwoon2/.test(stripComments("const u='https://niwoon2.pages.dev';")) },
    { name: '★줄 수를 보존한다', ok: stripComments('a\n// b\nc').split('\n').length === 3 },
  ];
  let f2 = 0;
  for (const c of cases) if (!c.ok) { f2++; console.log(`  ❌ ${c.name}`); }
  console.log(f2 ? `❌ selftest ${f2} 실패` : `✅ selftest ${cases.length}/${cases.length}`);
  process.exit(f2 ? 1 : 0);
}

if (bad) { console.log(`\n❌ check:bizinfo — ${bad}건. 사람이 여는 문서에 법정 표시가 비어 있다.`); process.exit(1); }
console.log(`✅ check:bizinfo — 사업자 정보가 단일 출처(${BIZ.name}·${BIZ.regNo})에서 문서 6종까지 일치 · 통신판매업 「${BIZ.mailOrderNo || mailOrderLabel('ko')}」`);
