// app/src/lib/celebData.ts — 유명인 사주 DB (공개 생년월일 기반, 결정론용)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 인물 선정·생일 정확도·성별 확정 ★검수 슬롯.
// ⚠️ 안전 필수: 재미·추정 콘텐츠. 투자/정치 단정 절대 금지. 명예 존중.
//   시간 대부분 미상 → timeAccuracy:'미상'·정오 기준(시주는 유사도 계산에서 가중치 0).
// ─────────────────────────────────────────────────────────────────────────
import type { ChartInput } from '@spec/chart';

// ── 유명인 DB 항목 타입 ──────────────────────────────────────────────────
export type CelebEntry = {
  id: string;
  name: string;
  flag: string;       // 국기 이모지
  role: string;       // 분야
  birth: string;      // YYYY-MM-DD (공개 정보, 시각은 미상)
  sex: '남' | '여';   // ★daniel 검수: 여성 추가 시 반드시 지정
  blurb: string;      // 한 줄 소개 (재미·긍정 톤)
};

// ── 공개 생년월일 기반 유명인 목록 ──────────────────────────────────────
// ★daniel 검수: 인물·날짜·성별 확정. 불확실한 생년월일 → 포함하지 않음.
// 선정 기준: ① 생년월일이 위키피디아 등 복수 출처에서 일치 ② 시대·지역 다양성
//            ③ 긍정적 소개 가능 인물 (부정 단정 금지)
export const CELEB_DB: CelebEntry[] = [
  // ── 역사 인물 (생년월일 문헌 기록 확실) ──────────────────────────────
  {
    id: 'napoleon',
    name: '나폴레옹 보나파르트',
    flag: '🇫🇷',
    role: '역사·전략',
    birth: '1769-08-15',
    sex: '남',
    blurb: '전략과 야심으로 유럽을 재편한 군인 황제',
  },
  {
    id: 'mozart',
    name: '볼프강 아마데우스 모차르트',
    flag: '🇦🇹',
    role: '음악',
    birth: '1756-01-27',
    sex: '남',
    blurb: '35년 생애에 600여 곡을 남긴 음악 천재',
  },
  {
    id: 'lincoln',
    name: '에이브러햄 링컨',
    flag: '🇺🇸',
    role: '정치·역사',
    birth: '1809-02-12',
    sex: '남',
    blurb: '노예 해방을 이끈 미국의 16대 대통령',
  },
  {
    id: 'darwin',
    name: '찰스 다윈',
    flag: '🇬🇧',
    role: '과학',
    birth: '1809-02-12',
    sex: '남',
    blurb: '진화론으로 생명의 역사를 새로 쓴 박물학자',
  },
  {
    id: 'einstein',
    name: '알베르트 아인슈타인',
    flag: '🇩🇪',
    role: '과학',
    birth: '1879-03-14',
    sex: '남',
    blurb: '상대성이론으로 우주를 새롭게 바라보게 한 물리학자',
  },
  {
    id: 'curie',
    name: '마리 퀴리',
    flag: '🇵🇱',
    role: '과학',
    birth: '1867-11-07',
    sex: '여',
    blurb: '두 개의 노벨상을 받은 방사선 연구의 선구자',
  },
  {
    id: 'king-sejong',
    name: '세종대왕',
    flag: '🇰🇷',
    role: '역사·문화',
    birth: '1397-05-15',  // ★daniel 검수: 《세종실록》 음력 1397년 4월 10일 → 양력 환산 필요(1397-05-15는 임시). 확정 전 주의.
    sex: '남',
    blurb: '한글 창제와 과학 발전으로 조선을 이끈 성군',
  },
  {
    id: 'tesla',
    name: '니콜라 테슬라',
    flag: '🇷🇸',
    role: '과학·기술',
    birth: '1856-07-10',
    sex: '남',
    blurb: '교류 전기로 현대 문명의 기초를 놓은 천재 발명가',
  },

  // ── 현대 인물 (공개 생년월일 확실) ──────────────────────────────────
  {
    id: 'jobs',
    name: '스티브 잡스',
    flag: '🇺🇸',
    role: '기술·창의',
    birth: '1955-02-24',
    sex: '남',
    blurb: '아이폰·맥으로 기술과 예술을 융합한 혁신가',
  },
  {
    id: 'gates',
    name: '빌 게이츠',
    flag: '🇺🇸',
    role: '기술·자선',
    birth: '1955-10-28',
    sex: '남',
    blurb: '마이크로소프트를 세우고 전 세계 자선에 헌신하는 기업가',
  },
  {
    id: 'musk',
    name: '일론 머스크',
    flag: '🇿🇦',
    role: '기술·우주',
    birth: '1971-06-28',
    sex: '남',
    blurb: '전기차·우주·AI 경계를 허무는 파괴적 혁신가',
  },
  {
    id: 'oprah',
    name: '오프라 윈프리',
    flag: '🇺🇸',
    role: '미디어·문화',
    birth: '1954-01-29',
    sex: '여',
    blurb: '공감과 스토리텔링으로 세상을 움직이는 미디어 아이콘',
  },
  {
    id: 'obama',
    name: '버락 오바마',
    flag: '🇺🇸',
    role: '정치·리더십',
    birth: '1961-08-04',
    sex: '남',
    blurb: '변화와 희망의 메시지로 역사를 만든 전 미국 대통령',
  },
  {
    id: 'bts-rm',
    name: 'RM(방탄소년단)',
    flag: '🇰🇷',
    role: '음악·문화',
    birth: '1994-09-12',
    sex: '남',
    blurb: '한국 문화를 세계로 펼친 K-팝 아이콘',
  },
  {
    id: 'taylor-swift',
    name: '테일러 스위프트',
    flag: '🇺🇸',
    role: '음악',
    birth: '1989-12-13',
    sex: '여',
    blurb: '시대를 정의하는 싱어송라이터이자 문화 현상',
  },
  {
    id: 'buffett',
    name: '워런 버핏',
    flag: '🇺🇸',
    role: '경영·자선',
    birth: '1930-08-30',
    sex: '남',
    blurb: '오마하의 현인, 장기 가치 투자의 살아있는 전설',
  },
];

/**
 * CelebEntry → computeChart에 넣을 ChartInput 생성.
 * 시각 미상(timeAccuracy:'미상')으로 표시해 시주 기반 통변 금지.
 * 정오 기준은 시주 계산 자체가 의미 없는 마커로만 사용.
 */
export function celebChartInput(c: CelebEntry): ChartInput {
  return {
    birthDateTime: `${c.birth} 12:00`,  // 정오: 시주 제외 마커
    calendar: '양',
    timeAccuracy: '미상',               // ← 시주 기반 유사도/통변 제외 플래그
    sex: c.sex,
    birthPlace: '서울',                 // 진태양시 보정 기본값(시주 제외라 실질 영향 없음)
  };
}
