// 검증문서 #003 명식이 **현재 엔진**과 일치하는지 재확인
//   문서는 2026-07-26 작성 — 같은 날 절기(C1)·대운(H1 off-by-one) 수정이 들어갔다.
//   상담가에게 틀린 명식을 넘기면 판정 전체가 오염되므로 넘기기 전에 반드시 대조한다.
import { buildSajuChart } from '../saju';
import { detectInteractions, scoreStrength, classifyStrength, analyzeTenGods, detectPattern } from '../structure';
import type { ChartInput, PillarPos } from '../../spec/chart';

const input: ChartInput = {
  birthDateTime: '1988-05-12 14:30', calendar: '양', timeAccuracy: '정확', sex: '여', birthPlace: '서울',
};
const s = buildSajuChart(input, 2026);
s.interactions = detectInteractions(s);
const pos: PillarPos[] = ['년', '월', '일', '시'];
const P = s.pillars;

console.log('입력:', input.birthDateTime, input.sex, input.birthPlace);
console.log('팔자:', pos.map((p) => `${p}=${P[p].stem}${P[p].branch}`).join(' '));
console.log('십신:', pos.map((p) => `${p}(${(P[p] as any).stemTenGod ?? '-'}/${(P[p] as any).branchTenGod ?? '-'})`).join(' '));
console.log('일간:', s.dayMaster.stem, s.dayMaster.element);
console.log('강약:', JSON.stringify((s as any).strength ?? '(필드없음)'));
console.log('대운:', (s as any).luckCycles?.map((l: any) => `${l.startAge}:${l.stem}${l.branch}`).join(' · '));
console.log('현재대운:', `${s.currentLuck.stem}${s.currentLuck.branch}(${s.currentLuck.startAge}세~)`);
console.log('세운:', s.annual.year, s.annual.stem + s.annual.branch);
console.log('합충:', s.interactions.map((i) => i.detail).join(', ') || '(없음)');
console.log('오행분포:', JSON.stringify((s as any).elementCounts ?? (s as any).elements ?? '(필드없음)'));
const st = scoreStrength(s);
console.log('강약(scoreStrength):', st.verdict, 'score=', st.score);
console.log('  근거:', st.breakdown.join(' / '));
const cl = classifyStrength(s);
console.log('강약(classifyStrength):', JSON.stringify(cl).slice(0, 400));
const tg = analyzeTenGods(s);
console.log('십신분포:', JSON.stringify(tg).slice(0, 500));
const pt = detectPattern(s);
console.log('격국:', JSON.stringify(pt).slice(0, 300));
