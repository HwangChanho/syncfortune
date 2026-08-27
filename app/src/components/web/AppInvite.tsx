/**
 * app/src/components/web/AppInvite.tsx — **모바일 브라우저**로 왔을 때 앱을 권한다
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-27 *"웹에서 앱도 접근 가능하게 하자. 모바일에서 브라우저로 이걸 보고있을수도
 *   있으니깐 기본적으로 실행 디바이스가 모바일이면 앱으로 유도하는 화면을 기존 화면 위에 띄우자"*
 *
 * ■ ★막지 않는다 — **권하기만** 한다
 *   전면을 덮고 «앱을 받으세요» 만 남기면, 링크를 눌러 들어온 사람이 **아무것도 못 보고 나간다.**
 *   ⇒ 아래에서 올라오는 띠 하나. 닫으면 그 자리에서 바로 웹을 쓴다.
 * ■ ⚠️한 번 닫으면 **다시 안 띄운다**(그 브라우저에서)
 *   새로고침마다 뜨면 그건 권유가 아니라 방해다. `localStorage` 에 남긴다.
 *   ⚠️접근만으로 던지는 환경이 있어 읽기·쓰기 모두 try 로 감싼다.
 * ■ ⚠️**웹에서만** 그린다 — 앱 안에서 «앱을 받으세요» 는 말이 안 된다.
 *   판정은 부르는 쪽(`_layout`)이 아니라 여기서 한 번에 한다(조건이 두 곳이면 갈린다).
 */
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../PressableScale';
import { colors, space, radius, font, shadow } from '../../lib/theme';

const HIDE_KEY = 'ui.appInviteHidden';
const APP_STORE = 'https://apps.apple.com/app/id6779321930';
const PLAY = 'https://play.google.com/store/apps/details?id=com.syncfortune.app';
/** 앱이 깔려 있으면 이 스킴이 열린다 — 안 깔려 있으면 아무 일도 안 나므로 스토어로 이어서 보낸다. */
const DEEP_LINK = 'syncfortune://';

/** 이 브라우저가 **폰·태블릿**인가. ⚠️화면 크기가 아니라 **기기**로 본다(창을 줄인 데스크톱은 아니다). */
function isMobileBrowser(): 'ios' | 'android' | null {
  if (Platform.OS !== 'web') return null;
  try {
    const ua = String(globalThis.navigator?.userAgent ?? '');
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    // ★iPadOS 13+ 는 UA 가 Mac 이다 — 터치 지원으로 가른다
    if (/Macintosh/i.test(ua) && (globalThis.navigator as any)?.maxTouchPoints > 1) return 'ios';
    return null;
  } catch { return null; }
}

export function AppInvite() {
  const { t } = useTranslation();
  const [os, setOs] = useState<'ios' | 'android' | null>(null);

  useEffect(() => {
    const kind = isMobileBrowser();
    if (!kind) return;
    try { if (globalThis.localStorage?.getItem(HIDE_KEY) === '1') return; } catch { /* 못 읽으면 띄운다 */ }
    setOs(kind);
  }, []);

  if (!os) return null;

  const close = () => {
    setOs(null);
    try { globalThis.localStorage?.setItem(HIDE_KEY, '1'); } catch { /* 저장 못 해도 이번엔 닫힌다 */ }
  };
  const open = () => {
    const store = os === 'ios' ? APP_STORE : PLAY;
    // ★깔려 있으면 앱이 열리고, 아니면 스토어로. 딥링크는 «실패» 를 알려 주지 않으므로 **시간으로** 가른다.
    try { globalThis.location.href = DEEP_LINK; } catch { /* 무시 */ }
    setTimeout(() => { void Linking.openURL(store); }, 900);
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>{t('appInvite.title', '앱에서 더 편하게')}</Text>
          <Text style={styles.sub} numberOfLines={2}>
            {t('appInvite.sub', '알림·오늘의 운세는 앱에서 바로 받아볼 수 있어요.')}
          </Text>
        </View>
        <PressableScale style={styles.cta} onPress={open}>
          <Text style={styles.ctaTx}>{t('appInvite.open', '앱으로')}</Text>
        </PressableScale>
        {/* ★닫는 길 — 이게 없으면 권유가 아니라 벽이다 */}
        <PressableScale style={styles.x} onPress={close} hitSlop={10} accessibilityLabel={t('common.close', '닫기')}>
          <Text style={styles.xTx}>✕</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ★아래에서 올라오는 띠 — 화면을 덮지 않는다(`box-none` 이라 바깥은 그대로 눌린다)
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space(3), zIndex: 80 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine,
    paddingVertical: space(3), paddingHorizontal: space(4), ...shadow.soft,
  },
  // ⚠️`minWidth: 0` 이 있어야 긴 문구가 «…» 로 줄어든다(없으면 버튼을 밀어낸다)
  textCol: { flex: 1, minWidth: 0 },
  title: { ...font.body, color: colors.ink, fontWeight: '800' },
  sub: { ...font.caption, color: colors.inkSoft, marginTop: 2, lineHeight: 16 },
  cta: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingVertical: space(2), paddingHorizontal: space(4) },
  ctaTx: { ...font.caption, color: colors.onJu, fontWeight: '800' },
  x: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  xTx: { fontSize: 14, color: colors.inkFaint, fontWeight: '800' },
});
