// src/app/(app)/reunion.tsx — 콘텐츠 '재회'(옛 인연과 다시 이어짐, 사주만, 유료/쿠폰)
// ─────────────────────────────────────────────────────────────────────────
// daniel 스탠스: 재회 연락 좋은 시기 = 도화(왕지 子午卯酉) 충 시점(특히 월운). 어느 '달'에 재회
//   연락 기회가 열리는지 콕 집는다. 보조=배우자궁(일지) 형충회합 개폐.
//
// ▶ funnel(무료 훅 → 유료 깊이): 히어로 아래에 무료 온디바이스 <ReunionTiming>(도화-충 '재회가
//   열리는 달' 달력)을 항상 보여주고(freeHook), 그 아래 유료 LLM 깊은 풀이(가능성·상대 마음·재회
//   후 흐름·개운법)로 전환 유도. love.tsx가 <LoveFlowGraph>를 히어로 아래 두는 배치를 공용화한 것.
//
// ▶ ★상대(옛 인연) 명식 = '1회 등록 후 잠금' 모델(daniel 07-05) ─────────────────────────
//   · 옛 연인은 *한 명만* 등록한다. 한번 등록하면 그 명식으로 고정(읽기전용) — 수정/지우기 없음.
//     바꾸려면 '새로 풀기'(비프리미엄=이용권 재구매 / 프리미엄=확인). = 궁합처럼 매번 새 상대를 넣는 게 아님.
//   · 잠긴 상대는 이 기기에 대표 명식(serverChartId)별로 영속 저장(lib/content/reunionOther) → 재진입·명식 전환에도 유지.
//   · 상대를 등록/변경하면 그 상대로 *실제 재생성*한다(regenToken → SpecialContentScreen):
//       - 이미 '본인만' 풀이가 캐시돼 있어도(특히 프리미엄) refresh 로 덮어써, 상대를 반영한 풀이로 바꾼다.
//         (이전 버그: 프리미엄이 캐시된 본인만 풀이를 '풀이 보기'로 그대로 봐서, 상대를 더해도 아무 변화가 없던 문제 해소.)
//       - 캐시가 없으면(첫 생성) 정식 확인·결제 게이트(onStart) 경유 — 상대는 buildBody(otherSaju)로 포함된다.
//   · 고민(선택) = 자유 텍스트 → context.concern 으로 전달(그대로 편집 가능 — daniel 규칙은 '상대'에 한함).
//   · 상대 없이 비워 두면 현행 그대로(본인 도화 timing) = 하위호환.
//   폼을 먼저 채우도록 autoGen={false}. keepHeaderExtra 로 잠긴 상대 표시·'상대 바꾸기'를 풀이 보면서도 접근.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // 상대 등록 모달 헤더가 노치/상태바에 가리지 않게(compat J와 동일)
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { ReunionTiming } from '../../components/ReunionTiming';
import { PressableScale } from '../../components/PressableScale';
import { ChartRegisterScreen } from '../../screens/ChartRegisterScreen'; // 상대 명식 = 궁합과 동일한 정식 등록 폼(기존 틀 동일)
import { Alert } from '../../lib/ui/alert'; // 커스텀 알림(앱 디자인) — 바꾸기 확인/결제 유도
import { useAuth } from '../../lib/useAuth'; // 결제 게이트 로그인 확인(session)
import { computeChart } from '../../lib/engine/engine';
import type { SavedChart } from '../../lib/engine/myChart';
import { loadReunionOther, saveReunionOther, clearReunionOther } from '../../lib/content/reunionOther'; // 상대 잠금 로컬 영속(대표 명식별)
import { isPremiumForChart } from '../../lib/billing/premiumStore';   // 명식별 프리미엄(무제한 = 바꾸기 무료)
import { loadCredits, waitForCreditGrant } from '../../lib/billing/coupons'; // 보유 이용권 확인 · 결제 후 웹훅 적립 대기
import { purchaseCreditRC, purchasesEnabled } from '../../lib/billing/purchases'; // 재구매(바로 결제)
import { requireLoginForPurchase } from '../../lib/billing/requireLogin'; // 결제 전 로그인 게이트
import { colors, radius, space, font, shadow } from '../../lib/theme';

export default function ReunionRoute() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [serverChartId, setServerChartId] = useState<string | null>(null); // SpecialContentScreen 이 해석한 대표 명식 서버ID(상대 잠금 키)
  const [otherInput, setOtherInput] = useState<any | null>(null); // 상대(옛 인연) 명식 입력값(ChartInput). 등록되면 잠금(읽기전용).
  const [otherReg, setOtherReg] = useState(false);                // 상대 등록/재등록 폼 모달 표시
  const [concern, setConcern] = useState('');                     // 고민(자유 텍스트, 선택 — 그대로 편집 가능)
  const [regenTok, setRegenTok] = useState(0);                    // 상대 등록/변경 → SpecialContentScreen 재생성 트리거

  // 대표 명식(serverChartId) 확정/전환 시 → 이 명식에 잠긴 상대를 로드(없으면 미등록 상태). 명식 전환에도 각자 유지.
  useEffect(() => {
    if (!serverChartId) { setOtherInput(null); return; } // 미로그인·미해석 = 상대 없음
    let alive = true;
    loadReunionOther(serverChartId).then((v) => { if (alive) setOtherInput(v); });
    return () => { alive = false; };
  }, [serverChartId]);

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

  // 상대 명식 등록 폼 제출(첫 등록 또는 바꾸기 후 재등록) → 잠금(otherInput) + 이 명식 전용 로컬 저장 + 재생성 트리거.
  //   computeChart 는 위 useMemo. serverChartId 있어야 저장/재생성(미로그인 등이면 화면이 게이트로 유도).
  function onRegisterOther(input: any) {
    setOtherInput(input); // 잠금(읽기전용) 표시
    setOtherReg(false);   // 모달 닫기
    if (serverChartId) {
      void saveReunionOther(serverChartId, input); // 잠금 저장(대표 명식별)
      setRegenTok((n) => n + 1);                   // ★그 상대로 재생성(SpecialContentScreen: 캐시 있으면 refresh 덮어쓰기 / 없으면 onStart)
    }
  }

  // 잠금 해제 + 재등록 모달 열기(‘바꾸기 = 새로 풀기’ 확정 시에만) — 저장분 제거 → 빈 폼으로 상대 새로 입력.
  function openChangeRegister() {
    setOtherInput(null);
    if (serverChartId) void clearReunionOther(serverChartId);
    setOtherReg(true);
  }

  // 상대 바꾸기(= 새로 풀기). daniel 07-05: 한번 등록하면 못 바꾸고, 바꾸려면 새로 구매/재생성.
  //   · 프리미엄(이 명식) = 무제한 → 확인만 받고 잠금 해제·재등록(등록 시 refresh 재생성=무료).
  //   · 비프리미엄 = 이용권 1(재구매). 보유분 있으면 그걸로(이중구매 방지), 없으면 결제 후 잠금 해제.
  //   기존 틀 재사용: requireLoginForPurchase / purchaseCreditRC / waitForCreditGrant(SpecialContentScreen 게이트와 동일).
  function onChangeOther() {
    if (!serverChartId) return;
    // 프리미엄 = 무제한: 확인만.
    if (isPremiumForChart(serverChartId)) {
      Alert.alert(t('reunion.title', '재회운'), t('reunion.changeConfirmPremium', '상대를 바꾸면 그 사람으로 새로 풀어요. 바꾸시겠어요?'), [
        { text: t('common.cancel', '취소'), style: 'cancel' },
        { text: t('reunion.changeGo', '바꾸기'), onPress: openChangeRegister },
      ]);
      return;
    }
    // 비프리미엄 = 결제 게이트(로그인 필수 — 결제는 계정 귀속).
    if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
    void (async () => {
      // 보유 이용권 있으면 재구매 없이 그걸로(재생성 시 Edge 가 차감) — 이중구매 방지.
      const credits = await loadCredits();
      if ((credits['reunion'] ?? 0) >= 1) {
        Alert.alert(t('reunion.title', '재회운'), t('reunion.changeConfirmCredit', '가진 재회운 이용권 1개로 상대를 바꿔 새로 풀어요. 바꾸시겠어요?'), [
          { text: t('common.cancel', '취소'), style: 'cancel' },
          { text: t('reunion.changeGo', '바꾸기'), onPress: openChangeRegister },
        ]);
        return;
      }
      // 이용권 없음 → 구매(영수증 검증 웹훅 적립 대기) 후 잠금 해제·재등록.
      Alert.alert(t('reunion.title', '재회운'), t('reunion.changeConfirmBuy', '상대를 바꾸려면 새로 풀어야 하고, 재회운 이용권이 필요해요. 구매하고 바꿀까요?'), [
        { text: t('common.cancel', '취소'), style: 'cancel' },
        { text: t('reunion.changeBuy', '구매하고 바꾸기'), onPress: async () => {
            if (!purchasesEnabled()) { Alert.alert(t('reunion.title', '재회운'), t('market.payPending', '결제 준비 중이에요. 쿠폰을 이용하거나 잠시 후 다시 시도해 주세요.')); return; }
            try {
              const ok = await purchaseCreditRC('reunion'); if (!ok) return; // 결제 취소=false(조용히)
              const { granted } = await waitForCreditGrant('reunion');       // 웹훅 적립 반영 폴링(C1)
              if (granted) openChangeRegister();
              else Alert.alert(t('reunion.title', '재회운'), t('special.applyPending', '결제가 완료됐어요. 적용까지 잠시 걸릴 수 있어요. 잠시 후 다시 시도해 주세요.'));
            } catch (e) { Alert.alert('!', (e as Error).message); }
          } },
      ]);
    })();
  }

  // 잠긴 상대 표시용 이름/생일 — 이름(label) 있으면 이름, 생일·성별은 부가.
  const otherName = String(otherInput?.label ?? '').trim();
  const otherBirth = String(otherInput?.birthDateTime ?? '').split(' ')[0];
  const otherSex = otherInput?.sex ?? '';

  // 히어로 아래·게이트 위 커스텀 폼 — 상대(잠금) + 고민. keepHeaderExtra 로 풀이 공개 후에도 계속 노출.
  const headerExtra = (
    <View style={styles.formBox}>
      <Text style={styles.formTitle}>{t('reunion.addTitle', '함께 풀어드려요 (선택)')}</Text>
      <Text style={styles.formDesc}>{t('reunion.addDesc', '옛 인연의 명식과 지금의 고민을 더하면, 두 사람의 사주를 함께 보고 고민에 맞춰 풀어드려요. 비워 두면 나의 흐름만으로 봐요.')}</Text>

      {/* (a) 상대(옛 인연) 명식 — 궁합과 동일한 등록 폼(모달). 한번 등록하면 잠금(읽기전용). */}
      <Text style={styles.fieldLabel}>{t('reunion.otherLabel', '옛 인연의 명식')}</Text>
      {otherInput ? (
        // ★잠금 상태(daniel 07-05): 수정/지우기 버튼 없음. 바꾸려면 '상대 바꾸기(새로 풀기)'.
        <View style={styles.lockedBox}>
          <View style={styles.lockedTop}>
            <Text style={styles.lockedName} numberOfLines={1}>{otherName || t('reunion.otherAnon', '옛 인연')}</Text>
            <Text style={styles.lockedLock}>🔒</Text>
          </View>
          {(otherBirth || otherSex) ? <Text style={styles.lockedBirth}>{[otherBirth, otherSex].filter(Boolean).join(' · ')}</Text> : null}
          <Text style={styles.lockedNote}>{t('reunion.otherLockedNote', '상대를 바꾸려면 새로 풀어야 해요.')}</Text>
          <PressableScale style={styles.changeBtn} onPress={onChangeOther}>
            <Text style={styles.changeBtnTx}>{t('reunion.otherChange', '상대 바꾸기(새로 풀기)')}</Text>
          </PressableScale>
        </View>
      ) : (
        <>
          {/* ★넛지(daniel 07-05 A안): 상대 없이 '본인만' 먼저 뽑으면, 나중에 상대 추가 시 재생성 = 이용권이 한 번 더
              든다. 성급히 본인만 뽑지 않도록 지금 넣기를 부드럽게 권한다(프리미엄은 재차감 없이 재생성). */}
          <View style={styles.nudge}>
            <Text style={styles.nudgeTx}>💡 옛 인연을 <Text style={styles.nudgeStrong}>지금</Text> 넣으면 두 사람 사주를 함께 봐요. 나중에 넣으면 다시 풀어야 해요.</Text>
          </View>
          <PressableScale style={styles.addBtn} onPress={() => setOtherReg(true)}>
            <Text style={styles.addBtnTx}>＋ {t('reunion.otherAdd', '옛 인연 생년월일 입력')}</Text>
          </PressableScale>
        </>
      )}
      {/* 동의·프라이버시(규칙8) — 상대 정보는 이 재회 풀이에만, 바꾸기 전까지 이 기기에만 잠금 보관(명식 목록엔 안 남음) */}
      <Text style={styles.privacy}>{t('reunion.otherPrivacy2', '※ 상대 정보는 이 재회 풀이에만 쓰여요. 바꾸기 전까지 이 기기에만 잠겨 보관되고, 명식 목록엔 남지 않아요. 동의를 얻은 경우에만 입력해 주세요.')}</Text>

      {/* (b) 고민 — 선택. 자유 텍스트(그대로 편집 가능) */}
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
        autoGen={false}          // ★폼을 먼저 채우게 — 자동 생성 안 함. '풀이 보기'/상대 등록으로 생성(buildBody 병합).
        buildBody={buildBody}    // 상대 명식(otherSaju/otherZiwei) + 고민(context)을 body 에 병합
        headerExtra={headerExtra} // 히어로 아래 상대(잠금)·고민 입력 폼
        keepHeaderExtra          // ★풀이 공개 후에도 잠긴 상대·'상대 바꾸기'를 계속 노출(daniel 07-05)
        onChartResolved={setServerChartId} // 대표 명식 서버ID → 상대 잠금 로드/저장 키
        regenToken={regenTok}    // 상대 등록/변경 시 그 상대로 재생성
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
  // 상대 명식 추가 버튼(점선, 미등록 시)
  addBtn: { padding: space(3.25), borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, borderStyle: 'dashed', alignItems: 'center', backgroundColor: colors.sunk },
  addBtnTx: { color: colors.ju, fontSize: 14, fontWeight: '800' },
  // ★넛지(상대 지금 넣기 권유) — 연한 골드 콜아웃(daniel 07-05 A안). 성급히 본인만 뽑아 재차감되는 것 방지.
  nudge: { backgroundColor: colors.juSoft, borderRadius: radius.md, paddingVertical: space(2.5), paddingHorizontal: space(3.5), marginBottom: space(2.5) },
  nudgeTx: { ...font.caption, color: colors.inkSoft, lineHeight: 18, fontSize: 12.5 },
  nudgeStrong: { color: colors.ju, fontWeight: '900' },
  // 잠긴 상대(읽기전용) 박스 — 이름/생일 + 안내 + '상대 바꾸기'
  lockedBox: { backgroundColor: colors.sunk, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, paddingVertical: space(3), paddingHorizontal: space(3.5) },
  lockedTop: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  lockedName: { flex: 1, ...font.body, color: colors.ink, fontWeight: '800', fontSize: 15 },
  lockedLock: { fontSize: 13 },
  lockedBirth: { ...font.caption, color: colors.inkSoft, fontSize: 12, marginTop: space(0.5) },
  lockedNote: { ...font.caption, color: colors.inkFaint, fontSize: 11, lineHeight: 16, marginTop: space(2) },
  changeBtn: { marginTop: space(3), alignSelf: 'flex-start', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.ju, paddingVertical: space(2), paddingHorizontal: space(3.5) },
  changeBtnTx: { color: colors.ju, fontSize: 13, fontWeight: '800' },
  privacy: { ...font.caption, color: colors.inkFaint, fontSize: 11, lineHeight: 16, marginTop: space(2) },
  // 고민 입력(멀티라인)
  concernInput: { ...font.body, minHeight: 70, textAlignVertical: 'top', backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: space(3.5), paddingTop: space(3), paddingBottom: space(3), color: colors.ink, fontSize: 15 },
  // 상대 등록 모달(compat 와 동일 골격)
  modalRoot: { flex: 1, backgroundColor: colors.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(5), paddingBottom: space(3), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  modalClose: { fontSize: 22, color: colors.inkSoft, fontWeight: '700' },
});
