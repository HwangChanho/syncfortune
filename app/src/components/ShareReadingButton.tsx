// app/src/components/ShareReadingButton.tsx — 풀이 결과를 *이미지로 캡처해* 공유(daniel 2026-06-24)
// ─────────────────────────────────────────────────────────────────────────
// daniel 재설계: 링크 공유(상대가 앱 없으면 못 봄) → **풀이를 이미지로 캡처**해 공유.
//   상대는 이미지로 바로 풀이를 보고, 캡션의 스토어 링크로 앱 설치 유도(앱스토어/플레이스토어).
//   off-screen 카드(ShareCard)를 react-native-view-shot 으로 캡처 → Share 시트(이미지+캡션).
//   미생성/오류 풀이는 버튼 숨김.
// ─────────────────────────────────────────────────────────────────────────
import { useRef } from 'react';
import { Pressable, Text, View, StyleSheet, Share, Platform, type StyleProp, type ViewStyle } from 'react-native';
import ViewShot, { captureRef } from 'react-native-view-shot';
import { Alert } from '../lib/alert';
import { APP_STORE_URL } from '../lib/share';
import { colors, radius, space } from '../lib/theme';

export function ShareReadingButton({ kind, category, title, content, style }: {
  kind: string;
  category?: string;
  title?: string;
  content: any;
  style?: StyleProp<ViewStyle>;
}) {
  const shotRef = useRef<ViewShot>(null);
  // 풀이가 없거나 오류면 공유 버튼 미노출.
  if (!content || (typeof content === 'object' && (content as any).error)) return null;

  const headline = typeof content.headline === 'string' ? content.headline.trim() : '';
  // 본문 발췌 — headline 제외, 충분히 긴 문자열 값 1~2개를 이어 붙여 카드 미리보기(상대가 맛보게)
  const excerpt = Object.entries(content)
    .filter(([k, v]) => typeof v === 'string' && k !== 'headline' && k !== 'error' && (v as string).length > 20)
    .map(([, v]) => v as string)
    .slice(0, 2)
    .join('\n\n')
    .slice(0, 280);

  const onShare = async () => {
    try {
      // off-screen 카드 캡처 → 이미지 파일 uri
      const uri = await captureRef(shotRef, { format: 'jpg', quality: 0.95, result: 'tmpfile' });
      // 이미지 + 캡션(스토어 링크). iOS=url로 이미지 첨부.
      await Share.share({ url: uri, message: `${title ?? '내 운세 풀이'} — SyncFortune\n앱에서 내 운세 보기 ${APP_STORE_URL}` });
    } catch (e) {
      Alert.alert('!', (e as Error).message);
    }
  };

  return (
    <>
      <Pressable style={[styles.btn, style]} onPress={onShare}>
        <Text style={styles.tx}>🔗 이 풀이 이미지로 공유</Text>
      </Pressable>

      {/* 캡처용 카드 — 화면 밖(top:-10000)에 레이아웃만(보이지 않음). 상대가 받는 공유 이미지. */}
      <View style={styles.offscreen} pointerEvents="none">
        <ViewShot ref={shotRef} options={{ format: 'jpg', quality: 0.95 }}>
          <View style={styles.card}>
            <Text style={styles.brand}>✨ SyncFortune</Text>
            {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
            {headline ? <Text style={styles.cardHeadline}>{headline}</Text> : null}
            {excerpt ? <Text style={styles.cardBody}>{excerpt}…</Text> : null}
            <View style={styles.divider} />
            <Text style={styles.cta}>앱에서 내 운세 전체 보기</Text>
            <Text style={styles.url}>{APP_STORE_URL}</Text>
          </View>
        </ViewShot>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { alignSelf: 'center', borderColor: colors.ju, borderWidth: 1, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(5), marginTop: space(4), marginBottom: space(2) },
  tx: { color: colors.ju, fontWeight: '700', fontSize: 14 },
  offscreen: { position: 'absolute', top: -10000, left: 0 },
  // 공유 이미지 카드(세로) — 앱 톤(미드나잇+골드)
  card: { width: 720, backgroundColor: colors.bg, paddingVertical: 56, paddingHorizontal: 48, borderWidth: 3, borderColor: colors.ju },
  brand: { color: colors.ju, fontSize: 30, fontWeight: '900', marginBottom: 28, letterSpacing: 1 },
  cardTitle: { color: colors.ink, fontSize: 40, fontWeight: '900', marginBottom: 18, lineHeight: 50 },
  cardHeadline: { color: colors.ju, fontSize: 28, fontWeight: '800', marginBottom: 24, lineHeight: 40 },
  cardBody: { color: colors.inkSoft, fontSize: 26, lineHeight: 42 },
  divider: { height: 1, backgroundColor: colors.juLine, marginVertical: 36 },
  cta: { color: colors.ink, fontSize: 26, fontWeight: '700', marginBottom: 10 },
  url: { color: colors.inkFaint, fontSize: 20 },
});
