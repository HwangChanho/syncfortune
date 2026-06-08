// app/src/lib/dailyFortune.ts — 오늘의 일진 (무료, 온디바이스 결정론)
// ─────────────────────────────────────────────────────────────────────────
// lunar-javascript 로 오늘 날짜의 간지(년·월·일주)를 계산. 무료=일진 데이터까지,
// 본인 일간 대비 십신·통변(해석)은 프리미엄(추후). 서버·LLM 0.
// ─────────────────────────────────────────────────────────────────────────
import { Solar } from 'lunar-javascript';

export function getDailyFortune() {
  const d = new Date();
  const solar = (Solar as any).fromDate(d);
  const lunar = solar.getLunar();
  return {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    dayGanZhi: lunar.getDayInGanZhi() as string, // 오늘 일주 간지(干支)
    monthGanZhi: lunar.getMonthInGanZhi() as string,
    yearGanZhi: lunar.getYearInGanZhi() as string,
  };
}
