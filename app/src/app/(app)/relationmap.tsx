// app/src/app/(app)/relationmap.tsx — 관계 지도
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-14: *"내가 등록해둔 명식들을 모아서 관계지도를 만들꺼야"*
//   판정축 = 일간 + 오행 세력 · 역할 이름 = 생활어 · **지도는 무료**(결정론·API 0원)
//   상세는 기존 궁합(유료)으로 잇고, **유도는 맨 아래**에 둔다(daniel).
//
// ■ 왜 온디바이스인가
//   명식과 관계 라벨은 **암호화 blob** 안에 있어서 서버가 볼 수 없다(생일 역산 차단 설계).
//   그래서 전부 이 화면에서 계산한다 — 덕분에 API 비용도 0이다.
//
// ■ 배치 규칙(한 줄로 설명되게)
//   중앙이 나. **케미가 높을수록 가까이** 온다. 색은 그 사람 일간 오행.
//   ⚠️각도는 역할별 구역으로 나눈다 — 같은 역할끼리 모여 보여야 "내 관계가 어느 쪽으로 쏠렸는지"가
//     한눈에 읽힌다. 무작위로 뿌리면 예쁘기만 하고 아무 말도 못 한다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listCharts, getRepresentativeId, type SavedChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { buildRelationMap, type RelationNode, type RelationRole } from '@engine/relationMap';
import { rolePhrase, elemRelationLabel, compatHook } from '../../lib/content/relationMapPhrases';
import { appLang } from '../../lib/i18n';
import { createInvite, collectEntries } from '../../lib/backend/mapInvite';
import { Alert } from '../../lib/ui/alert';
import { saveLastCompat } from '../../screens/CompatScreen'; // 궁합 화면이 상대를 복원하는 그 경로
import { PressableScale } from '../../components/PressableScale';
import { colors, radius, space } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import type { Element } from '@spec/chart';

/**
 * 지도 노드 색 — 오행을 **구분**해야 하는 자리라 채도를 올린다.
 * 앱 배경(EL_BG)은 라벤더에 색조만 태운 아주 옅은 값이라 점으로 쓰면 서로 안 갈린다.
 * 색조 방향(청록·노을·흙·백은·물)은 그대로 따라가서 앱과 겉돌지 않게 했다.
 */
const NODE_COLOR: Record<Element, string> = {
  木: '#5FA98B', 火: '#D97A93', 土: '#C9A06A', 金: '#9AA0B8', 水: '#6E8FD1',
};

const MAP_SIZE = 300;          // 지도 정사각 한 변
const CENTER = MAP_SIZE / 2;
const R_MIN = 62;              // 케미 99 → 이만큼 가까이
const R_MAX = 124;             // 케미 1  → 이만큼 멀리
const DOT = 44;

/** 역할별 각도 구역(12시 방향부터 시계 방향). 같은 역할끼리 모여야 쏠림이 보인다. */
const ROLE_ARC: Record<RelationRole, number> = {
  인성: -90,   // 위    — 나를 채워주는 쪽
  비견: -18,   // 우상
  식상: 54,    // 우하  — 내가 쏟는 쪽
  재성: 126,   // 좌하
  관성: 198,   // 좌상  — 나를 조이는 쪽
};

export default function RelationMapScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fs } = useFontScale();
  const styles = mkStyles(fs);
  const lang = appLang() as 'ko' | 'en' | 'ja';

  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<SavedChart[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      // ★먼저 회수한다 — 친구가 링크로 넣어 둔 사람이 있으면 이번 화면에 바로 뜬다.
      //   실패해도 지도는 떠야 하므로 조용히 넘긴다(네트워크가 없을 수도 있다).
      const added = await collectEntries().catch(() => 0);
      const [list, rep] = await Promise.all([listCharts(), getRepresentativeId()]);
      if (!alive) return;
      setSaved(list); setMeId(rep ?? list[0]?.id ?? null);
      setLoading(false);
      // 담겼을 때만 알린다 — 0명인데 매번 뜨면 잔소리가 된다
      if (added > 0) Alert.alert(t('relmap.joinedTitle', '새로 들어왔어요'), t('relmap.joinedBody', '{{n}}명이 지도에 자리를 잡았어요.', { n: added }));
    })().catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [t]);

  /** 초대 링크를 만들어 공유 시트를 연다. 로그인 안 됐으면 먼저 안내한다. */
  async function onInvite() {
    if (inviting) return;
    setInviting(true);
    const link = await createInvite(map?.me?.label);
    setInviting(false);
    if (!link) {
      Alert.alert(t('relmap.needLoginTitle', '로그인이 필요해요'),
        t('relmap.needLoginBody', '친구가 넣은 정보를 내 계정으로 받아야 해서, 초대 링크는 로그인 후에 만들 수 있어요.'));
      return;
    }
    Share.share({ message: `${t('relmap.shareMsg', '내 관계 지도에 자리 하나 맡아 줘 — 생년월일만 넣으면 돼')}\n${link.url}` }).catch(() => {});
  }

  // ★계산은 명식이 바뀔 때만 — 명식 12개면 엔진이 12번 돈다(각 2.12ms). 매 렌더 돌리면 스크롤이 끊긴다.
  const map = useMemo(() => {
    const me = saved.find((c) => c.id === meId);
    if (!me) return null;
    try {
      const meChart = computeChart(me.input).saju;
      const others = saved.filter((c) => c.id !== meId && c.relation !== 'pet')
        .map((c) => { try { return { id: c.id, chart: computeChart(c.input).saju }; } catch { return null; } })
        .filter(Boolean) as { id: string; chart: ReturnType<typeof computeChart>['saju'] }[];
      return { me, ...buildRelationMap(meChart, others) };
    } catch { return null; }
  }, [saved, meId]);

  const nameOf = (id: string) => saved.find((c) => c.id === id)?.label ?? '';

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;

  // ── 명식이 없거나 나뿐일 때 ────────────────────────────────────────────
  if (!map || !map.nodes.length) {
    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.pad}>
        <Text style={styles.title}>{t('relmap.title', '관계 지도')}</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTx}>
            {map
              ? t('relmap.emptyOthers', '아직 나 혼자예요. 가족·친구의 생년월일을 더하면 그 사람이 나에게 어떤 결의 사람인지 지도에 떠요.')
              : t('relmap.emptyMe', '먼저 내 명식을 등록해 주세요. 그래야 관계를 볼 기준이 생겨요.')}
          </Text>
          <PressableScale style={styles.cta} onPress={() => router.push('/register')}>
            <Text style={styles.ctaTx}>{map ? t('relmap.addFriend', '사람 추가하기') : t('relmap.addMe', '내 명식 등록하기')}</Text>
          </PressableScale>
        </View>
      </ScrollView>
    );
  }

  const { nodes, summary } = map;
  const myElem = computeChart(map.me.input).saju.dayMaster.element as Element;
  // 같은 역할이 여럿이면 부채꼴 안에서 벌린다(겹침 방지)
  const seatOf = (n: RelationNode, i: number) => {
    const sameRole = nodes.filter((x) => x.role === n.role);
    const idx = sameRole.findIndex((x) => x.id === n.id);
    const spread = sameRole.length > 1 ? (idx - (sameRole.length - 1) / 2) * 26 : 0;
    const deg = ROLE_ARC[n.role] + spread;
    const r = R_MAX - ((n.chemi - 1) / 98) * (R_MAX - R_MIN);   // 케미 높을수록 가까이
    const rad = (deg * Math.PI) / 180;
    return { left: CENTER + Math.cos(rad) * r - DOT / 2, top: CENTER + Math.sin(rad) * r - DOT / 2 };
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + space(44) }]}>
      <Text style={styles.title}>{t('relmap.title', '관계 지도')}</Text>
      <Text style={styles.sub}>{t('relmap.count', '{{n}}명', { n: nodes.length })} · {t('relmap.hint', '가까울수록 케미가 잘 맞는 사람')}</Text>

      {/* ── 지도 ─────────────────────────────────────────────────────────── */}
      <View style={styles.mapBox}>
        <View style={styles.ring1} /><View style={styles.ring2} />
        {/* 중앙 = 나 */}
        <View style={[styles.me, { backgroundColor: NODE_COLOR[myElem] }]}>
          <Text style={styles.meElem}>{myElem}</Text>
          <Text style={styles.meLabel}>{t('relmap.me', '나')}</Text>
        </View>
        {nodes.map((n, i) => {
          const pos = seatOf(n, i);
          const on = openId === n.id;
          return (
            <Pressable key={n.id} style={[styles.node, pos, on && styles.nodeOn]} onPress={() => setOpenId(on ? null : n.id)}>
              <View style={[styles.dot, { backgroundColor: NODE_COLOR[n.dayElem] }]}>
                <Text style={styles.dotTx}>{n.dayElem}</Text>
              </View>
              <Text style={styles.nodeName} numberOfLines={1}>{nameOf(n.id)}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── 내 지도 요약 ─────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <Text style={styles.h2}>{t('relmap.summary', '내 지도는 이런 모양이에요')}</Text>
        <Text style={styles.body}>
          {summary.giveTakeGap > 1
            ? t('relmap.giving', '내가 쏟는 쪽이 더 많은 구성이에요. 챙기는 보람은 크지만, 받는 자리도 하나쯤 있어야 오래갑니다.')
            : summary.giveTakeGap < -1
              ? t('relmap.taking', '나를 채워주는 사람이 많은 구성이에요. 받은 만큼 흘려보낼 곳을 만들면 기운이 고이지 않아요.')
              : t('relmap.balanced', '주고받는 기운이 고르게 도는 구성이에요. 어느 한쪽으로 쏠리지 않아 관계에서 크게 지치지 않습니다.')}
        </Text>
        {!!summary.lackingElems.length && (
          <Text style={styles.note}>
            {t('relmap.lacking', '내 원국엔 {{el}} 기운이 없어요 — 그 기운을 가진 사람이 특히 귀합니다.', { el: summary.lackingElems.join('·') })}
          </Text>
        )}
        <View style={styles.chips}>
          {(Object.keys(summary.counts) as RelationRole[]).map((r) => (
            <View key={r} style={styles.chip}>
              <Text style={styles.chipN}>{summary.counts[r]}</Text>
              <Text style={styles.chipTx} numberOfLines={1}>{rolePhrase(lang, r).name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── 케미 순 리스트 + 펼치면 상세 ─────────────────────────────────── */}
      <Text style={styles.h2}>{t('relmap.list', '잘 맞는 순')}</Text>
      {nodes.map((n) => {
        const p = rolePhrase(lang, n.role);
        const on = openId === n.id;
        const hook = compatHook(lang, nameOf(n.id), n.chemi);
        return (
          <View key={n.id} style={styles.card}>
            <Pressable style={styles.row} onPress={() => setOpenId(on ? null : n.id)}>
              <View style={[styles.dotSm, { backgroundColor: NODE_COLOR[n.dayElem] }]}><Text style={styles.dotTx}>{n.dayElem}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{nameOf(n.id)}</Text>
                <Text style={styles.rowRole}>{p.name} · {elemRelationLabel(myElem, n.basisElem)}</Text>
              </View>
              <Text style={styles.chemi}>{n.chemi}</Text>
            </Pressable>

            {on && (
              <View style={styles.detail}>
                <Text style={styles.term}>{p.term}</Text>
                <Text style={styles.image}>{p.image}</Text>
                <Text style={styles.body}>{p.meaning}</Text>
                {/* ★세력 보정이 걸렸으면 반드시 밝힌다 — 근거 없이 역할이 바뀌면 신뢰를 잃는다 */}
                {n.adjusted && !!n.adjustNote && (
                  <Text style={styles.note}>{t('relmap.adjusted', '이 사람은 {{note}}해서 그 기운으로 봤어요.', { note: n.adjustNote })}</Text>
                )}
                <View style={styles.divider} />
                <Text style={styles.label}>{t('relmap.caution', '조심할 점')}</Text>
                <Text style={styles.body}>{p.caution}</Text>
                <Text style={[styles.label, { marginTop: space(4) }]}>{t('relmap.advice', '이렇게 지내면 좋아요')}</Text>
                <Text style={styles.body}>{p.advice}</Text>

                {/* 궁합 유도 — daniel: 맨 아래에 */}
                <View style={styles.hook}>
                  <Text style={styles.hookTitle}>{hook.title}</Text>
                  <Text style={styles.hookBody}>{hook.body}</Text>
                  <PressableScale style={styles.cta} onPress={() => { saveLastCompat({ meId: map.me.id, otherId: n.id }); router.push('/compat'); }}>
                    <Text style={styles.ctaTx}>{hook.cta}</Text>
                  </PressableScale>
                </View>
              </View>
            )}
          </View>
        );
      })}

      {/* ── 하단 콘텐츠 유도(daniel: "아래에 컨텐츠 유도") ──────────────── */}
      <View style={styles.card}>
        <Text style={styles.h2}>{t('relmap.more', '지도를 더 채우려면')}</Text>
        <Text style={styles.body}>{t('relmap.moreBody', '사람이 늘수록 내 관계의 결이 또렷해져요. 아직 안 넣은 사람이 있다면 생년월일만으로 바로 자리를 잡습니다.')}</Text>
        <PressableScale style={styles.cta} onPress={onInvite}>
          <Text style={styles.ctaTx}>{inviting ? t('relmap.inviting', '링크 만드는 중…') : t('relmap.invite', '초대 링크 보내기')}</Text>
        </PressableScale>
        <Text style={styles.note}>{t('relmap.inviteNote', '친구가 링크를 열어 생년월일을 넣으면 내 지도에 자리를 잡아요. 링크는 7일 뒤 닫혀요.')}</Text>
        <PressableScale style={styles.ctaGhost} onPress={() => router.push('/register')}>
          <Text style={styles.ctaGhostTx}>{t('relmap.addFriend', '사람 추가하기')}</Text>
        </PressableScale>
      </View>
    </ScrollView>
  );
}

const mkStyles = (fs: (n: number) => number) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  // 하단 176pt(=space(44)) — 마지막이 버튼이라 부족하면 배너 뒤로 숨어 기능이 죽는다(check:bottominset).
  pad: { padding: space(5), paddingBottom: space(44) },
  title: { color: colors.ink, fontSize: fs(22), lineHeight: fs(30), fontWeight: '800' },
  sub: { color: colors.inkSoft, fontSize: fs(13), lineHeight: fs(20), marginTop: space(1) },
  h2: { color: colors.ink, fontSize: fs(16), lineHeight: fs(24), fontWeight: '800', marginTop: space(6), marginBottom: space(2) },

  mapBox: {
    width: MAP_SIZE, height: MAP_SIZE, alignSelf: 'center', marginTop: space(5),
    borderRadius: MAP_SIZE / 2, backgroundColor: colors.sunk, overflow: 'hidden',
  },
  ring1: { position: 'absolute', left: CENTER - R_MIN, top: CENTER - R_MIN, width: R_MIN * 2, height: R_MIN * 2, borderRadius: R_MIN, borderWidth: 1, borderColor: colors.juLine, opacity: 0.5 },
  ring2: { position: 'absolute', left: CENTER - R_MAX, top: CENTER - R_MAX, width: R_MAX * 2, height: R_MAX * 2, borderRadius: R_MAX, borderWidth: 1, borderColor: colors.juLine, opacity: 0.3 },
  me: { position: 'absolute', left: CENTER - 30, top: CENTER - 30, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  meElem: { color: '#fff', fontSize: fs(18), lineHeight: fs(22), fontWeight: '800' },
  meLabel: { color: '#fff', fontSize: fs(10), lineHeight: fs(14), opacity: 0.9 },
  node: { position: 'absolute', width: DOT, alignItems: 'center' },
  nodeOn: { transform: [{ scale: 1.08 }] },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: 'center', justifyContent: 'center' },
  dotSm: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: space(3) },
  dotTx: { color: '#fff', fontSize: fs(14), lineHeight: fs(18), fontWeight: '800' },
  nodeName: { color: colors.ink, fontSize: fs(10), lineHeight: fs(14), marginTop: 2, maxWidth: DOT + 16, textAlign: 'center' },

  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(4), marginTop: space(3) },
  body: { color: colors.ink, fontSize: fs(14), lineHeight: fs(23) },
  note: { color: colors.inkSoft, fontSize: fs(12), lineHeight: fs(19), marginTop: space(2) },
  label: { color: colors.ju, fontSize: fs(13), lineHeight: fs(20), fontWeight: '800', marginBottom: space(1) },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(4) },
  chip: { backgroundColor: colors.sunk, borderRadius: radius.sm, paddingHorizontal: space(3), paddingVertical: space(2), alignItems: 'center', minWidth: 62 },
  chipN: { color: colors.ju, fontSize: fs(16), lineHeight: fs(22), fontWeight: '800' },
  chipTx: { color: colors.inkSoft, fontSize: fs(10), lineHeight: fs(15) },

  row: { flexDirection: 'row', alignItems: 'center' },
  rowName: { color: colors.ink, fontSize: fs(15), lineHeight: fs(22), fontWeight: '700' },
  rowRole: { color: colors.inkSoft, fontSize: fs(12), lineHeight: fs(19) },
  chemi: { color: colors.ju, fontSize: fs(20), lineHeight: fs(26), fontWeight: '800', marginLeft: space(2) },

  detail: { marginTop: space(4) },
  term: { color: colors.inkFaint, fontSize: fs(11), lineHeight: fs(16) },
  image: { color: colors.ink, fontSize: fs(14), lineHeight: fs(22), fontWeight: '700', marginTop: space(1), marginBottom: space(2) },
  divider: { height: 1, backgroundColor: colors.juLine, marginVertical: space(4) },

  hook: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginTop: space(5) },
  hookTitle: { color: colors.ink, fontSize: fs(15), lineHeight: fs(23), fontWeight: '800' },
  hookBody: { color: colors.inkSoft, fontSize: fs(13), lineHeight: fs(21), marginTop: space(2) },

  emptyCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(5), marginTop: space(5) },
  emptyTx: { color: colors.ink, fontSize: fs(14), lineHeight: fs(23) },
  cta: { marginTop: space(4), backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  ctaTx: { color: '#fff', fontSize: fs(15), lineHeight: fs(21), fontWeight: '800' },
  ctaGhost: { marginTop: space(4), borderWidth: 1, borderColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), alignItems: 'center' },
  ctaGhostTx: { color: colors.ju, fontSize: fs(14), lineHeight: fs(20), fontWeight: '700' },
});
