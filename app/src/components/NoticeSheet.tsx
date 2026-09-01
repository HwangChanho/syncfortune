// app/src/components/NoticeSheet.tsx — 홈에서 뜨는 **공지**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-09-01: *"공지글은 홈화면에 가면 무조건 뜨게하고
//   하루동안 보지않기 체크하면 노출 안 되게해"*
//
// ■ ★★«무조건 뜬다» 를 **막지 않는 모양**으로 만든다
//   전면을 덮는 창은 «무조건» 을 확실히 지키지만, 링크로 들어온 사람이
//   **아무것도 못 보고 나간다.** ⇒ 홈 위에 뜨되 **닫을 수 있는 카드**다
//   (`AppInvite` 와 같은 판단 — 이 저장소가 이미 택한 결이다).
//
// ■ ★안전영역은 **스스로** 뺀다 — 화면을 덮는 것은 자유가 아니라 책임이다
//   (`check:safearea` S4 · 2026-09-01 PersonSheet 에서 시계와 겹쳤다).
//
// ■ ⚠️읽기가 실패해도 **홈은 그대로 뜬다** — 공지 때문에 홈이 막히면 안 된다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { PressableScale } from './PressableScale';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/core/withTimeout';
import { shouldHide, isLive, seenKey } from '../lib/content/noticeSeen';
import { colors, radius, space, font, shadow } from '../lib/theme';

type Notice = {
  id: string; title: string; body: string; kind: 'info' | 'maint' | 'event';
  active: boolean; starts_at: string | null; ends_at: string | null; revision: number;
};

/** 종류별 결 — 색은 테마에서만 가져온다(하드코딩 금지). */
const TONE: Record<Notice['kind'], { bg: string; line: string }> = {
  info:  { bg: colors.juSoft, line: colors.juLine },
  maint: { bg: colors.sunk,   line: colors.line },
  event: { bg: colors.juSoft, line: colors.ju },
};

/**
 * 「하루 동안 보지 않기」 저장 — ★이 저장소의 관례를 그대로 쓴다
 *   (웹 = `localStorage` · 앱 = `SecureStore`. `notifyInbox` 의 «본 시각» 과 같은 방식이다.)
 * ⚠️새 저장 계층을 만들지 않는다 — 같은 일을 하는 두 벌은 반드시 갈린다.
 */
async function readAt(k: string): Promise<number | null> {
  try {
    const v = Platform.OS === 'web'
      ? (globalThis as any).localStorage?.getItem(k)
      : await SecureStore.getItemAsync(k);
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}
async function writeAt(k: string, at: number): Promise<void> {
  try {
    if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(k, String(at));
    else await SecureStore.setItemAsync(k, String(at));
  } catch { /* 저장 실패 = 다음에 또 뜰 뿐, 기능은 안 깨진다 */ }
}

export function NoticeSheet() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [n, setN] = useState<Notice | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // ★가장 최근 것 하나만 — 여러 개를 쌓으면 홈이 공지판이 된다.
      const r = await withTimeout(
        supabase.from('notices')
          .select('id,title,body,kind,active,starts_at,ends_at,revision')
          .order('created_at', { ascending: false }).limit(1),
        6000,
      );
      if (!alive || !r || r.error || !Array.isArray(r.data) || !r.data.length) return;
      const it = r.data[0] as Notice;
      const now = Date.now();
      if (!isLive(it, now)) return;                       // 서버 정책 + 앱 2차 확인
      const savedAt = await readAt(seenKey(it.id, it.revision ?? 1));
      if (shouldHide(savedAt, now)) return;               // 「하루 동안 보지 않기」가 살아 있다
      if (alive) setN(it);
    })().catch(() => { /* 공지 때문에 홈이 막히지 않는다 */ });
    return () => { alive = false; };
  }, []);

  if (!n) return null;
  const tone = TONE[n.kind] ?? TONE.info;

  /** 하루 숨기기 — ★**누른 때**를 적는다(자정 기준이 아니다 · 버튼 글자가 약속이다). */
  const hideForDay = async () => {
    await writeAt(seenKey(n.id, n.revision ?? 1), Date.now());
    setN(null);
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + space(2), paddingBottom: insets.bottom + space(2) }]} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: tone.bg, borderColor: tone.line }]}>
        <Text style={styles.title} numberOfLines={2}>{n.title}</Text>
        <ScrollView style={styles.bodyBox} showsVerticalScrollIndicator={false}>
          <Text style={styles.body}>{n.body}</Text>
        </ScrollView>
        <View style={styles.row}>
          <PressableScale style={styles.ghost} onPress={hideForDay} hitSlop={8}>
            <Text style={styles.ghostTx}>{t('notice.hideDay', '하루 동안 보지 않기')}</Text>
          </PressableScale>
          <PressableScale style={styles.close} onPress={() => setN(null)} hitSlop={8}>
            <Text style={styles.closeTx}>{t('common.close', '닫기')}</Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ★위에서 내려오는 띠 — 전면을 덮지 않는다(덮으면 링크로 들어온 사람이 아무것도 못 본다)
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60, paddingHorizontal: space(4) },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space(4), gap: space(2), ...shadow.card },
  title: { ...font.heading, color: colors.ink, fontWeight: '800' },
  bodyBox: { maxHeight: 160 },
  body: { ...font.body, color: colors.inkSoft, lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space(1) },
  ghost: { paddingVertical: space(2), paddingHorizontal: space(1) },
  ghostTx: { ...font.caption, color: colors.inkFaint, fontWeight: '700' },
  close: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(2), paddingHorizontal: space(5) },
  closeTx: { ...font.caption, color: colors.onJu, fontWeight: '800' },
});
