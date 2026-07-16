// scripts/check-sharedchart.ts — 커뮤니티 게시물에 첨부되는 명식의 **유출 가드**(결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 왜 하네스인가: 커뮤니티 게시물은 **앱 설치자 누구나 REST 로 읽는다**(RLS read = authenticated,
//   이 앱은 익명 세션 상시 발급). 그래서 첨부 명식에 무엇이 실리는지가 곧 공개 범위다.
//   화이트리스트(app/src/lib/backend/communityChart.ts)는 지금 맞더라도, 나중에 누군가
//   "필드 하나만 더" 넣는 순간 조용히 샌다 — 화면에는 아무 변화가 없어서 눈으로는 안 잡힌다.
//   → 실제 함수를 호출해 **금지 필드가 결과 JSON 에 있으면 빌드를 깨뜨린다**.
//
// 검사 항목:
//   ① show_luck=false 면 시간축(currentLuck·annual)이 **아예 없어야** 한다
//      (화면에서 안 그리는 것만으론 방어가 아니다 — REST 로 raw JSON 이 읽히므로)
//   ② show_luck=true 라도 luckCycles(전 생애 대운)·annuals·months 는 실리지 않아야 한다
//      (대운 = 성별 순역 + 시작나이(절기 일수) = 생일 역산 재료 / 크기도 99KB→ 폭증)
//   ③ 원시 PII(birthDateTime·birthPlace·sex·calendar·birthLon) 는 어떤 경우에도 없어야 한다
//   ④ structure(격국·용신·병약 = 인코딩된 전문가 레이어 = 해자) 가 실리지 않아야 한다
//
// 실행: npm run check:sharedchart  (preflight 에 포함)
// ─────────────────────────────────────────────────────────────────────────
import { buildSajuChart } from '../engine/saju';
import { buildZiweiChart } from '../engine/ziwei';
import { toSharedSaju, toSharedZiwei } from '../app/src/lib/backend/communityChart';

// 게시물에 실리면 안 되는 필드(키 이름 기준). JSON 문자열에 `"키":` 형태로 등장하면 유출로 본다.
const FORBIDDEN = [
  'luckCycles',      // 전 생애 대운(성별 순역·시작나이 = 생일 역산 재료 + 90.7KB)
  'annuals',         // 대운별 세운 10년
  'months',          // 세운별 월운 12
  'structure',       // 격국·용신·병약·문파 판정 = 해자
  'birthDateTime', 'birthPlace', 'birthLon', 'birthLat', 'sex', 'calendar', 'timeAccuracy', // 원시 PII
];

// 검증용 입력(가상 인물 — 실제 사용자 데이터 아님). 시주까지 채워 4주 전부 산출되게 한다.
const INPUT: any = { birthDateTime: '1990-05-05 09:30', calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '서울' };

let failed = 0;
const fail = (msg: string) => { console.error(`  ❌ ${msg}`); failed++; };
const pass = (msg: string) => console.log(`  ✅ ${msg}`);

function leaks(payload: unknown): string[] {
  const json = JSON.stringify(payload ?? null);
  return FORBIDDEN.filter((k) => json.includes(`"${k}":`));
}
const kb = (o: unknown) => (JSON.stringify(o ?? null).length / 1024).toFixed(1) + 'KB';

const saju = buildSajuChart(INPUT, 2026);
const ziwei = buildZiweiChart(INPUT);

console.log('■ check:sharedchart — 커뮤니티 첨부 명식 유출 가드');

// ① 시기 미공개
console.log('\n[1] show_luck=false — 시간축이 아예 없어야');
const off = toSharedSaju(saju, false);
const offLeaks = leaks(off);
offLeaks.length ? fail(`금지 필드 유출: ${offLeaks.join(', ')}`) : pass('금지 필드 없음');
off.currentLuck === undefined && off.annual === undefined
  ? pass('currentLuck·annual 부재')
  : fail('미공개인데 시간축 필드가 실림 — 화면에 안 보여도 REST 로 읽힌다');

// ② 시기 공개(현재 대운·세운만)
console.log('\n[2] show_luck=true — 현재 대운·세운만, 전 생애 시간축은 절단');
const on = toSharedSaju(saju, true);
const onLeaks = leaks(on);
onLeaks.length ? fail(`금지 필드 유출: ${onLeaks.join(', ')}`) : pass('금지 필드 없음(annuals·months 절단 확인)');
on.currentLuck && on.annual ? pass(`현재 대운 ${on.currentLuck.stem}${on.currentLuck.branch}(${on.currentLuck.startAge}세) · 세운 ${on.annual.year} ${on.annual.stem}${on.annual.branch}`)
  : fail('공개를 선택했는데 대운·세운이 실리지 않음');

// ③ 자미 명반
console.log('\n[3] 자미 명반 — 12궁·주성만(대한 제외)');
const zi = toSharedZiwei(ziwei);
const ziLeaks = leaks(zi);
ziLeaks.length ? fail(`금지 필드 유출: ${ziLeaks.join(', ')}`) : pass('금지 필드 없음');
if (!zi) fail('명반 변환 실패(null)');
else if (zi.palaces.length !== 12) fail(`궁이 12개가 아님: ${zi.palaces.length}`);
else pass(`12궁 · ${zi.bureau} · 명궁 ${zi.lifePalaceBranch}`);
if (zi && JSON.stringify(zi).includes('"decades"')) fail('자미 대한(decades)이 실림');

// ④ 크기 — 원본 대조군. 회귀(누가 통째로 싣기 시작함)를 크기로도 잡는다.
console.log('\n[4] 페이로드 크기(원본 대조군)');
const sharedTotal = JSON.stringify(on).length + JSON.stringify(zi).length;
const rawTotal = JSON.stringify(saju).length + JSON.stringify(ziwei).length;
console.log(`  원본 통째: ${kb(saju)} + ${kb(ziwei)} = ${(rawTotal / 1024).toFixed(1)}KB`);
console.log(`  화이트리스트: ${kb(on)} + ${kb(zi)} = ${(sharedTotal / 1024).toFixed(1)}KB (${(100 - (sharedTotal / rawTotal) * 100).toFixed(1)}% 감소)`);
sharedTotal < 8 * 1024 ? pass('첨부 8KB 미만') : fail(`첨부가 8KB 를 넘음(${(sharedTotal / 1024).toFixed(1)}KB) — 통째로 싣고 있지 않은지 확인`);

// 대조군 자체 점검: 원본에는 금지 필드가 실제로 있어야 한다(없다면 이 하네스가 무의미한 걸 검사 중).
//   ★역검증 — 가드가 '항상 통과'하는 껍데기가 아님을 보증한다.
const rawLeaks = leaks(saju);
console.log('\n[5] 역검증 — 원본에는 금지 필드가 있어야(가드가 실제로 뭔가를 막고 있는가)');
rawLeaks.length ? pass(`원본 SajuChart 에 ${rawLeaks.join(', ')} 존재 → 가드가 이걸 막고 있다`)
  : fail('원본에도 금지 필드가 없다 = 이 하네스가 아무것도 검사하지 않는다(필드명 변경?)');

console.log(failed ? `\n❌ check:sharedchart 실패 ${failed}건` : '\n✅ check:sharedchart 통과');
process.exit(failed ? 1 : 0);
