// app/src/lib/i18n.ts — 다국어 (한·영·일). expo-localization 디바이스 언어 자동 + react-i18next.
// ─────────────────────────────────────────────────────────────────────────
// 화면은 useTranslation().t('key') 로 문자열을 가져온다. 키 누락 시 fallbackLng(en)로.
// ※ 통변(LLM 출력) 언어는 별도 — Edge 프롬프트에 locale 전달해 해당 언어로 생성(추후).
// ─────────────────────────────────────────────────────────────────────────
import 'intl-pluralrules'; // Hermes에 Intl.PluralRules 제공 — i18next init 전 로드(경고 조건 제거)
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

const ko = {
  appName: 'SyncFortune',
  tagline: '운명의 방향을 알려주는 나침반',
  menu: {
    myeongsik: '명식 등록', myeongsikDesc: '생년월일로 내 명식 등록·관리',
    manse: '만세력', manseDesc: '날짜별 사주·차트 관리',
    ziwei: '자미두수', ziweiDesc: '명반·12궁 성요 풀이',
    taro: '타로', taroDesc: '카드로 보는 오늘',
    today: '오늘의 운세', todayDesc: '매일 바뀌는 일운',
    compat: '궁합', compatDesc: '관계역학 딥 분석',
    premium: '프리미엄 풀이', premiumDesc: '딥 통변·전 영역', premiumTag: '프리미엄',
  },
  common: {
    back: '← 뒤로', login: '로그인', signup: '회원가입', logout: '로그아웃',
    comingSoon: '준비 중입니다.', loginOptional: '로그인 / 회원가입 (유료·저장 기능용 — 선택)',
    cancel: '취소', none: '없음',
  },
  auth: {
    signin: '로그인', signupTitle: '회원가입', email: '이메일', password: '비밀번호 (6자 이상)',
    toSignup: '계정이 없으신가요?  회원가입', toSignin: '이미 계정이 있으신가요?  로그인',
    needInput: '이메일과 비밀번호를 입력하세요.', signupDone: '확인 메일이 발송됐습니다. 메일 인증 후 로그인하세요.',
    or: '또는', google: 'Google로 계속하기',
  },
  register: {
    name: '이름·별칭', namePh: '예: 김OO / 본인',
    birthDate: '생년월일 (YYYY-MM-DD)', birthDatePh: '1990-03-15',
    birthTime: '태어난 시각 (HH:mm, 모르면 비움)', birthTimePh: '07:10',
    calendar: '양력 / 음력', solar: '양', lunar: '음',
    sex: '성별', male: '남', female: '여',
    birthPlace: '출생지', birthPlacePh: '탭하여 도시 검색',
    relation: '관계', submit: '명식 계산 · 등록',
    birthTimeSijin: '태어난 시각 (시진)', timeUnknown: '모름', selfLabel: '본인',
    relationCustom: '직접 입력', relationCustomPh: '관계를 직접 입력 (예: 직장 상사)',
    birthPlaceSearch: '도시·지역 검색', birthPlaceSearchPh: '예: 서울, 부산, Tokyo', useAsIs: "'{{q}}' 그대로 사용",
    limitTitle: '무료 등록 한도', limitMsg: '무료 플랜은 명식을 {{limit}}개까지 등록할 수 있어요.\n프로로 업그레이드하면 무제한으로 등록할 수 있습니다.',
    upgrade: '프로 업그레이드', usage: '명식 {{count}}/{{limit}}',
  },
  myeongsik: {
    palja: '팔자', dayMaster: '일간', strength: '신강약 지표', pattern: '격국후보',
    stages: '12운성', interactions: '합충형해', sinsal: '신살·공망', gongmang: '공망',
    noHit: '원국 hit 없음', ziwei: '자미두수', lifePalace: '명궁',
    note: '※ 용신·통변(해석)은 별도. 명식은 결정론(룰)이라 정확합니다.',
    readingBtn: '영역별 풀이 보기 →', noChart: '차트 정보가 없습니다.',
    timeUnknownNote: '※ 출생 시각 미상 — 시주(시간 기둥)·시간 기반 풀이는 제외됩니다.',
    paljaHint: '※ 전통 표기 — 오른쪽이 년주 (년·월·일·시)', root: '통근', hidden: '지장간',
    luck: '대운·세운', daewoon: '대운', sewoon: '세운', elements: '오행 분포',
    합: '합', 충: '충', 형: '형', 해: '해', 파: '파', 극: '극',
    sinsalHint: '기준 글자가 원국에 있으면 ✓(자리), 없으면 대운·세운에서 작동', ssLuck: '운에서', dayPillar: '일주',
    sinsalDetail: '신살·공망 자세히 보기 →',
  },
  reading: {
    title: '전 영역 풀이 · 프리미엄', sub: '16개 전 영역을 한 번에 딥·정밀 통변해 드립니다. (명식은 무료)',
    runAll: '전체 풀이 보기 ({{count}}개)', progress: '‘{{current}}’ 풀이 중… ({{done}}/{{total}})', saveFail: '명식 저장에 실패했어요. 잠시 후 다시 시도해 주세요.',
    ziweiTitle: '자미두수 12궁 풀이 · 프리미엄', ziweiSub: '명반 12궁을 한 번에 통합 통변해 드립니다. (명반은 무료)',
    bannerPremium: '구독 중 — 무제한 통변', bannerTrial: '🎁 첫 통변 1회 무료 체험!',
    bannerGated: '영역 선택 시 광고 또는 구독으로 통변이 열립니다',
    base: '타고난 바탕', overlay: '지금의 흐름', remedy: '이렇게 해보세요',
    premiumAlert: '프리미엄 통변', premiumAlertMsg: '광고를 보거나 건당 ₩2,500 결제로 깊은 통변을 봅니다.',
    watchAd: '광고 보고 1회', payPerUse: '₩2,500 결제', bannerPerUse: '건당 ₩2,500 또는 광고 시청으로 통변',
  },
  compat: {
    otherInfo: '상대 정보 (동의 필요 — 규칙8)', otherDatePh: '상대 생년월일 1992-07-03',
    otherTimePh: '태어난 시각 (모르면 비움)', analyze: '궁합 분석',
    dayRelation: '일간 관계', harmonyTension: '조화 {{h}} · 긴장 {{t}}',
    usefulGod: '용신 상보', crossInter: '교차 합충',
    note: '※ 결정론까지. 관계 통변·조언은 별도(유료). 규칙2: 사주 단독, 자미·MBTI는 수렴.',
    needChart: '궁합을 보려면 먼저 내 명식을 등록하세요.', registerMyChart: '내 명식 등록',
  },
  category: {
    성격내면: '성격·내면', 취업운: '취업운', 직장운: '직장운', 사업운: '사업운',
    금전소득운: '금전·소득운', 투자편재운: '투자운', 재물손재: '재물·손재', 연애운: '연애운',
    결혼배우자운: '결혼·배우자', 대인사회성: '대인관계', 부모운: '부모운', 형제운: '형제운',
    자식운: '자식운', 건강: '건강', 학업자기계발: '학업·자기계발', 이동환경: '이동·환경',
  },
  today: { dayPillar: '오늘의 일진', note: '오늘의 기운(일진)입니다. 상세 통변은 프리미엄에서.' },
  taro: { draw: '카드 뽑기', reshuffle: '다시 뽑기', reversed: '역방향' },
  manse: { empty: '등록된 명식이 없습니다.', myChart: '내 명식' },
  sinsal: { 도화: '도화', 역마: '역마', 화개: '화개', 천을귀인: '천을귀인', 문창: '문창', 양인: '양인', 홍염: '홍염', 괴강: '괴강', 백호: '백호' },
};

const en = {
  appName: 'SyncFortune',
  tagline: 'Your compass to destiny',
  menu: {
    myeongsik: 'Register Chart', myeongsikDesc: 'Add & manage your chart',
    manse: 'Manseryeok', manseDesc: 'Calendar charts & management',
    ziwei: 'Zi Wei Dou Shu', ziweiDesc: 'Palaces & stars reading',
    taro: 'Tarot', taroDesc: "Today's card",
    today: 'Daily Fortune', todayDesc: 'Changes every day',
    compat: 'Compatibility', compatDesc: 'Deep relationship analysis',
    premium: 'Premium Reading', premiumDesc: 'Deep reading · all areas', premiumTag: 'Premium',
  },
  common: {
    back: '← Back', login: 'Log in', signup: 'Sign up', logout: 'Log out',
    comingSoon: 'Coming soon.', loginOptional: 'Log in / Sign up (for paid & saving — optional)',
    cancel: 'Cancel', none: 'None',
  },
  auth: {
    signin: 'Log in', signupTitle: 'Sign up', email: 'Email', password: 'Password (6+ chars)',
    toSignup: "Don't have an account?  Sign up", toSignin: 'Already have an account?  Log in',
    needInput: 'Enter your email and password.', signupDone: 'Verification email sent. Verify, then log in.',
    or: 'or', google: 'Continue with Google',
  },
  register: {
    name: 'Name / Alias', namePh: 'e.g. John / Me',
    birthDate: 'Birth date (YYYY-MM-DD)', birthDatePh: '1990-03-15',
    birthTime: 'Birth time (HH:mm, blank if unknown)', birthTimePh: '07:10',
    calendar: 'Solar / Lunar', solar: 'Solar', lunar: 'Lunar',
    sex: 'Sex', male: 'M', female: 'F',
    birthPlace: 'Birthplace', birthPlacePh: 'Tap to search city',
    relation: 'Relation', submit: 'Calculate · Register',
    birthTimeSijin: 'Birth time (Sijin)', timeUnknown: 'Unknown', selfLabel: 'Self',
    relationCustom: 'Custom', relationCustomPh: 'Enter relation (e.g. my boss)',
    birthPlaceSearch: 'Search city/region', birthPlaceSearchPh: 'e.g. Seoul, Tokyo', useAsIs: "Use '{{q}}'",
    limitTitle: 'Free registration limit', limitMsg: 'The free plan lets you register up to {{limit}} charts.\nUpgrade to Pro for unlimited registrations.',
    upgrade: 'Upgrade to Pro', usage: 'Charts {{count}}/{{limit}}',
  },
  myeongsik: {
    palja: 'Four Pillars', dayMaster: 'Day Master', strength: 'Strength index', pattern: 'Pattern',
    stages: '12 Stages', interactions: 'Combos/Clashes', sinsal: 'Sinsal/Void', gongmang: 'Void',
    noHit: 'no natal hit', ziwei: 'Zi Wei', lifePalace: 'Life Palace',
    note: '※ Useful god & reading are separate. The chart is deterministic (rule-based), so it is accurate.',
    readingBtn: 'See area readings →', noChart: 'No chart data.',
    timeUnknownNote: '※ Birth time unknown — hour pillar & time-based readings are excluded.',
    paljaHint: '※ Traditional layout — Year pillar on the right', root: 'Root', hidden: 'Hidden stems',
    luck: 'Luck cycles', daewoon: 'Decade', sewoon: 'Year', elements: 'Five elements',
    합: 'Combine', 충: 'Clash', 형: 'Punish', 해: 'Harm', 파: 'Break', 극: 'Control',
    sinsalHint: '✓ (pillar) if the branch is in the natal chart; otherwise it activates in luck cycles', ssLuck: 'in luck', dayPillar: 'Day pillar',
    sinsalDetail: 'Sinsal & Void in detail →',
  },
  reading: {
    title: 'Full Reading · Premium', sub: 'All 16 areas in one deep, precise reading. (Chart is free)',
    runAll: 'See full reading ({{count}})', progress: 'Reading ‘{{current}}’… ({{done}}/{{total}})', saveFail: 'Failed to save chart. Please try again.',
    ziweiTitle: 'Zi Wei · 12 Palaces · Premium', ziweiSub: 'All 12 palaces interpreted together. (Chart is free)',
    bannerPremium: 'Subscribed — unlimited readings', bannerTrial: '🎁 First reading free!',
    bannerGated: 'Pick an area to unlock via ad or subscription',
    base: 'Core', overlay: 'Now', remedy: 'Advice',
    premiumAlert: 'Premium Reading', premiumAlertMsg: 'Watch an ad or pay ₩2,500 for the deep reading.',
    watchAd: 'Watch ad (1x)', payPerUse: 'Pay ₩2,500', bannerPerUse: '₩2,500 per reading or watch an ad',
  },
  compat: {
    otherInfo: "Partner info (consent required)", otherDatePh: "Partner birth date 1992-07-03",
    otherTimePh: 'Birth time (blank if unknown)', analyze: 'Analyze',
    dayRelation: 'Day-master relation', harmonyTension: 'Harmony {{h}} · Tension {{t}}',
    usefulGod: 'Useful-god support', crossInter: 'Cross combos/clashes',
    note: '※ Deterministic only. Relationship reading is separate (paid).',
    needChart: 'Register your chart first to see compatibility.', registerMyChart: 'Register my chart',
  },
  category: {
    성격내면: 'Personality', 취업운: 'Job-seeking', 직장운: 'Career', 사업운: 'Business',
    금전소득운: 'Income', 투자편재운: 'Investment', 재물손재: 'Money/Loss', 연애운: 'Love',
    결혼배우자운: 'Marriage', 대인사회성: 'Social', 부모운: 'Parents', 형제운: 'Siblings',
    자식운: 'Children', 건강: 'Health', 학업자기계발: 'Study', 이동환경: 'Relocation',
  },
  today: { dayPillar: "Today's Day Pillar", note: "Today's energy. Detailed reading in Premium." },
  taro: { draw: 'Draw a card', reshuffle: 'Reshuffle', reversed: 'Reversed' },
  manse: { empty: 'No saved chart.', myChart: 'My Chart' },
  sinsal: { 도화: 'Peach Blossom', 역마: 'Travel Horse', 화개: 'Canopy', 천을귀인: 'Nobleman', 문창: 'Academic', 양인: 'Blade', 홍염: 'Romance', 괴강: 'Goegang', 백호: 'White Tiger' },
};

const ja = {
  appName: 'SyncFortune',
  tagline: '運命の方向を示す羅針盤',
  menu: {
    myeongsik: '命式登録', myeongsikDesc: '命式の登録·管理',
    manse: '万歳暦', manseDesc: '日付別四柱·チャート管理',
    ziwei: '紫微斗数', ziweiDesc: '命盤·12宮の星',
    taro: 'タロット', taroDesc: '今日のカード',
    today: '今日の運勢', todayDesc: '毎日変わる日運',
    compat: '相性', compatDesc: '関係力学の深い分析',
    premium: 'プレミアム鑑定', premiumDesc: '深い通変·全領域', premiumTag: 'プレミアム',
  },
  common: {
    back: '← 戻る', login: 'ログイン', signup: '新規登録', logout: 'ログアウト',
    comingSoon: '準備中です。', loginOptional: 'ログイン / 新規登録（有料·保存機能用 — 任意）',
    cancel: 'キャンセル', none: 'なし',
  },
  auth: {
    signin: 'ログイン', signupTitle: '新規登録', email: 'メール', password: 'パスワード（6文字以上）',
    toSignup: 'アカウントがありませんか？  新規登録', toSignin: 'すでにアカウントをお持ちですか？  ログイン',
    needInput: 'メールとパスワードを入力してください。', signupDone: '確認メールを送信しました。認証後にログインしてください。',
    or: 'または', google: 'Googleで続ける',
  },
  register: {
    name: '名前·愛称', namePh: '例：キムOO / 本人',
    birthDate: '生年月日 (YYYY-MM-DD)', birthDatePh: '1990-03-15',
    birthTime: '出生時刻 (HH:mm、不明なら空欄)', birthTimePh: '07:10',
    calendar: '新暦 / 旧暦', solar: '新暦', lunar: '旧暦',
    sex: '性別', male: '男', female: '女',
    birthPlace: '出生地', birthPlacePh: 'タップして都市検索',
    relation: '関係', submit: '命式計算 · 登録',
    birthTimeSijin: '出生時刻（時辰）', timeUnknown: '不明', selfLabel: '本人',
    relationCustom: '直接入力', relationCustomPh: '関係を入力（例：上司）',
    birthPlaceSearch: '都市·地域を検索', birthPlaceSearchPh: '例：ソウル、東京', useAsIs: "'{{q}}' をそのまま使用",
    limitTitle: '無料登録の上限', limitMsg: '無料プランは命式を{{limit}}件まで登録できます。\nプロにアップグレードすると無制限に登録できます。',
    upgrade: 'プロにアップグレード', usage: '命式 {{count}}/{{limit}}',
  },
  myeongsik: {
    palja: '八字', dayMaster: '日干', strength: '身強弱指標', pattern: '格局候補',
    stages: '十二運星', interactions: '合冲刑害', sinsal: '神殺·空亡', gongmang: '空亡',
    noHit: '原局hitなし', ziwei: '紫微斗数', lifePalace: '命宮',
    note: '※ 用神·通変は別途。命式は決定論（ルール）なので正確です。',
    readingBtn: '領域別鑑定を見る →', noChart: 'チャート情報がありません。',
    timeUnknownNote: '※ 出生時刻が不明 — 時柱・時間に基づく鑑定は除外されます。',
    paljaHint: '※ 伝統表記 — 右が年柱（年月日時）', root: '通根', hidden: '蔵干',
    luck: '大運·歳運', daewoon: '大運', sewoon: '歳運', elements: '五行分布',
    합: '合', 충: '冲', 형: '刑', 해: '害', 파: '破', 극: '剋',
    sinsalHint: '基準の地支が原局にあれば✓(柱)、なければ大運·歳運で作動', ssLuck: '運で', dayPillar: '日柱',
    sinsalDetail: '神殺·空亡をくわしく →',
  },
  reading: {
    title: '全領域鑑定 · プレミアム', sub: '16領域すべてを一度に深く精密な通変。（命式は無料）',
    runAll: '全体を見る（{{count}}件）', progress: '‘{{current}}’ 鑑定中… ({{done}}/{{total}})', saveFail: 'チャートの保存に失敗しました。',
    ziweiTitle: '紫微斗数 十二宮 · プレミアム', ziweiSub: '十二宮を一度に統合通変。（命盤は無料）',
    bannerPremium: '購読中 — 無制限通変', bannerTrial: '🎁 初回鑑定が無料！',
    bannerGated: '領域選択で広告または購読により通変が開きます',
    base: '本質', overlay: '現在', remedy: '処方',
    premiumAlert: 'プレミアム通変', premiumAlertMsg: '広告視聴または₩2,500決済で深い通変を見られます。',
    watchAd: '広告を見る（1回）', payPerUse: '₩2,500 決済', bannerPerUse: '1回 ₩2,500 または広告視聴',
  },
  compat: {
    otherInfo: '相手情報（同意が必要）', otherDatePh: '相手の生年月日 1992-07-03',
    otherTimePh: '出生時刻（不明なら空欄）', analyze: '相性分析',
    dayRelation: '日干関係', harmonyTension: '調和 {{h}} · 緊張 {{t}}',
    usefulGod: '用神相補', crossInter: '交差合冲',
    note: '※ 決定論まで。関係通変·助言は別途（有料）。',
    needChart: '相性を見るにはまず命式を登録してください。', registerMyChart: '命式を登録',
  },
  category: {
    성격내면: '性格·内面', 취업운: '就職運', 직장운: '職場運', 사업운: '事業運',
    금전소득운: '金銭·収入', 투자편재운: '投資運', 재물손재: '財物·損失', 연애운: '恋愛運',
    결혼배우자운: '結婚·配偶者', 대인사회성: '対人関係', 부모운: '両親運', 형제운: '兄弟運',
    자식운: '子女運', 건강: '健康', 학업자기계발: '学業·自己啓発', 이동환경: '移動·環境',
  },
  today: { dayPillar: '今日の日柱', note: '今日の気運です。詳しい通変はプレミアムで。' },
  taro: { draw: 'カードを引く', reshuffle: '引き直す', reversed: '逆位置' },
  manse: { empty: '登録された命式がありません。', myChart: '私の命式' },
  sinsal: { 도화: '桃花', 역마: '駅馬', 화개: '華蓋', 천을귀인: '天乙貴人', 문창: '文昌', 양인: '羊刃', 홍염: '紅艶', 괴강: '魁罡', 백호: '白虎' },
};

const resources = {
  ko: { translation: ko },
  en: { translation: en },
  ja: { translation: ja },
};

const device = Localization.getLocales()[0]?.languageCode ?? 'ko';
const lng = ['ko', 'en', 'ja'].includes(device) ? device : 'en';

i18n.use(initReactI18next).init({
  resources,
  lng,
  fallbackLng: 'en',
  // Hermes(RN)는 Intl.PluralRules 미탑재 → i18next 경고 발생. 운세 앱 문자열은
  // 복수형 규칙이 단순(한·영·일)하므로 v3 호환 모드로 처리해 경고 제거(폴리필 불요).
  // 타입 정의는 'v4'만 허용하나, Hermes(Intl.PluralRules 미탑재) 안전을 위해 런타임은 'v3' 유지 → 캐스트로 우회.
  compatibilityJSON: 'v3' as 'v4',
  interpolation: { escapeValue: false },
});

export default i18n;
