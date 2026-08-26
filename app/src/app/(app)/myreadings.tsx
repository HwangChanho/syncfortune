// app/src/app/(app)/myreadings.tsx — 하단탭 「풀이」 = **내가 만든 풀이 보관함** (시안 4탭)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 왜 필요했나 (2026-08-18)
//   지금까지 "내가 산/만든 풀이를 다시 찾는 곳"이 **없었다.** 풀이는 콘텐츠 화면에 들어가야만
//   (캐시에서) 다시 열렸고, 무엇을 봤는지는 사용자가 기억해야 했다.
//   시안이 '풀이'를 따로 탭으로 둔 이유가 이것이다 — 목록(무엇을 볼까)과 보관함(무엇을 봤나)은 다른 일이다.
//
// ■ 데이터
//   서버 `readings`(chart_id·category·created_at). RLS 가 내 것만 준다.
//   · category → 콘텐츠 라벨·이미지·라우트는 `contentSections` 에서 찾는다(목록 이중관리 금지).
//   · chart_id → 명식 이름은 **로컬** 저장분(`listCharts()`)의 `serverChartId` 로 맞춘다.
//
// ⚠️매핑을 못 찾은 풀이도 **감추지 않는다**([[list-truncation-hides-content]]).
//   조용히 빠지면 사용자에겐 "내 풀이가 사라진" 것으로 보인다. 라벨을 못 찾으면 카테고리 원문을
//   그대로 적고 **누를 수 없게**만 한다(엉뚱한 화면으로 보내는 것보다 낫다).
// ⚠️조회 실패와 '아직 없음'을 구분한다 — 실패를 빈 목록으로 그리면 결제한 사람이 놀란다.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';   // ★상단 안전영역 — 헤더가 없는 화면이라 직접 받는다(고정 여백은 글자확대 시 잘린다)
import { supabase } from '../../lib/supabase';
import { withTimeout } from '../../lib/core/withTimeout';
import { excludeMock } from '../../lib/core/testMode';   // ★목업(tier='mock') 행은 사용자에게 보이지 않는다
import { listCharts, type SavedChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';   // ★canonical 명식 빌더(홈·상세와 같은 것)
import { otherSig } from '../../lib/content/compatReadings';   // 궁합 category 의 상대 서명 = 4기둥 간지
import { SECTIONS, type MenuItem } from '../../lib/content/contentSections';
import { contentKeyOf, groupKeyOf, showsInArchive } from '../../lib/content/readingCategoryMap';   // ★category → 콘텐츠 한 건(단일 출처)
import { PressableScale } from '../../components/PressableScale';
import { colors, radius, space, font, shadow } from '../../lib/theme';
import { readingLang } from '../../lib/i18n';
type Row = { id: string; chart_id: string; category: string; created_at: string };
type Result = { rows: Row[]; charts: SavedChart[] } | { error: true } | null;

/**
 * category 로 콘텐츠 카드를 찾는다.
 * 정규화(16영역·12궁·접미사)는 `readingCategoryMap` 이 한다 — 여기서는 카드만 고른다.
 *
 * @param category `readings.category` 원문
 * @returns 찾은 콘텐츠 카드(없으면 undefined)
 */
function findItem(category: string): MenuItem | undefined {
  const key = contentKeyOf(category);
  if (!key) return undefined;
  const all = SECTIONS.flatMap((s) => s.items);
  return all.find((it) => it.key === key) ?? all.find((it) => it.creditKey === key);
}

export default function MyReadingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [res, setRes] = useState<Result>(null);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    setRes(null);
    try {
      const [r, charts] = await Promise.all([
        withTimeout(
          excludeMock(
            supabase.from('readings').select('id, chart_id, category, created_at')
              .eq('lang', readingLang())            // 지금 언어로 만든 풀이만(다른 언어 본은 그 언어에서 보인다)
              .order('created_at', { ascending: false }).limit(300),
          ),
          8000,
        ),
        listCharts().catch(() => [] as SavedChart[]),
      ]);
      if (!r || r.error || !r.data) { setRes({ error: true }); return; }
      // ★같은 (명식 × 콘텐츠)는 **최신 1건만** 남긴다 — 궁합·신년운세는 조건별로 여러 벌이 쌓여
      //   목록에 같은 이름이 서너 줄씩 이어졌다(실물에서 확인). 목록은 '무엇을 봤나'지 이력이 아니다.
      //   ⚠️여기서 지우는 건 화면 표시뿐이다. 원본은 서버에 그대로 있고 각 화면이 자기 것을 연다.
      // ★묶음 규칙은 `groupKeyOf` 한 곳에 있다 — 사주 16영역·자미 12궁은 한 줄로 접히고,
      //   궁합은 **상대마다** 남는다(합치면 다른 사람과의 궁합이 사라진다).
      const seen = new Set<string>();
      const rows = (r.data as Row[]).filter((row) => {
        if (!showsInArchive(row.category)) return false;   // 오늘·이달 운세의 날짜 캐시는 목록에 쌓지 않는다
        const k = groupKeyOf(row.chart_id, row.category);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      setRes({ rows, charts });
    } catch { setRes({ error: true }); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  /** 서버 chart_id → 로컬 명식 이름(없으면 빈 문자열). */
  const nameOf = (charts: SavedChart[], chartId: string): string =>
    charts.find((c) => c.serverChartId === chartId || c.id === chartId)?.label ?? '';

  /**
   * 궁합 줄의 **상대** 이름.
   *
   * ★없으면 「궁합 · 조충희」 두 줄이 글자 그대로 똑같아 구분이 안 된다(실물에서 확인).
   *   category 접미사가 상대의 4기둥 간지(`otherSig`)라, 내 저장 명식들의 서명을 만들어 맞춰 보면 이름이 나온다.
   * @returns 찾은 상대 이름, 못 찾으면 빈 문자열(간지를 그대로 보여주지는 않는다 — 사용자에겐 의미 없는 글자다)
   */
  const partnerOf = (charts: SavedChart[], category: string): string => {
    const sig = category.split('_')[2];               // compat_<rel>_<sig>[_y연도]
    if (!sig) return '';
    for (const c of charts) {
      try { if (otherSig(computeChart(c.input).saju) === sig) return c.label; } catch { /* 계산 실패는 조용히 건너뛴다 */ }
    }
    return '';
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={[styles.body, { paddingTop: insets.top + space(4) }]}>
      {res === null ? (
        <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>
      ) : 'error' in res ? (
        <View style={styles.center}>
          <Text style={styles.emptyTx}>{t('myReadings.failed', '풀이를 불러오지 못했어요.')}</Text>
          <PressableScale style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryTx}>{t('common.retry', '다시 시도')}</Text>
          </PressableScale>
        </View>
      ) : res.rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTx}>{t('myReadings.empty', '아직 만든 풀이가 없어요.')}</Text>
          <PressableScale style={styles.retry} onPress={() => router.replace('/contents')}>
            <Text style={styles.retryTx}>{t('myReadings.goPick', '운세 보러 가기')}</Text>
          </PressableScale>
        </View>
      ) : (
        <>
        <Text style={styles.title}>{t('nav.readings')}</Text>
        <View style={styles.list}>
          {res.rows.map((row, i, arr) => {
            const item = findItem(row.category);
            const who = nameOf(res.charts, row.chart_id);
            // 궁합은 '누구와'가 곧 그 풀이의 정체다 — 주체 이름만으로는 여러 줄이 구분되지 않는다
            const partner = item?.key === 'compat' ? partnerOf(res.charts, row.category) : '';
            const body = (
              <>
                <View style={styles.rowL}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item ? t(item.labelKey) : row.category}{partner ? ` · ${partner}` : ''}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {who ? `${who} · ` : ''}{row.created_at.slice(0, 10)}
                  </Text>
                </View>
                {item ? <Text style={styles.rowArrow}>›</Text> : null}
              </>
            );
            // 라우트를 모르면 누를 수 없게 둔다 — 엉뚱한 화면으로 보내지 않는다
            return item ? (
              <PressableScale
                key={row.id}
                style={[styles.row, i < arr.length - 1 && styles.rowLine]}
                onPress={() => router.push(item.route as never)}
              >
                {body}
              </PressableScale>
            ) : (
              <View key={row.id} style={[styles.row, i < arr.length - 1 && styles.rowLine]}>{body}</View>
            );
          })}
        </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  // 하단 여백 170 = 광고 배너 50 + 하단 내비 86 + 홈 인디케이터 34(check:bottominset 기준)
  body: { paddingHorizontal: space(4), paddingBottom: 170 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '900', color: colors.ink, letterSpacing: -0.3, marginBottom: space(3) },
  center: { alignItems: 'center', paddingVertical: space(12), gap: space(3) },
  emptyTx: { ...font.body, color: colors.inkSoft, textAlign: 'center' },
  retry: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(5), paddingVertical: space(2.5) },
  retryTx: { ...font.label, color: colors.onJu, fontWeight: '800' },

  list: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: space(4), ...shadow.soft },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3.5) },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowL: { flex: 1, gap: 2 },
  rowTitle: { ...font.body, color: colors.ink, fontWeight: '700' },
  rowSub: { ...font.caption, color: colors.inkFaint },
  rowArrow: { ...font.heading, color: colors.inkFaint },
});
