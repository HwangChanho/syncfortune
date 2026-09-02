import { computeChart } from '../lib/engine/engine';
const base: any = { birthDateTime: '1994-03-16 17:55', calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '전라남도 여수' };
for (const m of [undefined, 'chung', 'hap'] as const) {
  const label = m ?? '원국';
  try {
    const c: any = computeChart(m ? { ...base, glyphSwap: m } : base);
    // 화면이 만지는 것들을 전부 깨운다(지연 getter 포함)
    const deep = JSON.stringify(c);
    console.log(`  ✅ ${label.padEnd(6)} computeChart OK · 직렬화 ${deep.length}자`);
  } catch (e: any) {
    console.log(`  ❌ ${label.padEnd(6)} computeChart 터짐: ${String(e.message).slice(0, 120)}`);
  }
}
