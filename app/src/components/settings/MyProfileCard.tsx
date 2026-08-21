// app/src/components/settings/MyProfileCard.tsx — 설정의 「내 프로필」
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-20: *"설정에서 이름이랑 사진도 변경 가능해야해"*
//   여기서 바꾼 이름·사진이 **친구목록 상단 "나"**에 그대로 나온다.
//
// ■ ⚠️사진은 지금 **웹에서만** 고를 수 있다
//   모바일 사진 선택엔 `expo-image-picker` 가 필요한데 이 앱엔 아직 없다.
//   넣으면 **네이티브 재빌드**가 걸린다 — 지금 다른 빌드가 도는 중이라 미뤘다.
//   ★없는 기능을 있는 척하지 않는다: 모바일에선 버튼 대신 **왜 못 하는지**를 적는다.
//     (회색 버튼만 두면 사용자는 자기 잘못인 줄 안다.)
//
// ■ 이름을 비우면 지운다
//   빈 값 = "정하지 않음" → 명식 이름으로 되돌아간다. 삭제 버튼을 따로 두지 않은 이유다.
// ═══════════════════════════════════════════════════════════════════════════
// keyboard-safe: 이 카드는 설정 화면 안에 들어간다. 부모 ScrollView 가
//   `automaticallyAdjustKeyboardInsets` 로 키보드를 피하므로 여기서 또 올리면 두 번 올라간다.
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Platform, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../PressableScale';
import { loadMyProfile, saveMyName, uploadMyAvatar, clearMyAvatar } from '../../lib/talk/myProfile';
import { colors, space, radius, font, activeElement } from '../../lib/theme';
import { elementColor, elementText } from '../../lib/engine/ohaeng';

/**
 * 내 프로필 편집.
 * @param fallbackName 이름을 안 정했을 때 보여 줄 값(대표 명식 이름)
 */
export function MyProfileCard({ fallbackName }: { fallbackName?: string | null }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<any>(null);

  useEffect(() => {
    void loadMyProfile().then((p) => { setName(p.name ?? ''); setAvatar(p.avatarUrl); });
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2400); };

  const onSaveName = async () => {
    setBusy(true);
    const r = await saveMyName(name);
    setBusy(false);
    // ★성공도 알린다 — 저장을 눌렀는데 아무 일도 안 일어나면 됐는지 알 수 없다
    flash(r.ok ? t('profile.saved', '저장했어요') : t('profile.saveFail', '저장하지 못했어요'));
  };

  const onPickWeb = () => fileRef.current?.click?.();
  const onFile = async (e: any) => {
    const f = e?.target?.files?.[0];
    if (!f) return;
    setBusy(true);
    const r = await uploadMyAvatar(f);
    setBusy(false);
    if (r.ok && r.url) { setAvatar(r.url); flash(t('profile.saved', '저장했어요')); }
    else flash(r.error === 'too_large'
      ? t('profile.tooLarge', '2MB 이하 사진만 올릴 수 있어요')
      : t('profile.saveFail', '저장하지 못했어요'));
    if (e.target) e.target.value = '';   // 같은 파일을 다시 골라도 이벤트가 오게
  };

  const onClear = async () => { setBusy(true); await clearMyAvatar(); setBusy(false); setAvatar(null); };

  const initial = (name.trim() || fallbackName || '나').slice(0, 1);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {avatar
          ? <ExpoImage source={{ uri: avatar }} style={styles.av} contentFit="cover" transition={140} />
          : <View style={[styles.av, styles.avFallback]}>
              <Text style={styles.avTx}>{initial}</Text>
            </View>}
        <View style={styles.col}>
          {Platform.OS === 'web' ? (
            <>
              <PressableScale style={styles.btn} onPress={onPickWeb} disabled={busy}>
                <Text style={styles.btnTx}>{t('profile.pick', '사진 바꾸기')}</Text>
              </PressableScale>
              {avatar ? (
                <PressableScale onPress={onClear} disabled={busy}>
                  <Text style={styles.link}>{t('profile.clear', '사진 지우기')}</Text>
                </PressableScale>
              ) : null}
            </>
          ) : (
            <Text style={styles.note}>
              {t('profile.mobileSoon', '사진 바꾸기는 다음 업데이트에서 열려요. 지금은 웹에서 바꿀 수 있어요.')}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.nameRow}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={fallbackName ?? t('profile.namePh', '이름')}
          placeholderTextColor={colors.inkFaint}
          maxLength={20}
          returnKeyType="done"
          onSubmitEditing={onSaveName}
        />
        <PressableScale style={styles.btn} onPress={onSaveName} disabled={busy}>
          {busy ? <ActivityIndicator size="small" color={colors.onJu} />
                : <Text style={styles.btnTx}>{t('common.save', '저장')}</Text>}
        </PressableScale>
      </View>
      <Text style={styles.hint}>{t('profile.hint', '비워 두면 명식 이름으로 표시돼요.')}</Text>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      {/* 숨긴 파일 입력 — 웹에서만 렌더된다(네이티브에는 DOM 이 없다) */}
      {Platform.OS === 'web' ? <WebFileInput inputRef={fileRef} onChange={onFile} /> : null}
    </View>
  );
}

/** 웹 전용 파일 입력. ★JSX 에 DOM 태그를 직접 쓰면 네이티브 타입체크가 깨져서 분리했다. */
function WebFileInput({ inputRef, onChange }: { inputRef: any; onChange: (e: any) => void }) {
  const El = 'input' as any;
  return <El ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
             style={{ display: 'none' }} onChange={onChange} />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), gap: space(3), marginTop: space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
  av: { width: 64, height: 64, borderRadius: radius.md * 1.2 },
  // ★대표 명식 오행 색 — 친구목록의 '나'와 **같은 값**을 쓴다(두 곳이 다르면 같은 나가 다른 얼굴이 된다)
  avFallback: { backgroundColor: elementColor[activeElement], alignItems: 'center', justifyContent: 'center' },
  // ★오행색 위 글자는 `elementText` — 흰색으로 통일하면 金(#D2CCBA)에서 안 읽힌다
  avTx: { color: elementText[activeElement], fontWeight: '900', fontSize: 24 },
  col: { flex: 1, gap: space(2), alignItems: 'flex-start' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  input: { flex: 1, backgroundColor: colors.sunk, borderRadius: radius.md, paddingHorizontal: space(3.5), paddingVertical: space(2.5), ...font.body, color: colors.ink },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingHorizontal: space(4), paddingVertical: space(2.5), minWidth: 72, alignItems: 'center' },
  // ★강조색 위 글자는 `onJu`(`check:onaccent`)
  btnTx: { ...font.label, color: colors.onJu, fontWeight: '800' },
  link: { ...font.caption, color: colors.inkFaint, textDecorationLine: 'underline' },
  note: { ...font.caption, color: colors.inkSoft, lineHeight: 18 },
  hint: { ...font.caption, color: colors.inkFaint },
  msg: { ...font.caption, color: colors.ju, fontWeight: '700' },
});
