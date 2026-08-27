/**
 * app/src/components/LoginGate.tsx — **로그인해야 들어오는 화면**의 안내 한 장
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-27 *"운광장은 로그인 해야 이용할수 있게 하자"* ·
 *   *"대화탭은 로그인 하기로 연결해야지"* · *"프로필 편집도 로그인해야 가능해"*
 *
 * ■ ★왜 컴포넌트인가
 *   잠글 자리가 **여럿**이다(운광장·대화·프로필…). 각자 그리면 문구·버튼·여백이 갈리고,
 *   «어디는 로그인 버튼이 있고 어디는 없는» 일이 생긴다([[duplicate-ui-single-source]]).
 *
 * ■ ★막기만 하지 않는다 — **가는 길**을 같이 준다
 *   «로그인이 필요합니다» 만 띄우고 길이 없으면 그건 막다른 골목이다.
 *
 * ■ ⚠️판정은 **부르는 쪽**이 한다
 *   이 앱은 **익명 세션이 상시 존재**해서 `session` 만으로는 «로그인했는가» 를 못 가른다.
 *   `useAuth().isRegistered` 로 봐야 한다 — 그 판정을 여기 숨기면 부르는 쪽이 헷갈린다.
 * ■ ⚠️호출부는 이 게이트를 **훅보다 아래**에 둬야 한다
 *   위에 두면 렌더마다 훅 개수가 달라져 화면이 통째로 죽는다(React #310 · `check:hooks`).
 */
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from './PressableScale';
import { colors, space, radius, font } from '../lib/theme';

/**
 * @param title 무엇이 잠겼는지 — 화면 이름을 넣는다(«운광장은…»)
 * @param desc  왜 잠겼는지 — 이유가 있으면 사람은 납득하고 로그인한다
 */
export function LoginGate({ title, desc }: { title: string; desc: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{desc}</Text>
      <PressableScale style={styles.cta} onPress={() => router.push('/login')}>
        <Text style={styles.ctaTx}>{t('community.goLogin', '로그인')}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space(6) },
  title: { ...font.title, color: colors.ink, fontWeight: '900', textAlign: 'center' },
  desc: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(3), lineHeight: 22 },
  cta: { marginTop: space(6), paddingVertical: space(3.5), paddingHorizontal: space(8), borderRadius: radius.pill, backgroundColor: colors.ju },
  ctaTx: { ...font.body, color: colors.onJu, fontWeight: '800' },
});
