// app/src/lib/joseonJob.ts — '조선시대 나의 직업은?' 판정(온디바이스·무료·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 가볍게 보기(secLight) 재미·공유 콘텐츠. 사주 십신 분포에서 *가장 강한 십신*(원국)으로 조선시대 직업을 매핑.
//   stance(Claude 초안 — daniel 명리 검수 슬롯, §3.3): 십신 10종 → 조선 직역 1:1.
//   정관=문관 / 편관(칠살)=무관·장수 / 정인=학자·선비 / 편인=의원(전문·기술) /
//   식신=명장(장인) / 상관=예인·화공(끼) / 정재=지주·대농(축적) / 편재=거상(수완) /
//   비견=의병장·무사(독립·의리) / 겁재=보부상(기동·승부).
//   ⚠️ 정통 명리 진단이 아니라 재미 매핑. §4: 강점 중심·전향적(우열·부정 없음).
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, TenGod } from '@spec/chart';
import { analyzeTenGods } from '@engine/structure';
import { appLang } from '../i18n';

export type JoseonJobResult = {
  tenGod: TenGod;     // 판정 근거(가장 강한 십신)
  emoji: string;
  job: string;        // 직업명(현지어)
  tagline: string;    // 한 줄 소개
  traits: string[];   // 특징(강점) 2~3
  rank: string;       // 신분·품계 톤(재미)
};

type Loc = { job: string; tagline: string; traits: string[]; rank: string };
type JobDef = { emoji: string; ko: Loc; en: Loc; ja: Loc };

// 십신 → 조선 직업 데이터(ko/en/ja). Claude 초안 stance — daniel 검수 슬롯.
const JOB: Record<TenGod, JobDef> = {
  정관: {
    emoji: '🏛️',
    ko: { job: '문관(文官)', tagline: '법도와 명예를 아는 타고난 행정가 — 과거 급제할 인재', traits: ['원칙과 책임감', '공정한 판단력', '명예를 지키는 처신'], rank: '정3품 당상관 감' },
    en: { job: 'Civil Official', tagline: 'A born administrator of order and honor — destined to pass the state exam', traits: ['Principled & responsible', 'Fair judgment', 'Carries honor with dignity'], rank: 'Senior 3rd-rank material' },
    ja: { job: '文官', tagline: '法度と名誉をわきまえた生まれながらの行政官 — 科挙に及第する人材', traits: ['原則と責任感', '公正な判断力', '名誉を守る身の処し方'], rank: '正三品 堂上官の器' },
  },
  편관: {
    emoji: '⚔️',
    ko: { job: '무관·장수(武官)', tagline: '위기에 빛나는 결단의 장수 — 난세를 평정할 그릇', traits: ['결단력과 추진력', '위기 돌파의 담력', '사람을 이끄는 통솔'], rank: '병마절도사 감' },
    en: { job: 'Military General', tagline: 'A decisive commander who shines in crisis — born to quell chaos', traits: ['Decisiveness & drive', 'Nerve under fire', 'Natural command'], rank: 'Provincial Army Commander material' },
    ja: { job: '武官·将帥', tagline: '危機に輝く決断の将 — 乱世を平定する器', traits: ['決断力と推進力', '危機を突破する胆力', '人を率いる統率'], rank: '兵馬節度使の器' },
  },
  정인: {
    emoji: '📜',
    ko: { job: '학자·선비', tagline: '글과 사색으로 도를 닦는 대학자 — 후학을 기를 스승', traits: ['깊은 탐구와 수양', '통찰과 분별', '청렴한 지조'], rank: '성균관 대사성 감' },
    en: { job: 'Scholar', tagline: 'A great scholar who cultivates the Way through study — a teacher of generations', traits: ['Deep inquiry & cultivation', 'Insight & discernment', 'Incorruptible integrity'], rank: 'Head of the Royal Academy material' },
    ja: { job: '学者·士', tagline: '学問と思索で道を修める大学者 — 後学を育てる師', traits: ['深い探究と修養', '洞察と分別', '清廉な志操'], rank: '成均館 大司成の器' },
  },
  편인: {
    emoji: '🩺',
    ko: { job: '의원(醫員)', tagline: '사람을 살리는 전문 기술의 달인 — 남다른 눈을 가진 전문가', traits: ['특별한 전문 재능', '깊이 파고드는 궁리', '남과 다른 시각'], rank: '내의원 어의 감' },
    en: { job: 'Royal Physician', tagline: 'A master of life-saving expertise — a specialist with a singular eye', traits: ['Rare specialized talent', 'Relentless inquiry', 'An unconventional perspective'], rank: 'Royal Court Physician material' },
    ja: { job: '医員', tagline: '人を救う専門技術の達人 — 人と違う眼を持つ専門家', traits: ['特別な専門の才', '深く掘り下げる工夫', '人と異なる視点'], rank: '内医院 御医の器' },
  },
  식신: {
    emoji: '🔨',
    ko: { job: '명장(名匠)', tagline: '손끝에서 명품이 나오는 타고난 장인 — 한 분야의 일인자', traits: ['뛰어난 손재주', '꾸준한 정진', '넉넉한 인심'], rank: '상의원 명장 감' },
    en: { job: 'Master Artisan', tagline: 'A born craftsman whose hands make masterpieces — best in the field', traits: ['Exceptional craft', 'Steady devotion', 'Generous spirit'], rank: 'Royal Workshop master material' },
    ja: { job: '名匠', tagline: '指先から名品が生まれる生まれながらの職人 — その道の第一人者', traits: ['卓越した手仕事', '地道な精進', '豊かな人情'], rank: '尚衣院 名匠の器' },
  },
  상관: {
    emoji: '🎨',
    ko: { job: '예인·화공(藝人)', tagline: '타고난 끼로 세상을 홀리는 예술가 — 시대를 앞선 재인', traits: ['빛나는 재능과 끼', '자유로운 표현', '번뜩이는 재치'], rank: '도화서 화원 감' },
    en: { job: 'Court Artist', tagline: 'An artist who enchants the world with raw talent — ahead of the times', traits: ['Dazzling talent', 'Free expression', 'Sparkling wit'], rank: 'Royal Painter material' },
    ja: { job: '芸人·絵師', tagline: '生まれ持った才で世を魅了する芸術家 — 時代を先取る才人', traits: ['輝く才能と個性', '自由な表現', 'ひらめく機知'], rank: '図画署 画員の器' },
  },
  정재: {
    emoji: '🌾',
    ko: { job: '지주·대농(地主)', tagline: '땅과 살림을 알뜰히 일구는 알부자 — 신용으로 부를 쌓는 사람', traits: ['성실과 근면', '살림 경영 수완', '두터운 신용'], rank: '만석꾼 감' },
    en: { job: 'Landed Gentry', tagline: 'A thrifty fortune-builder of land and household — wealth built on trust', traits: ['Diligence & care', 'Sharp household management', 'Solid credit'], rank: 'Ten-thousand-bushel landlord material' },
    ja: { job: '地主·大農', tagline: '土地と暮らしを堅実に営む内福 — 信用で富を築く人', traits: ['誠実と勤勉', '暮らしを営む手腕', '厚い信用'], rank: '万石持ちの器' },
  },
  편재: {
    emoji: '💰',
    ko: { job: '거상(巨商)', tagline: '팔도를 누비며 큰 장사를 하는 거상 — 기회를 보는 배포 큰 사업가', traits: ['뛰어난 사업 수완', '배포와 기회 포착', '발 넓은 인맥'], rank: '송상·만상 행수 감' },
    en: { job: 'Great Merchant', tagline: 'A grand trader roaming the provinces — a bold entrepreneur with an eye for opportunity', traits: ['Sharp business sense', 'Boldness & timing', 'Wide network'], rank: 'Head merchant of the great guilds' },
    ja: { job: '豪商', tagline: '八道を巡り大商いをする豪商 — 機を見る度胸ある事業家', traits: ['優れた商才', '度胸と機会の把握', '広い人脈'], rank: '松商·灣商 行首の器' },
  },
  비견: {
    emoji: '🛡️',
    ko: { job: '의병장·무사', tagline: '스스로 길을 여는 자수성가형 — 의리로 사람을 모으는 우두머리', traits: ['굳센 독립심', '의리와 신의', '자기 세력을 이루는 힘'], rank: '의병장 감' },
    en: { job: 'Righteous-Army Leader', tagline: 'A self-made type who carves their own path — a leader who gathers others by loyalty', traits: ['Strong independence', 'Loyalty & faith', 'Power to build a following'], rank: 'Militia commander material' },
    ja: { job: '義兵将·武士', tagline: '自ら道を開く自力本願型 — 義理で人を集める頭領', traits: ['強い独立心', '義理と信義', '自分の勢力を成す力'], rank: '義兵将の器' },
  },
  겁재: {
    emoji: '🎒',
    ko: { job: '보부상(褓負商)', tagline: '전국을 누비는 발 빠른 승부사 — 경쟁 속에서 길을 뚫는 사람', traits: ['뛰어난 기동력', '강한 승부욕', '대담한 추진'], rank: '보부상 접장 감' },
    en: { job: 'Traveling Peddler', tagline: 'A nimble go-getter roaming the whole country — one who breaks through competition', traits: ['Great mobility', 'Strong competitive drive', 'Bold initiative'], rank: 'Peddlers’ guild head material' },
    ja: { job: '褓負商', tagline: '全国を巡る足の速い勝負師 — 競争の中で道を切り開く人', traits: ['優れた機動力', '強い勝負欲', '大胆な推進'], rank: '褓負商 接長の器' },
  },
};

/** 사주(원국)에서 가장 강한 십신 → 조선시대 직업. 동률이면 우선순위(관>인>재>식상>비겁)로 변별. */
export function joseonJob(saju: SajuChart): JoseonJobResult {
  const { detail } = analyzeTenGods(saju);   // 10정밀 십신 분포(원국)
  // 동률 시 안정적 변별을 위한 우선순위(직업 색이 더 또렷한 순)
  const PRIORITY: TenGod[] = ['편관', '정관', '편인', '정인', '상관', '식신', '편재', '정재', '비견', '겁재'];
  let top: TenGod = '정관';
  let max = -1;
  for (const tg of PRIORITY) {
    const n = detail[tg] ?? 0;
    if (n > max) { max = n; top = tg; }      // > 비교 + 우선순위 순회 = 동률이면 앞선 직업
  }
  const def = JOB[top];
  const lang = appLang() as 'ko' | 'en' | 'ja';
  const loc = def[lang] ?? def.ko;
  return { tenGod: top, emoji: def.emoji, job: loc.job, tagline: loc.tagline, traits: loc.traits, rank: loc.rank };
}
