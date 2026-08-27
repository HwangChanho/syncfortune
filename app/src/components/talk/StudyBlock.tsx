// app/src/components/talk/StudyBlock.tsx — 대화창 블록: **공부하기**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26 *"유저가 명리공부도 할수있게 노쎔은 사주 명리공부로 카테고리 잡고"* ·
//   *"자미 쎔도 마찬가지로 자미두수 공부할수 있게"*.
//
// ■ ★내용을 **한 글자도 새로 쓰지 않았다**
//   `myeongriGlossary`(Boss 검수본)를 그대로 읽는다. CLAUDE.md §3 — 명리를 발명하지 않는다.
//   이 파일이 하는 일은 **순서를 매기고 묶는 것**뿐이다. 무엇을 먼저 배우면 되는지는
//   «쉬운 것 → 그 위에 얹히는 것» 이라는 학습 순서지 명리 판정이 아니다.
//
// ■ 왜 사주와 자미를 갈랐나
//   노쌤은 사주, 최자미는 자미두수를 본다. 같은 화면을 두 사람에게 주면
//   «이 선생님이 저것도 가르치나» 로 읽힌다. 담당 분야만 보여 준다.
//
// ■ 모르는 낱말을 누르면
//   기존 `GlossarySheet` 가 뜬다 — 풀이 화면이 쓰는 **그 사전**이다(사본이 아니다).
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from '../PressableScale';
import { GlossarySheet, type GlossaryTarget } from '../GlossarySheet';
import {
  TENGOD_GLOSSARY, SINSAL_GLOSSARY, GANGYAK_GLOSSARY, BASIC_GLOSSARY,
  STAGE_GLOSSARY, PALACE_GLOSSARY, STAR_GLOSSARY,
  type GlossaryKind,
} from '../../lib/content/myeongriGlossary';
import { colors, space, radius, font } from '../../lib/theme';

/** 한 묶음 = 제목 + 그 안의 낱말들. ★순서가 곧 «배우는 차례»다. */
type Unit = { title: string; hint: string; keys: string[]; kind: GlossaryKind };

const take = (o: Record<string, unknown>, n?: number) => Object.keys(o).slice(0, n ?? 99);

/** 사주 — 쉬운 것부터. 십신을 먼저 알아야 나머지가 읽힌다. */
const SAJU: Unit[] = [
  { title: '① 십신 열 가지', hint: '사주를 읽는 기본 낱말이에요. 여기부터 시작하세요.', keys: take(TENGOD_GLOSSARY), kind: 'tengod' },
  { title: '② 힘의 세기', hint: '내 기운이 센지 약한지 — 처방이 여기서 갈려요.', keys: take(GANGYAK_GLOSSARY), kind: 'gangyak' },
  { title: '③ 용신과 그 식구들', hint: '무엇을 채우고 무엇을 덜어야 하는지.', keys: take(BASIC_GLOSSARY, 10), kind: 'basic' },
  { title: '④ 십이운성', hint: '기운이 지금 어느 단계에 있는가.', keys: take(STAGE_GLOSSARY), kind: 'stage' },
  { title: '⑤ 신살', hint: '자주 듣는 도화·역마·화개부터.', keys: take(SINSAL_GLOSSARY, 12), kind: 'sinsal' },
];

/** 자미두수 — 궁을 먼저, 별을 나중에(별은 궁에 앉는다). */
const ZIWEI: Unit[] = [
  { title: '① 열두 궁', hint: '자미두수는 어느 자리부터 봐요.', keys: take(PALACE_GLOSSARY), kind: 'palace' },
  { title: '② 주요 별', hint: '그 자리에 앉는 별들.', keys: take(STAR_GLOSSARY, 14), kind: 'star' },
];

const ALL = { ...TENGOD_GLOSSARY, ...SINSAL_GLOSSARY, ...GANGYAK_GLOSSARY, ...BASIC_GLOSSARY, ...STAGE_GLOSSARY, ...PALACE_GLOSSARY, ...STAR_GLOSSARY } as Record<string, { ko: string; meaning: string }>;

/**
 * @param topic 'saju'(노쌤) · 'ziwei'(최자미)
 */
export function StudyBlock({ topic }: { topic: 'saju' | 'ziwei' }) {
  const [open, setOpen] = useState<GlossaryTarget>(null);
  const units = topic === 'ziwei' ? ZIWEI : SAJU;
  return (
    <View style={styles.wrap}>
      <Text style={styles.head}>{topic === 'ziwei' ? '자미두수 공부' : '사주 명리 공부'}</Text>
      <Text style={styles.sub}>낱말을 누르면 뜻이 나와요. 모르는 게 나오면 저한테 물어보셔도 돼요.</Text>
      {units.map((u) => (
        <View key={u.title} style={styles.unit}>
          <Text style={styles.unitTitle}>{u.title}</Text>
          <Text style={styles.unitHint}>{u.hint}</Text>
          <View style={styles.chips}>
            {u.keys.map((k) => (
              <PressableScale key={k} onPress={() => setOpen({ kind: u.kind, key: k })} style={styles.chip} hitSlop={4}>
                <Text style={styles.chipTx}>{ALL[k]?.ko ?? k}</Text>
              </PressableScale>
            ))}
          </View>
        </View>
      ))}
      {/* ★풀이 화면이 쓰는 **그 사전**을 그대로 띄운다 — 여기에 설명을 또 쓰지 않는다 */}
      <GlossarySheet target={open} onClose={() => setOpen(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space(4), gap: space(2) },
  head: { ...font.heading, color: colors.ink, fontWeight: '800' },
  sub: { ...font.caption, color: colors.inkSoft, lineHeight: 18, marginBottom: space(1) },
  unit: { gap: space(1) },
  unitTitle: { ...font.label, color: colors.ink, fontWeight: '800' },
  unitHint: { ...font.caption, color: colors.inkFaint, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(1) },
  chip: { paddingHorizontal: space(2.5), paddingVertical: space(1.5), borderRadius: radius.pill, backgroundColor: colors.sunk },
  chipTx: { ...font.caption, color: colors.ju, fontWeight: '700' },
});
