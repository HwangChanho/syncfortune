// engine/structure.ts — WS3(Encoded Expert Layer) 1단계: 합충형해 검출 (결정론 룰)
// ─────────────────────────────────────────────────────────────────────────
// 결정론으로 가능한 것만: 합·충·형·해·파·반합·삼합국·방합국 검출 + R1 화성립 1차판정(화기 천간 투출).
// 신강약 점수·격국·용신 판정 = 명리 stance → daniel ground truth 필요(미착수, 검토1 점수체계).
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, Interaction, ChartPosition, Branch, Element, Stem, PillarPos, StructureDx } from '../spec/chart';

const STEM_ELEM: Record<Stem, Element> = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const STEM_KE: Record<Element, Element> = { 木:'土', 火:'金', 土:'水', 金:'木', 水:'火' }; // X가 Y를 극(剋)

// 표준 합충형해표 (지지 관계)
const SIXHE: [Branch, Branch, Element][] = [['子','丑','土'],['寅','亥','木'],['卯','戌','火'],['辰','酉','金'],['巳','申','水'],['午','未','土']];
const CHONG: [Branch, Branch][] = [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']];
const HAI: [Branch, Branch][] = [['子','未'],['丑','午'],['寅','巳'],['卯','辰'],['申','亥'],['酉','戌']];
const PO: [Branch, Branch][] = [['子','酉'],['午','卯'],['申','巳'],['寅','亥'],['辰','丑'],['戌','未']];
const XING_PAIR: [Branch, Branch][] = [['子','卯']];                 // 상형(무례지형)
const SANXING: Branch[][] = [['寅','巳','申'], ['丑','戌','未']];      // 삼형
const ZIXING: Branch[] = ['辰','午','酉','亥'];                       // 자형
const SANHE: [Branch, Branch, Branch, Element][] = [['申','子','辰','水'],['寅','午','戌','火'],['巳','酉','丑','金'],['亥','卯','未','木']];
// 방합(方合, 계절합) — 같은 방위·계절 3지지. 통설상 *3자 전부* 모여야 국(局) 성립(삼합보다 성립 엄격).
//   ※ 2자 부분 방합 인정 여부는 이설(왕지 포함 2자 인정설 등) → daniel 문파 확정 전 미검출(보수).
const FANGHE: [Branch, Branch, Branch, Element][] = [['寅','卯','辰','木'],['巳','午','未','火'],['申','酉','戌','金'],['亥','子','丑','水']];
const WANGZHI: Branch[] = ['子','午','卯','酉'];                      // 왕지(반합 성립 핵심)
// 천간 관계표 (자평진전: 천간끼리도 합·충=극) — daniel 검수 대상이나 합/충은 통설
const TIANHE: [Stem, Stem, Element][] = [['甲','己','土'],['乙','庚','金'],['丙','辛','水'],['丁','壬','木'],['戊','癸','火']]; // 천간 오합
const TIANCHONG: [Stem, Stem][] = [['甲','庚'],['乙','辛'],['丙','壬'],['丁','癸']];   // 천간 칠충 = 상극(극). 戊己(중앙토) 제외

const POS: PillarPos[] = ['년','월','일','시'];

const pairMatch = (list: [Branch, Branch][], a: Branch, b: Branch) =>
  list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/**
 * 임의 기둥 집합(원국 + 시간층 대운·세운·월운…) 간 합충형해 검출 (결정론).
 * - 지지: 육합(化 + R1 화성립)·충·해·파·상형·삼형·자형·반합·삼합국·방합국(3자).
 * - 천간: 합(化)·충(=상극)·극(오행극). level 로 천간/지지 구분.
 * @param items {pos, stem, branch}[] — pos 는 원국('년·월·일·시') 또는 시간층('대운·세운·월운·일운').
 */
export function detectInteractionsAmong(items: { pos: ChartPosition; stem: Stem; branch: Branch }[]): Interaction[] {
  const stemElems = new Set(items.map((s) => STEM_ELEM[s.stem])); // 화성립 판정용
  const out: Interaction[] = [];

  // 3자 완전국(삼합국·방합국) 선판정 — 그룹 3글자가 전부 모이면 국(局) 성립.
  //   삼합국이 성립하면 그 부분 반합은 *국으로 통합*해 중복 출력하지 않는다(통설: 국 성립 시 반합이라 따로 안 봄).
  const branches = new Set(items.map((s) => s.branch));
  const fullSanhe = SANHE.filter(([a, b, c]) => branches.has(a) && branches.has(b) && branches.has(c));
  const fullSanheSet = new Set(fullSanhe);                        // 반합 중복 억제용 (그룹 참조 동일성)
  const fullFanghe = FANGHE.filter(([a, b, c]) => branches.has(a) && branches.has(b) && branches.has(c));

  // 쌍 관계 (지지: 합·충·해·파·상형·반합)
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const A = items[i], B = items[j];
    const he = SIXHE.find(([x, y]) => (x === A.branch && y === B.branch) || (x === B.branch && y === A.branch));
    if (he) out.push({ type: '합', members: [A.pos, B.pos], detail: `${he[0]}${he[1]}合化${he[2]}`, transformsTo: he[2], transformSupported: stemElems.has(he[2]) });
    if (pairMatch(CHONG, A.branch, B.branch)) out.push({ type: '충', members: [A.pos, B.pos], detail: `${A.branch}${B.branch}冲` });
    if (pairMatch(HAI, A.branch, B.branch)) out.push({ type: '해', members: [A.pos, B.pos], detail: `${A.branch}${B.branch}害` });
    if (pairMatch(PO, A.branch, B.branch)) out.push({ type: '파', members: [A.pos, B.pos], detail: `${A.branch}${B.branch}破` });
    if (pairMatch(XING_PAIR, A.branch, B.branch)) out.push({ type: '형', members: [A.pos, B.pos], detail: `${A.branch}${B.branch}刑` });
    const ban = A.branch !== B.branch // 반합은 삼합 중 *서로 다른* 두 글자 (같은 글자=자형, 반합 아님)
      ? SANHE.find((grp) => { const s = grp.slice(0, 3) as Branch[]; return !fullSanheSet.has(grp) && s.includes(A.branch) && s.includes(B.branch) && (WANGZHI.includes(A.branch) || WANGZHI.includes(B.branch)); })
      : undefined;
    if (ban) out.push({ type: '합', members: [A.pos, B.pos], detail: `${A.branch}${B.branch}半合${ban[3]}`, transformsTo: ban[3] });
  }

  // 삼합국·방합국 (3자 완전체 — members 는 해당 글자의 *모든* 자리, 중복 글자 포함)
  //   化성립은 육합과 동일하게 R1 1차판정(화기 천간 투출)만. ※'국은 투출 없어도 자체 세력 성립' 이설 → daniel stance 슬롯.
  const pushGuk = (grp: [Branch, Branch, Branch, Element], label: '三合' | '方合') => {
    const s = grp.slice(0, 3) as Branch[];
    const members = items.filter((it) => s.includes(it.branch)).map((it) => it.pos);
    out.push({ type: '합', members, detail: `${s.join('')}${label}${grp[3]}`, transformsTo: grp[3], transformSupported: stemElems.has(grp[3]) });
  };
  fullSanhe.forEach((g) => pushGuk(g, '三合'));
  fullFanghe.forEach((g) => pushGuk(g, '方合'));

  // 삼형 (그룹 내 2글자 이상 → 쌍별)
  for (const grp of SANXING) {
    const present = items.filter((s) => grp.includes(s.branch));
    for (let i = 0; i < present.length; i++) for (let j = i + 1; j < present.length; j++)
      out.push({ type: '형', members: [present[i].pos, present[j].pos], detail: `${present[i].branch}${present[j].branch}刑` });
  }
  // 자형 (같은 글자 2개 이상)
  const byBranch: Partial<Record<Branch, ChartPosition[]>> = {};
  items.forEach((s) => { (byBranch[s.branch] ??= []).push(s.pos); });
  for (const b of ZIXING) { const ps = byBranch[b]; if (ps && ps.length >= 2) out.push({ type: '형', members: ps, detail: `${b}${b}自刑` }); }

  // 천간 합·충(극)
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const A = items[i], B = items[j];
    const gh = TIANHE.find(([x, y]) => (x === A.stem && y === B.stem) || (x === B.stem && y === A.stem));
    const isChong = TIANCHONG.some(([x, y]) => (x === A.stem && y === B.stem) || (x === B.stem && y === A.stem));
    if (gh) out.push({ type: '합', level: '천간', members: [A.pos, B.pos], detail: `${A.stem}${B.stem}合化${gh[2]}`, transformsTo: gh[2] });
    if (isChong) out.push({ type: '충', level: '천간', members: [A.pos, B.pos], detail: `${A.stem}${B.stem}冲` });
    if (!gh && !isChong) { // 천간 상극(剋) — 합·충 외 오행극(예 丁克辛). 방향 보존.
      const ea = STEM_ELEM[A.stem], eb = STEM_ELEM[B.stem];
      const aKeB = STEM_KE[ea] === eb, bKeA = STEM_KE[eb] === ea;
      if (aKeB || bKeA) {
        const from = aKeB ? A.stem : B.stem, to = aKeB ? B.stem : A.stem;
        out.push({ type: '극', level: '천간', members: [A.pos, B.pos], detail: `${from}克${to}` });
      }
    }
  }
  return out.map((it) => ({ ...it, level: it.level ?? '지지' as const }));
}

// ── 합충 짝 이름 라벨(daniel: 경쟁앱식 표기 — '유축반합'·'묘술육합'·'정신극'). detail(한자)을 한글 짝으로 변환.
//   ★검출은 표준대로 유지(묘유=충·유술=해, 경쟁앱 비표준 묘유형/유술반합 안 따름). 라벨 스타일만 짝 이름.
const BRANCH_KO: Record<string, string> = { 子:'자',丑:'축',寅:'인',卯:'묘',辰:'진',巳:'사',午:'오',未:'미',申:'신',酉:'유',戌:'술',亥:'해' };
const STEM_KO: Record<string, string> = { 甲:'갑',乙:'을',丙:'병',丁:'정',戊:'무',己:'기',庚:'경',辛:'신',壬:'임',癸:'계' };
/** Interaction → 한글 짝 이름 라벨. 예: 酉丑半合金→'유축반합', 卯戌合化火→'묘술육합', 卯酉冲→'묘유충', 丁克辛(천간극)→'정신극'. */
export function interactionLabel(it: Interaction): string {
  if (it.type === '극') return '정신극';                          // 천간 극 = 정신(천간 차원) 극(daniel)
  const d = it.detail ?? '';
  // 글자(지지/천간)만 한글로 — 관계 한자(合冲害破刑半三方化)·화오행(金木水火土)은 제외
  const ko = [...d].map((ch) => BRANCH_KO[ch] ?? STEM_KO[ch] ?? '').join('');
  if (d.includes('自刑')) return `${BRANCH_KO[[...d][0]] ?? ''}자형`; // 辰辰自刑→'진자형'(중복 제거)
  if (d.includes('半合')) return `${ko}반합`;                      // 酉丑半合金→'유축반합'
  if (d.includes('三合')) return `${ko}삼합`;                      // 申子辰三合水→'신자진삼합'
  if (d.includes('方合')) return `${ko}방합`;
  if (d.includes('合')) return it.level === '천간' ? `${ko}합` : `${ko}육합`; // 卯戌合化火→'묘술육합' / 丁壬合化木(천간)→'정임합'
  if (d.includes('冲')) return `${ko}충`;                          // 卯酉冲→'묘유충'
  if (d.includes('害')) return `${ko}해`;                          // 酉戌害→'유술해'
  if (d.includes('破')) return `${ko}파`;
  if (d.includes('刑')) return `${ko}형`;                          // 丑戌刑→'축술형'
  return ko || it.type;
}

/**
 * 원국 4기둥 합충형해 검출 (결정론). = detectInteractionsAmong(원국).
 * @returns Interaction[] — *검출*만. '핵심 vs 부가' 선별은 stance(daniel).
 */
export function detectInteractions(saju: SajuChart): Interaction[] {
  return detectInteractionsAmong(POS.map((p) => ({ pos: p as ChartPosition, stem: saju.pillars[p].stem, branch: saju.pillars[p].branch })));
}

// ─────────────────────────────────────────────────────────────────────────
// 신강약 RULE 점수 (표준 가중치 *초안* — ★ daniel 검수/조정, 기획서 §4.3 HYBRID)
//   우호(일간 돕는 오행) = 비겁(동일오행) + 인성(일간 생하는 오행) → +가중
//   비우호(식상·재·관) → −가중. 월령 최대 가중 + 일간 통근 보너스.
//   ※ 가중치·임계는 표준 초안값일 뿐, daniel stance로 조정/확정한다(경계는 모델/사람 판정).
// ─────────────────────────────────────────────────────────────────────────
const BRANCH_MAIN_S: Record<Branch, Stem> = { 子:'癸',丑:'己',寅:'甲',卯:'乙',辰:'戊',巳:'丙',午:'丁',未:'己',申:'庚',酉:'辛',戌:'戊',亥:'壬' };
const SHENG_TO: Record<Element, Element> = { 水:'木', 木:'火', 火:'土', 土:'金', 金:'水' }; // X가 Y를 생
const POS_WEIGHT: Record<PillarPos, number> = { 월: 3, 일: 2, 시: 2, 년: 1.5 }; // 월령 최대 — ★조정 슬롯
const STEM_W = 1, ROOT_BONUS = 1.5, THRESHOLD = 3, GUK_BONUS = 1.5, CHUNG_MULT = 0.5; // ★조정 슬롯(합충 가중 포함)
// D1(daniel 2026-07-06 승인): 삼합 완합(3자)=GUK_BONUS 그대로 / 반합(2자, 왕지 포함)=×0.6 차등.
//   ★배경: 완합과 반합이 동률(±GUK_BONUS)로 찍히던 문제(酉丑 반합 금국이 완성국과 동일 세력으로 계산됨) → 반합 세력을 0.6으로 감쇄.
const BANHAP_MULT = 0.6; // ★조정 슬롯 — 반합 세력 계수(완합 대비)

/**
 * 신강약 *참고 지표* (glass-box용). 만세력(팔자) 기반 우호/비우호 ± 위치가중 + 통근.
 * ※ 신강약 **판단(verdict)은 '만세력 기준' = daniel ground truth를 신뢰**한다(ADR-009).
 *    이 score/verdict는 자동 판정이 아니라 *참고 지표*일 뿐 — 합충보정 같은 stance는 두지 않는다.
 */
export function scoreStrength(saju: SajuChart): { score: number; verdict: '신강' | '중화' | '신약'; breakdown: string[] } {
  const day = saju.dayMaster.element;
  const gen = (Object.keys(SHENG_TO) as Element[]).find((e) => SHENG_TO[e] === day)!; // 일간을 생하는 오행(인성)
  const favor = new Set<Element>([day, gen]);                                          // 비겁+인성 = 우호
  // ── 합충 세력재편(daniel: 통설 적용 — 가중치 ★조정 슬롯) ─────────────────────
  //   충(沖): 충 맞은 지지 = 뿌리 흔들림 → 지지 가중 절반 + 통근 보너스 무효.
  //   삼합·방합국(3자 완성=완합): 화기 오행이 우호(비겁·인성)면 세력 결집(+), 비우호면 일간 약화(-). 반합(2자)=완합×0.6(D1).
  //   원국끼리(년월일시)만 — 운(대운·세운) 충합은 시간층에서 별도 처리.
  const POS4: PillarPos[] = ['년', '월', '일', '시'];
  const chung = new Set<string>();           // 충 맞은 원국 지지 position
  let gukAdj = 0; const gukBd: string[] = [];
  for (const it of (saju.interactions ?? [])) {
    if (!it.members.every((m) => (POS4 as string[]).includes(m))) continue; // 원국끼리만(운 제외)
    if (it.type === '충' && it.level !== '천간') it.members.forEach((m) => chung.add(m));
    // ── 삼합·방합 세력국 방향성 가중 (daniel D1 2026-07-06: 반합/완합 차등) ────────────
    //   완합(3자 완성=삼합국·방합국): GUK_BONUS 그대로 / 반합(2자, 왕지 포함): ×BANHAP_MULT(0.6).
    //   ※ 육합(卯戌合化火 등 2자 六合)은 '세력국'이 아니라 두 지지를 묶는 별개 작용 → 국 가중에서 제외.
    //      → detail 에 '半合' 표기가 있는 2자만 반합으로 인정(육합·천간합 미포함). 지지 관계만(level '천간' 제외).
    //   방향성(유지): 합화 결과 오행이 우호(비겁·인성)면 세력 결집(+), 비우호(식상·재·관)면 일간 약화(−).
    if (it.type === '합' && it.transformsTo && it.level !== '천간') {
      const isWanhap = it.members.length >= 3;                           // 3자 완성 = 완합(국)
      const isBanhap = !isWanhap && (it.detail ?? '').includes('半合');  // 2자 반합(육합 제외)
      if (isWanhap || isBanhap) {
        const dir = favor.has(it.transformsTo) ? 1 : -1;                 // 방향성: 우호 +, 비우호 −
        const adj = Math.round(dir * GUK_BONUS * (isBanhap ? BANHAP_MULT : 1) * 10) / 10; // 반합만 ×0.6
        gukAdj += adj; gukBd.push(`${isBanhap ? '반합' : '국'}:${it.detail}${adj > 0 ? '+' : ''}${adj}`);
      }
    }
  }
  let score = 0; const bd: string[] = [];
  for (const p of POS4) {
    if (p !== '일') { // 일간(주체)은 점수에서 제외
      const e = STEM_ELEM[saju.pillars[p].stem]; const s = favor.has(e) ? STEM_W : -STEM_W;
      score += s; bd.push(`간:${p}${saju.pillars[p].stem}${s > 0 ? '+' : ''}${s}`);
    }
    const be = STEM_ELEM[BRANCH_MAIN_S[saju.pillars[p].branch]];
    const bw = chung.has(p) ? POS_WEIGHT[p] * CHUNG_MULT : POS_WEIGHT[p];   // 충 = 뿌리 흔들림(가중 절반)
    const bs = favor.has(be) ? bw : -bw;
    score += bs; bd.push(`지:${p}${saju.pillars[p].branch}${chung.has(p) ? '(충)' : ''}${bs > 0 ? '+' : ''}${Math.round(bs * 10) / 10}`);
    if (saju.pillars[p].isRoot) {
      if (chung.has(p)) bd.push(`근:${p}(충 손상·보너스무효)`);              // 충 맞은 통근 = 보너스 무효
      else { score += ROOT_BONUS; bd.push(`근:${p}+${ROOT_BONUS}`); }
    }
  }
  score += gukAdj; bd.push(...gukBd);
  score = Math.round(score * 10) / 10;
  const verdict = score >= THRESHOLD ? '신강' : score <= -THRESHOLD ? '신약' : '중화';
  return { score, verdict, breakdown: bd };
}

// ── 신왕(身旺) vs 신강(身强) 분류 (daniel stance — ADR 예정) ─────────────────
// 강약(score)이 '강'권일 때 그 *동력*을 가른다: 비겁이 월지·일지 본기 통근 = 身旺(자기세력 왕),
// 인성이 통근해 생조로 강 = 身强(인성형). 비겁왕↔인성형은 용신·해석이 갈리므로 구분이 핵심.
// (예: 비겁왕→식상설기·관제어 / 인성형→재로 인성 덜기) ★ 경계·예외(비겁 중기근만, 인비 혼재
// 비중, 종격·가종)는 daniel 검수 슬롯 — 본인차트처럼 명확한 건부터 인코딩한다.
const BIJEON_SET = new Set(['비견', '겁재']);
const INSEONG_SET = new Set(['정인', '편인']);
const ROKJI: Record<string, string> = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' }; // 일간 건록(祿) 지지 = 강한 비겁 뿌리
export function classifyStrength(saju: SajuChart): {
  type: '신왕' | '신강' | '중화' | '신약';   // 왕쇠 축 — 강함의 성격까지 가른 분류
  driver: '비겁' | '인성' | '혼합' | '약';   // 결집유형 — 강함의 동력(주체)
  deukryeong: boolean; deukji: boolean; deukse: boolean;  // 득령/득지/득세 (왕쇠 근거)
  mainRoots: string[];                       // 통근처 (일간 뿌리 자리)
  gangyakAxis: '신강' | '중화' | '신약';      // 강약 축 — 재관 대비 상대 강약(왕쇠와 별개, 프롬프트 분리 요구)
  jonggyeokCandidate: boolean;               // ★D2: 종격 후보 감지 플래그(판정 아님 — verdict/type 은 정규 유지, Edge 위임 신호)
  reason: string;
} {
  const { score, verdict } = scoreStrength(saju);
  const pos = ['년', '월', '일', '시'] as PillarPos[];
  const wolBon = saju.pillars['월'].branchMainTenGod;   // 월지 본기 십신
  const ilBon = saju.pillars['일'].branchMainTenGod;    // 일지 본기 십신
  const favor = new Set<string>([...BIJEON_SET, ...INSEONG_SET]); // 일간 돕는 십신(비겁+인성)
  const deukryeong = favor.has(wolBon);                  // 월령이 비겁/인성 = 득령
  const deukji = saju.pillars['일'].isRoot || favor.has(ilBon); // 일지 통근/우호 = 득지
  let favorCnt = 0, foeCnt = 0;                          // 득세: 우호 vs 비우호 자리 수
  for (const p of pos) {
    if (p !== '일') (favor.has(saju.pillars[p].stemTenGod) ? favorCnt++ : foeCnt++);
    (favor.has(saju.pillars[p].branchMainTenGod) ? favorCnt++ : foeCnt++);
  }
  const deukse = favorCnt >= foeCnt;
  const mainRoots = pos.filter((p) => saju.pillars[p].isRoot).map((p) => `${p}지(${saju.pillars[p].branch})`);
  const biMonthDay = BIJEON_SET.has(wolBon) || BIJEON_SET.has(ilBon); // 비겁이 월/일지 본기
  const dayStem = saju.pillars['일'].stem;
  const dayElem = STEM_ELEM[dayStem];
  const hasRok = pos.some((p) => saju.pillars[p].branch === ROKJI[dayStem]);  // 일간 건록(록지) = 강한 비겁 뿌리(위치 무관)
  const hasBijeoGuk = (saju.interactions ?? []).some((it) => it.type === '합' && it.transformsTo === dayElem); // 비겁오행 합/반합국
  const biStrong = biMonthDay || hasRok || hasBijeoGuk;  // 비겁 결집(프롬프트: 득령 못해도 강한 통근·합국이면 신왕)
  const biWhy = [biMonthDay && '월/일본기', hasRok && '건록', hasBijeoGuk && '비겁합국'].filter(Boolean).join('·');
  const inPos = pos.filter((p) => INSEONG_SET.has(saju.pillars[p].branchMainTenGod));
  // ── 종격 후보 감지 (daniel D2 2026-07-06): ★판정하지 말 것 — verdict/type 은 정규(억부)로 두고 신호만 세운다.
  //   조건: 일간 무근(4지지 어디에도 통근 없음) + 인비 전무(비겁·인성이 천간투출·지지본기에 0). = 종격 가능성.
  //   ※ 실제 종격/가종/신약 확정은 지장간·합화·운까지 봐야 하므로 온디바이스에서 확정 않고 Edge(유료 LLM)로 위임한다.
  //     favorCnt(비겁+인성 자리 수)를 재사용 — 전무 판정은 엄격히 0(오검출 최소화, ★조정 슬롯).
  const rootless = mainRoots.length === 0;                 // 일간 무근
  const jonggyeokCandidate = rootless && favorCnt === 0;   // 무근 + 인비 전무 = 종격 후보(판정 보류→Edge)
  const ev = { deukryeong, deukji, deukse, mainRoots, gangyakAxis: verdict, jonggyeokCandidate };
  if (verdict === '신약') return { type: '신약', driver: '약', reason: `score ${score} ≤ -${THRESHOLD}`, ...ev };
  if (verdict === '중화') return { type: '중화', driver: '혼합', reason: `score ${score} (임계 내)`, ...ev };
  // 신강권 — 결집유형: 비겁(월/일본기·건록·합국)이 결집했으면 비겁결집형 신왕, 아니면 인성받침형 신강
  if (biStrong) return { type: '신왕', driver: '비겁', reason: `비겁 결집(${biWhy}) — 자기세력 왕`, ...ev };
  if (inPos.length) return { type: '신강', driver: '인성', reason: `인성이 ${inPos.join('·')}지 본기 통근 (생조로 강) — 비겁 결집 없음`, ...ev };
  return { type: '신강', driver: '혼합', reason: `score ${score} 강 (뿌리 분산)`, ...ev };
}

// ── 십신 분포·과다·부재 (성격통변 프롬프트 INPUT — 특히 '부재'가 가장 강한 시그널, 예 무식상) ──
// 천간(일간 제외) + 지지 본기 집계 = distribution(5그룹)·detail(10정밀). 지장간은 부재 보충 note용.
const TENGOD_GROUP: Record<string, '비겁' | '인성' | '식상' | '재성' | '관성'> = {
  비견: '비겁', 겁재: '비겁', 정인: '인성', 편인: '인성', 식신: '식상', 상관: '식상',
  정재: '재성', 편재: '재성', 정관: '관성', 편관: '관성',
};
// ── 테마C 가중치 (daniel 2026-07-06 승인): detail(십신 세기)을 flat +1 → 통근/투출/월령 반영으로 정밀화. ──
//   목적: pastLife·joseonJob·bokType 등이 '최강 십신'을 flat 개수로 뽑던 것을, 자리 세기(투출≈월령>통근>일반)로 뽑게 함.
//   ★distribution/absent/excess 는 flat 개수 유지(부재='0개' 시그널 보존) — detail 세기만 가중한다.
//   ★★가중치는 '질량보존'(자리 총합 ≈ 옛 flat 7)으로 설계 — detail 합을 소비하는 skewKnowledge 십성쏠림 maxG≥4
//     게이트가 가중 인플레로 과다발동하지 않도록(1584 샘플 실측: additive 1.5안이면 fire 17%→65%p, 본 안은 ≈16%로 유지).
//     즉 '상대 서열'만 재현하고 '절대 합'은 안 부풀린다. 값은 ★조정 슬롯(daniel 검수).
const W_STEM_TOU = 1.3;    // 천간(년월시) = 투출(드러난 세력) → 최강급(단일 최중)
const W_BRANCH_MAIN = 0.7; // 지지 본기 기본(무근·비월령 = 최약 자리)
const W_WOLRYEONG = 0.6;   // 월지 본기 추가(월령=계절 사령): 0.7+0.6=1.3 → 투출급(최강)
const W_ROOT = 0.3;        // 통근(isRoot=일간 뿌리 자리) 보너스: 0.7+0.3=1.0
export function analyzeTenGods(saju: SajuChart): {
  distribution: Record<string, number>;  // 5그룹 (비겁/인성/식상/재성/관성) — flat 개수(부재/과다 판정 기준)
  detail: Record<string, number>;        // 10정밀 십신 세기 (테마C 가중: 투출>월령>통근>일반. ※'개수' 아님 — 소비자는 최강 십신 선택용)
  absent: string[];                      // 부재 그룹 (0) — 가장 강한 시그널
  excess: string[];                      // 과다 (그룹 3+)
  notes: string;                         // 부재 그룹이 지장간엔 있는지 보충
} {
  const distribution: Record<string, number> = { 비겁: 0, 인성: 0, 식상: 0, 재성: 0, 관성: 0 };
  const hidden: Record<string, number> = { 비겁: 0, 인성: 0, 식상: 0, 재성: 0, 관성: 0 };
  const detail: Record<string, number> = {};
  for (const p of (['년', '월', '일', '시'] as PillarPos[])) {
    // 천간(일간 제외) = 투출: detail 은 가중(W_STEM_TOU), distribution 은 flat +1(개수 시그널 유지)
    if (p !== '일') {
      const tg = saju.pillars[p].stemTenGod;
      detail[tg] = (detail[tg] || 0) + W_STEM_TOU;
      if (TENGOD_GROUP[tg]) distribution[TENGOD_GROUP[tg]]++;
    }
    // 지지 본기: detail 은 (기본 + 월령 + 통근) 가중, distribution 은 flat +1
    const bg = saju.pillars[p].branchMainTenGod;
    let w = W_BRANCH_MAIN;
    if (p === '월') w += W_WOLRYEONG;                    // 월령(월지 본기) 가중
    if (saju.pillars[p].isRoot) w += W_ROOT;            // 통근(일간 뿌리 자리) 반영
    detail[bg] = (detail[bg] || 0) + Math.round(w * 10) / 10;
    if (TENGOD_GROUP[bg]) distribution[TENGOD_GROUP[bg]]++;
    for (const h of saju.pillars[p].hiddenStems) if (TENGOD_GROUP[h.tenGod]) hidden[TENGOD_GROUP[h.tenGod]]++;
  }
  const absent = Object.keys(distribution).filter((g) => distribution[g] === 0);
  const excess = Object.keys(distribution).filter((g) => distribution[g] >= 3);
  const notes = absent.filter((g) => hidden[g] > 0).map((g) => `${g}는 지장간에만 ${hidden[g]}점(투출 없음)`).join(' · ');
  return { distribution, detail, absent, excess, notes };
}

// ── 격국 후보 (결정론 절차: 월령 지장간 중 천간 투출 → 격). 최종 격 확정은 daniel stance. ──
export function detectPattern(saju: SajuChart): { candidates: string[]; basis: string } {
  const month = saju.pillars['월'];
  const stems = (['년','월','일','시'] as PillarPos[]).map((p) => saju.pillars[p].stem);
  const tou = month.hiddenStems.filter((h) => stems.includes(h.stem)); // 월령 지장간 중 천간 투출분
  const candidates = tou.length
    ? Array.from(new Set(tou.map((h) => `${h.tenGod}격`)))
    : [`${month.branchMainTenGod}격`]; // 투출 없으면 월령 본기로
  const basis = tou.length
    ? `월지 ${month.branch} 지장간 중 ${tou.map((h) => `${h.stem}(${h.tenGod})`).join('·')} 투출`
    : `월지 ${month.branch} 본기 ${month.branchMainTenGod}(투출 없음)`;
  return { candidates, basis };
}

// ── 시간층 용신 (ADR-012, R7): 대운/세운 천간 오행 → dynamicUsefulGod 모드 → 그 시기 용신·처리 ──
// 용신은 원국 지향축(정적)이 아니라 운별로 전환된다. 들어오는 천간 오행을 원국이 정한
// 동태적 용신 표(dynamicUsefulGod)에 적용해 *그 시기*의 실질 처리 모드를 결정한다(결정론).
export function luckUsefulGod(structure: StructureDx, stem: Stem): { element: Element; mode: string } | null {
  const elem = STEM_ELEM[stem];
  const mode = structure.dynamicUsefulGod?.byIncomingStemElement[elem];
  return mode ? { element: elem, mode } : null;
}
