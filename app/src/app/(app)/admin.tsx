// app/src/app/(app)/admin.tsx — 관리자(cksgh0316) 전용: 유저 목록 + 이용권·프리미엄 선물
// ─────────────────────────────────────────────────────────────────────────
// daniel=관리자(profiles.is_admin — 특정 계정). 별도 웹 없이 앱 내에서 관리.
//   유저 검색·확인 + 특정 유저에게 이용권 선물(grant)·프리미엄 토글. 권한은 서버 RPC(is_caller_admin)가 강제.
//   ⚠️ 이메일=PII — 관리자만 노출(규칙8). 비관리자는 접근 차단(서버 RPC + 아래 allowed 게이트).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { Alert } from '../../lib/alert'; // 커스텀 알림(앱 디자인)
import { useEffect, useState } from 'react';
import { isAdmin, adminListUsers, adminGrantCredit, adminSetPremium, adminUserDetail, type AdminUser, type AdminUserDetail } from '../../lib/admin';
import { CREDIT_KINDS, type CreditKind } from '../../lib/coupons';
import { colors, radius, space, shadow, font } from '../../lib/theme';

export default function AdminRoute() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);

  async function reload() { setUsers(await adminListUsers()); }
  useEffect(() => { isAdmin().then((a) => { setAllowed(a); if (a) reload(); }); }, []);
  // 유저 선택 시 상세(사용량·명식·이용권) 로드
  useEffect(() => { setDetail(null); if (sel) adminUserDetail(sel.id).then(setDetail).catch(() => {}); }, [sel]);

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
        setBusy(true);
        try {
          const ok = await adminGrantCredit(u.id, kind);
          if (ok && detail) adminUserDetail(u.id).then(setDetail).catch(() => {}); // 보유 +1 갱신 = 성공 피드백
          if (!ok) Alert.alert('실패', '오류가 발생했어요.');                       // ★성공 '완료' Alert 제거 — 확인→완료 연속 모달 present 충돌(크래시) 원천 차단. 성공은 보유 갱신으로만 피드백.
        } catch (e: any) {
          Alert.alert('실패', String(e?.message ?? e));
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
        setBusy(true);
        try {
          const ok = await adminSetPremium(u.id, next);
          if (ok) { setSel({ ...u, is_premium: next }); reload(); }
          else Alert.alert('실패', '오류가 발생했어요.');
        } catch (e: any) {
          Alert.alert('실패', String(e?.message ?? e));
        } finally { setBusy(false); }
      } },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.h}>유저 ({users.length})</Text>
      <TextInput style={styles.search} value={q} onChangeText={setQ} placeholder="이메일 검색" placeholderTextColor={colors.inkFaint} autoCapitalize="none" autoCorrect={false} />
      {filtered.map((u) => {
        const on = sel?.id === u.id;
        return (
          <Pressable key={u.id} style={[styles.userRow, on && styles.userRowOn]} onPress={() => setSel(u)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.email} numberOfLines={1}>{u.email}</Text>
              <Text style={styles.meta}>{String(u.created_at).split('T')[0]}{u.is_admin ? ' · 관리자' : ''}</Text>
            </View>
            {u.is_premium && <Text style={styles.premBadge}>프리미엄</Text>}
          </Pressable>
        );
      })}

      {sel && (
        <View style={styles.giftPanel}>
          <Text style={styles.giftHead}>{sel.email}</Text>
          {detail && (
            <View style={styles.detailBox}>
              <Text style={styles.detailLine}>통변 {detail.reading_count}회 · 추가질문 {detail.followup_count}회</Text>
              <Text style={styles.detailLine}>추정 API 비용 ≈ ₩{(detail.reading_count * 150).toLocaleString()}</Text>
              <Text style={styles.detailLine}>등록 명식 {detail.chart_count}개</Text>
              {detail.charts.map((c, i) => {
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
          <Pressable style={[styles.premToggle, sel.is_premium && styles.premToggleOn]} onPress={togglePremium} disabled={busy}>
            <Text style={styles.premToggleTx}>{sel.is_premium ? '프리미엄 해제' : '프리미엄 선물'}</Text>
          </Pressable>
          <Text style={styles.giftSub}>이용권 선물 (+1)</Text>
          <View style={styles.giftGrid}>
            {CREDIT_KINDS.map((c) => (
              <Pressable key={c.key} style={styles.giftBtn} onPress={() => gift(c.key, c.ko)} disabled={busy}>
                <Text style={styles.giftBtnTx}>{c.ko}</Text>
              </Pressable>
            ))}
          </View>
          {busy && <ActivityIndicator color={colors.ju} style={{ marginTop: space(2) }} />}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(20) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: space(7) },
  denied: { ...font.body, color: colors.inkSoft },
  h: { ...font.heading, marginBottom: space(3) },
  search: { ...font.body, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: space(3), paddingVertical: space(2.75), color: colors.ink, marginBottom: space(4) },
  userRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, padding: space(3.5), marginBottom: space(2) },
  userRowOn: { borderColor: colors.ju, borderWidth: 1.5 },
  email: { ...font.body, color: colors.ink, fontWeight: '600' },
  meta: { ...font.caption, color: colors.inkFaint, marginTop: 2 },
  premBadge: { ...font.caption, color: colors.ju, fontWeight: '800' },
  giftPanel: { marginTop: space(5), padding: space(4), borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ju, ...shadow.card },
  giftHead: { ...font.body, color: colors.ink, fontWeight: '800', marginBottom: space(3) },
  detailBox: { backgroundColor: colors.sunk, borderRadius: radius.sm, padding: space(3), marginBottom: space(4) },
  detailLine: { ...font.caption, color: colors.inkSoft, marginBottom: 2 },
  detailChart: { ...font.caption, color: colors.ink, marginTop: 2 },
  detailBirth: { ...font.caption, color: colors.ju, marginTop: 1 },
  premToggle: { borderRadius: radius.sm, borderWidth: 1, borderColor: colors.ju, paddingVertical: space(2.5), alignItems: 'center', marginBottom: space(4) },
  premToggleOn: { backgroundColor: colors.juSoft },
  premToggleTx: { color: colors.ju, fontWeight: '800' },
  giftSub: { ...font.caption, color: colors.inkSoft, fontWeight: '700', marginBottom: space(2) },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  giftBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(3.5), paddingVertical: space(2) },
  giftBtnTx: { color: colors.bg, fontWeight: '800', fontSize: 13 },
});
