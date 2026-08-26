// app/src/components/CopyEditor.tsx — 관리자용 **문구 편집기**(빌드 없이 즉시 반영)
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-03 "문구 수정 관련해서 기획자가 수정할 수 있는 루트를 만들어줘".
//
// ■ 어떻게 쓰나
//   ① 고치고 싶은 문구의 **일부 글자**를 검색창에 친다(키를 몰라도 된다 — 문구로 찾는다).
//   ② 목록에서 고를 것을 눌러 새 문구를 쓰고 '저장'.
//   ③ 앱을 **다시 켜면** 반영된다(부팅 시 1회 덮어쓰기).
//   ④ '되돌리기' = 오버라이드 행 삭제 → 번들 문구(app/src/copy/ko.ts)로 복귀.
//
// ■ 왜 이 구조인가
//   · 원본(copy/ko.ts)은 그대로 두고 **덮어쓰기만** 한다 → 언제든 되돌릴 수 있다.
//   · 쓰기는 서버 RLS 가 관리자만 허용한다 — 화면에서 숨기는 건 편의일 뿐 권한은 서버가 정한다.
//   · 실패해도 앱은 번들 문구로 정상 동작한다(문구 때문에 앱이 멈추면 안 된다).
// ⚠️`{{n}}` 같은 자리표시자는 그대로 두어야 값이 들어간다. 지우면 화면에 값이 안 나온다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, Keyboard, Platform } from 'react-native';
import { PressableScale } from './PressableScale';
import { Alert } from '../lib/ui/alert';
import { ko as BUNDLED } from '../copy/ko';
import { listCopyOverrides, setCopyOverride, clearCopyOverride } from '../lib/ui/copyOverrides';
// ★언어 목록은 `lib/i18n.ts` 단일 출처(Boss 2026-08-26 "하드코딩은 한곳으로 모아")
import { APP_LANGS, APP_LANG_LABEL, appLang, type AppLang } from '../lib/i18n';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, font } from '../lib/theme';

/** 중첩 문구 객체 → `a.b.c` 평탄화. 편집기는 평탄한 키로 다룬다(검색·저장 모두 같은 단위). */
function flatten(o: any, p = ''): [string, string][] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${p}${k}.`) : typeof v === 'string' ? [[`${p}${k}`, v] as [string, string]] : [],
  );
}
const ALL = flatten(BUNDLED);

export function CopyEditor() {
  const { fs } = useFontScale();
  const [q, setQ] = useState('');
  // ★어느 언어를 고치는가 — 해외 타게팅이라 한국어만으로는 부족하다(Boss 2026-08-26).
  //   기본은 지금 앱 언어. 원본(BUNDLED)은 한국어라 **찾기는 한국어로, 고치기는 고른 언어로** 한다.
  const [lang, setLang] = useState<AppLang>(appLang());
  const [over, setOver] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  // ★키보드 회피(check:keyboard) — 긴 문구를 고칠 때 아래쪽 항목의 입력창이 키보드에 덮인다.
  //   이 편집기는 관리자 화면 **스크롤 안에** 들어가므로 별도 KeyboardAvoidingView 대신
  //   리스트 하단에 키보드 높이만큼 여백을 준다(coach.tsx 의 lift 패턴과 같은 해법).
  const [kbH, setKbH] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(showEvt, (e) => setKbH(e.endCoordinates?.height ?? 0));
    const b = Keyboard.addListener(hideEvt, () => setKbH(0));
    return () => { a.remove(); b.remove(); };
  }, []);

  const reload = async () => {
    setLoading(true);
    const rows = await listCopyOverrides(lang).catch(() => []);
    setOver(Object.fromEntries(rows.filter((r) => typeof r.value === 'string').map((r) => [r.key, r.value])));
    setLoading(false);
  };
  // ★언어를 바꾸면 그 언어의 오버라이드로 다시 읽는다(안 하면 옛 언어 값이 남아 헷갈린다)
  useEffect(() => { void reload(); }, [lang]);

  // 문구·키 어느 쪽으로 쳐도 찾히게. 기획자는 키를 모른다 — **보이는 글자로** 찾는 게 기본이다.
  const hits = useMemo(() => {
    const s = q.trim();
    if (s.length < 2) return [];
    const low = s.toLowerCase();
    return ALL
      .filter(([k, v]) => v.toLowerCase().includes(low) || k.toLowerCase().includes(low))
      .slice(0, 40);
  }, [q]);

  async function save(key: string) {
    if (busy) return;
    const v = draft.trim();
    if (!v) { Alert.alert('문구 수정', '빈 문구는 저장할 수 없어요. 되돌리려면 아래 되돌리기를 쓰세요.'); return; }
    setBusy(true);
    const okSave = await setCopyOverride(key, lang, v).catch(() => false);
    setBusy(false);
    if (!okSave) { Alert.alert('저장하지 못했어요', '관리자 계정인지, 연결 상태를 확인해 주세요.'); return; }
    setEditing(null);
    await reload();
    Alert.alert('저장했어요', '앱을 다시 켜면 반영돼요.');
  }

  async function revert(key: string) {
    if (busy) return;
    setBusy(true);
    const okDel = await clearCopyOverride(key, lang).catch(() => false);
    setBusy(false);
    if (!okDel) { Alert.alert('되돌리지 못했어요', '연결 상태를 확인해 주세요.'); return; }
    setEditing(null);
    await reload();
    Alert.alert('되돌렸어요', '원래 문구로 돌아가요(앱 재시작 후).');
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.h, { fontSize: fs(15) }]}>문구 수정</Text>
      <Text style={[styles.help, { fontSize: fs(11.5) }]}>
        고치고 싶은 문구의 일부를 그대로 쳐서 찾으세요. 저장하면 앱을 다시 켤 때 반영되고, 되돌리기로 원래대로 돌아갑니다.
      </Text>
      {/* ★어느 언어를 고치는가 — 찾기는 한국어 원본으로, 고치기는 고른 언어로.
          목록은 `lib/i18n.ts` 하나에서 온다(언어를 늘려도 이 화면은 안 고친다). */}
      <View style={styles.langRow}>
        {APP_LANGS.map((k) => {
          const on = k === lang;
          return (
            <PressableScale key={k} style={[styles.langChip, on && styles.langChipOn]} onPress={() => setLang(k)}>
              <Text style={[styles.langTx, { fontSize: fs(11.5) }, on && styles.langTxOn]}>{APP_LANG_LABEL[k]}</Text>
            </PressableScale>
          );
        })}
      </View>
      <TextInput
        style={[styles.search, { fontSize: fs(14) }]}
        value={q}
        onChangeText={setQ}
        placeholder="예) 이 관계 풀이 만들기"
        placeholderTextColor={colors.inkFaint}
      />
      {loading ? <ActivityIndicator color={colors.ju} style={{ marginTop: space(3) }} /> : null}
      {!loading && Object.keys(over).length > 0 && (
        <Text style={[styles.overCount, { fontSize: fs(11.5) }]}>지금 바꿔 둔 문구 {Object.keys(over).length}개</Text>
      )}
      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: kbH > 0 ? kbH * 0.6 : 0 }} keyboardShouldPersistTaps="handled">
        {q.trim().length < 2 ? (
          <Text style={[styles.dim, { fontSize: fs(12) }]}>두 글자 이상 입력하면 찾아 드려요.</Text>
        ) : hits.length === 0 ? (
          <Text style={[styles.dim, { fontSize: fs(12) }]}>못 찾았어요. 화면에 보이는 그대로 쳐 보세요(띄어쓰기 포함).</Text>
        ) : hits.map(([key, bundled]) => {
          const cur = over[key];
          const isEd = editing === key;
          return (
            <View key={key} style={styles.row}>
              <Text style={[styles.key, { fontSize: fs(10.5) }]}>{key}</Text>
              <Text style={[styles.val, { fontSize: fs(13) }]} numberOfLines={isEd ? undefined : 3}>
                {cur ?? bundled}
              </Text>
              {cur ? <Text style={[styles.badge, { fontSize: fs(10) }]}>바꿔 둠 · 원래: {bundled.slice(0, 40)}</Text> : null}
              {isEd ? (
                <>
                  <TextInput
                    style={[styles.edit, { fontSize: fs(13) }]}
                    value={draft}
                    onChangeText={setDraft}
                    multiline
                    autoFocus
                  />
                  <View style={styles.btns}>
                    <PressableScale style={styles.btn} onPress={() => void save(key)} disabled={busy}>
                      <Text style={styles.btnTx}>저장</Text>
                    </PressableScale>
                    {cur ? (
                      <PressableScale style={[styles.btn, styles.btnGhost]} onPress={() => void revert(key)} disabled={busy}>
                        <Text style={[styles.btnTx, styles.btnGhostTx]}>되돌리기</Text>
                      </PressableScale>
                    ) : null}
                    <PressableScale style={[styles.btn, styles.btnGhost]} onPress={() => setEditing(null)}>
                      <Text style={[styles.btnTx, styles.btnGhostTx]}>취소</Text>
                    </PressableScale>
                  </View>
                </>
              ) : (
                <PressableScale style={styles.editBtn} onPress={() => { setEditing(key); setDraft(cur ?? bundled); }}>
                  <Text style={[styles.editBtnTx, { fontSize: fs(12) }]}>고치기</Text>
                </PressableScale>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ★언어 칩 — 지금 고치는 언어를 늘 보이게(안 보이면 엉뚱한 언어를 고치고도 모른다)
  langRow: { flexDirection: 'row', gap: space(1.5), flexWrap: 'wrap', marginTop: space(2) },
  langChip: { paddingVertical: space(1), paddingHorizontal: space(2.5), borderRadius: radius.pill, backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line },
  langChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  langTx: { color: colors.inkSoft, fontWeight: '700' },
  langTxOn: { color: colors.onJu },
  wrap: { marginTop: space(6) },
  h: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.5, marginBottom: space(1.5) },
  help: { ...font.caption, color: colors.inkFaint, marginBottom: space(2.5), lineHeight: 17 },
  search: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: space(2.5), paddingHorizontal: space(3.5), color: colors.ink },
  overCount: { ...font.caption, color: colors.ju, fontWeight: '700', marginTop: space(2) },
  list: { marginTop: space(2), maxHeight: 460 },
  dim: { ...font.caption, color: colors.inkFaint, paddingVertical: space(4), textAlign: 'center' },
  row: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space(3), marginBottom: space(2) },
  key: { ...font.caption, color: colors.inkFaint, fontWeight: '700', marginBottom: space(1) },
  val: { ...font.body, color: colors.ink, lineHeight: 19 },
  badge: { ...font.caption, color: colors.ju, marginTop: space(1) },
  edit: { marginTop: space(2), minHeight: 72, backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.juLine, borderRadius: radius.sm, padding: space(2.5), color: colors.ink, textAlignVertical: 'top' },
  btns: { flexDirection: 'row', gap: space(2), marginTop: space(2) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingVertical: space(2), paddingHorizontal: space(4) },
  btnGhost: { backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line },
  btnTx: { color: colors.bg, fontWeight: '800', fontSize: 13 },
  btnGhostTx: { color: colors.inkSoft },
  editBtn: { alignSelf: 'flex-start', marginTop: space(2), backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingVertical: space(1.5), paddingHorizontal: space(3.5) },
  editBtnTx: { color: colors.inkSoft, fontWeight: '700' },
});
