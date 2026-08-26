// scripts/check-birthparse.ts — 대화에서 읽은 생년월일이 **맞는가** (그리고 못 읽은 건 되묻는가)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"명식 등록을 안하고 대화에서 그냥 1994 03 16 유시 이렇게 입력할수도 있잖아
//   그러면 여기서 필요한게 태어난곳 양력 음력 여부 성별 여부니깐 이런걸 되물어야지"*
//
// ■ ★여기서 여덟 글자를 세지 않는다
//   세는 건 엔진이다(절대규칙 1). 파서가 하는 일은 «말한 것을 필드로 옮기고,
//   **무엇이 비었는지** 알려 주는 것»뿐이다. 지어내면 그게 바로 오늘 난 사고다.
//
// ■ ⚠️**틀리게 읽는 것이 못 읽는 것보다 나쁘다**
//   못 읽으면 되묻는다(대화가 이어진다). 틀리게 읽으면 **엉뚱한 사주로 명식이 만들어진다.**
//   ⇒ 음성 테스트는 «안 읽어야 할 것을 안 읽는가» 를 특히 본다(남자친구·연도 아닌 숫자 등).
//
// ★음성 테스트: `npx tsx scripts/check-birthparse.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { parseBirth, missingOf, looksLikeBirthInfo, type BirthDraft } from '../app/src/lib/talk/birthParse';

type Case = { why: string; text: string; want: Partial<BirthDraft>; missing?: string[] };

const CASES: Case[] = [
  // ── Boss 가 실제로 친 말 ────────────────────────────────────────────────
  { why: 'Boss 실제 입력', text: '1994 03 16 유시',
    want: { date: '1994-03-16', time: '18:00', timeAccuracy: '추정' },
    missing: ['calendar', 'sex', 'place'] },
  { why: '한국어 날짜', text: '1994년 3월 16일 오후 6시 30분에 서울에서 태어났어요 남자예요 양력이에요',
    want: { date: '1994-03-16', time: '18:30', timeAccuracy: '정확', calendar: '양', sex: '남', place: '서울' },
    missing: [] },
  { why: '점 구분·음력', text: '1988.11.02 음력 여자 부산에서 태어남',
    want: { date: '1988-11-02', calendar: '음', sex: '여', place: '부산' } },
  { why: '두 자리 연도', text: '94/3/16', want: { date: '1994-03-16' } },
  { why: '2000년대 두 자리', text: '05-7-9', want: { date: '2005-07-09' } },
  { why: '24시각 표기', text: '2001-03-10 17:05', want: { date: '2001-03-10', time: '17:05', timeAccuracy: '정확' } },
  { why: '시간 모름', text: '1994년 3월 16일 태어난 시간은 몰라요',
    want: { date: '1994-03-16', time: null, timeAccuracy: '미상' } },
  { why: '자시', text: '1990년 1월 1일 자시', want: { date: '1990-01-01', time: '00:00' } },
  { why: '해외 출생', text: '1994년 3월 16일 밀라노에서 태어났어요', want: { place: '밀라노' } },

  // ── ⚠️안 읽어야 할 것 ───────────────────────────────────────────────────
  { why: '⚠️남자친구는 본인 성별이 아니다', text: '1994 03 16 남자친구랑 궁합 봐줘', want: { sex: null } },
  { why: '⚠️여친도 마찬가지', text: '여친이랑 잘 맞아요? 1994 03 16', want: { sex: null } },
  { why: '⚠️날짜 아닌 숫자', text: '운 100개 충전했어요', want: { date: null } },
  { why: '⚠️그냥 인사', text: '안녕하세요 오늘 어때요', want: { date: null } },
  { why: '⚠️1900 이전은 안 받는다', text: '1800 03 16', want: { date: null } },
];

function judge(): string[] {
  const bad: string[] = [];
  for (const c of CASES) {
    const got = parseBirth(c.text);
    for (const [k, v] of Object.entries(c.want)) {
      if ((got as any)[k] !== v) bad.push(`${c.why}: ${k} = ${JSON.stringify((got as any)[k])} (기대 ${JSON.stringify(v)}) ← "${c.text}"`);
    }
    if (c.missing) {
      const m = missingOf(got);
      if (JSON.stringify(m) !== JSON.stringify(c.missing)) {
        bad.push(`${c.why}: 되물을 것 [${m}] (기대 [${c.missing}])`);
      }
    }
  }
  // 카드를 띄우는 신호 — 날짜가 있어야만 뜬다
  if (!looksLikeBirthInfo('1994 03 16 유시')) bad.push('looksLikeBirthInfo: 날짜가 있는데 신호가 안 뜬다');
  if (looksLikeBirthInfo('안녕하세요')) bad.push('⚠️looksLikeBirthInfo: 인사에도 카드가 뜬다(가장 흔한 오탐)');
  return bad;
}

const bad = judge();
if (process.argv.includes('--selftest')) {
  // 음성 테스트 = **판정이 실패를 실패로 부르는가**
  const t = (l: string, v: boolean) => { console.log(`  ${v ? '✅' : '❌'} ${l}`); return v; };
  const r = [
    t(`전 케이스 통과 (${CASES.length}개)`, bad.length === 0),
    t('일부러 틀린 기대값은 잡힌다', (() => {
      const g = parseBirth('1994 03 16 유시');
      return g.time === '18:00' && g.time !== '17:00';   // 경계값이 아니라 **중간**이어야 한다
    })()),
    t('⚠️남자친구를 성별로 안 읽는다', parseBirth('1994 03 16 남자친구랑').sex === null),
    t('⚠️인사에는 카드가 안 뜬다', !looksLikeBirthInfo('안녕하세요 오늘 어때요')),
  ];
  const ok = r.every(Boolean);
  if (bad.length) bad.slice(0, 8).forEach((b) => console.log('     · ' + b));
  console.log(ok ? '✅ selftest 통과' : '❌ selftest 실패');
  process.exit(ok ? 0 : 1);
}

if (!bad.length) { console.log(`✅ check:birthparse — ${CASES.length}케이스 통과 (읽기·되묻기·오탐 방지)`); process.exit(0); }
console.error(`❌ check:birthparse — ${bad.length}건\n`);
for (const b of bad) console.error('  ' + b);
process.exit(1);
