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
const DOHWA: Record<string, Branch> = { 水: '酉', 火: '卯', 金: '午', 木: '子' };   // 도화(목욕·왕지 다음)
const YEOKMA: Record<string, Branch> = { 水: '寅', 火: '申', 金: '亥', 木: '巳' };  // 역마(생지 충)
const HWAGAE: Record<string, Branch> = { 水: '辰', 火: '戌', 金: '丑', 木: '未' };  // 화개(묘지)

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

export interface SinsalHit { name: string; branch: Branch; hits: PillarPos[]; note: string; }
export interface SinsalResult {
  gongmang: [Branch, Branch];   // 공망 2지지
  gongmangHits: PillarPos[];    // 원국에서 공망 맞은 자리
  sinsal: SinsalHit[];          // 도화·역마·화개·천을귀인·문창·양인 (branch + 원국 hit 자리)
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
  const elem = SAMHAP[dayBranch];                          // 일지 삼합국
  const gm = gongmang(dayStem, dayBranch);
  const branchAt = (b: Branch) => POS.filter((p) => saju.pillars[p].branch === b);

  const sinsal: SinsalHit[] = [
    { name: '도화', branch: DOHWA[elem], hits: branchAt(DOHWA[elem]), note: '매력·이성·끼(일지 삼합 기준)' },
    { name: '역마', branch: YEOKMA[elem], hits: branchAt(YEOKMA[elem]), note: '이동·변동(R4)' },
    { name: '화개', branch: HWAGAE[elem], hits: branchAt(HWAGAE[elem]), note: '고독·예술·종교·총명' },
    ...CHEONEUL[dayStem].map((b): SinsalHit => ({ name: '천을귀인', branch: b, hits: branchAt(b), note: '최고 길신·귀인 조력' })),
    { name: '문창', branch: MUNCHANG[dayStem], hits: branchAt(MUNCHANG[dayStem]), note: '학문·총명·표현' },
  ];
  const yi = YANGIN[dayStem];
  if (yi) sinsal.push({ name: '양인', branch: yi, hits: branchAt(yi), note: '강한 칼날·과격·결단·극단(양간 겁재 왕지)' });
  sinsal.push({ name: '홍염', branch: HONGYEOM[dayStem], hits: branchAt(HONGYEOM[dayStem]), note: '이성 매력·끼·인기(도화와 별개)' });
  const goegang = GOEGANG.has(`${dayStem}${dayBranch}`);
  const baekhoHits = POS.filter((p) => BAEKHO.has(`${saju.pillars[p].stem}${saju.pillars[p].branch}`));

  return { gongmang: gm, gongmangHits: POS.filter((p) => gm.includes(saju.pillars[p].branch)), sinsal, goegang, baekhoHits };
}
