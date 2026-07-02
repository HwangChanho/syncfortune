// app/src/components/ContentAdGate.tsx
// ─────────────────────────────────────────────────────────────────────────
// 무료 온디바이스 콘텐츠 광고 게이트(daniel 07-02):
//   홈 진입 보상형 광고를 제거(이중광고·첫 탭 무반응 원인)한 대신, 각 무료 콘텐츠 화면 *안에서*
//   '광고 보고 보기' 1회 시청 후 내용을 표시한다 = "진입은 즉시, 보기 전 광고 1회" 흐름 통일.
// 규칙:
//   · 프리미엄 = 무광고(바로 열림)
//   · 광고 모듈 없음(재빌드 전 dev client) = 바로 열림(게이트가 dev에서 영구 잠기는 것 방지)
//   · 같은 세션에 이미 광고 본 콘텐츠 = 재광고 안 함(뒤로/재진입 시 반복 방지 — 앱 재실행 시 초기화)
// 사용:
//   const gate = useContentGate('bok', { title: '타고난 복' });
//   ...로딩/명식없음 early-return 뒤에...
//   if (gate) return gate;   // 잠김 = 게이트 화면 / null = 열림(아래 내용 그대로 렌더)
// ─────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, type ReactElement } from 'react';
import { View, Text, Pressable, ActivityIndicator, ImageBackground, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '../lib/billing/subscription';
import { showRewardedAd, adsAvailable } from '../lib/core/ads';
import { useFontScale } from '../lib/ui/fontScale';
import { bgSource, colors, radius, space, shadow, font } from '../lib/theme';

// 세션 동안 광고로 연 콘텐츠 키 집합 — 재진입 시 재광고 안 함(앱 재실행 시 자연 초기화).
const sessionUnlocked = new Set<string>();

/**
 * 무료 콘텐츠 광고 게이트 훅. 반환:
 *   null      → 열림(프리미엄/광고모듈없음/이미 시청) → 호출 화면이 내용을 그대로 렌더
 *   ReactElement → 잠김 → 그대로 early-return 하면 광고 게이트 화면 표시('광고 보고 보기')
 */
export function useContentGate(contentKey: string, opts?: { title?: string; sub?: string }): ReactElement | null {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const { isPremium } = useSubscription();
  // 통과 조건: 프리미엄 / 광고 모듈 없음(dev) / 이 세션에 이미 광고 봄.
  const canBypass = () => isPremium || !adsAvailable() || sessionUnlocked.has(contentKey);
  const [unlocked, setUnlocked] = useState(canBypass);
  const [loadingAd, setLoadingAd] = useState(false);
  const [err, setErr] = useState(false);
  // 프리미엄 상태가 뒤늦게 로드되거나 세션 언락이 갱신되면 열림 반영.
  useEffect(() => { if (canBypass()) setUnlocked(true); }, [isPremium, contentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const watch = useCallback(async () => {
    setLoadingAd(true); setErr(false);
    let earned = false;
    try { earned = await showRewardedAd(); } catch { /* 닫기/실패 */ }
    setLoadingAd(false);
    if (earned) { sessionUnlocked.add(contentKey); setUnlocked(true); } // 시청 완료 → 이 세션 동안 열림
    else setErr(true);                                                  // 미시청/실패 → 재시도 안내
  }, [contentKey]);

  if (unlocked) return null; // 열림 — 호출 화면이 내용 렌더

  return (
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={[styles.title, { fontSize: fs(20) }]}>{opts?.title ?? t('adgate.title', '내용 보기')}</Text>
          <Text style={[styles.desc, { fontSize: fs(14) }]}>{opts?.sub ?? t('adgate.desc', '짧은 광고 하나만 보면 무료로 볼 수 있어요.')}</Text>
          {loadingAd ? (
            // 광고 로딩 인디케이터(daniel: 로딩중임을 알려야) — showRewardedAd 대기 동안 표시
            <View style={styles.loadingRow}><ActivityIndicator color={colors.ju} /><Text style={[styles.loadingTx, { fontSize: fs(13) }]}>{t('adgate.loading', '광고 불러오는 중…')}</Text></View>
          ) : (
            <>
              {err ? <Text style={[styles.err, { fontSize: fs(13) }]}>{t('today.adFail', '광고를 불러오지 못했어요. 잠시 후 다시 시도하거나, 프리미엄으로 광고 없이 보실 수 있어요.')}</Text> : null}
              <Pressable style={styles.btn} onPress={watch}><Text style={styles.btnTx}>{t('adgate.watch', '광고 보고 무료로 보기')}</Text></Pressable>
            </>
          )}
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(6) },
  card: { width: '100%', backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, padding: space(6), alignItems: 'center', ...shadow.card },
  title: { ...font.heading, color: colors.ink, textAlign: 'center', marginBottom: space(2) },
  desc: { color: colors.inkSoft, textAlign: 'center', lineHeight: 22, marginBottom: space(5) },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  loadingTx: { color: colors.inkSoft },
  err: { color: '#E5484D', textAlign: 'center', marginBottom: space(3), lineHeight: 20 },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), paddingHorizontal: space(6), alignItems: 'center' },
  btnTx: { color: colors.bg, fontWeight: '900', fontSize: 15 },
});
