#!/usr/bin/env tsx
// scripts/check-paygate.ts — 결제 게이트 불변식 하네스(이중과금 재발 방지). daniel 2026-08-01.
// ─────────────────────────────────────────────────────────────────────────
// 왜 만들었나 — 실제로 두 번 당했다:
//   ① 2026-07-29 `ziwei` 가 **0.1초 안에 3번 차감**(−450 woon). 자미 12궁을 동시에 생성하니
//      병렬 요청이 전부 '미언락'을 보고 각자 결제했다(조회와 차감 사이의 창 = 경쟁 조건).
//   ② 2026-08-01 daniel 신고 "구매 → 풀이 도중 홈으로 → 배너로 재진입하면 또 결제".
//      개별 유료 kind 는 차감만 하고 **언락을 남기지 않아**, 생성이 끝나기 전에 이탈하면
//      캐시도 언락도 없어 재진입이 '미결제'로 보였다.
//
// 두 사고의 뿌리는 하나다: **차감이 '이미 샀다'는 영구 증거와 원자적으로 묶여 있지 않았다.**
//
// ▶ 강제하는 불변식
//   (A) 명식 귀속 유료 kind 의 차감은 **claimUnlock 선점 안에서만** 일어난다.
//       (선점 = reading_unlocks 삽입. PK(chart_id,kind)가 중재자라 병렬이어도 딱 하나만 결제한다.)
//   (B) 선점 후 차감이 실패하면 **releaseUnlock 으로 롤백**한다(안 지우면 돈 없이 영구 무료).
//   (C) 헬퍼(claimUnlock/releaseUnlock)가 존재한다.
//
// ▶ 면제(횟수형·의도적 재과금) — 명식에 귀속되는 산출물이 없어 언락 개념이 성립하지 않는다:
//   dream(5회 번들) · followup(추가질문 횟수) · compat(상대 '쌍' 단위 자체 게이트) · spendRenewal(재통변=의도적 재과금)
//   ⚠️면제를 늘릴 때는 **왜 언락이 필요 없는지**를 여기 사유로 남길 것.
//
// 사용: npm run check:paygate   (드리프트 있으면 exit 1)
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const FILE = 'supabase/functions/interpret/index.ts';
const src = readFileSync(FILE, 'utf8');
const lines = src.split('\n');

/** 면제 사유 — 차감 호출 줄에 이 문자열이 있으면 언락 짝을 요구하지 않는다. */
const EXEMPT: { match: string; why: string }[] = [
  { match: `'dream'`, why: '꿈해몽 = 5회 번들 횟수형(명식 무관 · 산출물이 명식에 귀속되지 않음)' },
  { match: `'followup'`, why: '추가질문 = 횟수형(질문 1건 = 차감 1건이 정상)' },
  { match: `'compat'`, why: '궁합 = 상대 쌍(sig) 단위 자체 게이트(명식×kind 로 표현되지 않음)' },
  { match: `spendRenewal(`, why: '재통변 = 의도적 재과금(이미 본 것을 새로 만드는 값)' },
];

const problems: string[] = [];

// (C) 헬퍼 존재
for (const fn of ['async function claimUnlock', 'async function releaseUnlock']) {
  if (!src.includes(fn)) problems.push(`헬퍼 없음: ${fn} — 원자적 선점 구조가 통째로 사라졌습니다.`);
}

// (A)(B) 차감 호출마다 선점·롤백 검사
const spendRe = /await\s+(spendForKind|spendRenewal)\s*\(/;
let checked = 0, exempt = 0;
lines.forEach((line, i) => {
  if (!spendRe.test(line)) return;
  if (line.includes('async function')) return;                  // 정의부 자체는 대상 아님
  const ex = EXEMPT.find((e) => line.includes(e.match));
  if (ex) { exempt++; return; }
  checked++;

  const ln = i + 1;
  const before = lines.slice(Math.max(0, i - 6), i).join('\n');  // 선점은 바로 위에 있어야 한다
  const after = lines.slice(i + 1, i + 9).join('\n');            // 롤백은 실패 분기(바로 아래)에 있어야 한다

  if (!before.includes('claimUnlock(')) {
    problems.push(
      `${FILE}:${ln} — 차감이 **선점(claimUnlock) 밖**에 있습니다.\n` +
      `      ${line.trim().slice(0, 110)}\n` +
      `      → 병렬 요청이 각자 결제합니다(2026-07-29 ziwei −450 과 같은 사고).\n` +
      `        면제 대상이면 EXEMPT 에 **사유와 함께** 등록하세요.`,
    );
  }
  if (!after.includes('releaseUnlock(')) {
    problems.push(
      `${FILE}:${ln} — 차감 실패 분기에 **롤백(releaseUnlock)이 없습니다**.\n` +
      `      → 잔액 부족인데 선점만 남아 그 명식이 영구 무료가 됩니다.`,
    );
  }
});

// ── (D) 클라 게이트: 명식 귀속 kind 의 ensureCoinsFor 는 chartId 를 넘겨야 한다 ──────────────
//   안 넘기면 '이미 산 콘텐츠'를 알 수 없어 ①결제창이 또 뜨고 ②잔액이 모자라면 **자기가 산 걸 못 연다**.
//   (소유 판정은 coinGate 안에서 isUnlocked → 서버 reading_unlocks 로 한다.)
const CLIENT_EXEMPT = ['dream', 'followup', 'compat', 'timeresolve']; // 명식에 귀속되지 않는 kind(위 EXEMPT 와 같은 이유)
const clientFiles = execSync(
  `grep -rl "ensureCoinsFor(" app/src --include=*.tsx --include=*.ts || true`,
  { encoding: 'utf8' },
).split('\n').map((s) => s.trim()).filter((s) => s && !s.includes('lib/billing/coinGate.ts'));

let clientChecked = 0, clientExempt = 0;
for (const f of clientFiles) {
  const fl = readFileSync(f, 'utf8').split('\n');
  fl.forEach((line, i) => {
    if (!line.includes('ensureCoinsFor(')) return;
    const kindLit = /ensureCoinsFor\(\s*'([a-z_0-9]+)'/.exec(line)?.[1] ?? null;
    if (kindLit && CLIENT_EXEMPT.includes(kindLit)) { clientExempt++; return; }
    clientChecked++;
    const call = fl.slice(i, i + 9).join('\n');                 // 옵션 객체가 여러 줄에 걸칠 수 있다
    if (!/chartId\s*[:,}]/.test(call)) {
      problems.push(
        `${f}:${i + 1} — ensureCoinsFor 에 **chartId 를 안 넘깁니다**(kind=${kindLit ?? '동적'}).\n` +
        `      → 이미 산 콘텐츠인데 결제창이 다시 뜨고, 잔액이 모자라면 **산 걸 못 엽니다**.\n` +
        `        명식 무관 kind 면 CLIENT_EXEMPT 에 사유와 함께 등록하세요.`,
      );
    }
  });
}

console.log(`\n💳 결제 게이트 불변식`);
console.log(`   [서버] ${FILE} — 차감 지점 ${checked}개 · 면제 ${exempt}개`);
for (const e of EXEMPT) console.log(`     · 면제 ${e.match.padEnd(16)} ${e.why}`);
console.log(`   [클라] ensureCoinsFor 호출 ${clientChecked}개 검사 · 면제 ${clientExempt}개(${CLIENT_EXEMPT.join('·')})`);

if (problems.length) {
  console.error(`\n❌ 위반 ${problems.length}건\n`);
  problems.forEach((p) => console.error('   ' + p + '\n'));
  console.error('   ※ 규칙: 명식 귀속 유료 kind 는 [선점 → 차감 → (실패 시 롤백)] 순서를 지킨다.');
  console.error('     차감을 먼저 하면 재진입이 재차감되고, 조회 후 차감하면 병렬이 중복 결제한다.\n');
  process.exit(1);
}
console.log(`   ✅ 모든 명식 귀속 차감이 선점·롤백과 짝을 이룹니다.\n`);
