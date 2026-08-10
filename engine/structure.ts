// engine/structure.ts — WS3(Encoded Expert Layer) 1단계: 합충형해 검출 (결정론 룰)
// ─────────────────────────────────────────────────────────────────────────
// 결정론으로 가능한 것만: 합·충·형·해·파·반합·삼합국·방합국 검출 + R1 화성립 1차판정(화기 천간 투출).
// 신강약 점수·격국·용신 판정 = 명리 stance → daniel ground truth 필요(미착수, 검토1 점수체계).
// ─────────────────────────────────────────────────────────────────────────
import { STEM_YANG } from './saju';   // ★천간 음양 단일 출처(표를 새로 만들지 않는다)
import type { SajuChart, Interaction, ChartPosition, Branch, Element, Stem, PillarPos, StructureDx } from '../spec/chart';

const STEM_ELEM: Record<Stem, Element> = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const STEM_KE: Record<Element, Element> = { 木:'土', 火:'金', 土:'水', 金:'木', 水:'火' }; // X가 Y를 극(剋)

// 표준 합충형해표 (지지 관계)
export const SIXHE: [Branch, Branch, Element][] = [['子','丑','土'],['寅','亥','木'],['卯','戌','火'],['辰','酉','金'],['巳','申','水'],['午','未','土']];
export const CHONG: [Branch, Branch][] = [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']];
const HAI: [Branch, Branch][] = [['子','未'],['丑','午'],['寅','巳'],['卯','辰'],['申','亥'],['酉','戌']];
const PO: [Branch, Branch][] = [['子','酉'],['午','卯'],['申','巳'],['寅','亥'],['辰','丑'],['戌','未']];
const XING_PAIR: [Branch, Branch][] = [['子','卯']];                 // 상형(무례지형)
const SANXING: Branch[][] = [['寅','巳','申'], ['丑','戌','未']];      // 삼형
const ZIXING: Branch[] = ['辰','午','酉','亥'];                       // 자형
export const SANHE: [Branch, Branch, Branch, Element][] = [['申','子','辰','水'],['寅','午','戌','火'],['巳','酉','丑','金'],['亥','卯','未','木']];
// 방합(方合, 계절합) — 같은 방위·계절 3지지. 통설상 *3자 전부* 모여야 국(局) 성립(삼합보다 성립 엄격).
//   ※ 2자 부분 방합 인정 여부는 이설(왕지 포함 2자 인정설 등) → daniel 문파 확정 전 미검출(보수).
const FANGHE: [Branch, Branch, Branch, Element][] = [['寅','卯','辰','木'],['巳','午','未','火'],['申','酉','戌','金'],['亥','子','丑','水']];
export const WANGZHI: Branch[] = ['子','午','卯','酉'];                      // 왕지(반합 성립 핵심)
// ★반합에서 제외하는 쌍 — 상담가 판정 2026-08-04 `verify-000-rules#7` (O):
//   *"卯未 는 **항상** 목극토가 우선이다 — 조건 없이 반합으로 木(인성)이 서지 않는다."*
//   (검증 #003 지적 ⑤ "묘미는 목극토가 우선" 을 전역 규칙으로 승격한 것.)
//   ⚠️여기 卯未 **한 쌍만** 둔다. 巳酉(火剋金)·子辰(土剋水)도 같은 '극' 관계지만
//     상담가는 그 일반화를 `#9`(△)에서 **"생이 우선된다"** 로만 답했다 — 확정이 아니다.
//     내가 극 관계 전반으로 넓히면 그건 판정이 아니라 **발명**이다(CLAUDE.md §3.2).
//     → 질문은 `knowledge/rules/STANCE_LEDGER.md` `verify-000-rules#9` 에 보류로 걸어 뒀다.
const BANHAP_EXCLUDED: [Branch, Branch][] = [['卯', '未']];
// ★**성립은 하되 세력은 커지지 않는** 반합 — 상담가 판정 2026-08-10 `verify-000g-power#4`(X):
//   *"반합은 **되는데**, **극의 에너지이므로 커진다는 게 아님**."*
//   ⇒ 巳酉(火剋金)·子辰(土剋水) 은 검출은 그대로 두고 **강약 가중만 0** 으로 둔다.
//   (卯未 는 더 강하게 부정됐다 — `000d#13`(O) *"卯未 두 글자로는 木 기운이 서지 않는다"* → 위 EXCLUDED.)
//   ★검출과 세력을 **가르는** 것이 핵심이다: 합이 있다는 사실은 통변에 쓰이고, 힘은 안 늘어난다.
const BANHAP_NO_POWER: [Branch, Branch][] = [['巳', '酉'], ['子', '辰']];
/** 이 반합이 강약 점수에 세력을 보태는가(극 관계면 아니다 · 000g#4). */
export function banhapAddsPower(detail: string): boolean {
  return !BANHAP_NO_POWER.some(([x, y]) => detail.startsWith(`${x}${y}`) || detail.startsWith(`${y}${x}`));
}
// 천간 관계표 (자평진전: 천간끼리도 합·충=극) — daniel 검수 대상이나 합/충은 통설
export const TIANHE: [Stem, Stem, Element][] = [['甲','己','土'],['乙','庚','金'],['丙','辛','水'],['丁','壬','木'],['戊','癸','火']]; // 천간 오합
export const TIANCHONG: [Stem, Stem][] = [['甲','庚'],['乙','辛'],['丙','壬'],['丁','癸']];   // 천간 칠충 = 상극(극). 戊己(중앙토) 제외

const POS: PillarPos[] = ['년','월','일','시'];

const pairMatch = (list: [Branch, Branch][], a: Branch, b: Branch) =>
  list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/**
 * 원국 두 기둥이 **이웃**인가 — 년-월 · 월-일 · 일-시.
 *
 * 상담가 판정 2026-08-03 `verify-000c-structure#3` (O):
 *   *"지지 합은 서로 이웃한 기둥끼리만 성립한다 — 년-월, 월-일, 일-시. 떨어진 자리끼리는 성립하지 않는다."*
 *   *"바로 옆에 있어야 작용하는데, 주변 글자가 그 작용력을 약화시킬 수도 있다."*
 *   같은 지적이 **세 번 독립으로** 나왔다(101#5 "붙어있어야 작용함" · 110#5 "멀어서 안된다" · 2차 판정).
 *
 * ★적용 범위를 **합에만** 둔다 — 넓히지 않는 이유가 판정과 실측 둘 다에 있다:
 *   · 충·형·해·파는 같은 세트 `#4` 가 **△("위와 동일")** 라 확정이 아니다. 그리고 실측이 반대를 가리킨다 —
 *     daniel 본인 차트(甲戌 丁卯 辛丑 丁酉)에 충·형·해까지 거리 조건을 걸면 강약 score 0.9 → 4.9 로 뛰어
 *     **중화 → 신왕**이 된다. 전문가 검수(2026-07-14) 정답은 **신약**이라 오히려 더 멀어진다.
 *     (합만 걸면 卯戌=년월 · 丑酉=일시가 둘 다 이웃이라 이 차트는 **무영향**이다 — 그래서 안전하게 넣는다.)
 *   · 운(대운·세운)이 낀 관계는 제외 — `#5`(O) *"운에는 자리가 없으므로 원국 어느 글자와도 만난다."*
 *   · 3자 국(삼합국·방합국)은 판정에 없다 → **건드리지 않는다**(CLAUDE.md §3.2 발명 금지).
 *
 * @param members 관계에 참여한 자리들
 * @returns 거리 조건을 통과하는가(원국 2자 관계가 아니면 항상 true)
 */
function adjacentPair(members: ChartPosition[]): boolean {
  if (members.length !== 2) return true;                                   // 3자 국 등 = 대상 아님
  const natal = members.filter((m) => (POS as string[]).includes(m as string));
  if (natal.length !== 2) return true;                                     // 운이 끼었다 = 자리 없음(#5)
  return Math.abs(POS.indexOf(natal[0] as PillarPos) - POS.indexOf(natal[1] as PillarPos)) === 1;
}

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
    // ★거리 조건 — 2026-08-10 3차 판정으로 **전 관계에 적용**으로 넓혔다.
    //   `000d#6`(O) *"떨어진 자리의 충·형·해·파는 **아예 작용하지 않는다** — 약하게라도 작용하는 것이 아니다"*
    //   `000d#7`(O) 예시 명식의 **卯酉冲(월-시)은 작용하지 않는 것으로 본다** — 상담가가 직접 확정.
    //   `000d#8`(O) *"거리 조건은 **천간에도** 똑같이 걸린다"*(아래 천간 루프).
    //   ⚠️내 실측은 반대를 가리켰다(daniel 차트가 중화→신왕으로 뒤집힌다) — 그래서 08-10 오전엔 합에만 걸었다.
    //     그러나 상담가가 **예시 명식으로 직접** 확정했으므로 판정을 따른다(실측은 내 산식이 다른 것을 재고 있었을 수 있다).
    const near = adjacentPair([A.pos, B.pos]);
    const he = SIXHE.find(([x, y]) => (x === A.branch && y === B.branch) || (x === B.branch && y === A.branch));
    if (he && near) out.push({ type: '합', members: [A.pos, B.pos], detail: `${he[0]}${he[1]}合化${he[2]}`, transformsTo: he[2], transformSupported: stemElems.has(he[2]) });
    if (pairMatch(CHONG, A.branch, B.branch) && near) out.push({ type: '충', members: [A.pos, B.pos], detail: `${A.branch}${B.branch}冲` });
    if (pairMatch(HAI, A.branch, B.branch) && near) out.push({ type: '해', members: [A.pos, B.pos], detail: `${A.branch}${B.branch}害` });
    if (pairMatch(PO, A.branch, B.branch) && near) out.push({ type: '파', members: [A.pos, B.pos], detail: `${A.branch}${B.branch}破` });
    if (pairMatch(XING_PAIR, A.branch, B.branch) && near) out.push({ type: '형', members: [A.pos, B.pos], detail: `${A.branch}${B.branch}刑` });
    const ban = A.branch !== B.branch && !pairMatch(BANHAP_EXCLUDED, A.branch, B.branch) // 반합은 삼합 중 *서로 다른* 두 글자 (같은 글자=자형, 반합 아님) · 卯未 는 극 우선이라 제외(000-rules#7)
      ? SANHE.find((grp) => { const s = grp.slice(0, 3) as Branch[]; return !fullSanheSet.has(grp) && s.includes(A.branch) && s.includes(B.branch) && (WANGZHI.includes(A.branch) || WANGZHI.includes(B.branch)); })
      : undefined;
    if (ban && near) out.push({ type: '합', members: [A.pos, B.pos], detail: `${A.branch}${B.branch}半合${ban[3]}`, transformsTo: ban[3] });
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
  //   ⚠️2026-08-10 수정 — 여기와 아래 자형에 **거리 조건이 빠져 있었다**(`000d#6` 반영 누락).
  //     상형(XING_PAIR)에는 `near` 를 걸었는데 삼형·자형 경로를 같이 안 고쳐서, 실측하니
  //     甲戌 辛未 乙未 癸未 에서 戌未刑 이 **년-일(두 칸)·년-시(세 칸)까지** 잡히고 있었다.
  //     상담가: *"떨어진 자리의 충·**형**·해·파는 아예 작용하지 않는다 — 0 이다."*
  for (const grp of SANXING) {
    const present = items.filter((s) => grp.includes(s.branch));
    for (let i = 0; i < present.length; i++) for (let j = i + 1; j < present.length; j++) {
      if (!adjacentPair([present[i].pos, present[j].pos])) continue;   // ★거리 조건(000d#6)
      out.push({ type: '형', members: [present[i].pos, present[j].pos], detail: `${present[i].branch}${present[j].branch}刑` });
    }
  }
  // 자형 (같은 글자 2개 이상) — ★**쌍별**로 낸다(옛 코드는 세 자리를 한 덩어리로 묶어 거리를 잴 수 없었다)
  const byBranch: Partial<Record<Branch, ChartPosition[]>> = {};
  items.forEach((s) => { (byBranch[s.branch] ??= []).push(s.pos); });
  for (const b of ZIXING) {
    const ps = byBranch[b] ?? [];
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      if (!adjacentPair([ps[i], ps[j]])) continue;                     // ★거리 조건(000d#6)
      out.push({ type: '형', members: [ps[i], ps[j]], detail: `${b}${b}自刑` });
    }
  }

  // 천간 합·충(극)
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const A = items[i], B = items[j];
    const nearS = adjacentPair([A.pos, B.pos]);   // ★천간에도 거리 조건(000d#8 O)
    if (!nearS) continue;                          // 떨어진 천간끼리는 합·충·극이 서지 않는다
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
  // ── 쟁합(爭合) — 같은 천간 **둘**이 **하나**의 천간과 동시에 합한다 ─────────────────
  //   상담가 판정 2026-08-03 `verify-000c-structure#7` (O):
  //     *"같은 천간 2개가 하나의 천간과 동시에 합하면 쟁합(爭合)으로 따로 판정한다 —
  //       그 대상이 재성이면 **쟁재**다."*
  //   근거 사례 verify-110: 년간 戊 · 일간 戊 가 월간 癸(정재)를 동시에 합한다.
  //     엔진은 이걸 **쌍 단위 합 2건**으로만 잡아 '다툰다'는 사실 자체를 못 나타냈다.
  //   ★쌍 합(위 루프)은 **그대로 둔다** — 쟁합은 그 위에 얹는 이름이지 대체가 아니다.
  //     또 `transformsTo` 를 붙이지 않는다(합화 귀결은 쌍 쪽이 이미 말한다 · 국 가중 이중계상 방지).
  const posByStem = new Map<Stem, ChartPosition[]>();
  for (const it of items) { const a = posByStem.get(it.stem) ?? []; a.push(it.pos); posByStem.set(it.stem, a); }
  for (const [x, y] of TIANHE) {
    const xs = posByStem.get(x) ?? [], ys = posByStem.get(y) ?? [];
    if (!xs.length || !ys.length) continue;
    // 둘이 하나를 다투는 형태만 쟁합. 2:2 이상은 판정에 없다 → 이름 붙이지 않는다(발명 금지).
    const [many, one, manyStem, oneStem] = xs.length >= 2 && ys.length === 1
      ? [xs, ys, x, y] as const
      : ys.length >= 2 && xs.length === 1 ? [ys, xs, y, x] as const : [null, null, x, y] as const;
    if (!many || !one) continue;
    out.push({
      type: '합', level: '천간', members: [...many, ...one],
      detail: `${manyStem}${manyStem}爭合${oneStem}`,   // 예: 戊戊爭合癸
    });
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
  if (d.includes('爭合')) {                                        // 戊戊爭合癸 → '무계쟁합'(다투는 글자 1 + 대상 1)
    const chars = [...d].filter((ch) => STEM_KO[ch]);
    return `${STEM_KO[chars[0]] ?? ''}${STEM_KO[chars[chars.length - 1]] ?? ''}쟁합`;
  }
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
  const out = detectInteractionsAmong(POS.map((p) => ({ pos: p as ChartPosition, stem: saju.pillars[p].stem, branch: saju.pillars[p].branch })));
  // ★쟁합의 대상이 **재성이면 쟁재**(000c#7). 십신은 일간이 있어야 알 수 있어 여기서 붙인다
  //   (detectInteractionsAmong 은 임의 기둥 집합만 받아 일간을 모른다 — 시간층에도 쓰이는 함수라 그대로 둔다).
  const TENGOD_OF: Partial<Record<Stem, string>> = {};
  for (const p of POS) TENGOD_OF[saju.pillars[p].stem] = saju.pillars[p].stemTenGod;
  return out.map((it) => {
    if (!it.detail?.includes('爭合')) return it;
    const target = [...it.detail].pop() as Stem;                  // 戊戊爭合癸 → 癸(다툼의 대상)
    const tg = TENGOD_OF[target];
    return tg === '정재' || tg === '편재'
      ? { ...it, detail: `${it.detail} — 爭財(${tg})` }            // 상담가: "그 대상이 재성이면 쟁재다"
      : it;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 신강약 RULE 점수 (표준 가중치 *초안* — ★ daniel 검수/조정, 기획서 §4.3 HYBRID)
//   우호(일간 돕는 오행) = 비겁(동일오행) + 인성(일간 생하는 오행) → +가중
//   비우호(식상·재·관) → −가중. 월령 최대 가중 + 일간 통근 보너스.
//   ※ 가중치·임계는 표준 초안값일 뿐, daniel stance로 조정/확정한다(경계는 모델/사람 판정).
// ─────────────────────────────────────────────────────────────────────────
const BRANCH_MAIN_S: Record<Branch, Stem> = { 子:'癸',丑:'己',寅:'甲',卯:'乙',辰:'戊',巳:'丙',午:'丁',未:'己',申:'庚',酉:'辛',戌:'戊',亥:'壬' };
const SHENG_TO: Record<Element, Element> = { 水:'木', 木:'火', 火:'土', 土:'金', 金:'水' }; // X가 Y를 생
/**
 * 자리 가중 = **세력**. daniel 2026-07-06 D1 동결(월령 최대) — ★조정 슬롯.
 * ★export 이유: 충의 세력 비교(`000c#14` — "약한 쪽이 강한 쪽을 충하면 건드리되 못 깬다")를
 *   `crisisReport` 도 써야 하는데, 거기서 같은 표를 다시 적으면 두 곳이 갈린다([[duplicate-ui-single-source]]).
 */
export const POS_WEIGHT: Record<PillarPos, number> = { 월: 3, 일: 2, 시: 2, 년: 1.5 };
// ★강약 가중 = daniel 2026-07-06 **동결**(D1). 월3·일2·시2·년1.5 / 충½ / 통근1.5 / 완합국±1.5 / 반합×0.6(BANHAP_MULT).
//   THRESHOLD ±2 확정(중화 26.5%): ±3(39.6%)은 판정 유보 40%=회피에 가깝고, 진짜 중화명은 귀하다는 정설·30% 기준선 초과라 정상화.
//   ▷ v2 백로그(지금 X): 경계 감쇠 — THRESHOLD 근처 ±1 구간(약신강/약신약)은 5분류 진폭 ×0.75 선형 완충(경계값 컴플레인 시 도입).
const STEM_W = 1, ROOT_BONUS = 1.5, THRESHOLD = 2, GUK_BONUS = 1.5, CHUNG_MULT = 0.5; // ★동결 슬롯(합충 가중 포함)
// ★3주(시각 미상) 임계 — daniel 2026-08-01 "B로 가되 임계값은 실측해서 4주랑 중화 비율 맞춰줘".
//   시주(가중 2.0)가 빠지면 총점 진폭이 줄어 임계 ±2 를 그대로 쓰면 중화로 몰린다.
//   실측으로 4주의 중화 비율에 맞춘 값(측정 근거는 engine/strength3.calibrate.ts).
// ★2026-08-10 재보정 1.25 → 1.75: 충 세력 비교(000c#14)를 넣자 충 손상이 줄어 점수 진폭이 커졌고,
//   `strength3.calibrate.ts` 가 **코드값 불일치로 실패**해 잡아냈다(하네스가 눈보다 낫다).
//   daniel 이 정한 원칙("4주랑 중화 비율 맞춰줘")은 그대로고 실측 최적값만 옮긴 것 — 4주와 차이 0.4p.
const THRESHOLD_3 = 1.75;  // ★실측 확정(2026-08-01 1.25 → 2026-08-10 1.75, 표본 3000): 3주 중화 24.5%(4주와 0.4p).
//   점수가 0.5 단위로 떨어져 완전 일치는 불가 — ±1.25 와 ±1.50 은 같은 결과이고 그보다 넓히면 30%대로 뛴다.
//   재측정: `npx tsx engine/strength3.calibrate.ts` (코드값과 실측 최적이 어긋나면 실패한다)
const THRESHOLD_FOR = (noHour: boolean) => (noHour ? THRESHOLD_3 : THRESHOLD);
// ★`BANHAP_MULT`(반합 세력 ×0.6 · daniel D1 2026-07-06)는 **폐기**했다 — 2026-08-11 `verify-000h-magnitude#7`(O):
//   *"'유지되는 힘'이란 더 세지지는 않지만 극을 당해도 덜 흔들린다는 뜻"* → 반합은 **더하기가 아니라 버티기**다.
//   세력 가산은 0 이 되고, 대신 그 자리의 **충 손상을 면제**한다(scoreStrength 의 `banhapHeld`).
//   완합(3자)은 `000g#3`(O) *"실제로 그 오행의 세력을 이룬다"* 로 **그대로 유지**한다.

/**
 * 신강약 *참고 지표* (glass-box용). 만세력(팔자) 기반 우호/비우호 ± 위치가중 + 통근.
 * ※ 신강약 **판단(verdict)은 '만세력 기준' = daniel ground truth를 신뢰**한다(ADR-009).
 *    이 score/verdict는 자동 판정이 아니라 *참고 지표*일 뿐 — 합충보정 같은 stance는 두지 않는다.
 */
/**
 * 그 자리의 지지가 **제 계절을 만났는가** — 상담가 `verify-000h-magnitude#14`(O).
 *   *"子 와 午 가 충할 때 어느 쪽이 이기는지는, 그 오행이 **제 계절을 만났는지**로 먼저 가른다."*
 * @param pos 볼 자리 · @returns 그 지지의 본기 오행이 **월지 본기 오행과 같으면** true
 * ★등급을 만들지 않는다(강·중·약 눈금은 판정에 없다). 월지 자신은 정의상 항상 제 계절이다.
 */
function inSeason(saju: SajuChart, pos: PillarPos): boolean {
  const elemOf = (p: PillarPos) => STEM_ELEM[BRANCH_MAIN_S[saju.pillars[p].branch]];
  return elemOf(pos) === elemOf('월');
}

export function scoreStrength(saju: SajuChart): { score: number; verdict: '신강' | '중화' | '신약'; breakdown: string[] } {
  const day = saju.dayMaster.element;
  const gen = (Object.keys(SHENG_TO) as Element[]).find((e) => SHENG_TO[e] === day)!; // 일간을 생하는 오행(인성)
  const favor = new Set<Element>([day, gen]);                                          // 비겁+인성 = 우호
  // ── 합충 세력재편(daniel: 통설 적용 — 가중치 ★조정 슬롯) ─────────────────────
  //   충(沖): 충 맞은 지지 = 뿌리 흔들림 → 지지 가중 절반 + 통근 보너스 무효.
  //   삼합·방합국(3자 완성=완합): 화기 오행이 우호(비겁·인성)면 세력 결집(+), 비우호면 일간 약화(-). 반합(2자)=완합×0.6(D1).
  //   원국끼리(년월일시)만 — 운(대운·세운) 충합은 시간층에서 별도 처리.
  // ★시각 미상이면 **시주를 뺀다**(daniel 2026-08-01). 미상의 pillars['시'] 는 '0:0' 으로 만든
  //   유령 子시라(saju.ts), 없는 기둥을 세력에 넣으면 강약이 통째로 틀린다.
  //   ⇒ 대신 **임계값을 3주에 맞게 낮춘다**(아래 THRESHOLD_FOR) — 안 그러면 진폭이 줄어 중화로 몰린다.
  const noHour = (saju as { timeUnknown?: boolean }).timeUnknown === true;
  const POS4: PillarPos[] = noHour ? ['년', '월', '일'] : ['년', '월', '일', '시'];
  const chung = new Set<string>();           // 충 맞은 원국 지지 position
  const hyeong = new Set<string>();          // ★형(刑) 맞은 원국 지지 — 통근 손상(daniel 2026-07-14: 형도 뿌리 흔듦)
  const banhapHeld = new Set<string>();      // ★반합에 묶여 **덜 흔들리는** 자리(000h#7 O — 더 세지진 않고 버틴다)
  let gukAdj = 0; const gukBd: string[] = [];
  for (const it of (saju.interactions ?? [])) {
    if (!it.members.every((m) => (POS4 as string[]).includes(m))) continue; // 원국끼리만(운 제외)
    // ── 충의 세력 비교 (상담가 판정 2026-08-03 `verify-000c-structure#14` · O) ──────────
    //   *"충은 있다/없다의 이분법이 아니라 **세력 비교**다 — 약한 쪽이 강한 쪽을 충하면
    //     '건드리되 깨지 못한다'로 본다."*  근거 사례: verify-103 #5 (X)
    //     子(년지)가 午(**월지**)를 충 → *"자수가 오화를 건들긴 하지만, 깨지못한다."*
    //   ★'세력'의 정의는 판정에 없다. 그래서 **새 값을 만들지 않고** 이미 daniel 이 동결한
    //     위치 가중(POS_WEIGHT 월3·일2·시2·년1.5 — 2026-07-06 D1)을 그대로 세력으로 읽는다.
    //     월지가 가장 무겁다는 것은 상담가가 반복해 강조한 바와도 일치한다.
    //   · 강한 쪽 = 충을 맞아도 **뿌리 손상 없음**(가중 유지·통근 보너스 유지)
    //   · 약한 쪽 = 종전대로 손상
    //   · **동률**(일 vs 시)은 어느 쪽이 강한지 판정이 없다 → 양쪽 손상(기존 동작 유지 = 보수)
    // ★★2026-08-11 `verify-000h-magnitude#14`(O)·`#15`(X) 로 **세력의 정의가 바뀌었다**
    //   #14(O) *"어느 쪽이 이기는지는 그 오행이 **제 계절을 만났는지**로 먼저 가른다"*
    //   #15(X) *"**갯수는 강함을 증명하지 않는다**"* — 자리 수·글자 수로 재던 것이 부정됐다.
    //   ⇒ 종전 `POS_WEIGHT`(자리 가중) 비교를 **계절 비교**로 교체한다.
    //     상담가 표현대로 *"먼저"* 가르는 것이 계절이므로, 계절로 안 갈리면 **판정이 없다**(보수: 양쪽 손상).
    //   ⚠️'제 계절'을 등급으로 쪼개지 않는다 — 판정에 없는 눈금을 만들면 그건 내 발명이다.
    //     월지 본기 오행과 **같으면** 제 계절, 아니면 아니다(이분법).
    if (it.type === '충' && it.level !== '천간') {
      const [a, b] = it.members as PillarPos[];
      const sa = inSeason(saju, a), sb = inSeason(saju, b);
      if (sa === sb) { chung.add(a); chung.add(b); }   // 둘 다 제 철이거나 둘 다 아님 = 판정 없음
      else chung.add(sa ? b : a);                       // 제 철을 만난 쪽이 이긴다 → 진 쪽만 손상
    }
    if (it.type === '형' && it.level !== '천간') it.members.forEach((m) => hyeong.add(m)); // ★형도 통근 손상(지지 가중은 유지 — 충보다 약)
    // ── 삼합·방합 세력국 방향성 가중 (daniel D1 2026-07-06: 반합/완합 차등) ────────────
    //   완합(3자 완성=삼합국·방합국): GUK_BONUS 그대로 / 반합(2자, 왕지 포함): ×BANHAP_MULT(0.6).
    //   ※ 육합(卯戌合化火 등 2자 六合)은 '세력국'이 아니라 두 지지를 묶는 별개 작용 → 국 가중에서 제외.
    //      → detail 에 '半合' 표기가 있는 2자만 반합으로 인정(육합·천간합 미포함). 지지 관계만(level '천간' 제외).
    //   방향성(유지): 합화 결과 오행이 우호(비겁·인성)면 세력 결집(+), 비우호(식상·재·관)면 일간 약화(−).
    if (it.type === '합' && it.transformsTo && it.level !== '천간') {
      const isWanhap = it.members.length >= 3;                           // 3자 완성 = 완합(국)
      const isBanhap = !isWanhap && (it.detail ?? '').includes('半合');  // 2자 반합(육합 제외)
      // ★★2026-08-11 `verify-000h-magnitude#7`(O) — **반합은 세력에 보태지 않는다**
      //   *"'유지되는 힘'이란 午가 홀로 있을 때보다 **더 세지지는 않지만**, 다른 글자에 극을 당해도
      //     **덜 흔들린다**는 뜻이다"* → O.
      //   ⇒ 반합은 **더하기가 아니라 버티기**다. 세력 합산에서 빼고, 대신 **충 손상을 면제**한다
      //     (면제는 아래 `banhapHeld` 로 처리 — 이 루프가 끝난 뒤 chung 에서 걷어낸다).
      //   ※`000g#3`(O) *"세 글자가 다 모이면 실제로 그 오행의 세력을 이룬다"* 는 그대로 → **완합은 유지**.
      //   ※종전 `BANHAP_MULT`(×0.6)·`banhapAddsPower`(극 반합만 0)는 이 판정에 흡수됐다.
      if (isBanhap) {
        it.members.forEach((m) => banhapHeld.add(m as string));
        gukBd.push(`반합:${it.detail}(세력 0 · 버팀)`);
        continue;
      }
      if (isWanhap) {   // ★완합(3자)만 세력을 이룬다 — `000g#3`(O). 반합은 위에서 처리(세력 0 · 버팀)
        const dir = favor.has(it.transformsTo) ? 1 : -1;                 // 방향성: 우호 +, 비우호 −
        const adj = Math.round(dir * GUK_BONUS * 10) / 10;
        gukAdj += adj; gukBd.push(`국:${it.detail}${adj > 0 ? '+' : ''}${adj}`);
      }
    }
  }
  // ★반합에 묶인 자리는 **덜 흔들린다**(`000h#7` O) — 충 손상을 면제한다.
  //   *"더 세지지는 않지만, 다른 글자에 극을 당해도 덜 흔들린다"* 의 후반부가 여기다.
  //   ⚠️형(刑)은 면제하지 않는다 — 판정이 말한 것은 **극(충)** 이다. 넓히면 발명이다.
  for (const m of banhapHeld) chung.delete(m);

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
      else if (hyeong.has(p)) bd.push(`근:${p}(형 손상·보너스무효)`);        // ★형 맞은 통근 = 보너스 무효(daniel 2026-07-14)
      else { score += ROOT_BONUS; bd.push(`근:${p}+${ROOT_BONUS}`); }
    }
  }
  score += gukAdj; bd.push(...gukBd);
  score = Math.round(score * 10) / 10;
  const th = THRESHOLD_FOR(noHour);
  const verdict = score >= th ? '신강' : score <= -th ? '신약' : '중화';
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
  // ★전문가 검수 2026-07-14 (daniel 전량 반영): 종격은 안 본다 — 종격 후보 감지 폐기(항상 false).
  //   태왕·태약도 억부로 처리(종왕·종격 게이트 제거). 구 조건(rootless && favorCnt===0)은 미적용.
  const jonggyeokCandidate = false;
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

// ── 격국 — **월지의 종류가 격의 성립을 정한다** ───────────────────────────────
//   상담가 판정 2026-08-03 `verify-000c-structure#11` (O) · **daniel 확인 2026-08-10(R55 교체 승인)**:
//     *"월지가 **생지(寅申巳亥)** 인 경우 지장간 **중기나 정기가 투간되어야** 격이다(여기는 격으로 잡지 않는다).*
//      ***왕지(子午卯酉)** 가 월지면 **월지가 격**이고, **고지(辰戌丑未)** 가 월지면 지장간 **정기만** 격으로 잡는다."*
//
//   ★★이 함수의 stance 는 이번이 **세 번째**다 — 이력을 남긴다(다음 사람이 또 뒤집지 않도록):
//     ① 07-28 daniel : 투간 우선(중기·여기가 투간하면 격이 그쪽으로 간다)
//     ② 08-01 daniel : 월지 본기 고정 + **투간=격 / 미투간=국** (R55)
//     ③ 08-10 **상담가 규칙으로 교체**(daniel 승인) — ②의 '국' 접미는 **폐기**.
//        격은 **서거나(◯◯격) 서지 않는다(격 없음)**. 그 중간 이름은 두지 않는다.
//
//   ★★소비처 함정을 구조로 막았다 — 이전에 접미 '국'이 `.replace('격','')` 소비처를 **조용히** 깨뜨렸다.
//     이번엔 '격 없음'이라는 새 상태까지 생기므로, **십신이 필요한 곳이 `name` 을 파싱하면 안 된다.**
//     → `monthMainTenGod`(월지 본기 십신)를 **격 성립과 무관하게 항상** 내보낸다.
//       성격유형·용신 카드처럼 "월지 본기 십신"이 필요한 곳은 이 필드를 쓴다(격이 없어도 값이 있다).
//
//   ※투간 판정 자리는 **년·월·시 천간**(daniel 명시) — 일간은 '나 자신'이라 제외.
//   ⚠️순용/역용·성격(成格)/파격(破格)은 여전히 판정하지 않는다(명리 발명 금지).
const SAENGJI: Branch[] = ['寅', '申', '巳', '亥'];   // 생지(生支) — 중기/정기가 투간해야 격이 선다
const GOJI: Branch[] = ['辰', '戌', '丑', '未'];      // 고지(庫支) — 정기(본기)만 격
export function detectPattern(saju: SajuChart): {
  name: string;             // '◯◯격' · 비겁이면 '건록격/양인격/겁재격' · 안 서면 '격 없음'
  /**
   * ★**사람에게 보여 줄 이름** — 2026-08-11 `verify-000h-magnitude#1`·`#2`·`#3`.
   *   `#3`(O) *"두 말은 **같은 것을 다르게 부르는 것뿐**이다 — 어느 쪽으로 부르든 읽는 방법은 안 달라진다"*
   *   `#1`(△) *"격이 없는게 맞다. **하지만 고객에게 격이 없다고하면 기분나빠한다.**"*
   *   `#2`(△) *"1번보다는 나은 대답이다"* (= '드러나지 않은 격' 쪽이 낫다)
   * ⇒ **판정은 그대로 '격 없음'**(`name`·`established`)이고, **부르는 이름만** 바꾼다.
   *   화면·프롬프트는 이 값을 쓰고, 계산은 `established` 를 본다. 둘을 섞으면 안 된다.
   */
  displayName: string;
  established: boolean;     // ★신규 — 격이 섰는가(생지에서 아무것도 투간 안 하면 false)
  monthMainTenGod: string;  // ★신규 — 월지 본기 십신. **격 성립과 무관하게 항상** 있다(소비처 안전판)
  branchKind: '생지' | '왕지' | '고지';   // ★신규 — 어느 규칙으로 판정했는지(근거 추적)
  basis: string;            // 근거 문장
  revealed: boolean;        // 격을 세운 글자가 천간(년·월·시)에 투간했는가
  revealedAt: PillarPos[];  // 투간한 자리
  candidates: string[];     // 하위호환: [격] + 월령 지장간 중 투간한 다른 십신
} {
  const month = saju.pillars['월'];
  // ★투간을 볼 천간 자리(일간 제외 — 일간은 격의 주체).
  //   ⚠️**시각 미상이면 시주를 뺀다**(daniel 2026-08-01 문의로 드러남): 미상일 때 pillars['시'] 는
  //     '0:0' 으로 만든 **유령 子시**다(saju.ts 주석). 없는 글자를 '투간했다'고 세면 격이 바뀔 수 있다.
  //     — 없는 데이터를 쓰지 않는다는 뜻이지, 3주 판정법을 새로 만든 것이 아니다(stance 발명 금지).
  const outer = ((saju as { timeUnknown?: boolean }).timeUnknown ? ['년', '월'] : ['년', '월', '시']) as PillarPos[];
  const bongi = month.hiddenStems.find((h) => h.role === '본기');
  const dm = saju.dayMaster.stem;
  const yangDay = STEM_YANG[dm];                              // 일간 음양 — 겁재 월지의 이름을 가른다(표는 saju.ts 단일 출처)

  // ── 월지 지장간 중 천간에 투간한 것(본기 > 중기 > 여기 = 지장간 세력 순) ──
  const ROLE_ORDER: Record<string, number> = { 본기: 0, 중기: 1, 여기: 2 };
  const revealedStems = month.hiddenStems
    .map((h) => ({ h, at: outer.filter((p) => saju.pillars[p].stem === h.stem) }))
    .filter((x) => x.at.length > 0)
    .sort((a, b) => (ROLE_ORDER[a.h.role] ?? 9) - (ROLE_ORDER[b.h.role] ?? 9));

  const bongiTg = month.branchMainTenGod;                                  // 월지 본기 십신 — 항상 내보낸다
  const br = month.branch;
  const branchKind: '생지' | '왕지' | '고지' =
    SAENGJI.includes(br) ? '생지' : GOJI.includes(br) ? '고지' : '왕지';
  const selfTugan = revealedStems.find((x) => x.h.role === '본기');        // 본기(정기) 글자가 천간에 떴나
  const jungTugan = revealedStems.find((x) => x.h.role === '중기');        // 중기 글자가 천간에 떴나
  const others = revealedStems.filter((x) => x.h.role !== '본기');

  // ── 월지 종류별로 **격을 세우는 글자**를 고른다 ─────────────────────────────
  //   생지 : 중기 **또는** 정기가 투간해야 한다. 둘 다 떴으면 **정기(본기) 우선** —
  //          어느 쪽이 먼저인지는 판정에 없어, 지장간 세력 순(본기>중기)이라는 기존 엔진 규칙을
  //          그대로 쓴다(새 서열을 만들지 않는다). 아무것도 안 떴으면 **격이 서지 않는다.**
  //   왕지 : 투간과 **무관하게** 월지 본기가 곧 격.
  //   고지 : **정기(본기)만** 격. 중기·여기는 투간했더라도 격으로 삼지 않는다.
  let gyeokTg: string | null = null;              // 격을 이루는 십신(없으면 격 불성립)
  let anchor: typeof selfTugan = undefined;       // 격을 세운 글자(투간 자리 추적용)
  if (branchKind === '생지') {
    if (selfTugan) { gyeokTg = bongiTg; anchor = selfTugan; }
    else if (jungTugan) { gyeokTg = jungTugan.h.tenGod; anchor = jungTugan; }
  } else {
    // 왕지·고지 — 둘 다 '월지 본기'가 격이다(고지는 중기·여기를 아예 보지 않는다).
    gyeokTg = bongiTg;
    anchor = selfTugan;
  }

  // ── 합으로 서는 격 (상담가 판정 2026-08-03 `verify-000c-structure#6` · O) ────────────
  //   *"격은 복수로 성립할 수 있다 — 투간으로 서는 격(편관)과 **합으로 서는 격**(무계합→정재)을
  //     동급 후보로 함께 제시한다."*  근거 verify-110: 亥월 중기 甲 투간 → 편관격,
  //     그리고 일간 戊가 월간 癸(정재)와 합 → 정재격도 가능.
  //   ★**주 판정(name)은 바꾸지 않는다.** 상담가는 사례를 하나 줬을 뿐 "어느 쪽이 주인가"는 말하지 않았다.
  //     내가 순위를 정하면 발명이므로 `candidates` 에 **동급 후보로만** 얹는다(표현 그대로).
  const hapGyeok = outer
    .filter((p) => TIANHE.some(([x, y]) => (x === dm && y === saju.pillars[p].stem) || (y === dm && x === saju.pillars[p].stem)))
    .map((p) => ({ pos: p, stem: saju.pillars[p].stem, tenGod: saju.pillars[p].stemTenGod }));

  const head = `월지 ${br}(${branchKind}) 본기 ${bongi?.stem ?? '?'}(${bongiTg})`;
  if (!gyeokTg) {
    // 생지인데 중기·정기 어느 것도 천간에 없다 → 격을 잡지 않는다(억지로 본기로 세우지 않는다).
    const basis = `${head} → **격 없음** — 생지는 중기나 정기가 투간해야 격이 선다(투간 없음)`
      + (others.length ? ` · 지장간 ${others.map((x) => `${x.h.stem}(${x.h.tenGod})`).join('·')} 투간(여기는 격으로 안 잡는다)` : '');
    return {
      name: '격 없음',
      // ★부르는 이름은 '드러나지 않은 격'(`000h#2`·`#3`) — 판정(established=false)은 그대로다.
      displayName: `${bongiTg}격(드러나지 않음)`,
      established: false, monthMainTenGod: bongiTg, branchKind,
      basis, revealed: false, revealedAt: [], candidates: [],
    };
  }

  // ── 비겁 월지는 이름을 따로 붙인다(daniel stance 2026-07-18 — 이 축은 그대로 유지) ──
  //   · **비견** → 건록  (양·음 공통 — 록은 음간에도 있다)
  //   · **겁재** → 양일간은 **양인** / 음일간은 **겁재**(음간엔 양인이 없다)
  //   ⚠️**십신 + 일간 음양**으로만 판정한다(12운성 록지 조건을 걸지 않는다) —
  //     己 일간 未월(본기 己=비견)도 '건록'으로 간다. 이 귀결은 골든에 케이스로 박아 뒀다.
  const base = gyeokTg === '비견' ? '건록' : gyeokTg === '겁재' ? (yangDay ? '양인' : '겁재') : gyeokTg;
  const name = `${base}격`;                       // ★'국' 접미 폐기 — 서면 '격', 안 서면 위에서 '격 없음'
  const why = branchKind === '왕지' ? '왕지라 월지가 곧 격(투간 무관)'
    : branchKind === '고지' ? '고지라 정기만 격(중기·여기는 안 본다)'
    : anchor?.h.role === '본기' ? '생지 — 정기가 투간' : '생지 — 중기가 투간';
  const basis = `${head}${gyeokTg === '비견' || gyeokTg === '겁재' ? ` · 일간 ${dm}(${yangDay ? '양' : '음'})` : ''} → ${name} · ${why}`
    + (anchor ? ` · 천간 ${anchor.at.join('·')}에 투간` : '')
    + (others.length ? ` · 지장간 ${others.map((x) => `${x.h.stem}(${x.h.tenGod})`).join('·')} 투간` : '')
    + (hapGyeok.length ? ` · 합으로 서는 격 후보: ${hapGyeok.map((x) => `${dm}${x.stem}합→${x.tenGod}격`).join('·')}` : '');
  return {
    name, displayName: name, established: true, monthMainTenGod: bongiTg, branchKind,
    basis,
    revealed: !!anchor,
    revealedAt: anchor?.at ?? [],
    candidates: Array.from(new Set([
      name,
      ...others.map((x) => `${x.h.tenGod}격`),
      ...hapGyeok.map((x) => `${x.tenGod}격`),     // ★합으로 서는 격 = 동급 후보(000c#6)
    ])),
  };
}

// ⚠️2026-08-04 daniel 재확인으로 **이 폐기 결정이 재검토 대상**이 됐다 —
//   "명식의 전체를 봐야지 운이랑" · 水(식상)는 '편관이 **제복될 때**' 용신 국면이 된다는 판정.
//   골든 #1(entry-001:39)은 원래 '동태적 용신 · 운별 모드'로 적혀 있어 아래 폐기 줄과 어긋난다.
//   → 판정 기준(제복의 정의·표기·적용범위)이 확정되기 전까지 **동작은 그대로**(고정 용신) 둔다.
//   상세: knowledge/명리_지식레이어.md '미결 stance — 용신 판정의 층위'
// ⛔ 폐기(전문가 검수 2026-07-14, daniel 전량 반영): 용신은 평생 고정 — 운은 세기만 조절(희신강화/기신무력화).
//   구 '동태 용신(dynamicUsefulGod)' 개념 폐기. 이 함수는 dynamicUsefulGod이 있는 골든에서만 동작(없으면 null),
//   신규 산출엔 미사용. 고정 용신은 structure.usefulGod(단일). 하위호환 위해 시그니처만 유지.
// ── (구) 시간층 용신 (ADR-012, R7 폐기): dynamicUsefulGod 있는 골든 한정 ──
export function luckUsefulGod(structure: StructureDx, stem: Stem): { element: Element; mode: string } | null {
  const elem = STEM_ELEM[stem];
  const mode = structure.dynamicUsefulGod?.byIncomingStemElement[elem];
  return mode ? { element: elem, mode } : null;
}
