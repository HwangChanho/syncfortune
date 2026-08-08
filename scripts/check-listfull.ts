// scripts/check-listfull.ts — 목록이 **콘텐츠를 조용히 감추지 않는지** 검사
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (2026-08-09 실사고):
//   daniel "이번에 ui 바꾸면서 컨텐츠 몇개가 사라졌는데?" · "mbti 이런것도 없는데"
//   실측: 51개 중 **22개만** 보이고 있었다. 데이터는 멀쩡했고 원인은 렌더 세 겹이었다 —
//     ① 리스트뷰가 섹션당 4개만 표시(slice) ② 08-07 에 기본 보기를 카드→리스트로 바꿈
//     ③ 정렬이 `쿠폰보유 → 무료 → 신규` 라 NEW 만료·쿠폰 변화로 **보이는 4개가 날마다 바뀜**
//   ★핵심 교훈: 목록에서 항목을 자르는 코드는 그 자체로는 버그처럼 안 보인다.
//     **기본값(뷰 모드)이나 정렬이 바뀌는 순간** 조용히 콘텐츠 소실로 바뀐다.
//
// 검사 규칙(둘 다 '표현식'으로 판정 — 이름만 보면 주석·문자열에 뚫린다):
//   L1 ContentGrid 의 섹션 항목 배열에 **자르는 연산(slice/splice)** 이 없어야 한다.
//   L2 순차 공개 인덱스는 **렌더되는 배열에서 파생**해야 한다
//      (필터 전 상수 `CARD_REVEAL_OFFSETS`/`TOTAL_CARDS` 를 쓰면 두 축이 다른 배열을 가리킨다).
//
// ★음성 테스트 필수(harness-judge-expression-not-name 교훈):
//   `npx tsx scripts/check-listfull.ts --selftest` 로 **깨뜨린 입력을 물는지** 확인한다.
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';

const FILE = 'app/src/components/ContentGrid.tsx';

/** 주석·문자열 리터럴을 지운 '코드만' 남긴 텍스트. 주석 속 단어에 걸리는 오탐을 없앤다. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')     // 블록 주석
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ') // 줄 주석(URL 의 '//' 는 앞에 ':' 가 오므로 보존)
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")   // 작은따옴표 문자열
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')   // 큰따옴표 문자열
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');  // 템플릿 리터럴
}

type Finding = { rule: string; msg: string };

/** @param src ContentGrid 원본 텍스트 @returns 위반 목록(빈 배열 = 통과) */
export function audit(src: string): Finding[] {
  const code = codeOnly(src);
  const out: Finding[] = [];

  // L1 — 섹션 항목을 자르는 연산. `items.slice(` / `sec.items.slice(` / `.splice(` 전부.
  //   ★`.slice(0, 1)` 같은 **문자열** 자르기(썸네일 첫 글자)는 위에서 문자열이 지워져도 남으므로
  //     대상 식별자를 items/shown 계열로 좁힌다.
  const cut = /\b(?:sec\.)?items\s*\.\s*(?:slice|splice)\s*\(/.exec(code);
  if (cut) out.push({ rule: 'L1', msg: `섹션 항목을 자른다 — "${cut[0]}" (목록에서 콘텐츠가 사라진다)` });

  // L2 — 필터 전 상수를 공개 인덱스로 쓰면 안 된다.
  for (const bad of ['CARD_REVEAL_OFFSETS', 'TOTAL_CARDS']) {
    if (new RegExp(`\\b${bad}\\b`).test(code)) {
      out.push({ rule: 'L2', msg: `${bad} 는 **필터 전** SECTIONS 기준이라 렌더 배열과 어긋난다 — sections 에서 파생할 것` });
    }
  }
  return out;
}

// ── 음성 테스트: 규칙을 깨뜨린 입력을 실제로 무는지 ────────────────────────
function selftest(): number {
  const cases: { name: string; src: string; expect: string | null }[] = [
    { name: '정상(현재 파일)', src: fs.readFileSync(FILE, 'utf8'), expect: null },
    { name: '항목 자르기 부활', src: 'const shown = items.slice(0, 4);', expect: 'L1' },
    { name: 'sec.items 자르기', src: 'const x = sec.items.slice(0, N);', expect: 'L1' },
    { name: 'splice 로 우회', src: 'const y = items.splice(0, 4);', expect: 'L1' },
    { name: '필터 전 상수 사용', src: 'const r = CARD_REVEAL_OFFSETS[i] + j < n;', expect: 'L2' },
    { name: 'TOTAL_CARDS 사용', src: 'if (revealCount >= TOTAL_CARDS) return;', expect: 'L2' },
    // ↓ 물면 **안 되는** 것들(오탐 검사)
    { name: '주석 속 문구', src: '// 예전엔 items.slice(0, LIST_PREVIEW) 로 잘랐다', expect: null },
    { name: '문자열 속 문구', src: "const s = 'items.slice(0,4)';", expect: null },
    { name: '썸네일 첫 글자', src: "const g = t(m.labelKey).slice(0, 1);", expect: null },
  ];
  let bad = 0;
  for (const c of cases) {
    const got = audit(c.src);
    const hit = got.length ? got[0].rule : null;
    const ok = hit === c.expect;
    if (!ok) bad++;
    console.log(`  ${ok ? '✓' : '✗'} ${c.name.padEnd(18)} 기대=${c.expect ?? '통과'} 실제=${hit ?? '통과'}`);
  }
  return bad;
}

const main = () => {
  if (process.argv.includes('--selftest')) {
    console.log('🧪 check:listfull — 음성 테스트');
    const bad = selftest();
    console.log(bad ? `\n❌ 음성 테스트 ${bad}건 실패 — 하네스가 못 문다` : '\n✅ 음성 테스트 전건 통과');
    process.exit(bad ? 1 : 0);
  }
  console.log('📋 check:listfull — 목록이 콘텐츠를 감추지 않는지');
  const found = audit(fs.readFileSync(FILE, 'utf8'));
  if (!found.length) { console.log('  ✓ 섹션 항목 자르기 없음 · 공개 인덱스는 렌더 배열에서 파생'); process.exit(0); }
  for (const f of found) console.log(`  ✗ [${f.rule}] ${f.msg}`);
  console.log(`\n❌ check:listfull 실패 ${found.length}건`);
  process.exit(1);
};
main();
