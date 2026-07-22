// src/app/(app)/gem.tsx — 내 사주 보석(R-GEM v0.1) 무료 온디바이스 자기완결 화면(API 0)
// ─────────────────────────────────────────────────────────────────────────
// 무료 바이럴 카드: 용신 기반 보석 추천 + "생일 보석(서양) vs 내 사주 보석" 대조(디벙킹/매치) + 공유.
//   전부 결정론(recommendGem·gemCopy)·API 0. SpecialContentScreen(유료)이 아니라 자기완결 무료 화면.
//   · 주보석(용신)·보조석(희신) 노출 / 기신(피할 보석)은 비노출(§4 안전·GemCard 가 렌더 안 함).
//   · 전용 보석 이미지는 아직 없어 GemCard 가 '오행색 폴백'으로 그린다(전용 이미지 = 백로그).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { ContentHero } from '../../components/SpecialContentScreen';
import { ChartPicker } from '../../components/ChartPicker';
import { RelatedContent } from '../../components/RelatedContent';
import { GemCard } from '../../components/GemCard';
import { loadRepChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { recommendGem } from '../../lib/content/gemRecommend';
import { gemCopy } from '../../lib/content/gemCopy';
import { useLogContentVisit } from '../../lib/backend/contentVisit';
import { colors, space, radius, font } from '../../lib/theme';

/** 저장 생일 문자열('1994-03-16 17:55')에서 '월'(1~12)만 뽑는다. 서양 탄생석 대조용.
 *  ⚠️음력 입력(calendar='음')이면 이 값은 음력 월 — 서양 탄생석은 양력 기준이라 오차 가능(백로그: 양력 변환). */
function birthMonthOf(birthDateTime?: string): number | null {
  const m = /\d{4}-(\d{2})-/.exec(birthDateTime ?? '');
  const n = m ? parseInt(m[1], 10) : NaN;
  return n >= 1 && n <= 12 ? n : null;
}

export default function GemRoute() {
  const { t } = useTranslation();
  const router = useRouter();
  useLogContentVisit('gem'); // 진입 1회 방문 기록(로그인 사용자)
  const [input, setInput] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0); // 명식 전환 시 재로드

  useEffect(() => {
    let alive = true;
    (async () => {
      const ch = await loadRepChart();
      if (!alive) return;
      setInput(ch?.input ?? null); setLoading(false);
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  // 추천 + 카피(결정론·메모) — 명식/생월이 준비된 경우에만.
  const data = useMemo(() => {
    if (!input) return null;
    const bm = birthMonthOf(input.birthDateTime);
    if (bm == null) return null;
    try {
      const saju = computeChart(input).saju;
      const rec = recommendGem(saju, bm);
      const dm = saju.dayMaster;
      const copy = gemCopy({
        dayStem: dm.stem, dayEl: dm.element, monthBranch: saju.pillars['월'].branch,
        primaryEl: rec.primaryGem.element, basis: rec.primaryGem.basis, birthMonth: bm,
        westernKo: rec.westernBirthstone.ko, primaryGemKo: rec.primaryGem.tiers.standard.ko,
        matchType: rec.matchType,
      });
      return { rec, copy };
    } catch { return null; }
  }, [input]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <ChartPicker onChange={() => setReloadKey((k) => k + 1)} />
      <ContentHero title={t('gem.title', '내 사주 보석')} sub={t('gem.sub', '생일 보석은 사실 나와 안 맞아요 — 나를 살리는 진짜 보석')} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>
      ) : !data ? (
        <View style={styles.center}>
          <Text style={styles.emptyMsg}>{t('gem.empty', '명식을 등록하면 나에게 맞는 보석을 찾아드려요')}</Text>
          <PressableScale style={styles.emptyBtn} onPress={() => router.push('/register')}>
            <Text style={styles.emptyBtnTx}>{t('gem.emptyCta', '+ 명식 등록')}</Text>
          </PressableScale>
        </View>
      ) : (
        <>
          <GemCard rec={data.rec} copy={data.copy} title={t('gem.title', '내 사주 보석')} style={styles.cardWrap} />
          <Text style={styles.note}>{t('gem.note', '※ 오행 기운과 색이 통하는 보석 제안이에요. 재미로 참고하세요(효능을 단정하지 않아요).')}</Text>
          <RelatedContent kind="gem" />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' }, // 전역 ContentBackdrop 비쳐 보이게(07-21 배경통일)
  wrap: { padding: space(4), paddingBottom: space(16) },
  center: { alignItems: 'center', paddingVertical: space(10), gap: space(3) },
  emptyMsg: { ...font.body, color: colors.inkSoft, textAlign: 'center' },
  emptyBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(6) },
  emptyBtnTx: { color: colors.bg, fontWeight: '800' },
  cardWrap: { marginTop: space(3) },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4), lineHeight: 18 },
});
