// src/app/(app)/pet.tsx — 콘텐츠 '나의 반려동물' (무료, 온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 운세보다 *특징·성격* 위주로 가볍게. 동물 종류 입력, 생년월일(시 옵션 — 모르면 시주 해석X).
//   사람 명식과 분리 보관(petChart). 통변 = 온디바이스 템플릿(petTraits) → 무료·API 0.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { Alert } from '../../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from 'expo-router';
import { buildSajuChart } from '@engine/saju';
import { SIJIN } from '../../lib/engine/sijin';                  // 12시진(자시·축시…) 피커 데이터
import { listPets, addPet, updatePet, deletePet, PET_TYPES, type SavedPet, type PetType } from '../../lib/content/petChart';
import { getPetTraits } from '../../lib/content/petTraits';
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { ContentHero } from '../../components/SpecialContentScreen'; // 이미지 히어로(보는 맛)
import { ShareReadingButton } from '../../components/ShareReadingButton'; // 이슈17: 풀이 결과 공유(앱게이트)

export default function PetScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const [pets, setPets] = useState<SavedPet[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null); // 수정 중인 펫 id(만세력 명식 수정처럼 내부에서)
  // 입력 폼 상태
  const [name, setName] = useState('');
  const [petType, setPetType] = useState<PetType>('dog');
  const [date, setDate] = useState('');           // YYYY-MM-DD (자동 하이픈)
  const [sijinIdx, setSijinIdx] = useState(-1);   // 선택한 시진(-1=미선택) — 명식과 동일 피커
  const [timeUnknown, setTimeUnknown] = useState(false); // '시간 모름' 체크 → 시각 비활성·공란
  const [sijinOpen, setSijinOpen] = useState(false);     // 시진 피커 바텀시트

  // 입력 자동 포맷 — 숫자만 받아 하이픈/콜론을 자동 삽입(daniel "- 자동으로 적히게").
  const fmtDate = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 8);             // YYYYMMDD
    if (d.length <= 4) return d;
    if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
  };
  const reload = useCallback(async () => {
    const list = await listPets();
    setPets(list);
    setSelId((cur) => cur ?? (list.length ? list[list.length - 1].id : null));
    setAdding(list.length === 0);                 // 한 마리도 없으면 바로 입력 폼
  }, []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const sel = useMemo(() => pets.find((p) => p.id === selId) ?? null, [pets, selId]);

  // 선택된 아이의 특징 통변(온디바이스). 시각 미상이면 시주 결 제외.
  const reading = useMemo(() => {
    if (!sel) return null;
    try {
      const saju: any = buildSajuChart(sel.input);
      saju.timeUnknown = sel.input.timeAccuracy === '미상';
      return getPetTraits(saju, sel.petType, sel.name);
    } catch { return null; }
  }, [sel]);

  async function onSave() {
    const d = date.trim();
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(d)) { Alert.alert(t('pet.invalidTitle'), t('pet.invalidDate')); return; }
    // 시간 모름이거나 시진 미선택 → 시각 미상(시주 해석 제외). 시진 선택 → 대표 시각(hm).
    const sj = !timeUnknown && sijinIdx >= 0 ? SIJIN[sijinIdx] : null;
    const input: any = {
      birthDateTime: `${d} ${sj ? sj.hm : '0:0'}`,
      calendar: '양력',
      sex: '남',                                   // 사주 기둥은 성별 무관(특징엔 영향 없음) — 기본값
      timeAccuracy: sj ? '정확' : '미상',
    };
    if (editId) { await updatePet(editId, name, petType, input); setSelId(editId); }
    else { const id = await addPet(name, petType, input); setSelId(id); }
    setName(''); setDate(''); setSijinIdx(-1); setTimeUnknown(false); setPetType('dog'); setEditId(null);
    await reload();
    setAdding(false);
  }

  // 폼 초기화 + 새로 추가 진입(이전 수정 데이터 잔존 방지)
  function startAdd() { setEditId(null); setName(''); setDate(''); setSijinIdx(-1); setTimeUnknown(false); setPetType('dog'); setAdding(true); }
  // 수정 — 선택한 아이 정보를 폼에 로드(만세력 명식 수정처럼 콘텐츠 내부에서)
  function onEdit(p: SavedPet) {
    setName(p.name); setPetType(p.petType);
    const parts = String(p.input.birthDateTime ?? '').split(' ');
    setDate(parts[0] ?? '');
    const tu = p.input.timeAccuracy === '미상';
    setTimeUnknown(tu);
    setSijinIdx(tu ? -1 : SIJIN.findIndex((s) => s.hm === parts[1]));
    setEditId(p.id); setAdding(true);
  }

  // 시간 모름 토글 — 켜면 시진 선택 해제(공란·비활성)
  function toggleTimeUnknown() {
    setTimeUnknown((v) => { const nv = !v; if (nv) setSijinIdx(-1); return nv; });
  }
  function pickSijin(i: number) { setSijinIdx(i); setSijinOpen(false); }

  function onDelete(id: string) {
    Alert.alert(t('pet.deleteTitle'), t('pet.deleteMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('pet.delete'), style: 'destructive', onPress: async () => { await deletePet(id); setSelId(null); await reload(); } },
    ]);
  }

  const bodyDyn = { fontSize: fs(15), lineHeight: fs(24) };


  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <ContentHero image={require('../../../assets/icons/pet.jpg')} title={t('pet.title')} sub={t('pet.sub')} />

      {/* 저장된 아이들 — 칩으로 전환 + 추가 */}
      {pets.length > 0 && (
        <View style={styles.petChips}>
          {pets.map((p) => (
            <PressableScale key={p.id} style={[styles.petChip, selId === p.id && !adding && styles.petChipOn]} onPress={() => { setSelId(p.id); setAdding(false); }}>
              <Text style={[styles.petChipTx, selId === p.id && !adding && styles.petChipTxOn]}>{p.name}</Text>
            </PressableScale>
          ))}
          <PressableScale style={[styles.petChip, adding && styles.petChipOn]} onPress={startAdd}>
            <Text style={[styles.petChipTx, adding && styles.petChipTxOn]}>+ {t('pet.add')}</Text>
          </PressableScale>
        </View>
      )}

      {adding ? (
        // ── 입력 폼 ──
        <View style={styles.card}>
          <Text style={styles.label}>{t('pet.name')}</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('pet.namePh')} placeholderTextColor={colors.inkFaint} />

          <Text style={styles.label}>{t('pet.typeLabel')}</Text>
          <View style={styles.typeGrid}>
            {PET_TYPES.map((ty) => (
              <PressableScale key={ty} style={[styles.typeChip, petType === ty && styles.typeChipOn]} onPress={() => setPetType(ty)}>
                <Text style={[styles.typeChipTx, petType === ty && styles.typeChipTxOn]}>{t(`pet.type.${ty}`)}</Text>
              </PressableScale>
            ))}
          </View>

          <Text style={styles.label}>{t('pet.birth')}</Text>
          <TextInput style={styles.input} value={date} onChangeText={(v) => setDate(fmtDate(v))} placeholder="2021-04-15" placeholderTextColor={colors.inkFaint} keyboardType="number-pad" maxLength={10} />

          <Text style={styles.label}>{t('pet.time')} <Text style={styles.optional}>{t('pet.timeOptional')}</Text></Text>
          {/* 시진 피커 필드(명식과 동일) — 시간 모름이면 비활성·공란 */}
          <PressableScale style={[styles.input, styles.selectField, timeUnknown && styles.fieldDisabled]} disabled={timeUnknown} onPress={() => setSijinOpen(true)}>
            <Text style={[styles.selectText, (timeUnknown || sijinIdx < 0) && styles.selectPlaceholder]}>
              {timeUnknown ? '' : sijinIdx >= 0 ? `${SIJIN[sijinIdx].gz} ${SIJIN[sijinIdx].ko} (${SIJIN[sijinIdx].range})` : ''}
            </Text>
            {!timeUnknown && <Text style={styles.chevron}>▾</Text>}
          </PressableScale>
          {/* 시간 모름 체크 */}
          <PressableScale style={styles.checkRow} onPress={toggleTimeUnknown}>
            <View style={[styles.checkbox, timeUnknown && styles.checkboxOn]}>{timeUnknown && <Text style={styles.checkMark}>✓</Text>}</View>
            <Text style={styles.checkLabel}>{t('pet.timeUnknownChk')}</Text>
          </PressableScale>
          <Text style={styles.hint}>{t('pet.timeHint')}</Text>

          <PressableScale style={styles.saveBtn} onPress={onSave}>
            <Text style={styles.saveBtnTx}>{t('pet.save')}</Text>
          </PressableScale>
        </View>
      ) : sel && reading ? (
        // ── 특징 통변 ──
        <View>
          {/* 수정·삭제 — 만세력 명식처럼 콘텐츠 내부에서(하단 '이 아이 지우기' 대체) */}
          <View style={styles.petActions}>
            <PressableScale hitSlop={8} onPress={() => onEdit(sel)}><Text style={styles.petActTx}>{t('common.edit', '수정')}</Text></PressableScale>
            <Text style={styles.petActSep}>·</Text>
            <PressableScale hitSlop={8} onPress={() => onDelete(sel.id)}><Text style={[styles.petActTx, styles.petActDel]}>{t('pet.delete')}</Text></PressableScale>
          </View>
          <View style={styles.introCard}>
            <Text style={[styles.intro, bodyDyn]}>{reading.intro}</Text>
          </View>
          {reading.sections.map((s, i) => (
            <View key={i} style={styles.card}>
              <Text style={styles.secLabel}>{s.label}</Text>
              <Text style={[styles.body, bodyDyn]}>{s.text}</Text>
            </View>
          ))}
          {/* 이슈17: 반려동물 특징 공유(앱게이트) */}
          <ShareReadingButton kind="pet" title={`${sel.name} 반려동물`} content={{ intro: reading.intro, sections: reading.sections }} />
        </View>
      ) : (
        <View style={styles.card}><Text style={styles.body}>{t('pet.empty')}</Text></View>
      )}

      {/* 시진 선택 바텀시트(명식과 동일) — 12시진 스크롤 선택 */}
      <Modal visible={sijinOpen} transparent animationType="slide" onRequestClose={() => setSijinOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSijinOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('pet.time')}</Text>
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {SIJIN.map((s, i) => {
                const on = sijinIdx === i;
                return (
                  <PressableScale key={s.gz} style={[styles.optionRow, on && styles.optionRowOn]} onPress={() => pickSijin(i)}>
                    <Text style={[styles.optionGz, on && styles.optionGzOn]}>{s.gz}</Text>
                    <Text style={[styles.optionText, on && styles.optionTextOn]}>{s.ko} · {s.range}</Text>
                    {on && <Text style={styles.optionCheck}>✓</Text>}
                  </PressableScale>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(6), paddingBottom: space(12) }, // 콘텐츠 좌우여백 통일(daniel)
  h: { ...font.title, marginBottom: space(1) },
  sub: { ...font.caption, color: colors.inkSoft, marginBottom: space(5), lineHeight: 19 },
  petChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginBottom: space(4) },
  petChip: { paddingVertical: space(2), paddingHorizontal: space(4), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.card },
  petChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  petChipTx: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  petChipTxOn: { color: colors.bg },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  introCard: { backgroundColor: colors.juSoft, borderRadius: radius.md, padding: space(5), marginBottom: space(3) },
  intro: { ...font.body, color: colors.ink, fontWeight: '600' },
  secLabel: { fontSize: 15, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  body: { ...font.body, color: colors.ink },
  label: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: space(3), marginBottom: space(2) },
  optional: { fontSize: 12, fontWeight: '600', color: colors.inkFaint },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: space(3), fontSize: 16, color: colors.ink, backgroundColor: colors.bg },
  hint: { ...font.caption, color: colors.inkFaint, marginTop: space(2) },
  // 시진 피커 필드(드롭다운)
  selectField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46 },
  fieldDisabled: { opacity: 0.4 },
  selectText: { fontSize: 16, color: colors.ink },
  selectPlaceholder: { color: colors.inkFaint },
  chevron: { color: colors.ju, fontSize: 14, fontWeight: '800' },
  // 시간 모름 체크
  checkRow: { flexDirection: 'row', alignItems: 'center', marginTop: space(3), gap: space(2.5) },
  checkbox: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.ju, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.ju },
  checkMark: { color: colors.bg, fontSize: 14, fontWeight: '900' },
  checkLabel: { ...font.body, color: colors.ink },
  // 시진 바텀시트
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space(5), paddingBottom: space(9) },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: space(3) },
  sheetTitle: { ...font.heading, color: colors.ink, marginBottom: space(3) },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(3.5), paddingHorizontal: space(2), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, gap: space(3) },
  optionRowOn: { backgroundColor: colors.juSoft, borderRadius: radius.sm },
  optionGz: { fontSize: 18, fontWeight: '800', color: colors.inkSoft, width: 28, textAlign: 'center' },
  optionGzOn: { color: colors.ju },
  optionText: { ...font.body, color: colors.ink, flex: 1 },
  optionTextOn: { color: colors.ju, fontWeight: '700' },
  optionCheck: { color: colors.ju, fontSize: 16, fontWeight: '800' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  typeChip: { paddingVertical: space(2), paddingHorizontal: space(3), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.bg },
  typeChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  typeChipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  typeChipTxOn: { color: colors.bg },
  saveBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center', marginTop: space(5) },
  saveBtnTx: { color: colors.bg, fontWeight: '800', fontSize: 16 },
  delBtn: { paddingVertical: space(3), alignItems: 'center', marginTop: space(2) },
  delBtnTx: { color: colors.inkFaint, fontSize: 13, fontWeight: '600' },
  // 펫 수정·삭제 액션(통변 상단 우측) — 만세력 명식처럼 내부 관리
  petActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space(2), marginBottom: space(2) },
  petActTx: { fontSize: 13, fontWeight: '700', color: colors.ju },
  petActSep: { color: colors.inkFaint },
  petActDel: { color: '#E5484D' },
});
