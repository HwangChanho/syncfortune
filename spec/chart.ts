// chart.ts — v0.2
// ─────────────────────────────────────────────────────────────────────────
// 정규화 차트 객체 (Normalized Chart Object)
// = L1 엔진 출력 == L2 해석 입력의 *공통 계약*. 병렬 빌드의 첫 돌.
//
// 핵심 원칙 (기획서 §9 안티패턴 #3):
//   글자·자리·지장간·인접 충합·통근/투출을 *날것* 보존한다. 태그로 압축 금지.
//   "분해는 내부, 통변은 매끈" — 구조는 풍부히 담고, 통합은 해석 레이어가 한다.
//
// ── 변경 이력 (상세 근거 = docs/ARCHITECTURE.md ADR) ──
//   v0.2 (2026-06-02):
//     · [ADR-004] ChartPosition 신설 + Interaction.members 확장
//                 → 대운×세운 충(R5·가드8)을 타입으로 표현 가능.
//                   예: 골든엔트리 retrodiction "2019 황반변성 = 巳亥충(대운 巳 × 세운 亥)".
//     · [ADR-005] PII 경계 분리: ChartInput(온디바이스 전용) ↔ NormalizedChart(서버 전송, PII 없음)
//                 + OnDeviceChart(평문 합성). 타입으로 PII 격리 강제(§6.1).
//   v0.1: 최초 정의 (골든엔트리 #1 확보 전 단독 리뷰본).
// ─────────────────────────────────────────────────────────────────────────

// ── 원자 타입 ──
export type Stem = '甲'|'乙'|'丙'|'丁'|'戊'|'己'|'庚'|'辛'|'壬'|'癸';
export type Branch = '子'|'丑'|'寅'|'卯'|'辰'|'巳'|'午'|'未'|'申'|'酉'|'戌'|'亥';
export type Element = '木'|'火'|'土'|'金'|'水';
export type TenGod =
  | '비견' | '겁재' | '식신' | '상관' | '편재'
  | '정재' | '편관' | '정관' | '편인' | '정인';
export type PillarPos = '년' | '월' | '일' | '시';

// [ADR-004] 차트상의 위치 = 원국 4기둥 + 시간층(대운/세운/월운/일운).
//   Interaction.members가 원국뿐 아니라 시간층 글자도 가리킬 수 있게 한다.
//   (골든엔트리 retrodiction 핵심 신호 "대운-세운 충"을 타입으로 담기 위함 — R5·가드8.)
export type ChartPosition = PillarPos | '대운' | '세운' | '월운' | '일운';

export type Brightness = '廟'|'旺'|'得地'|'利'|'平'|'不得地'|'陷'; // 자미두수 묘왕평함
export type SihwaType = '化祿' | '化權' | '化科' | '化忌';

// ─────────────────────────────────────────────────────────────────────────
// 사주
// ─────────────────────────────────────────────────────────────────────────
export interface HiddenStem {
  stem: Stem;
  tenGod: TenGod;
  role: '본기' | '중기' | '여기';
}

export interface PillarData {
  position: PillarPos;
  stem: Stem;
  stemTenGod: TenGod;                 // 일간 기준
  branch: Branch;
  branchMainTenGod: TenGod;           // 지지 본기 기준
  hiddenStems: HiddenStem[];          // 지장간 전부 (날것 보존)
  isRoot: boolean;                    // 통근(이 자리가 일간/투간의 뿌리인가)
}

export interface Interaction {        // 합·충·형·해·파 — *검출은 결정론(RULE)*
  type: '합' | '충' | '형' | '해' | '파' | '극';   // 극=천간 상극(剋, 7충 외 오행극 — 예 丁克辛)
  members: ChartPosition[];           // [ADR-004] 원국 자리 + 시간층. 예: ['대운','세운']=대운×세운 충
  detail: string;                     // 예: "卯戌合化火", "卯酉冲", "巳亥冲(대운×세운)"
  transformsTo?: Element;             // 합화 결과 오행 (해당 시)
  transformSupported?: boolean;       // 화기 세력 받침(투출 등)으로 化 성립?  ← R1
  level?: '천간' | '지지';            // 천간 관계(합·충=극) vs 지지 관계 — UI 분리·해석 구분 (기본 지지)
}

export interface LuckCycle {          // 대운
  startAge: number;
  stem: Stem; branch: Branch;
  stemTenGod: TenGod;
  isCurrent: boolean;
  annuals?: AnnualPillar[];           // 이 대운의 세운(流年) 10년 — 타임라인 드릴다운 (과거~미래 전부)
}

export interface MonthPillar {        // 월운 (流月)
  stem: Stem; branch: Branch;
  stemTenGod: TenGod;
  label: string;                      // 월 표시 (예 '正月')
}

export interface AnnualPillar {       // 세운 (월운·일운도 동형으로 확장)
  year: number;
  stem: Stem; branch: Branch;
  stemTenGod: TenGod;
  interactionsWithLuck: Interaction[]; // ★ 대운×세운 합충 (R5, 가드8 — 층 상호작용). members에 '대운'·'세운' 사용
  months?: MonthPillar[];             // 이 세운의 월운(流月) 12 — 세운 탭 시 드릴다운
}

export interface SajuChart {
  pillars: Record<PillarPos, PillarData>;
  dayMaster: { stem: Stem; element: Element };
  interactions: Interaction[];        // 원국 내 합충형해
  luckCycles: LuckCycle[];
  currentLuck: LuckCycle;
  annual: AnnualPillar;               // 현재 세운
  structure?: StructureDx;            // ← encoded expert layer가 채움
}

// ── 구조 진단 (encoded expert layer 산출, = 우리만의 레이어 핵심) ──
export interface UsefulGodCandidate {
  method: '억부' | '조후' | '통관' | '병약' | '격국상신';
  candidate: TenGod | Element;
  rationale: string;
}

export interface DynamicUsefulGod {   // 동태적 용신 — 들어오는 천간 오행별 살 처리 모드
  byIncomingStemElement: Partial<Record<Element, string>>;
  // 예: { 土: "살인상생 ON", 金: "비겁 자력", 水: "식상제살", 木: "재생살 가중" }
}

export interface StructureDx {
  strength: { score: number; verdict: '신강' | '중화' | '신약'; basis: string };
  pattern: { name: string; basis: string };               // 격국
  usefulGodCandidates: UsefulGodCandidate[];               // RULE 생성 (Pass0)
  usefulGod: { value: TenGod | Element; basis: string };   // LLM 판정 (Pass2, stance)
  dynamicUsefulGod?: DynamicUsefulGod;
  diseaseRemedy: { disease: string; remedy: string };      // 병/약 (Pass3 정박)
  keyActions: Interaction[];                               // 핵심작용(합충형해). 재생살 등 십신작용은 coreThesis 참조(ADR-007)
  schoolAdjudication: string;                              // 문파(자평진전 중심)
  coreThesis?: string;
  uncertaintyFlags: string[];                              // 경계·학파갈림
}

// ─────────────────────────────────────────────────────────────────────────
// 자미두수 (보조·수렴 레이어 — iztro 출력 정규화)
// ─────────────────────────────────────────────────────────────────────────
export interface Star {
  name: string;
  brightness: Brightness;
  transforms: SihwaType[];            // 생년사화 등
}

export interface Palace {
  name:
    | '명궁'|'형제궁'|'부처궁'|'자녀궁'|'재백궁'|'질액궁'
    | '천이궁'|'노복궁'|'관록궁'|'전택궁'|'복덕궁'|'부모궁';
  branch: Branch;
  majorStars: Star[];                 // 14 주성
  minorStars: Star[];                 // 육길·육살·기타
  isBodyPalace?: boolean;
}

export interface ZiweiDecade {        // 운한 (대한) + 비성사화
  startAge: number;
  palaceBranch: Branch;
  flyingSihwa: { star: string; type: SihwaType; intoPalace: string }[];
}

export interface ZiweiChart {
  bureau: string;                     // 국 (예: "土五局")
  lifePalaceBranch: Branch;
  palaces: Palace[];
  decades: ZiweiDecade[];
}

// ─────────────────────────────────────────────────────────────────────────
// 메타 / 통합 / 해석 산출
// ─────────────────────────────────────────────────────────────────────────
export interface ChartMeta {
  relation: 'self' | '가족' | '지인' | '공인';
  eventConfidence: '상' | '중' | '하';
  consent: boolean;
}

export type CategoryKey =
  | '성격내면'
  | '취업운' | '직장운' | '사업운'
  | '금전소득운' | '투자편재운' | '재물손재'
  | '연애운' | '결혼배우자운' | '대인사회성'
  | '부모운' | '형제운' | '자식운'
  | '건강' | '학업자기계발' | '이동환경';

export interface CategoryReading {
  base: string;                       // 원국 결
  overlay: string;                    // 현재 대운·세운 발현
  remedy: string;                     // 처방 (필수 — 가드5)
  status?: 'N/A' | 'prospective' | 'active';
  uncertaintyFlags: string[];
  sources: string[];                  // RAG grounding 출처 (glass-box 표시용)
  crossLink?: string[];               // 같은 작용의 타 영역 발현 (R6)
}

// [ADR-005] 엔진 입력 PII — 온디바이스에서만 평문. NormalizedChart에서 분리해 서버 경계로 안 나가게.
export interface ChartInput {
  birthDateTime: string;
  calendar: '양' | '음';
  timeAccuracy: '정확' | '추정' | '미상';
  sex: '남' | '여';
  birthPlace: string;                 // 진태양시 보정(도시명)
  birthLon?: number;                  // 출생지 경도(°E) — 진태양시 보정용. 없으면 도시명 lookup/기본값(engine/solartime)
}

// [ADR-005] 서버 전송 가능 — PII(ChartInput) 없음. 신원 없는 '구조' 데이터만(§6.1).
export interface NormalizedChart {
  id: string;
  meta: ChartMeta;
  saju: SajuChart;                    // 핵심 IP
  ziwei?: ZiweiChart;                 // 보조 레이어
  readings?: Partial<Record<CategoryKey, CategoryReading>>;
}

// [ADR-005] 온디바이스 평문 합성 = NormalizedChart + PII. 서버로 보낼 땐 NormalizedChart로 좁힌다.
export interface OnDeviceChart extends NormalizedChart {
  input: ChartInput;
}
