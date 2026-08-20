// app/src/components/talk/TalkList.tsx — 카톡형 친구목록
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-19: *"친구목록은 친구 프로필사진 이름 이렇게 되어있고 상단에는 내가 설정한 이름이"*
//
// ■ 한 줄에 **사진과 이름만** 둔다
//   종전엔 한 줄 소개와 역할(안내/상담)까지 적었다. 카톡 친구목록은 그러지 않는다 —
//   ★설명이 붙는 순간 '목록'이 아니라 '메뉴'가 된다. 무엇을 하는 사람인지는 들어가서 알면 된다.
//   ⚠️역할 표시를 뺀 대신, **가상인지 사람인지**는 대화 안에서 분명히 드러나야 한다(아래 TalkThread).
//
// ■ 상단 = 내 프로필
//   대표 명식의 이름(`label`)이다. 카톡에서 맨 위가 '나'인 것과 같은 자리.
//   ★없으면(명식 미등록·비로그인) 이름 대신 등록으로 데려간다 — 빈 자리를 두지 않는다.
//
// ■ 프로필 사진
//   ⚠️Boss 2026-08-19: *"이미지는 실사로 뽑을꺼야 추후에"* — 지금은 자리를 비워 두고
//   오행 색 + 이름 첫 글자로 버틴다. `avatar` 컬럼에 경로가 들어오면 그때부터 사진이 뜬다.
//   ★색은 id 로 **고정 배정**한다. 매번 달라지면 사람이 얼굴로 못 외운다.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../PressableScale';
import { colors, space, radius, font } from '../../lib/theme';
import { elementColor, elementText } from '../../lib/engine/ohaeng';
import type { Consultant } from '../../lib/talk/consultants';
import { loadFavorites, subscribeFavorites, splitByFavorite, toggleFavorite, isFavorite, isPinned } from '../../lib/talk/favorites';

const FALLBACK_EL = ['木', '火', '土', '金', '水'] as const;

/**
 * 목록 전체를 보고 **서로 겹치지 않는 한 글자**를 뽑는다.
 *
 * ★★왜 첫 글자를 그냥 쓰면 안 되나 (2026-08-19 실물에서 잡힘)
 *   「오늘의 운세」와 「오늘의 관계」가 둘 다 '오', 「나는 어떤 사람인가」와 「나의 성격유형」이
 *   둘 다 '나' 였다. **얼굴이 겹치면 카톡 친구목록에서 사람을 못 찾는다.**
 *   이 저장소는 같은 실패를 이미 겪었다 — 리스트 아이콘 폴백이 여섯 줄 중 다섯 줄에 같은 하트를 냈다.
 *   같은 폴백, 같은 결과다: **한 줄만 보면 멀쩡한데 여러 줄을 함께 보면 무너진다.**
 *
 * 어떻게 고르나: 어절의 첫 글자들을 후보로 두고, 아직 안 쓰인 것을 앞에서부터 집는다.
 *   「오늘의 관계」 → 후보 [오, 관] → '오'는 위에서 썼으니 '관'.
 *
 * @param names 목록에 보이는 이름들(순서대로)
 * @returns 같은 순서의 한 글자 배열
 */
export function initialsFor(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((n) => {
    const cands = n.split(/\s+/).filter(Boolean).map((w) => w[0]);
    // 어절 후보가 다 겹치면 이름의 남은 글자들까지 훑는다(그래도 없으면 첫 글자로 돌아간다)
    const all = [...cands, ...n.replace(/\s/g, '').split('')];
    const pick = all.find((ch) => ch && !used.has(ch)) ?? (n[0] ?? '·');
    used.add(pick);
    return pick;
  });
}

/**
 * 아바타 — 사진이 있으면 사진, 없으면 오행 색 + 한 글자.
 *
 * @param slot 목록 안 순번. ★해시가 아니라 **순번**으로 색을 돌린다 —
 *   해시는 우연히 몰린다(실물에서 열다섯 중 대부분이 청록·청흑 둘로 갔다).
 *   순번이면 다섯 색이 고르게 돈다. 사진이 들어오면 어차피 사라지는 임시 얼굴이다.
 */
function Avatar({ name, initial, slot, uri, size = 48 }: {
  name: string; initial?: string; slot: number; uri?: string | null; size?: number;
}) {
  const st = { width: size, height: size, borderRadius: size * 0.32 };
  // ⚠️`A()` 를 쓰지 않는다 — `consultants.fromRow` 가 **이미 공개 URL** 로 바꿔 놨다.
  //   여기서 또 감싸면 `assets/img/` 버킷을 가리켜 404 가 나고 조용히 안 뜬다.
  if (uri) return <ExpoImage source={{ uri }} style={st} contentFit="cover" transition={140} />;
  const el = FALLBACK_EL[slot % FALLBACK_EL.length];
  return (
    <View style={[st, { backgroundColor: elementColor[el], alignItems: 'center', justifyContent: 'center' }]}>
      {/* ★글자색은 `elementText` — **이미 있는 표**다. 흰 글자로 통일하면 金(#D2CCBA)에서 안 읽힌다. */}
      <Text style={{ color: elementText[el], fontWeight: '900', fontSize: size * 0.4 }}>{initial ?? name.slice(0, 1)}</Text>
    </View>
  );
}

/**
 * 친구 한 줄 — 즐겨찾기 칸과 일반 칸이 **같은 컴포넌트**를 쓴다.
 * ★두 벌로 만들면 한쪽만 고쳐져 같은 친구가 위아래에서 다르게 보인다.
 *
 * @param slot 얼굴색 자리(전체 목록 기준 — 즐겨찾기로 올라가도 얼굴이 안 바뀐다)
 */
function Row({ c, initial, slot, on, onOpen, t }: {
  c: Consultant; initial?: string; slot: number; on: boolean;
  onOpen: (c: Consultant) => void; t: (k: string, d?: string) => string;
}) {
  const pinned = isPinned(c.id);
  const faved = isFavorite(c.id);
  return (
    <PressableScale style={[styles.row, on && styles.rowOn]} onPress={() => onOpen(c)}>
      <Avatar name={c.name} initial={initial} slot={slot} uri={c.avatar} />
      <View style={styles.col}>
        <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
      </View>
      {/* 별 — ★고정된 친구는 **누를 수 없다**(실수로 빼고 "없어졌다"가 되면 우리 잘못이다).
          그래서 고정은 별을 흐리게 두고 hitSlop 도 주지 않는다. */}
      <PressableScale
        hitSlop={pinned ? 0 : 10}
        disabled={pinned}
        onPress={() => { if (!pinned) void toggleFavorite(c.id); }}
        accessibilityLabel={t(faved ? 'talk.unfav' : 'talk.fav', '즐겨찾기')}
      >
        <Text style={[styles.star, faved && styles.starOn, pinned && styles.starPinned]}>
          {faved ? '★' : '☆'}
        </Text>
      </PressableScale>
    </PressableScale>
  );
}

/**
 * 친구목록.
 *
 * @param items    상담사들(이미 정렬돼 있다)
 * @param onOpen   눌렀을 때 → 대화 상세
 * @param selected 웹 2칸에서 지금 열려 있는 대화(폰은 undefined)
 * @param myName   상단 내 프로필에 쓸 이름(대표 명식 `label`). 없으면 등록 안내
 * @param onMe     내 프로필을 눌렀을 때(명식 관리로)
 */
export function TalkList({ items, onOpen, selected, myName, onMe }: {
  items: Consultant[];
  onOpen: (c: Consultant) => void;
  selected?: string;
  myName?: string | null;
  onMe?: () => void;
}) {
  const { t } = useTranslation();
  // ★검색은 **온디바이스 필터**다(Boss 손그림 2026-08-20 상단 검색바).
  //   서버로 질의하지 않는다 — 목록이 열댓 개라 왕복할 이유가 없고, 원가도 0이다.
  const [q, setQ] = useState('');
  // 즐겨찾기 — 온디바이스. ★별을 누르면 **즉시** 다시 그린다(새로고침을 요구하지 않는다).
  const [favTick, setFavTick] = useState(0);
  useEffect(() => {
    void loadFavorites().then(() => setFavTick((n) => n + 1));
    return subscribeFavorites(() => setFavTick((n) => n + 1));
  }, []);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return k ? items.filter((c) => c.name.toLowerCase().includes(k)) : items;
  }, [items, q]);
  // ★글자는 **보이는 목록**이 아니라 전체 기준으로 뽑는다 —
  //   검색으로 걸러질 때마다 얼굴 글자가 바뀌면 같은 친구가 다른 사람처럼 보인다.
  const allInitials = useMemo(() => initialsFor(items.map((c) => c.name)), [items]);
  const initialOf = (id: string) => allInitials[items.findIndex((c) => c.id === id)];
  // ★얼굴색은 **전체 목록 위치**로 정한다 — 즐겨찾기로 올라가도 같은 얼굴이어야 한다
  const slotOf = (id: string) => items.findIndex((c) => c.id === id) + 1;
  // 즐겨찾기/나머지 — 검색 중이면 가르지 않는다(찾는 사람이 어디 있든 한 곳에 보여야 한다)
  const { fav, rest } = useMemo(
    () => (q.trim() ? { fav: [] as Consultant[], rest: shown } : splitByFavorite(shown)),
    [shown, q, favTick],
  );
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.body}>
      {/* ── 검색 ── */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={setQ}
          placeholder={t('talk.search', '친구 검색')}
          placeholderTextColor={colors.inkFaint}
          returnKeyType="search"
          // keyboard-safe: 목록 상단 검색창이라 키보드가 올라와도 가려지지 않는다
        />
      </View>

      {/* ── 나 ── */}
      <PressableScale style={styles.me} onPress={onMe} disabled={!onMe}>
        {/* 나 = 늘 첫 번째 색(slot 0). 내 얼굴이 목록 순서에 따라 바뀌면 이상하다 */}
        <Avatar name={myName ?? '나'} slot={0} size={56} />
        <View style={styles.col}>
          <Text style={styles.meName} numberOfLines={1}>
            {myName ?? t('talk.meNoChart', '명식을 등록하면 이름이 나와요')}
          </Text>
        </View>
      </PressableScale>

      {/* ── 즐겨찾기 ──────────────────────────────────────────────
          Boss 2026-08-20: 상단에 즐겨찾기 칸, 노쎔은 고정.
          ★검색 중에는 접는다 — 찾는 중에 고정 칸이 위를 먹으면 결과가 밀린다. */}
      {!q.trim() && fav.length > 0 && (
        <>
          <View style={styles.rule} />
          <Text style={styles.section}>{t('talk.favorites', '즐겨찾기')}</Text>
          {fav.map((c) => (
            <Row key={c.id} c={c} initial={initialOf(c.id)} slot={slotOf(c.id)}
                 on={selected === c.id} onOpen={onOpen} t={t as never} />
          ))}
        </>
      )}

      <View style={styles.rule} />
      {/* 친구 수 — ★검색 중이면 **걸러진 수**를 보여 준다(안 그러면 목록과 숫자가 어긋난다) */}
      <Text style={styles.section}>
        {t('talk.friendsCount', '친구 {{n}}명').replace('{{n}}', String(rest.length))}
      </Text>

      {/* ── 친구 ── */}
      {rest.map((c) => (
        <Row key={c.id} c={c} initial={initialOf(c.id)} slot={slotOf(c.id)}
             on={selected === c.id} onOpen={onOpen} t={t as never} />
      ))}
      {/* ★빈 결과를 말없이 두지 않는다 — 목록이 사라진 이유를 화면이 설명해야 한다 */}
      {q.trim() && !shown.length
        ? <Text style={styles.empty}>{t('talk.searchEmpty', '찾는 친구가 없어요.')}</Text>
        : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: space(4), paddingTop: space(4), paddingBottom: space(20) },

  me: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2) },
  meName: { fontSize: 17, lineHeight: 24, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: space(2),
    backgroundColor: colors.sunk, borderRadius: radius.pill,
    paddingHorizontal: space(3.5), marginBottom: space(3),
  },
  searchIcon: { fontSize: 17, color: colors.inkFaint },
  search: { flex: 1, paddingVertical: space(2.5), ...font.body, color: colors.ink },

  rule: { height: 1, backgroundColor: colors.line, marginVertical: space(3) },
  empty: { ...font.body, color: colors.inkFaint, textAlign: 'center', paddingVertical: space(8) },
  section: { ...font.caption, color: colors.inkFaint, fontWeight: '700', marginBottom: space(2) },

  // ★카드가 아니라 **줄**이다. 카톡 친구목록은 카드로 떠 있지 않다.
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2), borderRadius: radius.md, paddingHorizontal: space(1) },
  rowOn: { backgroundColor: colors.juSoft },
  col: { flex: 1, minWidth: 0 },
  name: { fontSize: 15.5, lineHeight: 21, fontWeight: '700', color: colors.ink },
  star: { fontSize: 17, color: colors.inkFaint, paddingHorizontal: space(1) },
  starOn: { color: colors.ju },
  // 고정 = 켜져 있지만 **누를 수 없다**는 것을 흐리기로 알린다(비활성 버튼의 관례)
  starPinned: { opacity: 0.45 },
});
