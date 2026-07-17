// scripts/check-sharedchart.ts — 커뮤니티 게시물에 첨부되는 명식의 **유출 가드**(결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 왜 하네스인가: 커뮤니티 게시물은 **앱 설치자 누구나 REST 로 읽는다**(RLS read = authenticated,
//   이 앱은 익명 세션 상시 발급). 그래서 첨부 명식에 무엇이 실리는지가 곧 공개 범위다.
//   화이트리스트(app/src/lib/backend/communityChart.ts)는 지금 맞더라도, 나중에 누군가
//   "필드 하나만 더" 넣는 순간 조용히 샌다 — 화면에는 아무 변화가 없어서 눈으로는 안 잡힌다.
//
// ★2026-07-17 (b) 반영(daniel: 여러 시기 대운/세운 넘겨보기): show_luck=true 면 전 생애 대운(luckCycles)
//   + 각 대운 세운(annuals)을 **허용**한다. 단 **월운(months)·대운세운 상호작용(interactionsWithLuck)·
//   structure(해자)·원시 PII 는 항상 금지**. show_luck=false 면 시간축(luckCycles·annuals·currentLuck·
//   annual·months) 이 통째로 없어야 한다(시기 미공개 = 원국만).
//
// 실행: npm run check:sharedchart  (preflight 에 포함)
// ─────────────────────────────────────────────────────────────────────────
import { buildSajuChart } from '../engine/saju';
import { buildZiweiChart } from '../engine/ziwei';
import { toSharedSaju, toSharedZiwei } from '../app/src/lib/backend/communityChart';

// 항상 금지(show_luck 무관). JSON 에 `"키":` 로 등장하면 유출.
const FORBIDDEN_ALWAYS = [
  'months',              // 세운별 월운 12(세밀 시간축 — 넘겨보기에 불필요·크기)
  'interactionsWithLuck', // 대운×세운 합충 상호작용(상세 — 넘겨보기에 불필요·크기)
  'structure',           // 격국·용신·병약·문파 판정 = 인코딩된 전문가 레이어(해자)
  'decades',             // 자미 대한(시간축)
  'birthDateTime', 'birthPlace', 'birthLon', 'birthLat', 'sex', 'calendar', 'timeAccuracy', // 원시 PII
];
// show_luck=false 일 때 추가로 없어야 하는 시간축(미공개 = 원국만).
const TIMEAXIS = ['luckCycles', 'annuals', 'currentLuck', 'annual'];

const INPUT: any = { birthDateTime: '1990-05-05 09:30', calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '서울' };

let failed = 0;
const fail = (msg: string) => { console.error(`  ❌ ${msg}`); failed++; };
const pass = (msg: string) => console.log(`  ✅ ${msg}`);
const has = (payload: unknown, keys: string[]) => {
  const json = JSON.stringify(payload ?? null);
  return keys.filter((k) => json.includes(`"${k}":`));
};
const kb = (o: unknown) => (JSON.stringify(o ?? null).length / 1024).toFixed(1) + 'KB';

const saju = buildSajuChart(INPUT, 2026);
const ziwei = buildZiweiChart(INPUT);

console.log('■ check:sharedchart — 커뮤니티 첨부 명식 유출 가드');

// ① 시기 미공개 = 시간축 통째로 없어야
console.log('\n[1] show_luck=false — 시간축(luckCycles·annuals·currentLuck·annual)이 아예 없어야');
const off = toSharedSaju(saju, false);
const offForbidden = has(off, FORBIDDEN_ALWAYS);
const offTime = has(off, TIMEAXIS);
offForbidden.length ? fail(`항상 금지 필드 유출: ${offForbidden.join(', ')}`) : pass('항상 금지 필드 없음');
offTime.length ? fail(`미공개인데 시간축 실림: ${offTime.join(', ')} — REST 로 읽힌다`) : pass('시간축 전부 부재');

// ② 시기 공개 = 전 생애 대운/세운 허용, 단 월운·상호작용·해자·PII 는 금지
console.log('\n[2] show_luck=true — 전 생애 대운/세운 허용 · 월운/상호작용/해자/PII 금지');
const on = toSharedSaju(saju, true);
const onForbidden = has(on, FORBIDDEN_ALWAYS);
onForbidden.length ? fail(`금지 필드 유출: ${onForbidden.join(', ')}`) : pass('금지 필드 없음(months·interactionsWithLuck 절단 확인)');
on.luckCycles && on.luckCycles.length >= 8 && (on.luckCycles[0].annuals?.length ?? 0) > 0
  ? pass(`대운 ${on.luckCycles.length}개 · 대운[0] 세운 ${on.luckCycles[0].annuals?.length}개(넘겨보기 데이터)`)
  : fail('공개인데 전 생애 대운/세운(luckCycles)이 비었음');
on.currentLuck && on.annual ? pass(`현재 대운 ${on.currentLuck.stem}${on.currentLuck.branch} · 세운 ${on.annual.year}`) : fail('현재 대운·세운(초기 표시)이 없음');

// ③ 자미 명반
console.log('\n[3] 자미 명반 — 12궁·주성만(대한 제외)');
const zi = toSharedZiwei(ziwei);
const ziForbidden = has(zi, FORBIDDEN_ALWAYS);
ziForbidden.length ? fail(`금지 필드 유출: ${ziForbidden.join(', ')}`) : pass('금지 필드 없음');
if (!zi) fail('명반 변환 실패(null)');
else if (zi.palaces.length !== 12) fail(`궁이 12개가 아님: ${zi.palaces.length}`);
else pass(`12궁 · ${zi.bureau} · 명궁 ${zi.lifePalaceBranch}`);

// ④ 크기 — 회귀(월운·상호작용까지 통째로 싣기 시작)를 크기로도 잡는다. 대운/세운 포함 상한 = 14KB.
console.log('\n[4] 페이로드 크기');
const sharedTotal = JSON.stringify(on).length + JSON.stringify(zi).length;
const rawTotal = JSON.stringify(saju).length + JSON.stringify(ziwei).length;
console.log(`  원본 통째: ${(rawTotal / 1024).toFixed(1)}KB → 화이트리스트: ${(sharedTotal / 1024).toFixed(1)}KB (${(100 - (sharedTotal / rawTotal) * 100).toFixed(1)}% 감소)`);
sharedTotal < 14 * 1024 ? pass('첨부 14KB 미만(월운·상호작용 제외로 관리)') : fail(`첨부가 14KB 초과(${(sharedTotal / 1024).toFixed(1)}KB) — 월운/상호작용을 다시 싣고 있지 않은지 확인`);

// ⑤ 역검증 — 원본엔 금지 필드가 있어야(가드가 껍데기가 아님).
console.log('\n[5] 역검증 — 원본에는 금지 필드가 있어야');
const rawForbidden = has(saju, FORBIDDEN_ALWAYS);
rawForbidden.length ? pass(`원본 SajuChart 에 ${rawForbidden.join(', ')} 존재 → 가드가 이걸 막고 있다`)
  : fail('원본에도 금지 필드가 없다 = 하네스가 아무것도 검사하지 않음(필드명 변경?)');

console.log(failed ? `\n❌ check:sharedchart 실패 ${failed}건` : '\n✅ check:sharedchart 통과');
process.exit(failed ? 1 : 0);
