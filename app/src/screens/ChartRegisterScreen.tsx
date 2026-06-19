// app/src/screens/ChartRegisterScreen.tsx — 명식 등록 폼 (한지·먹 테마, 다국어)
// ─────────────────────────────────────────────────────────────────────────
// 개선(2026-06):
//   · 생년월일: 숫자 입력 자동 하이픈(19900315 → 1990-03-15, formatBirthDate)
//   · 태어난 시각: 드롭다운 필드 클릭 → 바텀시트에서 12시진(자·축·인·묘…) 스크롤 선택 + '모름'
//   · 관계: 프리셋 칩 + '직접 입력'(자유 텍스트) — 사용자가 직접 작성 등록 가능
//   · label(이름)·relation 을 onSubmit input 에 포함(기존 누락 버그 수정)
// 입력 → onSubmit(input) 콜백(라우트가 myChart 저장 + /myeongsik 전달). PII 기기 잔류(ADR-005).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { SIJIN, formatBirthDate } from '../lib/sijin';
import { BirthPlacePicker } from '../components/BirthPlacePicker';

// 관계 프리셋 — 'self'(본인)은 내 차트 기준. 마지막 '직접입력'은 자유 텍스트 모드 트리거.
const RELATION_PRESETS = ['self', '가족', '지인', '연인', '관심', '반려동물', '공인'] as const;

// defaultRelation/submitLabel = 궁합 상대 등록 등 재사용 시 기본 관계·CTA 문구 주입(옵션, 기존 호출 영향 0).
export function ChartRegisterScreen({ onSubmit, defaultRelation, submitLabel, showMakeRep = true, initial, autoSave, onAutoSave }: { onSubmit: (input: any) => void; defaultRelation?: string; submitLabel?: string; showMakeRep?: boolean; initial?: any; autoSave?: boolean; onAutoSave?: (input: any) => void }) {
  const { t } = useTranslation();
  // 편집모드(initial) = 기존 명식 값으로 폼 prefill. 신규면 빈 값. 시각은 hm(대표시각)으로 시진 역매핑.
  const initTime = initial && initial.timeAccuracy !== '미상' ? String(initial.birthDateTime ?? '').split(' ')[1] : null;
  const [label, setLabel] = useState(initial?.label ?? '');
  const [birthDate, setBirthDate] = useState(initial ? String(initial.birthDateTime ?? '').split(' ')[0] : '');
  const [sijinIdx, setSijinIdx] = useState<number>(initTime ? SIJIN.findIndex((s) => s.hm === initTime) : -1); // -1 = 시각 모름
  const [sijinOpen, setSijinOpen] = useState(false);     // 시진 선택 바텀시트
  const [calendar, setCalendar] = useState<'양' | '음'>(initial?.calendar ?? '양');
  const [sex, setSex] = useState<'남' | '여'>(initial?.sex ?? '남');
  const [birthPlace, setBirthPlace] = useState(initial?.birthPlace ?? '');
  const [birthPlaceLon, setBirthPlaceLon] = useState<number | null>(initial?.birthLon ?? null); // 진태양시 경도(ADR-008 준비)
  const [relation, setRelation] = useState<string>(initial?.relation ?? defaultRelation ?? 'self');
  const [relationCustom, setRelationCustom] = useState(false); // 직접입력 모드
  const [makeRep, setMakeRep] = useState(false); // 이 명식을 대표로 설정(register 전용)
  // 풀이 grounding 기본정보(선택, daniel) — 하는 일·관계상태·관심/고민·메모. 입력 시 통변이 더 정확(특히 R25: 현재 배우자 유무가 연애·결혼·궁합 풀이를 좌우).
  const [job, setJob] = useState(initial?.context?.job ?? '');
  const [relationship, setRelationship] = useState<string>(initial?.context?.relationship ?? '');
  const [concern, setConcern] = useState(initial?.context?.concern ?? '');
  const [note, setNote] = useState(initial?.context?.note ?? '');

  const sj = sijinIdx >= 0 ? SIJIN[sijinIdx] : null;
  const sijinLabel = sj ? `${sj.gz} ${sj.ko} (${sj.range})` : t('register.timeUnknown');

  function pickSijin(i: number) { setSijinIdx(i); setSijinOpen(false); }

  // input 구성 — 수동 제출·자동저장 공용. label/relation 은 메타(ChartInput PII 계약 외).
  function buildInput() {
    return {
      label: label.trim() || (relation === 'self' ? t('register.selfLabel') : relation),
      birthDateTime: `${birthDate} ${sj ? sj.hm : '0:0'}`, // 시진 대표 시각 주입(모름=0:0)
      calendar, sex, birthPlace, birthLon: birthPlaceLon ?? undefined, // 진태양시 보정 경도(엔진 ChartInput.birthLon)
      relation,
      timeAccuracy: sj ? '정확' : '미상', // 시진 알면 시주 확정 → 정확
      makeRep, // 대표 설정 여부 — register 라우트가 처리(궁합 상대 등록 시 showMakeRep=false 라 무시)
      // 풀이 grounding 기본정보(선택) — 하나라도 채워졌을 때만 context 전달(빈 값은 undefined로 정리).
      context: (job.trim() || relationship || concern.trim() || note.trim())
        ? { job: job.trim() || undefined, relationship: relationship || undefined, concern: concern.trim() || undefined, note: note.trim() || undefined }
        : undefined,
    };
  }
  function handleSubmit() { onSubmit(buildInput()); }

  // 자동저장(편집모드) — 필드 변경 600ms 후 저장(저장 버튼 따로 안 눌러도 됨, daniel). 초기 prefill 은 skip(불필요 저장 방지).
  const firstAuto = useRef(true);
  useEffect(() => {
    if (!autoSave || !onAutoSave) return;
    if (firstAuto.current) { firstAuto.current = false; return; }
    const id = setTimeout(() => onAutoSave(buildInput()), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, birthDate, sijinIdx, calendar, sex, birthPlace, birthPlaceLon, relation, makeRep, job, relationship, concern, note, autoSave]);

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.form}>
        {/* 이름·별칭 */}
        <Text style={styles.label}>{t('register.name')}</Text>
        <TextInput style={styles.input} value={label} onChangeText={setLabel}
          placeholder={t('register.namePh')} placeholderTextColor={colors.inkFaint} />

        {/* 생년월일 — 숫자 입력 자동 하이픈(19900315 → 1990-03-15) */}
        <Text style={styles.label}>{t('register.birthDate')}</Text>
        <TextInput style={styles.input} value={birthDate}
          onChangeText={(v) => setBirthDate(formatBirthDate(v))}
          placeholder={t('register.birthDatePh')} placeholderTextColor={colors.inkFaint}
          keyboardType="number-pad" maxLength={10} />

        {/* 태어난 시각 — 드롭다운 필드 클릭 → 바텀시트 스크롤 선택 */}
        <Text style={styles.label}>{t('register.birthTimeSijin')}</Text>
        <Pressable style={styles.select} onPress={() => setSijinOpen(true)}>
          <Text style={[styles.selectText, !sj && styles.selectPlaceholder]}>{sijinLabel}</Text>
          <Text style={styles.selectChevron}>▾</Text>
        </Pressable>

        {/* 양력/음력 */}
        <Text style={styles.label}>{t('register.calendar')}</Text>
        <Segmented options={[{ value: '양', label: t('register.solar') }, { value: '음', label: t('register.lunar') }]}
          value={calendar} onChange={(v) => setCalendar(v as '양' | '음')} />

        {/* 성별 */}
        <Text style={styles.label}>{t('register.sex')}</Text>
        <Segmented options={[{ value: '남', label: t('register.male') }, { value: '여', label: t('register.female') }]}
          value={sex} onChange={(v) => setSex(v as '남' | '여')} />

        {/* 출생지 — 도시 검색 선택(Nominatim, 검증된 입력 + 진태양시 경도 보관) */}
        <Text style={styles.label}>{t('register.birthPlace')}</Text>
        <BirthPlacePicker value={birthPlace} onSelect={(p) => { setBirthPlace(p.name); setBirthPlaceLon(p.lon); }} />

        {/* 관계 — 프리셋 칩 + 직접 입력(자유 텍스트) */}
        <Text style={styles.label}>{t('register.relation')}</Text>
        <View style={styles.chipRow}>
          {RELATION_PRESETS.map((r) => {
            const on = !relationCustom && relation === r;
            return (
              <Pressable key={r} style={[styles.chip, on && styles.chipOn]}
                onPress={() => { setRelationCustom(false); setRelation(r); }}>
                <Text style={on ? styles.chipOnText : styles.chipText}>{r === 'self' ? t('register.selfLabel') : r}</Text>
              </Pressable>
            );
          })}
          {/* 직접입력 토글 */}
          <Pressable style={[styles.chip, relationCustom && styles.chipOn]}
            onPress={() => { setRelationCustom(true); setRelation(''); }}>
            <Text style={relationCustom ? styles.chipOnText : styles.chipText}>＋ {t('register.relationCustom')}</Text>
          </Pressable>
        </View>
        {relationCustom && (
          <TextInput style={[styles.input, { marginTop: space(2) }]} value={relation} onChangeText={setRelation}
            placeholder={t('register.relationCustomPh')} placeholderTextColor={colors.inkFaint} autoFocus />
        )}

        {/* 내 상황(선택) — 풀이 grounding 기본정보. R25: 현재 배우자 유무가 연애·결혼·궁합 풀이를 좌우 */}
        <View style={styles.ctxBox}>
          <Text style={styles.ctxTitle}>{t('register.ctxTitle')}</Text>
          <Text style={styles.ctxDesc}>{t('register.ctxDesc')}</Text>

          <Text style={styles.ctxLabel}>{t('register.ctxJob')}</Text>
          <TextInput style={styles.input} value={job} onChangeText={setJob}
            placeholder={t('register.ctxJobPh')} placeholderTextColor={colors.inkFaint} />

          <Text style={styles.ctxLabel}>{t('register.ctxRel')}</Text>
          <View style={styles.chipRow}>
            {([['single', t('register.ctxRelSingle')], ['dating', t('register.ctxRelDating')], ['married', t('register.ctxRelMarried')], ['other', t('register.ctxRelOther')]] as const).map(([v, lbl]) => {
              const on = relationship === v;
              return (
                <Pressable key={v} style={[styles.chip, on && styles.chipOn]} onPress={() => setRelationship(on ? '' : v)}>
                  <Text style={on ? styles.chipOnText : styles.chipText}>{lbl}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.ctxLabel}>{t('register.ctxConcern')}</Text>
          <TextInput style={[styles.input, styles.inputMulti]} value={concern} onChangeText={setConcern}
            placeholder={t('register.ctxConcernPh')} placeholderTextColor={colors.inkFaint} multiline />

          <Text style={styles.ctxLabel}>{t('register.ctxNote')}</Text>
          <TextInput style={[styles.input, styles.inputMulti]} value={note} onChangeText={setNote}
            placeholder={t('register.ctxNotePh')} placeholderTextColor={colors.inkFaint} multiline />
        </View>

        {/* 대표 명식으로 설정 — register 전용(궁합 상대 등록 시 숨김) */}
        {showMakeRep && (
          <Pressable style={styles.repCheck} onPress={() => setMakeRep((v) => !v)}>
            <View style={[styles.repBox, makeRep && styles.repBoxOn]}>{makeRep ? <Text style={styles.repChk}>✓</Text> : null}</View>
            <Text style={styles.repLabel}>{t('register.makeRep')}</Text>
          </Pressable>
        )}

        {/* 제출 (CTA = 주색) */}
        <Pressable style={styles.submit} onPress={handleSubmit}>
          <Text style={styles.submitText}>{submitLabel ?? t('register.submit')}</Text>
        </Pressable>
      </ScrollView>

      {/* 시진 선택 바텀시트 — 클릭 시 슬라이드 업, 스크롤로 12시진+모름 선택 */}
      <Modal visible={sijinOpen} transparent animationType="slide" onRequestClose={() => setSijinOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSijinOpen(false)}>
          {/* 시트 영역 탭은 닫히지 않게(빈 onPress 로 전파 차단) */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('register.birthTimeSijin')}</Text>
            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {/* 모름 */}
              <Pressable style={styles.optionRow} onPress={() => pickSijin(-1)}>
                <Text style={styles.optionGz}>?</Text>
                <Text style={styles.optionText}>{t('register.timeUnknown')}</Text>
                {sijinIdx === -1 && <Text style={styles.optionCheck}>✓</Text>}
              </Pressable>
              {SIJIN.map((s, i) => {
                const on = sijinIdx === i;
                return (
                  <Pressable key={s.gz} style={[styles.optionRow, on && styles.optionRowOn]} onPress={() => pickSijin(i)}>
                    <Text style={[styles.optionGz, on && styles.optionGzOn]}>{s.gz}</Text>
                    <Text style={[styles.optionText, on && styles.optionTextOn]}>{s.ko} · {s.range}</Text>
                    {on && <Text style={styles.optionCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// 세그먼트(양음/남녀) — 선택 시 먹 배경.
function Segmented({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <Pressable key={o.value} style={[styles.segItem, on && styles.segOn]} onPress={() => onChange(o.value)}>
            <Text style={on ? styles.segOnText : styles.segText}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  form: { padding: space(5), paddingBottom: space(12), gap: space(1.5) },
  label: { ...font.label, marginTop: space(4) },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.sm, paddingVertical: space(3), paddingHorizontal: space(3.5),
    fontSize: 15, color: colors.ink, ...shadow.soft,
  },
  // 시진 드롭다운 필드
  select: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.sm, paddingVertical: space(3.25), paddingHorizontal: space(3.5), ...shadow.soft,
  },
  selectText: { fontSize: 15, color: colors.ink },
  selectPlaceholder: { color: colors.inkFaint },
  selectChevron: { fontSize: 14, color: colors.inkSoft, marginLeft: space(2) },
  // 바텀시트
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: space(5), paddingTop: space(2.5), paddingBottom: space(6), maxHeight: '72%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: space(3) },
  sheetTitle: { ...font.heading, marginBottom: space(2) },
  sheetList: { flexGrow: 0 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: space(3.5),
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  optionRowOn: { },
  optionGz: { fontSize: 22, fontWeight: '700', color: colors.ink, width: 40 },
  optionGzOn: { color: colors.ju },
  optionText: { flex: 1, fontSize: 15, color: colors.inkSoft },
  optionTextOn: { color: colors.ink, fontWeight: '600' },
  optionCheck: { fontSize: 18, color: colors.ju, fontWeight: '700' },
  // 관계 칩
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(1) },
  chip: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.pill, paddingVertical: space(2), paddingHorizontal: space(3.5),
  },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipText: { color: colors.inkSoft, fontSize: 14 },
  chipOnText: { color: colors.bg, fontSize: 14, fontWeight: '700' },
  // 세그먼트
  segment: { flexDirection: 'row', gap: space(2), marginTop: space(1) },
  segItem: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.sm, paddingVertical: space(3), alignItems: 'center',
  },
  segOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  segText: { color: colors.inkSoft, fontSize: 15 },
  segOnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  // 대표 설정 체크
  repCheck: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(5) },
  repBox: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  repBoxOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  repChk: { color: colors.bg, fontSize: 14, fontWeight: '800' },
  repLabel: { ...font.body, color: colors.ink },
  // 내 상황(context) 입력 박스
  ctxBox: { marginTop: space(5), padding: space(4), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, ...shadow.soft },
  ctxTitle: { ...font.heading, fontSize: 15 },
  ctxDesc: { ...font.body, fontSize: 12, color: colors.inkSoft, marginTop: space(1), marginBottom: space(1) },
  ctxLabel: { ...font.label, marginTop: space(3.5), marginBottom: space(1) },
  inputMulti: { minHeight: 60, textAlignVertical: 'top', paddingTop: space(2.5) },
  // 제출 CTA (주색)
  submit: {
    backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4),
    alignItems: 'center', marginTop: space(8), ...shadow.card,
  },
  submitText: { color: colors.bg, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});
