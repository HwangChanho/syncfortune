// app/src/components/Onboarding.tsx — 첫 실행 자기이해 온보딩 (App Store 4.3 대응)
// ─────────────────────────────────────────────────────────────────────────
// 목적: 리뷰어(신규 설치)가 앱을 열자마자 '운세 카드 그리드'(=운세 콘텐츠 마켓=스팸 신호)를 보는 대신,
//   "팔자는 사주를 엔진으로 쓰는 AI 자기이해 도구"라는 3단 여정을 먼저 보게 한다. 4.3(b) '또 다른 운세앱'
//   인상을 첫 화면에서 흔드는 게 핵심(어필문·메타데이터와 세트).
// 노출 규칙: 신규 설치 1회만. ①플래그(SecureStore)가 있으면 스킵 ②이미 명식을 등록한 기존 유저는 스킵(플래그 세팅)
//   ③둘 다 아니면(진짜 신규 = 리뷰어 포함) 노출. CTA '내 분석 시작하기' → 명식 등록(/register)으로 자기이해 여정 시작.
// 테마: 앱 테마 토큰(colors/space/font)을 그대로 사용 → 라이트(한지)·다크(미드나잇) 어느 쪽이든 자동 일치.
// 결제·프리미엄 로직 없음(순수 온보딩). _layout 에서 스플래시가 끝난 뒤(!splash) 렌더.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as SecureStore from 'expo-secure-store';
import { PressableScale } from './PressableScale';
import { colors, space, radius, shadow } from '../lib/theme';

const FLAG = 'palja_onboarding_seen_v3'; // 온보딩 노출 이력 플래그. v3(daniel 07-12) = 4번째 '미리보기' 단계(성향 분석 샘플카드) 추가 → 전 유저 재노출. v2=명식보유 자동스킵 폐지.

// ★관리자 온보딩 토글(daniel 2026-07-12) — 설정(관리자)에서 온보딩을 켜고(재노출) 끌(숨김) 수 있게. reshow=마운트된 Onboarding 에 즉시 표시 신호.
const reshowSubs = new Set<() => void>();
/** 온보딩이 다음에 노출될지(=이력 플래그 없음). 관리자 토글의 현재 상태 표시용. */
export async function isOnboardingEnabled(): Promise<boolean> {
  try { return !(await SecureStore.getItemAsync(FLAG)); } catch { return false; }
}
/** 관리자 토글 — on=이력 삭제 후 *즉시* 재노출(테스트) / off=봤음 처리(다음 실행부터 숨김). */
export function setOnboardingEnabled(on: boolean): void {
  if (on) { SecureStore.deleteItemAsync(FLAG).catch(() => {}); reshowSubs.forEach((f) => f()); }
  else { SecureStore.setItemAsync(FLAG, '1').catch(() => {}); }
}

export function Onboarding() {
  const { t } = useTranslation();
  const router = useRouter();
  // loading: 노출 여부 판정 중(null 렌더) / show: 노출 / hidden: 스킵(기존 유저·이미 봄)
  const [phase, setPhase] = useState<'loading' | 'show' | 'hidden'>('loading');
  const [step, setStep] = useState(0);

  // 노출 판정(마운트 1회) — 온보딩 이력(플래그)만으로. 명식 보유로 자동스킵하던 것 폐지.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const seen = await SecureStore.getItemAsync(FLAG);
        if (!alive) return;
        // ★플래그(이력) 없으면 노출 — 신규·기존 유저 무관(daniel 07-11: 기존 가입자도 아직 안 봤으면 자기이해 포지셔닝 1회 각인).
        setPhase(seen ? 'hidden' : 'show');
      } catch { if (alive) setPhase('hidden'); } // 판정 실패 = 안전하게 스킵(앱 진입 막지 않음)
    })();
    return () => { alive = false; };
  }, []);

  // 관리자 토글 '켜기'(setOnboardingEnabled(true)) 시 마운트된 상태에서 즉시 재노출(첫 단계부터).
  useEffect(() => {
    const onReshow = () => { setStep(0); setPhase('show'); };
    reshowSubs.add(onReshow);
    return () => { reshowSubs.delete(onReshow); };
  }, []);

  // 완료/스킵 — 플래그를 세워 다시 안 뜨게 하고, go=true 면 명식 등록으로 이동(여정 시작).
  async function finish(go: boolean) {
    try { await SecureStore.setItemAsync(FLAG, '1'); } catch { /* 무시 */ }
    setPhase('hidden');
    if (go) router.push('/register');
  }

  if (phase !== 'show') return null;

  // 4단 여정 — 포지셔닝 → 개인화/엔진 → 가치(자기이해) → ★미리보기(성향 분석 샘플카드로 가치를 *보여줌*, daniel 07-12).
  const STEPS: { title: string; body?: string; bullets?: string[]; preview?: boolean }[] = [
    { title: t('onb.t1'), body: t('onb.b1') },
    { title: t('onb.t2'), body: t('onb.b2') },
    { title: t('onb.t3'), bullets: [t('onb.l1'), t('onb.l2'), t('onb.l3'), t('onb.l4')] },
    { title: t('onb.t4'), preview: true },
  ];
  const cur = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <View style={styles.overlay}>
      {/* 건너뛰기 — 실사용자 편의(리뷰어는 대개 여정을 따라감). 우상단. */}
      <View style={styles.topRow}>
        <PressableScale onPress={() => finish(false)} hitSlop={10} style={styles.skipBtn}>
          <Text style={styles.skipTxt}>{t('onb.skip')}</Text>
        </PressableScale>
      </View>

      {/* 본문 — 八字 심볼 + 타이틀 + (본문 or 불릿) */}
      <View style={styles.body}>
        <Text style={styles.glyph}>八字</Text>
        <Text style={styles.title}>{cur.title}</Text>
        {cur.body ? <Text style={styles.desc}>{cur.body}</Text> : null}
        {cur.bullets ? (
          <View style={styles.bullets}>
            {cur.bullets.map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>·</Text>
                <Text style={styles.bulletTxt}>{b}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {/* ★미리보기 — 성향 분석 '샘플' 카드(정적 예시). 리뷰어/유저가 등록 전에 '이건 성격분석 도구'임을 눈으로 확인. */}
        {cur.preview ? (
          <View style={styles.previewCard}>
            <View style={styles.pvBadgeRow}>
              <Text style={styles.pvBadge}>{t('onb.pvBadge', '예시')}</Text>
              <Text style={styles.pvType}>{t('onb.pvType', '테토형')}</Text>
            </View>
            <Text style={styles.pvScale}>{t('onb.pvScale', '테토 63%')}</Text>
            <View style={styles.pvTrack}><View style={styles.pvFill} /><View style={styles.pvDot} /></View>
            <View style={styles.pvScaleRow}>
              <Text style={styles.pvEnd}>{t('egen.scaleEgen', '에겐')}</Text>
              <Text style={styles.pvEnd}>{t('egen.scaleTeto', '테토')}</Text>
            </View>
            <Text style={styles.pvLine}>{t('onb.pvLine')}</Text>
            <Text style={styles.pvNote}>{t('onb.pvNote')}</Text>
          </View>
        ) : null}
      </View>

      {/* 진행 점 + CTA */}
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
          ))}
        </View>
        <PressableScale style={styles.cta} onPress={() => (last ? finish(true) : setStep(step + 1))}>
          <Text style={styles.ctaTxt}>{last ? t('onb.start') : t('onb.next')}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 전체 화면 불투명 오버레이(홈 위) — 테마 배경색이라 라이트/다크 자동 일치.
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    zIndex: 50,
    paddingHorizontal: space(8),
    paddingTop: space(14),
    paddingBottom: space(9),
  },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  skipBtn: { paddingVertical: space(1), paddingHorizontal: space(1) },
  skipTxt: { color: colors.inkFaint, fontSize: 15, fontWeight: '600' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  glyph: { color: colors.ju, fontSize: 46, fontWeight: '800', letterSpacing: 4, marginBottom: space(7) },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 35 },
  desc: { color: colors.inkSoft, fontSize: 16, lineHeight: 26, textAlign: 'center', marginTop: space(5), maxWidth: 340 },
  bullets: { marginTop: space(7), alignSelf: 'stretch', paddingHorizontal: space(2) },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: space(2) },
  bulletDot: { color: colors.ju, fontSize: 18, fontWeight: '900', marginRight: space(3), lineHeight: 24 },
  bulletTxt: { color: colors.ink, fontSize: 17, lineHeight: 24, flex: 1 },
  // ★미리보기 샘플 카드(성향 분석 예시) — 등록 전 '성격분석 도구' 각인
  previewCard: { alignSelf: 'stretch', marginTop: space(6), backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card },
  pvBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pvBadge: { fontSize: 11, fontWeight: '800', color: colors.inkFaint, backgroundColor: colors.sunk, paddingHorizontal: space(2.5), paddingVertical: space(0.75), borderRadius: radius.pill, overflow: 'hidden' },
  pvType: { fontSize: 15, fontWeight: '900', color: colors.ju },
  pvScale: { fontSize: 24, fontWeight: '900', color: colors.ink, marginTop: space(3) },
  pvTrack: { height: 8, backgroundColor: colors.line, borderRadius: 4, marginTop: space(3), position: 'relative' },
  pvFill: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '63%', backgroundColor: colors.ju, borderRadius: 4 },
  pvDot: { position: 'absolute', top: -5, left: '63%', width: 18, height: 18, borderRadius: 9, backgroundColor: colors.ju, borderWidth: 3, borderColor: colors.card, marginLeft: -9 },
  pvScaleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space(2) },
  pvEnd: { fontSize: 12, fontWeight: '700', color: colors.inkFaint },
  pvLine: { fontSize: 14, color: colors.ink, lineHeight: 21, marginTop: space(4) },
  pvNote: { fontSize: 12, color: colors.inkSoft, marginTop: space(3), textAlign: 'center' },
  bottom: { alignItems: 'center' },
  dots: { flexDirection: 'row', gap: space(2), marginBottom: space(6) },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.ju, width: 22 },
  cta: {
    alignSelf: 'stretch', backgroundColor: colors.ju, borderRadius: radius.pill,
    paddingVertical: space(4.5), alignItems: 'center', ...shadow.card,
  },
  ctaTxt: { color: colors.white, fontSize: 17, fontWeight: '800' },
});
