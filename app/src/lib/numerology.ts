// app/src/lib/numerology.ts — 수비학(Numerology) 엔진 · 결정론 · 온디바이스
// ─────────────────────────────────────────────────────────────────────────
// 표준 체계: **피타고리안(Pythagorean) 수비학** (서양 표준). 계산은 룰(여기), 해석은 별도
//   (무료=템플릿 meanings / 유료=LLM 통변). 기획서 §9: 계산=엔진, 해석=LLM.
// ★도메인 지식 출처: Claude가 표준 레퍼런스로 인코딩(daniel 비전문). 발명 금지·체계 변형은 주석에 명시.
// ⚠️ 한글 이름 기반 수(표현/영혼/성격수)는 로마자 변환이 필요 → buildNumerology(romanName)로 주입.
//   로마자 변환(한글→Revised Romanization) 체계는 별도 단계에서 확정(README/doc 참고).
//   생년월일 기반 수(생명수·생일수·개인해수)는 언어 무관·견고 → 이름 없이도 동작(무료 핵심).
// ─────────────────────────────────────────────────────────────────────────

// 피타고리안 글자값: A=1,B=2,…,I=9, J=1,…,R=9, S=1,…,Z=8 (A~Z를 1~9로 순환).
const PYTHAGOREAN: Record<string, number> = {};
'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((ch, i) => { PYTHAGOREAN[ch] = (i % 9) + 1; });

// 모음 집합. Y는 표준상 맥락 의존(여기선 자음 처리 — 가장 보편적 기본값, 변형 존재).
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

// 마스터수 보존: 11/22/33 은 한 자리로 줄이지 않고 유지(피타고리안 표준).
const MASTERS = new Set([11, 22, 33]);

/**
 * 한 자리(또는 마스터수)로 축소한다.
 * @param n 입력 수
 * @param keepMaster 11/22/33 을 보존할지(기본 true)
 * @returns 1~9 또는 11/22/33
 */
function reduce(n: number, keepMaster = true): number {
  while (n > 9) {
    if (keepMaster && MASTERS.has(n)) return n;
    n = String(n).split('').reduce((s, d) => s + Number(d), 0);
  }
  return n;
}

/**
 * 생명수 (Life Path) — 그 사람의 인생 큰 줄기.
 * 표준 방식: 월·일·년을 각각 축소 후 합쳐 다시 축소(마스터수 보존에 유리).
 */
export function lifePath(year: number, month: number, day: number): number {
  return reduce(reduce(month) + reduce(day) + reduce(year));
}

/** 생일수 (Birthday) — 태어난 '일'을 축소(타고난 재능 힌트). */
export function birthdayNumber(day: number): number {
  return reduce(day);
}

/** 개인해 수 (Personal Year) — 올해(또는 지정 연도)의 흐름. 생월+생일+해당연도. */
export function personalYear(month: number, day: number, year: number): number {
  return reduce(reduce(month) + reduce(day) + reduce(year));
}

/** 로마자 이름의 글자값 합(필터 적용 후 축소). 비-알파벳은 무시. */
function nameSum(romanName: string, filter: (ch: string) => boolean): number {
  const up = romanName.toUpperCase().replace(/[^A-Z]/g, '');
  const total = [...up].filter(filter).reduce((s, ch) => s + (PYTHAGOREAN[ch] ?? 0), 0);
  return reduce(total);
}

/** 표현수 (Expression/Destiny) — 이름 전체. 타고난 능력·방향. */
export function expressionNumber(romanName: string): number {
  return nameSum(romanName, () => true);
}
/** 영혼수 (Soul Urge) — 이름의 모음. 내면의 욕구. */
export function soulUrgeNumber(romanName: string): number {
  return nameSum(romanName, (ch) => VOWELS.has(ch));
}
/** 성격수 (Personality) — 이름의 자음. 남에게 보이는 모습. */
export function personalityNumber(romanName: string): number {
  return nameSum(romanName, (ch) => !VOWELS.has(ch));
}

export type NumerologyChart = {
  lifePath: number;        // 생명수(필수)
  birthday: number;        // 생일수(필수)
  personalYear: number;    // 개인해 수(필수)
  expression?: number;     // 표현수(로마자 이름 있을 때)
  soulUrge?: number;       // 영혼수
  personality?: number;    // 성격수
  masterNumbers: number[]; // 등장한 마스터수(11/22/33) 모음
};

/**
 * 전체 수비학 차트를 만든다.
 * @param input.year/month/day 생년월일(필수)
 * @param input.romanName 로마자 이름(옵션 — 있으면 이름 기반 3수 계산)
 * @param input.forYear 개인해 기준 연도(기본 올해)
 */
export function buildNumerology(input: {
  year: number; month: number; day: number; romanName?: string; forYear?: number;
}): NumerologyChart {
  const lp = lifePath(input.year, input.month, input.day);
  const bd = birthdayNumber(input.day);
  const py = personalYear(input.month, input.day, input.forYear ?? new Date().getFullYear());
  const ex = input.romanName ? expressionNumber(input.romanName) : undefined;
  const su = input.romanName ? soulUrgeNumber(input.romanName) : undefined;
  const pe = input.romanName ? personalityNumber(input.romanName) : undefined;
  // 마스터수 수집(중복 제거)
  const masters = [lp, bd, py, ex, su, pe].filter((n): n is number => n != null && MASTERS.has(n));
  return { lifePath: lp, birthday: bd, personalYear: py, expression: ex, soulUrge: su, personality: pe, masterNumbers: [...new Set(masters)] };
}

// ── 무료 해석 템플릿(온디바이스·API 0) — daniel: 비용 안 드는 표준 의미는 무료로. ──
//   피타고리안 숫자 의미는 표준·고정이라 템플릿으로 충분(사주처럼 nuance 통변 불필요). ★문구 tone = daniel 검수 슬롯.
export type NumMeaning = { keyword: string; text: string };

export const LIFE_PATH_MEANING: Record<number, NumMeaning> = {
  1: { keyword: '개척하는 리더', text: '스스로 길을 내는 독립·추진의 사람이에요. 시작하고 주도하는 데 강하고, 기대기보다 앞장설 때 빛나요. 다만 고집·독선은 한 번씩 돌아보면 좋아요.' },
  2: { keyword: '조화의 중재자', text: '함께·균형·배려가 인생의 큰 줄기예요. 관계를 잇고 분위기를 맞추는 데 탁월해요. 휘둘리지 않게 나의 중심을 지키면 더 단단해집니다.' },
  3: { keyword: '표현하는 창작자', text: '말·글·예술로 자신을 드러내는 밝은 에너지예요. 사람을 즐겁게 하고 아이디어가 풍부해요. 흩어지는 집중만 잡으면 크게 피어납니다.' },
  4: { keyword: '단단한 성실가', text: '꾸준함·체계·신뢰가 무기예요. 차근차근 쌓아 기반을 만드는 사람. 너무 굳지 않게 유연함을 더하면 완성도가 올라가요.' },
  5: { keyword: '자유로운 모험가', text: '변화·경험·자유를 좇는 역동의 사람이에요. 새로운 걸 빠르게 흡수하고 사람도 잘 사귀어요. 한곳에 진득함을 보태면 결실이 커집니다.' },
  6: { keyword: '따뜻한 돌봄이', text: '책임·사랑·가정이 핵심이에요. 곁을 챙기고 조화를 만드는 사람. 다 떠안다 지치지 않게 나 자신도 꼭 돌보세요.' },
  7: { keyword: '깊이 파는 탐구자', text: '사색·통찰·본질을 향하는 내면형이에요. 혼자만의 시간에 힘을 얻고 깊이 꿰뚫어요. 가끔 마음을 나누면 더 풍요로워집니다.' },
  8: { keyword: '성취하는 전략가', text: '권한·성과·현실 감각이 큰 줄기예요. 목표를 향해 판을 짜고 끌고 가는 힘이 있어요. 일과 사람의 균형을 맞추면 더 멀리 갑니다.' },
  9: { keyword: '품이 넓은 완성자', text: '봉사·이상·포용의 사람이에요. 큰 그림과 따뜻함으로 베풀고 마무리하는 결. 다 내어주다 소진되지 않게 선을 지키세요.' },
  11: { keyword: '영감의 등불(마스터수)', text: '직관·영성·영향력이 남다른 자리예요. 사람을 일깨우고 비추는 힘이 있어요. 예민함을 잘 다스리면 큰 빛이 됩니다.' },
  22: { keyword: '큰 실현가(마스터수)', text: '이상을 현실로 짓는 드문 힘이에요. 큰 비전을 실제 결과로 만들어내요. 압박을 잘 풀어가면 크게 이룹니다.' },
  33: { keyword: '사랑의 치유자(마스터수)', text: '헌신·치유·가르침의 자리예요. 깊은 사랑으로 사람을 보듬고 키워요. 자기희생이 과하지 않게 균형을 잡으면 좋아요.' },
};

export const BIRTHDAY_MEANING: Record<number, NumMeaning> = {
  1: { keyword: '주도력', text: '스스로 시작하고 이끄는 타고난 추진력이 있어요.' },
  2: { keyword: '공감력', text: '사람의 마음을 읽고 잇는 섬세한 재능이 있어요.' },
  3: { keyword: '표현력', text: '말·글·끼로 자신을 드러내는 재능이 있어요.' },
  4: { keyword: '성실함', text: '맡은 일을 끝까지 해내는 단단한 재능이 있어요.' },
  5: { keyword: '융통성', text: '변화에 빠르게 적응하고 사람을 사귀는 재능이 있어요.' },
  6: { keyword: '돌봄', text: '챙기고 보듬어 조화를 만드는 재능이 있어요.' },
  7: { keyword: '통찰', text: '깊이 파고들어 본질을 보는 재능이 있어요.' },
  8: { keyword: '추진·성취', text: '판을 읽고 결과를 만드는 재능이 있어요.' },
  9: { keyword: '포용', text: '넓게 품고 베푸는 재능이 있어요.' },
  11: { keyword: '직관(마스터)', text: '번뜩이는 영감과 직관의 재능이 있어요.' },
  22: { keyword: '실현(마스터)', text: '큰 구상을 현실로 만드는 재능이 있어요.' },
};

export const PERSONAL_YEAR_MEANING: Record<number, NumMeaning> = {
  1: { keyword: '새 출발', text: '시작·결정·씨뿌리기에 좋은 해예요. 새 일을 벌이기 좋아요.' },
  2: { keyword: '관계·인내', text: '함께·기다림·다지기의 해. 서두르기보다 관계를 쌓을 때.' },
  3: { keyword: '확장·즐거움', text: '표현·인연·기회가 늘어나는 활기찬 해예요.' },
  4: { keyword: '다지기', text: '차근차근 기반을 쌓고 노력하는 해. 결과보다 토대.' },
  5: { keyword: '변화·기회', text: '움직임·새 경험이 많은 해. 변화를 기회로.' },
  6: { keyword: '책임·가정', text: '가족·관계·돌봄이 중심이 되는 해예요.' },
  7: { keyword: '성찰·휴식', text: '안으로 채우고 정비하는 해. 무리한 확장은 잠시 미뤄도.' },
  8: { keyword: '결실·성과', text: '노력이 보상으로 돌아오는 해. 큰일을 추진하기 좋아요.' },
  9: { keyword: '마무리·정리', text: '비우고 매듭짓는 해. 다음 사이클을 위한 정리의 때.' },
};

/** 숫자 → 의미(없으면 한 자리로 축소해 재조회 — 31일 등). */
export function meaningFor(table: Record<number, NumMeaning>, n: number): NumMeaning {
  return table[n] ?? table[reduce(n, false)] ?? { keyword: String(n), text: '' };
}
