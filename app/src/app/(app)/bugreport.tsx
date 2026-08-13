// app/src/app/(app)/bugreport.tsx — 앱 안에서 바로 보내는 버그 제보
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-13: *"버그 제보 기능 넣을껀데 서버 디비로 보내게 하고 주기적으로 검사해서 고칠꺼야.
//   보내고나면 얼럿으로 제보해주셔서 감사합니다로 표시하고 빠른수일내에 수정된다고"*
//
// ■ 왜 바꿨나
//   기존 설정 → '버그 제보 · 문의' 는 **`mailto:` 로 메일 앱을 열었다**(2026-07-08).
//   메일 앱이 없거나 계정이 없는 기기에서는 그대로 막히고, 받은 제보도 편지함에 흩어졌다.
//   ⇒ 앱에서 바로 써서 **DB(`bug_reports`)로 보낸다.** 관리자 콘솔에서 한자리에 모아 본다.
//
// ■ 설계 판단
//   · **로그인 없이도 보낼 수 있다** — 로그인이 안 되는 버그야말로 제보가 절실하다(RLS 도 그렇게 열어 뒀다).
//   · 진단 정보(앱 버전·빌드·플랫폼·OS·기기)는 **앱이 자동으로 붙인다.** 사용자에게 묻지 않는다.
//   · 연락처는 **선택** — 답장을 원할 때만. 강제하면 제보가 줄어든다.
//   · 전송 버튼은 **한 번만** 먹는다(연타 = 중복 제보 = 관리 부담).
//
// ⚠️네트워크에는 반드시 타임아웃을 건다 — supabase/fetch 는 **기본 타임아웃이 없다**
//   (2026-08-01 '무한대기 15곳' 사고). 여기서 멎으면 사용자는 제보도 못 하고 화면에 갇힌다.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';
import { withTimeout } from '../../lib/core/withTimeout';
import { logEvent } from '../../lib/backend/logger';
import { APP_BUILD } from '../../lib/core/buildInfo';
import { Alert } from '../../lib/ui/alert';
import { PressableScale } from '../../components/PressableScale';
import { colors, radius, space } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';

// 전송이 끝내 실패했을 때의 폴백 창구. ★주소는 앱 안에서 **여기 한 곳에만** 둔다
//   (settings 에도 있던 것을 옮겼다 — 두 곳에 두면 한쪽만 바뀐다 [[duplicate-ui-single-source]]).
const SUPPORT_EMAIL = 'cksgh0316@gmail.com';

const MIN_LEN = 5;          // DB check 제약과 같은 값 — 서버에서 거절당하기 전에 앱에서 먼저 막는다
const MAX_LEN = 4000;
const SEND_TIMEOUT_MS = 15_000;

export default function BugReportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ from?: string }>();
  const { fs } = useFontScale();
  const styles = mkStyles(fs);

  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);

  const body = message.trim();
  const canSend = body.length >= MIN_LEN && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    try {
      // 로그인했으면 user_id 를 함께 — 안 했으면 null(비로그인 제보 허용)
      const { data: { session } } = await supabase.auth.getSession();
      const res = await withTimeout(
        supabase.from('bug_reports').insert({
          user_id: session?.user?.id ?? null,
          message: body.slice(0, MAX_LEN),
          contact: contact.trim() || null,
          app_version: String(Constants.expoConfig?.version ?? '1.0.0'),
          build_no: APP_BUILD,
          platform: Platform.OS,
          os_version: String(Platform.Version ?? ''),
          device: Constants.deviceName ?? null,   // expo-device 미설치 — Constants 로 충분하다
          route: params.from ?? null,          // 어느 화면에서 눌렀는지(재현에 큰 도움)
        }),
        SEND_TIMEOUT_MS,
      );

      if (!res || res.error) {
        logEvent('bug_report_fail', { message: res?.error?.message ?? 'timeout' }, 'error');
        Alert.alert(
          t('bug.failTitle', '보내지 못했어요'),
          `${t('bug.failBody', '잠시 후 다시 시도해 주세요. 계속 안 되면 아래 주소로 보내 주셔도 됩니다.')}\n${SUPPORT_EMAIL}`,
        );
        return;
      }

      logEvent('bug_report_sent', { len: body.length });
      // ★daniel 지정 문구 — 감사 + "빠른 수일 내 수정"
      Alert.alert(
        t('bug.doneTitle', '제보해 주셔서 감사합니다'),
        t('bug.doneBody', '보내주신 내용은 개발자가 직접 확인하고 있어요. 빠른 수일 내에 수정하겠습니다.'),
        [{ text: t('common.confirm', '확인'), onPress: () => router.back() }],
      );
    } catch (e) {
      logEvent('bug_report_throw', { message: (e as Error).message }, 'error');
      Alert.alert(t('bug.failTitle', '보내지 못했어요'), `${t('bug.failBody', '잠시 후 다시 시도해 주세요. 계속 안 되면 아래 주소로 보내 주셔도 됩니다.')}\n${SUPPORT_EMAIL}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={[styles.scrollPad, { paddingBottom: insets.bottom + space(44) }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('bug.title', '버그 제보')}</Text>
        <Text style={styles.desc}>
          {t('bug.desc', '불편했던 점이나 이상하게 동작한 부분을 알려 주세요. 어떤 화면에서 무엇을 했을 때 그랬는지 적어 주시면 훨씬 빨리 고칠 수 있어요.')}
        </Text>

        <Text style={styles.label}>{t('bug.what', '무슨 일이 있었나요?')}</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={message}
          onChangeText={setMessage}
          placeholder={t('bug.placeholder', '예) 궁합 풀이를 눌렀는데 화면이 계속 돌기만 해요')}
          placeholderTextColor={colors.inkSoft}
          multiline
          textAlignVertical="top"
          maxLength={MAX_LEN}
          editable={!sending}
        />
        <Text style={styles.count}>{body.length} / {MAX_LEN}</Text>

        <Text style={styles.label}>{t('bug.contact', '답장 받을 곳 (선택)')}</Text>
        <TextInput
          style={styles.input}
          value={contact}
          onChangeText={setContact}
          placeholder={t('bug.contactHint', '이메일 등 — 비워 두셔도 됩니다')}
          placeholderTextColor={colors.inkSoft}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!sending}
        />

        {/* 무엇이 함께 전송되는지 숨기지 않는다 — 진단 정보라도 사용자가 알고 보내야 한다 */}
        <Text style={styles.meta}>
          {t('bug.autoInfo', '앱 버전·기기 종류가 함께 전송돼요(문제를 찾는 데만 씁니다).')}
        </Text>

        <PressableScale
          style={[styles.btn, !canSend && styles.btnOff]}
          onPress={send}
          disabled={!canSend}
        >
          {sending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnTx}>{t('bug.send', '보내기')}</Text>}
        </PressableScale>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const mkStyles = (fs: (n: number) => number) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  // ★하단 여백 176pt(=space(44)) — 마지막이 '보내기' 버튼이라 부족하면 **버튼이 배너 뒤로 사라져 기능이 죽는다.**
  //   시뮬 실측: 48 이면 안 보이고 176 이면 온전히 보인다(check:bottominset 이 이 값을 강제한다).
  //   처음엔 space(10) 으로 써서 preflight 에 걸렸다 — 하네스가 맞았다.
  scrollPad: { padding: space(5), paddingBottom: space(44) },
  title: { color: colors.ink, fontSize: fs(22), lineHeight: fs(30), fontWeight: '800' },
  desc: { color: colors.inkSoft, fontSize: fs(14), lineHeight: fs(22), marginTop: space(2) },
  label: { color: colors.ink, fontSize: fs(14), lineHeight: fs(20), fontWeight: '700', marginTop: space(6), marginBottom: space(2) },
  input: {
    backgroundColor: colors.card, color: colors.ink, borderRadius: radius.md,
    paddingHorizontal: space(4), paddingVertical: space(3),
    fontSize: fs(15), lineHeight: fs(22), borderWidth: 1, borderColor: colors.juLine,
  },
  inputMulti: { minHeight: 150 },
  count: { color: colors.inkSoft, fontSize: fs(12), lineHeight: fs(18), textAlign: 'right', marginTop: space(1) },
  meta: { color: colors.inkSoft, fontSize: fs(12), lineHeight: fs(18), marginTop: space(4) },
  btn: {
    marginTop: space(6), backgroundColor: colors.ju, borderRadius: radius.md,
    paddingVertical: space(4), alignItems: 'center', justifyContent: 'center', minHeight: 52,
  },
  btnOff: { opacity: 0.4 },
  btnTx: { color: '#fff', fontSize: fs(16), lineHeight: fs(22), fontWeight: '800' },
});
