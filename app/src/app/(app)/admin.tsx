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
import { isAdmin, adminListUsers, adminGrantCredit, adminSetPremium, adminUserDetail, adminStats, adminUserUsage, adminUserContentVisits, type AdminUser, type AdminUserDetail, type AdminStats, type AdminUsage, type AdminContentVisit, type DayPoint } from '../../lib/core/admin';
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
  // ★CreditKind 별칭 통일(daniel 07-07) — 크레딧/원가 표시가 영어(reading 등)로 새지 않도록. saju=콘텐츠kind·reading=결제kind 동일 콘텐츠.
  reading: '사주 풀이', followup: '추가 질문', timeresolve: '태어난 시 찾기', child_couple: '자식운(부부)',
  // 집계 소스(api_usage·purchases)에서 나올 수 있는 kind 보강 — 대시보드에 영어/상품id 노출 방지.
  compat_ziwei: '궁합(자미)', premium: '프리미엄', premium_lifetime: '프리미엄(평생)',
};
// kind → 라벨(미등록이면 raw kind 노출).
const contentLabel = (kind: string) => KIND_LABEL[kind] ?? kind;

// ── 시각화 유틸(외부 차트 라이브러리 없이 View width/height %·px 로만, daniel 07-07) ──
const won = (n: number) => '₩' + Math.round(Number(n) || 0).toLocaleString(); // 원화 표기
const POS = '#3FA7A0'; // 흑자·매출(coststable 색과 통일)
const NEG = '#E5484D'; // 원가·적자
const ACC2 = '#5B8DEF'; // 보조 강조(방문·활동 추이 — 골드와 시각 구분)

// 수치 타일: 큰 숫자 + 라벨(+보조문구). accent 로 숫자 색 강조.
function StatTile({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileVal, accent ? { color: accent } : null]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.tileLbl} numberOfLines={1}>{label}</Text>
      {sub ? <Text style={styles.tileSub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

// 가로 비율 막대(순위형): 라벨 | 트랙(채움 width%) | 값. max 대비 비율, 최소 4%(작은 값도 보이게).
function BarRow({ label, value, max, suffix, accent }: { label: string; value: number; max: number; suffix?: string; accent?: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: (`${pct}%` as any) }, accent ? { backgroundColor: accent } : null]} />
      </View>
      <Text style={styles.barVal} numberOfLines={1}>{value.toLocaleString()}{suffix ?? ''}</Text>
    </View>
  );
}

// 일별 추이 스파크바(세로 막대 나열): 값(위)·막대(높이=값/최대)·날짜 DD(아래). 최근 N일.
function SparkBars({ data, accent }: { data: DayPoint[]; accent: string }) {
  if (!data || data.length === 0) return <Text style={styles.emptyLine}>데이터 없음</Text>;
  const max = data.reduce((m, p) => Math.max(m, p.n), 0);
  const total = data.reduce((s, p) => s + p.n, 0);
  return (
    <>
      <View style={styles.spark}>
        {data.map((p) => {
          const h = max > 0 ? Math.max(3, Math.round((p.n / max) * 42)) : 3; // 막대 높이(px). 최소 3(0도 흔적)
          return (
            <View key={p.d} style={styles.sparkCol}>
              <Text style={styles.sparkNum} numberOfLines={1}>{p.n}</Text>
              <View style={[styles.sparkBar, { height: h, backgroundColor: accent }]} />
              <Text style={styles.sparkDay} numberOfLines={1}>{p.d.slice(-2)}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.sparkCap}>최근 {data.length}일 · 합계 {total} · 최대 {max}</Text>
    </>
  );
}

// 전체 현황 대시보드 — 규모·매출/원가/순익(실측)·풀이분포·인기콘텐츠·원가·매출·일별추이·상위사용자.
//   집계는 서버 admin_stats(SECURITY DEFINER + is_caller_admin)가 계산 → 여기선 시각화만. 라벨은 KIND_LABEL(단일 소스).
function Dashboard({ stats }: { stats: AdminStats }) {
  const rbk = (stats.readings_by_kind ?? []).slice(0, 12);        // 풀이 분포 Top
  const tc = (stats.top_content ?? []).slice(0, 10);              // 인기 콘텐츠 Top
  const cbk = (stats.cost_by_kind ?? []).slice(0, 12);           // 분야별 원가 Top
  const rev = (stats.revenue_by_kind ?? []).slice(0, 10);        // 분야별 매출 Top
  const maxRk = Math.max(1, ...rbk.map((r) => r.n));
  const maxTc = Math.max(1, ...tc.map((r) => r.visits));
  const maxCost = Math.max(1, ...cbk.map((r) => r.won));
  const maxRev = Math.max(1, ...rev.map((r) => r.won));
  const net = (stats.total_revenue ?? 0) - (stats.measured_cost ?? 0); // 순익(매출−실측원가·수수료세금 전)

  return (
    <View>
      {/* 규모 */}
      <View style={styles.card}>
        <Text style={styles.cardHead}>전체 현황</Text>
        <View style={styles.tileGrid}>
          <StatTile label="유저" value={stats.total_users} sub={`프리미엄 ${stats.premium_users} · 관리자 ${stats.admin_users}`} accent={colors.ju} />
          <StatTile label="결제 유저" value={stats.paying_users} />
          <StatTile label="7일 활성" value={stats.active_7d} />
          <StatTile label="명식" value={stats.total_charts} />
          <StatTile label="풀이" value={stats.total_readings} sub={`추가질문 ${stats.total_followups}`} />
          <StatTile label="미사용 이용권" value={stats.credits_remaining} />
        </View>
      </View>

      {/* 매출·원가·순익(실측) */}
      <View style={styles.card}>
        <Text style={styles.cardHead}>매출 · 원가 · 순익 <Text style={styles.cardHeadSub}>실측</Text></Text>
        <View style={styles.tileGrid}>
          <StatTile label="총매출" value={won(stats.total_revenue)} accent={POS} />
          <StatTile label="실측 원가" value={won(stats.measured_cost)} accent={NEG} />
          <StatTile label="순익(매출−원가)" value={won(net)} accent={net >= 0 ? colors.ju : NEG} />
        </View>
        <Text style={styles.cardNote}>원가 = Anthropic usage 토큰 실측(api_usage 누적). 수수료·세금 반영 상세는 ‘비용·수익 분석’ 참고.</Text>
      </View>

      {/* 풀이 분야 분포 */}
      <View style={styles.card}>
        <Text style={styles.cardHead}>풀이 분야 분포 <Text style={styles.cardHeadSub}>Top {rbk.length}</Text></Text>
        {rbk.length ? rbk.map((r) => <BarRow key={r.kind} label={contentLabel(r.kind)} value={r.n} max={maxRk} suffix="회" />) : <Text style={styles.emptyLine}>데이터 없음</Text>}
      </View>

      {/* 인기 콘텐츠(전 계정 방문 합산) */}
      <View style={styles.card}>
        <Text style={styles.cardHead}>인기 콘텐츠 <Text style={styles.cardHeadSub}>방문 Top {tc.length}</Text></Text>
        {tc.length ? tc.map((r) => <BarRow key={r.kind} label={contentLabel(r.kind)} value={r.visits} max={maxTc} suffix="회" accent={ACC2} />) : <Text style={styles.emptyLine}>방문 기록 없음</Text>}
      </View>

      {/* 분야별 실측 원가 */}
      <View style={styles.card}>
        <Text style={styles.cardHead}>분야별 실측 원가 <Text style={styles.cardHeadSub}>Top {cbk.length} · (요청수)</Text></Text>
        {cbk.length ? cbk.map((r) => <BarRow key={r.kind} label={`${contentLabel(r.kind)} (${r.reqs})`} value={r.won} max={maxCost} suffix="원" accent={NEG} />) : <Text style={styles.emptyLine}>측정값 없음</Text>}
      </View>

      {/* 분야별 실매출(비샌드박스 결제 있을 때만) */}
      {rev.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardHead}>분야별 실매출 <Text style={styles.cardHeadSub}>(건수)</Text></Text>
          {rev.map((r) => <BarRow key={r.kind} label={`${contentLabel(r.kind)} (${r.cnt})`} value={r.won} max={maxRev} suffix="원" accent={POS} />)}
        </View>
      )}

      {/* 일별 추이(최근 14일) */}
      <View style={styles.card}>
        <Text style={styles.cardHead}>신규 가입 추이</Text>
        <SparkBars data={stats.signups_daily ?? []} accent={colors.ju} />
        <Text style={[styles.cardHead, { marginTop: space(4) }]}>풀이 생성 추이</Text>
        <SparkBars data={stats.readings_daily ?? []} accent={ACC2} />
      </View>

      {/* 상위 사용자 */}
      {(stats.top_users?.length ?? 0) > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardHead}>상위 사용자 <Text style={styles.cardHeadSub}>풀이 많은 순</Text></Text>
          {stats.top_users.map((u, i) => (
            <View key={i} style={styles.rankRow}>
              <Text style={styles.rankNo}>{i + 1}</Text>
              <Text style={styles.rankName} numberOfLines={1}>{u.name ?? '(이름 없음)'}</Text>
              <Text style={styles.rankVal}>{u.readings}회</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

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
  // 선택 유저 풀이 분야 막대의 최대값(비율 기준) — detail 없으면 1(0 나눗셈 방지).
  const maxUserRk = detail?.readings_by_kind?.length ? Math.max(1, ...detail.readings_by_kind.map((x) => x.n)) : 1;

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
      {/* 전체 현황 대시보드(daniel 07-07 대폭 확장) — 규모·매출/원가/순익 실측·풀이분포·인기콘텐츠·일별추이·상위사용자 */}
      {stats && <Dashboard stats={stats} />}
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
              {/* 계정 메타(daniel 07-07): 가입·최근활동·상태 pill */}
              <Text style={styles.detailLine}>가입 {detail.created_at ? String(detail.created_at).split('T')[0] : '?'}{detail.last_seen ? ` · 최근활동 ${String(detail.last_seen).split('T')[0]}` : ''}</Text>
              <View style={styles.pillRow}>
                <Text style={[styles.miniPill, detail.is_premium ? styles.miniPillOn : styles.miniPillOff]}>{detail.is_premium ? '프리미엄' : '일반'}</Text>
                {detail.is_admin ? <Text style={[styles.miniPill, styles.miniPillAdmin]}>{detail.admin_mode ? '관리자' : '관리자·모드OFF'}</Text> : null}
              </View>
              <Text style={styles.detailLine}>통변 {detail.reading_count}회 · 추가질문 {detail.followup_count}회</Text>
              <Text style={styles.detailLine}>원가(실측)는 비용·수익 분석 화면 참고</Text>
              {usage && usage.sessions > 0 ? <Text style={styles.detailLine}>평균 사용 {fmtDur(usage.avg_sec)} · {usage.sessions}세션 · 총 {fmtDur(usage.total_sec)}{usage.last_seen ? ` · 최근 ${String(usage.last_seen).split('T')[0]}` : ''}</Text> : null}
              {/* 풀이 kind별 분해(daniel 07-07) — 어떤 분야를 얼마나 생성했는지 막대로(방문 많은 순 Top 8) */}
              {(detail.readings_by_kind?.length ?? 0) > 0 && (
                <>
                  <Text style={styles.detailSub}>풀이 분야별 ({detail.readings_by_kind.length})</Text>
                  {detail.readings_by_kind.slice(0, 8).map((r) => (
                    <BarRow key={r.kind} label={contentLabel(r.kind)} value={r.n} max={maxUserRk} suffix="회" />
                  ))}
                </>
              )}
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
  premBadge: { ...font.caption, color: colors.badgeGold, fontWeight: '800', backgroundColor: colors.juSoft, paddingHorizontal: space(2.5), paddingVertical: space(1), borderRadius: radius.sm, overflow: 'hidden' },
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

  // ── 대시보드 카드/시각화(daniel 07-07: 정보밀도·가시성) ──
  card: { marginTop: space(3), padding: space(4), borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow.card },
  cardHead: { ...font.body, color: colors.ink, fontWeight: '800', marginBottom: space(2.5) },
  cardHeadSub: { ...font.caption, color: colors.inkFaint, fontWeight: '600' }, // 헤더 옆 보조(Top N·실측 등)
  cardNote: { ...font.caption, color: colors.inkFaint, marginTop: space(2), lineHeight: 16 },
  // 수치 타일(3열 wrap) — 큰 숫자 강조
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '33.33%', paddingVertical: space(1.5), paddingRight: space(2) },
  tileVal: { ...font.heading, color: colors.ink, fontWeight: '900' },
  tileLbl: { ...font.caption, color: colors.inkSoft, marginTop: 1 },
  tileSub: { fontSize: 10, color: colors.inkFaint, marginTop: 1 },
  // 가로 비율 막대(순위형)
  barRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  barLabel: { width: 96, fontSize: 11.5, color: colors.ink, fontWeight: '600' },
  barTrack: { flex: 1, height: 12, backgroundColor: colors.sunk, borderRadius: 6, overflow: 'hidden', marginHorizontal: space(2) },
  barFill: { height: '100%', backgroundColor: colors.ju, borderRadius: 6, minWidth: 2 },
  barVal: { width: 66, fontSize: 11, color: colors.inkSoft, textAlign: 'right', fontWeight: '700' },
  // 세로 스파크바(일별 추이)
  spark: { flexDirection: 'row', alignItems: 'flex-end', height: 66, marginTop: space(1) },
  sparkCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  sparkNum: { fontSize: 8, color: colors.inkFaint, marginBottom: 1 },
  sparkBar: { width: '58%', minWidth: 5, borderRadius: 2 },
  sparkDay: { fontSize: 8, color: colors.inkFaint, marginTop: 2 },
  sparkCap: { ...font.caption, color: colors.inkFaint, marginTop: space(1.5) },
  // 순위 행(상위 사용자)
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(1.5), borderBottomWidth: 1, borderBottomColor: colors.line },
  rankNo: { width: 22, fontSize: 12, fontWeight: '800', color: colors.ju },
  rankName: { flex: 1, fontSize: 12.5, color: colors.ink },
  rankVal: { fontSize: 12, color: colors.inkSoft, fontWeight: '700' },
  emptyLine: { ...font.caption, color: colors.inkFaint, paddingVertical: space(1) },
  // 상세: 계정 상태 mini pill
  pillRow: { flexDirection: 'row', gap: space(1.5), marginVertical: space(1) },
  miniPill: { fontSize: 10.5, fontWeight: '800', paddingHorizontal: space(2), paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden' },
  miniPillOn: { color: colors.badgeGold, backgroundColor: colors.juSoft },
  miniPillOff: { color: colors.inkFaint, backgroundColor: colors.sunk },
  miniPillAdmin: { color: colors.bg, backgroundColor: colors.ju },
});
