/**
 * app/src/components/talk/BirthDraftCard.tsx — 대화 안에서 **명식 만들기**
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-26 *"명식 등록을 안하고 대화에서 그냥 1994 03 16 유시 이렇게 입력할수도 있잖아
 *   그러면 여기서 필요한게 태어난곳 양력 음력 여부 성별 여부니깐 이런걸 되물어야지"*
 *
 * ■ ★여기서 여덟 글자를 세지 않는다
 *   세는 것은 **엔진**이다(`addChart` → `computeChart`). CLAUDE.md 절대규칙 1.
 *   모델에게 맡겼다가 **틀린 일주**를 지어낸 사고가 있었다(경오 ❌ / 신축 ⭕).
 *   이 카드가 하는 일은 «모자란 것을 받아서 엔진에 넘기는 것»뿐이다.
 *
 * ■ 왜 말풍선이 아니라 카드인가
 *   자유 문장 파싱은 반드시 틀린다. **읽은 값을 보여 주고 고칠 수 있게** 해야
 *   엉뚱한 사주로 명식이 만들어지지 않는다. 되묻기는 말로, 확정은 **눈으로** 한다.
 *
 * ■ 되돌리기
 *   여기서 만든 명식도 그냥 명식이다 — 목록에서 지우면 된다.
 */
//
// keyboard-safe: 이 카드는 `talk.tsx` 에서 **입력바(composer) 바로 위**에 그려진다(일반 흐름).
//   그 입력바가 `marginBottom: lift` 로 키보드만큼 올라가므로(talk.tsx:846 · Keyboard 리스너),
//   위에 있는 이 카드도 **같이 밀려 올라간다.** 스스로 리스너를 달면 **두 번 올라간다.**
//   ⚠️근거를 적어 두는 이유: `check:keyboard` R1 이 이 파일을 «회피 수단 없음» 으로 잡았고,
//     실제로 vc123 iOS 빌드를 **preflight 가 막았다**(게이트가 제대로 일했다).
//     확인한 것 — talk.tsx:1059·1126 두 렌더 경로 모두 `{birthCard}` 가 `{composer}` **바로 앞**이다.
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { PressableScale } from '../PressableScale';
import { colors, space, radius, font } from '../../lib/theme';
import { MISSING_LABEL, type BirthDraft } from '../../lib/talk/birthParse';

/** 십이지 — 시각을 모를 때 고르게 한다(«유시» 처럼 말하는 사람이 많다). */
const BRANCHES: { k: string; label: string; time: string }[] = [
  { k: '자', label: '자 (23~01)', time: '00:00' }, { k: '축', label: '축 (01~03)', time: '02:00' },
  { k: '인', label: '인 (03~05)', time: '04:00' }, { k: '묘', label: '묘 (05~07)', time: '06:00' },
  { k: '진', label: '진 (07~09)', time: '08:00' }, { k: '사', label: '사 (09~11)', time: '10:00' },
  { k: '오', label: '오 (11~13)', time: '12:00' }, { k: '미', label: '미 (13~15)', time: '14:00' },
  { k: '신', label: '신 (15~17)', time: '16:00' }, { k: '유', label: '유 (17~19)', time: '18:00' },
  { k: '술', label: '술 (19~21)', time: '20:00' }, { k: '해', label: '해 (21~23)', time: '22:00' },
];

export type BirthCardResult = {
  birthDateTime: string; calendar: '양' | '음';
  timeAccuracy: '정확' | '추정' | '미상'; sex: '남' | '여'; birthPlace: string;
};

/**
 * @param draft  대화에서 읽어 낸 값(비어 있는 칸은 여기서 받는다)
 * @param onMake 다 모였을 때 — 부모가 `addChart` 로 **엔진에** 넘긴다
 */
export function BirthDraftCard({ draft, onMake, busy }: {
  draft: BirthDraft;
  onMake: (r: BirthCardResult) => void;
  busy?: boolean;
}) {
  const [cal, setCal] = useState<'양' | '음' | null>(draft.calendar);
  const [sex, setSex] = useState<'남' | '여' | null>(draft.sex);
  const [place, setPlace] = useState(draft.place ?? '');
  const [time, setTime] = useState<string | null>(draft.time);
  const [unknownTime, setUnknownTime] = useState(draft.timeAccuracy === '미상');

  // ★날짜는 여기서 못 고친다 — 읽은 날짜가 틀렸으면 **다시 말하는 게** 맞다(카드가 새로 뜬다).
  //   여기에 날짜 입력까지 넣으면 카드가 등록 화면이 되어 버린다.
  const ready = !!draft.date && !!cal && !!sex && place.trim().length > 0 && (unknownTime || !!time);

  const chip = (on: boolean) => [styles.chip, on && styles.chipOn];
  const chipTx = (on: boolean) => [styles.chipTx, on && styles.chipTxOn];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>이 정보로 명식을 만들까요?</Text>
      <Text style={styles.read}>
        {draft.date ?? '(생년월일을 못 읽었어요)'}
        {unknownTime ? ' · 시각 모름' : time ? ` · ${time}` : ''}
      </Text>
      {/* ★왜 더 묻는지 한 줄로 — 안 그러면 «왜 이런 걸 물어보지» 가 된다 */}
      <Text style={styles.why}>
        태어난 곳은 진태양시 보정에 쓰여요 — 이게 없으면 시주가 달라질 수 있어요.
      </Text>

      {!draft.time && !unknownTime ? (
        <>
          <Text style={styles.label}>{MISSING_LABEL.time}</Text>
          <View style={styles.row}>
            {BRANCHES.map((b) => (
              <PressableScale key={b.k} style={chip(time === b.time)} onPress={() => setTime(b.time)}>
                <Text style={chipTx(time === b.time)}>{b.label}</Text>
              </PressableScale>
            ))}
            <PressableScale style={chip(false)} onPress={() => { setUnknownTime(true); setTime(null); }}>
              <Text style={chipTx(false)}>모름</Text>
            </PressableScale>
          </View>
        </>
      ) : null}

      <Text style={styles.label}>{MISSING_LABEL.calendar}</Text>
      <View style={styles.row}>
        {(['양', '음'] as const).map((c) => (
          <PressableScale key={c} style={chip(cal === c)} onPress={() => setCal(c)}>
            <Text style={chipTx(cal === c)}>{c === '양' ? '양력' : '음력'}</Text>
          </PressableScale>
        ))}
      </View>

      <Text style={styles.label}>{MISSING_LABEL.sex}</Text>
      <View style={styles.row}>
        {(['남', '여'] as const).map((g) => (
          <PressableScale key={g} style={chip(sex === g)} onPress={() => setSex(g)}>
            <Text style={chipTx(sex === g)}>{g === '남' ? '남성' : '여성'}</Text>
          </PressableScale>
        ))}
      </View>

      <Text style={styles.label}>{MISSING_LABEL.place}</Text>
      <TextInput
        style={styles.input}
        value={place}
        onChangeText={setPlace}
        placeholder="예) 서울 · 부산 · 밀라노"
        placeholderTextColor={colors.inkFaint}
      />

      <PressableScale
        style={[styles.go, (!ready || busy) && styles.goOff]}
        onPress={() => {
          if (!ready || busy || !draft.date) return;
          onMake({
            birthDateTime: `${draft.date} ${unknownTime ? '00:00' : time}`,
            calendar: cal!, sex: sex!, birthPlace: place.trim(),
            // ★시각을 모르면 **미상**으로 넘긴다 — 엔진이 유령 子시를 실재처럼 쓰지 않게(spec/chart.ts)
            timeAccuracy: unknownTime ? '미상' : (draft.timeAccuracy ?? '추정'),
          });
        }}
      >
        <Text style={styles.goTx}>{busy ? '만드는 중…' : '명식 만들기'}</Text>
      </PressableScale>
      {!ready ? <Text style={styles.hint}>위에서 못 채운 것을 골라 주세요.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine,
    padding: space(4), gap: space(1), width: '100%',
  },
  title: { ...font.body, fontWeight: '800', color: colors.ink },
  read: { ...font.label, color: colors.ju, fontWeight: '800', marginTop: space(1) },
  why: { ...font.caption, color: colors.inkFaint, lineHeight: 16, marginTop: space(1) },
  label: { ...font.caption, color: colors.inkSoft, fontWeight: '700', marginTop: space(3) },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(1) },
  chip: {
    paddingVertical: space(1.5), paddingHorizontal: space(2.5), borderRadius: radius.pill,
    backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  chipTxOn: { color: colors.onJu },
  input: {
    marginTop: space(1), backgroundColor: colors.sunk, borderRadius: radius.md,
    paddingHorizontal: space(3), paddingVertical: space(2.5), ...font.body, color: colors.ink,
  },
  go: {
    marginTop: space(4), backgroundColor: colors.ju, borderRadius: radius.md,
    paddingVertical: space(3), alignItems: 'center',
  },
  goOff: { opacity: 0.45 },
  goTx: { ...font.body, fontWeight: '800', color: colors.onJu },
  hint: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(1.5) },
});
