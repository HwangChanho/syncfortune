// scripts/check-birthtime.ts — 명식 등록의 **시각 입력**(24시간제)
// ═══════════════════════════════════════════════════════════════════════════
// 이력 두 줄:
//   · 08-11 daniel: *"00:03 출생은 등록이 안되는데?"* — 12시간제라 시가 `1~12` 뿐이었다.
//   · 08-11 daniel: *"오전오후 나누지말고 24시간 기준으로 입력하게 하자"* — 토글을 없앴다.
//     ⇒ 저장 형식이 어차피 24시간제이므로 **변환 자체가 사라졌다**(헷갈릴 자리가 없다).
//
// ★화면과 **같은 함수**(`parseBirthTime`)를 검사한다 — 복사본이 아니다.
//   첫 판은 규칙을 하네스 안에 복사해 뒀다가, 음성 테스트에서 "화면을 되돌려도 통과"로 드러났다.
// 실행: npm run check:birthtime
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import { parseBirthTime, hourHint } from '../app/src/lib/engine/birthTime';

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}  ${detail}`); }
};
const h24 = (h: string, m: string) => parseBirthTime(h, m).h24;

console.log('\n🕐 명식 등록 — 태어난 시각(24시간제)\n');

// ── ① daniel 이 신고한 그 입력 ────────────────────────────────────────────
check('★00:03 이 등록된다 → 0:03 (daniel 신고 건)', h24('00', '03') === '0:03', String(h24('00', '03')));
check('0:03 (앞자리 0 없이)도 같다', h24('0', '03') === '0:03');

// ── ② 24시간제 전 구간 ────────────────────────────────────────────────────
check('00:00 = 자정 정각', h24('00', '00') === '0:00');
check('12:00 = 정오', h24('12', '00') === '12:00');
check('13:30 = 오후 1시 반', h24('13', '30') === '13:30');
check('23:59 = 마지막 분', h24('23', '59') === '23:59');
check('09:05 (앞자리 0)', h24('09', '05') === '9:05');

// ── ③ 잘못된 입력은 막는다 (음성) ─────────────────────────────────────────
check('음성: 24 시는 막힌다', h24('24', '00') === null);
check('음성: 25 시는 막힌다', h24('25', '00') === null);
check('음성: 분 60 은 막힌다', h24('5', '60') === null);
check('음성: 빈 칸은 막힌다', h24('', '30') === null && h24('5', '') === null);
check('★막힌 이유가 문장으로 나온다', (parseBirthTime('24', '00').why ?? '').includes('0~23'));
check('대조군: 유효하면 이유가 없다', parseBirthTime('7', '10').why === null);
check('둘 다 비었으면 이유도 없다(아직 안 친 상태)', parseBirthTime('', '').why === null);

// ── ④ 헷갈리는 두 자리에만 꼬리표 ─────────────────────────────────────────
check('0시 = 자정 꼬리표', hourHint(0) === '자정');
check('12시 = 정오 꼬리표', hourHint(12) === '정오');
check('대조군: 나머지 시각엔 꼬리표를 안 붙인다', hourHint(9) === null && hourHint(23) === null);

// ── ⑤ 화면이 같은 함수를 쓰는가 · 오전/오후가 정말 사라졌는가 ─────────────
{
  const src = fs.readFileSync('app/src/screens/ChartRegisterScreen.tsx', 'utf8');
  check('화면이 parseBirthTime 을 쓴다(식을 다시 적지 않았다)', /parseBirthTime\(/.test(src));
  check('★오전/오후 토글이 화면에서 사라졌다', !/ampmRow|setAmpm/.test(src), '토글 잔재 있음');
  check('★막힐 때 이유를 보여 준다(침묵 금지)', /exactWhy/.test(src));
}

console.log(`\n태어난 시각 입력  PASS ${pass} / FAIL ${fail}`);
if (fail) process.exitCode = 1;
