// app/src/lib/countryFit.ts — '나에게 맞는 나라'(daniel 2026-06-24, 무료·온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 원국 조후(더움/추움)·부족 오행 + 지금 운을 보고, 기운을 보완해 줄 *기후·방위*의 나라를 추천(국기 emoji).
//   조후=거주지의 가장 큰 변수(한난). 더우면 서늘한 곳, 추우면 따뜻한 곳으로 중화. 부족 오행은 환경 결로 보완.
// ⚠️ '이주 권유'가 아니라 *기운 보완 관점의 재미 안내*(법률·이민 조언 아님). ★국가 매핑 stance = daniel 검수 슬롯.
// 무료(온디바이스·API 0) — 조후·오행은 만세력 엔진 산출값 사용.
// ─────────────────────────────────────────────────────────────────────────
import { johuSkew, eumYangSkew } from './ohaeng';

export type CountryRec = { name: string; flag: string; reason: string };
export type CountryFit = {
  johu: '더움 쏠림' | '추움 쏠림' | '중화';
  warm: number; cold: number;
  headline: string;
  recommend: CountryRec[];   // 잘 맞는 나라(기운 보완)
  caution: CountryRec[];     // 기운을 더 치우치게 해 주의할 결
  note: string;
};

// 기후 결별 나라(국기 emoji). ★ daniel 검수 슬롯(지리·기후 매핑).
const COOL = [ // 서늘·북반구 고위도 — 더움 쏠림 보완
  { name: '캐나다', flag: '🇨🇦' }, { name: '노르웨이', flag: '🇳🇴' }, { name: '핀란드', flag: '🇫🇮' },
  { name: '영국', flag: '🇬🇧' }, { name: '뉴질랜드', flag: '🇳🇿' }, { name: '아이슬란드', flag: '🇮🇸' },
];
const WARM = [ // 따뜻·온대~열대 — 추움 쏠림 보완
  { name: '태국', flag: '🇹🇭' }, { name: '스페인', flag: '🇪🇸' }, { name: '호주', flag: '🇦🇺' },
  { name: '싱가포르', flag: '🇸🇬' }, { name: '이탈리아', flag: '🇮🇹' }, { name: '베트남', flag: '🇻🇳' },
];
const MILD = [ // 중화 — 사계절 온화
  { name: '한국', flag: '🇰🇷' }, { name: '일본', flag: '🇯🇵' }, { name: '미국(서부)', flag: '🇺🇸' },
  { name: '포르투갈', flag: '🇵🇹' }, { name: '프랑스', flag: '🇫🇷' },
];

/** 원국 조후 + 성별 음양으로 거주 적합 나라 산출(온디바이스). */
export function countryFit(saju: any, sex?: string): CountryFit {
  const P = saju?.pillars ?? {};
  const jh = johuSkew(P);
  const ey = eumYangSkew(P, sex);
  if (jh.skew === '더움 쏠림') {
    return {
      johu: jh.skew, warm: jh.warm, cold: jh.cold,
      headline: '타고난 기운이 따뜻한 쪽으로 쏠려, *서늘하고 물이 가까운 곳*이 균형을 잡아 줍니다.',
      recommend: COOL.map((c) => ({ ...c, reason: '서늘한 기후·높은 위도가 과열된 기운을 식혀 머리를 맑게 해 줘요.' })),
      caution: WARM.slice(0, 3).map((c) => ({ ...c, reason: '덥고 습한 곳은 이미 치우친 기운을 더 키워 쉽게 지칠 수 있어요.' })),
      note: '꼭 이민이 아니어도 — 여행·휴식·일터의 방향을 *북쪽·물가·서늘한 환경*으로 잡으면 기운이 풀려요.',
    };
  }
  if (jh.skew === '추움 쏠림') {
    return {
      johu: jh.skew, warm: jh.warm, cold: jh.cold,
      headline: '타고난 기운이 차가운 쪽으로 쏠려, *따뜻하고 볕이 좋은 곳*이 기운을 데워 줍니다.',
      recommend: WARM.map((c) => ({ ...c, reason: '따뜻한 기후·풍부한 햇볕이 가라앉은 기운을 끌어올려 활력을 줘요.' })),
      caution: COOL.slice(0, 3).map((c) => ({ ...c, reason: '춥고 어두운 곳은 이미 치우친 기운을 더 무겁게 해 의욕이 떨어질 수 있어요.' })),
      note: '꼭 이민이 아니어도 — 여행·휴식·일터의 방향을 *남쪽·햇볕·따뜻한 환경*으로 잡으면 기운이 살아나요.',
    };
  }
  return {
    johu: jh.skew, warm: jh.warm, cold: jh.cold,
    headline: '기운이 비교적 *중화*되어, 기후를 크게 가리지 않고 두루 잘 적응합니다.',
    recommend: MILD.map((c) => ({ ...c, reason: '사계절이 온화해 치우침 없이 안정적으로 지내기 좋아요.' })),
    caution: [],
    note: '극단적으로 덥거나 추운 환경만 길게 피하면, 어디서든 무난하게 자리 잡는 결이에요.',
  };
}
