// app/src/lib/backend/useResumeReading.ts
// 앱이 **돌아왔을 때 서버가 이미 만들어 둔 결과를 주워 온다**.
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-13(태스크 #14 "연애 풀이 로딩창이 도중에 사라짐") 조사 중 발견.
//
// ■ 왜 필요한가 — 이건 **돈 문제**다
//   앱이 백그라운드로 가면 클라이언트 `fetch` 는 죽지만 **Edge 는 끝까지 만들어 `readings` 에 저장한다**
//   (실측: 궁합 57초 · 애정 87~103초). 복귀했을 때 그 캐시를 다시 읽지 않으면 사용자는
//   **"운을 쓰고 결과를 못 본"** 상태가 된다 — 서버엔 결과가 있는데 화면만 비어 있다.
//
// ■ 왜 훅인가
//   `CompatScreen`·`ReadingScreen`·`TimelineScreen` 은 각자 이 로직을 손으로 갖고 있었고,
//   expo-router 쪽 8개 화면(career·community·dream·gaeun·lifegraph·love·newyear·taemong)에는
//   **아예 없었다.** 같은 코드를 8번 더 복사하면 다음에 또 한 곳만 고쳐진다
//   ([[duplicate-ui-single-source]] — 세 곳이 각자 그려 색이 갈렸던 사고).
//   ⇒ 한 줄로 붙이는 공통 훅으로 만든다.
//
// ■ 안전(중요)
//   재조회는 **읽기 전용**이다. 결제도 생성도 다시 일으키지 않는다 — 비용 0 · 멱등.
//   그래서 복귀할 때마다 무조건 걸어도 안전하다.
//
// 사용:
//   useResumeReading(chartId, 'love', (content) => setReading(content));
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../supabase';
import { excludeMock } from '../core/testMode';  // 목업(tier='mock') 제외 — 실모드에서 목업 서빙 차단
import { appLang } from '../i18n';
import { logEvent } from './logger';

/**
 * 앱이 포그라운드로 돌아올 때 `readings` 캐시를 다시 읽어 결과를 회수한다.
 *
 * @param chartId  서버 명식 id. 없으면(로딩 전) 아무것도 하지 않는다.
 * @param category `readings.category` 값 — 화면마다 다르다('love'·'career'·'taemong'…).
 * @param onFound  캐시를 찾았을 때 호출. **이미 결과가 있으면 화면이 알아서 무시**하면 된다.
 * @param enabled  false 면 구독하지 않는다(예: 무료 화면·생성 안 하는 상태).
 *
 * ⚠️`onFound` 는 매 렌더 새로 만들어지는 함수여도 된다 — ref 로 최신 값을 잡아 두므로
 *   구독이 매번 재생성되지 않는다(리스너 누수·중복 방지).
 */
export function useResumeReading(
  chartId: string | null | undefined,
  category: string,
  onFound: (content: unknown) => void,
  enabled = true,
): void {
  const cb = useRef(onFound);
  cb.current = onFound;                       // 최신 콜백 유지 — 의존성에서 빼기 위해

  useEffect(() => {
    if (!enabled || !chartId) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        try {
          const { data } = await excludeMock(
            supabase.from('readings').select('content')
              .eq('chart_id', chartId).eq('category', category).eq('lang', appLang()),
          ).maybeSingle();
          if (data?.content) {
            logEvent('resume_reading_recovered', { category });   // 실제로 주워 온 경우만 기록
            cb.current(data.content);
          }
        } catch { /* 재조회 실패는 조용히 넘긴다 — 다음 복귀에 또 시도한다 */ }
      })();
    });
    return () => sub.remove();
  }, [chartId, category, enabled]);
}
