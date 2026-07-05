// src/app/(app)/reunion.tsx — 콘텐츠 '재회'(옛 인연과 다시 이어짐, 사주만, 유료/쿠폰)
// ─────────────────────────────────────────────────────────────────────────
// daniel 스탠스: 재회 연락 좋은 시기 = 도화(왕지 子午卯酉) 충 시점(특히 월운). 어느 '달'에 재회
//   연락 기회가 열리는지 콕 집는다. 보조=배우자궁(일지) 형충회합 개폐.
//
// ▶ funnel(무료 훅 → 유료 깊이): 히어로 아래에 무료 온디바이스 <ReunionTiming>(도화-충 '재회가
//   열리는 달' 달력)을 항상 보여주고(freeHook), 그 아래 유료 LLM 깊은 풀이(가능성·상대 마음·재회
//   후 흐름·개운법)로 전환 유도. love.tsx가 <LoveFlowGraph>를 히어로 아래 두는 배치를 공용화한 것.
//   (freeHook = SpecialContentScreen이 내부 대표 명식의 saju를 넘겨줌 → 명식 전환에도 자동 동기화.)
//
// ▶ ★상대 명식·고민 통합(daniel 07-05): 유료 재회에 옛 인연의 명식과 지금의 고민을 *선택적으로* 더할 수 있다.
//   · 상대 명식(선택) = 궁합과 동일한 등록 폼(ChartRegisterScreen)으로 입력 → computeChart로 otherSaju/otherZiwei 산출
//     (저장하지 않음 — 이 풀이에만). 있으면 Edge가 '두 명식 교차 재회 신호'까지 통합해 풀어준다.
//   · 고민(선택) = 자유 텍스트 → context.concern 으로 전달(contextBlock grounding + 프롬프트가 전 섹션에 조준).
//   · 둘 다 비우면 현행 그대로(본인 도화 timing) = 하위호환.
//   폼을 먼저 채우도록 autoGen={false}(자동 생성 안 함) — 사용자가 '풀이 보기'로 생성 시 buildBody가 body에 병합.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // 상대 등록 모달 헤더가 노치/상태바에 가리지 않게(compat J와 동일)
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { ReunionTiming } from '../../components/ReunionTiming';
import { PressableScale } from '../../components/PressableScale';
import { ChartRegisterScreen } from '../../screens/ChartRegisterScreen'; // 상대 명식 = 궁합과 동일한 정식 등록 폼(기존 틀 동일)
import { computeChart } from '../../lib/engine/engine';
import type { SavedChart } from '../../lib/engine/myChart';
import { colors, radius, space, font, shadow } from '../../lib/theme';

export default function ReunionRoute() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [otherInput, setOtherInput] = useState<any | null>(null); // 상대(옛 인연) 명식 입력값(ChartInput). ★저장 안 함 — 이 풀이 전용(개인 명식 목록에 남기지 않음).
  const [otherReg, setOtherReg] = useState(false);                // 상대 명식 등록 폼 모달 표시
  const [concern, setConcern] = useState('');                     // 고민(자유 텍스트, 선택)

  // 상대 명식(있으면) 결정론 산출 → Edge body 조각. computeChart는 순수·메모라 입력 바뀔 때만 재계산.
  //   timeUnknown은 코드베이스 관례대로 병합(computeChart 산출물엔 없음) → 시각 미상 시 상대 시주도 도화 탐지에서 제외.
  const otherBody = useMemo(() => {
    if (!otherInput) return null;
    try {
      const cc = computeChart(otherInput);
      return {
        otherSaju: { ...cc.saju, timeUnknown: otherInput.timeAccuracy === '미상' },
        otherZiwei: cc.ziwei,
      };
    } catch { return null; }
  }, [otherInput]);

  // Edge body 확장 — SpecialContentScreen.generate 가 이 결과를 body 에 병합해 interpret 로 전송.
  //   otherSaju/otherZiwei = 상대 차트(compat·child_couple 과 동일 키) / context = 본인 명식 기본정보 + 고민(concern).
  //   상대·고민 둘 다 없으면 {} 반환(빈 context 제외) → 본인만(현행 도화 timing) 그대로.
  const buildBody = useCallback((chart: SavedChart) => {
    const body: Record<string, any> = {};
    if (otherBody) Object.assign(body, otherBody);
    const base = (chart.context && typeof chart.context === 'object') ? chart.context : {};
    const c = concern.trim();
    const ctx = c ? { ...base, concern: c } : base; // 고민 입력 시 concern 채움(기존 명식 관계상태 등은 유지 — R25 grounding)
    if (ctx && Object.keys(ctx).length) body.context = ctx;
    return body;
  }, [otherBody, concern]);

  // 상대 명식 등록 폼 제출 → 저장 없이 상태만 보관(이 풀이 전용). computeChart 는 위 useMemo 에서.
  function onRegisterOther(input: any) { setOtherInput(input); setOtherReg(false); }

  // 상대 칩 라벨 — 이름(label) 있으면 이름, 없으면 생일·성별.
  const otherLabel = otherInput
    ? (String(otherInput.label ?? '').trim() || `${String(otherInput.birthDateTime ?? '').split(' ')[0]} · ${otherInput.sex ?? ''}`)
    : '';

  // 히어로 아래·게이트 위 커스텀 폼(옵션) — 상대 명식 + 고민(둘 다 선택). SpecialContentScreen 이 풀이 공개 전까지 노출.
  const headerExtra = (
    <View style={styles.formBox}>
      <Text style={styles.formTitle}>{t('reunion.addTitle', '함께 풀어드려요 (선택)')}</Text>
      <Text style={styles.formDesc}>{t('reunion.addDesc', '옛 인연의 명식과 지금의 고민을 더하면, 두 사람의 사주를 함께 보고 고민에 맞춰 풀어드려요. 비워 두면 나의 흐름만으로 봐요.')}</Text>

      {/* (a) 상대(옛 인연) 명식 — 선택. 궁합과 동일한 등록 폼(모달) 재사용 */}
      <Text style={styles.fieldLabel}>{t('reunion.otherLabel', '옛 인연의 명식')}</Text>
      {otherInput ? (
        <View style={styles.otherRow}>
          <Text style={styles.otherChip} numberOfLines={1}>{otherLabel}</Text>
          <PressableScale hitSlop={8} onPress={() => setOtherReg(true)}><Text style={styles.otherAction}>{t('common.edit', '수정')}</Text></PressableScale>
          <PressableScale hitSlop={8} onPress={() => setOtherInput(null)}><Text style={styles.otherActionDim}>{t('reunion.otherClear', '지우기')}</Text></PressableScale>
        </View>
      ) : (
        <PressableScale style={styles.addBtn} onPress={() => setOtherReg(true)}>
          <Text style={styles.addBtnTx}>＋ {t('reunion.otherAdd', '옛 인연 생년월일 입력')}</Text>
        </PressableScale>
      )}
      {/* 동의·프라이버시(규칙8) — 상대 정보는 이 풀이에만, 저장 안 함 */}
      <Text style={styles.privacy}>{t('reunion.otherPrivacy', '※ 상대 정보는 이 풀이에만 쓰이고 따로 저장되지 않아요. 동의를 얻은 경우에만 입력해 주세요.')}</Text>

      {/* (b) 고민 — 선택. 자유 텍스트 */}
      <Text style={styles.fieldLabel}>{t('reunion.concernLabel', '지금의 고민')}</Text>
      <TextInput
        style={styles.concernInput}
        value={concern}
        onChangeText={setConcern}
        multiline
        maxLength={300}
        placeholder={t('reunion.concernPh', '지금 어떤 상황·고민인지 적어주시면 함께 풀어드려요')}
        placeholderTextColor={colors.inkFaint}
      />
    </View>
  );

  return (
    <>
      {/* 유료 단일 풀이 → 생성일+1년 '보유 만료일' 표시(daniel #25). 개별 구매(프리미엄 미포함). */}
      <SpecialContentScreen
        kind="reunion"
        showExpiry
        autoGen={false}          // ★폼을 먼저 채우게 — 자동 생성 안 함. '풀이 보기'로 생성(buildBody 병합).
        buildBody={buildBody}    // 상대 명식(otherSaju/otherZiwei) + 고민(context)을 body 에 병합
        headerExtra={headerExtra} // 히어로 아래 상대·고민 입력 폼(공개 전까지 노출)
        themeColor={colors.ju}
        heroImage={require('../../../assets/icons/reunion.jpg')}
        // ★무료 온디바이스 훅 — 도화-충 '재회가 열리는 달' 달력(히어로 아래·항상 노출). 깊은 통변은 이 아래 유료.
        freeHook={(saju) => <ReunionTiming saju={saju} />}
        title={t('reunion.title', '재회운')}
        sub={t('reunion.sub', '옛 인연과 다시 이어질 가능성과, 연락이 닿기 좋은 시기를 짚어 드려요')}
        genMsg={t('reunion.generating', '다시 이어질 인연의 흐름을 읽는 중…')}
        sections={[
          { key: 'possibility', label: t('reunion.possibility', '다시 이어질 인연인지') },
          { key: 'timing', label: t('reunion.timing', '연락이 닿기 좋은 시기') },
          { key: 'theirResponse', label: t('reunion.theirResponse', '그때 상대의 마음') },
          { key: 'afterReunion', label: t('reunion.afterReunion', '다시 만난다면') },
          { key: 'caution', label: t('reunion.caution', '되돌아보면 좋은 점') },
          { key: 'remedy', label: t('reunion.remedy', '재회를 여는 법') },
        ]}
      />

      {/* 상대 명식 등록 — 궁합과 동일한 정식 등록 폼(모달). 저장 없이 입력값만 상태로(onRegisterOther). */}
      <Modal visible={otherReg} animationType="slide" onRequestClose={() => setOtherReg(false)}>
        <View style={styles.modalRoot}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + space(3) }]}>
            <Text style={styles.modalTitle}>{t('reunion.registerOtherTitle', '옛 인연 명식 입력')}</Text>
            <PressableScale onPress={() => setOtherReg(false)} hitSlop={10}><Text style={styles.modalClose}>✕</Text></PressableScale>
          </View>
          <ChartRegisterScreen
            defaultRelation="연인"
            submitLabel={t('reunion.registerOtherSubmit', '이 명식으로 함께 풀기')}
            showMakeRep={false}
            initial={otherInput ?? undefined}
            onSubmit={onRegisterOther}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // 상대·고민 입력 폼(히어로 아래)
  formBox: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(4), ...shadow.soft },
  formTitle: { ...font.heading, fontSize: 15, color: colors.ink },
  formDesc: { ...font.caption, color: colors.inkSoft, lineHeight: 18, marginTop: space(1), marginBottom: space(2) },
  fieldLabel: { ...font.label, marginTop: space(3), marginBottom: space(1.5) },
  // 상대 명식 추가 버튼(점선) / 선택된 칩 행
  addBtn: { padding: space(3.25), borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, borderStyle: 'dashed', alignItems: 'center', backgroundColor: colors.sunk },
  addBtnTx: { color: colors.ju, fontSize: 14, fontWeight: '800' },
  otherRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), backgroundColor: colors.sunk, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, paddingVertical: space(2.5), paddingHorizontal: space(3.5) },
  otherChip: { flex: 1, ...font.body, color: colors.ink, fontWeight: '700', fontSize: 14 },
  otherAction: { color: colors.ju, fontSize: 13, fontWeight: '800' },
  otherActionDim: { color: colors.inkFaint, fontSize: 13, fontWeight: '700' },
  privacy: { ...font.caption, color: colors.inkFaint, fontSize: 11, lineHeight: 16, marginTop: space(2) },
  // 고민 입력(멀티라인)
  concernInput: { ...font.body, minHeight: 70, textAlignVertical: 'top', backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: space(3.5), paddingTop: space(3), paddingBottom: space(3), color: colors.ink, fontSize: 15 },
  // 상대 등록 모달(compat 와 동일 골격)
  modalRoot: { flex: 1, backgroundColor: colors.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(5), paddingBottom: space(3), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  modalClose: { fontSize: 22, color: colors.inkSoft, fontWeight: '700' },
});
