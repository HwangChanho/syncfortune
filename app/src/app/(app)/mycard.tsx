// app/src/app/(app)/mycard.tsx — 「나의 카드」
// ═══════════════════════════════════════════════════════════════════════════
// 「자기·타인 탐색 기획」(2026-08-25) §2-A · Boss 2026-08-27
//   *"유형은 입구, 계산은 깊이 기획서 대로 진행해"*
//
// ■ ★이 화면의 한 줄 요지 — **유형은 입구다**
//   카드는 «나를 한 마디로» 말하게 해 주는 손잡이다. 그리고 **모든 칸이 눌린다** —
//   누르면 그 축의 깊이(계산으로 나온 본문)로 들어간다.
//   ⇒ 그래서 이 화면은 **아무것도 새로 판단하지 않는다.** 각 화면의 산출을 모아 놓기만 한다.
//     여기서 따로 계산하면 «카드의 나» 와 «상세의 나» 가 갈리고, 그건 유형이 아니라 오류다.
//
// ■ ★저장한다 — 기획서 §1-② 가 짚은 «빠진 것»
//   MBTI 가 도구로 작동하는 이유는 깊어서가 아니라 **기억되고 저장되기** 때문이다.
//   실측(08-27): 유형 결과를 담는 표가 없었다. 지금은 `user_types` 에 남는다.
//   ⚠️저장은 **사본**이다. 지워도 다시 계산된다(온디바이스·API 0).
//
// ■ ⚠️애착유형은 **안 넣는다**
//   명식만으로 안 나오고 설문 답이 필요하다. 안 한 사람에게 빈 칸을 보이면 «미완성» 으로 읽힌다.
//   그리고 기획서 §5: 판정 대기 중인 민감 분류는 카드에 안 올린다.
//
// ■ ⚠️**대표 유형을 정하지 않았다**
//   기획서 §2-B 가 «내가 정하지 않는다 — 브랜드이자 명리 stance» 라고 못 박은 Boss 슬롯이다.
//   ⇒ 지금은 다섯을 **나란히** 보여 준다. 대표가 정해지면 맨 위 한 칸을 키우면 된다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { ShareReadingButton } from '../../components/ShareReadingButton';
import { loadRepChart } from '../../lib/engine/myChart';
import { buildMyCard, saveMyCard, type CardSlot } from '../../lib/content/myCard';
import { useLogContentVisit } from '../../lib/backend/contentVisit';   // 콘텐츠 방문 기록(다른 화면과 같은 훅)
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, space, radius, font } from '../../lib/theme';

export default function MyCardScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  // ★훅은 전부 조기 return 위에(React #310)
  const [slots, setSlots] = useState<CardSlot[] | null>(null);
  const [name, setName] = useState('');
  useLogContentVisit('mycard');   // ★훅이므로 조기 return 위(React #310)

  useEffect(() => {
    let alive = true;
    (async () => {
      const rep = await loadRepChart();
      if (!alive) return;
      if (!rep?.input) { setSlots([]); return; }
      const built = buildMyCard(rep.input, t as never);
      setSlots(built);
      setName(rep.label ?? '');
      // ★저장은 **화면을 막지 않는다** — 실패해도 카드는 보인다(저장은 부가다)
      if (rep.id) void saveMyCard(rep.id, built);
    })();
    return () => { alive = false; };
  }, [t]);

  if (slots === null) {
    return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  }
  if (!slots.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>{t('mycard.noChart', '명식을 먼저 등록해 주세요.')}</Text>
        <PressableScale style={styles.cta} onPress={() => router.push('/register')}>
          <Text style={styles.ctaTx}>{t('mycard.register', '명식 등록하기')}</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.body}>
      <Text style={[styles.h, { fontSize: fs(24) }]}>{t('mycard.title', '나의 카드')}</Text>
      <Text style={[styles.lead, { fontSize: fs(13) }]}>
        {t('mycard.lead', '유형은 입구예요. 한 칸을 누르면 그 축을 계산한 본문으로 들어가요.')}
      </Text>
      {name ? <Text style={styles.who}>{name}</Text> : null}

      <View style={styles.grid}>
        {slots.map((s) => (
          <PressableScale key={s.kind} style={styles.card} onPress={() => router.push(s.route as never)}>
            <Text style={[styles.label, { fontSize: fs(11.5) }]}>{s.label}</Text>
            {/* ★값이 가장 크다 — 이게 «남에게 말하는 단위» 다 */}
            <Text style={[styles.value, { fontSize: fs(22) }]} numberOfLines={1}>{s.value}</Text>
            <Text style={[styles.sub, { fontSize: fs(12) }]} numberOfLines={2}>{s.sub}</Text>
            <Text style={[styles.more, { fontSize: fs(11) }]}>{t('mycard.more', '자세히 ›')}</Text>
          </PressableScale>
        ))}
      </View>

      {/* ★공유는 이미 있는 틀을 쓴다(`bok`·`egenteto` 가 쓰던 그것) — 새로 만들면 모양이 갈린다 */}
      <ShareReadingButton
        kind="mycard"
        title={t('mycard.title', '나의 카드')}
        content={{ headline: slots.map((s) => `${s.label} ${s.value}`).join(' · '),
                   body: slots.map((s) => `${s.label}: ${s.value} — ${s.sub}`).join('\n') }}
        style={{ marginTop: space(6) }}
      />

      {/* ⚠️정직하게 적는다 — 이건 «분류함» 이 아니라 입구다(App Store 설명과도 같은 말이어야 한다) */}
      <Text style={[styles.foot, { fontSize: fs(11.5) }]}>
        {t('mycard.foot', '같은 유형이어도 대운·강약이 다르면 본문은 다르게 나와요. 유형은 입구일 뿐, 글은 당신 것이에요.')}
      </Text>
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
  who: { ...font.caption, color: colors.inkFaint, marginTop: space(2) },
  grid: { marginTop: space(5), gap: space(3) },
  card: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    padding: space(4), gap: space(1),
  },
  label: { ...font.caption, color: colors.inkFaint, letterSpacing: 0.4 },
  value: { ...font.title, color: colors.ink, fontWeight: '900' },
  sub: { ...font.caption, color: colors.inkSoft },
  more: { ...font.caption, color: colors.ju, marginTop: space(1), fontWeight: '700' },
  foot: { ...font.caption, color: colors.inkFaint, marginTop: space(6), lineHeight: 18 },
  empty: { ...font.body, color: colors.inkSoft },
  cta: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(5), paddingVertical: space(3) },
  ctaTx: { ...font.body, color: colors.onJu, fontWeight: '800' },
});
