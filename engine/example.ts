// engine/example.ts — 익명(비PII) 예시로 결정론 엔진 시연 (API·크레딧 불필요)
// ─────────────────────────────────────────────────────────────────────────
// 퍼블릭 클론 사용자가 API 키 없이도 결정론 파이프(팔자·합충·12운성·신살·공망)를 체험하는 데모.
//   ※ 가공된 더미 생년월일 — 실존 인물 아님(PII 아님). golden/fixtures(실데이터)는 .gitignore.
// 실행: npm run example
// ─────────────────────────────────────────────────────────────────────────
import { buildSajuChart } from './saju';
import { detectInteractions } from './structure';
import { dayMasterStages } from './twelve';
import { analyzeSinsal } from './sinsal';
import type { ChartInput, PillarPos } from '../spec/chart';

// 익명 더미 — 2000-01-01 12:00 (실존 인물 아님)
const example: ChartInput = {
  birthDateTime: '2000-01-01 12:00', calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '서울',
};

const saju = buildSajuChart(example);
saju.interactions = detectInteractions(saju);
const P = saju.pillars;
const pos: PillarPos[] = ['년', '월', '일', '시'];

console.log('=== SyncFortune 결정론 엔진 데모 (익명 예시, API 불필요) ===');
console.log(`입력: ${example.birthDateTime} ${example.calendar}력 ${example.sex} ${example.birthPlace}\n`);

console.log(`팔자  : ${pos.map((p) => `${P[p].stem}${P[p].branch}`).join(' ')}  | 일간 ${saju.dayMaster.stem}(${saju.dayMaster.element})`);
console.log(`대운  : ${saju.currentLuck.stem}${saju.currentLuck.branch}(${saju.currentLuck.startAge}세~) | 세운 ${saju.annual.year} ${saju.annual.stem}${saju.annual.branch}`);
console.log(`합충형해: ${saju.interactions.map((i) => i.detail).join(', ') || '(없음)'}`);

const stages = dayMasterStages(saju);
console.log(`12운성: ${pos.map((p) => `${p}${stages[p]}`).join(' · ')}`);

const sin = analyzeSinsal(saju);
console.log(`공망  : ${sin.gongmang.join('·')}${sin.gongmangHits.length ? ` (원국 ${sin.gongmangHits.join(',')})` : ''}`);
const natalSin = sin.sinsal.filter((s) => s.hits.length).map((s) => `${s.name}(${s.hits.map((h) => h.pos).join('')})`);
console.log(`신살  : ${natalSin.join(', ') || '(원국 직접 hit 없음 — 운에서 작동)'}${sin.goegang ? ' · 괴강일주' : ''}${sin.baekhoHits.length ? ` · 백호(${sin.baekhoHits.join(',')})` : ''}`);

console.log('\n※ 용신·통변 등 해석(P2~P5)은 LLM 파이프(ANTHROPIC_API_KEY 필요). 이 데모는 결정론 산출까지만.');
