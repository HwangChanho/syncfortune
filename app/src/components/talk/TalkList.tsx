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
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../PressableScale';
import { A } from '../../lib/ui/remoteAsset';
import { colors, space, radius, font } from '../../lib/theme';
import { elementColor } from '../../lib/engine/ohaeng';
import type { Consultant } from '../../lib/talk/consultants';

const FALLBACK_EL = ['木', '火', '土', '金', '水'] as const;
/** id → 오행 색(고정). 이름이 바뀌어도 얼굴색은 그대로다. */
function elemOf(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return FALLBACK_EL[h % FALLBACK_EL.length];
}

/** 아바타 — 사진이 있으면 사진, 없으면 오행 색 + 첫 글자. */
function Avatar({ id, name, uri, size = 48 }: { id: string; name: string; uri?: string | null; size?: number }) {
  const st = { width: size, height: size, borderRadius: size * 0.32 };
  if (uri) return <ExpoImage source={A(uri)} style={st} contentFit="cover" transition={140} />;
  return (
    <View style={[st, { backgroundColor: elementColor[elemOf(id)], alignItems: 'center', justifyContent: 'center' }]}>
      {/* ★흰 글자를 쓰지 않는다 — 오행 색 다섯 중 대비가 모자란 색이 있다(`check:onaccent` 와 같은 이유) */}
      <Text style={{ color: colors.onJu, fontWeight: '900', fontSize: size * 0.4 }}>{name.slice(0, 1)}</Text>
    </View>
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
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.body}>
      {/* ── 나 ── */}
      <PressableScale style={styles.me} onPress={onMe} disabled={!onMe}>
        <Avatar id="__me__" name={myName ?? '나'} size={56} />
        <View style={styles.col}>
          <Text style={styles.meName} numberOfLines={1}>
            {myName ?? t('talk.meNoChart', '명식을 등록하면 이름이 나와요')}
          </Text>
        </View>
      </PressableScale>

      <View style={styles.rule} />
      <Text style={styles.section}>{t('talk.friends', '친구')} {items.length}</Text>

      {/* ── 친구 ── */}
      {items.map((c) => (
        <PressableScale key={c.id} style={[styles.row, selected === c.id && styles.rowOn]} onPress={() => onOpen(c)}>
          <Avatar id={c.id} name={c.name} uri={c.avatar} />
          <View style={styles.col}>
            <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
          </View>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: space(4), paddingTop: space(4), paddingBottom: space(20) },

  me: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2) },
  meName: { fontSize: 17, lineHeight: 24, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },

  rule: { height: 1, backgroundColor: colors.line, marginVertical: space(3) },
  section: { ...font.caption, color: colors.inkFaint, fontWeight: '700', marginBottom: space(2) },

  // ★카드가 아니라 **줄**이다. 카톡 친구목록은 카드로 떠 있지 않다.
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2), borderRadius: radius.md, paddingHorizontal: space(1) },
  rowOn: { backgroundColor: colors.juSoft },
  col: { flex: 1, minWidth: 0 },
  name: { fontSize: 15.5, lineHeight: 21, fontWeight: '700', color: colors.ink },
});
