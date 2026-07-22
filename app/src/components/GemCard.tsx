// app/src/components/GemCard.tsx — R-GEM v0.1 보석 추천 카드 + 공유(무료 바이럴)
// ─────────────────────────────────────────────────────────────────────────
// 무료 온디바이스 보석 추천을 '공유하고 싶은 카드'로 시각화한다(바이럴 → 유료 심층분석 퍼널).
//   · 화면 카드(보이는 것): 주보석(용신) + 보조석(희신) + "생일 보석 vs 내 보석" 대조 + 카피.
//   · 공유 이미지(화면 밖 ViewShot 캡처): 720px 세로 카드 — 브랜드 + 훅 + 주보석 + 대조 + 스토어 링크.
//   ★기신(avoidGem)은 노출하지 않는다(§4 안전 — 겁주지 않기). 화면단에서 rec.avoidGem 을 안 쓴다.
//   ★전용 보석 이미지가 아직 없어 '오행색 폴백'(elementColor 원/네모)로 그린다(전용 이미지 = 백로그).
//
// ▶ 공유 파이프라인 = 기존 share.ts / ShareReadingButton 패턴 재사용:
//   react-native-view-shot 로 화면 밖 카드 캡처 → createSharedLink(스마트링크) → Share 시트(이미지+캡션).
// ─────────────────────────────────────────────────────────────────────────
import { useRef } from 'react';
import { View, Text, StyleSheet, Share, type StyleProp, type ViewStyle } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { PressableScale } from './PressableScale';
import { Alert } from '../lib/ui/alert';
import { APP_STORE_URL, createSharedLink } from '../lib/ui/share';
import { elementColor, elementText } from '../lib/engine/ohaeng';
import { EL_KO, type GemCopy } from '../lib/content/gemCopy';
import type { GemRecommendation } from '../lib/content/gemRecommend';
import { colors, radius, space, font } from '../lib/theme';

/** 오행색 스와치(전용 이미지 폴백) — 원 안에 오행 글자. */
function ElementSwatch({ el, size }: { el: string; size: number }) {
  const bg = elementColor[el] ?? colors.sunk;
  const tx = elementText[el] ?? colors.ink;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }}>
      <Text style={{ color: tx, fontSize: size * 0.42, fontWeight: '900' }}>{el}</Text>
    </View>
  );
}

/**
 * 보석 추천 카드(화면 + 공유).
 * @param rec recommendGem 결과(주/보조/기신·서양탄생석·match). 기신은 렌더하지 않음.
 * @param copy gemCopy 4요소(훅/인사이트/근거/CTA).
 * @param title 공유 캡션 제목(예 '내 사주 보석').
 */
export function GemCard({ rec, copy, title, style }: {
  rec: GemRecommendation;
  copy: GemCopy;
  title?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const shotRef = useRef<ViewShot>(null);

  const primaryEl = rec.primaryGem.element;
  const rep = rec.primaryGem.tiers.standard;          // 대표석(중간가)
  const western = rec.westernBirthstone;
  const isMatch = rec.matchType === 'match';

  // 공유: 화면 밖 카드 캡처 → 스마트링크 → Share 시트(이미지 + 캡션).
  const onShare = async () => {
    try {
      const uri = await captureRef(shotRef, { format: 'jpg', quality: 0.95, result: 'tmpfile' });
      // 받는 사람이 앱에서 자기 보석을 보게 유도하는 스마트링크(shared_readings 스냅샷).
      const link = await createSharedLink({
        kind: 'gem', title: title ?? '내 사주 보석',
        content: { headline: copy.hook, insight: copy.insight, basis: copy.basis },
      });
      const msg = link
        ? `${title ?? '내 사주 보석'} — 팔자(八字)\n앱에서 내 보석 보기 ▸ ${link}`
        : `${title ?? '내 사주 보석'} — 팔자(八字)\n앱에서 내 운세 보기 ${APP_STORE_URL}`;
      await Share.share({ url: uri, message: msg });
    } catch (e) {
      Alert.alert('!', (e as Error).message);
    }
  };

  return (
    <View style={style}>
      {/* ── 화면 카드(보이는 것) ── */}
      <View style={styles.card}>
        {/* match/debunk 배지 */}
        <View style={[styles.badge, isMatch ? styles.badgeMatch : styles.badgeDebunk]}>
          <Text style={styles.badgeTx}>{isMatch ? '생일 보석 = 내 보석 (희귀)' : '생일 보석 ≠ 내 보석'}</Text>
        </View>

        {/* 훅 */}
        <Text style={styles.hook}>{copy.hook}</Text>

        {/* 주보석 — 오행색 스와치 + 대표석 이름 */}
        <View style={styles.primaryRow}>
          <ElementSwatch el={primaryEl} size={64} />
          <View style={styles.primaryText}>
            <Text style={styles.primaryLabel}>나를 살리는 보석</Text>
            <Text style={styles.primaryGem}>{rep.ko}</Text>
            <Text style={styles.primaryEl}>{primaryEl}({EL_KO[primaryEl]}) 기운</Text>
          </View>
        </View>

        {/* 근거 + 인사이트 */}
        <Text style={styles.basis}>{copy.basis}</Text>
        <Text style={styles.insight}>{copy.insight}</Text>

        {/* 3티어(예산대별) */}
        <View style={styles.tierRow}>
          <TierChip label="프리미엄" gem={rec.primaryGem.tiers.premium.ko} />
          <TierChip label="스탠다드" gem={rec.primaryGem.tiers.standard.ko} highlight />
          <TierChip label="합리적" gem={rec.primaryGem.tiers.budget.ko} />
        </View>

        {/* 생일 보석 대조 */}
        <View style={styles.compareRow}>
          <View style={styles.compareCol}>
            <Text style={styles.compareCap}>생일 보석(서양)</Text>
            <ElementSwatch el={western.element} size={40} />
            <Text style={styles.compareGem}>{western.ko}</Text>
          </View>
          <Text style={styles.vs}>vs</Text>
          <View style={styles.compareCol}>
            <Text style={styles.compareCap}>내 사주 보석</Text>
            <ElementSwatch el={primaryEl} size={40} />
            <Text style={[styles.compareGem, { color: colors.ju }]}>{rep.ko}</Text>
          </View>
        </View>

        {/* 보조석(희신) — 있을 때만 */}
        {rec.secondaryGem && (
          <Text style={styles.secondary}>
            함께 지니면 좋은 보석 · {rec.secondaryGem.tiers.standard.ko}
            <Text style={styles.secondaryEl}>  ({rec.secondaryGem.element}{EL_KO[rec.secondaryGem.element]})</Text>
          </Text>
        )}
      </View>

      {/* 공유 버튼 */}
      <PressableScale style={styles.shareBtn} onPress={onShare}>
        <Text style={styles.shareTx}>🔗 내 보석 카드 공유</Text>
      </PressableScale>

      {/* ── 화면 밖 공유 캡처 카드(720px·보이지 않음) ── */}
      <View style={styles.offscreen} pointerEvents="none">
        <ViewShot ref={shotRef} options={{ format: 'jpg', quality: 0.95 }}>
          <View style={styles.shareCard}>
            <Text style={styles.shareBrand}>✨ 팔자(八字) · 내 사주 보석</Text>
            <Text style={styles.shareHook}>{copy.hook}</Text>
            <View style={styles.shareGemRow}>
              <ElementSwatch el={primaryEl} size={140} />
              <View style={{ marginLeft: 32, flex: 1 }}>
                <Text style={styles.shareGemName}>{rep.ko}</Text>
                <Text style={styles.shareGemEl}>{primaryEl}({EL_KO[primaryEl]}) 기운</Text>
              </View>
            </View>
            <Text style={styles.shareBasis}>{copy.basis}</Text>
            <View style={styles.shareCompare}>
              <Text style={styles.shareCompareTx}>생일 보석 {western.ko}({western.element}) {isMatch ? '=' : '≠'} 내 보석 {rep.ko}({primaryEl})</Text>
            </View>
            <View style={styles.shareDivider} />
            <Text style={styles.shareCta}>앱에서 내게 맞는 보석 전부 보기</Text>
            <Text style={styles.shareUrl}>{APP_STORE_URL}</Text>
          </View>
        </ViewShot>
      </View>
    </View>
  );
}

/** 예산대별 티어 칩. highlight = 대표석(스탠다드) 강조. */
function TierChip({ label, gem, highlight }: { label: string; gem: string; highlight?: boolean }) {
  return (
    <View style={[styles.tierChip, highlight && styles.tierChipHi]}>
      <Text style={[styles.tierLabel, highlight && { color: colors.ju }]}>{label}</Text>
      <Text style={styles.tierGem}>{gem}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space(5), gap: space(3) },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingVertical: space(1), paddingHorizontal: space(3) },
  badgeDebunk: { backgroundColor: colors.juSoft, borderWidth: 1, borderColor: colors.juLine },
  badgeMatch: { backgroundColor: colors.ju },
  badgeTx: { ...font.caption, color: colors.ink, fontWeight: '700' },
  hook: { ...font.title, color: colors.ink },
  primaryRow: { flexDirection: 'row', alignItems: 'center', gap: space(4), marginTop: space(1) },
  primaryText: { flex: 1, gap: space(0.5) },
  primaryLabel: { ...font.caption, color: colors.inkSoft },
  primaryGem: { ...font.display, color: colors.ju },
  primaryEl: { ...font.label, color: colors.inkSoft },
  basis: { ...font.body, color: colors.ink, lineHeight: 22 },
  insight: { ...font.body, color: colors.inkSoft, lineHeight: 22 },
  tierRow: { flexDirection: 'row', gap: space(2), marginTop: space(1) },
  tierChip: { flex: 1, backgroundColor: colors.sunk, borderRadius: radius.md, paddingVertical: space(2), paddingHorizontal: space(2), alignItems: 'center', gap: space(1), borderWidth: 1, borderColor: colors.line },
  tierChipHi: { borderColor: colors.ju, backgroundColor: colors.juSoft },
  tierLabel: { ...font.caption, color: colors.inkFaint, fontWeight: '700' },
  tierGem: { ...font.label, color: colors.ink, textAlign: 'center' },
  compareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: colors.sunk, borderRadius: radius.md, paddingVertical: space(3), marginTop: space(1) },
  compareCol: { alignItems: 'center', gap: space(1.5), flex: 1 },
  compareCap: { ...font.caption, color: colors.inkSoft },
  compareGem: { ...font.label, color: colors.ink },
  vs: { ...font.body, color: colors.inkFaint, fontWeight: '800', marginHorizontal: space(2) },
  secondary: { ...font.body, color: colors.ink, marginTop: space(1) },
  secondaryEl: { ...font.caption, color: colors.inkFaint },
  shareBtn: { alignSelf: 'center', borderColor: colors.ju, borderWidth: 1, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(6), marginTop: space(4) },
  shareTx: { color: colors.ju, fontWeight: '700', fontSize: 14 },
  // 화면 밖 캡처 카드
  offscreen: { position: 'absolute', top: -10000, left: 0 },
  shareCard: { width: 720, backgroundColor: colors.bg, paddingVertical: 56, paddingHorizontal: 48, borderWidth: 3, borderColor: colors.ju },
  shareBrand: { color: colors.ju, fontSize: 28, fontWeight: '900', marginBottom: 28, letterSpacing: 1 },
  shareHook: { color: colors.ink, fontSize: 40, fontWeight: '900', lineHeight: 52, marginBottom: 32 },
  shareGemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  shareGemName: { color: colors.ju, fontSize: 52, fontWeight: '900' },
  shareGemEl: { color: colors.inkSoft, fontSize: 26, marginTop: 8 },
  shareBasis: { color: colors.ink, fontSize: 28, lineHeight: 42, marginBottom: 24 },
  shareCompare: { backgroundColor: colors.sunk, borderRadius: 16, padding: 24 },
  shareCompareTx: { color: colors.ink, fontSize: 24, lineHeight: 34, fontWeight: '600' },
  shareDivider: { height: 1, backgroundColor: colors.juLine, marginVertical: 36 },
  shareCta: { color: colors.ink, fontSize: 26, fontWeight: '700', marginBottom: 10 },
  shareUrl: { color: colors.inkFaint, fontSize: 20 },
});
