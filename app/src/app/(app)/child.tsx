// src/app/(app)/child.tsx — 콘텐츠 '자식운'(원국으로 보는 자녀 인연·기질·부모로서의 나, 프리미엄 포함)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-02: 프리미엄 5번째 콘텐츠 — 프리미엄 명식이면 무료(자동생성), 비프리미엄은 개별 유료.
//   ★COUPLE 모드(daniel 07-02): 상단 토글 '나 혼자 보기' / '배우자와 함께'.
//     - 나 혼자: 대표 명식 1인만(category='child', buildBody 없음).
//     - 배우자와 함께: 저장된 명식에서 배우자를 골라 두 사람 명식으로 자녀 인연을 교차해 본다.
//         · category='child_couple_<배우자 id 앞 8자>' → 배우자별로 캐시 분리(다른 배우자면 다른 풀이).
//         · buildBody 로 배우자 명식(사주+자미)을 Edge body 의 otherSaju/otherZiwei 로 전달(궁합과 동일 계약).
//   ★부부 반값 업그레이드(daniel 07-03): 부부는 별도 kind='child_couple'(₩4,950 = 솔로 9900의 반값).
//     솔로(child)를 이미 소유(프리미엄/관리자/구매)한 사람에게만 부부를 반값에 연다 — 별도 kind라 솔로 소유가 부부를 자동 해제하지 않음.
//     솔로 미소유로 부부를 고르면 '먼저 나 혼자로 보세요' 안내(부부 콘텐츠 생성/과금 안 함). 프리미엄/관리자는 무료로 부부 열람.
//       Edge kind='child_couple' 은 body 의 otherSaju/otherZiwei 로 CHILD 프롬프트에 배우자를 교차(라우팅은 Edge 담당).
//   배우자가 없으면(저장된 타 명식 없음) 등록 유도. premiumCovered=true(프리미엄 무료해제·자동생성).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { PressableScale } from '../../components/PressableScale'; // 눌림 피드백(daniel: 모든 tappable)
import { listCharts, loadRepChart, subscribeRepChange, type SavedChart } from '../../lib/engine/myChart';
import { computeChart } from '../../lib/engine/engine';
import { ensureServerChartId } from '../../lib/backend/prewarmReadings'; // 대표 명식 → 서버차트ID(솔로 소유 판정 캐시 키)
import { useAuth } from '../../lib/useAuth';                             // 세션 — 서버차트ID 해석·소유 판정에 필요
import { useSubscription } from '../../lib/billing/subscription';       // 프리미엄 변경 시 소유 재판정 트리거
import { isPremiumForChart } from '../../lib/billing/premiumStore';     // 명식별 프리미엄 = 부부 무료(soloOwned 인정)
import { isAdmin } from '../../lib/core/admin';                         // 관리자 = 부부 무료(soloOwned 인정)
import { isUnlocked } from '../../lib/billing/unlocks';                 // 솔로(child) unlock 완료 = 부부 반값 업그레이드 자격
import { CREDIT_KINDS } from '../../lib/billing/coupons';               // child_couple 가격(단일 출처) — 안내 문구가 실가와 드리프트하지 않게
import { colors, radius, space, font } from '../../lib/theme';

// 자식운·부부(child_couple) 폴백 가격 라벨 — CREDIT_KINDS(단일 출처)에서. RC가 현지통화 실가를 fetch하지만, 안내 문구는 이 ₩ 폴백을 쓴다.
const COUPLE_PRICE = CREDIT_KINDS.find((c) => c.key === 'child_couple')?.price ?? 4900;
const COUPLE_PRICE_LABEL = `₩${COUPLE_PRICE.toLocaleString()}`;

export default function ChildRoute() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();             // 서버차트ID 해석·솔로 소유 판정에 필요(비로그인=미소유)
  const { isPremium } = useSubscription();   // 프리미엄 변경 시 soloOwned 재판정 트리거(아래 effect deps)
  // ── COUPLE 모드 상태 ─────────────────────────────────────────
  const [couple, setCouple] = useState(false);            // false=나 혼자 / true=배우자와 함께
  const [spouse, setSpouse] = useState<SavedChart | null>(null); // 선택된 배우자 명식(부부 모드에서만 사용)
  const [pick, setPick] = useState(false);                // 배우자 선택 모달(바텀시트) 열림
  const [charts, setCharts] = useState<SavedChart[]>([]);  // 저장된 명식 전체(배우자 후보 목록)
  const [soloOwned, setSoloOwned] = useState(false);      // ★솔로(child) 소유 여부 = 부부 반값 업그레이드 자격(프리미엄/관리자/구매)

  // 저장된 명식 목록 로드(배우자 선택지) — 마운트 1회.
  useEffect(() => { listCharts().then(setCharts).catch(() => {}); }, []);

  // ★솔로(child) 소유 판정 — 대표 명식→서버차트ID 해석 후 (프리미엄 명식 || 관리자 || child unlock).
  //   SpecialContentScreen 의 owned 판정과 동일 규칙 미러. 마운트 + 대표 명식 전환(subscribeRepChange) + 세션/프리미엄 변경 시 재판정.
  //   soloOwned=true 여야 부부(child_couple)를 반값에 연다. 비로그인/명식없음/미소유 = false → '먼저 솔로' 유도.
  useEffect(() => {
    let alive = true;
    const reeval = async () => {
      try {
        const ch = await loadRepChart();
        if (!ch || !session) { if (alive) setSoloOwned(false); return; } // 미로그인/명식없음 = 미소유
        const id = await ensureServerChartId(computeChart(ch.input), ch.input, session, ch); // 대표 서버차트ID(캐시 키)
        if (!alive || !id) { if (alive) setSoloOwned(false); return; }
        // 프리미엄(명식별) OR 관리자 OR 솔로 unlock → 부부 반값 업그레이드 자격(프리미엄/관리자는 부부 무료로도 이어짐)
        const own = isPremiumForChart(id) || (await isAdmin()) || (await isUnlocked(id, 'child'));
        if (alive) setSoloOwned(own);
      } catch { if (alive) setSoloOwned(false); }
    };
    void reeval();
    const unsub = subscribeRepChange(() => { void reeval(); }); // 대표 명식 전환 시 재판정
    return () => { alive = false; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isPremium]);

  // 배우자 후보 = 본인(relation='self') 제외한 저장 명식(대표=본인은 이 화면의 '나'이므로 배우자 후보에서 뺀다).
  const spouseCandidates = charts.filter((c) => c.relation !== 'self');

  // 부부 모드 준비 완료 = 토글 ON + 배우자 선택됨. 이때만 두 사람 교차(그 전엔 혼자로 폴백 = 캐시 분리 안 함).
  const coupleReady = couple && !!spouse;
  // ★자격 게이트: 부부 실제 진행 = coupleReady + 솔로 소유(프리미엄/관리자/구매). 솔로 미소유면 부부 콘텐츠 미표시('먼저 솔로' 유도).
  const coupleActive = coupleReady && soloOwned;     // child_couple 로 게이트·과금·생성
  const coupleNeedsSolo = coupleReady && !soloOwned; // 부부 원하나 솔로 미소유 → 안내 카드(부부 생성/과금 안 함)
  // 캐시/Edge category·kind — 자격 있는 부부만 child_couple(배우자별 분리), 그 외(솔로·자격없음)는 전부 child.
  //   ★별도 kind='child_couple' → SpecialContentScreen 의 isUnlocked/useCredit/interpret 가 전부 child_couple 로 동작(솔로 소유가 부부를 자동 해제하지 않음).
  //   솔로 미소유(coupleNeedsSolo) 동안엔 kind='child'·category='child' 로 두어 부부가 생성/과금되지 않게 하고 솔로 게이트를 노출('먼저 솔로' 유도).
  const kind: 'child' | 'child_couple' = coupleActive ? 'child_couple' : 'child';
  const category = coupleActive ? 'child_couple_' + spouse!.id.slice(0, 8) : 'child';
  // buildBody — 자격 있는 부부일 때만 배우자 명식(사주+자미)을 Edge body 로 전달(궁합과 동일: otherSaju/otherZiwei).
  //   SpecialContentScreen 이 생성 시 buildBody(내 savedChart) 를 body 에 머지한다(내=me, 여기 반환=상대=배우자).
  const buildBody = coupleActive
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

      {/* ★부부 반값 업그레이드 안내(daniel 07-03) — 배우자는 골랐지만 솔로(child) 미소유 → 먼저 솔로를 열어야 부부를 반값(₩4,950)에 볼 수 있음.
          이 동안 화면은 kind='child'(솔로 게이트)라 부부 콘텐츠는 생성/과금되지 않는다. '나 혼자 보기로' 로 토글 복귀. 프리미엄/관리자는 soloOwned=true 라 이 카드가 안 뜬다. */}
      {coupleNeedsSolo && (
        <View style={styles.upsell}>
          <Text style={styles.upsellTx}>{t('child.coupleNeedsSolo', { price: COUPLE_PRICE_LABEL, defaultValue: "먼저 '나 혼자'로 자식운을 보시면, 배우자와 함께(부부)를 {{price}}(반값)에 열 수 있어요" })}</Text>
          <PressableScale style={styles.upsellBtn} onPress={() => setCouple(false)}>
            <Text style={styles.upsellBtnTx}>{t('child.backToSolo', '나 혼자 보기로')}</Text>
          </PressableScale>
        </View>
      )}

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
      kind={kind}              // ★자격 있는 부부='child_couple'(반값·별도 게이트/과금/생성) / 그 외='child'(솔로) — SpecialContentScreen 이 kind 로 isUnlocked·useCredit·interpret 를 분기
      premiumCovered
      autoGen={false}          // ★자동생성 끔 — 프리미엄/관리자도 단일/부부를 고른 뒤 '풀이 보기'로 생성(선택 기회 보장, daniel 07-03)
      category={category}      // 혼자='child' / 부부='child_couple_<배우자8자>'(배우자별 캐시 분리)
      buildBody={buildBody}    // 부부일 때만 배우자 명식(otherSaju/otherZiwei) 전달
      headerExtra={headerExtra} // 상단 COUPLE 토글 + 배우자 선택 + (솔로 미소유 시)부부 반값 안내
      heroImage={require('../../../assets/icons/child.jpg')} // child_couple 은 HERO_BY_KIND 폴백에 없음 → 명시 전달(단일/부부 동일 히어로)
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
  // ★부부 반값 업그레이드 안내 카드(솔로 미소유 시) — '먼저 나 혼자로 보세요' + 토글 복귀 버튼
  upsell: { backgroundColor: colors.sunk, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), gap: space(3), marginTop: space(3) },
  upsellTx: { ...font.body, color: colors.inkSoft, lineHeight: 21 },
  upsellBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), alignItems: 'center' },
  upsellBtnTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
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
