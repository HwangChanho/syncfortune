// src/app/(app)/charts.tsx — 만세력·차트 관리 (무료, 광고 진입, 한지·먹 테마). 내 명식(myChart) 표시.
// ─────────────────────────────────────────────────────────────────────────
// 저장된 내 차트(self) 로드 → MyeongsikScreen 재사용. 없으면 등록 유도. (추후 N명 목록 확장)
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { useFontScale } from '../../lib/ui/fontScale';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MyeongsikScreen } from '../../screens/MyeongsikScreen';
import { loadMyChart, listCharts, getRepresentativeId, subscribeRepChange } from '../../lib/engine/myChart';
import { ChartPicker } from '../../components/ChartPicker';
import { ChartSkeleton } from '../../components/Skeleton'; // 로딩 중 명식 형태 스켈레톤(daniel 2026-06-28)
import { useDeferredReady } from '../../lib/ui/useDeferredReady'; // 전환 끝난 뒤 MyeongsikScreen 마운트(멈칫 제거)
import { colors, radius, space, font } from '../../lib/theme';
import type { ChartInput } from '@spec/chart';
import { useWideWeb } from '../../components/WebShell'; // ★넓은 웹 판정(빈 상태 카드)

export default function ChartsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [me, setMe] = useState<ChartInput | null>(null);
  const [repName, setRepName] = useState<string | null>(null); // 대표 명식 이름(만세력 사주 원국 제목 '누구 명식인지', daniel 07-05)
  const [loading, setLoading] = useState(true);
  const ready = useDeferredReady(); // 전환 애니가 끝난 뒤 MyeongsikScreen(무거운 computeChart) 마운트 → 멈칫 제거
  // 대표 명식 이름 로드 — 명식 변경(ChartPicker) 시에도 갱신해 제목이 항상 현재 명식을 가리키게.
  const refreshRepName = () => Promise.all([listCharts(), getRepresentativeId()]).then(([cs, id]) => setRepName(cs.find((c) => c.id === id)?.label ?? cs[0]?.label ?? null));
  /**
   * 지금 **보고 있는** 명식의 id. 대표와 다를 수 있다(`viewOnly` 로 골라 볼 수 있으므로).
   * ★갱신할 때 «대표» 가 아니라 **보던 그것**을 다시 읽으려고 들고 있는다.
   */
  const shownIdRef = useRef<string | null>(null);
  /**
   * 같은 id 를 **화면에도** 흘려보낸다 — 유료 언락(「충/합 글자 바꿔 보기」)이 (명식×기능) 단위라
   * 만세력이 «지금 보는 게 어느 명식인지» 를 알아야 한다.
   * ★ref 를 그대로 못 쓰는 이유: ref 는 바뀌어도 **다시 그리지 않는다** → 명식을 갈아도 버튼이
   *   옛 명식을 가리킨 채 남는다(= 남의 명식에 결제를 걸 뻔한 자리). 그래서 state 를 하나 더 둔다.
   * ★대표 명식을 보고 있을 땐 대표 id 가 들어간다(고른 적이 없으면 그게 «지금 보는 것»이다).
   */
  const [shownId, setShownId] = useState<string | null>(null);
  const setShown = (id: string | null) => { shownIdRef.current = id; setShownId(id); };

  useEffect(() => {
    loadMyChart().then((c) => { setMe(c); setLoading(false); });
    refreshRepName();
    // 고른 적이 없으면 «보는 것» = 대표. 언락 키가 되어야 하므로 id 를 채워 둔다.
    void getRepresentativeId().then((id) => { if (!shownIdRef.current) setShown(id ?? null); });
  }, []);

  /**
   * ── 명식이 바뀌면 **이 화면에서** 갱신한다 ──────────────────────────────
   * Boss 2026-08-31 *"명식을 수정하거나 등록하면 기존 뷰에서 갱신되는게 아니고
   *                   새로운 뷰가 생성되는데 기존 만세력 뷰에서 갱신되게해"*
   *
   * ■ 원인이 **둘**이었다 — 하나만 고치면 증상이 남는다
   *   ① 등록·수정이 `router.replace` 로 **또 하나의 화면을 쌓았다**(→ `dismissTo` 로 고침)
   *   ② `ChartPicker` 가 `viewOnly` 일 때 구독에서 **통째로 조기 return** 해서
   *      되돌아와도 옛 내용이 남았다(→ 목록 갱신은 하도록 고침)
   * ⇒ 여기서는 «보던 명식» 을 id 로 다시 읽는다. 보던 게 지워졌으면 대표로 떨어진다.
   *
   * ⚠️`subscribeRepChange` 는 **실제로 바뀔 때만** 운다(`myChart.ts` 의 서명 비교) —
   *   포커스마다 다시 읽는 방식과 달리 «골라 본 명식이 홱 대표로 돌아가는» 부작용이 없다.
   */
  useEffect(() => subscribeRepChange(() => {
    const id = shownIdRef.current;
    if (!id) { void loadMyChart().then((c) => { if (c) setMe(c); }); refreshRepName(); return; }
    void listCharts().then((cs) => {
      const still = cs.find((c) => c.id === id);
      if (still) { setMe(still.input); setRepName(still.label ?? null); return; }
      setShown(null);                                  // 보던 명식이 사라졌다 → 대표로
      void loadMyChart().then((c) => { if (c) setMe(c); }); refreshRepName();
    });
  }), []);
  const { fs } = useFontScale();
  const wide = useWideWeb();   // 넓은 웹만 카드 처리(네이티브는 종전 그대로)
  const styles = useMemo(() => makeStyles(fs), [fs]);

  // 로드 중 OR 전환 중 = 명식 형태 스켈레톤. ★MyeongsikScreen 은 ready 후에만 마운트(내부 조기 return 금지 — hook 수 불변).
  if (loading || !ready) return <ChartSkeleton />;

  if (!me) {
    return (
      <View style={styles.center}>
        {/* ★넓은 웹에서는 카드로 감싼다(daniel 2026-08-16 점검: "빈 화면에 회색 판이 통째로").
             데스크톱 컬럼은 1000px 인데 안내 한 줄만 떠 있으면 '덜 불러온 화면'처럼 보인다. */}
        <View style={wide ? styles.emptyCard : undefined}>
          <Text style={styles.msg}>{t('manse.empty')}</Text>
          <PressableScale style={styles.btn} onPress={() => router.push('/register')}>
            <Text style={styles.btnText}>{t('compat.registerMyChart')}</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  // 명식 변경(ChartPicker, 대표 전환 시 me 갱신 → 만세력 즉시 전환) + 내 명식 표시 + 풀이 진입.
  return (
    <MyeongsikScreen
      input={me}
      chartId={shownId}
      header={<>
        {/* ★만세력 최상단 '계산됨' 배너 — MyeongsikScreen 스크롤 콘텐츠 맨 위(header 슬롯)에 렌더. 화면당 1개. */}
        {/* ★★**보기 전용** — 여기서 명식을 골라도 **대표는 안 바뀐다**
            (Boss 2026-08-27 *"무조건 대표명식으로 고정이야"*).
            ⇒ 오행 테마가 안 바뀌므로 **앱 리로드도 없다** — «홈을 한 번 갔다 오는» 증상이 사라진다.
            ★고른 명식은 그 자리에서 화면에 띄운다(대표를 다시 읽지 않는다). */}
        <ChartPicker
          viewOnly
          onChange={(picked) => {
            // ★고른 명식의 id 를 기억한다 — 나중에 그 명식이 수정되면 **그것을** 다시 읽는다
            if (picked) { setShown(picked.id); setMe(picked.input); setRepName(picked.label ?? null); return; }
            setShown(null);
            void loadMyChart().then(setMe); refreshRepName();
          }}
        />
      </>}
      whoName={repName}
      onReading={() => router.push({ pathname: '/reading', params: { input: JSON.stringify(me), kind: 'saju' } })}
    />
  );
}

const scaledFont = (fs: (n: number) => number) => ({
  title: { ...font.title, fontSize: fs(22) },
  heading: { ...font.heading, fontSize: fs(17) },
  body: { ...font.body, fontSize: fs(15) },
  label: { ...font.label, fontSize: fs(13) },
  caption: { ...font.caption, fontSize: fs(12) },
});
const makeStyles = (fs: (n: number) => number) => { const f = scaledFont(fs); return StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: 'transparent' }, // 전역 배경 노출
  // 넓은 웹 전용 — 안내를 카드에 담아 '빈 화면'이 아니라 '할 일이 있는 화면'으로 읽히게
  emptyCard: {
    alignItems: 'center', maxWidth: 420, width: '100%',
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line,
    paddingVertical: space(9), paddingHorizontal: space(7),
  },
  msg: { ...f.body, textAlign: 'center', marginBottom: space(5) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.white, fontSize: fs(15), fontWeight: '700', textAlign: 'center' },
}); };
