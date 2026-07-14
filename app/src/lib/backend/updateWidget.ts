// app/src/lib/backend/updateWidget.ts — 앱 → iOS 홈 위젯 데이터 브리지(오늘의 운세).
// ─────────────────────────────────────────────────────────────────────────
// 대표 명식의 '오늘의 운세'(결정론·온디바이스)를 App Group UserDefaults 에 써서 위젯이 읽게 한다.
//   위젯 Swift(targets/widget/index.swift)가 group.com.syncfortune.app 에서 today_headline/today_line 을 읽음.
//   ⚠️ ExtensionStorage 는 네이티브 모듈 → 전역 정적 import 금지(런치 크래시). 반드시 함수 내 lazy require.
//   위젯 미빌드(구버전)·명식 없음·실패는 조용히 무시(앱 동작과 무관).
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import { loadRepChart } from '../engine/myChart';
import { computeChart } from '../engine/engine';
import { getDailyFortune, dailyHeadline, dailyAlarmTip } from '../content/dailyFortune';

const APP_GROUP = 'group.com.syncfortune.app';

/** 대표 명식의 오늘 운세를 위젯 App Group 에 기록 + 위젯 새로고침. iOS 전용·실패 무시. */
export async function updateTodayWidget(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const rep = await loadRepChart();
    if (!rep) return;
    const saju = computeChart(rep.input).saju;              // 결정론 명식(오늘 운세용)
    const gz = getDailyFortune(0).dayGanZhi;                // 오늘 일주 간지(干支 2글자)
    const stem = gz[0] as any, branch = gz[1] as any;
    const headline = dailyHeadline(saju, stem, branch, 'day');
    const line = dailyAlarmTip(saju, stem, branch);
    // ★lazy require — 네이티브 모듈(ExtensionStorage)을 함수 호출 시점에만 로드(전역 import 시 런치 크래시).
    const { ExtensionStorage } = require('@bacons/apple-targets');
    const storage = new ExtensionStorage(APP_GROUP);
    storage.set('today_headline', headline);
    storage.set('today_line', line);
    ExtensionStorage.reloadWidget();
  } catch { /* 위젯 모듈 없음/명식 없음/계산 실패 = 무시 */ }
}
