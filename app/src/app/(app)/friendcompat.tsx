// app/src/app/(app)/friendcompat.tsx — 친구 명식·궁합
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-20: *"그사람이 등록한 명식을 다른 친구가 확인도 가능하고 궁합도 볼수 있게"*
//
// ■ ★기존 `/compat` 과 **다른 화면**인 이유
//   `/compat` 은 상대를 **손으로 입력**하는 구조다(동의 게이트·규칙8).
//   친구는 상대가 **자기 계정에서 이미 동의하고 올린** 명식이라 입력 경로가 아예 다르다.
//   ⇒ 화면은 따로 두되, **계산은 같은 것**을 쓴다(`analyzeCompatibility` · `CompatPeek`).
//     계산을 새로 짜면 같은 두 사람의 궁합이 화면마다 달라진다.
//
// ■ ⚠️못 보는 경우를 **말로 설명한다**
//   RLS 가 두 조건(친구 수락 + 상대의 공개 동의)을 볼 때만 명식을 준다.
//   못 읽으면 오류가 아니라 **"아직 안 열었다"** 는 뜻이다 — 빈 화면으로 두면
//   사용자는 앱이 고장 난 줄 안다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '../../components/PressableScale';
import { CompatPeek } from '../../components/CompatPeek';
import { SharedChart } from '../../components/SharedChart';
import { toSharedSaju } from '../../lib/backend/communityChart';
import { listFriends, loadFriendChart, type Friend } from '../../lib/talk/friends';
import { loadRepChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { analyzeCompatibility } from '@engine/compatibility';
import { appLang } from '../../lib/i18n';
import { colors, space, radius, font } from '../../lib/theme';
import type { CompatibilityDx } from '@engine/compatibility';

export default function FriendCompatScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { friend: friendId } = useLocalSearchParams<{ friend?: string }>();
  const [friend, setFriend] = useState<Friend | null>(null);
  const [otherSaju, setOtherSaju] = useState<any>(null);
  const [dx, setDx] = useState<CompatibilityDx | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notShared' | 'noMe' | 'gone'>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!friendId) { setState('gone'); return; }
      const f = (await listFriends()).find((x) => x.otherId === friendId && x.status === 'accepted') ?? null;
      if (!alive) return;
      setFriend(f);
      if (!f) { setState('gone'); return; }              // 친구가 아니거나 해제됨
      if (!f.chartId) { setState('notShared'); return; } // 상대가 공개 안 함

      const [mine, theirs] = await Promise.all([loadRepChart(), loadFriendChart(f.chartId)]);
      if (!alive) return;
      if (!mine?.input) { setState('noMe'); return; }    // 내 명식이 없으면 궁합을 못 낸다
      if (!theirs?.saju) { setState('notShared'); return; }

      setOtherSaju(theirs.saju);
      try {
        // ★내 명식만 계산하고, 상대는 **서버가 이미 계산해 둔 것**을 쓴다(원가 0·항상 같은 값)
        setDx(analyzeCompatibility(computeChart(mine.input).saju, theirs.saju));
      } catch (e) {
        console.warn('[friendcompat] 궁합 계산 실패', e);
      }
      setState('ok');
    })();
    return () => { alive = false; };
  }, [friendId]);

  const name = friend?.name ?? t('friends.noName', '이름 없음');

  if (state === 'loading') {
    return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={[styles.body, { paddingTop: insets.top + space(3) }]}>
      <View style={styles.head}>
        <PressableScale hitSlop={10} onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </PressableScale>
        <Text style={styles.headTx} numberOfLines={1}>{name}</Text>
      </View>

      {/* ★못 보는 이유를 각각 다르게 말한다 — 사용자가 할 일이 다르다 */}
      {state === 'gone' ? (
        <Text style={styles.note}>{t('fcompat.gone', '친구 목록에 없는 사람이에요.')}</Text>
      ) : state === 'notShared' ? (
        <View style={styles.noteBox}>
          <Text style={styles.note}>
            {t('fcompat.notShared', '{{name}}님이 아직 명식을 열지 않았어요.\n상대가 「친구에게 내 명식 보여주기」를 켜면 볼 수 있어요.').replace('{{name}}', name)}
          </Text>
        </View>
      ) : state === 'noMe' ? (
        <View style={styles.noteBox}>
          <Text style={styles.note}>{t('fcompat.noMe', '내 명식을 먼저 등록해야 궁합을 볼 수 있어요.')}</Text>
          <PressableScale style={styles.cta} onPress={() => router.push('/register')}>
            <Text style={styles.ctaTx}>{t('home.noChartCta', '+ 명식 등록')}</Text>
          </PressableScale>
        </View>
      ) : (
        <>
          {/* 궁합 — ★계산도 표시도 기존 것을 그대로 쓴다(두 사람의 궁합이 화면마다 달라지면 안 된다) */}
          {dx ? <CompatPeek name={name} dx={dx} lang={appLang() as never} onOpen={() => {}} /> : null}

          {/* 상대 원국 — Boss 결정으로 **전체 공개**. 상대가 동의한 경우에만 여기까지 온다 */}
          <Text style={styles.section}>{t('fcompat.chart', '{{name}}님의 명식').replace('{{name}}', name)}</Text>
          {/* ★커뮤니티 공유와 **같은 컴포넌트·같은 화이트리스트**를 쓴다.
              여기서 새로 그리면 "무엇까지 보이나"가 두 곳에서 갈린다 —
              그리고 그 갈림은 곧 **정보 유출 폭의 차이**다. */}
          {/* ⚠️`showLuck=false` — 대운·세운은 **빼고** 원국만 보여 준다.
              Boss 결정은 "명식 전체 공개"였고 원국이 그 전체다. 대운은 성별에 따라 순역이 갈리고
              시작 나이가 절기까지의 일수로 정해져 **생일 역산을 더 쉽게** 만든다
              (`communityChart.ts` 가 같은 이유로 뺀다). 여덟 글자만으로도 이미 위험한데
              굳이 재료를 더 얹지 않는다. */}
          {otherSaju ? <SharedChart saju={toSharedSaju(otherSaju, false)} /> : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: space(4), paddingBottom: space(20) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginBottom: space(4) },
  back: { fontSize: 26, lineHeight: 30, color: colors.ju, fontWeight: '900' },
  headTx: { flex: 1, minWidth: 0, ...font.heading, color: colors.ink, fontWeight: '800' },
  section: { ...font.caption, color: colors.inkFaint, fontWeight: '700', marginTop: space(6), marginBottom: space(2) },
  noteBox: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(5), gap: space(4), alignItems: 'center' },
  note: { ...font.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 22 },
  cta: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(3) },
  // ★강조색 위 글자는 `onJu`(`check:onaccent`)
  ctaTx: { ...font.label, color: colors.onJu, fontWeight: '900' },
});
