// src/app/(app)/child.tsx — 콘텐츠 '자식운'(원국으로 보는 자녀 인연·기질·부모로서의 나, 프리미엄 포함)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-02: 프리미엄 5번째 콘텐츠 — 프리미엄 명식이면 무료(자동생성), 비프리미엄은 개별 유료.
//   ★COUPLE 모드(daniel 07-02): 상단 토글 '나 혼자 보기' / '배우자와 함께'.
//     - 나 혼자: 대표 명식 1인만(category='child', buildBody 없음).
//     - 배우자와 함께: 저장된 명식에서 배우자를 골라 두 사람 명식으로 자녀 인연을 교차해 본다.
//         · category='child_couple_<배우자 id 앞 8자>' → 배우자별로 캐시 분리(다른 배우자면 다른 풀이).
//         · buildBody 로 배우자 명식(사주+자미)을 Edge body 의 otherSaju/otherZiwei 로 전달(궁합과 동일 계약).
//       Edge kind='child' 는 body 의 otherSaju/otherZiwei 유무로 buildChildPrompt(me, spouse|null) 를 분기한다.
//   배우자가 없으면(저장된 타 명식 없음) 등록 유도. premiumCovered=true(프리미엄 무료해제·자동생성).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { PressableScale } from '../../components/PressableScale'; // 눌림 피드백(daniel: 모든 tappable)
import { listCharts, type SavedChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { colors, radius, space, font } from '../../lib/theme';

export default function ChildRoute() {
  const { t } = useTranslation();
  const router = useRouter();
  // ── COUPLE 모드 상태 ─────────────────────────────────────────
  const [couple, setCouple] = useState(false);            // false=나 혼자 / true=배우자와 함께
  const [spouse, setSpouse] = useState<SavedChart | null>(null); // 선택된 배우자 명식(부부 모드에서만 사용)
  const [pick, setPick] = useState(false);                // 배우자 선택 모달(바텀시트) 열림
  const [charts, setCharts] = useState<SavedChart[]>([]);  // 저장된 명식 전체(배우자 후보 목록)

  // 저장된 명식 목록 로드(배우자 선택지) — 마운트 1회.
  useEffect(() => { listCharts().then(setCharts).catch(() => {}); }, []);

  // 배우자 후보 = 본인(relation='self') 제외한 저장 명식(대표=본인은 이 화면의 '나'이므로 배우자 후보에서 뺀다).
  const spouseCandidates = charts.filter((c) => c.relation !== 'self');

  // 부부 모드 준비 완료 = 토글 ON + 배우자 선택됨. 이때만 두 사람 교차(그 전엔 혼자로 폴백 = 캐시 분리 안 함).
  const coupleReady = couple && !!spouse;
  // 캐시/Edge category — 부부는 배우자별로 분리('child_couple_'+배우자 id 앞 8자), 혼자는 'child'.
  const category = coupleReady ? 'child_couple_' + spouse!.id.slice(0, 8) : 'child';
  // buildBody — 부부일 때만 배우자 명식(사주+자미)을 Edge body 로 전달(궁합과 동일: otherSaju/otherZiwei).
  //   SpecialContentScreen 이 생성 시 buildBody(내 savedChart) 를 body 에 머지한다(내=me, 여기 반환=상대=배우자).
  const buildBody = coupleReady
    ? (_ch: SavedChart) => { const cc = computeChart(spouse!.input); return { otherSaju: cc.saju, otherZiwei: cc.ziwei }; }
    : undefined;

  // 배우자 선택 → 상태 저장 + 모달 닫기(category 변경 → SpecialContentScreen 재로드/자동생성).
  function chooseSpouse(c: SavedChart) { setSpouse(c); setPick(false); }

  // 상단 커스텀 컨트롤(headerExtra) — 히어로 아래·섹션 위. 잠김/열림 두 상태 모두에서 노출된다.
  const headerExtra = (
    <View style={styles.ctrl}>
      {/* 2옵션 세그먼트 토글: 나 혼자 보기 / 배우자와 함께 (선택=골드, 오늘/내일 토글과 동일 룩) */}
      <View style={styles.seg}>
        {([false, true] as const).map((v) => (
          <PressableScale key={String(v)} style={[styles.segChip, couple === v && styles.segChipOn]} onPress={() => setCouple(v)}>
            <Text style={[styles.segTx, couple === v && styles.segTxOn]}>{t(v ? 'child.couple' : 'child.solo')}</Text>
          </PressableScale>
        ))}
      </View>

      {/* 배우자와 함께 = 배우자 명식 선택 UI(후보 있으면 선택 버튼+안내 / 없으면 등록 유도) */}
      {couple && (spouseCandidates.length === 0 ? (
        <View style={styles.spouseBox}>
          <Text style={styles.spouseHint}>{t('child.needSpouse', '배우자 명식을 먼저 등록해 주세요')}</Text>
          <PressableScale style={styles.registerBtn} onPress={() => router.push('/register')}>
            <Text style={styles.registerTx}>＋ {t('compat.registerMyChart', '명식 등록')}</Text>
          </PressableScale>
        </View>
      ) : (
        <View style={styles.spouseBox}>
          {/* 선택된 배우자(없으면 '배우자 명식 선택' 안내) — 탭하면 선택 모달 */}
          <PressableScale style={styles.spouseBtn} onPress={() => setPick(true)}>
            <Text style={styles.spouseLabel} numberOfLines={1}>{spouse ? spouse.label : t('child.pickSpouse', '배우자 명식 선택')}</Text>
            <Text style={styles.spouseChevron}>▾</Text>
          </PressableScale>
          <Text style={styles.spouseHint}>{t('child.coupleHint', '배우자 명식을 고르면 두 사람 명식으로 자녀 인연을 함께 봅니다')}</Text>
        </View>
      ))}

      {/* 배우자 선택 모달(바텀시트) — 저장 명식 목록(본인 제외). 탭 → 선택+닫기 */}
      <Modal visible={pick} transparent animationType="slide" onRequestClose={() => setPick(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPick(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t('child.pickSpouse', '배우자 명식 선택')}</Text>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {spouseCandidates.map((c) => {
                const on = c.id === spouse?.id;
                return (
                  <PressableScale key={c.id} style={styles.row} onPress={() => chooseSpouse(c)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, on && styles.rowNameOn]} numberOfLines={1}>{c.label}</Text>
                      {/* 생년월일+시(구분용) */}
                      <Text style={styles.rowMeta} numberOfLines={1}>{String(c.input.birthDateTime ?? '').replace('T', ' ').slice(0, 16)}</Text>
                    </View>
                    {on && <Text style={styles.check}>✓</Text>}
                  </PressableScale>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );

  return (
    <SpecialContentScreen
      kind="child"
      premiumCovered
      category={category}      // 혼자='child' / 부부='child_couple_<배우자8자>'(배우자별 캐시 분리)
      buildBody={buildBody}    // 부부일 때만 배우자 명식(otherSaju/otherZiwei) 전달
      headerExtra={headerExtra} // 상단 COUPLE 토글 + 배우자 선택
      themeColor={colors.ju}
      title={t('child.title', '자식운')}
      sub={t('child.sub', '원국으로 보는 자녀 인연·기질·부모로서의 나')}
      genMsg={t('child.gen', '자녀 인연을 살피는 중…')}
      showExpiry
      sections={[
        { key: 'bigPicture', label: t('child.bigPicture', '자녀 인연의 큰 그림') },
        { key: 'childNature', label: t('child.childNature', '자녀의 기질') },
        { key: 'asParent', label: t('child.asParent', '부모로서의 나') },
        // 부부 자녀 인연 — 혼자 모드에선 Edge 가 "" 반환(빈 값 자동 미표시). 배우자와 함께면 채워진다.
        { key: 'coupleCross', label: t('child.coupleCross', '부부 자녀 인연') },
        { key: 'communication', label: t('child.communication', '소통·관계') },
        { key: 'timing', label: t('child.timing', '시기 흐름') },
        { key: 'talent', label: t('child.talent', '자녀의 재능') },
        { key: 'health', label: t('child.health', '건강 관리축') },
        { key: 'remedy', label: t('child.remedy', '개운·처방') },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ctrl: { marginBottom: space(5) }, // 히어로↔섹션 사이 간격(다른 콘텐츠 요소들과 동일 리듬)
  // 세그먼트 토글(나 혼자 / 배우자와 함께) — 오늘/내일 토글과 동일 룩(선택=골드)
  seg: { flexDirection: 'row', gap: space(2), marginBottom: space(3) },
  segChip: { flex: 1, alignItems: 'center', paddingVertical: space(2.5), borderRadius: radius.pill, backgroundColor: colors.overlay, borderWidth: 1, borderColor: colors.line },
  segChipOn: { backgroundColor: colors.ju, borderColor: colors.ju }, // 선택 = 골드
  segTx: { fontSize: 14, fontWeight: '800', color: colors.inkSoft },
  segTxOn: { color: colors.bg }, // 골드 위 글씨(앱 gold 버튼 관례 = colors.bg)
  // 배우자 선택 박스(선택 버튼 + 안내 / 없으면 등록 유도)
  spouseBox: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), gap: space(2) },
  spouseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.juLine, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(4) },
  spouseLabel: { flex: 1, ...font.body, fontWeight: '700', color: colors.ju },
  spouseChevron: { color: colors.ju, fontSize: 14, fontWeight: '800', marginLeft: space(2) },
  spouseHint: { ...font.caption, color: colors.inkSoft, lineHeight: 18 },
  registerBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), alignItems: 'center', marginTop: space(1) },
  registerTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  // 배우자 선택 모달(바텀시트) — ChartPicker 시트와 동일 룩
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: space(5), paddingTop: space(2.5), paddingBottom: space(6), maxHeight: '70%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: space(3) },
  sheetTitle: { ...font.heading, marginBottom: space(2) },
  list: { maxHeight: 360 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(3.5), borderBottomWidth: 1, borderBottomColor: colors.line, gap: space(2) },
  rowName: { ...font.body, fontWeight: '600', color: colors.ink },
  rowNameOn: { color: colors.ju }, // 선택된 배우자 강조
  rowMeta: { ...font.caption, color: colors.inkFaint, marginTop: 1 },
  check: { fontSize: 18, color: colors.ju, fontWeight: '700' },
});
