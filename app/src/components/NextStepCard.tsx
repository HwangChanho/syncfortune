// app/src/components/NextStepCard.tsx — 풀이 탭 최상단 '다음 단계' 히어로(퍼널 진입점)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-26: "리스트 카드형식 나열이라 가시성이 떨어져. 콘텐츠를 타고타고 들어가서
//   자연스럽게 다음 걸 구매하게 유도하고 싶어."
//
// 이 카드가 하는 일 = **저니의 첫 발을 대신 떼 준다.**
//   35장을 늘어놓고 "골라 보세요" 하는 대신, 지금 이 사람에게 맞는 **딱 한 장**을 크게 보여 준다.
//   여기서 들어가면 그 콘텐츠 하단의 `RelatedContent` 가 다음을 이어받아 '타고타고' 굴러간다.
//
// 위계: 이 카드(큰 이미지 히어로) → 섹션 목록(작은 행). 나열만 있던 화면에 1군을 만들어 가시성을 세운다.
// ★새 큐레이션 없음 — 추천 경로는 `RELATED`(상세 하단 크로스셀과 동일 출처)를 재사용(nextStep.ts).
// 자기완결형(다른 홈 블록과 동일 계약): 스스로 대표 명식·보유 풀이를 읽고, 권할 게 없으면 렌더하지 않는다.
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯. §4: 부담·재촉 톤 금지(권유까지만).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from './PressableScale';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import { loadRepChart } from '../lib/engine/myChart';
import { excludeMock } from '../lib/core/testMode';
import { appLang } from '../lib/i18n';
import { SECTIONS, priceLabel, baseKey } from '../lib/content/contentSections';
import { pickNextStep, ownedKeysFrom, type NextStep, type CategoryItem } from '../lib/content/nextStep';
import { CREDIT_KINDS } from '../lib/billing/coupons';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useHeroCap, HERO_CAP } from '../lib/ui/heroSize'; // ★웹 전폭 히어로 높이 상한(네이티브 무관)

// 키 → 라벨(유료는 CREDIT_KINDS 한글명, 그 외는 SECTIONS 라벨키). 단일 출처에서만 끌어온다.
const CREDIT_LABEL: Record<string, string> = Object.fromEntries(CREDIT_KINDS.map((c) => [c.key, c.ko]));

/** 키 → SECTIONS 메타(이미지·라우트·라벨키·설명키). 유료 creditKey / 무료 item.key 둘 다 해석. */
const META: Record<string, { image?: any; route: string; labelKey: string; descKey?: string; creditKey?: string }> = (() => {
  const m: Record<string, any> = {};
  for (const s of SECTIONS) {
    for (const it of s.items) {
      if (!it.ready) continue;
      const entry = { image: it.image, route: it.route, labelKey: it.labelKey, descKey: it.descKey, creditKey: it.creditKey };
      if (it.creditKey && !m[it.creditKey]) m[it.creditKey] = entry;
      if (!m[it.key]) m[it.key] = entry;
    }
  }
  return m;
})();

/**
 * 풀이 탭 '다음 단계' 히어로.
 * @param reloadKey 명식 전환 시 부모가 올려 재계산(ContentGrid 와 동일 계약).
 */
/** 풀이탭 상단 배너와 같은 콘텐츠 — 최근 본 게 없을 때 여기서부터 이어 간다(화면이 한 흐름이 되게). */
const ANCHOR_KEY = 'month';

export function NextStepCard({ reloadKey, category = null }: { reloadKey?: number; category?: string | null }) {
  const heroCap = useHeroCap(HERO_CAP.banner);   // 넓은 웹에서만 높이를 묶는다(폰·네이티브는 null)
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const { session } = useAuth();
  const [step, setStep] = useState<NextStep | null>(null);
  // 선택된 카테고리의 항목 — 순수 로직 모듈에 RN 의존을 넘기지 않으려고 여기서 뽑아 전달한다.
  const catItems: CategoryItem[] | undefined = category
    ? SECTIONS.find((s2) => s2.key === category)?.items.map((m) => ({ key: baseKey(m.key), creditKey: m.creditKey }))
    : undefined;

  useEffect(() => {
    let alive = true;
    (async () => {
      const rep = await loadRepChart();
      if (!alive) return;
      if (!rep) { setStep(null); return; }          // 명식 없음 → 홈의 '명식 등록' 안내가 먼저다
      const labelOf = (k: string) => CREDIT_LABEL[k] ?? (META[k] ? t(META[k].labelKey) : k);
      // 미로그인·서버차트 미해석이면 보유를 알 수 없다 → 시작점(사주 원국)을 권한다.
      if (!session || !rep.serverChartId) { setStep(pickNextStep(new Set(), labelOf, ANCHOR_KEY, catItems)); return; }
      const { data } = await excludeMock(supabase
        .from('readings').select('category, created_at')
        .eq('chart_id', rep.serverChartId).eq('lang', appLang()));
      if (!alive) return;
      const rows = (data ?? []) as { category: string; created_at: string }[];
      const owned = ownedKeysFrom(rows.map((r) => r.category));
      // 가장 최근에 본 것 = 그 지점에서 이어 간다(‘방금 본 것 → 다음’이 가장 자연스러운 연결)
      const last = [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
      setStep(pickNextStep(owned, labelOf, last ? last.category.split('_')[0] : ANCHOR_KEY, catItems));
    })().catch(() => { if (alive) setStep(null); });
    return () => { alive = false; };
  }, [reloadKey, session, t, category]);

  const meta = step ? META[step.key] : null;
  // 권할 게 없거나(전부 봄) 메타를 못 찾으면 렌더하지 않는다 — 빈 카드로 자리 차지하지 않게.
  if (!step || !meta) return null;

  const label = t(meta.labelKey);
  const price = meta.creditKey ? priceLabel(meta.creditKey) : null;

  return (
    <PressableScale style={heroCap ? [styles.card, heroCap] : styles.card} onPress={() => router.push(meta.route as any)}>
      {meta.image ? (
        <ExpoImage source={meta.image} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" transition={140} />
      ) : null}
      {/* 이미지 위 글씨 가독 스크림 — 어두운 타일이 많아 항상 밝은 글씨(ContentHero 와 같은 관례) */}
      <View style={styles.scrim} />
      <View style={styles.inner}>
        <Text style={[styles.kicker, { fontSize: fs(11) }]}>다음 단계</Text>
        <Text style={[styles.title, { fontSize: fs(22), lineHeight: Math.round(22 * 1.3) }]} numberOfLines={2}>{label}</Text>
        <Text style={[styles.reason, { fontSize: fs(13), lineHeight: Math.round(13 * 1.5) }]} numberOfLines={2}>{step.reason}</Text>
        <View style={styles.ctaRow}>
          <View style={styles.cta}><Text style={[styles.ctaTx, { fontSize: fs(14) }]}>보러 가기 ›</Text></View>
          {price ? <Text style={[styles.price, { fontSize: fs(12) }]}>{price}</Text> : null}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // 큰 히어로 — 아래 목록(작은 행)과 확실한 위계 차이를 만든다.
  card: { width: '100%', aspectRatio: 1.6, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.sunk, marginBottom: space(5), ...shadow.card },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,14,34,0.52)' },
  inner: { flex: 1, justifyContent: 'flex-end', padding: space(5) },
  kicker: { ...font.caption, color: colors.onImageSoft, fontWeight: '800', letterSpacing: 1.2, marginBottom: space(1) },
  title: { ...font.title, color: colors.onImage, fontWeight: '900' },
  reason: { ...font.body, color: colors.onImageSoft, marginTop: space(1.5) },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(4) },
  cta: { backgroundColor: colors.badgeGold, borderRadius: radius.pill, paddingVertical: space(2), paddingHorizontal: space(4) },
  ctaTx: { color: '#15132E', fontWeight: '900' },
  price: { ...font.caption, color: colors.onImageSoft, fontWeight: '700' },
});
