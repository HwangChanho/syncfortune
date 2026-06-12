// engine/ziwei.ts — WS2 자미두수 L1 엔진: ChartInput → ZiweiChart (iztro 정규화)
// ─────────────────────────────────────────────────────────────────────────
// 규칙9: 자미는 보조·수렴 레이어. iztro 결정론(성반·사화·운한)을 chart.ts로 정규화하는 것까지.
//        깊은 진단·처방은 만들지 않는다.
// 간체(iztro) → 한글(chart.ts) 매핑: 궁이름·성요·밝기·사화.
// ─────────────────────────────────────────────────────────────────────────
import { astro } from 'iztro';
import type { ChartInput, ZiweiChart, Palace, Star, Branch, Brightness, SihwaType } from '../spec/chart';

const PALACE_NAME: Record<string, Palace['name']> = {
  '命宫': '명궁', '兄弟': '형제궁', '夫妻': '부처궁', '子女': '자녀궁', '财帛': '재백궁', '疾厄': '질액궁',
  '迁移': '천이궁', '仆役': '노복궁', '官禄': '관록궁', '田宅': '전택궁', '福德': '복덕궁', '父母': '부모궁',
};

const STAR_NAME: Record<string, string> = {
  // 14 주성
  '紫微': '자미', '天机': '천기', '太阳': '태양', '武曲': '무곡', '天同': '천동', '廉贞': '염정', '天府': '천부',
  '太阴': '태음', '贪狼': '탐랑', '巨门': '거문', '天相': '천상', '天梁': '천량', '七杀': '칠살', '破军': '파군',
  // 6길 + 녹존·천마
  '文昌': '문창', '文曲': '문곡', '左辅': '좌보', '右弼': '우필', '天魁': '천괴', '天钺': '천월',
  '禄存': '녹존', '天马': '천마',
  // 6살
  '擎羊': '경양', '陀罗': '타라', '火星': '화성', '铃星': '영성', '地空': '지공', '地劫': '지겁',
};

// iztro 밝기(간체/약칭) → chart.ts Brightness(번체 7단계)
const BRIGHTNESS: Record<string, Brightness> = {
  '庙': '廟', '廟': '廟', '旺': '旺', '得': '得地', '得地': '得地', '利': '利',
  '平': '平', '闲': '平', '陷': '陷', '不': '不得地', '不得地': '不得地',
};

// iztro 사화(mutagen) → chart.ts SihwaType
const MUTAGEN: Record<string, SihwaType> = {
  '禄': '化祿', '祿': '化祿', '權': '化權', '权': '化權', '科': '化科', '忌': '化忌',
};

/** iztro star → chart.ts Star */
function mapStar(s: any): Star {
  return {
    name: STAR_NAME[s.name] ?? s.name,                  // 미등록 성요는 원본 보존
    brightness: BRIGHTNESS[s.brightness] ?? '平',        // 보좌성 등 밝기 없으면 平
    transforms: s.mutagen ? [MUTAGEN[s.mutagen] ?? '化祿'] : [],
  };
}

/** 출생 시각(hour) → iztro 시진 index (子0 丑1 … 酉9 戌10 亥11) */
function hourToTimeIndex(hour: number): number {
  return Math.floor((hour + 1) / 2) % 12;
}

// 대한 비성사화(四化) 순서 — iztro horoscope.decadal.mutagen 은 [祿,權,科,忌] 순 4성을 준다.
const SIHWA_ORDER: SihwaType[] = ['化祿', '化權', '化科', '化忌'];

/**
 * 운한(대한) 정규화 — 각 궁의 대한 구간(decadal.range)을 한 시기로, 그 시기 천간이 일으키는
 *   비성사화(어느 별이 化祿/權/科/忌 되는지)를 horoscope 로 구해 채운다.
 *   intoPalace = 그 별이 본명반에서 앉은 궁(= 그 시기에 활성화되는 삶의 영역) → 통변이 "운의 흐름"을 말할 근거.
 * @param a iztro FunctionalAstrolabe (bySolar 결과)
 * @param palaces 정규화된 본명 12궁(별→궁 매핑용)
 * @param birthYear 출생 연도(대한 구간 → 양력 연도 변환용)
 */
function buildDecades(a: any, palaces: Palace[], birthYear: number): ZiweiChart['decades'] {
  // 본명반 별 → 앉은 궁 이름 맵(intoPalace 산출용)
  const starPalace: Record<string, string> = {};
  palaces.forEach((pl) => [...pl.majorStars, ...pl.minorStars].forEach((st) => { starPalace[st.name] = pl.name; }));

  const out: ZiweiChart['decades'] = [];
  (a.palaces ?? []).forEach((p: any) => {
    const range = p.decadal?.range as [number, number] | undefined;     // [시작나이, 끝나이]
    if (!Array.isArray(range)) return;
    const startAge = range[0];
    if (startAge > 100) return;                                          // 10~100세 범위만(UI/통변 대상)
    // 이 대한 구간 안의 한 날짜로 horoscope 호출 → decadal.mutagen(4성)
    let mutagen: string[] = [];
    try { mutagen = a.horoscope(`${birthYear + startAge}-06-15`)?.decadal?.mutagen ?? []; } catch { /* 환경 미지원 시 비움 */ }
    const flyingSihwa = mutagen.map((raw, i) => {
      const star = STAR_NAME[raw] ?? raw;                                // 간체 → 한글
      return { star, type: SIHWA_ORDER[i], intoPalace: starPalace[star] ?? '' };
    }).filter((x) => x.type);
    out.push({ startAge, palaceBranch: p.earthlyBranch as Branch, flyingSihwa });
  });
  return out.sort((x, y) => x.startAge - y.startAge);                    // 나이 오름차순
}

/**
 * ChartInput → ZiweiChart (iztro 정규화). 성반·국·명궁 + 운한(대한 비성사화).
 *   규칙9: 보조·수렴 범위 — 깊은 진단은 만들지 않되, 운의 흐름(운한·사화)은 통변 근거로 정규화한다.
 */
export function buildZiweiChart(input: ChartInput): ZiweiChart {
  const [datePart, timePart = '0:0'] = input.birthDateTime.split(' ');
  const hour = Number(timePart.split(':')[0]) || 0;
  const a: any = astro.bySolar(datePart, hourToTimeIndex(hour), input.sex === '남' ? '男' : '女');

  const palaces: Palace[] = a.palaces.map((p: any) => ({
    name: PALACE_NAME[p.name] ?? p.name,
    branch: p.earthlyBranch as Branch,
    majorStars: (p.majorStars ?? []).map(mapStar),
    minorStars: (p.minorStars ?? []).map(mapStar),
    ...(p.isBodyPalace ? { isBodyPalace: true } : {}),
  }));

  const birthYear = Number(datePart.slice(0, 4)) || 0;
  return {
    bureau: a.fiveElementsClass,                         // 예: "土五局"
    lifePalaceBranch: a.earthlyBranchOfSoulPalace as Branch,
    palaces,
    decades: buildDecades(a, palaces, birthYear),        // 운한(대한) 비성사화
  };
}
