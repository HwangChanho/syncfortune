// app/src/components/SignupNudge.tsx — 비로그인(익명) 사용자에게 계정 연결을 권하는 안내
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-27: "비로그인 상태에서도 컨텐츠 이용이 가능한데 회원가입 유도를 해야 해"
//
// ★막지 않는다 — 비로그인 이용은 **의도된 설계**다(ADR-037 로그인 게이트 없음 · 기획서 규칙5 무료=온디바이스).
//   Apple 5.1.1 상으로도 계정 등록은 선택이어야 한다. 그래서 게이트가 아니라 **안내**다.
//
// ★★문구는 '가입하면 좋아요' 같은 빈말이 아니라 **실제로 잃는 것**을 말한다(정직성):
//   구매한 이용권·풀이는 `owner_id`(= 지금의 익명 계정) 에 묶인다. 익명 세션은 이 기기의 저장소에만 있으므로
//   **앱을 지우거나 기기를 바꾸면 되찾을 방법이 없다.** 이건 마케팅 문구가 아니라 사용자 보호 정보다.
//   (그래서 문구도 겁주기가 아니라 사실 전달로 쓴다 — §4 부정 증폭 금지.)
//
// 노출 위치: `RelatedContent` 안(콘텐츠를 **다 본 직후** = 저장하고 싶어지는 순간).
//   콘텐츠 하단은 이미 34개 화면에 붙어 있으므로 부착 지점을 새로 만들지 않는다(중복 편집 0).
// 노출 빈도: 하루 1회. 매번 띄우면 광고로 읽혀 오히려 신뢰를 깎는다.
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from './PressableScale';
import { useAuth } from '../lib/useAuth';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, font } from '../lib/theme';

const SEEN_KEY = 'signup_nudge_day_v1';   // 마지막으로 보여 준 날짜(YYYY-MM-DD)

export function SignupNudge() {
  const { isRegistered } = useAuth();
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    if (isRegistered) { setShow(false); return; }
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const seen = await SecureStore.getItemAsync(SEEN_KEY);
        if (!alive) return;
        if (seen === today) return;              // 오늘 이미 봤다 → 조용히 넘어간다
        await SecureStore.setItemAsync(SEEN_KEY, today);
        if (alive) setShow(true);
      } catch {
        if (alive) setShow(true);                // 저장소 실패 시엔 그냥 보여 준다(안내가 사라지는 것보다 낫다)
      }
    })();
    return () => { alive = false; };
  }, [isRegistered]);

  if (isRegistered || !show) return null;

  return (
    <View style={styles.card}>
      <Text style={[styles.title, { fontSize: fs(14.5), lineHeight: 21 }]}>
        {t('signup.title', '지금 본 풀이, 이 기기에만 남아 있어요')}
      </Text>
      <Text style={[styles.body, { fontSize: fs(13), lineHeight: 20 }]}>
        {t('signup.body', '구매한 이용권과 풀이는 지금 쓰는 임시 계정에 묶여 있어요. 앱을 지우거나 기기를 바꾸면 되찾기 어려워요. 계정을 연결해 두면 그대로 이어서 볼 수 있어요.')}
      </Text>
      <PressableScale style={styles.cta} onPress={() => router.push('/login')}>
        <Text style={[styles.ctaTx, { fontSize: fs(14) }]}>{t('signup.cta', '계정 연결하기')}</Text>
      </PressableScale>
</View>
  );
}

const styles = StyleSheet.create({
  // 콘텐츠 하단 보조 카드 — 잠금·경고가 아니라 '알려 주는' 톤(테두리 강조 없이 은은한 틴트).
  card: {
    backgroundColor: colors.juSoft, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.juLine,
    padding: space(4.5), marginTop: space(4),
  },
  title: { ...font.body, color: colors.ink, fontWeight: '800' },
  body: { ...font.body, color: colors.inkSoft, marginTop: space(2) },
  cta: { marginTop: space(3.5), backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), alignItems: 'center' },
  ctaTx: { ...font.body, color: colors.card, fontWeight: '900' },
  // ★'안 해도 된다'를 분명히 — 게이트가 아님을 문구로도 지킨다(ADR-037·Apple 5.1.1).
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(2.5), textAlign: 'center' },
});
