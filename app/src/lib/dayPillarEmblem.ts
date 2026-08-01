// app/src/lib/dayPillarEmblem.ts — 일주(日柱) 엠블럼: 일간 오행(색) + 일지 동물 → "은빛 소" 등
// ─────────────────────────────────────────────────────────────────────────
// daniel: 명식 리스트에서 각 명식의 일주를 시각적 정체성으로 보여준다.
//   일간(천간) 오행 = 색,  일지(지지) = 띠 동물.  예) 辛丑 = 金(은빛) + 소 = "은빛 소".
//   60갑자 AI 일러스트(assets/ilju/{간지}.jpg)는 ILJU_IMG 맵으로 추후 연결 — 없으면 색+동물 폴백.
// ─────────────────────────────────────────────────────────────────────────
import { stemElement, elementColor, elementText } from './engine/ohaeng';
import { A } from '../lib/ui/remoteAsset'; // ★이미지 원격화(daniel 08-01) — 번들에서 걷어내고 Storage 에서 받는다

// 지지 → 띠 동물(한글). zodiac.ts ANIMAL 과 동일 셋(독립 보관 — 엠블럼 전용·간결).
export const ILJU_ANIMAL: Record<string, string> = {
  子: '쥐', 丑: '소', 寅: '호랑이', 卯: '토끼', 辰: '용', 巳: '뱀',
  午: '말', 未: '양', 申: '원숭이', 酉: '닭', 戌: '개', 亥: '돼지',
};
// 오행 → 색 형용사(일간 오행 = 동물의 '빛깔'). 木푸른·火붉은·土황금빛·金은빛·水검은.
const EL_ADJ: Record<string, string> = { 木: '푸른', 火: '붉은', 土: '황금빛', 金: '은빛', 水: '검은' };

export type IljuEmblem = {
  gz: string;          // 간지(辛丑)
  stem: string; branch: string;
  element: string;     // 일간 오행(金)
  color: string;       // 오행 배경색
  textColor: string;   // 배경 위 글자색
  animal: string;      // 동물(소)
  name: string;        // "은빛 소"
};

/** 일주(일간·일지) → 엠블럼 데이터. 60갑자 어디든 색+동물로 자동 표현. */
export function iljuEmblem(stem: string, branch: string): IljuEmblem {
  const element = stemElement(stem);
  const animal = ILJU_ANIMAL[branch] ?? '';
  return {
    gz: `${stem}${branch}`, stem, branch, element,
    color: elementColor[element], textColor: elementText[element],
    animal, name: `${EL_ADJ[element] ?? ''} ${animal}`.trim(),
  };
}

// ── 60갑자 AI 일러스트(Draw Things 생성 · assets/ilju/ilju_00~59.jpg · 512²·JPG) ──
// 파일은 60갑자 표준 순서로 생성됨: ilju_NN = 천간 STEMS[NN%10] × 지지 BRANCHES[NN%12]
//   (00=甲子 … 59=癸亥, 본인 辛丑=37). 등록 간지는 <Image source={ILJU_IMG[gz]}>, 없으면 색+동물 폴백.
//   ※ RN 은 동적 require 불가 → 60개 정적 require 배열로 받고, 간지 키는 인덱스로 계산해 매핑.
const _STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const _BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ILJU_IMGS: any[] = [
  A('ilju/ilju_00.jpg'), A('ilju/ilju_01.jpg'),
  A('ilju/ilju_02.jpg'), A('ilju/ilju_03.jpg'),
  A('ilju/ilju_04.jpg'), A('ilju/ilju_05.jpg'),
  A('ilju/ilju_06.jpg'), A('ilju/ilju_07.jpg'),
  A('ilju/ilju_08.jpg'), A('ilju/ilju_09.jpg'),
  A('ilju/ilju_10.jpg'), A('ilju/ilju_11.jpg'),
  A('ilju/ilju_12.jpg'), A('ilju/ilju_13.jpg'),
  A('ilju/ilju_14.jpg'), A('ilju/ilju_15.jpg'),
  A('ilju/ilju_16.jpg'), A('ilju/ilju_17.jpg'),
  A('ilju/ilju_18.jpg'), A('ilju/ilju_19.jpg'),
  A('ilju/ilju_20.jpg'), A('ilju/ilju_21.jpg'),
  A('ilju/ilju_22.jpg'), A('ilju/ilju_23.jpg'),
  A('ilju/ilju_24.jpg'), A('ilju/ilju_25.jpg'),
  A('ilju/ilju_26.jpg'), A('ilju/ilju_27.jpg'),
  A('ilju/ilju_28.jpg'), A('ilju/ilju_29.jpg'),
  A('ilju/ilju_30.jpg'), A('ilju/ilju_31.jpg'),
  A('ilju/ilju_32.jpg'), A('ilju/ilju_33.jpg'),
  A('ilju/ilju_34.jpg'), A('ilju/ilju_35.jpg'),
  A('ilju/ilju_36.jpg'), A('ilju/ilju_37.jpg'),
  A('ilju/ilju_38.jpg'), A('ilju/ilju_39.jpg'),
  A('ilju/ilju_40.jpg'), A('ilju/ilju_41.jpg'),
  A('ilju/ilju_42.jpg'), A('ilju/ilju_43.jpg'),
  A('ilju/ilju_44.jpg'), A('ilju/ilju_45.jpg'),
  A('ilju/ilju_46.jpg'), A('ilju/ilju_47.jpg'),
  A('ilju/ilju_48.jpg'), A('ilju/ilju_49.jpg'),
  A('ilju/ilju_50.jpg'), A('ilju/ilju_51.jpg'),
  A('ilju/ilju_52.jpg'), A('ilju/ilju_53.jpg'),
  A('ilju/ilju_54.jpg'), A('ilju/ilju_55.jpg'),
  A('ilju/ilju_56.jpg'), A('ilju/ilju_57.jpg'),
  A('ilju/ilju_58.jpg'), A('ilju/ilju_59.jpg'),
];
// 간지 → 이미지(모듈 로드 시 1회 구성). i%10=천간 인덱스, i%12=지지 인덱스 = 60갑자 정의.
export const ILJU_IMG: Record<string, any> = (() => {
  const m: Record<string, any> = {};
  for (let i = 0; i < 60; i++) m[_STEMS[i % 10] + _BRANCHES[i % 12]] = ILJU_IMGS[i];
  return m;
})();

/** 일주 간지(辛丑 등) → AI 일러스트 source. 없으면 null(색+동물 폴백). */
export function iljuImage(stem: string, branch: string): any {
  return ILJU_IMG[`${stem}${branch}`] ?? null;
}
