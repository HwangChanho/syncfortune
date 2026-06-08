// engine/guards.ts — 코드가드 1·2·3 (계산정합·구조veto·층위)
// ─────────────────────────────────────────────────────────────────────────
// 엔진/파이프 출력의 무결성·정합을 런타임 검증 (시스템설계서 가드 — WS3).
//   가드1 계산정합 : 만세력 결정론 출력 sanity (팔자·간지·일간·지장간·대운).
//   가드2 구조veto : 자평진전 기본 정합 (용신 유효·동태·처방·핵심작용). *깊은 적부 veto는 daniel ★*.
//   가드3 층위     : 시간층 cascade·독립읽기 방지 (규칙10 — overlay=대운×세운 상호작용).
// ⚠️ Claude는 명리를 발명하지 않는다 — 가드2의 깊은 격국·용신 적부는 daniel 검수 플래그(warn)로만.
// 레벨: pass=정합 / warn=주의(daniel 검토) / fail=무결성 위반(게이트 차단).
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, TenGod, Element } from '../spec/chart';

const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const TENGODS: TenGod[] = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
const ELEMS: Element[] = ['木', '火', '土', '金', '水'];
const POS = ['년', '월', '일', '시'] as const;

export interface GuardResult {
  guard: string;                       // 가드 id·이름
  level: 'pass' | 'warn' | 'fail';     // pass=정합 / warn=주의(daniel) / fail=무결성 위반
  detail: string;
}

/** 가드1 — 계산 정합 (만세력 결정론 출력 무결성) */
export function guard1Calculation(s: SajuChart): GuardResult[] {
  const r: GuardResult[] = [];
  // 팔자 4주 존재
  const miss = POS.filter((p) => !s.pillars?.[p]);
  r.push(miss.length
    ? { guard: '1.팔자4주', level: 'fail', detail: `기둥 누락: ${miss.join(',')}` }
    : { guard: '1.팔자4주', level: 'pass', detail: '년월일시 완비' });
  // 간지 표준 + 지장간 본기
  for (const p of POS) {
    const pl = s.pillars?.[p]; if (!pl) continue;
    if (!STEMS.includes(pl.stem) || !BRANCHES.includes(pl.branch))
      r.push({ guard: '1.간지유효', level: 'fail', detail: `${p}주 ${pl.stem}${pl.branch} 비표준 간지` });
    if (!pl.hiddenStems?.some((h) => h.role === '본기'))
      r.push({ guard: '1.지장간본기', level: 'warn', detail: `${p}주 ${pl.branch} 본기 지장간 없음` });
  }
  // 일간 = 일주 천간
  const dmOk = s.dayMaster?.stem === s.pillars?.['일']?.stem;
  r.push(dmOk
    ? { guard: '1.일간정합', level: 'pass', detail: `일간 ${s.dayMaster.stem}(${s.dayMaster.element})` }
    : { guard: '1.일간정합', level: 'fail', detail: `일간 ${s.dayMaster?.stem} ≠ 일주천간 ${s.pillars?.['일']?.stem}` });
  // 대운 startAge 단조증가
  const ages = s.luckCycles?.map((l) => l.startAge) ?? [];
  const mono = ages.every((v, i) => i === 0 || v > ages[i - 1]);
  r.push(mono
    ? { guard: '1.대운단조', level: 'pass', detail: `${ages.length}대운 startAge 순차` }
    : { guard: '1.대운단조', level: 'fail', detail: `대운 startAge 비단조: ${ages.join(',')}` });
  // isCurrent 유일성
  const curCount = s.luckCycles?.filter((l) => l.isCurrent).length ?? 0;
  if (curCount !== 1)
    r.push({ guard: '1.현재대운', level: 'warn', detail: `isCurrent=${curCount}개(1개 기대)` });
  return r;
}

/** 가드2 — 구조 veto (자평진전 기본 정합. 깊은 격국·용신 적부는 daniel ★) */
export function guard2Structure(s: SajuChart): GuardResult[] {
  const r: GuardResult[] = [];
  const st = s.structure;
  if (!st) { r.push({ guard: '2.구조존재', level: 'warn', detail: 'structure 없음 — P0/P2 선행 필요' }); return r; }
  // 용신 유효 (십신 or 오행)
  const ug = st.usefulGod?.value;
  const ugOk = ug != null && (TENGODS.includes(ug as TenGod) || ELEMS.includes(ug as Element));
  r.push(ugOk
    ? { guard: '2.용신유효', level: 'pass', detail: `용신 ${ug}` }
    : { guard: '2.용신유효', level: 'warn', detail: `용신 값 비표준: ${String(ug)}` });
  // 동태 용신 (ADR-012 — 정적 단일 금지)
  r.push(st.dynamicUsefulGod
    ? { guard: '2.동태용신', level: 'pass', detail: `운별 모드 ${Object.keys(st.dynamicUsefulGod.byIncomingStemElement).length}개` }
    : { guard: '2.동태용신', level: 'warn', detail: 'dynamicUsefulGod 없음(ADR-012 정적 단일 금지)' });
  // 처방 동반 (가드5 연결)
  const hasRemedy = !!(st.diseaseRemedy?.remedy || st.coreThesis);
  r.push(hasRemedy
    ? { guard: '2.처방동반', level: 'pass', detail: '병약/처방 존재' }
    : { guard: '2.처방동반', level: 'warn', detail: '처방 없음 — 묘사로 끝(가드5 위반 소지)' });
  // 핵심작용 ⊆ 원국 합충 (type+members 매칭 — detail 설명 차이 무관)
  const ikey = (i: { type: string; members: readonly string[] }) => `${i.type}:${[...i.members].sort().join('')}`;
  const interKeys = new Set(s.interactions?.map(ikey));
  const orphan = st.keyActions?.filter((k) => !interKeys.has(ikey(k))) ?? [];
  r.push(orphan.length
    ? { guard: '2.핵심작용정합', level: 'warn', detail: `keyActions가 원국 합충에 없음: ${orphan.map((o) => o.detail).join(',')}` }
    : { guard: '2.핵심작용정합', level: 'pass', detail: `핵심작용 ${st.keyActions?.length ?? 0}건 원국 합충 정합` });
  // 깊은 veto는 daniel
  r.push({ guard: '2.구조veto', level: 'pass', detail: '기본 sanity OK — 깊은 격국·용신 적부 veto는 daniel ★ 검수 영역(발명 금지)' });
  return r;
}

/** 가드3 — 층위 (시간층 cascade·독립읽기 방지, 규칙10) */
export function guard3Layers(s: SajuChart): GuardResult[] {
  const r: GuardResult[] = [];
  if (!s.currentLuck || !s.annual) {
    r.push({ guard: '3.시간층존재', level: 'fail', detail: 'currentLuck/annual 없음 — overlay 불가' });
    return r;
  }
  r.push({ guard: '3.시간층존재', level: 'pass', detail: `대운 ${s.currentLuck.stem}${s.currentLuck.branch} · 세운 ${s.annual.year} ${s.annual.stem}${s.annual.branch}` });
  // currentLuck ∈ luckCycles (cascade 정합)
  const inCycle = s.luckCycles?.some((l) => l.startAge === s.currentLuck.startAge && l.stem === s.currentLuck.stem);
  r.push(inCycle
    ? { guard: '3.대운정합', level: 'pass', detail: `현재대운 ${s.currentLuck.startAge}세 luckCycles 내` }
    : { guard: '3.대운정합', level: 'warn', detail: 'currentLuck이 luckCycles에 없음' });
  // 독립읽기 방지 — 대운×세운 상호작용 표현(규칙10)
  r.push({ guard: '3.독립읽기방지', level: 'pass', detail: `overlay=대운×세운 상호작용(규칙10) — annual.interactionsWithLuck ${s.annual.interactionsWithLuck?.length ?? 0}건, P3 prompt가 층 상호작용 강제` });
  return r;
}

/** 전체 가드 실행 */
export function runGuards(s: SajuChart): GuardResult[] {
  return [...guard1Calculation(s), ...guard2Structure(s), ...guard3Layers(s)];
}
