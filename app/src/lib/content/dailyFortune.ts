// app/src/lib/dailyFortune.ts — 오늘의 운세: 일진 × 대표 명식 다층 룰 풀이 (무료, 온디바이스 결정론)
// ─────────────────────────────────────────────────────────────────────────
// 오늘 간지를 구하고, 대표 명식(SajuChart)과 엮어 분야별(통합·직업·재물·애정·건강) 풀이를 만든다.
// 내부 룰(전부 결정론·엔진 재사용): ①십신 ②신강약 ③12운성 ④원국×오늘 합충(궁위 라우팅)
//   ⑤공망 ⑥신살(천을귀인·도화·역마·화개) ⑦십신 부재 보충.
// ★출력 원칙(daniel): 본문에 한자·명리 용어 노출 금지 — 명리는 계산에만, 문장은 일상어.
// ★다국어(daniel): 본문 템플릿을 앱 언어(ko/en/ja)로 — 무료·온디바이스라 LLM 0(번역 템플릿).
// §4 가드: 흉 단정 금지(기조+처방), 건강은 관리축만. 문구 stance 검수 = daniel 슬롯.
// 서버·LLM 0 — 무료 티어 = 룰/템플릿 원칙(기획서 §9-5). LLM 딥 통변은 프리미엄 별개.
// ─────────────────────────────────────────────────────────────────────────
import { Solar } from 'lunar-javascript';
import { tenGod, branchTenGod } from '@engine/saju';
import { detectInteractionsAmong, classifyStrength, analyzeTenGods } from '@engine/structure';
import { twelveStage } from '@engine/twelve';
import { analyzeSinsal, gongmang, twelveSinsalAt } from '@engine/sinsal';
import { appLang } from '../i18n';
import type { SajuChart, Stem, Branch, PillarPos, ChartPosition, TenGod } from '@spec/chart';

export function getDailyFortune(offsetDays = 0) {
  const d = new Date();
  if (offsetDays) d.setDate(d.getDate() + offsetDays); // 0=오늘, 1=내일 (오늘↔내일 토글용). 무인자=오늘(호환).
  const solar = (Solar as any).fromDate(d);
  const lunar = solar.getLunar();
  return {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    dayGanZhi: lunar.getDayInGanZhi() as string, // 오늘 일주 간지(干支)
    monthGanZhi: lunar.getMonthInGanZhi() as string,
    yearGanZhi: lunar.getYearInGanZhi() as string,
  };
}

/** 특정 연도의 세운 간지(궁합 연도별 등). 양력 연중(6/15)로 안정 계산. */
export function yearGanZhi(year: number): string {
  return (Solar as any).fromYmd(year, 6, 15).getLunar().getYearInGanZhi() as string;
}

// ── 십신 10 → 5그룹 (오늘 들어오는 기운의 '결' — 내부 분류용, 화면 미노출) ──
type TgGroup = '비겁' | '식상' | '재성' | '관성' | '인성';
const GROUP: Record<string, TgGroup> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상',
  정재: '재성', 편재: '재성', 정관: '관성', 편관: '관성', 정인: '인성', 편인: '인성',
};

// ★반반 보정(daniel 2026-07-08: 오늘/이달이 너무 비관적 → 비관 반·낙관 반).
//   기존엔 !favorGood(오늘 기운이 신강약에 버거운 날)이면 work/money/love/health 4영역 *전부*에 gate 주의가 붙어 하루가 '다 조심'으로 기울었다.
//   → 그 날 기운(group)이 *실제로 부담 주는 영역에만* 주의를 붙이고 나머지는 긍정 기조 유지 = 하루가 '어떤 건 좋고 어떤 건 조심'으로 균형(명리 정합).
//   매핑(!favorGood 문맥 = 그 group 이 신강약에 불리): 겁재 지출(재물)·설기 소모(건강)·재다신약(재물+처관계)·관살 압박(일+스트레스)·인다 지연(실행력=직업).
const GATE_AREAS: Record<TgGroup, Array<'work' | 'money' | 'love' | 'health'>> = {
  비겁: ['money'],
  식상: ['health'],
  재성: ['money', 'love'],
  관성: ['work', 'health'],
  인성: ['work'],
};

// ── 오늘의 기운 한 줄 타이틀(홈 배너) — [머리말]×[주제]×[서술] 조합 + 일진·명식 시드로 매일 다른 한 줄(1000+ 변형) ──
//   톤별 풀로 길흉·명리 정합 유지(good=길 / care=조심·전향적 / 신살=특화). §4: 조심 톤도 공포 없이('~하면 좋은').
//   결정론(같은 날·같은 명식 = 같은 타이틀): Math.random 금지 — 일진(干支)+일간 해시 시드. stance·문구 daniel 검수 슬롯.
type HlLang = 'ko' | 'en' | 'ja';
function hlHash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function hlPick<T>(arr: T[], seed: number): T { return arr[((seed % arr.length) + arr.length) % arr.length]; } // 음수 시드 방어(undefined 방지)
// 머리말(ko/ja만 변주 — en은 'A day' 고정)
const HL_LEAD: Record<'day' | 'month', Record<HlLang, string[]>> = {
  day:   { ko: ['', '오늘은 ', '왠지 ', '가만히 보면 '], en: [''], ja: ['', '今日は', 'なんだか', 'ふと見ると'] },
  month: { ko: ['', '이번 달은 ', '왠지 ', '가만히 보면 '], en: [''], ja: ['', '今月は', 'なんだか', 'ふと見ると'] },
};
// 좋은 날(good): [영역 주어] + [긍정 서술] (+ 하루). 그룹별 주어 풀.
const HL_GOOD_SUBJ: Record<string, Record<HlLang, string[]>> = {
  비겁: { ko: ['든든한 내 편이', '함께할 사람이', '나의 의지가', '추진력이', '자신감이'], en: ['allies', 'your resolve', 'your drive', 'a trusted friend'], ja: ['心強い味方が', '仲間が', '意志が', '推進力が'] },
  식상: { ko: ['타고난 재능이', '재치가', '표현력이', '활력이', '아이디어가'], en: ['your talent', 'your wit', 'your spark', 'fresh ideas'], ja: ['才能が', '機知が', '表現力が', '活力が'] },
  재성: { ko: ['재물운이', '금전운이', '좋은 기회가', '결실이', '풍요가'], en: ['good fortune', 'opportunity', 'abundance', 'your luck'], ja: ['財運が', '金運が', 'チャンスが', '実りが'] },
  관성: { ko: ['노력의 결실이', '인정받을 일이', '좋은 자리가', '성취가', '책임감이'], en: ['recognition', 'your effort', 'a good role', 'achievement'], ja: ['努力の実りが', '評価が', '良い地位が', '達成が'] },
  인성: { ko: ['귀인이', '배움의 기회가', '마음의 안정이', '좋은 인연이', '직관이'], en: ['a mentor', 'a chance to learn', 'inner calm', 'good ties'], ja: ['貴人が', '学びが', '心の安定が', '良い縁が'] },
};
const HL_GOOD_TAIL: Record<HlLang, string[]> = {
  ko: ['활짝 열리는', '따르는', '빛나는', '무르익는', '함께하는', '깃드는', '솟아나는', '반짝이는', '곳곳에 닿는', '결실을 맺는', '술술 풀리는', '나를 밀어주는', '문을 여는', '제 편이 되어 주는'],
  en: ['opens up', 'follows you', 'shines', 'ripens', 'is with you', 'comes through', 'lifts you', 'bears fruit', 'reaches everywhere', 'flows your way'],
  ja: ['花開く', '味方する', '輝く', '実る', '寄り添う', '湧き上がる', '行き渡る', '後押しする', '実を結ぶ', 'すらすら運ぶ'],
};
// 조심할 날(care): [다스릴 것] + [전향 서술] (+ 하루). 공포·단정 없이.
const HL_CARE_OBJ: Record<string, Record<HlLang, string[]>> = {
  비겁: { ko: ['고집을', '욕심을', '경쟁심을'], en: ['stubbornness', 'rivalry', 'ego'], ja: ['意地を', '欲を', '張り合いを'] },
  식상: { ko: ['말을', '벌인 일을', '들뜬 마음을'], en: ['careless words', 'overreach', 'restlessness'], ja: ['言葉を', '広げすぎた事を', '浮つきを'] },
  재성: { ko: ['지출을', '욕심을', '조급함을'], en: ['spending', 'greed', 'impatience'], ja: ['出費を', '欲を', '焦りを'] },
  관성: { ko: ['부담을', '무리함을', '조급함을'], en: ['pressure', 'overwork', 'haste'], ja: ['負担を', '無理を', '焦りを'] },
  인성: { ko: ['혼자 짊어진 짐을', '복잡한 생각을', '걱정을'], en: ['burdens carried alone', 'tangled thoughts', 'worry'], ja: ['一人で抱えた荷を', '考え過ぎを', '心配を'] },
};
const HL_CARE_TAIL: Record<HlLang, string[]> = {
  ko: ['잠시 내려놓으면 좋은', '다스리면 가벼운', '덜어내면 편안한', '비우면 맑아지는', '천천히 가면 되는', '한 박자 늦추면 풀리는', '욕심 내려놓으면 순해지는', '돌아보면 가벼워지는', '한 김 식히면 보이는', '서두르지 않으면 무난한'],
  en: ['to ease', 'to set down for now', 'to lighten', 'to take slow', 'to slow a beat', 'softer when you let go', 'clearer when you pause'],
  ja: ['手放すと良い', '抑えると軽い', '減らすと楽な', 'ゆっくり進む', '一拍遅らせると解ける', '欲を手放すと和らぐ', '一息おくと見える'],
};
// 신살·작용(특화) — 완성 서술구 풀(주제 포함). 우선순위로 분기.
const HL_SPECIAL: Record<string, Record<HlLang, string[]>> = {
  cheoneul: { ko: ['귀인이 손 내미는', '뜻밖의 도움이 닿는', '고마운 인연이 함께하는', '막힌 데를 풀어 줄 사람을 만나는', '윗사람의 인정이 따르는', '곤란할 때 손잡아 줄 이가 있는', '귀한 자리에 부름받는'], en: ['a helping hand finds you', 'unexpected help arrives', 'a kind soul stands by you', 'someone opens a closed door for you', 'elders favor you', 'support arrives just in time'], ja: ['貴人が手を差し伸べる', '思わぬ助けが届く', 'ありがたい縁が寄り添う', '行き詰まりを解く人に出会う', '目上の引き立てがある', '困った時に支えがある'] },
  chung: { ko: ['변화의 바람이 부니 침착하면 좋은', '크고 작은 변동이 따르는', '자리바꿈이 있을 수 있는', '익숙한 틀을 한번 흔드는', '오래 미룬 결단을 내리게 되는', '안 하던 일을 시도하게 되는', '한번 부딪고 도리어 정리되는'], en: ['change is in the air — stay steady', 'shifts may come, keep calm', 'a reshuffle may come', 'the familiar frame gets shaken', 'a long-delayed decision lands', 'you try something you never did'], ja: ['変化の風が吹く', '変動が伴う', '配置換えがありうる', '慣れた枠が一度揺れる', '先延ばしの決断を下す', 'やらなかった事に挑む'] },
  hap: { ko: ['사람과 일이 어우러지는', '좋은 인연이 이어지는', '뜻이 맞아 술술 풀리는', '협력이 결실로 이어지는', '오해가 풀리고 가까워지는', '손발이 척척 맞는'], en: ['people and plans come together', 'good ties carry on', 'things click into place', 'cooperation bears fruit', 'distance closes warmly'], ja: ['人と物事がまとまる', '良い縁が続く', '息が合って進む', '協力が実る', '誤解が解け近づく'] },
  yeokma: { ko: ['움직임과 변화가 따르는', '새 길이 열리는', '길 위에서 기회를 만나는', '멀리서 좋은 소식이 오는', '떠나 보면 답이 보이는', '바깥 활동이 잘 풀리는'], en: ['movement and change follow', 'a new path opens', 'opportunity on the move', 'good news from afar', 'answers come once you set out'], ja: ['動きと変化が伴う', '新しい道が開く', '道中で機会に出会う', '遠方から朗報が届く', '出てみると答えが見える'] },
  dohwa: { ko: ['사람과 인연이 끌리는', '매력이 빛나는', '좋은 만남이 있을', '시선을 한 몸에 받는', '인기가 따르는', '마음이 통하는 사람을 만나는'], en: ['charm and connection draw near', 'your charm shines', 'a good encounter awaits', 'all eyes turn to you', 'popularity follows'], ja: ['人との縁が引き寄せられる', '魅力が輝く', '良い出会いがありそうな', '注目を集める', '人気が集まる'] },
  gongmang: { ko: ['마음 비우고 재정비하기 좋은', '한 박자 쉬어가기 좋은', '욕심을 내려놓으면 가벼운', '큰일은 미루고 정리에 좋은', '속을 비우니 도리어 맑아지는', '무리하지 않으면 편안한'], en: ['to clear your mind and reset', 'to pause and breathe', 'lighter when you let go', 'a day to tidy, not to launch', 'clearer once you empty out'], ja: ['心を整え直すのに良い', '一息つくのに良い', '欲を手放すと軽い', '大事は控え整理に良い', '空けるほど澄む'] },
};
// 언어별 결합 — ko: '주제 서술', en: 주어+자동사 / 'to+동사+목적', ja: 결합.
function hlComposeGood(subj: string, tail: string, lang: HlLang): string {
  return lang === 'ja' ? `${subj}${tail}` : `${subj} ${tail}`; // en: 'fortune shines'
}
function hlComposeCare(obj: string, tail: string, lang: HlLang): string {
  if (lang === 'en') return `to ${tail.replace(/^to /, '')} ${obj}`; // 'to ease spending'
  return lang === 'ja' ? `${obj}${tail}` : `${obj} ${tail}`;          // '지출을 다스리면 가벼운'
}
function hlWrap(lead: string, body: string, lang: HlLang, period: 'day' | 'month'): string {
  if (lang === 'en') return `${period === 'month' ? 'A month' : 'A day'} ${body}`; // 머리말 미사용(어순)
  if (lang === 'ja') return `${lead}${body}${period === 'month' ? 'ひと月' : '一日'}`;
  return `${lead}${body} ${period === 'month' ? '한 달' : '하루'}`;
}

/** 오늘의 기운 타이틀 — 신살·작용 우선, 없으면 십신 그룹×길흉(신강약). 풀 조합 + 일진·명식 시드로 1000+ 변형. 온디바이스. */
export function dailyHeadline(saju: SajuChart, todayStem: Stem, todayBranch: Branch, period: 'day' | 'month' = 'day'): string {
  const me = saju.dayMaster.stem;
  const P = saju.pillars;
  const group = GROUP[tenGod(me, todayStem)];
  const sc = classifyStrength(saju);
  const strong = sc.type === '신왕' || sc.type === '신강';
  const weak = sc.type === '신약';
  // 오늘(일운)이 원국 지지와 만드는 작용(합·충·형)
  const POS: PillarPos[] = ['년', '월', '일', '시'];
  const items = [
    ...POS.map((p) => ({ pos: p as ChartPosition, stem: P[p].stem, branch: P[p].branch })),
    { pos: '일운' as ChartPosition, stem: todayStem, branch: todayBranch },
  ];
  const links = detectInteractionsAmong(items).filter((it) => it.members.includes('일운') && it.level !== '천간');
  // ★C1(daniel): 충/형 특화 헤드라인은 고지(개고)·통근 자리를 칠 때만 — 일 단위 개고 과발화 방지(그 외엔 십신 그룹 헤드라인으로 통과).
  const hasChung = links.some((it) => (it.type === '충' || it.type === '형') && it.members.some((m) => m !== '일운' && isSignificantClash(P, m as PillarPos)));
  const hasHap = links.some((it) => it.type === '합');
  const [g1, g2] = gongmang(P['일'].stem, P['일'].branch);
  const isGm = todayBranch === g1 || todayBranch === g2;
  const sin = analyzeSinsal(saju);
  const hasCheonEul = !!sin.sinsal.find((s) => s.name === '천을귀인')?.glyphs.includes(todayBranch);
  const tw = new Set([twelveSinsalAt(P['년'].branch, todayBranch), twelveSinsalAt(P['일'].branch, todayBranch)]);
  // 신강약 대비 오늘 기운이 우호적인가(간이 억부) — 길(good)/조심(care) 변별
  const favorGood = weak ? (group === '비겁' || group === '인성')
    : strong ? (group === '식상' || group === '재성' || group === '관성')
    : true; // 중화 = 대체로 순(good)
  const lang = appLang() as HlLang;
  // 같은 날·같은 명식 = 같은 타이틀(결정론). 슬롯마다 다른 비트로 독립 선택.
  const seed = hlHash(`${todayStem}${todayBranch}${me}`);
  const lead = hlPick(HL_LEAD[period][lang], seed >>> 11);
  // 신살·작용 특화(우선): 천을귀인 > 충/형 > 합 > 역마 > 도화 > 공망
  const special = hasCheonEul ? 'cheoneul' : hasChung ? 'chung' : hasHap ? 'hap'
    : tw.has('역마') ? 'yeokma' : tw.has('도화') ? 'dohwa' : isGm ? 'gongmang' : null;
  if (special) {
    const body = hlPick(HL_SPECIAL[special][lang] ?? HL_SPECIAL[special].ko, seed);
    return hlWrap(lead, body, lang, period);
  }
  // 십신 그룹 × 길흉 조합
  if (favorGood) {
    const subj = hlPick((HL_GOOD_SUBJ[group] ?? HL_GOOD_SUBJ['비겁'])[lang], seed);
    const tail = hlPick(HL_GOOD_TAIL[lang], seed >>> 5);
    return hlWrap(lead, hlComposeGood(subj, tail, lang), lang, period);
  }
  const obj = hlPick((HL_CARE_OBJ[group] ?? HL_CARE_OBJ['비겁'])[lang], seed);
  const ctail = hlPick(HL_CARE_TAIL[lang], seed >>> 5);
  return hlWrap(lead, hlComposeCare(obj, ctail, lang), lang, period);
}

// ── 홈 미리보기 본문(2문장 조합형) — 타이틀처럼 일진 시드로 매일·오늘≠내일 다르게(API 0·온디바이스). ──
//   [기운 묘사 PV_OPEN]×[처방 PV_GOOD/PV_CARE](그룹×길흉). 같은 그룹이라도 일진 시드로 문장이 달라짐.
//   ★문구 stance = daniel 검수 슬롯(전향적·일상어·흉 단정 금지, §4).
const PV_OPEN: Record<string, Record<HlLang, string[]>> = {
  비겁: { ko: ['내 페이스와 추진력이 살아나는 기운이에요.', '의지와 자신감이 단단해지는 하루예요.', '함께할 사람의 기운이 도는 날이에요.', '주도적으로 밀고 나갈 힘이 붙는 기운이에요.'], en: ['Your drive and resolve come alive today.', 'A day to lead and push forward.'], ja: ['推進力と意志が活きる気の日。', '主導して進める力がつく日。'] },
  식상: { ko: ['표현력과 아이디어가 살아나는 기운이에요.', '말문이 트이고 재치가 도는 하루예요.', '새로운 시도가 잘 붙는 기운이에요.', '하고 싶은 걸 꺼내기 좋은 날이에요.'], en: ['Your ideas and expression flow today.', 'A day when words come easily.'], ja: ['表現力とアイデアが冴える日。', '言葉がすらすら出る日。'] },
  재성: { ko: ['실속과 결실을 챙기기 좋은 기운이에요.', '눈에 보이는 성과로 이어지는 하루예요.', '돈과 기회의 흐름이 또렷해지는 날이에요.', '벌여 둔 일을 거두기 좋은 기운이에요.'], en: ['A day to secure results and substance.', 'Your sense for money and chances sharpens.'], ja: ['実りと実利を掴みやすい日。', 'お金とチャンスの流れが明確な日。'] },
  관성: { ko: ['책임과 역할이 또렷해지는 기운이에요.', '인정받을 일이 따르는 하루예요.', '맡은 일에 무게가 실리는 날이에요.', '체계와 신뢰를 쌓기 좋은 기운이에요.'], en: ['Responsibility and your role come into focus.', 'A day that brings recognition.'], ja: ['責任と役割がはっきりする日。', '評価が伴う日。'] },
  인성: { ko: ['차분히 배우고 정리하기 좋은 기운이에요.', '마음이 가라앉고 안정되는 하루예요.', '귀인과 정보가 닿는 날이에요.', '기반을 다지기 좋은 기운이에요.'], en: ['A good day to learn and organize calmly.', 'Your mind settles and steadies.'], ja: ['落ち着いて学び整えるのに良い日。', '心が静まり安定する日。'] },
};
const PV_GOOD: Record<string, Record<HlLang, string[]>> = {
  비겁: { ko: ['혼자 다 하기보다 역할을 나누면 더 멀리 가요.', '같은 목표의 사람과 손잡으면 시너지가 나요.', '미뤄 둔 일을 오늘 밀어붙이면 수월하게 풀려요.'], en: ['Share the load and you go further.', 'Team up with the like-minded for synergy.'], ja: ['役割を分ければもっと遠くへ進めます。', '同じ目標の人と組むと相乗効果が出ます。'] },
  식상: { ko: ['떠오른 생각 하나를 가볍게 꺼내 보면 반응이 따라와요.', '완벽하게 다듬기보다 일단 시작하는 쪽이 기회를 만들어요.', '미뤄 둔 이야기를 먼저 꺼내면 술술 풀려요.'], en: ['Float one idea and a response follows.', 'Starting beats perfecting today.'], ja: ['思いついた一つを軽く出すと反応が返ります。', '完璧より、まず始める方が機会を生みます。'] },
  재성: { ko: ['한 가지에 집중하면 결실이 또렷해져요.', '오늘 끝낼 일 하나를 정하고 시작해 보세요.', '작은 성과를 놓치지 말고 챙기면 이득이에요.'], en: ['Focus on one thing and results sharpen.', 'Pick one task to finish today.'], ja: ['一つに集中すると実りが明確になります。', '今日終える事を一つ決めて始めましょう。'] },
  관성: { ko: ['새 일을 벌이기보다 맡은 걸 매듭지으면 신뢰가 쌓여요.', '약속과 마감을 먼저 챙기면 부담이 기회로 바뀌어요.', '정공법으로 가는 게 가장 빠른 날이에요.'], en: ['Wrap up what you hold and trust builds.', 'Handle promises first and pressure turns to chance.'], ja: ['新しく広げるより、抱えた事を仕上げると信頼が積もります。', '約束と締切を先に片付けると好機に変わります。'] },
  인성: { ko: ['공부·문서·계획이 잘 붙으니 정리해 두세요.', '조언을 구하면 막힌 데가 풀려요.', '오늘 다져 둔 것이 다음 며칠을 편하게 해 줘요.'], en: ['Study and plans stick — note them down.', 'Ask for advice and blocks clear.'], ja: ['勉強・計画がよく身につくので整理を。', '助言を求めると詰まりが解けます。'] },
};
const PV_CARE: Record<string, Record<HlLang, string[]>> = {
  비겁: { ko: ['고집이나 경쟁심은 한 김 식히면 한결 가벼워요.', '욕심을 한 박자 내려놓으면 순하게 풀려요.', '괜한 자존심 싸움만 피하면 무난한 하루예요.'], en: ['Cool the ego a touch and it eases.', 'Skip needless rivalry for a smooth day.'], ja: ['意地は一息おくと軽くなります。', '無用な張り合いを避ければ穏やかな日。'] },
  식상: { ko: ['벌인 일이 많다면 하나만 골라 마무리해 보세요.', '들뜬 말은 한 박자 천천히 하면 좋아요.', '새로 벌이기보다 있는 걸 다듬는 게 나아요.'], en: ['Pick one thing to finish if you spread thin.', 'Say flighty words a beat slower.'], ja: ['広げ過ぎなら一つに絞って仕上げましょう。', '浮ついた言葉は一拍ゆっくり。'] },
  재성: { ko: ['큰 지출은 결제 전에 한 번만 더 생각해 보세요.', '조급함을 내려놓으면 오히려 실속이 와요.', '욕심보다 지킬 걸 지키는 게 버는 길이에요.'], en: ['Think twice before a big spend.', 'Let go of haste and substance comes.'], ja: ['大きな出費は決済前にもう一度。', '焦りを手放すとかえって実りが来ます。'] },
  관성: { ko: ['부담은 혼자 안고 가지 말고 나눠 보세요.', '무리한 일정은 줄이고 핵심만 챙기세요.', '압박이 느껴질 땐 천천히 호흡을 골라 보세요.'], en: ['Share the burden, don’t carry it alone.', 'Trim the schedule to the essentials.'], ja: ['負担は一人で抱えず分けましょう。', '予定を要点だけに絞って。'] },
  인성: { ko: ['혼자 짊어진 짐을 잠시 내려놓아도 괜찮아요.', '복잡한 생각은 한 김 식히면 맑아져요.', '큰일은 미루고 정리·휴식에 쓰기 좋은 날이에요.'], en: ['Set down the load you carry alone for now.', 'A day to tidy and rest, not to launch.'], ja: ['一人で抱えた荷を一旦下ろしても大丈夫。', '大事は控え、整理と休息に良い日。'] },
};
function pvJoin(open: string, body: string, lang: HlLang): string {
  return lang === 'ja' ? `${open}${body}` : `${open} ${body}`; // ja=붙임 / ko·en=공백
}

/** 홈 미리보기 본문 — 그룹×길흉×일진 시드 조합(2문장). 매일·오늘≠내일 다르게. 온디바이스(LLM 0). */
export function dailyPreview(saju: SajuChart, todayStem: Stem, todayBranch: Branch): string {
  const me = saju.dayMaster.stem;
  const group = GROUP[tenGod(me, todayStem)];
  const sc = classifyStrength(saju);
  const strong = sc.type === '신왕' || sc.type === '신강';
  const weak = sc.type === '신약';
  // 신강약 대비 오늘 기운이 우호적인가(dailyHeadline 과 동일 간이 억부)
  const favorGood = weak ? (group === '비겁' || group === '인성')
    : strong ? (group === '식상' || group === '재성' || group === '관성')
    : true;
  const lang = appLang() as HlLang;
  const seed = hlHash(`${todayStem}${todayBranch}${me}pv`); // 일진+일간 시드(결정론·매일 다름)
  const open = hlPick((PV_OPEN[group] ?? PV_OPEN['비겁'])[lang], seed);
  const bodyPool = favorGood ? (PV_GOOD[group] ?? PV_GOOD['비겁'])[lang] : (PV_CARE[group] ?? PV_CARE['비겁'])[lang];
  const body = hlPick(bodyPool, seed >>> 9); // 본문은 다른 비트로 독립 선택(open과 다른 변주)
  return pvJoin(open, body, lang);
}

export type DailyAreaKey = 'general' | 'work' | 'money' | 'invest' | 'love' | 'health';
export const DAILY_AREA_KEYS: DailyAreaKey[] = ['general', 'work', 'money', 'love', 'health']; // 오늘/이달 노출 5분야(투자 제외 — daniel 07-04. getDailyReading은 invest 계산하나 화면 미노출)

// ── 언어별 템플릿 묶음 (ko/en/ja) — 본문은 앱 언어로. group/stage/type/pos 키는 내부(엔진 산출) 고정. ──
type Lang = 'ko' | 'en' | 'ja';
type Bundle = {
  area: Record<'general' | 'work' | 'money' | 'love' | 'health', Record<TgGroup, string>>; // 온디바이스 템플릿 5분야(투자는 재물+주의로 파생 — daniel #17)
  stage: Record<string, string>;                             // 12운성 → 에너지 결
  posArea: Record<string, string>;                           // 궁위 → 삶의 영역 라벨
  link: (type: string, pos: string) => string;               // 합충 → 일상어
  absent: Record<TgGroup, string>;                           // 부재 십신 보충
  strength: (strong: boolean, weak: boolean, favor: boolean) => string;
  sub: (areaSub: string) => string;                          // '그 아래로는 … 흐름도'
  areaSub: Record<TgGroup, string>;
  threeUnite: string; gm: string; gmMoney: string; cheonEul: string; hwagae: string;
  yeokma: string; dohwa: string; moneyBijeop: string; healthLow: string;
  investCaution: string;                                      // 투자 분야 주의(daniel #17 — 흐름·타이밍 관점만, 종목·매수 조언 아님)
  polarity: Partial<Record<TenGod, string>>;                  // ★C3(daniel): 오늘 기운 正/偏·식/상 결 한 줄(5-lump 복구 — 칠살·상관 등). general 에 덧댐
  sangGwanGyeonGwan: string;                                  // ★C3(daniel): 상관견관(오늘 상관 + 원국 정관) — 윗사람·규칙 마찰 주의(직업)
  gate: Record<'work' | 'money' | 'love' | 'health', string>; // ★테마A(daniel): 억부 게이트 — 오늘 기운이 신강약 대비 버거울 때(!favorGood) 분야별 균형 한 줄
};

const KO: Bundle = {
  area: {
    general: {
      비겁: '내 페이스가 살아나는 날이에요. 추진력이 붙는 만큼 주변과 보폭을 맞추는 게 관건인데, 같은 목표를 가진 사람과는 시너지가 나고 괜한 자존심 싸움은 손해예요. 혼자 다 하려 하지 말고 역할을 나눠 보세요.',
      식상: '말과 아이디어가 잘 풀리는 날이에요. 머릿속에만 있던 생각을 꺼내 놓으면 반응이 오고, 새로운 시도를 가볍게 해 보기에도 좋아요. 떠오른 것들은 메모해 두고 하나는 오늘 바로 실행해 보세요.',
      재성: '결과와 실속을 챙기기 좋은 날이에요. 벌여 놓은 일을 마무리 짓고 눈에 보이는 성과로 연결하기 좋은 흐름이라, 이것저것보다 한 가지에 집중할 때 결실이 분명해져요. 오늘 끝낼 일 하나를 정하고 시작하세요.',
      관성: '해야 할 일이 또렷해지는 날이에요. 주변의 기대나 평가가 느껴질 수 있지만 부담보다는 기회에 가까워요. 새 일을 벌이기보다 맡은 일을 깔끔하게 매듭지으면 신뢰가 쌓입니다.',
      인성: '차분히 배우고 정리하기 좋은 날이에요. 속도를 내기보다 기반을 다지는 데 어울리는 흐름이라, 공부·문서·계획 같은 일이 잘 붙어요. 오늘 정리해 둔 것이 다음 며칠을 편하게 만들어 줍니다.',
    },
    work: {
      비겁: '혼자 끌고 가기보다 함께 갈 때 풀리는 날이에요. 동료나 파트너와 역할을 나누면 속도가 붙고, 경쟁 상대조차 자극제가 돼요. 다만 공을 나누는 데 인색하면 잡음이 생기니 먼저 인정해 주세요.',
      식상: '기획·제안·발표처럼 보여주는 일에 힘이 실리는 날이에요. 묵혀 둔 아이디어가 있다면 오늘 꺼내 보세요. 완벽하게 다듬는 것보다 일단 공유하는 쪽이 기회를 만듭니다.',
      재성: '실무가 손에 잘 잡히는 날이에요. 처리한 일을 눈에 보이는 결과물로 정리하면 평가로 이어지기 좋아요. 회의보다 실행, 말보다 결과로 보여주기에 알맞은 하루예요.',
      관성: '책임이 분명해지는 날이에요. 보고·마감·약속을 먼저 챙기면 압박이 오히려 기회로 바뀌어요. 윗사람이나 조직과 얽힌 일은 정공법이 가장 빠릅니다.',
      인성: '검토와 준비에 어울리는 날이에요. 새 일을 벌이기보다 문서·계약·계획을 차분히 들여다보면 놓친 것이 보여요. 배우는 자리나 조언을 구하는 자리도 도움이 됩니다.',
    },
    money: {
      비겁: '나가는 돈이 같이 움직이기 쉬운 날이에요. 모임이나 함께 쓰는 자리에서 예산을 미리 정해 두면 새지 않아요. 빌려주거나 보증 서는 일은 오늘은 미루는 게 좋아요.',
      식상: '벌이로 이어질 씨앗을 심는 날이에요. 내 아이디어나 재능이 수입이 될 수 있는 흐름이니 작게라도 시도해 보세요. 당장 큰돈보다 가능성을 확인하는 데 의미가 있어요.',
      재성: '돈 흐름이 또렷해지는 날이에요. 거래·정산·협상처럼 숫자가 오가는 일에 유리한데, 그만큼 충동구매 욕구도 같이 커져요. 큰 지출은 결제 전에 한 번만 더 생각하세요.',
      관성: '지킬 것을 지키는 게 돈 버는 길인 날이에요. 고정비·약정·세금 같은 것을 점검하기 좋고, 안정적인 선택이 결과적으로 이득이에요. 무리한 투자 권유는 한 걸음 물러나 보세요.',
      인성: '정보가 곧 돈이 되는 날이에요. 계약서나 증빙, 돈 계획을 정리해 두면 나중에 큰 차이를 만들어요. 결정보다 알아보고 비교하는 데 쓰기 좋은 하루예요.',
    },
    love: {
      비겁: '친구처럼 편안한 기류가 흐르는 날이에요. 함께 보내는 시간 자체가 관계를 단단하게 만들어요. 다만 이기려 드는 말투가 나오기 쉬우니 한 번씩 져 주는 여유를 보여 주세요.',
      식상: '마음 표현이 자연스러워지는 날이에요. 먼저 연락하고 먼저 말해 보세요 — 표현한 만큼 가까워져요. 혼자라면 새로운 만남의 자리에 나가 보기 좋은 흐름이에요.',
      재성: '챙겨 주는 마음이 통하는 날이에요. 거창한 이벤트보다 작은 선물이나 실질적인 배려가 상대의 마음을 움직여요. 말보다 행동으로 보여 주세요.',
      관성: '관계의 무게를 확인하게 되는 날이에요. 약속을 지키고 책임 있는 모습을 보이는 것이 가장 큰 매력이 돼요. 애매했던 관계라면 서로의 진심을 확인하기 좋은 타이밍이에요.',
      인성: '들어주는 것이 사랑이 되는 날이에요. 상대의 이야기를 끝까지 들어주는 것만으로 신뢰가 깊어져요. 오래된 추억을 함께 꺼내 보는 것도 관계를 따뜻하게 해요.',
    },
    health: {
      비겁: '몸을 움직이고 싶어지는 날이에요. 운동하기엔 좋지만 승부욕이 붙어 과해지기 쉬우니, 끝나는 시간을 미리 정해 두세요. 충분한 수분과 스트레칭도 잊지 마세요.',
      식상: '기분 전환이 곧 건강이 되는 날이에요. 가볍게 걷고 수다 떨고 웃는 것이 최고의 컨디션 관리예요. 다만 늦은 밤 야식이나 과식은 다음 날까지 무겁게 남아요.',
      재성: '에너지 소모가 큰 날이에요. 일정 사이사이 짧은 휴식을 끼워 넣어야 페이스가 유지돼요. 커피로 버티기보다 10분 눈 감는 쪽이 효과적이에요.',
      관성: '긴장이 몸에 쌓이기 쉬운 날이에요. 어깨와 목을 자주 풀어 주고, 압박감이 느껴질 땐 천천히 호흡을 골라 보세요. 퇴근 후엔 일 생각을 내려놓는 연습이 필요해요.',
      인성: '쉼이 보약인 날이에요. 잠과 휴식의 질을 챙기기 좋은 흐름이라, 일찍 쉬는 것이 내일의 능률로 돌아와요. 따뜻한 차 한 잔과 함께 하루를 정리해 보세요.',
    },
  },
  stage: {
    장생: '전체적인 컨디션은 오름세예요 — 새로 시작하는 일에 활력이 붙어요.',
    관대: '전체적인 컨디션은 오름세예요 — 일을 벌이고 나서기에 좋은 기세예요.',
    건록: '컨디션이 탄탄한 날이에요 — 제 실력이 그대로 나와요.',
    제왕: '기세가 가장 좋은 날이에요 — 중요한 일을 오늘 앞쪽에 배치해 보세요.',
    목욕: '감정이 평소보다 출렁일 수 있어요 — 즉흥적인 결정만 조심하면 돼요.',
    태: '구상과 준비에 알맞은 날이에요 — 서두르지 않아도 괜찮아요.',
    양: '준비를 마치고 때를 기다리는 흐름이에요 — 내일을 위한 세팅에 좋아요.',
    쇠: '에너지를 아껴 쓰는 게 좋은 날이에요 — 무리한 약속은 줄여 보세요.',
    병: '컨디션 관리가 필요한 날이에요 — 일정을 가볍게 가져가세요.',
    사: '마무리에 어울리는 날이에요 — 새 일보다 매듭짓기에 힘을 쓰세요.',
    묘: '차분히 가라앉는 흐름이에요 — 정리하고 묵혀 두기에 좋은 날이에요.',
    절: '재충전이 필요한 날이에요 — 쉬어 가는 것이 곧 능률이에요.',
  },
  posArea: { 년: '웃어른·집안', 월: '직장·일터', 일: '가까운 사람', 시: '아랫사람·진행 중인 일' },
  link: (type, pos) => {
    switch (type) {
      case '합': return `오늘은 ${pos} 쪽과 죽이 잘 맞아요 — 부탁이나 협의를 꺼내기 좋은 타이밍이에요.`;
      case '충': return `${pos} 쪽에 변동 기류가 있어요 — 일정이 바뀌거나 부딪힐 수 있으니 여유를 두고, 말은 한 박자 천천히 하세요.`;
      case '형': return `${pos} 쪽 일이 살짝 꼬일 수 있어요 — 원칙과 절차를 지키는 것이 가장 빠른 길이에요.`;
      default: return `${pos} 쪽에서 사소한 어긋남이 생길 수 있어요 — 크게 번질 일은 아니니 가볍게 넘기세요.`;
    }
  },
  absent: {
    비겁: '평소 혼자 해내던 일에 오늘은 함께할 사람이 생겨요 — 모처럼 기대도 괜찮아요.',
    식상: '평소 표현이 잘 안 됐다면 오늘은 말문이 트이는 날이에요 — 미뤄 둔 이야기를 꺼내 보세요.',
    재성: '평소 손에 잘 안 잡히던 실속이 오늘은 챙겨져요 — 작은 결실을 놓치지 마세요.',
    관성: '평소 애매하던 역할과 책임이 오늘은 또렷해져요 — 정리하기 좋은 기회예요.',
    인성: '평소 아쉽던 도움과 정보가 오늘은 들어와요 — 조언을 구하면 답이 보여요.',
  },
  strength: (strong, weak, favor) => {
    if (strong) return favor
      ? '타고난 에너지가 강한 편인데 오늘 비슷한 기운이 더해져요 — 의욕이 과속이 되지 않게, 운동이나 몰입할 일에 힘을 풀어 주면 하루가 매끄러워요.'
      : '쌓아 둔 힘을 쓰기 좋은 날이에요 — 미뤄 둔 일을 오늘 처리하면 생각보다 수월하게 풀려요.';
    if (weak) return favor
      ? '평소보다 기운이 차오르는 날이에요 — 자신감이 붙을 때 중요한 일을 앞쪽에 배치해 보세요.'
      : '기운 소모가 좀 있는 날이에요 — 일정을 가볍게 잡고 중요한 것 한두 가지에만 집중하면 충분해요.';
    return '컨디션 균형이 좋은 날이에요 — 평소 페이스대로 가면 돼요.';
  },
  sub: (s) => `그 아래로는 ${s} 흐름도 함께 깔려 있어요.`,
  areaSub: { 비겁: '사람들과 함께 가는', 식상: '표현하고 펼치는', 재성: '실속을 챙기는', 관성: '책임을 다하는', 인성: '배우고 정리하는' },
  threeUnite: '여러 기운이 한 방향으로 모이는 날이에요 — 흐름을 타면 평소보다 큰 진전이 있어요.',
  gm: '오늘은 애써도 결과가 손에 잘 안 잡히는 날일 수 있어요 — 욕심내기보다 정리하고 계획하는 데 쓰면 오히려 알차요.',
  gmMoney: '큰 지출이나 계약은 하루 미루는 편이 나아요 — 오늘은 알아보고 비교하는 데 쓰세요.',
  cheonEul: '도와주는 사람이 나타나기 쉬운 날이에요 — 막힌 일은 혼자 끙끙대지 말고 물어보세요.',
  hwagae: '혼자만의 시간이 필요한 날이기도 해요 — 조용히 정리하면 머리가 맑아져요.',
  yeokma: '외근·이동·출장처럼 움직이는 일이 오히려 기회가 되는 날이에요 — 자리만 지키기보다 직접 가서 보세요.',
  dohwa: '매력이 살아나고 시선이 모이는 날이에요 — 첫 만남이든 오랜 사이든 호감이 잘 통해요.',
  moneyBijeop: '주변과 같이 쓰는 돈은 특히 새기 쉬워요 — 오늘만큼은 한도를 정해 두는 게 안전해요.',
  healthLow: '몸이 보내는 신호에 평소보다 민감해지세요 — 오늘은 일찍 쉬는 것이 보약이에요.',
  investCaution: '투자·재테크는 흐름과 타이밍의 관점에서만 가볍게 보세요. 무리한 베팅·빚투는 한 걸음 물러서고, 큰 결정은 하루 묵혀 결제 전 한 번 더 점검 — 구체적인 종목·매수 조언이 아니에요.',
  // ★C3(daniel): 오늘 천간의 정밀 십신 결 — 5-lump 로 뭉갠 正/偏·식/상 복구(특히 편관=칠살 압박·상관=표출). general 에 한 줄.
  polarity: {
    비견: '오늘은 내 뜻과 페이스를 또렷이 세우는 결이에요 — 다만 혼자 다 하려 말고 곁을 살피면 좋아요.',
    겁재: '경쟁·승부의 기운이 도는 결이에요 — 이기려는 마음보다 함께 가면 오히려 실속이 남아요.',
    식신: '여유롭게 표현하고 즐기는 순한 결이에요 — 편안하게 재능을 펼쳐 보세요.',
    상관: '톡톡 튀는 표현과 재치가 살아나는 결이에요 — 말은 한 박자 골라서 하면 빛이 오래가요.',
    정재: '차곡차곡 실속을 챙기기 좋은 안정적인 결이에요 — 꾸준함이 그대로 이득이 돼요.',
    편재: '큰 기회·큰돈이 오가는 활달한 결이에요 — 벌인 만큼 관리도 함께하면 확장이 실속으로 남아요.',
    정관: '질서와 책임이 또렷해지는 반듯한 결이에요 — 맡은 걸 정공법으로 가면 신뢰가 쌓여요.',
    편관: '압박·긴장이 강하게 들어오는 결이에요 — 정면으로 다 받기보다 힘을 한 번 빼면 한결 수월해요.',
    정인: '차분히 배우고 기대어 채우는 안정의 결이에요 — 서두르지 말고 기반을 다지세요.',
    편인: '남다른 직관과 몰입이 도는 결이에요 — 혼자 너무 파고들지 말고 바깥바람도 쐬어 주세요.',
  },
  sangGwanGyeonGwan: '표현하고 싶은 마음이 세지는 날이라 윗사람·규칙과 부딪히기 쉬워요 — 하고 싶은 말은 결과로 보여 주고, 예의와 절차를 곁들이면 탈이 없어요.',
  // ★테마A(daniel): 억부 게이트 — 오늘 기운이 신강약 대비 버거울 때(!favorGood)만 덧대는 분야별 균형 한 줄(§4 전향적).
  gate: {
    work: '다만 오늘 기운이 지금의 나에겐 조금 과할 수 있는 결이에요 — 다 떠안기보다 핵심 한두 가지에 집중하면 수월해요.',
    money: '다만 오늘 기운이 지금의 나에겐 조금 버거운 결이에요 — 돈은 크게 벌이기보다 지키고 관리하는 쪽이 안전해요.',
    love: '다만 오늘은 마음이 앞서기 쉬운 결이에요 — 한 박자 천천히, 상대의 속도에 맞추면 더 편안해요.',
    health: '다만 기운을 무리하게 쓰기 쉬운 결이에요 — 쉼을 먼저 챙기면 페이스가 지켜져요.',
  },
};

const EN: Bundle = {
  area: {
    general: {
      비겁: "Your own momentum picks up today. With that drive comes a need to match pace with others — you'll click with people who share your goal, while needless ego clashes only cost you. Don't try to do it all alone; split the roles.",
      식상: 'Words and ideas flow easily today. Voicing what was only in your head gets a response, and it\'s a fine day to try something new, lightly. Jot down what comes to you, and put at least one idea into action today.',
      재성: 'A good day to lock in results and real substance. The flow favors finishing what you started and turning it into something visible, so focus on one thing rather than many. Pick one task to close out today and begin.',
      관성: 'What needs doing comes into sharp focus today. You may feel the expectations or eyes around you, but it reads more as opportunity than pressure. Rather than starting something new, tie up what you\'re responsible for — trust builds.',
      인성: 'A calm day for learning and organizing. The flow suits laying groundwork over racing ahead — study, paperwork, and planning all take hold. What you sort out today makes the next few days easier.',
    },
    work: {
      비겁: 'A day that opens up when you move with others rather than carrying it alone. Splitting roles with colleagues or partners adds speed, and even a rival becomes a spark. Just don\'t be stingy with credit — acknowledge people first.',
      식상: 'Energy gathers around work that shows — pitches, proposals, presentations. If you\'ve been sitting on an idea, bring it out today. Sharing it beats polishing it to perfection; that\'s where the openings come from.',
      재성: 'Hands-on work comes together today. Turning what you handled into something visible reads well in others\' eyes. A day for doing over meeting, results over talk.',
      관성: 'Responsibility comes into focus today. Handle reports, deadlines, and promises first, and the pressure flips into opportunity. With anything tied to a boss or organization, the straightforward route is fastest.',
      인성: 'A day suited to review and preparation. Rather than launching something new, look calmly over documents, contracts, and plans — you\'ll spot what you missed. Places to learn or seek advice help too.',
    },
    money: {
      비겁: 'Money tends to move out alongside others today. Set a budget ahead of any gathering or shared spending and it won\'t leak. Hold off on lending or co-signing for today.',
      식상: 'A day to plant seeds that lead to income. Your ideas or talents could become earnings, so try it on a small scale. The point is confirming the potential, not big money right away.',
      재성: 'The flow of money comes into focus. You have an edge in deals, settlements, and negotiations — anything with numbers — but impulse-buy urges grow just as much. Think once more before any big payment.',
      관성: 'A day where protecting what you have is how you earn. Good for reviewing fixed costs, contracts, and taxes; the steady choice pays off in the end. Step back from any pushy investment pitch.',
      인성: 'A day when information becomes money. Sorting out contracts, receipts, and money plans makes a big difference later. Better spent comparing and researching than deciding.',
    },
    love: {
      비겁: 'An easy, friend-like current runs through today. Time spent together itself makes the bond firmer. Just watch the urge to win an argument — show the grace to let it go now and then.',
      식상: 'Expressing how you feel comes naturally today. Reach out first, say it first — you grow closer in proportion to what you express. If you\'re single, it\'s a good flow to go where new people are.',
      재성: 'Caring gestures land today. A small gift or a practical kindness moves the other person more than a grand event. Show it through action, not just words.',
      관성: 'A day to feel the weight of the relationship. Keeping promises and showing responsibility is your greatest charm. If things were unclear, it\'s good timing to confirm each other\'s true feelings.',
      인성: 'A day when listening becomes love. Just hearing the other person out to the end deepens trust. Revisiting old memories together also warms the bond.',
    },
    health: {
      비겁: 'A day you\'ll want to move your body. Good for exercise, but a competitive streak can push it too far — set an end time in advance. Don\'t forget enough water and stretching.',
      식상: 'A day when a change of mood is health itself. A light walk, chatting, and laughing are the best condition care. Just know late-night snacks or overeating sit heavy into the next day.',
      재성: 'A day of heavy energy drain. Tuck short breaks between your schedule to keep your pace. Ten minutes with your eyes closed beats pushing through on coffee.',
      관성: 'Tension tends to build in the body today. Loosen your shoulders and neck often, and when pressure hits, breathe slowly. After work, practice setting work-thoughts down.',
      인성: 'A day when rest is the best medicine. The flow favors quality sleep and rest, and turning in early returns as tomorrow\'s efficiency. Wind down the day with a warm cup of tea.',
    },
  },
  stage: {
    장생: 'Your overall condition is on the rise — fresh starts gain energy.',
    관대: 'Your overall condition is on the rise — good momentum to start things and step forward.',
    건록: 'A solid-condition day — your real ability shows as is.',
    제왕: 'Your momentum is at its best — place important matters earlier in the day.',
    목욕: 'Emotions may swing more than usual — just be careful with impulsive decisions.',
    태: 'A day suited to ideas and preparation — no need to rush.',
    양: 'A flow of finishing preparation and waiting for the time — good for setting up tomorrow.',
    쇠: 'A day to spend energy sparingly — trim back on overcommitting.',
    병: 'A day that needs condition care — keep the schedule light.',
    사: 'A day suited to wrapping up — put your energy into closing things, not new starts.',
    묘: 'A quietly settling flow — a good day to organize and let things rest.',
    절: 'A day that needs recharging — taking a break is itself efficiency.',
  },
  posArea: { 년: 'elders & family', 월: 'work & workplace', 일: 'close people', 시: 'juniors & ongoing work' },
  link: (type, pos) => {
    switch (type) {
      case '합': return `Today you click well with the ${pos} side — good timing to raise a request or work out an agreement.`;
      case '충': return `There's a current of change on the ${pos} side — plans may shift or clash, so leave some room and speak a beat slower.`;
      case '형': return `Things on the ${pos} side may get a little tangled — keeping to principles and procedure is the fastest way through.`;
      default: return `A small mismatch may come up on the ${pos} side — it won't blow up, so let it pass lightly.`;
    }
  },
  absent: {
    비겁: 'Work you usually handle alone gets someone to share it today — it\'s okay to lean on others for once.',
    식상: "If you usually struggle to express yourself, today loosens your words — bring up what you've been putting off.",
    재성: 'The substance that usually slips through your hands gets caught today — don\'t miss the small wins.',
    관성: 'Roles and responsibilities that were usually vague come into focus today — a good chance to sort them out.',
    인성: 'The help and information you usually lacked comes in today — ask for advice and the answer shows.',
  },
  strength: (strong, weak, favor) => {
    if (strong) return favor
      ? 'Your innate energy runs strong, and today adds more of the same — keep the drive from overspeeding by channeling it into exercise or deep focus, and the day goes smoothly.'
      : 'A good day to spend the strength you\'ve stored — handle what you\'ve been putting off and it resolves more easily than expected.';
    if (weak) return favor
      ? 'A day your energy fills up more than usual — when confidence rises, place important matters earlier.'
      : 'A day with some energy drain — keep the schedule light and focus on just one or two key things, and that\'s plenty.';
    return 'A well-balanced day — go at your usual pace.';
  },
  sub: (s) => `Underneath it, a ${s} current also runs along.`,
  areaSub: { 비겁: 'moving-with-people', 식상: 'expressive, outgoing', 재성: 'substance-minded', 관성: 'duty-keeping', 인성: 'learning-and-organizing' },
  threeUnite: 'A day when several currents gather in one direction — ride the flow and you\'ll make more progress than usual.',
  gm: 'Today, even when you try, results may be hard to grasp — rather than forcing it, spend the day organizing and planning and it pays off better.',
  gmMoney: 'Better to put off big spending or contracts by a day — spend today researching and comparing.',
  cheonEul: 'A day when a helping hand is likely to appear — don\'t stew over a stuck problem alone; ask.',
  hwagae: 'A day you also need some time alone — quietly tidying things clears your head.',
  yeokma: 'A day when moving work — field trips, travel, errands — becomes the opportunity. Rather than staying put, go see for yourself.',
  dohwa: 'A day your charm shines and eyes turn your way — first meeting or long-time bond, goodwill comes through.',
  moneyBijeop: 'Money shared with others leaks especially easily — for today, setting a limit is the safe move.',
  healthLow: 'Be more sensitive than usual to what your body signals — today, turning in early is the best medicine.',
  investCaution: 'Treat investing as a matter of flow and timing only. Step back from over-leveraged bets, sleep on big decisions, and double-check before you commit — this is not specific stock or buy advice.',
  polarity: {
    비견: 'A day your own will and pace stand out clearly — just don’t do it all alone; keep an eye on those beside you.',
    겁재: 'A current of rivalry and contest runs today — going together beats trying to win, and more substance stays with you.',
    식신: 'An easygoing current of expressing and enjoying — unfold your talent at a relaxed pace.',
    상관: 'Sparkling expression and wit come alive — pick your words a beat slower and the shine lasts.',
    정재: 'A stable current, good for securing substance bit by bit — steadiness itself becomes gain.',
    편재: 'A lively current where big chances and money move — manage as much as you make, and expansion becomes real gain.',
    정관: 'An upright current where order and duty come into focus — go by the book on what you hold, and trust builds.',
    편관: 'A current of strong pressure and tension — rather than taking it all head-on, ease off once and it gets smoother.',
    정인: 'A steady current of learning and leaning to refill — don’t rush; shore up your base.',
    편인: 'A current of rare intuition and immersion — don’t dig in too much alone; get some outside air too.',
  },
  sangGwanGyeonGwan: 'Your urge to speak up runs strong today, so you may clash with superiors or rules — show your point through results, add courtesy and process, and there’s no trouble.',
  gate: {
    work: 'That said, today’s energy may be a bit much for you right now — focus on one or two essentials rather than taking it all on.',
    money: 'That said, today’s energy sits a bit heavy for you right now — keep and manage money rather than betting big.',
    love: 'That said, your heart may run ahead today — go a beat slower and match your partner’s pace for more ease.',
    health: 'That said, it’s a day you may overspend your energy — put rest first and your pace holds.',
  },
};

const JA: Bundle = {
  area: {
    general: {
      비겁: '自分のペースが戻ってくる日です。推進力がつくぶん、周りと歩調を合わせるのが鍵。同じ目標を持つ人とは相乗効果が出ますが、無用な意地の張り合いは損。一人で全部やろうとせず、役割を分けてみて。',
      식상: '言葉やアイデアがよく回る日です。頭の中だけにあった考えを出すと反応があり、新しい試みを軽くしてみるのにも良い。浮かんだものはメモして、ひとつは今日すぐ実行してみて。',
      재성: '結果と実利を取りに行くのに良い日です。広げた仕事を仕上げて、目に見える成果につなげる流れ。あれこれより一つに集中すると実りが明確に。今日終える仕事を一つ決めて始めて。',
      관성: 'やるべきことがはっきりする日です。周りの期待や評価を感じるかもしれませんが、負担より機会に近い。新しく広げるより、任された仕事をきれいに締めると信頼が積み上がります。',
      인성: '落ち着いて学び、整えるのに良い日です。スピードより土台を固めるのに合う流れで、勉強・書類・計画がよく進む。今日整えたことが、次の数日を楽にしてくれます。',
    },
    work: {
      비겁: '一人で引っ張るより、一緒に進むとほどける日です。同僚やパートナーと役割を分けると速度が出て、ライバルさえ刺激になる。ただ手柄を分けるのに渋ると雑音が出るので、まず認めて。',
      식상: '企画・提案・発表のような「見せる仕事」に力が乗る日です。温めていたアイデアがあれば今日出してみて。完璧に磨くより、まず共有するほうが機会を生みます。',
      재성: '実務が手によくつく日です。処理したことを目に見える成果物にまとめると評価につながる。会議より実行、言葉より結果で見せるのに合う一日。',
      관성: '責任がはっきりする日です。報告・締切・約束を先に押さえると、プレッシャーがむしろ機会に変わる。上司や組織が絡む話は、正攻法が一番速い。',
      인성: '見直しと準備に合う日です。新しく広げるより、書類・契約・計画を落ち着いて見ると、見落としが見える。学ぶ場や助言を求める場も助けに。',
    },
    money: {
      비겁: '出ていくお金が連れ立って動きやすい日です。集まりや共同の場では予算を先に決めておくと漏れません。貸す・保証に立つことは今日は見送りを。',
      식상: '稼ぎにつながる種をまく日です。自分のアイデアや才能が収入になりうる流れなので、小さくても試してみて。今すぐ大金より、可能性を確かめることに意味があります。',
      재성: 'お金の流れがはっきりする日です。取引・精算・交渉など数字が動くことに有利。そのぶん衝動買いの欲も大きくなるので、大きな出費は決済前にもう一度。',
      관성: '守るべきを守るのが稼ぎ道の日です。固定費・契約・税金の点検に良く、安定した選択が結局は得。無理な投資の誘いは一歩引いて。',
      인성: '情報がそのままお金になる日です。契約書や証憑、お金の計画を整えておくと後で大きな差に。決めるより、調べて比べるのに使うと良い一日。',
    },
    love: {
      비겁: '友達のように気楽な空気が流れる日です。一緒に過ごす時間そのものが関係を固めます。ただ勝とうとする口調が出やすいので、時々譲る余裕を見せて。',
      식상: '気持ちの表現が自然になる日です。先に連絡し、先に言ってみて——表したぶん近づきます。一人なら、新しい出会いの場に出てみるのに良い流れ。',
      재성: '気遣う心が通じる日です。大げさなイベントより、小さな贈り物や実質的な配慮が相手の心を動かす。言葉より行動で見せて。',
      관성: '関係の重みを確かめる日です。約束を守り、責任ある姿を見せることが最大の魅力に。あいまいだった関係なら、互いの本心を確かめるのに良いタイミング。',
      인성: '聞くことが愛になる日です。相手の話を最後まで聞くだけで信頼が深まる。古い思い出を一緒に出してみるのも、関係を温めます。',
    },
    health: {
      비겁: '体を動かしたくなる日です。運動には良いけれど、勝負心がついて過剰になりやすいので、終わる時間を先に決めて。十分な水分とストレッチも忘れずに。',
      식상: '気分転換がそのまま健康になる日です。軽く歩き、おしゃべりし、笑うのが最高のコンディション管理。ただ夜遅い夜食や食べ過ぎは翌日まで重く残ります。',
      재성: 'エネルギーの消耗が大きい日です。予定の合間に短い休憩を挟んでこそペースが保てる。コーヒーで耐えるより、10分目を閉じるほうが効果的。',
      관성: '緊張が体にたまりやすい日です。肩と首をこまめにほぐし、プレッシャーを感じたらゆっくり呼吸を整えて。退勤後は仕事の考えを手放す練習を。',
      인성: '休みが薬の日です。睡眠と休息の質を整えるのに良い流れで、早めに休むのが明日の能率に返ってくる。温かいお茶と一緒に一日を整えて。',
    },
  },
  stage: {
    장생: '全体的なコンディションは上り調子です——新しく始めることに活力がつきます。',
    관대: '全体的なコンディションは上り調子です——事を起こして前へ出るのに良い勢い。',
    건록: 'コンディションが堅い日です——実力がそのまま出ます。',
    제왕: '勢いが最も良い日です——大事なことは今日の前半に置いてみて。',
    목욕: '感情が普段より揺れやすいかも——衝動的な決定だけ気をつければ大丈夫。',
    태: '構想と準備に合う日です——急がなくて大丈夫。',
    양: '準備を終えて時を待つ流れです——明日のための仕込みに良い。',
    쇠: 'エネルギーを節約して使うと良い日です——無理な約束は減らして。',
    병: 'コンディション管理が必要な日です——予定は軽めに。',
    사: '仕上げに合う日です——新しいことより、締めくくりに力を。',
    묘: '静かに落ち着く流れです——整えて寝かせておくのに良い日。',
    절: '充電が必要な日です——休むことがそのまま能率に。',
  },
  posArea: { 년: '目上・家庭', 월: '職場・仕事場', 일: '身近な人', 시: '目下・進行中の仕事' },
  link: (type, pos) => {
    switch (type) {
      case '합': return `今日は${pos}の側とよく噛み合います——頼みごとや相談を切り出すのに良いタイミング。`;
      case '충': return `${pos}の側に変動の気流があります——予定が変わったりぶつかったりしうるので、余裕を持ち、言葉は一拍ゆっくり。`;
      case '형': return `${pos}の側の物事が少しこじれるかも——原則と手順を守るのが一番の近道です。`;
      default: return `${pos}の側でささいな行き違いが起きるかも——大きくなる話ではないので、軽く流して。`;
    }
  },
  absent: {
    비겁: '普段ひとりでこなしていた仕事に、今日は一緒にやる人が現れます——たまには頼っても大丈夫。',
    식상: '普段うまく表現できなかったなら、今日は言葉が出る日です——先延ばしにしていた話を出してみて。',
    재성: '普段つかみにくかった実利が、今日は手に入ります——小さな実りを逃さないで。',
    관성: '普段あいまいだった役割と責任が、今日ははっきりします——整理するのに良い機会。',
    인성: '普段足りなかった助けと情報が、今日は入ってきます——助言を求めれば答えが見えます。',
  },
  strength: (strong, weak, favor) => {
    if (strong) return favor
      ? '生まれ持ったエネルギーが強めで、今日は似た気が加わります——意欲が暴走しないよう、運動や没頭できることに力を逃がすと一日が滑らか。'
      : 'ためた力を使うのに良い日です——先延ばしの仕事を今日片づけると、思ったより楽にほどけます。';
    if (weak) return favor
      ? '普段より気が満ちてくる日です——自信がつくとき、大事なことを前半に置いてみて。'
      : '気の消耗が少しある日です——予定は軽めにして、大事な一つ二つに絞れば十分。';
    return 'コンディションのバランスが良い日です——普段のペースで大丈夫。';
  },
  sub: (s) => `その下には、${s}流れも一緒に敷かれています。`,
  areaSub: { 비겁: '人と共に進む', 식상: '表現して広げる', 재성: '実利を取る', 관성: '責任を果たす', 인성: '学んで整える' },
  threeUnite: 'いくつもの気が一方向に集まる日です——流れに乗れば、普段より大きな前進があります。',
  gm: '今日は努めても結果が手につきにくい日かも——欲を出すより、整理と計画に使うほうがむしろ充実します。',
  gmMoney: '大きな出費や契約は一日見送るほうが無難——今日は調べて比べるのに使って。',
  cheonEul: '助けてくれる人が現れやすい日です——詰まった件は一人で抱えず、聞いてみて。',
  hwagae: '一人の時間が必要な日でもあります——静かに整えると頭が澄みます。',
  yeokma: '外回り・移動・出張のような動く仕事が、むしろ機会になる日です——席を守るより、自分で行って見て。',
  dohwa: '魅力が生きて視線が集まる日です——初対面でも長い間柄でも、好意がよく通じます。',
  moneyBijeop: '周りと一緒に使うお金は特に漏れやすい——今日だけは上限を決めておくのが安全。',
  healthLow: '体が送るサインに普段より敏感に——今日は早めに休むのが一番の薬です。',
  investCaution: '投資・資産運用は流れとタイミングの観点だけで軽く。無理なベットや借金投資は一歩引いて、大きな決断は一晩おいて決済前にもう一度——具体的な銘柄・買い推奨ではありません。',
  polarity: {
    비견: '自分の意志とペースがはっきり立つ日です——ただ一人で抱えず、周りにも目を向けて。',
    겁재: '競争・勝負の気が巡る日です——勝とうとするより共に進むほうが、かえって実利が残ります。',
    식신: 'ゆったり表現し楽しむ穏やかな流れです——気楽に才能を広げてみて。',
    상관: 'きらめく表現と機知が冴える流れです——言葉を一拍選ぶと輝きが長持ちします。',
    정재: 'こつこつ実利を固めるのに良い安定した流れです——堅実さがそのまま得になります。',
    편재: '大きな機会・大金が動く活発な流れです——稼ぐぶん管理も一緒にすれば拡張が実利に。',
    정관: '秩序と責任がはっきりする端正な流れです——任されたことを正攻法で行くと信頼が積もります。',
    편관: '圧力・緊張が強く入る流れです——正面から全部受けるより、一度力を抜くと楽になります。',
    정인: '落ち着いて学び、頼って満たす安定の流れです——急がず土台を固めて。',
    편인: '人と違う直感と没入が巡る流れです——一人で掘り込みすぎず、外の風にも当たって。',
  },
  sangGwanGyeonGwan: '言いたい気持ちが強まる日で、目上や規則とぶつかりやすいです——言い分は結果で見せ、礼儀と手順を添えれば問題ありません。',
  gate: {
    work: 'ただ今日の気は、今の自分には少し過剰かもしれません——全部抱えるより、要点一つ二つに絞ると楽です。',
    money: 'ただ今日の気は、今の自分には少し重めです——お金は大きく広げるより、守って管理するほうが安全。',
    love: 'ただ今日は気持ちが先走りやすい流れです——一拍ゆっくり、相手のペースに合わせると楽です。',
    health: 'ただ気を使いすぎやすい日です——休みを先に取ればペースが保てます。',
  },
};

const T: Record<Lang, Bundle> = { ko: KO, en: EN, ja: JA };
const LOW_ENERGY = new Set(['쇠', '병', '사', '묘', '절']); // 건강 분야 휴식 권고 트리거(운성 키는 내부 고정)

// ★C1(daniel 2026-07-06): 개고/변동 이벤트 트리거 하한 ↑ — 일 단위라 매일 충이 걸려 개고가 과발화됨.
//   충/형을 '큰 변동'으로 읽는 건 **고지(墓庫 辰戌丑未 = 개고 대상) 또는 통근(뿌리) 자리**를 칠 때만.
//   그 외 비중 낮은 자리 충/형은 '사소한 어긋남'으로 완충(headline 의 충 특화·분야 변동 라인 모두 이 컷을 통과해야 발화).
const GOJI_SET = new Set<Branch>(['辰', '戌', '丑', '未']); // 고지(墓庫) — 개고의 실체
function isSignificantClash(P: SajuChart['pillars'], pos: PillarPos): boolean {
  const pil = P[pos];
  if (!pil) return false;
  return GOJI_SET.has(pil.branch) || pil.isRoot === true; // 고지(개고) 또는 통근(뿌리) 자리만 '변동'급으로 인정
}

export type DailyAreaReading = { key: DailyAreaKey; paragraphs: string[] };

/**
 * 오늘 일진 × 대표 명식 → 분야별 다층 풀이 (결정론, 본문 앱 언어 — 명리 용어 미노출).
 * 합충 라우팅: 월지→직업, 일지→애정, 그 외→통합. 도화→애정, 역마→직업, 화개·천을·공망·부재→통합.
 */
export function dailyChartReadings(saju: SajuChart, todayStem: Stem, todayBranch: Branch): DailyAreaReading[] {
  const tt = T[appLang()]; // 앱 언어 템플릿 묶음
  const me = saju.dayMaster.stem;
  const P = saju.pillars;

  const group = GROUP[tenGod(me, todayStem)];
  const bGroup = GROUP[branchTenGod(me, todayBranch)];
  const tg = tenGod(me, todayStem); // ★C3(daniel): 오늘 천간의 정밀 십신(정/편·식/상). group 은 5-lump, 이건 10정밀 — 칠살·상관 등 결 복구용.

  const sc = classifyStrength(saju);
  const strong = sc.type === '신왕' || sc.type === '신강';
  const weak = sc.type === '신약';
  const favor = group === '비겁' || group === '인성'; // strength() 용 동측(비겁·인성) 지표 — 의미 유지
  // ★테마A(daniel): 억부 게이트 — 오늘 기운이 신강약 대비 우호적인가(dailyHeadline/preview 와 동일 3분기). 분야별 균형에 소비.
  const favorGood = weak ? (group === '비겁' || group === '인성')
    : strong ? (group === '식상' || group === '재성' || group === '관성')
    : true;

  const stage = twelveStage(me, todayBranch);

  const POS: PillarPos[] = ['년', '월', '일', '시'];
  const items = [
    ...POS.map((p) => ({ pos: p as ChartPosition, stem: P[p].stem, branch: P[p].branch })),
    { pos: '일운' as ChartPosition, stem: todayStem, branch: todayBranch },
  ];
  const links = detectInteractionsAmong(items).filter((it) => it.members.includes('일운') && it.level !== '천간');
  const workLines: string[] = [], loveLines: string[] = [], generalLines: string[] = [];
  for (const it of links) {
    const others = it.members.filter((m) => m !== '일운') as string[];
    if (others.length >= 2) { generalLines.push(tt.threeUnite); continue; } // 3자 국 완성
    const pos = others[0];
    // ★C1(daniel): 충/형은 고지(개고)·통근 자리를 칠 때만 '변동'으로 — 그 외엔 '사소한 어긋남'(default)으로 완충(일 단위 개고 과발화 방지).
    const linkType = ((it.type === '충' || it.type === '형') && !isSignificantClash(P, pos as PillarPos)) ? '기타' : it.type;
    const line = tt.link(linkType, tt.posArea[pos] ?? tt.posArea['일']);
    if (pos === '월') workLines.push(line);
    else if (pos === '일') loveLines.push(line);
    else generalLines.push(line);
  }

  const [g1, g2] = gongmang(P['일'].stem, P['일'].branch);
  const isGm = todayBranch === g1 || todayBranch === g2;

  const sin = analyzeSinsal(saju);
  const tw = new Set([twelveSinsalAt(P['년'].branch, todayBranch), twelveSinsalAt(P['일'].branch, todayBranch)]);
  const hasCheonEul = !!sin.sinsal.find((s) => s.name === '천을귀인')?.glyphs.includes(todayBranch);

  const tga = analyzeTenGods(saju);
  const absent = tga.absent; // 부재 십신(보충 신호). tga.detail 은 상관견관(원국 정관 유무) 판정에 사용.

  // ── 분야별 조립 (기조 → 개인화 시그널 → 색채) ──
  const general: string[] = [tt.area.general[group]];
  if (bGroup !== group) general.push(tt.sub(tt.areaSub[bGroup]));
  general.push(tt.strength(strong, weak, favor));
  { const pol = tt.polarity[tg]; if (pol) general.push(pol); } // ★C3: 오늘 기운 正/偏·식/상 결(칠살·상관 등 복구)
  general.push(tt.stage[stage] ?? '');
  general.push(...generalLines);
  if (absent.includes(group)) general.push(tt.absent[group]);
  if (isGm) general.push(tt.gm);
  if (hasCheonEul) general.push(tt.cheonEul);
  if (tw.has('화개')) general.push(tt.hwagae);

  const work: string[] = [tt.area.work[group], ...workLines];
  if (tg === '상관' && (tga.detail['정관'] ?? 0) > 0) work.push(tt.sangGwanGyeonGwan); // ★C3: 상관견관 복구(오늘 상관 + 원국 정관 → 윗사람·규칙 마찰)
  if (tw.has('역마')) work.push(tt.yeokma);
  if (!favorGood && GATE_AREAS[group].includes('work')) work.push(tt.gate.work); // ★테마A + 반반 보정(daniel 07-08): 이 기운이 부담 주는 영역에만 주의

  const money: string[] = [tt.area.money[group]];
  if (group === '비겁' && strong) money.push(tt.moneyBijeop);
  if (!favorGood && GATE_AREAS[group].includes('money')) money.push(tt.gate.money); // ★테마A + 반반 보정(신약 재성날 ≠ 항상 '돈 유리', 단 그 부담을 전 영역이 아닌 재물에만)
  if (isGm) money.push(tt.gmMoney);

  // 투자(daniel #17) = 재물 흐름 관점 + 표준 주의(흐름·타이밍만, 종목·매수 조언 아님). ※ 십신별 투자 stance 정교화는 daniel 검수 슬롯.
  const invest: string[] = [tt.area.money[group], ...(!favorGood && GATE_AREAS[group].includes('money') ? [tt.gate.money] : []), tt.investCaution]; // ★테마A + 반반 보정

  const love: string[] = [tt.area.love[group], ...loveLines];
  if (tw.has('도화')) love.push(tt.dohwa);
  if (!favorGood && GATE_AREAS[group].includes('love')) love.push(tt.gate.love); // ★테마A + 반반 보정

  const health: string[] = [tt.area.health[group]];
  if (LOW_ENERGY.has(stage)) health.push(tt.healthLow);
  if (!favorGood && GATE_AREAS[group].includes('health')) health.push(tt.gate.health); // ★테마A + 반반 보정

  const clean = (arr: string[]) => arr.filter(Boolean);
  return [
    { key: 'general', paragraphs: clean(general) },
    { key: 'work', paragraphs: clean(work) },
    { key: 'money', paragraphs: clean(money) },
    { key: 'invest', paragraphs: clean(invest) },
    { key: 'love', paragraphs: clean(love) },
    { key: 'health', paragraphs: clean(health) },
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// 이달의 운세 전용 (daniel: 더 길게 + 상순·중순·하순 흐름 + '날'→'달')
// ─────────────────────────────────────────────────────────────────────────

// 일(日) 프레이밍 문구 → 월(月) 프레이밍 (안전한 구 단위 치환, 언어별). '날카롭다' 등 오치환 방지.
const DAY_TO_MONTH: Record<Lang, [RegExp, string][]> = {
  ko: [
    [/오늘은/g, '이번 달은'], [/오늘/g, '이번 달'],
    [/날이에요/g, '달이에요'], [/날입니다/g, '달입니다'], [/날이네요/g, '달이네요'], [/날엔/g, '달엔'], [/이 날/g, '이번 달'], [/하루/g, '한 달'],
  ],
  en: [
    [/\btoday\b/gi, 'this month'], [/\ba day\b/gi, 'a month'], [/\bthe day\b/gi, 'the month'], [/\bday\b/gi, 'month'],
  ],
  ja: [
    [/今日は/g, '今月は'], [/今日/g, '今月'], [/この日/g, '今月'], [/一日/g, '一ヶ月'], [/日です/g, '月です'], [/日ですね/g, '月ですね'],
  ],
};
function dayToMonth(text: string): string {
  return (DAY_TO_MONTH[appLang()] ?? DAY_TO_MONTH.ko).reduce((s, [re, to]) => s.replace(re, to), text);
}

// 상순·중순·하순 흐름 — 이번 달 기운(월건 십신)이 호의적이냐에 따라 전향적 3구간.
const MONTH_FLOW: Record<Lang, { labels: [string, string, string]; fav: [string, string, string]; steady: [string, string, string] }> = {
  ko: {
    labels: ['상순 (1~10일)', '중순 (11~20일)', '하순 (21일~)'],
    fav: [
      '기운이 차오르는 출발이에요. 새로 벌이거나 먼저 움직이기 좋습니다 — 미뤄 둔 일을 이때 시작해 보세요.',
      '흐름이 가장 무르익는 때예요. 중요한 일이나 결정은 이 구간에 밀어붙이면 한결 수월하게 풀립니다.',
      '거두고 정리하는 마무리예요. 벌여 둔 일을 매듭짓고 다음 달을 위한 준비를 해 두면 좋아요.',
    ],
    steady: [
      '천천히 점검하며 시작하는 게 좋아요. 무리한 확장보다 기반을 다지는 데 마음을 쓰세요.',
      '한 고비가 지나가는 구간이에요. 페이스를 지키며 버티면 후반이 한결 가벼워집니다.',
      '비우고 정리하는 마무리예요. 다음 달을 위한 여백을 만들어 두면 흐름이 살아납니다.',
    ],
  },
  en: {
    labels: ['Early (1–10)', 'Mid (11–20)', 'Late (21–end)'],
    fav: [
      "A rising start — a good time to begin or make the first move. Kick off what you've put off.",
      'The flow peaks here. Push important matters and decisions in this stretch and they go more smoothly.',
      'A gathering, tidying close. Tie off what you started and prepare for next month.',
    ],
    steady: [
      'Better to start by checking in slowly. Focus on shoring up your base rather than overreaching.',
      'A hump passes through. Hold your pace and the second half gets lighter.',
      'A clearing, tidying close. Make some room for next month and the flow revives.',
    ],
  },
  ja: {
    labels: ['上旬 (1〜10日)', '中旬 (11〜20日)', '下旬 (21日〜)'],
    fav: [
      '気が満ちる出発です。新しく始めたり先に動くのに良い時期 — 後回しにしたことをここで始めましょう。',
      '流れが最も熟す時です。大事な事や決断はこの区間で進めるとスムーズに運びます。',
      '収めて整える締めくくり。広げたことをまとめ、来月の準備をしておくと良いです。',
    ],
    steady: [
      'ゆっくり点検しながら始めるのが良いです。無理な拡大より土台を固めることに心を向けて。',
      '一つの山場が過ぎる区間です。ペースを保てば後半がぐっと軽くなります。',
      '空けて整える締めくくり。来月のための余白を作ると流れが生きます。',
    ],
  },
};

/** 이달의 흐름(상순·중순·하순) — 월건 십신 호의도에 따라 전향적 3구간. */
export function monthFlow(saju: SajuChart, monthStem: Stem): { label: string; text: string }[] {
  const g = GROUP[tenGod(saju.dayMaster.stem, monthStem)];
  const favor = g === '비겁' || g === '인성';
  const b = MONTH_FLOW[appLang()] ?? MONTH_FLOW.ko;
  const arr = favor ? b.fav : b.steady;
  return [0, 1, 2].map((i) => ({ label: b.labels[i], text: arr[i] }));
}

/** 이달의 운세 분야별 — 오늘의 운세와 같은 룰에 월건을 먹이고, 일(日)→월(月) 프레이밍으로 치환. */
export function monthChartReadings(saju: SajuChart, monthStem: Stem, monthBranch: Branch): DailyAreaReading[] {
  return dailyChartReadings(saju, monthStem, monthBranch).map((a) => ({ ...a, paragraphs: a.paragraphs.map(dayToMonth) }));
}

/**
 * ★무료·온디바이스 5분야(+투자) 풀이 → 화면용 평면 맵(Record<분야, 한 문단>).
 * ─────────────────────────────────────────────────────────────────────────
 * 목적: 오늘의/이달의 운세 '무료 기본'을 LLM 없이(API 0) 즉시 렌더 — 절대규칙5(무료=룰/템플릿/캐시) 복원.
 *   today.tsx·month.tsx 가 이 결과를 그대로 `reading[area]`(Record<분야,문장>) 형태로 사용하도록,
 *   이미 검증된 결정론 엔진(dailyChartReadings / monthChartReadings)을 재사용해 어댑터로 감싼다(중복 템플릿 금지).
 * 분야별 신호 매핑(엔진이 종합 — dailyChartReadings 참조):
 *   · general(통합): 십신 그룹 기조 + 신강약 억부(길/조심) + 12운성 + 원국×기간 합충 + 부재십신·공망·천을·화개
 *   · work(직업·일): 그룹 기조 + 월지(직장궁) 합충 + 역마(이동)
 *   · money(재물): 그룹 기조 + 비겁·강(경쟁·손재 moneyBijeop) + 공망(큰지출 보류)
 *   · invest(투자): 재물 흐름 + 표준 주의(흐름·타이밍만, 종목·매수 조언 아님 — daniel #17)
 *   · love(애정): 그룹 기조 + 일지(배우자궁) 합충 + 도화(관계)   ※SajuChart 에 성별 없음 → 재성·관성·일지 작용을 성별 무관하게 서술(십신별 love 템플릿)
 *   · health(건강): 그룹 기조 + 저에너지 운성(휴식 권고) — 관리축(스트레스·휴식)만, 의료 단정 금지(§4)
 * ★문구 stance = daniel 검수 슬롯(전향적·일상어·흉 단정 금지·처방 동반·건강은 관리축만, §4) — 실제 문구는 위 KO/EN/JA 번들.
 * @param saju 대표 명식(원국)
 * @param periodStem  기간 천간 (day=오늘 일간 / month=이번 달 월건 천간)
 * @param periodBranch 기간 지지 (day=오늘 일지 / month=이번 달 월건 지지)
 * @param period 'day'=오늘의 운세 / 'month'=이달의 운세('하루→한 달' 프레이밍 치환 포함)
 * @returns 분야별(통합·직업·재물·투자·애정·건강) 풀이 맵(앱 언어) — LLM 결과와 동일 형태
 */
export function getDailyReading(
  saju: SajuChart,
  periodStem: Stem,
  periodBranch: Branch,
  period: 'day' | 'month' = 'day',
): Record<DailyAreaKey, string> {
  // 기간에 맞는 결정론 분야 풀이(문단 배열). 이달은 월(月) 프레이밍 치환까지 포함(monthChartReadings).
  const areas = period === 'month'
    ? monthChartReadings(saju, periodStem, periodBranch)
    : dailyChartReadings(saju, periodStem, periodBranch);
  // 문단 배열 → 한 문단 문자열. ja 는 문장부호(。)로 이미 끝나 붙임(공백 없음), ko/en 은 공백 조인.
  const sep = appLang() === 'ja' ? '' : ' ';
  const out = {} as Record<DailyAreaKey, string>;
  for (const a of areas) out[a.key] = a.paragraphs.join(sep);
  return out;
}
