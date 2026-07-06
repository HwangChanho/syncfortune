// app/src/app/(app)/admin.tsx — 관리자 전용: 유저 목록 + 이용권·프리미엄 선물
// ─────────────────────────────────────────────────────────────────────────
// daniel=관리자(profiles.is_admin — 특정 계정). 별도 웹 없이 앱 내에서 관리.
//   유저 검색·확인 + 특정 유저에게 이용권 선물(grant)·프리미엄 토글. 권한은 서버 RPC(is_caller_admin)가 강제.
//   ⚠️ 이메일=PII — 관리자만 노출(규칙8). 비관리자는 접근 차단(서버 RPC + 아래 allowed 게이트).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { Alert } from '../../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import { useEffect, useState } from 'react';
import { isAdmin, adminListUsers, adminGrantCredit, adminSetPremium, adminUserDetail, adminStats, adminUserUsage, adminUserContentVisits, type AdminUser, type AdminUserDetail, type AdminStats, type AdminUsage, type AdminContentVisit } from '../../lib/core/admin';
import { CREDIT_KINDS, type CreditKind } from '../../lib/billing/coupons';
import { logEvent } from '../../lib/backend/logger'; // DB 로그(app_logs) — 선물/프리미엄 단계 추적
import { colors, radius, space, shadow, font } from '../../lib/theme';
import { useRouter } from 'expo-router'; // 비용분석 화면 이동
import { supabase } from '../../lib/supabase'; // 테스트/관리자 모드 RPC + 프로필 로드
import { setAdTestMode } from '../../lib/core/ads'; // 테스트모드 → 테스트광고 즉시 반영
import { useSubscription } from '../../lib/billing/subscription'; // 관리자모드 토글 후 프리미엄 새로고침

// 초 → 사람이 읽는 시간(평균 사용시간 표시).
const fmtDur = (sec?: number | null) => {
  const s = Math.round(Number(sec ?? 0));
  if (s < 60) return `${s}초`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간 ${m % 60}분`;
};

// 콘텐츠 kind → 한글 라벨(콘텐츠 방문 내역 표시용, daniel 2026-07-06). 앱 홈 menu 라벨(i18n ko menu.*)과 동일 결로 맞춤.
//   ※ 관리자 화면은 한국어 전용(daniel)이라 i18n 대신 로컬 맵 — 미등록 kind 는 raw kind 그대로 노출(신규 콘텐츠 누락이 눈에 띄게).
const KIND_LABEL: Record<string, string> = {
  saju: '사주', ziwei: '자미두수', compat: '궁합', timeline: '인생 타임라인', child: '자식운',
  daily: '오늘의 운세', monthly: '이달의 운세', dayPillar: '일주론', newyear: '신년운세',
  love: '나의 애정흐름', reunion: '재회운', crush: '짝사랑 인연운', job: '취업·이직운',
  lifegraph: '인생 그래프', future10: '10년 뒤 나의 모습', roots: '명식의 뿌리', image: '비치는 나',
  mission: '나의 사명', talent: '나의 타고난 재능', astrology: '별자리·점성술', career: '사업가의 나',
  celeb: '세계 인물 매칭', gaeun: '맞춤 개운법', reunionAsk: '재회 가능할까?(무료)', crushAsk: '그 사람과 이어질까?(무료)',
  jobAsk: '취업 언제 될까?(무료)', taro: '타로', pet: '나의 반려동물', persona: '성격유형',
  impression: '사람들이 보는 나', egen: '에겐 vs 테토', mbti: '사주 MBTI', joseonjob: '조선시대 직업',
  lovestyle: '연애 스타일', bok: '타고난 복', pastlife: '전생 이야기', healing: '나만의 힐링 방법',
  taegil: '택일', country: '내가 살기 좋은 곳', luck: '오늘의 행운', zodiac: '띠·별자리',
  name: '이름풀이', dream: '꿈해몽', numerology: '수비학',
};
// kind → 라벨(미등록이면 raw kind 노출).
const contentLabel = (kind: string) => KIND_LABEL[kind] ?? kind;

export default function AdminRoute() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [giftMsg, setGiftMsg] = useState<string | null>(null); // 지급/프리미엄 결과 inline 표시(확인 모달과 연속 present 크래시 회피)
  const [stats, setStats] = useState<AdminStats | null>(null); // 전체 현황 대시보드(daniel G)
  const [usage, setUsage] = useState<AdminUsage | null>(null); // 선택 유저 앱 사용시간(daniel)
  const [visits, setVisits] = useState<AdminContentVisit[]>([]); // 선택 유저 콘텐츠별 방문 내역(daniel 2026-07-06)
  const [showCharts, setShowCharts] = useState(false); // 등록 명식 목록 접기/펼치기(daniel)
  // ── 관리자 제어(설정에서 이동, daniel 07-01): 비용분석·테스트모드·관리자모드 ──
  const router = useRouter();
  const { refresh } = useSubscription();
  const [testMode, setTestMode] = useState(false); // 통변 mock(API 미호출)
  const [adminMode, setAdminMode] = useState(true); // god ON / 일반계정 OFF

  async function reload() { setUsers(await adminListUsers()); }
  useEffect(() => { isAdmin().then((a) => { setAllowed(a); if (a) { reload(); adminStats().then(setStats); } }); }, []);
  // 유저 선택 시 상세(사용량·명식·이용권) 로드
  useEffect(() => { setDetail(null); setGiftMsg(null); setUsage(null); setVisits([]); setShowCharts(false); if (sel) { adminUserDetail(sel.id).then(setDetail).catch(() => {}); adminUserUsage(sel.id).then(setUsage).catch(() => {}); adminUserContentVisits(sel.id).then(setVisits).catch(() => {}); } }, [sel]);
  // 테스트/관리자 모드 현재값 로드(프로필) — 설정에서 이동(daniel 07-01)
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (data.user) supabase.from('profiles').select('test_mode, admin_mode').eq('id', data.user.id).maybeSingle().then(({ data: p }) => { setTestMode(!!p?.test_mode); setAdminMode(p?.admin_mode !== false); }); }).catch(() => {}); }, []);

  if (allowed === null) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  if (allowed === false && !__DEV__) return <View style={styles.center}><Text style={styles.denied}>관리자만 접근할 수 있어요.</Text></View>;

  const filtered = q ? users.filter((u) => u.email?.toLowerCase().includes(q.toLowerCase())) : users;

  // 이용권 선물(+1) — 지급 전 확인
  function gift(kind: CreditKind, ko: string) {
    if (!sel || busy) return;
    const u = sel;
    Alert.alert('이용권 선물', `${u.email} 에게\n‘${ko}’ 이용권 1장을 지급할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '지급', onPress: async () => {
        setBusy(true); setGiftMsg(null);
        logEvent('admin_gift_tap', { owner: u.id, kind });
        try {
          await adminGrantCredit(u.id, kind);                               // 실패 시 throw → catch 에서 사유 노출
          if (detail) adminUserDetail(u.id).then(setDetail).catch(() => {}); // 보유 +1 갱신(상세 즉시 반영)
          setGiftMsg(`✓ ‘${ko}’ 이용권 1장 지급 완료`);                     // ★결과는 inline(모달 X) — 확인 모달과 연속 present 충돌(크래시) 원천 차단
          logEvent('admin_gift_ok', { owner: u.id, kind });
        } catch (e: any) {
          setGiftMsg(`✗ 지급 실패: ${String(e?.message ?? e)}`);             // 실패 사유(예: check 위반)까지 노출
          logEvent('admin_gift_error', { owner: u.id, kind, message: String(e?.message ?? e) }, 'error');
        } finally { setBusy(false); }
      } },
    ]);
  }
  // 프리미엄 선물/해제 — 적용 전 확인
  function togglePremium() {
    if (!sel || busy) return;
    const u = sel;
    const next = !u.is_premium;
    Alert.alert(next ? '프리미엄 선물' : '프리미엄 해제', `${u.email}\n${next ? '프리미엄을 지급할까요?' : '프리미엄을 해제할까요?'}`, [
      { text: '취소', style: 'cancel' },
      { text: next ? '지급' : '해제', style: next ? 'default' : 'destructive', onPress: async () => {
        setBusy(true); setGiftMsg(null);
        logEvent('admin_premium_tap', { owner: u.id, next });
        try {
          await adminSetPremium(u.id, next);                                 // 실패 시 throw
          setSel({ ...u, is_premium: next }); reload();
          setGiftMsg(next ? '✓ 프리미엄 지급 완료' : '✓ 프리미엄 해제 완료'); // 결과 inline(모달 연속 충돌 회피)
          logEvent('admin_premium_ok', { owner: u.id, next });
        } catch (e: any) {
          setGiftMsg(`✗ ${next ? '프리미엄 지급' : '프리미엄 해제'} 실패: ${String(e?.message ?? e)}`);
          logEvent('admin_premium_error', { owner: u.id, next, message: String(e?.message ?? e) }, 'error');
        } finally { setBusy(false); }
      } },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* ── 관리자 제어(설정에서 이동, daniel 07-01): 비용분석·테스트모드·관리자모드 ── */}
      <PressableScale style={styles.adminLink} onPress={() => router.push('/coststable')}>
        <Text style={styles.adminLinkTx}>📊 비용·수익 분석 (실측)</Text>
      </PressableScale>
      <PressableScale style={[styles.adminLink, testMode && styles.adminLinkOn]} onPress={async () => {
        const next = !testMode;
        try { const { data } = await supabase.rpc('set_my_test_mode', { p_on: next }); if (data === true) { setTestMode(next); setAdTestMode(next); } } catch { /* 무시 */ }
      }}>
        <Text style={styles.adminLinkTx}>테스트 모드 {testMode ? '— 켜짐 (통변 mock·API 미호출)' : '— 꺼짐'}</Text>
      </PressableScale>
      <PressableScale style={[styles.adminLink, adminMode && styles.adminLinkOn]} onPress={async () => {
        const next = !adminMode;
        try { const { data } = await supabase.rpc('set_my_admin_mode', { p_on: next }); if (typeof data === 'boolean') { setAdminMode(data); await refresh(); } } catch { /* 무시 */ }
      }}>
        <Text style={styles.adminLinkTx}>관리자 모드 {adminMode ? '— 켜짐 (프리미엄+전부 unlock)' : '— 꺼짐 (일반계정처럼)'}</Text>
      </PressableScale>
      {/* 전체 현황 대시보드 — API 사용량·추정비용·잔여 이용권·분야별·상위 사용자(daniel G) */}
      {stats && (
        <View style={styles.giftPanel}>
          <Text style={styles.giftHead}>전체 현황</Text>
          <View style={styles.detailBox}>
            <Text style={styles.detailLine}>유저 {stats.total_users}명 · 프리미엄 {stats.premium_users}명</Text>
            <Text style={styles.detailLine}>통변 {stats.total_readings}회 · 추가질문 {stats.total_followups}회</Text>
            <Text style={styles.detailRevenue}>총매출 ₩{(stats.total_revenue ?? 0).toLocaleString()}</Text>
            <Text style={styles.detailLine}>추정 API 비용 ≈ ₩{stats.est_cost.toLocaleString()}</Text>
            <Text style={styles.detailLine}>미사용 이용권 잔여 {stats.credits_remaining}장</Text>
            {stats.by_category.length > 0 && <Text style={styles.detailLine}>분야별: {stats.by_category.map((c) => `${c.category} ${c.n}`).join(' · ')}</Text>}
            {stats.top_users.length > 0 && <Text style={styles.detailLine}>상위 사용자: {stats.top_users.map((u) => `${u.name ?? '?'}(${u.readings})`).join(', ')}</Text>}
          </View>
        </View>
      )}
      <Text style={styles.h}>유저 ({users.length})</Text>
      <TextInput style={styles.search} value={q} onChangeText={setQ} placeholder="이메일 검색" placeholderTextColor={colors.inkFaint} autoCapitalize="none" autoCorrect={false} />
      {filtered.map((u) => {
        const on = sel?.id === u.id;
        return (
          <PressableScale key={u.id} style={[styles.userRow, on && styles.userRowOn]} onPress={() => setSel(u)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.email} numberOfLines={1}>{u.email}</Text>
              <Text style={styles.meta}>{String(u.created_at).split('T')[0]} · 명식 {u.chart_count ?? 0} · 통변 {u.reading_count ?? 0}{(u.paid_total ?? 0) > 0 ? ` · 결제 ₩${u.paid_total.toLocaleString()}` : ''}{u.is_admin ? ' · 관리자' : ''}</Text>
            </View>
            {/* 프리미엄 여부 = 모든 계정에 명확히(daniel 07-06: 비프리미엄은 공백이라 '여부' 안 보임 → 프리미엄/일반 둘 다 pill) */}
            <Text style={[styles.premBadge, !u.is_premium && styles.premBadgeOff]}>{u.is_premium ? '프리미엄' : '일반'}</Text>
          </PressableScale>
        );
      })}

      {sel && (
        <View style={styles.giftPanel}>
          <Text style={styles.giftHead}>{sel.email}</Text>
          {detail && (
            <View style={styles.detailBox}>
              <Text style={styles.detailLine}>통변 {detail.reading_count}회 · 추가질문 {detail.followup_count}회</Text>
              <Text style={styles.detailLine}>원가(실측)는 비용·수익 분석 화면 참고</Text>
              {usage && usage.sessions > 0 ? <Text style={styles.detailLine}>평균 사용 {fmtDur(usage.avg_sec)} · {usage.sessions}세션 · 총 {fmtDur(usage.total_sec)}{usage.last_seen ? ` · 최근 ${String(usage.last_seen).split('T')[0]}` : ''}</Text> : null}
              {/* 결제(RC 웹훅 기록) — 총결제액 + 구매 내역 */}
              <Text style={styles.detailRevenue}>총결제 ₩{(detail.paid_total ?? 0).toLocaleString()}</Text>
              {detail.purchases && detail.purchases.length > 0 ? (
                <>
                  <Text style={styles.detailSub}>구매 내역 ({detail.purchases.length})</Text>
                  {detail.purchases.map((pu, i) => (
                    <Text key={i} style={styles.detailChart}>· {pu.product} ₩{(pu.amount ?? 0).toLocaleString()} · {String(pu.at).split('T')[0]}{pu.type ? ` (${pu.type})` : ''}</Text>
                  ))}
                </>
              ) : <Text style={styles.detailLine}>구매 내역 없음 (웹훅 연동 후 기록)</Text>}
              <PressableScale onPress={() => setShowCharts((s) => !s)}>
                <Text style={[styles.detailLine, { marginTop: space(2), color: colors.ju, fontWeight: '700' }]}>등록 명식 {detail.chart_count}개 {showCharts ? '▾ 접기' : '▸ 펼치기'}</Text>
              </PressableScale>
              {showCharts && detail.charts.map((c, i) => {
                const p = c.saju?.pillars;
                const gz = p ? (['년', '월', '일', '시'] as const).map((k) => (p[k] ? `${p[k].stem}${p[k].branch}` : '')).filter(Boolean).join(' ') : '';
                // birth = 복호화된 ChartInput JSON(생년월일시·달력·성별·출생지). 미저장(기존 명식)·파싱 실패 시 생략.
                let birthLine = '';
                if (c.birth) {
                  try {
                    const b = JSON.parse(c.birth);
                    birthLine = [
                      (b.birthDateTime ?? '').replace('T', ' '),
                      b.calendar === '음' ? '음력' : '양력',
                      b.sex,
                      b.birthPlace,
                      b.timeAccuracy && b.timeAccuracy !== '정확' ? `시각 ${b.timeAccuracy}` : '',
                    ].filter(Boolean).join(' · ');
                  } catch {}
                }
                const nm = c.label ? `${c.label} · ` : '';
                return (
                  <View key={i} style={{ marginTop: space(1) }}>
                    <Text style={styles.detailChart}>· {nm}{c.saju?.dayMaster?.stem ?? '?'}일간{gz ? ` | ${gz}` : ''}</Text>
                    {birthLine ? <Text style={styles.detailBirth}>   {birthLine}</Text> : null}
                  </View>
                );
              })}
              {detail.credits.length > 0 && <Text style={styles.detailLine}>보유 이용권: {detail.credits.map((c) => `${c.kind}×${c.remaining}`).join(', ')}</Text>}
            </View>
          )}
          {/* 콘텐츠 방문 내역(daniel 2026-07-06) — 어떤 콘텐츠를 얼마나 봤는지. 방문 많은 순(서버 정렬 + 방어적 재정렬). */}
          <View style={styles.detailBox}>
            <Text style={styles.detailSub}>콘텐츠 방문{visits.length ? ` (${visits.length})` : ''}</Text>
            {visits.length > 0 ? (
              [...visits].sort((a, b) => b.visits - a.visits).map((v) => (
                <Text key={v.kind} style={styles.detailChart}>· {contentLabel(v.kind)} · 방문 {v.visits}회{v.last_at ? ` · 최근 ${String(v.last_at).split('T')[0]}` : ''}</Text>
              ))
            ) : <Text style={styles.detailLine}>방문 기록 없음</Text>}
          </View>
          <PressableScale style={[styles.premToggle, sel.is_premium && styles.premToggleOn]} onPress={togglePremium} disabled={busy}>
            <Text style={styles.premToggleTx}>{sel.is_premium ? '프리미엄 해제' : '프리미엄 선물'}</Text>
          </PressableScale>
          <Text style={styles.giftSub}>이용권 선물 (+1)</Text>
          <View style={styles.giftGrid}>
            {CREDIT_KINDS.map((c) => (
              <PressableScale key={c.key} style={styles.giftBtn} onPress={() => gift(c.key, c.ko)} disabled={busy}>
                <Text style={styles.giftBtnTx}>{c.ko}</Text>
              </PressableScale>
            ))}
          </View>
          {busy && <ActivityIndicator color={colors.ju} style={{ marginTop: space(2) }} />}
          {/* 지급/프리미엄 결과 — 모달 대신 inline(확인 모달과 연속 present 시 크래시 → 원천 차단) */}
          {giftMsg ? <Text style={styles.giftMsg}>{giftMsg}</Text> : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' }, // 전역 배경 투과(ContentBackdrop)
  wrap: { padding: space(5), paddingBottom: space(20) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent', padding: space(7) }, // 전역 배경 투과(ContentBackdrop)
  denied: { ...font.body, color: colors.inkSoft },
  h: { ...font.heading, marginTop: space(7), marginBottom: space(3), paddingTop: space(5), borderTopWidth: 1, borderTopColor: colors.line }, // 전체현황 ↔ 유저 목록 구분 간격(daniel)
  detailRevenue: { ...font.body, color: colors.ju, fontWeight: '800', marginVertical: 2 },
  search: { ...font.body, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: space(3), paddingVertical: space(2.75), color: colors.ink, marginBottom: space(4) },
  userRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, padding: space(3.5), marginBottom: space(2) },
  userRowOn: { borderColor: colors.ju, borderWidth: 1.5 },
  email: { ...font.body, color: colors.ink, fontWeight: '600' },
  meta: { ...font.caption, color: colors.inkFaint, marginTop: 2 },
  premBadge: { ...font.caption, color: colors.ju, fontWeight: '800', backgroundColor: colors.juSoft, paddingHorizontal: space(2.5), paddingVertical: space(1), borderRadius: radius.sm, overflow: 'hidden' },
  premBadgeOff: { color: colors.inkFaint, backgroundColor: colors.sunk }, // 일반 계정 = 은은한 muted pill(프리미엄 골드와 시각 구분·라이트다크 자동)
  giftPanel: { marginTop: space(5), padding: space(4), borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ju, ...shadow.card },
  giftHead: { ...font.body, color: colors.ink, fontWeight: '800', marginBottom: space(3) },
  detailBox: { backgroundColor: colors.sunk, borderRadius: radius.sm, padding: space(3), marginBottom: space(4) },
  detailLine: { ...font.caption, color: colors.inkSoft, marginBottom: 2 },
  detailChart: { ...font.caption, color: colors.ink, marginTop: 2 },
  detailSub: { ...font.caption, color: colors.inkSoft, fontWeight: '700', marginTop: space(2), marginBottom: 2 },
  detailBirth: { ...font.caption, color: colors.ju, marginTop: 1 },
  premToggle: { borderRadius: radius.sm, borderWidth: 1, borderColor: colors.ju, paddingVertical: space(2.5), alignItems: 'center', marginBottom: space(4) },
  premToggleOn: { backgroundColor: colors.juSoft },
  premToggleTx: { color: colors.ju, fontWeight: '800' },
  giftSub: { ...font.caption, color: colors.inkSoft, fontWeight: '700', marginBottom: space(2) },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  giftBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(3.5), paddingVertical: space(2) },
  giftBtnTx: { color: colors.bg, fontWeight: '800', fontSize: 13 },
  giftMsg: { ...font.body, color: colors.ju, fontWeight: '700', marginTop: space(3), textAlign: 'center' },
  adminLink: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, padding: space(3.5), alignItems: 'center', marginBottom: space(2) },
  adminLinkOn: { borderColor: colors.ju, backgroundColor: colors.juSoft },
  adminLinkTx: { color: colors.ju, fontWeight: '800', fontSize: 14 },
});
