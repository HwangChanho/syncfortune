// app/src/lib/talk/chatImages.ts — 대화에 곁들이는 **범용 그림** 목록(단일 출처)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-09-01: *"알맞은 이미지도 보내가면서 채팅치면 좋겠어 너무 뜬금없는 이미지말고
//                    사이즈도 알맞게"* → *"이미지는 범용으로 쓸꺼 새로 만들어야 할꺼 같아"*
//
// ■ ★왜 «범용 세트» 인가
//   우리에게 이미 있는 그림은 타로 78·일주 60인데 **너무 구체적**이라 일상 대화에 못 쓴다.
//   («돈 이야기» 에 타로 카드를 붙이면 그게 바로 Boss 가 말한 «뜬금없는 이미지» 다.)
//   ⇒ 대화에서 **되풀이되는 장면**만 골라 작은 세트를 만든다. 적을수록 잘 맞는다.
//
// ■ ★생성하지 않는다(Boss 판단 ㉮)
//   그때그때 그리면 무엇이든 그릴 수 있지만 ①장당 원가가 크고 ②뜬금없는 그림이 실제로 나온다.
//   ⇒ **정해 둔 목록에서만** 고른다. 목록에 없으면 **그냥 안 붙인다**(억지로 붙이지 않는다).
//
// ■ ⚠️그림이 아직 없으면 **아무 일도 일어나지 않는다**
//   `ready: false` 인 항목은 프롬프트에 실리지 않고 화면에도 안 뜬다.
//   ⇒ 그림이 준비되는 대로 `ready` 만 올리면 된다. 배선을 다시 만들 필요가 없다.
// ═══════════════════════════════════════════════════════════════════════════

/** 그림 한 장. */
export type ChatImage = {
  /** 마커에 적히는 열쇠 — 모델이 이 낱말로 고른다 */
  key: string;
  /** 언제 쓰는가 — **모델에게 그대로 보여 준다**. 좁게 적을수록 덜 뜬금없다 */
  when: string;
  /** 그림이 준비됐나. false 면 프롬프트에도 안 실리고 화면에도 안 뜬다 */
  ready: boolean;
};

/**
 * 범용 그림 목록.
 *
 * ★고르는 기준 — «대화에서 되풀이되는 **장면**» 이지 «주제» 가 아니다.
 *   주제(연애·재물·건강…)로 나누면 그림이 끝없이 필요하다. 장면은 열댓 개면 덮인다.
 * ⚠️추가할 때: `when` 을 **한 문장**으로, 겹치지 않게. 겹치면 모델이 아무거나 고른다.
 */
export const CHAT_IMAGES: ChatImage[] = [
  { key: 'greet',     when: '처음 인사할 때', ready: false },
  { key: 'timing',    when: '시기·때를 말할 때(지금은 이르다·곧이다)', ready: false },
  { key: 'wait',      when: '기다려야 하는 구간을 말할 때', ready: false },
  { key: 'go',        when: '움직일 때가 됐다고 말할 때', ready: false },
  { key: 'money',     when: '돈·재물 이야기', ready: false },
  { key: 'work',      when: '일·직업·진로 이야기', ready: false },
  { key: 'love',      when: '연애·인연 이야기', ready: false },
  { key: 'family',    when: '가족·부모·자식 이야기', ready: false },
  { key: 'rest',      when: '지쳐 보일 때·쉬라고 말할 때', ready: false },
  { key: 'cheer',     when: '힘든 이야기 끝에 다독일 때', ready: false },
  { key: 'caution',   when: '조심할 구간을 말할 때(겁주지 않고)', ready: false },
  { key: 'change',    when: '이동·변화·전환을 말할 때', ready: false },
  { key: 'study',     when: '공부·시험 이야기', ready: false },
  { key: 'health',    when: '몸 관리 이야기(의료 아님)', ready: false },
  { key: 'congrats',  when: '좋은 소식을 축하할 때', ready: false },
  { key: 'thinking',  when: '더 생각해 봐야 한다고 말할 때', ready: false },
];

/** 지금 쓸 수 있는 것만. */
export function readyImages(): ChatImage[] {
  return CHAT_IMAGES.filter((x) => x.ready);
}

/** 열쇠가 **우리 목록에 있는가**(모델이 지어낸 이름을 막는다). */
export function isKnownImage(key: string): boolean {
  return CHAT_IMAGES.some((x) => x.key === key && x.ready);
}

/**
 * 화면에 그릴 크기 — **말풍선 폭에 맞춘다**(Boss *"사이즈도 알맞게"*).
 * ★가로세로 비를 고정한다(4:3) — 그림마다 크기가 다르면 대화가 들쭉날쭉해진다.
 */
export const CHAT_IMAGE_ASPECT = 4 / 3;
/** 말풍선 안 그림의 최대 가로(pt). 넘으면 대화가 그림에 먹힌다. */
export const CHAT_IMAGE_MAX_W = 220;

// ═══════════════════════════════════════════════════════════════════════════
// 유저가 **보내는** 그림 — 값과 크기
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 보내기 전에 줄이는 **긴 변**(px).
 *
 * ⚠️★이 숫자가 곧 돈이다. 클로드는 이미지를 `(가로×세로)/750` 토큰으로 읽는다:
 *   · 원본 4032×3024 → 16,258토큰 → 읽기만 ₩17.9(Haiku)·₩71.5(Opus)
 *   · 1568 로 줄이면 →  2,459토큰 → 읽기만  ₩2.7      ·₩10.8   (**6배 싸다**)
 *   1568 위로는 클로드가 어차피 줄여서 읽으므로 더 보내 봐야 **돈만 더 낸다.**
 */
export const UPLOAD_MAX_EDGE = 1568;

/**
 * 그림 한 장을 보내는 값(운).
 *
 * ★Boss 2026-09-01 *"운 갯수는 api비용에 맞춰서 마진률 90이상으로"* — 실측으로 정했다.
 *   가장 불리한 팩 기준 운당 실수령 ₩52.4, 이미지 턴 원가(1568 기준):
 *   · 보통 상담가(Haiku) ₩23.4 → **5운**이면 마진 **91.1%** ✅
 *   · 깊은 상담가(Opus)  ₩31.5 → **8운**이면 마진 **92.5%** ✅ (5운이면 88%로 미달)
 * ⚠️상담가의 `coin_cost` 가 아니라 **모델**로 갈린다 — 값을 정하는 건 원가다.
 */
export const IMAGE_COST = { normal: 5, deep: 8 } as const;

/** 이 상담가에게 그림을 보내면 몇 운인가. */
export function imageCostFor(model: string | null | undefined): number {
  return /opus/i.test(String(model ?? '')) ? IMAGE_COST.deep : IMAGE_COST.normal;
}
