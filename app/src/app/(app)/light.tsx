// app/src/app/(app)/light.tsx — 가볍게 보기(무료 체험 · 명식 등록 없이 즉시 결과)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-26: "가볍게 보기로 유저 붙잡고 신규 유도하는거도 기획해봐"
// 기획서 = `docs/PLAN_light_mode.md` (레버 L1). 해결하는 병목:
//   ★신규가 **아무것도 보기 전에 등록 폼을 만난다** — 앱 화면 49개가 `loadRepChart` 게이트라
//     명식이 없으면 홈은 "등록하세요" 한 줄뿐이다. 이 화면이 그 벽 앞에 놓이는 '먼저 맛보기'다.
//
// ★★명리 제약(이게 화면 내용을 정한다 — 발명 금지·정직성):
//   시간을 안 받으면 **시주가 허수**다. 그래서 시주에 의존하는 판정은 여기서 쓸 수 없다.
//     · `personaOf(일간, 월지)`      → 시주 참조 **0건** ⇒ 생년월일만으로 **정확** ✅
//     · `DAY_PILLAR[일간+일지]`      → 시주 무관              ⇒ **정확** ✅
//     · `dailyEnergy(saju, …)`      → 4주 전부 순회(dailyFortune.ts:198) ⇒ 충형·합 판정 오염 ❌
//   ⇒ 오늘 기운·모먼트·궁합·격국·신살은 **일부러 안 넣는다.** "가볍게니까 대충"으로 오염된 값을
//     내보내지 않는다. 그리고 이 제약이 곧 전환 후크가 된다 — 아래 CTA 문구는 **사실**이다.
//
// 저장·로그인·서버 호출 0 (규칙5 무료=룰/온디바이스). 계산은 메모리에서만 하고 명식으로 남기지 않는다.
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableScale } from '../../components/PressableScale';
import { computeChart } from '../../lib/engine/engine';          // canonical 빌더(드리프트 방지)
import { validateBirthInput } from '@engine/saju';               // 없는 날짜·없는 윤달 차단(감사 H3/H4/H6) — 순수함수
import { formatBirthDate } from '../../lib/engine/sijin';        // 19900315 → 1990-03-15 자동 하이픈(등록 폼과 같은 헬퍼)
import { personaOf, type PersonaType } from '../../lib/engine/personaType';
import { DAY_PILLAR, dayPillarKey, type DayPillarTrait } from '../../lib/engine/dayPillar';
import { iljuImage } from '../../lib/dayPillarEmblem';            // 60갑자 일러스트
import { PersonaImage } from '../../components/PersonaImage';     // 성격유형 240장(서버 fetch·폴백 내장)
import { sharePersona } from '../../lib/ui/share';                // ★무료 공유 — 웹에서 보이는 유일한 경로(L2)
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';

/** 결과 묶음 — 둘 다 시주 무관이라 함께 낼 수 있다(위 §명리 제약). */
type LightResult = {
  persona: PersonaType;
  ilju: { key: string; trait: DayPillarTrait } | null;   // 60갑자 표에 없으면 null(성격유형만 낸다)
  dayStem: string;
  monthBranch: string;
};

export default function LightScreen() {
  const { fs } = useFontScale();
  const router = useRouter();
  const [birthDate, setBirthDate] = useState('');
  const [calendar, setCalendar] = useState<'양' | '음'>('양');
  const [sex, setSex] = useState<'남' | '여'>('남');
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<LightResult | null>(null);

  /**
   * 생년월일만으로 시주 무관 결과를 만든다.
   * @returns 없음 — 성공 시 `result`, 실패 시 `err` 를 세팅한다(throw 하지 않음).
   * 주의: `timeAccuracy: '미상'` 으로 계산하므로 시주는 허수다. 그래서 시주 의존 판정은 읽지 않는다.
   */
  const run = useCallback(() => {
    setErr(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) { setErr('생년월일을 YYYY-MM-DD 로 입력해 주세요.'); return; }
    // 시각 미상 = 등록 폼과 같은 규약('0:0' + timeAccuracy 미상). 출생지는 기본 서울(진태양시 경도).
    const input = {
      birthDateTime: `${birthDate} 0:0`, calendar, timeAccuracy: '미상' as const, sex,
      birthPlace: '서울특별시', birthLon: 126.9780, birthLat: 37.5665,
    };
    const problems = validateBirthInput(input);   // 없는 날짜(2월 30일)·없는 윤달을 입구에서 잡는다
    if (problems.length) { setErr(problems[0]); return; }
    try {
      const saju = computeChart(input).saju;
      const dayStem = String(saju.pillars['일'].stem);
      const dayBranch = String(saju.pillars['일'].branch);
      const monthBranch = String(saju.pillars['월'].branch);
      const key = dayPillarKey(dayStem, dayBranch);
      setResult({
        persona: personaOf(saju.pillars['일'].stem, saju.pillars['월'].branch),
        ilju: key ? { key, trait: DAY_PILLAR[key] } : null,
        dayStem, monthBranch,
      });
    } catch {
      setErr('계산에 실패했어요. 날짜를 다시 확인해 주세요.');
    }
  }, [birthDate, calendar, sex]);

  /** 정확하게 보기 — 여기서 받은 값을 등록 폼에 그대로 넘겨 **다시 묻지 않는다**(입력 재요구 = 이탈 지점). */
  const toRegister = useCallback(() => {
    router.push({ pathname: '/register', params: { preDate: birthDate, preCal: calendar, preSex: sex } });
  }, [router, birthDate, calendar, sex]);

  return (
    <View style={styles.bg}>
      {/* automaticallyAdjustKeyboardInsets = 생년월일 입력이 키보드에 가리지 않게(check:keyboard R1) */}
      <ScrollView style={styles.screen} contentContainerStyle={styles.wrap} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
        <Text style={[styles.h, { fontSize: fs(26) }]}>가볍게 보기</Text>
        <Text style={[styles.sub, { fontSize: fs(13) }]}>생년월일만 알려주면 바로 볼 수 있어요. 가입도, 저장도 안 해요.</Text>

        {/* 입력 — 2가지만 묻는다(이름·시간·출생지·관계 없음) */}
        <View style={styles.card}>
          <Text style={[styles.label, { fontSize: fs(12) }]}>생년월일</Text>
          <TextInput
            style={[styles.input, { fontSize: fs(16) }]}
            value={birthDate}
            onChangeText={(v) => { setBirthDate(formatBirthDate(v)); setResult(null); }}
            placeholder="1990-03-15" placeholderTextColor={colors.inkFaint}
            keyboardType="number-pad" maxLength={10}
          />
          <View style={styles.togRow}>
            <Toggle value={calendar} options={['양', '음']} onChange={(v) => { setCalendar(v as '양' | '음'); setResult(null); }} fs={fs} />
            <Toggle value={sex} options={['남', '여']} onChange={(v) => { setSex(v as '남' | '여'); setResult(null); }} fs={fs} />
          </View>
          {err ? <Text style={[styles.err, { fontSize: fs(12.5) }]}>{err}</Text> : null}
          <PressableScale style={styles.cta} onPress={run}>
            <Text style={[styles.ctaTx, { fontSize: fs(15) }]}>{result ? '다시 보기' : '바로 보기'}</Text>
          </PressableScale>
        </View>

        {result ? (
          <>
            {/* ① 성격유형 120종 — 일간 × 월지(시주 무관·정확) */}
            <View style={styles.resCard}>
              <Text style={[styles.kicker, { fontSize: fs(11) }]}>나의 성격유형</Text>
              <View style={styles.personaRow}>
                <PersonaImage dayStem={result.dayStem} monthBranch={result.monthBranch} sex={sex} width={96} height={123} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resName, { fontSize: fs(19), lineHeight: fs(26) }]}>{result.persona.name}</Text>
                  <View style={styles.chips}>
                    {result.persona.keywords.slice(0, 3).map((k) => (
                      <View key={k} style={styles.chip}><Text style={[styles.chipTx, { fontSize: fs(11.5) }]}>{k}</Text></View>
                    ))}
                  </View>
                </View>
              </View>
              <Text style={[styles.body, { fontSize: fs(14), lineHeight: fs(22) }]}>{result.persona.summary}</Text>
              {/* ★공유 — 받는 사람이 **웹에서 바로 결과를 본다**(유료 풀이 공유와 다른 경로).
                  생년월일·이름·시각은 링크에 담기지 않는다(유형 키+성별뿐 — 생일 역산 차단). */}
              <PressableScale style={styles.shareBtn} onPress={() => {
                sharePersona({ dayStem: result.dayStem, monthBranch: result.monthBranch, sex, name: result.persona.name })
                  .catch(() => {});   // 공유 시트를 닫은 것도 여기로 온다 — 실패로 알리지 않는다
              }}>
                <Text style={[styles.shareTx, { fontSize: fs(14) }]}>친구에게 보내기</Text>
              </PressableScale>
            </View>

            {/* ② 일주론 60갑자 — 일간 + 일지(시주 무관·정확) */}
            {result.ilju ? (
              <View style={styles.resCard}>
                <Text style={[styles.kicker, { fontSize: fs(11) }]}>나의 일주</Text>
                {(() => {
                  const img = iljuImage(result.ilju!.key[0], result.ilju!.key[1]);
                  return img ? (
                    <ImageBackground source={img} style={styles.iljuHero} imageStyle={styles.iljuHeroImg} resizeMode="cover">
                      <View style={styles.scrim} />
                      <Text style={[styles.iljuKey, { fontSize: fs(30) }]}>{result.ilju!.key}</Text>
                    </ImageBackground>
                  ) : (
                    <Text style={[styles.resName, { fontSize: fs(22) }]}>{result.ilju!.key}</Text>
                  );
                })()}
                <View style={styles.chips}>
                  {result.ilju.trait.keywords.slice(0, 4).map((k) => (
                    <View key={k} style={styles.chip}><Text style={[styles.chipTx, { fontSize: fs(11.5) }]}>{k}</Text></View>
                  ))}
                </View>
                <Text style={[styles.body, { fontSize: fs(14), lineHeight: fs(22) }]}>{result.ilju.trait.personality}</Text>
              </View>
            ) : null}

            {/* ③ 전환 — ★이 문구는 마케팅이 아니라 **사실**이다(위 §명리 제약).
                오늘 기운·궁합·시기는 4주 전부를 보기 때문에 시주 없이는 정확할 수 없다. */}
            <View style={styles.moreCard}>
              <Text style={[styles.moreH, { fontSize: fs(15.5), lineHeight: fs(23) }]}>태어난 시간까지 넣으면 더 정확해져요</Text>
              <Text style={[styles.moreBody, { fontSize: fs(13.5), lineHeight: fs(21) }]}>
                여기까지는 태어난 날만으로 볼 수 있는 부분이에요. 오늘의 기운·궁합·시기 흐름은 태어난 시간이 있어야 제대로 나와요.
              </Text>
              <PressableScale style={styles.moreCta} onPress={toRegister}>
                <Text style={[styles.moreCtaTx, { fontSize: fs(15) }]}>정확하게 보기 ›</Text>
              </PressableScale>
              <Text style={[styles.moreNote, { fontSize: fs(11.5) }]}>지금 넣은 생년월일은 그대로 옮겨 담아요 — 다시 안 물어봐요.</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * 2지선다 토글 — 등록 폼의 `Segmented` 는 그 파일 지역 컴포넌트라 재사용할 수 없어 여기서 최소로 만든다.
 * @param value 현재 값 / @param options 선택지 2개 / @param onChange 선택 콜백 / @param fs 글자크기 배율
 */
function Toggle({ value, options, onChange, fs }: { value: string; options: string[]; onChange: (v: string) => void; fs: (n: number) => number }) {
  return (
    <View style={styles.tog}>
      {options.map((o) => {
        const on = o === value;
        return (
          <PressableScale key={o} style={[styles.togBtn, on && styles.togBtnOn]} onPress={() => onChange(o)}>
            <Text style={[styles.togTx, { fontSize: fs(13.5) }, on && styles.togTxOn]}>{o}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },      // 전역 ContentBackdrop 투과
  screen: { backgroundColor: 'transparent' },
  wrap: { padding: space(5), paddingBottom: space(12) },
  h: { ...font.display, marginTop: space(2) },
  sub: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5), marginBottom: space(4) },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(4), ...shadow.card },
  label: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.4, marginBottom: space(2) },
  input: { ...font.body, color: colors.ink, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: space(3.5), paddingVertical: space(3), backgroundColor: colors.bg },
  togRow: { flexDirection: 'row', gap: space(3), marginTop: space(3.5) },
  tog: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden' },
  togBtn: { paddingVertical: space(2.5), paddingHorizontal: space(5), backgroundColor: colors.bg },
  togBtnOn: { backgroundColor: colors.ju },
  togTx: { ...font.body, color: colors.inkSoft, fontWeight: '700' },
  togTxOn: { color: colors.card, fontWeight: '900' },
  err: { ...font.caption, color: '#E5484D', marginTop: space(3) },   // 앱 전반 에러 적색(테마 토큰 없음 — 기존 7곳과 동일 값)
  cta: { marginTop: space(4), backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center' },
  ctaTx: { ...font.body, color: colors.card, fontWeight: '900' },
  // 결과 카드
  resCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(4), ...shadow.card },
  kicker: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 1, marginBottom: space(3) },
  personaRow: { flexDirection: 'row', gap: space(4), alignItems: 'flex-start', marginBottom: space(3.5) },
  resName: { ...font.title, color: colors.ink, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(2.5) },
  chip: { borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.juSoft, borderRadius: 999, paddingVertical: space(1), paddingHorizontal: space(2.5) },
  chipTx: { ...font.caption, color: colors.ju, fontWeight: '800' },
  body: { ...font.body, color: colors.inkSoft },
  shareBtn: { marginTop: space(4), borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.juSoft, borderRadius: radius.md, paddingVertical: space(3), alignItems: 'center' },
  shareTx: { ...font.body, color: colors.ju, fontWeight: '800' },
  iljuHero: { height: 148, borderRadius: radius.md, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: space(1) },
  iljuHeroImg: { borderRadius: radius.md },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.30)' }, // 글자 대비 확보(라이트 테마에서도 흰 글자가 읽히게)
  iljuKey: { ...font.display, color: '#FFFFFF', fontWeight: '900' },
  // 전환 카드 — 금선 틴트로 '더 있다'는 신호만, 잠금 연출은 쓰지 않는다(무료 체험이라 압박 금지)
  moreCard: { backgroundColor: colors.juSoft, borderRadius: radius.lg, borderLeftWidth: 4, borderLeftColor: colors.ju, padding: space(5), marginBottom: space(4) },
  moreH: { ...font.heading, color: colors.ink, fontWeight: '900' },
  moreBody: { ...font.body, color: colors.inkSoft, marginTop: space(2) },
  moreCta: { marginTop: space(4), backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center' },
  moreCtaTx: { ...font.body, color: colors.card, fontWeight: '900' },
  moreNote: { ...font.caption, color: colors.inkSoft, marginTop: space(2.5), textAlign: 'center' },
});
