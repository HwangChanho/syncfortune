#!/usr/bin/env tsx
// scripts/check-sections.ts — 유료 콘텐츠 **섹션 유실** 방지 하네스. daniel 2026-08-01.
// ─────────────────────────────────────────────────────────────────────────
// 왜 만들었나 — daniel: *"10년 뒤가 건강이랑 성장내면 변화만 있는데 이게 맞는거야?"*
//   DB 실측: 저장된 `future10` 풀이의 키가 **셋뿐**이었다(`headline·health·growth`).
//   있어야 할 여덟 중 `bigPicture·career·wealth·relation·prepare` 가 없었다.
//
//   원인이 **둘 겹쳤다**:
//     ① `future10` 이 `maxOut`(출력 토큰) 표에 없어 기본값으로 떨어져 JSON 이 **절단**됐다.
//     ② 절단을 구제하는 `SALVAGE_KEYS` 화이트리스트에 future10 키가 **등록돼 있지 않았다**
//        → 모델이 분명히 써 보낸 `career·wealth·relation` 이 **조용히 버려졌다**(오류도 로그도 없음).
//
//   ②는 `expectedKeysOf`(프롬프트에서 키 추출)로 구조적으로 없앴다. 이 하네스는 **①과 화면 정합**을 지킨다.
//
// ▶ 강제하는 불변식
//   S1 앱이 그리는 섹션 키는 **전부 프롬프트 출력 스키마에 있다**
//      (없으면 그 카드는 영원히 빈칸이다 — 모델이 만들 이유가 없는 키니까).
//   S2 섹션이 많은 kind(7개 이상)는 `maxOut` 에 **명시 항목**이 있어야 한다.
//      기본값으로 떨어지면 뒤쪽 섹션이 절단된다(future10 이 정확히 그랬다).
//   S3 `expectedKeysOf` 가 **실제로 키를 뽑는다** — 못 뽑으면 조용히 레거시 목록으로 폴백해
//      ②가 그대로 재발한다. 프롬프트당 최소 1개는 나와야 한다.
//
// 사용: npm run check:sections   (위반 있으면 exit 1)
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PROMPTS = 'supabase/functions/_shared/prompts.ts';
const INTERPRET = 'supabase/functions/interpret/index.ts';
const APPDIR = 'app/src/app/(app)';

const promptSrc = readFileSync(PROMPTS, 'utf8');
const interpretSrc = readFileSync(INTERPRET, 'utf8');
const problems: string[] = [];

// ★규칙을 여기 복사하지 않는다 — Edge(interpret)와 **같은 모듈**을 쓴다.
//   복사본을 두면 그 순간부터 하네스가 실제 동작이 아니라 '사본'을 검사하게 된다(= 거짓말).
import { expectedKeysOf } from '../supabase/functions/_shared/schemaKeys.ts';

// ── 프롬프트 상수 → 출력 키 ─────────────────────────────────────────────
// ⚠️본문을 정규식으로 잘라내면 안 된다 — 프롬프트 안에 백틱이 섞여 있어 비탐욕 매칭이 **본문을 삼킨다**
//   (실제로 `CAREERFIT_SYSTEM` 하나가 통째로 스캔에서 빠졌다 = 검사 못 하는 콘텐츠가 생겼다).
//   → `export const` **경계**로 자른다. 본문에 뭐가 들어 있든 안전하다.
const promptKeys = new Map<string, string[]>();           // 상수명(FUTURE10_SYSTEM) → 키[]
{
  const marks = [...promptSrc.matchAll(/export const ([A-Z0-9_]+)\s*=\s*`/g)];
  marks.forEach((m, i) => {
    if (!/_SYSTEM$/.test(m[1])) return;                   // 프롬프트 조각(MYEONGRI_RULES 등)은 출력 스키마가 없다
    const from = m.index! + m[0].length;
    const to = i + 1 < marks.length ? marks[i + 1].index! : promptSrc.length;
    promptKeys.set(m[1], expectedKeysOf(promptSrc.slice(from, to)));
  });
}
if (promptKeys.size === 0) problems.push(`${PROMPTS}: 시스템 프롬프트 상수를 하나도 못 읽었습니다(형식 변경?).`);

// S3 — 추출이 실제로 되는가(0개면 조용히 레거시 폴백 = 유실 재발)
const emptyPrompts = [...promptKeys].filter(([, ks]) => ks.length === 0).map(([n]) => n);
// 출력 스키마가 JSON 템플릿이 아닌 프롬프트(자유서술)는 예외 — 사유를 남긴다.
// 출력이 사용자용 JSON 이 아닌 내부 프롬프트 — 사유를 남긴다(예외를 늘릴 때도 반드시 사유와 함께).
const NO_SCHEMA_OK = new Map<string, string>([
  ['COACH_SYSTEM', '코치 Q&A — 자유 서술(고정 섹션 없음)'],
  ['FOLLOWUP_SYSTEM', '추가 질문 — 자유 서술'],
  ['CRITIC_REVIEW_SYSTEM', '내부 비판 루프 — 사용자에게 안 나감'],
  ['COMPAT_READING_SYSTEM', '궁합 — 출력 키를 **user 프롬프트가 동적으로 지정**(관계별로 다름). 레거시 SALVAGE_KEYS 가 커버'],
  ['COMPAT_ZIWEI_READING_SYSTEM', '자미 궁합 — 위와 동일(동적 키)'],
]);
const badEmpty = emptyPrompts.filter((n) => !NO_SCHEMA_OK.has(n));
if (badEmpty.length) {
  problems.push(
    `키를 못 뽑은 프롬프트: ${badEmpty.join(', ')}\n` +
    `      → expectedKeysOf 가 0개를 돌려주면 절단 구제가 **레거시 목록으로 폴백**합니다.\n` +
    `        그 목록에 없는 섹션은 모델이 써 보내도 버려집니다(future10 사고의 원인).`,
  );
}

// ── interpret 의 maxOut 명시 kind 목록 ──────────────────────────────────
const maxOutLine = interpretSrc.match(/const maxOut = [\s\S]*?;\n/)?.[0] ?? '';
const maxOutKinds = new Set([...maxOutLine.matchAll(/kind === '([a-zA-Z0-9_]+)'/g)].map((m) => m[1]));

// ── 앱 화면의 섹션 키 ───────────────────────────────────────────────────
type Screen = { file: string; kind: string; keys: string[] };
const screens: Screen[] = [];
for (const f of readdirSync(APPDIR).filter((x) => x.endsWith('.tsx'))) {
  const src = readFileSync(join(APPDIR, f), 'utf8');
  if (!src.includes('SpecialContentScreen')) continue;
  // ⚠️`[a-zA-Z_]+` 였을 때 **future10 이 통째로 빠졌다**(숫자 때문). 사고 당사자를 못 보는 하네스였다.
  const kind = src.match(/kind=["']([a-zA-Z0-9_]+)["']/)?.[1];
  if (!kind) continue;
  const secBlock = src.match(/sections=\{\[([\s\S]*?)\]\}/)?.[1] ?? '';
  const keys = [...secBlock.matchAll(/key:\s*'([A-Za-z_][A-Za-z0-9_]*)'/g)].map((m) => m[1]);
  if (keys.length) screens.push({ file: f, kind, keys });
}
if (!screens.length) problems.push(`${APPDIR}: SpecialContentScreen 화면을 하나도 못 읽었습니다(형식 변경?).`);

// kind → 프롬프트 상수: **이름으로 추측하지 않는다.**
//   interpret 의 baseSystem 디스패처(`kind === 'jobfit' ? CAREERFIT_SYSTEM`)가 유일한 진실이다.
//   추측하면 jobfit(→CAREERFIT_SYSTEM)처럼 이름이 다른 것들을 '못 찾음'으로 흘려보낸다(= 검사 구멍).
const dispatch = new Map<string, string>();
//   ⚠️`kind === 'jobfit' ? 4200`(maxOut 줄)도 같은 모양이라 그대로 두면 **상수명을 숫자가 덮어쓴다**
//     (실제로 jobfit 이 '못 찾음'으로 새어 나갔다). 값이 프롬프트 상수일 때만 받는다.
for (const m of interpretSrc.matchAll(/kind === '([a-zA-Z0-9_]+)'\s*\?\s*([A-Z][A-Z0-9_]*_SYSTEM)\b/g)) {
  if (!dispatch.has(m[1])) dispatch.set(m[1], m[2]);
}
const keysForKind = (kind: string): string[] | null => {
  const konst = dispatch.get(kind);
  if (konst && promptKeys.has(konst)) return promptKeys.get(konst)!;
  const up = kind.toUpperCase();                                   // 디스패처에 없으면 이름으로 폴백
  for (const cand of [`${up}_SYSTEM`, `${up}_READING_SYSTEM`]) if (promptKeys.has(cand)) return promptKeys.get(cand)!;
  return null;
};

const rows: string[] = [];
for (const s of screens) {
  const pk = keysForKind(s.kind);
  if (!pk) { rows.push(`   ? ${s.kind.padEnd(12)} 프롬프트 상수를 못 찾음(수동 확인)`); continue; }

  // S1 — 앱이 그리는 키가 프롬프트에 없으면 그 카드는 영원히 빈칸
  const missing = s.keys.filter((k) => !pk.includes(k));
  if (missing.length) {
    problems.push(
      `${s.file}: 프롬프트에 없는 섹션 키 — ${missing.join(', ')}\n` +
      `      → 모델은 그 키를 만들 이유가 없습니다. 그 카드는 항상 빈칸입니다.`,
    );
  }

  // S2 — 섹션이 많은데 출력 토큰 상한이 기본값이면 뒤쪽이 절단된다(future10 사고)
  const needExplicit = pk.length >= 7;
  const hasExplicit = maxOutKinds.has(s.kind);
  if (needExplicit && !hasExplicit) {
    problems.push(
      `${s.kind}: 출력 섹션 ${pk.length}개인데 maxOut 에 **명시 항목이 없습니다**(기본값 사용).\n` +
      `      → 뒤쪽 섹션이 잘려 사라집니다. future10 이 정확히 이래서 8개 중 3개만 남았습니다.`,
    );
  }
  rows.push(`   ✓ ${s.kind.padEnd(12)} 화면 ${String(s.keys.length).padStart(2)}개 / 프롬프트 ${String(pk.length).padStart(2)}개 · maxOut ${hasExplicit ? '명시' : '기본'}`);
}

console.log(`\n🧩 유료 콘텐츠 섹션 정합(프롬프트 ↔ 화면 ↔ 출력 상한)`);
rows.forEach((r) => console.log(r));

if (problems.length) {
  console.error(`\n❌ 위반 ${problems.length}건\n`);
  problems.forEach((p) => console.error('   ' + p + '\n'));
  console.error('   ※ 규칙: 화면이 그리는 섹션은 프롬프트가 만들고, 그 전부가 들어갈 만큼 출력 상한을 준다.');
  console.error('     둘 중 하나만 어긋나도 사용자는 **빈 풀이**를 본다(오류 없이 조용히).\n');
  process.exit(1);
}
console.log(`   ✅ 화면 ${screens.length}종 전부 정합(섹션 키·출력 상한).\n`);
