// src/components/DailyLogCard.tsx — 오늘의 한 가지(미션) + 오늘 어땠어요(적중 회고)
// ─────────────────────────────────────────────────────────────────────────
// 리텐션 Phase 1(daniel 2026-07-19 승인) ①③ — 오늘의 운세 화면 하단에 붙는다.
//   ③ 미션: 결정론으로 뽑은 행동 1개 + 체크  → 운세를 '읽고 끝'이 아니라 '하고 체크'로.
//   ① 회고: "오늘 어땠어요?" 한 줄 + 맞음/그저그럼/아님 → **되돌아보기**에서 그때 운세와 나란히 보여준다.
//
// ★왜 이게 리텐션인가: 기록이 쌓이면 앱을 떠나기 어려워진다(내 데이터가 여기 있다).
//   ★★왜 이게 해자인가: 적중·miss 가 사용자 규모로 쌓인다 — CLAUDE.md §3 축적 워크플로를 daniel 한 사람이
//   아니라 전체 사용자로 확장하는 것. 경쟁앱이 카피할 수 없는 데이터다.
//
// keyboard-safe: 스크롤을 직접 그리지 않는 '카드' 컴포넌트다. 호스트 화면(today.tsx)의 ScrollView 가
//   automaticallyAdjustKeyboardInsets 로 회고 입력창을 올린다(check:keyboard R1 면제 사유).
//   ⚠️다른 화면에 이 카드를 붙일 때도 그 화면의 스크롤에 같은 처리가 있어야 한다.
// ⚠️로그인 필요(계정 귀속·RLS). 비로그인은 미션은 보여 주되 저장은 막고 로그인을 유도한다.
// ⚠️§4 안전: 회고는 '맞았나'를 묻지 '불안'을 묻지 않는다. 미평가를 방치해도 무해하게(강요 없음).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableScale } from './PressableScale';
import { dailyMission } from '../lib/content/dailyMission';
import { dailyEnergy } from '../lib/content/dailyFortune';
import { getDailyLog, saveDailyLog } from '../lib/backend/dailyLog';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';
import type { SajuChart, Stem, Branch } from '@spec/chart';

/** 적중 평가 3단계 — 값은 daily_logs.hit(1/0/-1)과 일치. */
const HIT_OPTS: { v: number; label: string }[] = [
  { v: 1, label: '맞았어요' },
  { v: 0, label: '그저 그랬어요' },
  { v: -1, label: '아니었어요' },
];

export function DailyLogCard({ saju, chartId, date, stem, branch, headline, loggedIn }: {
  saju: SajuChart;
  chartId: string | null;
  date: string;            // 'YYYY-MM-DD'
  stem: Stem;
  branch: Branch;
  headline: string | null; // 그날 캐치 타이틀(박제용)
  loggedIn: boolean;
}) {
  const router = useRouter();
  const { fs } = useFontScale();
  const [note, setNote] = useState('');
  const [hit, setHit] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState(false); // 저장됨 표시(잠깐)

  const mission = dailyMission(saju, stem, branch);

  // 기존 기록 불러오기(같은 날 다시 들어와도 이어서 보이게)
  useEffect(() => {
    let alive = true;
    if (!loggedIn) return;
    getDailyLog(chartId, date).then((log) => {
      if (!alive || !log) return;
      setNote(log.note ?? '');
      setHit(log.hit ?? null);
      setDone(!!log.mission_done);
    }).catch(() => {});
    return () => { alive = false; };
  }, [chartId, date, loggedIn]);

  /** 저장 — 그날 운세(점수·타이틀·기운)를 함께 박제한다(엔진 개정 후에도 당시 화면과 일치하도록). */
  async function persist(patch: Parameters<typeof saveDailyLog>[2]) {
    if (!loggedIn) { router.push('/login'); return; }
    let score: number | undefined; let group: string | undefined;
    try { const e = dailyEnergy(saju, stem, branch); score = e.score; group = e.group; } catch { /* 박제 실패해도 기록은 남긴다 */ }
    const ok = await saveDailyLog(chartId, date, { score, headline, energy_group: group, mission_key: mission.key, ...patch });
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
  }

  return (
    <View style={styles.wrap}>
      {/* ── 오늘의 한 가지(미션) ── */}
      <View style={styles.card}>
        <Text style={styles.kicker}>오늘의 한 가지</Text>
        <Text style={[styles.mission, { fontSize: fs(15), lineHeight: fs(23) }]}>{mission.text}</Text>
        <PressableScale
          style={[styles.checkBtn, done && styles.checkBtnOn]}
          onPress={() => { const n = !done; setDone(n); persist({ mission_done: n }); }}
        >
          <Text style={[styles.checkTx, done && styles.checkTxOn]}>{done ? '✓ 했어요' : '해볼게요'}</Text>
        </PressableScale>
      </View>

      {/* ── 오늘 어땠어요(적중 회고) ── */}
      <View style={styles.card}>
        <Text style={styles.kicker}>오늘 어땠어요?</Text>
        <Text style={styles.sub}>남겨 두면 나중에 그날 운세와 나란히 보여드려요.</Text>
        <View style={styles.hitRow}>
          {HIT_OPTS.map((o) => (
            <PressableScale
              key={o.v}
              style={[styles.hitChip, hit === o.v && styles.hitChipOn]}
              onPress={() => { const n = hit === o.v ? null : o.v; setHit(n); persist({ hit: n }); }}
            >
              <Text style={[styles.hitTx, hit === o.v && styles.hitTxOn]}>{o.label}</Text>
            </PressableScale>
          ))}
        </View>
        <TextInput
          style={[styles.input, { fontSize: fs(14) }]}
          value={note}
          onChangeText={setNote}
          onBlur={() => persist({ note: note.trim() || null })}
          placeholder="오늘 있었던 일을 한 줄로 (선택)"
          placeholderTextColor={colors.inkFaint}
          maxLength={200}
          multiline
        />
        {!loggedIn && <Text style={styles.needLogin}>로그인하면 기록이 계정에 저장돼요.</Text>}
        {saved && <Text style={styles.savedTx}>저장됐어요</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space(2.5), marginTop: space(4) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), ...shadow.card },
  kicker: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.3 },
  sub: { ...font.caption, color: colors.inkFaint, marginTop: 2 },
  mission: { ...font.body, color: colors.ink, marginTop: space(2) },
  checkBtn: { alignSelf: 'flex-start', marginTop: space(3), paddingVertical: space(2), paddingHorizontal: space(4), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.juSoft },
  checkBtnOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  checkTx: { fontSize: 13, fontWeight: '800', color: colors.ju },
  checkTxOn: { color: '#15132E' },
  hitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(3) },
  hitChip: { paddingVertical: space(2), paddingHorizontal: space(3.5), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.overlay },
  hitChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  hitTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  hitTxOn: { color: '#15132E', fontWeight: '800' },
  input: { minHeight: 44, marginTop: space(3), borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.overlay, paddingHorizontal: space(3), paddingVertical: space(2.5), color: colors.ink, textAlignVertical: 'top' },
  needLogin: { ...font.caption, color: colors.inkFaint, marginTop: space(2) },
  savedTx: { ...font.caption, color: colors.ju, fontWeight: '700', marginTop: space(2) },
});
