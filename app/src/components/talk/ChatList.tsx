// app/src/components/talk/ChatList.tsx — 대화 목록 (카톡의 「채팅」 탭 왼쪽 칸)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-20: *"웹은 친구목록이랑 채팅 탭이 같이 좌우로 공간을 나눠서 열리면 되고"*
//   ⇒ 대화 목록도 **친구목록과 같은 자리**(왼쪽 칸)에 들어간다.
//     그래서 화면이 아니라 **컴포넌트**여야 한다 — `TalkHome` 이 둘 중 하나를 왼쪽에 끼운다.
//
// ■ 무엇이 여기 뜨나
//   `talk_sessions` — **실제로 오간 대화만**. 친구목록에 열넷이 있어도 이야기한 적 없으면 안 뜬다.
//   ★홈 블록 친구(오늘의 운세 등)는 세션을 만들지 않으므로 자연히 빠진다 —
//     걸러내는 코드가 따로 필요 없다(대화가 아니라 화면이니까).
//
// ■ '없음'을 두 가지로 구분한다
//   ⚠️'로그인 안 됨'과 '대화 없음'은 **사용자가 할 일이 다르다.** 같은 빈 화면을 띄우면 안 된다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../../components/PressableScale';
import { supabase } from '../../lib/supabase';
import { withTimeout } from '../../lib/core/withTimeout';
import { useAuth } from '../../lib/useAuth';
import { consultantsSnapshot, listConsultants } from '../../lib/talk/consultants';
import { colors, space, radius, font } from '../../lib/theme';
import { elementColor, elementText } from '../../lib/engine/ohaeng';

const EL = ['木', '火', '土', '金', '水'] as const;

/** 목록 한 줄 — 세션 + 상담사 이름. */
type Row = {
  id: string; consultantId: string; name: string;
  /** 미리보기 = 마지막 메시지 한 줄(Boss 2026-08-20 "텍스트 미리보기로 간략하게") */
  preview: string | null;
  lastAt: string; turns: number;
  /** 안 읽은 상담사 메시지 수 — 0 이면 배지를 그리지 않는다 */
  unread: number;
};

/** 상대 시각 — "방금 · 3분 전 · 어제". ★날짜를 그대로 적으면 대화 목록이 표처럼 읽힌다. */
function ago(iso: string, t: (k: string, d?: string) => string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return t('chats.now', '방금');
  if (m < 60) return t('chats.minAgo', '{{n}}분 전').replace('{{n}}', String(m));
  const h = Math.floor(m / 60);
  if (h < 24) return t('chats.hourAgo', '{{n}}시간 전').replace('{{n}}', String(h));
  const d = Math.floor(h / 24);
  if (d === 1) return t('chats.yesterday', '어제');
  if (d < 7) return t('chats.dayAgo', '{{n}}일 전').replace('{{n}}', String(d));
  return new Date(iso).toLocaleDateString();
}

/**
 * 대화 목록.
 * @param onOpen     한 대화를 열었을 때(웹 2칸이면 오른쪽 칸에, 폰이면 대화 화면으로)
 * @param selectedId 지금 열려 있는 상담사 id(웹 2칸에서 줄을 강조)
 */
export function ChatList({ onOpen, selectedId, reloadKey = 0 }: {
  onOpen: (consultantId: string) => void; selectedId?: string;
  /** 답이 오거나 읽음 처리됐을 때 올려서 다시 읽게 한다(웹은 목록과 대화가 동시에 보인다) */
  reloadKey?: number;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);   // null = 아직 모름(로딩)

  const load = useCallback(async () => {
    if (!session) { setRows([]); return; }
    // 상담사 이름표가 필요하다 — 목록은 거의 안 바뀌므로 캐시를 먼저 쓰고, 없으면 한 번 읽는다
    let people = consultantsSnapshot();
    if (!people.length) people = await listConsultants();
    // ★뷰 하나로 **세션 + 안읽은수 + 미리보기**를 한 번에 받는다.
    //   세션마다 count 를 따로 물으면 대화 수만큼 왕복이 생긴다(N+1).
    const r = await withTimeout(
      supabase.from('talk_session_list')
        .select('id, consultant_id, preview, last_at, turn_count, unread')
        .order('last_at', { ascending: false }).limit(50),
      8000,
    );
    if (!r || r.error || !Array.isArray(r.data)) { setRows([]); return; }
    setRows(r.data.map((s: any) => ({
      id: s.id,
      consultantId: s.consultant_id,
      // ⚠️상담사가 사라졌어도 대화는 남는다 — 이름을 못 찾으면 빈 줄을 내지 말고 id 라도 보여 준다
      name: people.find((p) => p.id === s.consultant_id)?.name ?? s.consultant_id,
      preview: s.preview ?? null,
      lastAt: s.last_at,
      turns: s.turn_count ?? 0,
      unread: Number(s.unread ?? 0),
    })));
  }, [session]);

  useEffect(() => { void load(); }, [load, reloadKey]);
  // 대화하고 돌아오면 갱신 — 방금 나눈 이야기가 목록에 없으면 사라진 것처럼 보인다
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (rows === null) {
    return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.body}>
      <Text style={styles.head}>{t('nav.chats', '대화')}</Text>

      {!rows.length ? (
        <View style={styles.center}>
          {/* ★'로그인 안 됨'과 '대화 없음'을 다른 말로 — 사용자가 무엇을 해야 하는지가 다르다 */}
          <Text style={styles.emptyTx}>
            {session
              ? t('chats.empty', '아직 나눈 이야기가 없어요.\n연락처에서 친구를 눌러 보세요.')
              : t('chats.needLogin', '로그인하면 나눈 이야기가 여기 쌓여요.')}
          </Text>
          {!session && (
            <PressableScale style={styles.cta} onPress={() => router.push('/login')}>
              <Text style={styles.ctaTx}>{t('common.login', '로그인')}</Text>
            </PressableScale>
          )}
        </View>
      ) : rows.map((r, i) => {
        const el = EL[(i + 1) % EL.length];
        return (
          <PressableScale key={r.id} style={[styles.row, selectedId === r.consultantId && styles.rowOn]} onPress={() => onOpen(r.consultantId)}>
            <View style={[styles.av, { backgroundColor: elementColor[el] }]}>
              <Text style={{ color: elementText[el], fontWeight: '900', fontSize: 19 }}>{r.name.slice(0, 1)}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
              {/* 마지막에 물어본 것 — 무슨 얘기였는지가 이름보다 기억을 되살린다 */}
              {/* ★미리보기는 **한 줄**로 자른다 — 목록에서 본문을 읽게 하면 그건 목록이 아니다 */}
              <Text style={[styles.sub, r.unread > 0 && styles.subUnread]} numberOfLines={1}>
                {r.preview ?? t('chats.noTitle', '대화를 이어가 보세요')}
              </Text>
            </View>
            <View style={styles.meta}>
              <Text style={styles.time}>{ago(r.lastAt, t as never)}</Text>
              {/* 안 읽은 수 — ★0 이면 아예 그리지 않는다(0 배지는 정보가 아니라 잡음이다).
                  99 를 넘으면 '99+' — 정확한 수보다 '많다'가 더 쓸모 있다. */}
              {r.unread > 0
                ? <View style={styles.badge}><Text style={styles.badgeTx}>{r.unread > 99 ? '99+' : r.unread}</Text></View>
                : r.turns > 0 ? <Text style={styles.turns}>{t('chats.turns', '{{n}}턴').replace('{{n}}', String(r.turns))}</Text> : null}
            </View>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: space(4), paddingTop: space(4), paddingBottom: space(20) },
  head: { fontSize: 22, lineHeight: 30, fontWeight: '900', color: colors.ink, letterSpacing: -0.4, marginBottom: space(4) },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space(16), gap: space(4) },
  emptyTx: { ...font.body, color: colors.inkFaint, textAlign: 'center', lineHeight: 22 },
  cta: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(6), paddingVertical: space(3) },
  // ★강조색 위 글자는 `onJu`(`check:onaccent`)
  ctaTx: { ...font.label, color: colors.onJu, fontWeight: '900' },

  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2.5), paddingHorizontal: space(1), borderRadius: radius.md },
  rowOn: { backgroundColor: colors.juSoft },
  av: { width: 48, height: 48, borderRadius: radius.md * 1.1, alignItems: 'center', justifyContent: 'center' },
  col: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 15.5, lineHeight: 21, fontWeight: '700', color: colors.ink },
  sub: { ...font.caption, color: colors.inkFaint },
  meta: { alignItems: 'flex-end', gap: 3 },
  time: { ...font.caption, color: colors.inkFaint },
  turns: { ...font.caption, color: colors.inkFaint },
  // 안 읽음 배지 — 강조색 위 글자는 `onJu`(`check:onaccent`)
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.ju, alignItems: 'center', justifyContent: 'center' },
  badgeTx: { fontSize: 11.5, lineHeight: 15, fontWeight: '900', color: colors.onJu },
  // 안 읽은 대화는 미리보기를 진하게 — 목록을 훑을 때 눈이 먼저 간다
  subUnread: { color: colors.ink, fontWeight: '700' },
});
