/**
 * scripts/check-solartime.ts — **시간 보정**(진태양시·절기 축) 하네스
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-23 *"밀라노 출생기준 … 시간 보정이 제대로 안된거 같아 수정해두고
 *   **앞으로 이런일 없게 고쳐놔**"* → 이 파일이 그 '앞으로'다.
 *
 * ■ 무엇을 잠그나
 *   ①**한국 회귀 0** — 해외 대응으로 갈아엎었지만 한국 출생은 값이 한 톨도 바뀌면 안 된다.
 *     수정 직전에 실측한 값을 그대로 박아 둔다(대조군).
 *   ②**해외가 맞게 나오나** — 서머타임·표준시가 실제와 같은지 분 단위로 본다.
 *   ③★**음성 테스트** — 옛 버그를 되살리면 반드시 빨간불이 되게.
 *     (밀라노 여름 시주가 `壬申`이면 = 서머타임을 다시 안 보는 것 · 파리가 UTC+0 이면 = 경도 추정으로 회귀)
 *
 * ■ ★이름이 아니라 **값**으로 판정한다([[harness-judge-expression-not-name]])
 *   "`dstOffsetMin` 을 부르는가" 같은 문자열 검사는, 더 나은 구현으로 바꾸면 억울하게 깨지고
 *   엉뚱한 구현으로 바꿔도 통과한다. 여기서는 **보정 분수와 팔자 여덟 글자**만 본다.
 *
 * 실행: npm run check:solartime   (preflight 에 포함)
 */
import { trueSolarOffsetMin, tzOf } from '../engine/solartime';
import { buildSajuChart } from '../engine/saju';
import type { ChartInput } from '../spec/chart';

/** 검사 한 건. `offset`·`pillars` 중 적은 쪽만 적어도 된다. */
type Case = {
  /** 사람이 읽는 이름 */
  name: string;
  /** 출생 시계시 'YYYY-MM-DD HH:mm' */
  dt: string;
  /** 출생지 표시명(국가명 포함 — 실제 피커가 주는 형태) */
  place: string;
  /** 출생지 경도(°E) */
  lon: number;
  /** 출생지 위도(°N) — 애리조나·퀸즐랜드처럼 위도로 갈리는 곳만 */
  lat?: number;
  /** 기대 진태양시 보정(분). ±0.01 까지 본다 */
  offset?: number;
  /** 기대 팔자 '년 월 일 시' (예: '乙亥 癸未 己巳 辛未') */
  pillars?: string;
  /** 기대 UTC 오프셋(분) — 표준시·서머타임 자체를 직접 잠근다 */
  utc?: number;
  /** 서머타임이 걸려 있어야 하는가 */
  dst?: boolean;
  /** 이 케이스가 무엇을 막는지 한 줄 */
  guards: string;
};

const input = (c: Case): ChartInput => ({
  birthDateTime: c.dt, calendar: '양', sex: '여',
  birthPlace: c.place, birthLon: c.lon, birthLat: c.lat,
  timeAccuracy: '정확',
} as ChartInput);

// ───────────────────────────────────────────────────────────────────────────
// A. 한국 회귀 — 2026-08-23 수정 **직전에 실측**한 값(대조군). 하나라도 어긋나면 회귀다.
// ───────────────────────────────────────────────────────────────────────────
const KOREA: Case[] = [
  { name: '여수 1994(Boss 본인)', dt: '1994-03-16 17:50', place: '여수시, 전라남도, 대한민국', lon: 127.659859,
    offset: -38.73, pillars: '甲戌 丁卯 辛丑 丁酉', utc: 540, dst: false,
    guards: '한국 현행 표준시(135°) — 골든엔트리 #1 과 같은 차트' },
  { name: '서울 1998', dt: '1998-03-17 10:00', place: '서울특별시', lon: 126.978,
    offset: -41.16, utc: 540, dst: false, guards: '출생지에 국가명이 없어도 한국으로 본다' },
  { name: '부산 2001-06-15 17:30', dt: '2001-06-15 17:30', place: '부산광역시', lon: 129.0752365,
    offset: -23.94, guards: '시지 경계(17:30→17:06) 케이스 — verify-engine 과 같은 값' },
  { name: '서울 1955(UTC+8:30 시대)', dt: '1955-01-20 12:00', place: '서울', lon: 126.978,
    offset: -13.00, utc: 510, guards: '1954~61 자오선 127.5° — 시대별 변천이 살아 있는가' },
  { name: '서울 1988(한국 서머타임)', dt: '1988-08-01 12:00', place: '서울', lon: 126.978,
    offset: -98.02, utc: 600, dst: true, guards: '1987~88 서머타임 −60분' },
  { name: '서울 1960(8:30+서머타임)', dt: '1960-06-01 12:00', place: '서울', lon: 126.978,
    offset: -59.91, utc: 570, dst: true, guards: '자오선 변천과 서머타임이 **겹친** 시기' },
];

// ───────────────────────────────────────────────────────────────────────────
// B. 해외 — 2026-08-23 신규. ★여기가 원래 고장 나 있던 자리다.
// ───────────────────────────────────────────────────────────────────────────
const OVERSEAS: Case[] = [
  // ★Boss 가 잡아낸 바로 그 차트(도세나 · 밀라노 1995-08-06 16:00)
  { name: '밀라노 1995-08-06 16:00 (여름·CEST)', dt: '1995-08-06 16:00', place: '밀라노, 롬바르디아, 이탈리아',
    lon: 9.1896346, lat: 45.4641943, offset: -88.79, utc: 120, dst: true, pillars: '乙亥 癸未 己巳 辛未',
    guards: '★이탈리아 서머타임. 안 보면 시주가 辛未 대신 壬申 으로 나온다(한 기둥이 통째로 틀림)' },
  { name: '밀라노 1995-01-06 16:00 (겨울·CET)', dt: '1995-01-06 16:00', place: '밀라노, 롬바르디아, 이탈리아',
    lon: 9.1896346, lat: 45.4641943, offset: -29.03, utc: 60, dst: false,
    guards: '겨울엔 서머타임이 없어야 한다 — 규칙이 항상 켜지는 실수를 막는다' },
  { name: '파리 2000-07-01 12:00', dt: '2000-07-01 12:00', place: '파리, 일드프랑스, 프랑스', lon: 2.3522,
    offset: -114.30, utc: 120, dst: true,
    guards: '★경도(2.35°)로 추정하면 UTC+0 이 된다. 프랑스는 CET — 국가 테이블이 경도를 이겨야 한다' },
  { name: '런던 2000-07-01 12:00', dt: '2000-07-01 12:00', place: '런던, 잉글랜드, 영국', lon: -0.1276,
    utc: 60, dst: true, guards: '영국은 표준시 0 + 서머타임(BST)' },
  { name: 'LA 2006-02-01 10:00 (겨울·PST)', dt: '2006-02-01 10:00', place: 'Jurupa Valley, 캘리포니아, 미국',
    lon: -117.4773423, lat: 33.9971, offset: -3.58, utc: -480, dst: false,
    guards: 'Boss 계정에 실제 등록된 미국 차트 — 겨울값이 바뀌면 안 된다' },
  { name: 'LA 2006-07-01 10:00 (여름·PDT)', dt: '2006-07-01 10:00', place: 'Jurupa Valley, 캘리포니아, 미국',
    lon: -117.4773423, lat: 33.9971, utc: -420, dst: true, guards: '미국 서머타임(2007년 이전 규칙)' },
  { name: 'LA 2007-03-11 10:00 (규칙 변경일)', dt: '2007-03-11 10:00', place: '로스앤젤레스, 캘리포니아, 미국',
    lon: -118.24, lat: 34.05, utc: -420, dst: true,
    guards: '2007년부터 3월 **둘째** 일요일 시작 — 옛 규칙(4월)이면 이 날은 아직 표준시다' },
  { name: '피닉스 2006-07-01 10:00 (애리조나)', dt: '2006-07-01 10:00', place: '피닉스, 애리조나, 미국',
    lon: -112.074, lat: 33.4484, utc: -420, dst: false,
    guards: '★애리조나는 서머타임이 없다 — 위도 예외 밴드가 살아 있는가' },
  { name: '뉴욕 2000-07-01 12:00', dt: '2000-07-01 12:00', place: '뉴욕, 뉴욕주, 미국', lon: -74.006, lat: 40.71,
    offset: -59.73, utc: -240, dst: true, guards: '미 동부 서머타임(EDT)' },
  { name: '도쿄 2000-07-01 12:00', dt: '2000-07-01 12:00', place: '도쿄, 일본', lon: 139.6917,
    offset: 15.06, utc: 540, dst: false, guards: '일본은 1952년 이후 서머타임이 없다 — 없는 걸 넣지 않는가' },
  { name: '도쿄 1949-07-01 12:00', dt: '1949-07-01 12:00', place: '도쿄, 일본', lon: 139.6917,
    utc: 600, dst: true, guards: '★일본 1948~51 GHQ 서머타임 — 있는 걸 빠뜨리지 않는가' },
  { name: '상하이 2000-07-01 12:00', dt: '2000-07-01 12:00', place: '상하이, 중국', lon: 121.4737,
    offset: 2.18, utc: 480, dst: false, guards: '중국 현행(서머타임 없음)' },
  { name: '상하이 1988-07-01 12:00', dt: '1988-07-01 12:00', place: '상하이, 중국', lon: 121.4737,
    utc: 540, dst: true, guards: '★중국 1986~91 서머타임' },
  { name: '우루무치 2000-07-01 12:00', dt: '2000-07-01 12:00', place: '우루무치, 신장, 중국', lon: 87.6168,
    utc: 480, guards: '★중국은 전역이 UTC+8 — 경도(87°)로 추정하면 +6 이 되어 2시간 틀린다' },
  { name: '시드니 2000-01-15 12:00', dt: '2000-01-15 12:00', place: '시드니, 뉴사우스웨일스, 오스트레일리아',
    lon: 151.2093, lat: -33.8688, offset: -64.45, utc: 660, dst: true,
    guards: '★남반구 — 1월이 서머타임이다(해를 넘기는 구간 판정)' },
  { name: '브리즈번 2000-01-15 12:00 (퀸즐랜드)', dt: '2000-01-15 12:00', place: '브리즈번, 퀸즐랜드, 오스트레일리아',
    lon: 153.0251, lat: -27.4698, utc: 600, dst: false,
    guards: '★같은 나라·같은 날인데 퀸즐랜드는 서머타임이 없다' },
  { name: '뉴델리 2000-07-01 12:00', dt: '2000-07-01 12:00', place: '뉴델리, 인도', lon: 77.209,
    utc: 330, dst: false, guards: '인도는 +5:30 — 30분 단위 표준시(경도 반올림으로는 못 맞힌다)' },
];

// ───────────────────────────────────────────────────────────────────────────
// C. 판정
// ───────────────────────────────────────────────────────────────────────────
let fail = 0;
let pass = 0;

/** 한 건 검사 — 기대값이 적힌 항목만 본다. */
function run(c: Case): void {
  const [dpart, tpart] = c.dt.split(' ');
  const [y, mo, d] = dpart.split('-').map(Number);
  const [h, mi] = tpart.split(':').map(Number);
  const inp = input(c);

  const got: string[] = [];
  const bad: string[] = [];

  if (c.utc !== undefined || c.dst !== undefined) {
    const tz = tzOf(inp, y, mo, d, h, mi);
    if (c.utc !== undefined) {
      got.push(`UTC${tz.offsetMin >= 0 ? '+' : ''}${tz.offsetMin}`);
      if (tz.offsetMin !== c.utc) bad.push(`UTC 오프셋 ${tz.offsetMin} ≠ 기대 ${c.utc}`);
    }
    if (c.dst !== undefined) {
      got.push(tz.dstApplied ? '서머타임' : '표준시');
      if (tz.dstApplied !== c.dst) bad.push(`서머타임 ${tz.dstApplied} ≠ 기대 ${c.dst}`);
    }
  }
  if (c.offset !== undefined) {
    const off = trueSolarOffsetMin(inp, y, mo, d, h, mi);
    got.push(`${off.toFixed(2)}분`);
    if (Math.abs(off - c.offset) > 0.01) bad.push(`보정 ${off.toFixed(2)} ≠ 기대 ${c.offset.toFixed(2)}`);
  }
  if (c.pillars !== undefined) {
    const p = buildSajuChart(inp, 2026).pillars as any;
    const s = `${p['년'].stem}${p['년'].branch} ${p['월'].stem}${p['월'].branch} ${p['일'].stem}${p['일'].branch} ${p['시'].stem}${p['시'].branch}`;
    got.push(s);
    if (s !== c.pillars) bad.push(`팔자 ${s} ≠ 기대 ${c.pillars}`);
  }

  if (bad.length) {
    fail++;
    console.log(`  ❌ ${c.name}`);
    for (const b of bad) console.log(`       ${b}`);
    console.log(`       막으려던 것: ${c.guards}`);
  } else {
    pass++;
    console.log(`  ✅ ${c.name.padEnd(38)} ${got.join(' · ')}`);
  }
}

console.log('\n🕐 시간 보정(진태양시·절기 축) 하네스\n');
console.log('=== A. 한국 회귀 — 2026-08-23 수정 직전 실측값과 같아야 한다 ===');
KOREA.forEach(run);
console.log('\n=== B. 해외 — 표준시·서머타임이 실제와 같은가 ===');
OVERSEAS.forEach(run);

// ───────────────────────────────────────────────────────────────────────────
// D. ★음성 테스트 — "고쳤다"가 진짜인지 **반대쪽에서** 확인한다.
//    옛 버그가 되살아나면 여기가 먼저 운다.
// ───────────────────────────────────────────────────────────────────────────
console.log('\n=== C. 음성 테스트 — 옛 버그로 되돌아가면 반드시 깨진다 ===');

const milanSummer = input(OVERSEAS[0]);
const milanPillars = (() => {
  const p = buildSajuChart(milanSummer, 2026).pillars as any;
  return `${p['시'].stem}${p['시'].branch}`;
})();
if (milanPillars === '壬申') {
  fail++;
  console.log('  ❌ 밀라노 여름 시주가 壬申 — **해외 서머타임을 다시 무시하고 있다**(옛 버그 재발)');
} else {
  pass++;
  console.log(`  ✅ 밀라노 여름 시주 ${milanPillars} — 서머타임이 살아 있다(옛 버그면 壬申)`);
}

const parisTz = tzOf(input(OVERSEAS[2]), 2000, 7, 1, 12, 0);
if (parisTz.stdOffsetMin === 0) {
  fail++;
  console.log('  ❌ 파리 표준시가 UTC+0 — **경도 반올림 추정으로 회귀했다**(프랑스는 CET)');
} else {
  pass++;
  console.log(`  ✅ 파리 표준시 UTC+${parisTz.stdOffsetMin / 60} — 국가 테이블이 경도를 이긴다`);
}

// ★모르는 곳은 **모른다고 표시**되어야 한다 — 넘겨짚어 채우면 틀려도 아무도 모른다.
const unknown = tzOf(
  { birthDateTime: '1990-07-01 12:00', calendar: '양', sex: '여', birthPlace: '어딘가, 알수없는나라', birthLon: 30, timeAccuracy: '정확' } as ChartInput,
  1990, 7, 1, 12, 0,
);
if (unknown.uncertain && unknown.source === 'longitude') {
  pass++;
  console.log('  ✅ 모르는 나라 = 경도 근사 + **확정 불가 표시**(추측해 채우지 않는다)');
} else {
  fail++;
  console.log(`  ❌ 모르는 나라인데 확신하고 있다 — source=${unknown.source} uncertain=${unknown.uncertain}`);
}

console.log(`\n   통과 ${pass} · 실패 ${fail}`);
if (fail) {
  console.log('\n   ⚠️ 시간 보정이 깨졌다. `engine/timezone.ts`(표준시·서머타임 표)와');
  console.log('      `engine/solartime.ts`(경도×4 − UTC오프셋 + 균시차)를 본다.');
  process.exit(1);
}
console.log('   🎯 시간 보정 통과 — 한국 회귀 0 · 해외 표준시/서머타임 정상\n');
