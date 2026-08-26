// app/src/components/talk/PersonSheet.tsx — **한 사람의 모든 것**을 옆에서 연다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26 결정: *"사람 상세 패널로 가자"*
//
// ■ 무엇을 고치나 — **두 갈래로 갈려 있던 길을 하나로**
//   종전엔 같은 «사람» 을 눌렀는데 목적지가 달랐다:
//     내 이름   → `/charts`(만세력)      · 화면이 통째로 바뀐다
//     친구 이름 → `/friendcompat`(궁합)  · 그 사람 «명식» 을 보는 길은 따로 없다
//   ⇒ 대화하러 왔는데 **다른 세계로 튕기고**, 돌아오면 어디였는지 잃는다.
//   ⇒ 여기서는 **옆에서 패널이 열린다.** 화면을 안 떠나므로 닫으면 그 자리다.
//
// ■ ★새로 그린 것이 거의 없다
//   명식 = `SharedChart`(커뮤니티·친구궁합이 쓰던 그것) · 궁합 = `CompatPeek`
//   ⇒ «무엇까지 보이나» 가 화면마다 갈리지 않는다. 그 갈림은 곧 **정보 유출 폭의 차이**다
//     (`friendcompat.tsx` 가 같은 이유로 커뮤니티와 같은 컴포넌트를 쓴다).
//
// ■ ⚠️대운·세운은 **내 것만** 보여 준다
//   `showLuck` 은 친구에게 false 다. 대운은 성별에 따라 순역이 갈리고 시작 나이가 절기까지의
//   일수로 정해져 **생일 역산을 더 쉽게** 만든다 — 여덟 글자만으로도 이미 충분히 사적이다.
//   (`communityChart.ts`·`friendcompat.tsx` 가 세운 선을 그대로 따른다.)
//
// ■ ⚠️`Modal` 을 안 쓴다
//   iOS 에서 그 안의 `VideoView` 가 소리만 남고 안 보인다(ProfileSheet 가 같은 이유로 안 쓴다).
//   그리고 `absoluteFill` 은 **부모를 채우므로** 호출부는 이걸 **가장 바깥 View 안**에 둬야 한다
//   ([[overlay-absolutefill-parent]]).
//
// ■ 탭이 셋인 이유(넷이 아니라)
//   기획서는 «관계 타임라인» 도 말하지만 **아직 그 자리가 없다** — 사용자가 사건을 적는 화면이
//   생기기 전에 빈 탭을 두면 그건 «없는 기능» 을 있는 척하는 것이다. 생기면 그때 넷째를 붙인다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../PressableScale';
import { CompatPeek } from '../CompatPeek';
import { SharedChart } from '../SharedChart';
import { toSharedSaju } from '../../lib/backend/communityChart';
import { listFriends, loadFriendChart } from '../../lib/talk/friends';
import { loadRepChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { analyzeCompatibility } from '@engine/compatibility';
import { appLang } from '../../lib/i18n';
import { elementColor, elementText, stemElement } from '../../lib/engine/ohaeng';
import { colors, space, radius, font } from '../../lib/theme';
import type { CompatibilityDx } from '@engine/compatibility';

/** 누구를 여는가. `me` = 내 대표 명식 · `friend` = 친구추가한 사람 */
export type PersonTarget =
  | { kind: 'me'; name?: string | null }
  | { kind: 'friend'; id: string; name?: string | null; avatarUrl?: string | null };

type Tab = 'chart' | 'compat' | 'talk';

/** 화면에 쓸 만큼만 담는다 — 원시 생년월일시는 이 컴포넌트가 **들고 있지 않는다**. */
type Loaded = {
  saju: any | null;
  /** 궁합 — 친구일 때만. 내 것끼리는 궁합이 성립하지 않는다 */
  dx: CompatibilityDx | null;
  /** 못 보는 이유(상대가 공개 안 함 · 내 명식 없음 · 친구 아님) */
  blocked: 'notShared' | 'noMe' | 'gone' | null;
};

/**
 * 사람 상세 패널.
 *
 * @param target    누구를 열지. `null` 이면 안 그린다
 * @param onClose   닫기
 * @param onMention 「대화에서 부르기」 — 이름을 넘긴다(호출부가 `@이름` 을 입력창에 넣는다)
 * @param onMore    「자세히」 — 갈 경로를 넘긴다(만세력·궁합 전체 화면)
 */
export function PersonSheet({ target, onClose, onMention, onMore }: {
  target: PersonTarget | null;
  onClose: () => void;
  onMention?: (name: string) => void;
  onMore?: (route: string) => void;
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  // ★훅은 **조기 return 위**에 전부 둔다(React #310 — 08-26 웹이 통째로 죽었던 그것)
  const [tab, setTab] = useState<Tab>('chart');
  const [data, setData] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);

  const key = target ? (target.kind === 'me' ? 'me' : `f:${target.id}`) : '';

  useEffect(() => {
    if (!target) { setData(null); return; }
    let alive = true;
    setBusy(true); setData(null); setTab('chart');   // ★사람이 바뀌면 탭도 처음으로
    (async () => {
      try {
        if (target.kind === 'me') {
          const rep = await loadRepChart();
          if (!alive) return;
          if (!rep?.input) { setData({ saju: null, dx: null, blocked: 'noMe' }); return; }
          setData({ saju: computeChart(rep.input).saju, dx: null, blocked: null });
          return;
        }
        // ── 친구 ─────────────────────────────────────────────────────────────
        const f = (await listFriends()).find((x) => x.otherId === target.id && x.status === 'accepted') ?? null;
        if (!alive) return;
        if (!f) { setData({ saju: null, dx: null, blocked: 'gone' }); return; }
        if (!f.chartId) { setData({ saju: null, dx: null, blocked: 'notShared' }); return; }
        const [mine, theirs] = await Promise.all([loadRepChart(), loadFriendChart(f.chartId)]);
        if (!alive) return;
        if (!theirs?.saju) { setData({ saju: null, dx: null, blocked: 'notShared' }); return; }
        // ★내 명식이 없어도 **상대 명식은 보여 준다** — 궁합만 못 낼 뿐이다.
        //   («명식도 궁합도 못 본다» 로 묶으면, 명식 등록 전에는 아무것도 못 보는 화면이 된다.)
        let dx: CompatibilityDx | null = null;
        if (mine?.input) {
          try {
            // ★내 것만 계산하고 상대는 **서버가 이미 계산해 둔 것**을 쓴다(원가 0 · 항상 같은 값)
            dx = analyzeCompatibility(computeChart(mine.input).saju, theirs.saju);
          } catch (e) { console.warn('[person] 궁합 계산 실패', e); }
        }
        setData({ saju: theirs.saju, dx, blocked: mine?.input ? null : 'noMe' });
      } catch (e) {
        console.warn('[person] 로드 실패', e);
        if (alive) setData({ saju: null, dx: null, blocked: 'gone' });
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => { alive = false; };
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps

  // 일주 — 헤더 배지. 없으면 그 줄을 안 그린다
  const ilju = useMemo(() => {
    const d = data?.saju?.pillars?.['일'];
    return d ? { gz: `${d.stem}${d.branch}`, el: stemElement(d.stem) } : null;
  }, [data]);

  if (!target) return null;

  const isMe = target.kind === 'me';
  const name = (target.name ?? '').trim() || (isMe ? t('person.me', '내 명식') : t('friends.noName', '이름 없음'));
  // 패널 폭 — 좁은 화면에서는 거의 다 덮고, 넓으면 오른쪽 한 칸만 차지한다
  const panelW = Math.min(width, Math.max(360, Math.round(width * 0.42)), 520);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'chart', label: t('person.tabChart', '명식') },
    // ★내 것에는 «관계»도 «대화»도 없다 — **탭 자체를 안 그린다.**
    //   · 궁합: 나와 나의 궁합은 성립하지 않는다.
    //   · 대화: 내 명식은 상담가가 **늘 보고 있다**(매 턴 차트 블록으로 간다).
    //     「@나 부르기」 버튼을 두면 «이미 되고 있는 것» 을 다시 하라고 시키는 셈이다.
    //   ⇒ 눌러도 할 일이 없는 탭은 만들지 않는다([[category-management-ui]] 의 반대편 실수).
    ...(isMe ? [] : [
      { key: 'compat' as Tab, label: t('person.tabCompat', '관계') },
      { key: 'talk' as Tab, label: t('person.tabTalk', '대화') },
    ]),
  ];

  const blockedText = data?.blocked === 'notShared'
    ? t('person.notShared', '아직 명식을 공개하지 않았어요.')
    : data?.blocked === 'gone'
      ? t('person.gone', '친구 목록에 없는 사람이에요.')
      : data?.blocked === 'noMe' && isMe
        ? t('person.noMe', '내 명식을 먼저 등록해 주세요.')
        : null;

  return (
    <View style={styles.root}>
      {/* 바깥을 누르면 닫힌다 — 대화는 뒤에 그대로 있다 */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.panel, { width: panelW, maxHeight: height }]}>

        {/* ── 머리 ── */}
        <View style={styles.head}>
          {target.kind === 'friend' && target.avatarUrl
            ? <ExpoImage source={{ uri: target.avatarUrl }} style={styles.av} contentFit="cover" transition={140} />
            : (
              <View style={[styles.av, styles.center, { backgroundColor: elementColor[ilju?.el ?? '木'] }]}>
                <Text style={[styles.avTx, { color: elementText[ilju?.el ?? '木'] }]}>{name.slice(0, 1)}</Text>
              </View>
            )}
          <View style={styles.headMid}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{isMe ? t('person.mine', '내 명식') : t('person.friend', '친구')}</Text>
              {ilju ? (
                <View style={[styles.iljuTag, { backgroundColor: elementColor[ilju.el] }]}>
                  <Text style={[styles.iljuTx, { color: elementText[ilju.el] }]}>{ilju.gz}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <PressableScale hitSlop={10} onPress={onClose} accessibilityLabel={t('common.close', '닫기')}>
            <Text style={styles.close}>×</Text>
          </PressableScale>
        </View>

        {/* ── 탭 ── ★하나뿐이면 안 그린다(고를 것이 없는 탭 줄은 잡음이다) */}
        {TABS.length > 1 ? (
        <View style={styles.tabs}>
          {TABS.map((tb) => (
            <PressableScale key={tb.key} style={[styles.tab, tab === tb.key && styles.tabOn]} onPress={() => setTab(tb.key)}>
              <Text style={[styles.tabTx, tab === tb.key && styles.tabTxOn]}>{tb.label}</Text>
            </PressableScale>
          ))}
        </View>
        ) : null}

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyPad}>
          {busy ? (
            <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>
          ) : (
            <>
              {/* ── 명식 ── */}
              {tab === 'chart' ? (
                data?.saju ? (
                  <>
                    {/* ★커뮤니티·친구궁합과 **같은 컴포넌트**를 쓴다 — 여기서 새로 그리면
                        «무엇까지 보이나» 가 화면마다 갈리고, 그 갈림이 곧 정보 유출 폭의 차이다.
                        ⚠️`showLuck` 은 **내 것만** true — 대운은 생일 역산을 더 쉽게 만든다. */}
                    <SharedChart saju={toSharedSaju(data.saju, isMe)} showLuck={isMe} />
                    {isMe ? (
                      <PressableScale style={styles.more} onPress={() => { onClose(); onMore?.('/charts'); }}>
                        <Text style={styles.moreTx}>{t('person.openManse', '만세력에서 자세히 보기')}</Text>
                      </PressableScale>
                    ) : null}
                  </>
                ) : <Text style={styles.blocked}>{blockedText ?? t('person.noChart', '볼 수 있는 명식이 없어요.')}</Text>
              ) : null}

              {/* ── 관계(궁합) ── */}
              {tab === 'compat' ? (
                data?.dx ? (
                  <>
                    <CompatPeek name={name} dx={data.dx} lang={appLang() as never} onOpen={() => {}} />
                    <PressableScale
                      style={styles.more}
                      onPress={() => { onClose(); onMore?.(`/friendcompat?friend=${target.kind === 'friend' ? target.id : ''}`); }}
                    >
                      <Text style={styles.moreTx}>{t('person.openCompat', '궁합 자세히 보기')}</Text>
                    </PressableScale>
                  </>
                ) : (
                  <Text style={styles.blocked}>
                    {data?.blocked === 'noMe'
                      ? t('person.needMine', '내 명식을 등록하면 이 사람과의 궁합을 볼 수 있어요.')
                      : blockedText ?? t('person.noCompat', '아직 궁합을 낼 수 없어요.')}
                  </Text>
                )
              ) : null}

              {/* ── 대화 ── */}
              {tab === 'talk' ? (
                <View style={styles.talkBox}>
                  <Text style={styles.talkLead}>
                    {t('person.talkLead', '이 사람을 대화에서 부르면, 상담가가 이 명식을 함께 보고 답해요.')}
                  </Text>
                  <PressableScale
                    style={styles.cta}
                    disabled={!data?.saju}
                    onPress={() => { onClose(); onMention?.(name); }}
                  >
                    <Text style={styles.ctaTx}>
                      {t('person.mention', '대화에서 @{{name}} 부르기').replace('{{name}}', name)}
                    </Text>
                  </PressableScale>
                  {!data?.saju ? (
                    <Text style={styles.blocked}>{blockedText ?? t('person.noChart', '볼 수 있는 명식이 없어요.')}</Text>
                  ) : null}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ⚠️`absoluteFill` 은 **부모를 채운다** — 호출부가 가장 바깥 View 안에 둬야 한다
  root: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 55 },
  panel: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: space(8) },

  head: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(5), paddingBottom: space(3) },
  av: { width: 48, height: 48, borderRadius: 16 },
  avTx: { ...font.title, fontWeight: '900' },
  headMid: { flex: 1, gap: 2 },
  name: { ...font.title, color: colors.ink, fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  meta: { ...font.caption, color: colors.inkSoft },
  // 일주 배지 — 오행색. ★색만이 아니라 **간지 글자**로도 보인다
  iljuTag: { paddingHorizontal: space(2), paddingVertical: 1, borderRadius: 999 },
  iljuTx: { ...font.caption, fontWeight: '800' },
  close: { ...font.title, color: colors.inkFaint, paddingHorizontal: space(2) },

  tabs: { flexDirection: 'row', gap: space(2), paddingHorizontal: space(5), paddingBottom: space(3) },
  tab: { paddingHorizontal: space(3.5), paddingVertical: space(1.5), borderRadius: 999, backgroundColor: colors.sunk },
  tabOn: { backgroundColor: colors.ju },
  tabTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  tabTxOn: { color: '#fff' },

  body: { flex: 1 },
  bodyPad: { paddingHorizontal: space(5), paddingBottom: space(10) },
  blocked: { ...font.body, color: colors.inkSoft, paddingVertical: space(6), textAlign: 'center' },

  more: {
    marginTop: space(4), borderWidth: 1, borderColor: colors.juLine, borderRadius: radius.md,
    paddingVertical: space(3.5), alignItems: 'center',
  },
  moreTx: { ...font.body, color: colors.ju, fontWeight: '800' },

  talkBox: { gap: space(4), paddingTop: space(2) },
  talkLead: { ...font.body, color: colors.inkSoft },
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center' },
  ctaTx: { ...font.body, color: '#fff', fontWeight: '800' },
});
