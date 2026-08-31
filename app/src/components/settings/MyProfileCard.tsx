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
import { loadMyProfile, saveMyName, uploadMyAvatar, clearMyAvatar, uploadMyCover, clearMyCover } from '../../lib/talk/myProfile';
// ★폰 사진 고르기(Boss 2026-08-28 *"ios는 왜 사진 바꾸기가 안되지"*) — 웹은 종전 <input type=file> 그대로
import { pickImageUri, bytesOfUri, canPickImage } from '../../lib/media/pickImage';
import { requestCrop } from '../../lib/media/cropRequest';
// ★사진 한 장 크게 — 대화창이 쓰는 것과 **같은 창**을 쓴다(따로 만들면 동작이 갈린다)
import { PhotoViewer } from '../talk/PhotoViewer';
import { originalImage } from '../../lib/media/imageUrl';
import { colors, space, radius, font, activeElement } from '../../lib/theme';
import { elementColor, elementText } from '../../lib/engine/ohaeng';

/**
 * 내 프로필 편집.
 * @param fallbackName 이름을 안 정했을 때 보여 줄 값(대표 명식 이름)
 * @param element      아바타 자리 색의 기준 오행. ★**대표 명식**의 일간 오행을 받는다.
 *   ⚠️Boss 2026-08-25 *"설정에 내 프로필은 대표명식 기준으로 돼야지 설정명식 말고"*.
 *     종전엔 `activeElement`(=**마지막으로 고른 명식**의 색 · 테마용)를 썼다. 그건 다른 사람의
 *     명식을 잠깐 열어 보기만 해도 바뀌는 값이라, 「내 프로필」이 남의 색을 입고 있었다.
 *     안 주면 종전대로 테마 색으로 떨어진다(명식이 아직 없을 때).
 */
export function MyProfileCard({ fallbackName, element }: { fallbackName?: string | null; element?: string | null }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  // ★배경 사진(카카오톡식 프로필 창의 윗면) — Boss 2026-08-26 «유저도 등록 가능하게»
  const [cover, setCover] = useState<string | null>(null);
  const coverRef = useRef<any>(null);
  const [busy, setBusy] = useState(false);
  /**
   * ★★눌러서 **크게 보기**(Boss 2026-08-30 *"배경이미지 프로필 이미지 클릭하면 확대해서 볼수 있게"*).
   * ⚠️화면에 그리는 건 **줄인 것**이라(아바타 240·배경 920) 크게 띄울 때는 `originalImage` 로 되돌린다 —
   *   줄인 걸 전체 화면에 띄우면 뭉갠다.
   */
  const [zoom, setZoom] = useState<{ uri: string; cap: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<any>(null);

  useEffect(() => {
    void loadMyProfile().then((p) => {
      setName(p.name ?? ''); setAvatar(p.avatarUrl); setCover(p.coverUrl);
      savedRef.current = p.name ?? '';
      loadedRef.current = true;      // ★여기서부터가 «사용자가 고친 것»이다
    });
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2400); };

  const onSaveName = async () => {
    setBusy(true);
    const r = await saveMyName(name);
    setBusy(false);
    // ★성공도 알린다 — 바뀐 게 저장됐는지 사용자가 알 방법이 이것뿐이다
    flash(r.ok ? t('profile.saved', '저장했어요') : t('profile.saveFail', '저장하지 못했어요'));
  };

  /**
   * ★★이름 **자동 저장** (Boss 2026-08-29 *"저장 따로 안눌러도 … 자동 저장되게 해줘"*).
   *
   * ■ 실측: 사진·배경은 **이미 자동**이었다(고르는 즉시 업로드). 「저장」이 걸려 있던 건 **이름 하나**뿐이라,
   *   그 버튼을 없애면 이 카드에서 «저장을 누르는 일» 자체가 사라진다.
   * ■ ⚠️타이핑마다 저장하지 않는다 — 글자 수만큼 쓰기가 나간다. **멈춘 뒤 800ms** 에 한 번.
   * ■ ⚠️**처음 불러온 값으로는 저장하지 않는다**(`loadedRef`). 안 그러면 화면을 열기만 해도
   *   쓰기가 한 번 나가고, 서버 값과 같은 값을 덮어쓴다.
   * ■ ⚠️저장 중에는 미룬다 — 겹쳐 보내면 마지막 것이 이길 보장이 없다.
   */
  const loadedRef = useRef(false);
  const savedRef = useRef<string | null>(null);   // 마지막으로 저장에 성공한 값
  useEffect(() => {
    if (!loadedRef.current) return;               // 최초 로드분은 건너뛴다
    if (name === savedRef.current) return;        // 바뀐 게 없다
    const id = setTimeout(async () => {
      const v = name;
      const r = await saveMyName(v);
      if (r.ok) { savedRef.current = v; flash(t('profile.saved', '저장했어요')); }
      else flash(t('profile.saveFail', '저장하지 못했어요'));
    }, 800);
    return () => clearTimeout(id);
  }, [name, t]);

  const onPickWeb = () => fileRef.current?.click?.();
  /**
   * ── 사진 자르기 ─────────────────────────────────────────────────────────
   * Boss 2026-08-31 *"너무 확대돼서 나와 … 그 칸에 맞춰두면 그대로 나와야해"*
   *
   * ★**웹·폰이 같은 자리로 모인다.** 고르는 방법만 다르고(파일 입력 ↔ 앨범),
   *   자르기·업로드는 **한 벌**이다 — 오늘 여러 번 데인 «면마다 다르게 도는 것» 을 안 만든다.
   * ★비율은 **그리는 칸이 정한다**: 프로필 1, 배경 9/16(프로필 창 패널 비율과 같다).
   * ★창은 `requestCrop` 이 **화면 뿌리에서** 띄운다 — 카드 안에서 그리면 `absoluteFill` 이
   *   부모를 채워 화면을 못 덮는다(`lib/media/cropRequest.ts` 주석 참고).
   */
  const COVER_ASPECT = 9 / 16;

  /** 고른 사진을 자르고 → 올린다. 취소는 조용히 접는다(사용자가 스스로 접은 것이다). */
  const cropThenUpload = async (uri: string, kind: 'avatar' | 'cover') => {
    const cut = await requestCrop({
      uri,
      aspect: kind === 'avatar' ? 1 : COVER_ASPECT,
      outWidth: kind === 'avatar' ? 512 : 1080,
    });
    if (!cut) return;
    const img = await bytesOfUri(cut.uri);
    if (!img) { flash(t('profile.saveFail', '저장하지 못했어요')); return; }
    setBusy(true);
    const r = kind === 'avatar' ? await uploadMyAvatar(img) : await uploadMyCover(img);
    setBusy(false);
    if (r.ok && r.url) {
      if (kind === 'avatar') setAvatar(r.url); else setCover(r.url);
      flash(t('profile.saved', '저장했어요'));
    } else {
      flash(r.error === 'too_large'
        ? (kind === 'avatar' ? t('profile.tooLarge', '2MB 이하 사진만 올릴 수 있어요')
                             : t('profile.coverTooLarge', '4MB 이하 사진만 올릴 수 있어요'))
        : t('profile.saveFail', '저장하지 못했어요'));
    }
  };

  const onFile = async (e: any) => {
    const f = e?.target?.files?.[0];
    if (e.target) e.target.value = '';   // 같은 파일을 다시 골라도 이벤트가 오게
    if (!f) return;
    // ★바로 올리지 않는다 — **자르기 창을 먼저** 띄운다(폰과 같은 자리로 모인다)
    void cropThenUpload(URL.createObjectURL(f), 'avatar');
  };

  /**
   * 폰에서 사진 고르기 — 앨범 → 업로드 → 화면 갱신.
   * ★웹 경로(`onFile`)와 **같은 업로드 함수**를 쓴다(경로·정책·버전쿼리 규칙이 한 벌이다).
   * ⚠️취소·권한 거부는 `null` 이라 **아무 말도 하지 않는다** — 사용자가 스스로 접은 것이다.
   */
  const onPickNative = async () => {
    const uri = await pickImageUri();     // ★자르기 전 원본 — 편집은 우리 창이 한다
    if (uri) void cropThenUpload(uri, 'avatar');
  };
  const onPickCoverNative = async () => {
    const uri = await pickImageUri();
    if (uri) void cropThenUpload(uri, 'cover');
  };

  const onClear = async () => { setBusy(true); await clearMyAvatar(); setBusy(false); setAvatar(null); };

  // ★배경도 **같은 관용**이다 — 고르기·지우기가 사진과 나란히 있어야 «둘 다 바꿀 수 있다»가 읽힌다
  const onPickCover = () => coverRef.current?.click?.();
  const onCoverFile = async (e: any) => {
    const f = e?.target?.files?.[0];
    if (e.target) e.target.value = '';
    if (!f) return;
    void cropThenUpload(URL.createObjectURL(f), 'cover');
  };
  const onClearCover = async () => { setBusy(true); await clearMyCover(); setBusy(false); setCover(null); };

  const initial = (name.trim() || fallbackName || '나').slice(0, 1);
  // ★색은 **대표 명식**의 오행. 못 받았으면 테마 색(종전 동작)으로 떨어진다
  const el = element && elementColor[element] ? element : activeElement;
  return (
    <View style={styles.card}>
      {/*
        ★배경 사진 미리보기 — **프로필 창과 같은 9:16** (Boss 2026-08-31 *"배경사진도 동일"*).
        ⚠️종전엔 폭을 꽉 채운 **높이 110 가로 띠**였다. 자르기가 생겨 배경이 9:16 으로 저장되면서
          그 띠에는 **가운데 얇은 한 겹**만 보였다 — 「맞춰 둔 것」과 「보이는 것」이 또 달라진다.
        ⇒ 미리보기를 그리는 칸과 **같은 비율**로 세우고, 버튼은 옆으로 뺀다.
          작아도 «저 모양 그대로 나온다» 가 읽히는 편이 낫다.
      */}
      <View style={styles.coverRow}>
        <View style={[styles.cover, { backgroundColor: elementColor[el] }]}>
          {cover ? (
            <PressableScale style={StyleSheet.absoluteFill}
              onPress={() => setZoom({ uri: originalImage(cover) ?? cover, cap: t('profile.cover', '배경') })}>
              <ExpoImage source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={140} />
            </PressableScale>
          ) : null}
        </View>
        {(Platform.OS === 'web' || canPickImage) ? (
          <View style={styles.coverSide}>
            <PressableScale style={styles.coverBtn} onPress={Platform.OS === 'web' ? onPickCover : onPickCoverNative} disabled={busy}>
              <Text style={styles.coverBtnTx}>{t('profile.pickCover', '배경 바꾸기')}</Text>
            </PressableScale>
            {cover ? (
              <PressableScale style={[styles.coverBtn, styles.coverBtnAlt]} onPress={onClearCover} disabled={busy}>
                <Text style={[styles.coverBtnTx, styles.coverBtnTxAlt]}>{t('profile.clearCover', '배경 지우기')}</Text>
              </PressableScale>
            ) : null}
            <Text style={styles.coverHint}>{t('profile.coverHint', '프로필 창에 보이는 그대로예요.')}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.row}>
        {avatar
          ? (
            <PressableScale onPress={() => setZoom({ uri: originalImage(avatar) ?? avatar, cap: name || t('profile.photo', '프로필 사진') })}>
              <ExpoImage source={{ uri: avatar }} style={styles.av} contentFit="cover" transition={140} />
            </PressableScale>
          )
          : <View style={[styles.av, styles.avFallback, { backgroundColor: elementColor[el] }]}>
              <Text style={[styles.avTx, { color: elementText[el] }]}>{initial}</Text>
            </View>}
        <View style={styles.col}>
          {(Platform.OS === 'web' || canPickImage) ? (
            <>
              <PressableScale style={styles.btn} onPress={Platform.OS === 'web' ? onPickWeb : onPickNative} disabled={busy}>
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
          // ★★칸을 벗어나면 **즉시** 저장한다 — 디바운스(800ms)가 돌기 전에 화면을 떠나면
          //   타이머가 정리되면서 **마지막 글자가 날아간다**. 자동 저장이 «가끔 안 되는» 것이
          //   가장 나쁘다(사용자는 저장을 눌러 확인할 방법도 없어졌다).
          onBlur={onSaveName}
        />
        {/* ★「저장」 버튼을 없앴다(Boss 2026-08-29) — 이름은 멈추면 저장되고, 사진·배경은 고르는 즉시다.
            ⚠️버튼만 지우면 «됐는지 모르는» 화면이 된다 ⇒ 진행 표시는 남긴다(아래 msg 가 결과를 말한다). */}
        {busy ? <ActivityIndicator size="small" color={colors.ju} /> : null}
      </View>
      <Text style={styles.hint}>{t('profile.hint', '비워 두면 명식 이름으로 표시돼요.')}</Text>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      {/* 크게 보기 — 대화창과 **같은 창** */}
      <PhotoViewer uri={zoom?.uri ?? null} caption={zoom?.cap} onClose={() => setZoom(null)} />


      {/* 숨긴 파일 입력 — 웹에서만 렌더된다(네이티브에는 DOM 이 없다) */}
      {Platform.OS === 'web' ? <WebFileInput inputRef={fileRef} onChange={onFile} /> : null}
      {/* ★배경용 파일 입력도 **따로** 둔다 — 하나를 돌려 쓰면 어느 쪽을 고른 건지 알 수 없다 */}
      {Platform.OS === 'web' ? <WebFileInput inputRef={coverRef} onChange={onCoverFile} /> : null}
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
  // 배경 사진 — 카카오톡식 프로필 창의 윗면과 **같은 그림**이다
  coverRow: { flexDirection: 'row', gap: space(3), marginBottom: space(3), alignItems: 'flex-start' },
  // ★`COVER_ASPECT`(9/16)와 **같은 모양** — 여기 보이는 것이 프로필 창에 그대로 나온다
  cover: { width: 96, aspectRatio: 9 / 16, borderRadius: radius.md, overflow: 'hidden' },
  coverSide: { flex: 1, gap: space(2), paddingTop: space(1), alignItems: 'flex-start' },
  coverBtn: { paddingVertical: space(2), paddingHorizontal: space(3.5), borderRadius: radius.pill, backgroundColor: colors.ju },
  coverBtnAlt: { backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line },
  coverBtnTx: { ...font.caption, color: colors.onJu, fontWeight: '800' },
  coverBtnTxAlt: { color: colors.inkSoft },
  coverHint: { ...font.caption, color: colors.inkFaint, marginTop: space(0.5) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), gap: space(3), marginTop: space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
  av: { width: 64, height: 64, borderRadius: radius.md * 1.2 },
  // ★대표 명식 오행 색 — 친구목록의 '나'와 **같은 값**을 쓴다(두 곳이 다르면 같은 나가 다른 얼굴이 된다)
  avFallback: { alignItems: 'center', justifyContent: 'center' },   // ★색은 위 `el` 로 인라인(대표 명식 기준)
  // ★오행색 위 글자는 `elementText` — 흰색으로 통일하면 金(#D2CCBA)에서 안 읽힌다
  avTx: { fontWeight: '900', fontSize: 24 },                        // ★색은 위 `el` 로 인라인
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
