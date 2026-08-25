// app/src/components/talk/CoinNotice.tsx — 대화창 **상단 운 안내 띠**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-25 *"운 관련 안내 예를들어 무료다 썻다 이런거는 다른 말풍선이나
//   채팅방 상단에 팝업 식으로 다른 색상으로 나와서 유저가 인지하기 편하게 알려줘야지"*.
//
// ■ 왜 말풍선이면 안 되나
//   종전엔 「오늘 무료 대화를 다 쓰셨어요」가 **상담가의 말풍선**으로 나왔다.
//   그러면 과금 안내가 상담 내용처럼 읽힌다 — 사람이 한 말과 시스템이 한 말이 섞인다.
//   ⇒ **자리(상단 고정)와 색(꽉 찬 색면)** 을 둘 다 달리해서 «이건 앱이 하는 말» 로 보이게 한다.
//
// ■ 색을 어떻게 골랐나 — ★실측(2026-08-25)
//   처음엔 연한 바탕 + 진한 글자로 잡았는데 **흰 말풍선과 대비가 1.15** 라 안 튀었다.
//   ⇒ 꽉 찬 색면 + 흰 글자로 바꿨다(대비 6.75 / 5.18). 「인지하기 편하게」가 요구였으므로
//     은은한 것보다 **분명한 것**이 맞다.
//   ★카멜(주조색)과 떨어뜨렸다 — 주조색을 쓰면 «평범한 버튼» 으로 읽혀 눈에 안 걸린다.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from '../PressableScale';
import { space, radius, font } from '../../lib/theme';

/** 안내의 성격. `need` 만 사용자가 **할 일**이 있다(충전). */
export type CoinNoticeKind = 'info' | 'need';

/** 성격별 색 — 바탕은 꽉 채우고 글자는 흰색. */
const TONE: Record<CoinNoticeKind, { bg: string }> = {
  info: { bg: '#2C5F8A' },   // 청 — 알려만 준다(무료 소진·차감)
  need: { bg: '#C0451A' },   // 주홍 — 할 일이 있다(운 부족). ★카멜과 떨어뜨렸다
};

/**
 * 대화창 상단 안내 띠.
 *
 * @param kind    info(알림) · need(충전 필요)
 * @param text    본문 한 줄
 * @param action  오른쪽 글자 버튼(없으면 안 그린다)
 * @param onAction 그 버튼을 눌렀을 때
 * @param onClose  닫기(✕). 없으면 닫기 버튼을 안 그린다
 */
export function CoinNotice({ kind, text, action, onAction, onClose }: {
  kind: CoinNoticeKind; text: string;
  action?: string; onAction?: () => void; onClose?: () => void;
}) {
  const tone = TONE[kind] ?? TONE.info;
  return (
    <View style={[styles.wrap, { backgroundColor: tone.bg }]}>
      <Text style={styles.tx} numberOfLines={2}>{text}</Text>
      {action && onAction ? (
        <PressableScale onPress={onAction} hitSlop={8}><Text style={styles.action}>{action} ›</Text></PressableScale>
      ) : null}
      {onClose ? (
        // ★닫기를 둔다 — 안 사라지는 띠는 «고장» 으로 읽힌다. 정보성이라 지워도 손해가 없다
        <PressableScale onPress={onClose} hitSlop={10}><Text style={styles.close}>✕</Text></PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // ★대화 목록 **위**에 고정으로 얹힌다(스크롤과 같이 안 올라간다) — 자리로도 «시스템» 임을 말한다
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: space(2),
    paddingVertical: space(2.5), paddingHorizontal: space(4),
    borderRadius: radius.md, marginHorizontal: space(3), marginTop: space(2),
  },
  tx: { ...font.caption, color: '#FFFFFF', fontWeight: '700', flex: 1, lineHeight: 18 },
  action: { ...font.caption, color: '#FFFFFF', fontWeight: '900', textDecorationLine: 'underline' },
  close: { color: '#FFFFFF', fontSize: 15, lineHeight: 18, fontWeight: '800', opacity: 0.85 },
});
