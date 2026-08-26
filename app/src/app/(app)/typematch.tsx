// app/src/app/(app)/typematch.tsx — 「유형 대 유형」 대조
// ═══════════════════════════════════════════════════════════════════════════
// 「자기·타인 탐색 기획」(2026-08-25) §2-C · Boss 2026-08-27
//   *"유형은 입구, 계산은 깊이 기획서 대로 진행해"*
//
// ■ ★왜 이게 필요한가 — **문턱**
//   지금 궁합은 상대 **생년월일시**가 있어야 나온다. 그건 «물어봐야 하는» 것이라 문턱이 높다.
//   MBTI 는 *"나 INFP인데 너는?"* 한 마디로 끝난다 — 그 차이가 도구가 되느냐를 가른다.
//   ⇒ 상대가 **자기 일주 두 글자만** 말해 주면 짧은 대조를 준다.
//
// ■ ★★규칙을 **발명하지 않았다**
//   채점은 `iljuPair()` — 「잘 맞는 일주 Top5」가 쓰던 **바로 그 함수**다(2026-08-27에 한 곳으로 뺐다).
//   여기서 새 규칙을 지으면 «Top5 와 쌍 대조가 다른 답» 이 나온다.
//   ⚠️그 가중치는 여전히 **daniel 검수 슬롯**이다 ⇒ 이 화면은 **점수를 판정으로 말하지 않는다.**
//     걸린 관계(천간 합·지지 합·삼합·일지 충)를 **사실로만** 적는다.
//
// ■ ⚠️★정확도를 **밝힌다** — 기획서 §2-C 가 명시한 조건
//   *"정확도는 명식 궁합보다 낮다 — 그렇게 밝힌다(«생일을 알면 더 정확해요» → 궁합으로 유도)."*
//   이게 깔때기다: 유형 대조(가볍다) → 명식 궁합(정확하다).
//   숨기고 «궁합» 처럼 보이게 하면 그건 거짓이고, 정확한 쪽으로 갈 이유도 사라진다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { loadRepChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { DAY_PILLAR, dayPillarKey, iljuPair } from '../../lib/engine/dayPillar';
import { useLogContentVisit } from '../../lib/backend/contentVisit';
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, space, radius, font } from '../../lib/theme';

const ALL = Object.keys(DAY_PILLAR);
/** 엔진이 내는 «충» 태그 값. ⚠️엔진 쪽 문자열이라 **여기서 바꾸지 않는다**(비교용 상수로만 둔다). */
const CHUNG = '일지 충';

export default function TypeMatchScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  // ★훅은 전부 조기 return 위에(React #310)
  const [mine, setMine] = useState<string | null>(null);
  const [other, setOther] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useLogContentVisit('typematch');

  useEffect(() => {
    let alive = true;
    void loadRepChart().then((rep) => {
      if (!alive) return;
      if (rep?.input) {
        const d = computeChart(rep.input).saju?.pillars?.['일'];
        setMine(dayPillarKey(d?.stem, d?.branch));
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  /**
   * 엔진이 내는 관계 이름 → **화면 글자**.
   *
   * ⚠️★엔진 값(`'천간 합'` …)을 그대로 그리면 영어 화면에 한국어가 남는다.
   *   그렇다고 **엔진의 명리 용어를 고치지 않는다** — 그건 판정의 언어이고 daniel 검수 영역이다.
   *   ⇒ **표시할 때만** 옮긴다. 모르는 값이 오면 원문 그대로 낸다(빈 칸보다 낫다).
   */
  const tagText = (x: string) => {
    const map: Record<string, string> = {
      '천간 합': t('typematch.tagStemHap', '천간 합'),
      '기운 상생': t('typematch.tagSaeng', '기운 상생'),
      '지지 합': t('typematch.tagBrHap', '지지 합'),
      '삼합': t('typematch.tagSamhap', '삼합'),
      '일지 충': t('typematch.tagChung', '일지 충'),
    };
    return map[x] ?? x;
  };

  const pair = useMemo(() => {
    if (!mine || !other) return null;
    return iljuPair(mine[0], mine[1], other);
  }, [mine, other]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (!mine) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>{t('typematch.noChart', '내 명식을 먼저 등록해 주세요.')}</Text>
        <PressableScale style={styles.cta} onPress={() => router.push('/register')}>
          <Text style={styles.ctaTx}>{t('mycard.register', '명식 등록하기')}</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.body}>
      <Text style={[styles.h, { fontSize: fs(24) }]}>{t('typematch.title', '유형 대 유형')}</Text>
      <Text style={[styles.lead, { fontSize: fs(13) }]}>
        {t('typematch.lead', '상대가 자기 일주 두 글자만 말해 주면 돼요. 생일을 몰라도 대조할 수 있어요.')}
      </Text>

      <View style={styles.meBox}>
        <Text style={styles.meLabel}>{t('typematch.me', '나')}</Text>
        <Text style={[styles.meVal, { fontSize: fs(26) }]}>{mine}</Text>
        <Text style={styles.meSub}>{DAY_PILLAR[mine]?.keywords.slice(0, 3).join(' · ')}</Text>
      </View>

      <Text style={[styles.pickH, { fontSize: fs(13) }]}>{t('typematch.pick', '상대의 일주를 고르세요')}</Text>
      <View style={styles.chips}>
        {ALL.map((k) => (
          <PressableScale key={k} style={[styles.chip, other === k && styles.chipOn]} onPress={() => setOther(k)}>
            <Text style={[styles.chipTx, other === k && styles.chipTxOn]}>{k}</Text>
          </PressableScale>
        ))}
      </View>

      {pair && other ? (
        <View style={styles.result}>
          <Text style={[styles.rH, { fontSize: fs(18) }]}>{mine} · {other}</Text>
          {/* ★점수를 **숫자로 안 보여 준다** — 가중치가 검수 대기라 그 숫자는 판정이 아니다.
              걸린 관계만 **사실로** 적는다. */}
          {pair.tags.length ? (
            <View style={styles.tags}>
              {pair.tags.map((x) => {
                // ★«충» 만 색을 달리한다 — 판정이 아니라 **결이 다른 관계**라는 표시다
                const warn = x === CHUNG;
                return (
                  <View key={x} style={[styles.tag, warn && styles.tagWarn]}>
                    <Text style={[styles.tagTx, warn && styles.tagTxWarn]}>{tagText(x)}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.plain}>{t('typematch.none', '두 글자 사이에 걸리는 합·충이 없어요. 좋고 나쁨이 아니라, 이 축에서는 특별한 끌림도 부딪힘도 안 잡힌다는 뜻이에요.')}</Text>
          )}
          <Text style={styles.rSub}>{DAY_PILLAR[other]?.keywords.slice(0, 3).join(' · ')}</Text>

          {/* ⚠️★깔때기 — 정확도를 밝히고 **더 정확한 쪽**으로 보낸다(기획서 §2-C) */}
          <View style={styles.funnel}>
            <Text style={[styles.funnelTx, { fontSize: fs(12.5) }]}>
              {t('typematch.limit', '이건 일주 두 글자만 본 거예요. 태어난 시간·달까지 보면 훨씬 정확해요.')}
            </Text>
            <PressableScale style={styles.cta} onPress={() => router.push('/compat')}>
              <Text style={styles.ctaTx}>{t('typematch.goCompat', '생일로 정확한 궁합 보기')}</Text>
            </PressableScale>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  // ★하단 여백 — 광고 배너 50 + 네비바 86 + 홈 인디케이터 34(실측 · `check:bottominset`)
  body: { padding: space(5), paddingBottom: 176 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, gap: space(4) },
  h: { ...font.title, color: colors.ink, fontWeight: '900' },
  lead: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5) },
  meBox: {
    marginTop: space(5), padding: space(4), borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.juLine, alignItems: 'center',
  },
  meLabel: { ...font.caption, color: colors.inkFaint },
  meVal: { ...font.title, color: colors.ju, fontWeight: '900' },
  meSub: { ...font.caption, color: colors.inkSoft, marginTop: space(1) },
  pickH: { ...font.caption, color: colors.inkSoft, marginTop: space(6), marginBottom: space(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: {
    paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.pill,
    backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { ...font.caption, color: colors.inkSoft },
  chipTxOn: { color: colors.onJu, fontWeight: '800' },
  result: {
    marginTop: space(6), padding: space(4), borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, gap: space(2),
  },
  rH: { ...font.title, color: colors.ink, fontWeight: '900' },
  rSub: { ...font.caption, color: colors.inkSoft },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  tag: { paddingHorizontal: space(3), paddingVertical: space(1), borderRadius: radius.pill, backgroundColor: colors.juSoft },
  tagWarn: { backgroundColor: colors.sunk },
  tagTx: { ...font.caption, color: colors.ju, fontWeight: '700' },
  tagTxWarn: { color: colors.inkSoft },
  plain: { ...font.caption, color: colors.inkSoft, lineHeight: 19 },
  funnel: { marginTop: space(3), gap: space(2.5), borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space(3) },
  funnelTx: { ...font.caption, color: colors.inkFaint, lineHeight: 18 },
  empty: { ...font.body, color: colors.inkSoft },
  cta: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(5), paddingVertical: space(3), alignSelf: 'flex-start' },
  ctaTx: { ...font.body, color: colors.onJu, fontWeight: '800' },
});
