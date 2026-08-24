// app/src/components/talk/ConsultantLinkCard.tsx — 상담가 **본인 채널** 카드
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-25 *"노쎔대화는 노쎔 유튜브 링크도 자연스럽게 노출되게 하자"*
//   목적(Boss 원문): *"우리가 강조하고 싶은건 **실제 상담가가 만드는 서비스로 신뢰도를 올리는거야**"*
//
// ■ ★그래서 「광고 카드」가 아니라 **「이 사람이 실재한다」는 증거**로 만든다
//   문구가 *"채널 구경하세요"* 면 광고고, *"직접 상담하는 분이에요"* 면 신뢰 신호다.
//   ⇒ 링크보다 **사람**을 먼저 말한다.
//
// ■ ⚠️매 턴 띄우지 않는다
//   방을 **처음 여는 인사 뒤에 한 번만** 붙는다(호출부에서 그렇게 쓴다).
//   대화마다 뜨면 그 순간 광고가 되고, 신뢰 신호는 반대로 깎인다.
//
// ■ ⚠️중첩 <Text> 금지 — 웹에서 백지가 된다([[web-nested-text-crash]]).
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet, Linking, Platform } from 'react-native';
import { PressableScale } from '../PressableScale';
import { colors, radius, space, font } from '../../lib/theme';

/**
 * 상담가 채널 카드.
 *
 * @param name  상담가 이름
 * @param url   채널 주소(없으면 아무것도 그리지 않는다)
 * @param label 버튼에 적을 말(예: `노쌤 유튜브`)
 */
export function ConsultantLinkCard({ name, url, label }: { name: string; url?: string | null; label?: string | null }) {
  if (!url) return null;
  const open = () => {
    // ⚠️웹은 새 탭으로 — 같은 탭에서 열면 사용자가 대화방을 잃는다
    if (Platform.OS === 'web') { window.open(url, '_blank', 'noopener,noreferrer'); return; }
    void Linking.openURL(url).catch(() => { /* 열 수 없으면 조용히 — 대화를 막지 않는다 */ });
  };
  return (
    <View style={styles.card}>
      {/* ★사람을 먼저 말한다 — 링크가 주인공이 아니다 */}
      <Text style={styles.lead}>{name} 님은 실제로 상담을 하는 분이에요.</Text>
      <Text style={styles.sub}>여기 답도 그분의 관법을 따라 만들어져요.</Text>
      <PressableScale style={styles.btn} onPress={open}>
        <Text style={styles.btnTx}>{label ?? '채널 보기'} ›</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.juSoft, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.juLine, padding: space(3.5),
  },
  lead: { ...font.body, color: colors.ink, fontWeight: '800', fontSize: 13.5, lineHeight: 20 },
  sub: { ...font.caption, color: colors.inkSoft, marginTop: 2, fontSize: 12, lineHeight: 18 },
  btn: {
    alignSelf: 'flex-start', marginTop: space(2.5),
    backgroundColor: colors.ju, borderRadius: radius.pill,
    paddingHorizontal: space(3.5), paddingVertical: space(1.75),
  },
  btnTx: { color: colors.onJu, fontWeight: '800', fontSize: 12.5, lineHeight: 17 },
});
