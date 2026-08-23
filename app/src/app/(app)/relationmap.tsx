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
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Share } from 'react-native';
import { Image as ExpoImage } from 'expo-image';   // 뷰 크기 다운샘플 + 디스크 캐시(원본 풀 디코딩 방지)
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listCharts, getRepresentativeId, type SavedChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { buildRelationMap, type RelationNode, type RelationRole } from '@engine/relationMap';
import { rolePhrase, elemRelationLabel, elemLabel, traitPhrases, traitLead, type TraitFacts } from '../../lib/content/relationMapPhrases';
import { BRANCH_GLOSSARY } from '../../lib/content/myeongriGlossary';   // 지지 한자 → 한글 이름표(단일 출처)
import { ROLE_IMG, RELMAP_HERO } from '../../lib/content/relationMapImages';
import { CompatPeek } from '../../components/CompatPeek';
import { useWebCols } from '../../components/WebShell'; // 넓은 웹 = 2열(폰은 그대로 세로)
import { appLang } from '../../lib/i18n';
import { createInvite, collectEntries } from '../../lib/backend/mapInvite';
import { Alert } from '../../lib/ui/alert';
import { saveLastCompat } from '../../lib/core/lastCompat'; // 궁합 화면이 상대를 복원하는 그 경로(2026-08-23 화면 밖으로 분리)
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
/**
 * ★지도에 그리는 최대 인원(daniel 2026-08-14 실기기: **61명이 뭉개져** 이름이 겹쳤다).
 *   원 하나에 61개를 올리면 도넛이 되고 아무 정보도 안 남는다.
 *   ⇒ 지도는 **케미 상위 10명**만. 나머지는 아래 목록이 전부 보여 준다(잘라 숨기는 게 아니다 —
 *     [[list-truncation-hides-content]] 의 교훈대로 **어디서 다 볼 수 있는지 화면에 적는다**).
 */
const MAP_MAX = 10;

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
  const two = useWebCols() > 1;   // 넓은 웹에서만 좌/우 두 단
  const lang = appLang() as 'ko' | 'en' | 'ja';

  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<SavedChart[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  /** 아래 리스트에서 펼친 사람 */
  const [openId, setOpenId] = useState<string | null>(null);
  /**
   * ★지도에서 **점을 눌러** 궁합을 연 사람(daniel 2026-08-15 "탭하면 상대와 나의 궁합이 나오게").
   *
   * `openId`(리스트 펼침)와 나누는 이유: 종전엔 점을 눌러도 `openId` 만 바뀌어서
   * **한참 아래 리스트가 펼쳐졌다** — 화면에는 아무 일도 안 일어난 것처럼 보였다.
   * 이제 점을 누르면 **지도 바로 밑에** 궁합이 열린다. 둘을 합치면 같은 사람이 두 곳에 그려진다.
   */
  const [peekId, setPeekId] = useState<string | null>(null);

  const [inviting, setInviting] = useState(false);

  // 점을 눌렀을 때 궁합 카드가 화면 밖에 열리지 않도록 그 자리로 스크롤한다(히어로+지도 아래라 접힘)
  const scrollRef = useRef<ScrollView>(null);
  const peekY = useRef(0);
  const scrolledFor = useRef<string | null>(null);   // 이미 옮겨 준 카드(같은 카드로 반복 스크롤 방지)

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

  /**
   * 결 문구의 `{{v}}` 에 넣을 **실제 값**을 뽑는다.
   * ★"내게 없는 글자를 여럿"보다 "내게 없는 말·용을"이 낫다 — 사람마다 달라지고 근거가 보인다.
   *   값이 없는 결은 문구 쪽에서 알아서 빠진다(`{{v}}` 노출 방지).
   *
   * ⚠️★한자를 그대로 내보내지 않는다 (daniel 2026-08-19: *"辰·亥·申 이런식으로 나오는데 일반인은 이해못해"*)
   *   이 파일이 아니라 `relationMapPhrases.ts` 에 **이미 그 원칙이 적혀 있었다** —
   *   *"명리를 아는 사람에겐 정확하지만 모르는 사람에겐 읽을 수조차 없는 기호다.
   *     한자는 버리지 않고 괄호로 남긴다"* — 오행에는 적용됐는데 **지지에는 안 돼 있었다.**
   *   ⇒ `BRANCH_GLOSSARY.ko`(= `'진(용)'`)를 쓴다. 그 사전은 이미 daniel 검수를 거쳤고,
   *     여기서 새 표를 만들면 화면마다 말이 갈린다([[duplicate-ui-single-source]]).
   *     띠 이름은 **같은 글자의 다른 이름표**라 해석이 섞이지 않는다(1:1).
   */
  const factsOf = (n: RelationNode): TraitFacts => {
    const dx = n.dx as any;
    /** 지지 한자 → 「용·돼지」. 사전에 없으면 원문을 그대로 둔다(빈칸보다 낫다). */
    const branchesKo = (chars: string[]): string =>
      chars.map((ch) => BRANCH_GLOSSARY[ch]?.ko?.match(/\(([^)]+)\)/)?.[1] ?? ch).join('·');
    return {
      fills: dx?.missingFill?.chars?.length ? branchesKo(dx.missingFill.chars) : undefined,
      clash: dx?.spousePalace?.afflictions?.length ? dx.spousePalace.afflictions.join('·') : undefined,
      friction: dx?.tension?.length ? String(dx.tension.length) : undefined,
      meshes: dx?.harmony?.length ? String(dx.harmony.length) : undefined,
      intense: n.adjusted ? n.basisElem : undefined,   // 세력 보정이 걸린 오행 = 그 사람의 몰린 기운
    };
  };

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
  /**
   * ★지도에 앉힐 사람 = **역할마다 케미 상위 2명씩**(daniel 2026-08-14 실기기 "지금 왜 일부만 나와?").
   *
   * 케미 순으로만 10명을 뽑았더니 **한 역할이 독식**했다 — daniel 화면엔 火(관성) 7명·水 2명뿐이고
   * 土·金·木 방향은 통째로 비었다. 관계 지도인데 다섯 방향 중 둘만 보이면 지도가 아니다.
   * ⇒ 역할별로 먼저 자리를 나눠 **다섯 방향이 다 차게** 하고, 남는 자리만 케미 순으로 채운다.
   *   (역할이 실제로 없으면 그 방향은 비는 게 맞다 — 없는 사람을 지어내지 않는다.)
   */
  const shown = (() => {
    const perRole: RelationNode[] = [];
    for (const r of Object.keys(ROLE_ARC) as RelationRole[]) {
      perRole.push(...nodes.filter((n) => n.role === r).slice(0, 2));   // nodes 는 이미 케미 내림차순
    }
    const rest = nodes.filter((n) => !perRole.includes(n));
    return [...perRole, ...rest].slice(0, MAP_MAX);
  })();
  const hidden = nodes.length - shown.length;      // 목록에서만 보이는 사람
  const myElem = computeChart(map.me.input).saju.dayMaster.element as Element;
  // 같은 역할이 여럿이면 부채꼴 안에서 벌린다(겹침 방지)
  // ★거리는 **이 지도 안의 최고~최저**에 맞춰 편다. 절대값(1~99)으로 매핑하면
  //   케미가 66~85 처럼 좁게 모인 실제 데이터에서 전원이 같은 반지름에 서서 도넛이 된다.
  const chemis = shown.map((n) => n.chemi);
  const hi = Math.max(...chemis), lo = Math.min(...chemis);
  const span = Math.max(1, hi - lo);
  const seatOf = (n: RelationNode) => {
    const sameRole = shown.filter((x) => x.role === n.role);
    const idx = sameRole.findIndex((x) => x.id === n.id);
    // 역할당 2명이 기본이라 ±17° = 34° 벌어진다 — 이름표(최대 60pt)가 안쪽 반지름(62pt)에서도 안 겹친다
    const spread = sameRole.length > 1 ? (idx - (sameRole.length - 1) / 2) * 34 : 0;
    const deg = ROLE_ARC[n.role] + spread;
    const r = R_MAX - ((n.chemi - lo) / span) * (R_MAX - R_MIN);
    const rad = (deg * Math.PI) / 180;
    return { left: CENTER + Math.cos(rad) * r - DOT / 2, top: CENTER + Math.sin(rad) * r - DOT / 2 };
  };

  return (
    <ScrollView ref={scrollRef} style={styles.wrap} contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + space(44) }]}>
      <Text style={styles.title}>{t('relmap.title', '관계 지도')}</Text>
      <Text style={styles.sub}>{t('relmap.count', '{{n}}명', { n: nodes.length })} · {t('relmap.hint', '가까울수록 케미가 잘 맞는 사람')}</Text>

      {/* ★넓은 웹 = 2열. **왼쪽 = 지도와 그 지도에서 누른 사람의 궁합**, 오른쪽 = 요약·전체 목록.
          이 순서라야 "점을 누르면 지도 바로 아래에 궁합"이라는 규칙이 데스크톱에서도 그대로 산다.
          폰에서는 `two=false` 라 이 View 들이 아무 스타일도 안 걸치고 지나간다(세로 그대로). */}
      <View style={two ? styles.two : undefined}>
      <View style={two ? styles.colL : undefined}>

      {/* ★히어로(daniel 2026-08-15 "디자인 — 이미지 사용") — 지도 그 자체를 그린 그림.
          앱의 다른 화면은 전부 카드아트가 있는데 여기만 색 원뿐이라 딴 앱처럼 보였다. */}
      <ExpoImage source={RELMAP_HERO} style={styles.hero} contentFit="cover" transition={200} />

      {/* ── 지도 ─────────────────────────────────────────────────────────── */}
      <View style={styles.mapBox}>
        <View style={styles.ring1} /><View style={styles.ring2} />
        {/* 중앙 = 나 */}
        <View style={[styles.me, { backgroundColor: NODE_COLOR[myElem] }]}>
          <Text style={styles.meElem}>{elemLabel(myElem, lang)}</Text>
          <Text style={styles.meLabel}>{t('relmap.me', '나')}</Text>
        </View>
        {shown.map((n) => {
          const pos = seatOf(n);
          const on = peekId === n.id;
          return (
            <Pressable
              key={n.id}
              style={[styles.node, pos, on && styles.nodeOn]}
              // ★탭 = 궁합 열기(같은 점을 다시 누르면 닫는다). `scrolledFor` 를 비워
              //   새로 연 카드로 한 번만 스크롤되게 한다(열 때마다 튀지 않게).
              onPress={() => { scrolledFor.current = null; setPeekId(on ? null : n.id); }}
            >
              <View style={[styles.dot, { backgroundColor: NODE_COLOR[n.dayElem] }, on && styles.dotOn]}>
                <Text style={styles.dotTx}>{elemLabel(n.dayElem, lang)}</Text>
                {/* ★점수(daniel 2026-08-15 "지도에 점수 표시") — 거리로만 표현하면
                    "가깝다"는 알겠는데 얼마나인지는 아래 목록까지 내려가야 했다. */}
                <View style={styles.badge}><Text style={styles.badgeTx}>{n.chemi}</Text></View>
              </View>
              <Text style={styles.nodeName} numberOfLines={1}>{nameOf(n.id)}</Text>
            </Pressable>
          );
        })}
      </View>

      {hidden > 0 && (
        <Text style={styles.mapNote}>
          {t('relmap.mapCap', '지도에는 자리마다 가까운 {{n}}명을 그렸어요 — 나머지 {{r}}명은 아래 목록에 있어요.', { n: shown.length, r: hidden })}
        </Text>
      )}

      {/* ── ★점을 누르면 여기 = 그 사람과 나의 궁합 ──────────────────────── */}
      {(() => {
        const p = peekId ? nodes.find((n) => n.id === peekId) : null;
        if (!p) return (
          <Text style={styles.mapNote}>{t('relmap.tapHint', '점을 누르면 그 사람과 나의 궁합이 열려요.')}</Text>
        );
        return (
          <View onLayout={(e) => {
            peekY.current = e.nativeEvent.layout.y;
            // 카드가 화면 밖(히어로+지도 아래)에 열리면 아무 일도 안 일어난 것처럼 보인다 → 그 자리로 옮긴다
            if (peekId && scrolledFor.current !== peekId) {
              scrolledFor.current = peekId;
              scrollRef.current?.scrollTo({ y: Math.max(0, peekY.current - space(3)), animated: true });
            }
          }}>
            <CompatPeek
              name={nameOf(p.id)}
              roleName={rolePhrase(lang, p.role).name}
              dx={p.dx}
              lang={lang}
              onOpen={() => { saveLastCompat({ meId: map.me.id, otherId: p.id }); router.push('/compat'); }}
            />
          </View>
        );
      })()}

      </View>
      <View style={two ? styles.colR : undefined}>

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
            {t('relmap.lacking', '내 사주엔 {{el}} 기운이 없어요 — 그 기운을 가진 사람이 특히 귀합니다.', { el: summary.lackingElems.map((e) => elemLabel(e, lang)).join('·') })}
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
        return (
          <View key={n.id} style={styles.card}>
            <Pressable style={styles.row} onPress={() => setOpenId(on ? null : n.id)}>
              <View style={[styles.dotSm, { backgroundColor: NODE_COLOR[n.dayElem] }]}><Text style={styles.dotTx}>{elemLabel(n.dayElem, lang)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{nameOf(n.id)}</Text>
                <Text style={styles.rowRole} numberOfLines={2}>{p.name} · {elemRelationLabel(myElem, n.basisElem, lang)}</Text>
                {/* ★같은 역할이라도 사람마다 다른 한 줄(daniel: "원국기준 다양하게") */}
                {!!traitLead(lang, n.traits, factsOf(n)) && (
                  <Text style={styles.rowTrait} numberOfLines={2}>{traitLead(lang, n.traits, factsOf(n))}</Text>
                )}
              </View>
              <Text style={styles.chemi}>{n.chemi}</Text>
            </Pressable>

            {on && (
              <View style={styles.detail}>
                {/* ★역할 그림 — 문구의 비유("마른 흙에 물이 스미듯")를 그대로 그린 것이라
                    글을 읽기 전에 무슨 사이인지 먼저 보인다(daniel "디자인 — 이미지 사용") */}
                {ROLE_IMG[n.role] && (
                  <ExpoImage source={ROLE_IMG[n.role]} style={styles.roleImg} contentFit="cover" transition={200} />
                )}
                <Text style={styles.term}>{p.term}</Text>
                <Text style={styles.image}>{p.image}</Text>
                <Text style={styles.body}>{p.meaning}</Text>
                {/* ★세력 보정이 걸렸으면 반드시 밝힌다 — 근거 없이 역할이 바뀌면 신뢰를 잃는다 */}
                {n.adjusted && !!n.adjustFrom && (
                  <Text style={styles.note}>
                    {t('relmap.adjusted', '태어난 날은 {{from}}이지만 사주 전체에 {{to}} 기운이 몰려 있어, 그쪽으로 봤어요.',
                      { from: elemLabel(n.adjustFrom, lang), to: elemLabel(n.basisElem, lang) })}
                  </Text>
                )}
                {traitPhrases(lang, n.traits, factsOf(n)).map((tp, i) => (
                  <Text key={i} style={styles.traitBody}>{tp.replace(/\*\*/g, '')}</Text>
                ))}
                <View style={styles.divider} />
                <Text style={styles.label}>{t('relmap.caution', '조심할 점')}</Text>
                <Text style={styles.body}>{p.caution}</Text>
                <Text style={[styles.label, { marginTop: space(4) }]}>{t('relmap.advice', '이렇게 지내면 좋아요')}</Text>
                <Text style={styles.body}>{p.advice}</Text>

                {/* 궁합 — daniel: 맨 아래에. 지도에서 점을 눌렀을 때와 **같은 카드**를 쓴다
                    (두 벌로 그리면 한쪽만 고쳐지는 날이 온다). */}
                {/* `compact` = 등급 그림 생략 — 이 카드엔 위에 역할 그림이 이미 있다 */}
                <CompatPeek
                  name={nameOf(n.id)}
                  dx={n.dx}
                  lang={lang}
                  compact
                  onOpen={() => { saveLastCompat({ meId: map.me.id, otherId: n.id }); router.push('/compat'); }}
                />
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

      </View>
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

  // 히어로 — 다른 화면(카드아트)과 같은 규격. 높이를 더 키우면 지도가 첫 화면에서 밀린다.
  hero: { width: '100%', height: 140, borderRadius: radius.md, marginTop: space(4) },

  mapBox: {
    width: MAP_SIZE, height: MAP_SIZE, alignSelf: 'center', marginTop: space(5),
    borderRadius: MAP_SIZE / 2, backgroundColor: colors.sunk, overflow: 'hidden',
  },
  ring1: { position: 'absolute', left: CENTER - R_MIN, top: CENTER - R_MIN, width: R_MIN * 2, height: R_MIN * 2, borderRadius: R_MIN, borderWidth: 1, borderColor: colors.juLine, opacity: 0.5 },
  ring2: { position: 'absolute', left: CENTER - R_MAX, top: CENTER - R_MAX, width: R_MAX * 2, height: R_MAX * 2, borderRadius: R_MAX, borderWidth: 1, borderColor: colors.juLine, opacity: 0.3 },
  me: { position: 'absolute', left: CENTER - 30, top: CENTER - 30, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  meElem: { color: '#fff', fontSize: fs(15), lineHeight: fs(20), fontWeight: '800' },   // '나무'(2글자)가 들어간다
  meLabel: { color: '#fff', fontSize: fs(10), lineHeight: fs(14), opacity: 0.9 },
  node: { position: 'absolute', width: DOT, alignItems: 'center' },
  nodeOn: { transform: [{ scale: 1.08 }] },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: 'center', justifyContent: 'center' },
  dotOn: { borderWidth: 2, borderColor: colors.ju },   // 지금 궁합을 연 사람이 지도에서 보이게
  /**
   * 점수 배지 — 원 오른쪽 아래에 물린다. 카드 배경색을 깔아야 오행 색 위에서도 숫자가 읽힌다.
   * ⚠️튀어나오는 값(right/bottom)을 -2 로 잡은 이유: `mapBox` 가 `overflow:'hidden'` 이라
   *   지도 밖으로 나간 만큼 **잘린다**. 3시 방향 노드의 오른쪽 끝은 x≈296(지도 300) 이라
   *   -6 이면 배지가 2pt 깎였다. 눈에 잘 안 띄는 종류의 깨짐이라 계산으로 막는다.
   */
  badge: {
    position: 'absolute', right: -2, bottom: -2, minWidth: 24, paddingHorizontal: 4, paddingVertical: 1,
    borderRadius: 9, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.juLine, alignItems: 'center',
  },
  badgeTx: { color: colors.ju, fontSize: fs(10), lineHeight: fs(14), fontWeight: '800' },
  dotSm: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: space(3) },
  dotTx: { color: '#fff', fontSize: fs(12), lineHeight: fs(16), fontWeight: '800' },   // '나무'(2글자) 대응
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
  rowTrait: { color: colors.ink, fontSize: fs(12), lineHeight: fs(19), marginTop: space(1) },
  traitBody: { color: colors.ink, fontSize: fs(14), lineHeight: fs(23), marginTop: space(2) },
  mapNote: { color: colors.inkSoft, fontSize: fs(12), lineHeight: fs(19), textAlign: 'center', marginTop: space(3) },
  chemi: { color: colors.ju, fontSize: fs(20), lineHeight: fs(26), fontWeight: '800', marginLeft: space(2) },

  // 넓은 웹 2열 — 왼쪽은 지도 폭(300)에 여백을 더한 고정, 오른쪽이 남는 폭을 먹는다
  two: { flexDirection: 'row', alignItems: 'flex-start', gap: space(6) },
  colL: { width: 396 },
  colR: { flex: 1, minWidth: 320 },

  detail: { marginTop: space(4) },
  roleImg: { width: '100%', height: 140, borderRadius: radius.sm, marginBottom: space(3) },
  term: { color: colors.inkFaint, fontSize: fs(11), lineHeight: fs(16) },
  image: { color: colors.ink, fontSize: fs(14), lineHeight: fs(22), fontWeight: '700', marginTop: space(1), marginBottom: space(2) },
  divider: { height: 1, backgroundColor: colors.juLine, marginVertical: space(4) },

  emptyCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(5), marginTop: space(5) },
  emptyTx: { color: colors.ink, fontSize: fs(14), lineHeight: fs(23) },
  cta: { marginTop: space(4), backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  ctaTx: { color: '#fff', fontSize: fs(15), lineHeight: fs(21), fontWeight: '800' },
  ctaGhost: { marginTop: space(4), borderWidth: 1, borderColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), alignItems: 'center' },
  ctaGhostTx: { color: colors.ju, fontSize: fs(14), lineHeight: fs(20), fontWeight: '700' },
});
