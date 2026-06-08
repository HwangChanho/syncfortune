// engine/sinsal.ts — 신살(神煞)·공망(空亡) 결정론 산출
// ─────────────────────────────────────────────────────────────────────────
// 공망: 일주 간지 → 순중공망(旬中空亡) 2지지. 신살: 도화·역마·화개(일지 삼합)·천을귀인·문창(일간).
// ⚠️ 보조 지표 — 구조(격국·용신·합충)가 주(主), 신살은 색채·특수작용 부가. 신살로 길흉 단정 금지(R13·가드6).
//    양인·괴강·백호·홍염 등은 stance 갈림 → daniel 검수로 추가.
// ─────────────────────────────────────────────────────────────────────────
import type { Stem, Branch, PillarPos, SajuChart } from '../spec/chart';

const STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BR: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const POS: PillarPos[] = ['년', '월', '일', '시'];

// 지지 → 삼합국 오행(도화·역마·화개 기준)
const SAMHAP: Record<Branch, '水' | '火' | '金' | '木'> = {
  申: '水', 子: '水', 辰: '水', 寅: '火', 午: '火', 戌: '火',
  巳: '金', 酉: '金', 丑: '金', 亥: '木', 卯: '木', 未: '木',
};
// 12신살(十二神煞) — 삼합국 생지(=지살)에서 −3 위치가 겁살, 거기부터 12지지 순환 배속.
//   도화(=년살)·역마·화개 포함. 기준지: 년지·일지 둘 다 산출(daniel stance 2026-06-08 "전부 산출").
const SINSAL12: string[] = ['겁살', '재살', '천살', '지살', '도화', '월살', '망신', '장성', '반안', '역마', '육해', '화개']; // 년살=도화(익숙한 명칭 채택)
const SAMHAP_SAENGJI: Record<'水' | '火' | '金' | '木', Branch> = { 水: '申', 火: '寅', 金: '巳', 木: '亥' };
/** 기준지(년지·일지)의 삼합국 기준, target 지지의 12신살 이름. */
function twelveSinsalAt(base: Branch, target: Branch): string {
  const start = (BR.indexOf(SAMHAP_SAENGJI[SAMHAP[base]]) - 3 + 12) % 12; // 겁살 = 생지 − 3
  return SINSAL12[(BR.indexOf(target) - start + 12) % 12];
}

// 일간 기준 천을귀인·문창
const CHEONEUL: Record<Stem, Branch[]> = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'], 辛: ['寅', '午'], 壬: ['巳', '卯'], 癸: ['巳', '卯'],
};
const MUNCHANG: Record<Stem, Branch> = {
  甲: '巳', 乙: '午', 丙: '申', 戊: '申', 丁: '酉', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯',
};
// 양인(羊刃) = 양간의 겁재 왕지(제왕). 음간 양인은 이설(약하거나 안 봄) → daniel 검수.
const YANGIN: Partial<Record<Stem, Branch>> = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };
// 괴강(魁罡) 일주(표준). 壬戌·戊辰은 이설.
const GOEGANG = new Set(['庚辰', '庚戌', '壬辰', '戊戌']);
// 홍염(紅艶)살 = 일간 기준 이성 매력·끼·인기(도화와 별개). 일부 글자는 이설.
const HONGYEOM: Record<Stem, Branch> = { 甲: '午', 乙: '午', 丙: '寅', 丁: '未', 戊: '辰', 己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申' };
// 백호(白虎)살 = 혈광·사고·강렬한 간지(일주·각주). 戊辰 포함 7간지(이설 있음).
const BAEKHO = new Set(['甲辰', '乙未', '丙戌', '丁丑', '戊辰', '壬戌', '癸丑']);

// ── 길신·기타 신살 (daniel "전부 산출" — 천간/지지 어느 자리든 적중 검출. 표준 baseline) ──
const ROK: Record<Stem, Branch> = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' }; // 정록(건록)=일간 건록지
const WOLDEOK: Record<'水' | '火' | '金' | '木', Stem> = { 水: '壬', 火: '丙', 金: '庚', 木: '甲' };                                   // 월덕귀인=월지 삼합국→천간
const CHEONDEOK: Record<Branch, Stem | Branch> = {                                                                                  // 천덕귀인=월지→천간 or 지지
  寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲', 申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚',
};
const HWANGEUN: Record<Branch, Branch> = {                                                                                          // 황은대사=월지→지지(사면)
  寅: '戌', 卯: '丑', 辰: '寅', 巳: '巳', 午: '酉', 未: '卯', 申: '子', 酉: '午', 戌: '亥', 亥: '辰', 子: '申', 丑: '未',
};
const HYEONCHIM: string[] = ['甲', '辛', '卯', '午', '申'];  // 현침살=획이 바늘 같은 글자(천간 甲辛 + 지지 卯午申). 문파차 → daniel 검수
const CHEONMUN: Branch[] = ['戌', '亥'];                     // 천문성=술해천문(지지 戌亥) — 영성·의약·역학
const AMROK: Record<Stem, Branch> = { 甲: '亥', 乙: '戌', 丙: '申', 丁: '未', 戊: '申', 己: '未', 庚: '巳', 辛: '辰', 壬: '寅', 癸: '丑' };   // 암록=일간 건록의 육합
const GEUMYEO: Record<Stem, Branch> = { 甲: '辰', 乙: '巳', 丙: '未', 丁: '申', 戊: '未', 己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅' };  // 금여=건록 +2지지
const HAKDANG: Record<Stem, Branch> = { 甲: '亥', 乙: '午', 丙: '寅', 丁: '酉', 戊: '寅', 己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯' };   // 학당귀인=일간 장생지
const STEMS_SET = new Set<string>(STEMS);

export type SinsalSide = 'stem' | 'branch';
export interface SinsalHit {
  name: string;
  glyphs: string[];                                  // 기준 글자(천간/지지) — 근거·표시용
  hits: { pos: PillarPos; side: SinsalSide }[];       // 적중 자리 + 천간/지지 구분(전부 산출)
  note: string;
}
export interface SinsalResult {
  gongmang: [Branch, Branch];   // 공망 2지지
  gongmangHits: PillarPos[];    // 원국에서 공망 맞은 자리
  sinsal: SinsalHit[];          // 길신·기타(천을귀인·문창·양인·홍염) — 도화·역마·화개는 12신살로 통일
  twelve: Record<PillarPos, { name: string; bases: PillarPos[] }[]>; // 12신살 — 각 기둥 지지를 4개 기준지(년·월·일·시) 전부로 + 어느 기준에서 나왔는지(bases)
  goegang: boolean;             // 괴강 일주(庚辰·庚戌·壬辰·戊戌)
  baekhoHits: PillarPos[];      // 백호살 간지 자리
}

/** 순중공망 — 일주 간지 → 비는 2지지 */
export function gongmang(stem: Stem, branch: Branch): [Branch, Branch] {
  const g = STEMS.indexOf(stem), z = BR.indexOf(branch);
  const xunStart = (z - g + 12) % 12; // 순(旬) 시작 지지(甲 위치)
  return [BR[(xunStart + 10) % 12], BR[(xunStart + 11) % 12]];
}

/** 신살·공망 결정론 산출 (일지·일간 기준) */
export function analyzeSinsal(saju: SajuChart): SinsalResult {
  const dayStem = saju.pillars['일'].stem;
  const dayBranch = saju.pillars['일'].branch;
  const monthBranch = saju.pillars['월'].branch;
  const gm = gongmang(dayStem, dayBranch);

  // 12신살 — 각 기둥 지지를 4개 기준지(년·월·일·시) 전부로 산출(daniel "전부 산출 — 일지·년지만 X").
  //   같은 신살이 여러 기준에서 나오면 bases로 묶음(예: 도화 bases=['년'], 재살 bases=['일','시']).
  const twelve = {} as Record<PillarPos, { name: string; bases: PillarPos[] }[]>;
  POS.forEach((p) => {
    const tb = saju.pillars[p].branch;
    const grouped = new Map<string, PillarPos[]>();
    POS.forEach((bp) => {
      const name = twelveSinsalAt(saju.pillars[bp].branch, tb);
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name)!.push(bp);
    });
    twelve[p] = Array.from(grouped, ([name, bases]) => ({ name, bases }));
  });

  // 길신·기타 신살 — 각 신살의 기준 글자(천간/지지)를 모든 기둥의 천간·지지와 대조(전부 산출).
  //   도화·역마·화개는 12신살로 통일. 괴강·백호(간지 결합)는 아래 별도.
  const sideOf = (g: string): SinsalSide => (STEMS_SET.has(g) ? 'stem' : 'branch');
  const hitsOf = (glyphs: string[]): { pos: PillarPos; side: SinsalSide }[] => {
    const out: { pos: PillarPos; side: SinsalSide }[] = [];
    for (const p of POS) for (const g of glyphs) {
      if (sideOf(g) === 'stem' ? saju.pillars[p].stem === g : saju.pillars[p].branch === g) out.push({ pos: p, side: sideOf(g) });
    }
    return out;
  };
  const specs: { name: string; glyphs: string[]; note: string }[] = [
    { name: '천을귀인', glyphs: CHEONEUL[dayStem], note: '최고 길신 — 위기에 귀인·조력' },
    { name: '문창', glyphs: [MUNCHANG[dayStem]], note: '학문·총명·표현' },
    { name: '정록', glyphs: [ROK[dayStem]], note: '일간 건록 — 자기 힘의 뿌리·안정' },
    { name: '암록', glyphs: [AMROK[dayStem]], note: '숨은 복록 — 위기에 드러나는 도움·재물' },
    { name: '금여', glyphs: [GEUMYEO[dayStem]], note: '금 수레 — 안락·품위·배우자덕' },
    { name: '학당귀인', glyphs: [HAKDANG[dayStem]], note: '학문의 자리(일간 장생) — 총명·교육·학습' },
    { name: '월덕귀인', glyphs: [WOLDEOK[SAMHAP[monthBranch]]], note: '달의 덕 — 음덕·보호·해액' },
    { name: '천덕귀인', glyphs: [CHEONDEOK[monthBranch]], note: '하늘의 덕 — 음덕·보호·해액' },
    { name: '황은대사', glyphs: [HWANGEUN[monthBranch]], note: '사면·은사 — 어려움이 풀림' },
    { name: '천문성', glyphs: CHEONMUN, note: '술해천문 — 영성·의약·역학 인연' },
    { name: '현침살', glyphs: HYEONCHIM, note: '바늘 글자 — 예리·정교(기술·의료·문장)' },
    { name: '홍염', glyphs: [HONGYEOM[dayStem]], note: '이성 매력·끼·인기(도화와 별개)' },
  ];
  if (YANGIN[dayStem]) specs.push({ name: '양인', glyphs: [YANGIN[dayStem]!], note: '강한 결단·전문기술(양간 겁재 왕지)' });
  const sinsal: SinsalHit[] = specs.map((s) => ({ name: s.name, glyphs: s.glyphs, hits: hitsOf(s.glyphs), note: s.note }));
  const goegang = GOEGANG.has(`${dayStem}${dayBranch}`);
  const baekhoHits = POS.filter((p) => BAEKHO.has(`${saju.pillars[p].stem}${saju.pillars[p].branch}`));

  return { gongmang: gm, gongmangHits: POS.filter((p) => gm.includes(saju.pillars[p].branch)), sinsal, twelve, goegang, baekhoHits };
}
