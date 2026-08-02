// app/src/components/GlossarySheet.tsx — 명리 용어 설명 바텀시트(공통)
// ─────────────────────────────────────────────────────────────────────────
// 가독성 P2(축4 용어 가독성 · [[reading-visibility-plan]]). **풀이 본문**에서 명리 용어를 탭하면 뜬다.
//   유료 통변 프롬프트는 본문에 전문어를 쓰지 말라고 지시하지만 실측하면 새어 나오므로(예: "정관이 두
//   곳에 투출"), 독자가 거기서 막히지 않게 두는 **안전망**이다.
//
// 콘텐츠는 새로 만들지 않는다 — `lib/content/myeongriGlossary` 의 기존 사전(daniel 검수본)을 그대로 조회한다.
// ※ 만세력(MyeongsikScreen)에도 같은 모양의 시트가 화면 내부에 인라인으로 있다. 잘 돌고 있는 코드라
//   이번엔 건드리지 않았고, 이 컴포넌트는 풀이 쪽에서 쓴다. 만세력을 이걸로 교체하면 단일출처가 된다(후보).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { PressableScale } from './PressableScale';
import { lookupGlossary, GLOSSARY_KIND_LABEL, type GlossaryKind } from '../lib/content/myeongriGlossary';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, font } from '../lib/theme';

export type GlossaryTarget = { kind: GlossaryKind; key: string } | null;

/**
 * 용어 설명 바텀시트.
 * @param target 표시할 용어(kind+key). null 이면 닫힘.
 * @param onClose 닫기 콜백
 */
export function GlossarySheet({ target, onClose }: { target: GlossaryTarget; onClose: () => void }) {
  const { fs } = useFontScale();
  const entry = target ? lookupGlossary(target.kind, target.key) : null;
  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      {/* 바깥 탭 = 닫기 / 안쪽 탭은 전파 차단(만세력 시트와 동일 관례) */}
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          {entry ? (
            <>
              <Text style={[styles.kind, { fontSize: fs(12) }]}>{GLOSSARY_KIND_LABEL[target!.kind]}</Text>
              <Text style={[styles.title, { fontSize: fs(20) }]}>{entry.ko}{entry.hanja ? `   ${entry.hanja}` : ''}</Text>
              <Text style={[styles.meaning, { fontSize: fs(15), lineHeight: Math.round(15 * 1.7) }]}>{entry.meaning}</Text>
              {entry.keywords?.length ? (
                <View style={styles.chips}>
                  {entry.keywords.map((k, i) => <Text key={i} style={[styles.chip, { fontSize: fs(12) }]}>{k}</Text>)}
                </View>
              ) : null}
            </>
          ) : (
            // 사전에 없는 용어 — 조용히 닫히지 않게 최소 안내(빈 시트 방지)
            <Text style={[styles.meaning, { fontSize: fs(15) }]}>{target?.key}</Text>
          )}
          <PressableScale style={styles.close} onPress={onClose}>
            <Text style={[styles.closeTx, { fontSize: fs(15) }]}>닫기</Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space(6), paddingBottom: space(10) },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: space(4) },
  kind: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.5, marginBottom: space(1) },
  title: { ...font.title, color: colors.ink, fontWeight: '900', marginBottom: space(3) },
  meaning: { ...font.body, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(4) },
  chip: { ...font.caption, color: colors.inkSoft, backgroundColor: colors.sunk, borderRadius: 999, paddingVertical: space(1), paddingHorizontal: space(3), overflow: 'hidden' },
  close: { marginTop: space(6), borderWidth: 1, borderColor: colors.juLine, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center' },
  closeTx: { ...font.body, color: colors.ju, fontWeight: '800' },
});
