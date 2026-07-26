// scripts/check-decision.ts — 오늘의 결정 도우미 하네스(결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 대상 = `decisionFromEnergy()` **순수 함수**. dailyEnergy 산출물을 픽스처로 주입해 전 분기를 밟는다.
//   (순수 함수라 RN 체인 없이 돈다 — dailyFortune 를 런타임 import 하면 i18n → react-native(Flow) 로
//    tsx 가 파싱 실패한다. 그래서 판정 로직을 의존성 역전으로 떼어 뒀다.)
//
// 지키는 것(이 콘텐츠의 계약):
//   INV1 결정론 — 같은 입력이면 항상 같은 출력(Math.random 혼입 방지).
//   INV2 새 명리 판정 없음 — 판정은 dailyEnergy 신호의 재배열이어야 한다.
//        · score·signals 는 입력을 **그대로 통과**(재계산 금지)
//        · 공망이면 전반·계약·지출·시작이 반드시 'wait'
//          (그 신호의 뜻이 이미 "붕 뜨는 자리라 큰 결정은 미루면 좋아요"다)
//   INV3 완결성 — 유형 5개·빈 문구 없음·알 수 없는 verdict 없음.
//   INV4 §4 안전 — 단정·공포·투자/의료 단정 어휘 금지.
//   INV5 분포 — go/hold/wait 가 모두 나온다(한쪽 고정이면 콘텐츠 가치 0).
//
// 실행: npm run check:decision
// ─────────────────────────────────────────────────────────────────────────
import { decisionFromEnergy, VERDICT_STYLE } from '../app/src/lib/content/decisionToday';

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };

// dailyEnergy 산출물 픽스처 — 실제 타입과 같은 모양(구조 변경 시 typecheck 가 잡는다).
type Sig = { key: string; label: string; kind: 'good' | 'care' };
const SIGS: Record<string, Sig> = {
  cheoneul: { key: 'cheoneul', label: '천을귀인 — 도와주는 사람이 붙는 날', kind: 'good' },
  hap: { key: 'hap', label: '합 — 어우러지고 매듭이 지어지는 결', kind: 'good' },
  dohwa: { key: 'dohwa', label: '도화 — 눈에 띄고 사람이 모이는 결', kind: 'good' },
  yeokma: { key: 'yeokma', label: '역마 — 움직임·이동이 생기는 결', kind: 'good' },
  chung: { key: 'chung', label: '충·형 — 부딪힘이 있어 서두르지 않는 게 좋아요', kind: 'care' },
  gongmang: { key: 'gongmang', label: '공망 — 붕 뜨는 자리라 큰 결정은 미루면 좋아요', kind: 'care' },
};
const mkEnergy = (score: number, keys: string[], favorGood = true): any => ({
  score, group: '비겁', favorGood, strengthType: '중화',
  signals: keys.map((k) => SIGS[k]),
  caution: score >= 68 ? 'low' : score >= 46 ? 'mid' : 'high',
});

const BANNED = ['반드시', '절대', '무조건', '망한다', '위험하니', '투자하세요', '사세요', '질병', '병이 '];
const SIGNAL_SETS: string[][] = [
  [], ['cheoneul'], ['hap'], ['dohwa'], ['yeokma'], ['chung'], ['gongmang'],
  ['cheoneul', 'hap'], ['chung', 'gongmang'], ['cheoneul', 'chung'], ['hap', 'yeokma'],
  ['gongmang', 'cheoneul'], ['chung', 'yeokma'], ['cheoneul', 'hap', 'dohwa', 'yeokma'],
];
const SCORES = [22, 35, 45, 46, 55, 60, 67, 68, 75, 92];

let checked = 0;
const dist: Record<string, number> = { go: 0, hold: 0, wait: 0 };

for (const score of SCORES) {
  for (const keys of SIGNAL_SETS) {
    for (const favor of [true, false]) {
      const e = mkEnergy(score, keys, favor);
      const r1 = decisionFromEnergy(e);
      const r2 = decisionFromEnergy(e);
      checked++;
      dist[r1.verdict]++;
      const at = `score=${score} sig=[${keys.join(',')}] favor=${favor}`;

      // INV1 결정론
      if (JSON.stringify(r1) !== JSON.stringify(r2)) bad(`INV1 비결정론: ${at}`);

      // INV2 입력 통과(재계산 금지)
      if (r1.score !== e.score) bad(`INV2 score 재계산됨: ${at} → ${r1.score}`);
      if (JSON.stringify(r1.signals) !== JSON.stringify(e.signals)) bad(`INV2 signals 변형됨: ${at}`);

      // INV2 공망 = 큰 결정 보류(그 신호의 뜻 그대로)
      if (keys.includes('gongmang')) {
        if (r1.verdict !== 'wait') bad(`INV2 공망인데 전반=${r1.verdict}: ${at}`);
        for (const k of ['contract', 'spend', 'start']) {
          const it = r1.items.find((x) => x.kind === k)!;
          if (it.verdict !== 'wait') bad(`INV2 공망인데 ${k}=${it.verdict}: ${at}`);
        }
      }

      // INV3 완결성
      if (r1.items.length !== 5) bad(`INV3 유형 ${r1.items.length}개: ${at}`);
      if (new Set(r1.items.map((i) => i.kind)).size !== 5) bad(`INV3 유형 중복: ${at}`);
      if (!r1.title.trim() || !r1.reason.trim()) bad(`INV3 빈 title/reason: ${at}`);
      for (const it of r1.items) {
        if (!it.tip.trim()) bad(`INV3 빈 tip(${it.kind}): ${at}`);
        if (!VERDICT_STYLE[it.verdict]) bad(`INV3 알 수 없는 verdict "${it.verdict}": ${at}`);
      }

      // INV4 안전 어휘
      const text = [r1.title, r1.reason, ...r1.items.map((i) => i.tip)].join(' ');
      for (const w of BANNED) if (text.includes(w)) bad(`INV4 금지 어휘 "${w}": ${at}`);
    }
  }
}

// INV5 분포
for (const k of ['go', 'hold', 'wait']) if (!dist[k]) bad(`INV5 '${k}' 판정이 한 번도 안 나옴 — 사실상 고정값`);

console.log(`\n검사 ${checked}건 · 판정 분포 go=${dist.go} hold=${dist.hold} wait=${dist.wait}`);
console.log(fail ? `\n❌ check:decision 실패 ${fail}건` : '\n✅ check:decision 통과 — 결정론·입력통과·공망보류·완결성·안전어휘·분포 OK');
process.exit(fail ? 1 : 0);
