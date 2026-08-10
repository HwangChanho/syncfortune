// engine/attachSpouseAxis.ts — R-ATTACH **v2 · 배우자성 균형 축** (결정론 · API 0)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 근거 = 상담가 판정 2026-08-10 `verify-000e-attach` **원문 그대로**
//   `#13`·`#14`·`#15` 세 문항에 같은 답을 주셨다(= 그만큼 분명하다는 뜻으로 읽었다):
//     > 남자사주에 **재성의 유무와 관련없이 정재 입장**에서 본다. (여자는 **정관**).
//     > 일간이 **감당 가능하면 안정형**이고, **감당이 어려우면 회피형**이다.
//     > 안정이나 회피가 **극단으로 가면 불안정**이다.
//
// ■ ★왜 `attachAxes.ts`(v0)를 고치지 않고 새 파일인가
//   v0 는 축 배정이 **15/15 X 로 전건 기각**됐다. 같은 파일에서 갈아끼우면
//   이미 수집된 v0 응답과 값이 섞여 **회귀 비교가 불가능**해진다. 층을 갈라 둔다.
//   (v0 는 화면에서 내려가지만 코드·수집 스키마는 그대로 보존한다.)
//
// ■ 여기서 내가 **정한 것**과 **정하지 않은 것**을 분명히 한다
//   ✔ 정해진 것 — 전부 상담가 원문이거나 이미 판정받아 엔진에 있는 값이다:
//     · **바라보는 자리** = 남 정재 / 여 정관 (원문)
//     · **재는 것** = 일간이 그 자리를 감당하는 정도 (원문)
//     · **결과의 모양** = 안정 ↔ 회피 **한 축**, 양 끝이 불안정 (원문)
//     · 일간 쪽 힘 = **뿌리 + 통관**(`000h#11` O) · 상대 자리의 세기 = `analyzeTenGods().detail`
//   ✘ 정하지 **않은** 것 — 판정에 없어서 비워 뒀다(`verify-000h-magnitude` D 로 되물음):
//     · **'감당 가능'의 기준**이 신강약인지(D#10) 뿌리·통관인지(D#11) → 그래서 **동일 가중**으로 둔다
//     · **'극단'의 경계**(D#12) → 그래서 **유형을 선언하지 않는다.** 위치만 낸다.
//     · **무재(無財)/무관 명식**을 어디로 보는지(D#13) → 점수에 섞지 않고 **플래그로 따로** 낸다.
//   ⇒ 임계값이 없어도 **스펙트럼 위 위치**는 말할 수 있다. 그게 이 파일이 내는 전부다.
// ═══════════════════════════════════════════════════════════════════════════
import { analyzeTenGods } from './structure';   // ★classifyStrength(신강약)는 000h#10(X)로 안 쓴다
import { STEM_ELEM } from './saju';
import type { SajuChart, PillarPos, Element } from '../spec/chart';

const POS: PillarPos[] = ['년', '월', '일', '시'];
const ORDER: Element[] = ['木', '火', '土', '金', '水']; // 상생 순

/** 한 항목의 기여 — 점수만 보여 주면 반증이 불가능해지므로 근거를 항상 함께 낸다(전문가 §3). */
export type SpouseContribution = {
  /** 안정적인 키(로그·회귀 컬럼명). */
  key: string;
  /** 사람이 읽을 이름 — 명리 용어 그대로. */
  label: string;
  /** 0~1 정규화 기여도. */
  value: number;
  /** 이 값이 축을 어느 쪽으로 미는가. `자립`=안정 쪽 · `부담`=회피 쪽. */
  side: '자립' | '부담';
};

export type SpouseCapacityAxis = {
  /** 바라보는 자리 — 남 정재 / 여 정관 (상담가 원문). */
  target: '정재' | '정관';
  /**
   * 일간 쪽 힘 0~1 — `#11`(O) *"**뿌리와 통관**을 갖췄는지"*.
   * 뿌리 = 일간 오행의 통근량 · 통관 = 그 자리로 힘을 흘려 주는 십신(남=식상 → 재 / 여=재성 → 관).
   * ★신강약(득령·득지·득세)은 **쓰지 않는다** — `#10`(X)이 그것을 부정했다.
   */
  selfStand: number;
  /** 상대 자리의 힘 0~1 = 십신 세기 / 전체 세기 합. */
  objectLoad: number;
  /**
   * **감당** = 두 힘이 얼마나 **비슷한가**. 0~1(1 = 완전히 균형).
   * 상담가 원문: *"일간의 힘과 재성의 힘이 **비슷해야 한다**. 한쪽이라도 강해지면 **강해진 만큼 문제**된다."*
   * ⇒ `1 − |selfStand − objectLoad|`. 강약이 아니라 **균형**이 축이다.
   */
  capacity: number;
  /**
   * 치우침의 **방향과 크기** −1 ~ +1. `selfStand − objectLoad`.
   * · `−` 일간이 부친다(상대가 버겁다) · `+` 일간이 남는다(상대가 가볍다)
   * ★어느 쪽이든 **치우친 만큼** 문제다 — 원문 *"한쪽이라도 강해지면 강해진 만큼"*.
   */
  tilt: number;
  /** 화면 스펙트럼용 좌표 0~1 (0.5 = 균형). 판정이 아니라 표시 좌표다. */
  position: number;
  /** 상대 자리가 원국에 **드러나 있는가**(천간 투출 또는 지지 본기). 무재/무관 판정은 하지 않고 사실만 낸다. */
  objectPresent: boolean;
  contributions: SpouseContribution[];
  /** 산정 방식. 회귀 가중으로 바뀌면 여기가 바뀐다 — 결과를 비교할 때 반드시 같이 볼 것. */
  version: 'v2-balance';
};

/** 0~1 로 자르기. */
const c01 = (n: number) => Math.max(0, Math.min(1, n));
/** 소수 2자리 반올림 — 화면·로그에서 값이 흔들리지 않게. */
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 일간 기준 **정재 / 정관**의 오행을 돌려준다(정의상 고정 — 관법 판정 아님).
 * 재성 = 내가 극하는 오행(상생 순 +2) · 관성 = 나를 극하는 오행(+3).
 * ※'정(正)'과 '편(偏)'은 음양이 다른 쪽/같은 쪽이라 십신 이름으로 직접 집계한다(아래 detail 사용).
 */
function targetElement(saju: SajuChart, target: '정재' | '정관'): Element {
  const me = STEM_ELEM[saju.pillars['일'].stem];
  const i = ORDER.indexOf(me);
  return target === '정재' ? ORDER[(i + 2) % 5] : ORDER[(i + 3) % 5];
}

/**
 * 성인 애착 — **배우자성 균형 축** v2.
 *
 * @param saju 원국. **대운·세운은 쓰지 않는다** — 이 층은 trait(구조)다(전문가 §2).
 * @param sex  '남' → 정재를 본다 · '여' → 정관을 본다 (상담가 원문. 성별이 없으면 계산하지 않는다).
 * @returns 균형 축 한 개 + 근거. **유형(안정/회피/불안정)을 선언하지 않는다** — '비슷하다'의 폭이 판정에 없다.
 *
 * @example
 *   const ax = spouseCapacityAxis(saju, '남');
 *   ax.target      // '정재'
 *   ax.capacity    // 0.82 → 두 힘이 꽤 비슷하다(균형)
 *   ax.tilt        // -0.18 → 일간 쪽이 조금 부친다(상대가 버거운 쪽)
 */
export function spouseCapacityAxis(saju: SajuChart, sex: '남' | '여'): SpouseCapacityAxis {
  const target: '정재' | '정관' = sex === '남' ? '정재' : '정관';

  // ── ① 일간 쪽 힘 = **뿌리 + 통관** (`000h#11` O) ─────────────────────────────
  //   *"신강약이 아니라 일간이 그 정재를 다룰 **뿌리와 통관**을 갖췄는지"* → O.
  //   ★`classifyStrength`(득령·득지·득세)를 **쓰지 않는다** — `#10`(X)이 신강약 기준을 부정했다.
  //   · 뿌리 = 일간 오행(비겁)의 세기 몫
  //   · 통관 = 일간의 힘을 그 자리로 **흘려 주는** 십신의 몫
  //     남(정재) → 식상이 재를 생한다 / 여(정관) → 재성이 관을 생한다. 이건 상생 순서라 정의상 고정이다.
  const tg = analyzeTenGods(saju);
  const total = Object.values(tg.detail).reduce((a, b) => a + b, 0) || 1;
  const share = (...names: string[]) => r2(c01(names.reduce((a, n) => a + (tg.detail[n] ?? 0), 0) / total));

  const rootShare = share('비견', '겁재');                                   // 뿌리
  const bridgeShare = target === '정재' ? share('식신', '상관') : share('정재', '편재'); // 통관
  //   ⚠️둘을 어떤 비율로 섞을지는 판정에 없다 → **그냥 더한다**(둘 다 일간 쪽 힘이라 같은 단위다).
  //     비율을 고르는 순간 그건 판정이 아니라 내 발명이 된다.
  const selfStand = r2(c01(rootShare + bridgeShare));

  // ── ② 상대 자리의 힘 ────────────────────────────────────────────────────────
  const objectLoad = share(target);

  // 상대 자리가 **드러나 있는가** — 천간 투출(년월시) 또는 지지 본기.
  //   `#13`(O) 없어도 판정은 선다 → 점수에 안 섞고 사실만 플래그로 낸다.
  const objectPresent = POS.some((p) =>
    (p !== '일' && saju.pillars[p].stemTenGod === target) || saju.pillars[p].branchMainTenGod === target);

  // ── ③ 감당 = **두 힘이 얼마나 비슷한가** ────────────────────────────────────
  //   상담가 원문: *"일간의 힘과 재성의 힘이 **비슷해야 한다**. 한쪽이라도 강해지면 **강해진 만큼 문제**된다."*
  //   ⇒ 강약(어느 쪽이 큰가)이 아니라 **차이의 크기**가 문제다. 방향은 `tilt` 로 따로 낸다.
  const tilt = r2(selfStand - objectLoad);
  const capacity = r2(1 - Math.abs(tilt));
  const position = r2(c01((tilt + 1) / 2));   // −1..+1 → 0..1 (0.5 = 균형 · 표시 좌표일 뿐)

  const targetElem = targetElement(saju, target);
  const contributions: SpouseContribution[] = [
    { key: 'root', label: '뿌리(비겁)가 차지한 몫', value: rootShare, side: '자립' },
    { key: 'bridge', label: `통관(${target === '정재' ? '식상' : '재성'})이 차지한 몫`, value: bridgeShare, side: '자립' },
    { key: 'object', label: `${target}(${targetElem})이 차지한 몫`, value: objectLoad, side: '부담' },
  ];

  return { target, selfStand, objectLoad, capacity, tilt, position, objectPresent, contributions, version: 'v2-balance' };
}
