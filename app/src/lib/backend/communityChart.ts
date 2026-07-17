// app/src/lib/backend/communityChart.ts — 커뮤니티 게시물에 첨부되는 명식의 **계약 + 화이트리스트 변환**
// ─────────────────────────────────────────────────────────────────────────
// ★여기가 보안 경계다. 게시물 읽기 권한 = authenticated 전원이고, 이 앱은 익명 세션을 상시 발급하므로
//   (Apple 5.1.1 대응) 실질적으로 **앱 설치자 누구나** 게시물 JSON 을 REST 로 그대로 읽는다.
//   그래서 "무엇을 넣는가"가 아니라 **"무엇만 넣는가"** 를 아래 타입·변환 함수가 화이트리스트로 강제한다.
//   화면에서 안 그리는 것은 방어가 아니다 — 안 올리는 것만이 방어다.
//
// 제외 대상과 이유(전부 2026-07-16 실측):
//   - **원시 ChartInput(생년월일시·성별·출생지)**: 절대 금지. 계산이 끝난 결과만 싣는다(CLAUDE.md 규칙8).
//   - **luckCycles(전 생애 대운)**: ①대운은 성별에 따라 순행/역행이 갈리고 시작 나이가 절기까지의 일수로
//     정해져 **생일 역산의 재료**가 된다 ②대운 12 × 세운 10 × 월운 12 = 시간축 객체 1,440개 =
//     **99.3KB/건 중 90.7KB**(pillars 는 0.9KB)라 응답을 통째로 부풀린다. 화면이 그리는 건 *현재* 대운·세운뿐.
//   - **show_luck=false 면 currentLuck·annual 자체를 넣지 않는다**: 작성자가 시기 공개를 선택하지 않았는데
//     데이터만 실려 가면 화면에 안 보여도 API 로 읽힌다.
//   - **structure(격국·용신·병약·문파 판정 = 인코딩된 전문가 레이어)**: 앱 온디바이스 buildSajuChart 는
//     애초에 채우지 않지만(실측 확인), 나중에 채워지더라도 게시물로 새지 않도록 화이트리스트가 막는다.
//   - **ziwei.decades(자미 대한)·minorStars·brightness·사화**: 명반 요약 표시에 불필요.
//   → 실측 절감: 103.7KB → 1.9KB (-98.2%).
// ⚠️ 그래도 **원국 여덟 글자만으로 생년월일 역산이 가능**하다(연주=60갑자·월일시주로 날짜 특정).
//   → 첨부는 relation='self'(본인) 명식만 허용하고, 작성 화면에서 이 사실을 고지한 뒤 동의받는다.
//
// ★이 파일은 **의존이 없다**(타입 import 만). 그래서 supabase/react-native 없이 node 로 직접 돌려
//   검증할 수 있다 — `npm run check:sharedchart` 하네스가 실제로 이 함수를 호출해 유출을 잡는다.
//   (community.ts 는 supabase 를 import 하므로 거기 두면 검증 스크립트가 react-native 를 끌고 와 죽는다.)
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, LuckCycle, AnnualPillar } from '@spec/chart';

export type SharedSaju = {
  pillars: SajuChart['pillars'];           // 원국 여덟 글자(지장간·통근 포함 — 날것 보존, 규칙3)
  dayMaster: SajuChart['dayMaster'];       // 일간 = '나'
  interactions: SajuChart['interactions']; // 원국 내 합충형해
  currentLuck?: Omit<LuckCycle, 'annuals'>; // show_luck=true 일 때만. 현재 대운(초기 표시용)
  annual?: Omit<AnnualPillar, 'months' | 'interactionsWithLuck'>; // show_luck=true 일 때만. 현재 세운(초기 표시용)
  // ★(b) 여러 시기 대운/세운 넘겨보기(daniel 07-17): show_luck=true 면 전 생애 대운 + 각 대운의 세운 10년.
  //   ⚠️월운(months)·대운세운 상호작용(interactionsWithLuck)은 계속 제외 — 크기·세밀 시간축 관리(넘겨보기엔 간지·십신·연도면 충분).
  luckCycles?: (Omit<LuckCycle, 'annuals'> & { annuals?: Omit<AnnualPillar, 'months' | 'interactionsWithLuck'>[] })[];
};
export type SharedZiwei = {
  bureau: string;
  lifePalaceBranch: string;
  palaces: { name: string; branch: string; majorStars: { name: string }[] }[];
};

/**
 * 온디바이스 계산 결과 → 게시물 첨부용 사주 스냅샷(화이트리스트).
 * @param saju computeChart(input).saju — 작성자 기기에서 계산이 끝난 SajuChart
 * @param showLuck 작성자가 대운·세운 공개를 선택했는가. false 면 시간축 필드를 **아예 만들지 않는다**.
 * @returns 서버에 올려도 되는 필드만 담은 객체(원시 PII·전 생애 시간축·해자 판정 없음)
 */
export function toSharedSaju(saju: SajuChart, showLuck: boolean): SharedSaju {
  const out: SharedSaju = {
    pillars: saju.pillars,
    dayMaster: saju.dayMaster,
    interactions: saju.interactions ?? [],
  };
  if (showLuck && saju.currentLuck) {
    const { annuals: _drop, ...luck } = saju.currentLuck; // 현재 대운(초기 표시). 이 대운의 세운은 luckCycles 에 있음
    out.currentLuck = luck;
  }
  if (showLuck && saju.annual) {
    const { months: _m, interactionsWithLuck: _i, ...ann } = saju.annual; // 현재 세운(초기 표시)·월운·상호작용 제외
    out.annual = ann;
  }
  if (showLuck) {
    // ★(b) 전 생애 대운 + 각 대운 세운(월운·상호작용 제외). SharedChart 넘겨보기용.
    out.luckCycles = (saju.luckCycles ?? []).map((lc) => {
      const { annuals, ...rest } = lc;
      return {
        ...rest,
        annuals: (annuals ?? []).map((a) => { const { months: _m, interactionsWithLuck: _i, ...ann } = a; return ann; }),
      };
    });
  }
  return out;
}

/**
 * 자미두수 산출물 → 게시물 첨부용 명반 스냅샷(화이트리스트).
 * @param ziwei computeChart(input).ziwei — iztro 산출물이라 any 로 방어적으로 다룬다
 * @returns 12궁 × (궁 이름·지지·주성 이름)만. 명반이 아니면(palaces 없음) null.
 */
export function toSharedZiwei(ziwei: any): SharedZiwei | null {
  if (!ziwei || !Array.isArray(ziwei.palaces)) return null;
  return {
    bureau: String(ziwei.bureau ?? ''),
    lifePalaceBranch: String(ziwei.lifePalaceBranch ?? ''),
    palaces: ziwei.palaces.map((p: any) => ({
      name: String(p?.name ?? ''),
      branch: String(p?.branch ?? ''),
      majorStars: (p?.majorStars ?? []).map((s: any) => ({ name: String(s?.name ?? '') })),
    })),
  };
}
