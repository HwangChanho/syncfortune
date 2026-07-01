// app/src/app/(app)/timeResolve.tsx — 시주 역추론(TPR) UX: 시 모르는 사용자가 인생 사건으로 시(時)를 좁힘
// ─────────────────────────────────────────────────────────────────────────
// 기획 time_pillar_reconstruction_spec.md §5~6: 생년월일 + 객관식 사건 입력 → 후보 12개 스코어링
//   → "확정 / 유력 2~3 / 후보 더 필요(inconclusive)"를 정직하게 노출. 사건 많을수록 정확.
//   ⚠️ 스코어링 가중치는 잠정(daniel n=1 캘리브레이션·과적합 가능 — 블라인드 검증 전). 그래서 정직 노출이 기본.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image'; // 상단 히어로 — 자동 다운샘플·디스크캐시(daniel ⑥ 전용 이미지)
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ChartInput } from '@spec/chart';
import { scoreTimePillars, type LifeEvent, type BigEventType } from '../../lib/engine/timePillarScore';
import { BirthPlacePicker } from '../../components/BirthPlacePicker'; // 출생지 = 지역 검색(명식 등록과 동일·Nominatim, daniel #21)
import { stemReading, branchReading } from '../../lib/engine/ohaeng';
import { colors, radius, space, font } from '../../lib/theme';
// ── TPR 결제 게이트(daniel 06-28): 결정론 도구지만 990 1회 결제로 *영구 해제*(재실행·사건 추가 무료) ──
import { Alert } from '../../lib/ui/alert';                         // 커스텀 알림(앱 디자인)
import { useAuth } from '../../lib/useAuth';
import { useSubscription } from '../../lib/billing/subscription';        // 프리미엄=무료
import { isAdmin } from '../../lib/core/admin';                       // 관리자=무료
import { useCredit, grantCredit } from '../../lib/billing/coupons';      // 서버/로컬 크레딧 차감·적립
import { isUnlocked, markUnlocked } from '../../lib/billing/unlocks';    // 1회 해제 후 영구(재차감 방지)
import { purchaseCreditRC, purchasesEnabled } from '../../lib/billing/purchases'; // 즉시 구매
import { requireLoginForPurchase } from '../../lib/billing/requireLogin';
import { assertOnline } from '../../lib/backend/network';

const EVENT_TYPES: BigEventType[] = ['이사', '이직', '창업', '결혼', '이혼', '투자손실', '질병', '사고'];

// markUnlocked 센티넬 — TPR은 저장 명식이 아니라 *도구 단위*로 해제(차트 무관). 키 = unlock_timeresolve_timeresolve.
const TPR_UNLOCK = 'timeresolve';
const TPR_PRICE_LABEL = '₩990';

export default function TimeResolveScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const [date, setDate] = useState('');                       // 생년월일 'YYYY-MM-DD'
  const [sex, setSex] = useState<'남' | '여'>('남');
  const [place, setPlace] = useState('서울');
  const [placeLon, setPlaceLon] = useState<number | null>(null); // 출생지 경도 — 진태양시 보정으로 시주 정밀(TPR 정확도↑·daniel #21)
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [yr, setYr] = useState('');
  const [ty, setTy] = useState<BigEventType>('이사');
  const [result, setResult] = useState<ReturnType<typeof scoreTimePillars> | null>(null);
  const [unlocked, setUnlocked] = useState(false);            // 해제(프리미엄/구매/관리자) 시 가격 배지·게이트 생략
  const gating = useRef(false);                               // 게이트(모달) 연타 차단

  // 진입 시 해제 여부 판정 — 프리미엄/이전 구매(영구)/관리자면 가격 없이 바로 사용.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (isPremium) { if (alive) setUnlocked(true); return; }
      const u = (await isUnlocked(TPR_UNLOCK, 'timeresolve')) || (await isAdmin());
      if (alive) setUnlocked(u);
    })().catch(() => {});
    return () => { alive = false; };
  }, [isPremium]);

  const addEvent = () => {
    const y = parseInt(yr, 10);
    if (y > 1900 && y < 2100) { setEvents((p) => [...p, { year: y, type: ty }]); setYr(''); }
  };
  const removeEvent = (i: number) => setEvents((p) => p.filter((_, idx) => idx !== i));

  // 생년월일 자동 하이픈(daniel) — 숫자만 입력해도 YYYY-MM-DD 로 변환(붙여넣기·부분입력 안전).
  //   ★이게 없으면 숫자만 입력 시 run()의 정규식(YYYY-MM-DD)이 실패해 '후보 좁히기'가 조용히 안 됨.
  const onDateChange = (s: string) => {
    const d = s.replace(/\D/g, '').slice(0, 8);              // 숫자만 최대 8자리(YYYYMMDD)
    let out = d.slice(0, 4);                                  // 연
    if (d.length > 4) out += '-' + d.slice(4, 6);            // 월
    if (d.length > 6) out += '-' + d.slice(6, 8);            // 일
    setDate(out);
  };

  // 실제 스코어링(게이트 통과 후). 시각은 스코어러가 12후보로 덮어쓰므로 임시값. timeAccuracy 는 무관(시 모름).
  const compute = () => {
    const input: ChartInput = { birthDateTime: `${date} 12:00`, calendar: '양', timeAccuracy: '미상', sex, birthPlace: place, birthLon: placeLon ?? undefined };
    setResult(scoreTimePillars(input, { events }));
  };

  // "후보 좁히기" — 입력 검증 → 게이트(프리미엄/해제/관리자=무료, 그 외 크레딧 차감 or 즉시 구매) → 스코어링.
  //   ★도구 단위 영구 해제: 한 번 결제하면 사건을 추가하며 재실행해도 재차감 없음(markUnlocked 센티넬).
  const run = async () => {
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(date)) { setResult(null); return; } // 날짜 형식 불충분 → 조용히
    if (unlocked) { compute(); return; }                                   // 이미 해제 → 바로
    if (gating.current) return;
    if (!assertOnline(t)) return;                                          // 결제/RPC는 온라인 필요
    gating.current = true;
    try {
      if (isPremium) { setUnlocked(true); compute(); return; }
      if (await isUnlocked(TPR_UNLOCK, 'timeresolve')) { setUnlocked(true); compute(); return; } // 이전 구매(영구)
      if (await isAdmin()) { setUnlocked(true); compute(); return; }
      if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return; // 미로그인 → 로그인 유도
      // 보유 크레딧 차감(쿠폰/선물/이전 구매분) → 영구 해제
      if (await useCredit('timeresolve')) { await markUnlocked(TPR_UNLOCK, 'timeresolve'); setUnlocked(true); compute(); return; }
      // 미보유 → 바로 구매 / 마켓 / 취소
      Alert.alert(t('timeResolve.title', '태어난 시 찾기'), t('special.needPayMsg', '이용권이 필요해요. 바로 구매하거나 마켓에서 받을 수 있어요.'), [
        { text: t('special.buyNow', '바로 구매'), onPress: async () => {
            if (!purchasesEnabled()) { Alert.alert(t('timeResolve.title', '태어난 시 찾기'), t('market.payPending', '결제 준비 중이에요. 쿠폰을 이용하거나 잠시 후 다시 시도해 주세요.')); return; }
            try {
              const ok = await purchaseCreditRC('timeresolve'); if (!ok) return; // 취소=false(조용히)
              await grantCredit('timeresolve');                                  // 구매분 +1(서버/로컬)
              if (await useCredit('timeresolve')) { await markUnlocked(TPR_UNLOCK, 'timeresolve'); setUnlocked(true); compute(); }
            } catch (e) { Alert.alert('!', (e as Error).message); }
          } },
        { text: t('special.goMarket', '마켓에서 보기'), onPress: () => router.push('/market') },
        { text: t('common.cancel', '취소'), style: 'cancel' },
      ]);
    } catch { /* 게이트 실패는 조용히(크래시 방지) */ }
    finally { gating.current = false; }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ headerTitle: '' }} />{/* 상단 타이틀 제거(daniel: 콘텐츠 헤더 타이틀 X) — 히어로·리드가 대신 */}
      {/* 전용 히어로(daniel ⑥) — 천체 시계 모티프. 도구 화면이라 폼을 가리지 않게 컴팩트 높이. */}
      <ExpoImage source={require('../../../assets/icons/timeResolve-hero.jpg')} style={styles.hero} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" transition={150} />
      <Text style={styles.lead}>태어난 시간을 몰라도, 인생 사건으로 시(時)를 좁혀 드려요. 사건을 더 넣을수록 정확해져요.</Text>

      <Text style={styles.label}>생년월일 (양력)</Text>
      <TextInput value={date} onChangeText={onDateChange} keyboardType="number-pad" maxLength={10} placeholder="예: 19940316 (숫자만 입력해도 돼요)" placeholderTextColor={colors.inkFaint} style={styles.input} />

      <Text style={styles.label}>성별</Text>
      <View style={styles.chipRow}>
        {(['남', '여'] as const).map((g) => (
          <Pressable key={g} onPress={() => setSex(g)} style={[styles.chip, sex === g && styles.chipOn]}>
            <Text style={sex === g ? styles.chipTxOn : styles.chipTx}>{g}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>출생지</Text>
      <BirthPlacePicker value={place} onSelect={(p) => { setPlace(p.name); setPlaceLon(p.lon); }} />

      <Text style={styles.label}>인생 사건 (연도 + 유형)</Text>
      <TextInput value={yr} onChangeText={setYr} placeholder="연도 (예: 2023)" placeholderTextColor={colors.inkFaint} keyboardType="number-pad" style={styles.input} />
      {/* 연도 입력과 카테고리 선택 사이 — 다른 label→input 간격(space(2))과 균일하게 */}
      <View style={[styles.chipRow, { marginTop: space(2) }]}>
        {EVENT_TYPES.map((t) => (
          <Pressable key={t} onPress={() => setTy(t)} style={[styles.chip, ty === t && styles.chipOn]}>
            <Text style={ty === t ? styles.chipTxOn : styles.chipTx}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={addEvent} style={styles.addBtn}><Text style={styles.addTx}>+ 사건 추가</Text></Pressable>
      {events.map((e, i) => (
        <Pressable key={`${e.year}-${e.type}-${i}`} onPress={() => removeEvent(i)} style={styles.evItem}>
          <Text style={styles.evTx}>· {e.year}년 · {e.type}</Text><Text style={styles.evDel}>✕</Text>
        </Pressable>
      ))}

      <Pressable onPress={run} style={styles.runBtn}>
        <Text style={styles.runTx}>{unlocked ? '후보 좁히기' : `후보 좁히기 · ${TPR_PRICE_LABEL}`}</Text>
      </Pressable>
      {/* 결제 안내 — 1회 결제로 도구 영구 해제(사건 추가·재실행 무료). 프리미엄/구매 후엔 숨김. */}
      {!unlocked && <Text style={styles.payHint}>한 번 결제하면 사건을 더 넣어가며 계속 좁혀볼 수 있어요.</Text>}

      {result && <ResultView result={result} />}
    </ScrollView>
  );
}

// TPR signal(명리 약어)을 일상어 한 줄로 — daniel: 후보에 '쉬운 이유'를 짧게(어려운 명리용어 금지)
function plainSignal(sig: string): string | null {
  if (sig.startsWith('★') || sig.includes('직격')) return '입력한 인생 사건이 이 시간의 기운과 바로 통해요';
  if (sig.includes('이동충')) return '이사·이동이 잦은 흐름과 잘 맞아요';
  if (sig.includes('몸') || sig.includes('건강')) return '건강·몸의 변화 시기와 들어맞아요';
  if (sig.startsWith('앵커')) return '그 해 겪은 사건의 변동과 맞아떨어져요';
  if (sig.startsWith('조후')) return '계절 기운의 균형이 잘 맞는 시간이에요';
  if (sig.startsWith('합충')) return '글자들이 끌고 부딪히는 모양이 사건과 맞아요';
  return null; // 운성 등 미시 신호는 생략(너무 전문적)
}

function ResultView({ result }: { result: ReturnType<typeof scoreTimePillars> }) {
  const { ranked, verdict } = result;
  const head = verdict.kind === 'confirmed' ? '1순위로 좁혀졌어요'
    : verdict.kind === 'shortlist' ? '유력 후보 2~3개로 좁혔어요'
      : '아직 확정이 어려워요 — 사건을 더 넣어 주세요';
  const show = verdict.kind === 'confirmed' ? 1 : verdict.kind === 'shortlist' ? 3 : 5;
  return (
    <View style={styles.result}>
      <Text style={styles.resultH}>{head}</Text>
      {ranked.slice(0, show).map((c, i) => {
        // 시각 구간(hourRange) + 쉬운 이유(signals→일상어, 중복 제거 후 최대 2개)
        const reasons = Array.from(new Set(c.signals.map(plainSignal).filter(Boolean))).slice(0, 2) as string[];
        return (
          <View key={c.candidate.branch} style={styles.cand}>
            <View style={styles.candHead}>
              <Text style={styles.candKey}>{i + 1}. {branchReading(c.candidate.branch)}시 ({stemReading(c.candidate.stem)}{branchReading(c.candidate.branch)})</Text>
              <Text style={styles.candHour}>{c.candidate.hourRange}</Text>
            </View>
            <View style={styles.candBarRow}>
              <View style={styles.barBg}><View style={[styles.bar, { width: `${Math.max(4, Math.round(c.prob * 100))}%` }]} /></View>
              <Text style={styles.candPct}>{Math.round(c.prob * 100)}%</Text>
            </View>
            {reasons.length > 0 && <Text style={styles.candReason}>{reasons.map((r) => `· ${r}`).join('\n')}</Text>}
          </View>
        );
      })}
      <Text style={styles.disc}>※ 사건이 많을수록 정확해져요. 추정 결과이며, 정확한 풀이는 시를 확정한 뒤 원국 전체로 봅니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(6), paddingBottom: space(12) },
  hero: { width: '100%', height: 140, borderRadius: radius.lg, marginBottom: space(5), backgroundColor: colors.sunk }, // 전용 천체 시계 배너(컴팩트)
  lead: { ...font.caption, color: colors.inkSoft, lineHeight: 20, marginBottom: space(5) },
  label: { fontSize: 13, fontWeight: '800', color: colors.ju, marginTop: space(4), marginBottom: space(2) },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space(3.5), paddingVertical: space(3), color: colors.ink, fontSize: 15 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: { paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { fontSize: 14, color: colors.inkSoft, fontWeight: '700' },
  chipTxOn: { fontSize: 14, color: colors.bg, fontWeight: '800' },
  addBtn: { marginTop: space(3), alignSelf: 'flex-start', paddingHorizontal: space(4), paddingVertical: space(2.5), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.ju },
  addTx: { color: colors.ju, fontWeight: '800', fontSize: 14 },
  evItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space(2) },
  evTx: { color: colors.inkSoft, fontSize: 14 },
  evDel: { color: colors.inkFaint, fontSize: 14, paddingHorizontal: space(2) },
  runBtn: { marginTop: space(6), backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center' },
  runTx: { color: colors.bg, fontWeight: '800', fontSize: 16 },
  payHint: { ...font.caption, color: colors.inkFaint, marginTop: space(2.5), textAlign: 'center', lineHeight: 18 },
  result: { marginTop: space(7), padding: space(5), borderRadius: radius.md, backgroundColor: colors.juSoft, borderWidth: 1, borderColor: colors.ju },
  resultH: { fontSize: 17, fontWeight: '800', color: colors.ju, marginBottom: space(4) },
  cand: { marginBottom: space(4) },
  candHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: space(1.5), gap: space(2) },
  candKey: { fontSize: 14, fontWeight: '700', color: colors.ink, flexShrink: 1 },
  candHour: { fontSize: 12, fontWeight: '700', color: colors.ju },
  candBarRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  barBg: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.sunk, overflow: 'hidden' },
  bar: { height: 10, borderRadius: 5, backgroundColor: colors.ju },
  candPct: { fontSize: 13, fontWeight: '800', color: colors.ju, width: 42, textAlign: 'right' },
  candReason: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5), lineHeight: 17 },
  disc: { ...font.caption, color: colors.inkFaint, marginTop: space(4), lineHeight: 18 },
});
