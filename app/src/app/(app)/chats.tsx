// app/src/app/(app)/chats.tsx — 대화 탭
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-20: *"웹은 친구목록이랑 채팅 탭이 같이 좌우로 공간을 나눠서 열리면 되고"*
//
// ★화면이 한 줄인 이유: 연락처 탭과 **같은 껍데기**(`TalkHome`)를 쓰고 왼쪽 칸만 갈아 끼운다.
//   대화창·입력바·2칸 배치를 여기서 다시 만들면 두 탭이 언젠가 다르게 동작한다
//   ([[duplicate-ui-single-source]]).
// ═══════════════════════════════════════════════════════════════════════════
// safe-area-safe: 상단 인셋은 `TalkHome` 이 직접 준다(이 파일은 껍데기 한 줄이라 여기서 또 주면 두 번 들어간다).
import { useTranslation } from 'react-i18next';
import { TalkHome } from './talk';
import { LoginGate } from '../../components/LoginGate';
import { useAuth } from '../../lib/useAuth';

export default function ChatsScreen() {
  const { t } = useTranslation();
  // ⚠️★익명 세션이 상시 존재하므로 `session` 이 아니라 `isRegistered` 로 본다(운광장과 같은 판정).
  const { isRegistered } = useAuth();
  /**
   * ★★대화 탭은 **로그인해야 들어온다** (Boss 2026-08-27 *"대화탭은 로그인 하기로 연결해야지"*).
   * ■ 왜 — 대화는 `talk_sessions` 에 **내 것으로** 쌓인다. 계정이 없으면 방을 만들 주인이 없고,
   *   기기를 바꾸면 그대로 사라진다. 운도 계정에 붙는다.
   * ■ ⚠️훅(`useTranslation`·`useAuth`) **아래**에 둔다 — 위에 두면 훅 개수가 갈려 화면이 죽는다.
   */
  if (!isRegistered) {
    return (
      <LoginGate
        title={t('chats.gateTitle', '대화는 로그인 후 이용할 수 있어요')}
        desc={t('chats.gateDesc', '나눈 이야기가 계정에 남아요. 기기를 바꿔도 이어서 볼 수 있어요.')}
      />
    );
  }
  return <TalkHome mode="chats" />;
}
