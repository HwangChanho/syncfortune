// components/HomeOrderEditModal.tsx — 홈 블록 배치 편집 (모달·간단 목록 드래그)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-21 '편집 모드' 선택: 홈 블록 자체는 내부 탭(명식 선택·좌우 슬라이드)을 가진 복잡한
//   컴포넌트라 인플레이스 롱프레스 드래그가 그 탭들과 충돌한다(→ '아래로만·느림·안 따라옴'·손잡이 타협 실패).
//   그래서 홈엔 '배치 편집' 버튼만 두고, 이 모달을 열어 **블록 이름만 든 단순한 행**을 드래그해 순서를 바꾼다.
//   단순 행 = 내부 탭이 없으니 DraggableFlatList 가 제스처 충돌 0 으로 깔끔히 동작한다.
//   완료하면 useHomeOrder(전역 스토어) 로 홈에 즉시 반영(설정 화면 순서와도 동기).
//
// ★핵심 함정: RNGH 제스처는 RN <Modal> 안에서 기본으로 동작하지 않는다(모달이 별도 네이티브 뷰 계층).
//   → 모달 내용을 **GestureHandlerRootView 로 감싸야** 드래그가 먹는다.
// ─────────────────────────────────────────────────────────────────────────
import { Modal, View, Text, StyleSheet } from 'react-native';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { TouchableOpacity, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useHomeOrder, HOME_BLOCK_LABEL, type HomeBlockKey } from '../lib/ui/homeOrder';
import { PressableScale } from './PressableScale';
import { colors, radius, space, font, shadow } from '../lib/theme';

export function HomeOrderEditModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { order, setOrder } = useHomeOrder();

  // 각 행 = 블록 이름 + 손잡이(⠿). 행 전체를 길게 눌러 드래그(RNGH Touchable → DFL pan 이 손가락 추적).
  const renderItem = ({ item, drag, isActive }: RenderItemParams<HomeBlockKey>) => (
    <ScaleDecorator activeScale={1.03}>
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={drag}
        disabled={isActive}
        delayLongPress={130}
        style={[styles.row, isActive && styles.rowActive]}
      >
        <Text style={styles.grip}>⠿</Text>
        <Text style={styles.label}>{HOME_BLOCK_LABEL[item]}</Text>
      </TouchableOpacity>
    </ScaleDecorator>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* ★GestureHandlerRootView 필수 — 없으면 모달 안에서 드래그가 안 먹는다. */}
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.backdrop}>
          {/* 배경 탭 = 닫기 */}
          <PressableScale style={styles.backdropTap} onPress={onClose} />
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>홈 배치 편집</Text>
              <Text style={styles.hint}>행을 길게 눌러 위아래로 옮기세요</Text>
            </View>
            <DraggableFlatList
              data={order}
              keyExtractor={(k) => k}
              renderItem={renderItem}
              onDragEnd={({ data }) => setOrder(data)}
              contentContainerStyle={{ paddingVertical: space(1) }}
              showsVerticalScrollIndicator={false}
            />
            <PressableScale style={styles.done} onPress={onClose}>
              <Text style={styles.doneTx}>완료</Text>
            </PressableScale>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  backdropTap: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingTop: space(5), paddingHorizontal: space(5), paddingBottom: space(8), maxHeight: '82%',
  },
  header: { marginBottom: space(4) },
  title: { ...font.heading, color: colors.ink, fontWeight: '900' },
  hint: { ...font.caption, color: colors.inkSoft, marginTop: space(1) },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space(3),
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    paddingVertical: space(4), paddingHorizontal: space(4), marginBottom: space(2.5),
  },
  rowActive: { borderColor: colors.ju, ...shadow.card },
  grip: { color: colors.ju, fontSize: 18, fontWeight: '900', letterSpacing: -2 },
  label: { ...font.body, color: colors.ink, fontWeight: '700' },
  done: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center', marginTop: space(3) },
  doneTx: { color: '#231c05', fontWeight: '800', fontSize: 15 },
});
