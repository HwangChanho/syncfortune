// app/src/components/LuckNest.tsx — 운의 중첩(벤다이어그램식) 시각화
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-05: "원국 → 일운 → 월운 → 년운 → 대운 감싸는 형태. 원국이 제일 안쪽."
// daniel 2차 피드백(같은 날): ①간지는 **기존 색깔 한자(GzCell)** 로 ②일운이 가장 안쪽
//   (첫 판이 reduceRight 라 반대로 감쌌다 — rings[0]이 바깥이 됐던 버그) ③운을 다 꺼도 원국 유지.
//
// ■ 조립: rings.reduce — rings[0](일운)이 **가장 먼저 원국을 감싼다** = 제일 안쪽 띠.
//   reduceRight 를 쓰면 rings[0]이 마지막에 감싸 제일 바깥이 된다(1차 버그 — 음성확인 완료).
// ■ 간지 = GzCell(오행색+한자+한글음 토글) — 만세력 대운/세운 카드와 같은 단일 출처.
// ■ rings 가 비면 원국 상자만 렌더(운 전부 꺼도 원국은 남는다).
// ⚠️명리 판정 0 — 이미 계산된 값(만세력 선택 상태)을 자리만 바꿔 그린다.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, space, radius, font } from '../lib/theme';
import { GzCell } from './GzCell';
import { sortPillarsForDisplay } from '../lib/ui/pillarOrder'; // ★표기 순서 단일 소스(오른쪽=년주)

export type NestRing = {
  label: string;            // '일운' 등 — 순서는 배열이 정함: **[0] = 제일 안쪽**
  stem: string;
  branch: string;
  sub?: string;             // 보조 표기(십신 등)
};

export type NestPillar = { pos: string; stem: string; branch: string };

// 층별 띠 색(안 → 밖, 점점 짙게) — ★쿨 블루그레이(daniel 2026-08-05 3차 "금 색상이 잘 안 보여").
//   1차 베이지 팔레트가 金 셀색(#D2CCBA·베이지)과 같은 계열이라 金 간지가 링에 묻혔다.
//   앱 배경(라이트 블루그레이) 계열로 바꿔 다섯 오행색이 모두 또렷하게.
const RING_TINT = ['#F2F4F8', '#E7EBF2', '#DBE1EB', '#CED6E4'];
const RING_EDGE = ['#D9DEE8', '#CCD3E0', '#BFC8D8', '#B1BCCF'];

/**
 * 운 중첩(양파) 다이어그램.
 * @param natal 원국 기둥(년월일시 순, 시각 미상이면 3주) — 제일 안쪽 상자.
 * @param rings 감싸는 층들. **[0]=제일 안쪽**(daniel: 일운→월운→년운→대운 순으로 넘길 것).
 * @param hangeul 한자 옆 한글음 표시(만세력 토글과 연동)
 */
export function LuckNest({ natal, rings, hangeul }: { natal: NestPillar[]; rings: NestRing[]; hangeul?: boolean }) {
  // 원국 미니 그리드 — 전통 표기(**오른쪽 = 년주**). 간지 = 색깔 한자(GzCell).
  // ★2026-08-16 수정(daniel *"년주 월주 일주 시주 순으로 오른쪽부터"*):
  //   여기서 `[...natal].reverse()` 를 하고 있었다. "년월일시로 들어온다"는 전제였는데
  //   호출부(만세력)의 `POS` 는 **이미 `['시','일','월','년']`(전통 순서)** 이라 한 번 더 뒤집혀
  //   벤다이어그램만 년주가 왼쪽으로 나갔다 — 바로 위 본 명식 그리드와 방향이 반대였다.
  //   ⇒ 배열 순서에 기대지 말고 **자리 이름으로 정렬**한다(누가 어떤 순서로 넘겨도 그림이 같다).
  const core = (
    <View style={styles.core}>
      <View style={styles.coreRow}>
        {sortPillarsForDisplay(natal).map((p) => (
          <View key={p.pos} style={styles.corePillar}>
            <Text style={styles.corePos}>{p.pos}</Text>
            <GzCell char={p.stem} kind="stem" size={Platform.OS === 'web' ? 'sm' : 'xs'} scale={Platform.OS === 'web' ? 1 : 0.92} hangeul={hangeul} />
            <GzCell char={p.branch} kind="branch" size={Platform.OS === 'web' ? 'sm' : 'xs'} scale={Platform.OS === 'web' ? 1 : 0.92} hangeul={hangeul} />
          </View>
        ))}
      </View>
      <Text style={styles.coreLabel}>원국</Text>
    </View>
  );

  // ★reduce(왼→오): rings[0]=일운이 원국을 가장 먼저 감싼다 = 제일 안쪽.
  return rings.reduce<React.ReactElement>((child, r, i) => (
    <View key={r.label} style={[styles.ring, { backgroundColor: RING_TINT[i] ?? RING_TINT[3], borderColor: RING_EDGE[i] ?? RING_EDGE[3] }]}>
      <View style={styles.ringHead}>
        <Text style={styles.ringLabel}>{r.label}</Text>
        <GzCell char={r.stem} kind="stem" size={Platform.OS === 'web' ? 'sm' : 'xs'} scale={Platform.OS === 'web' ? 1 : 0.95} hangeul={hangeul} />
        <GzCell char={r.branch} kind="branch" size={Platform.OS === 'web' ? 'sm' : 'xs'} scale={Platform.OS === 'web' ? 1 : 0.95} hangeul={hangeul} />
        {r.sub ? <Text style={styles.ringSub}>{r.sub}</Text> : null}
      </View>
      {child}
    </View>
  ), core);
}

const styles = StyleSheet.create({
  /**
   * ★★웹에서는 **한 단계 크게, 위아래를 띄운다** (Boss 2026-08-27
   *   *"웹에서 벤다이어 그램 사이즈 더 키워줘 위아래 여백좀 있게"*).
   *   ■ 왜 웹만인가 — 폰은 화면이 좁아 지금 크기가 맞다. 웹은 남는 공간이 많은데
   *     폰 크기 그대로라 **한가운데 작은 그림**으로 보인다.
   *   ★`Platform` 하나로 가른다 — 창 너비로 가르면 2칸 화면에서 또 어긋난다.
   */
  ring: {
    borderWidth: 1, borderRadius: radius.lg,
    padding: space(Platform.OS === 'web' ? 3 : 1.5),
    paddingTop: space(Platform.OS === 'web' ? 2.5 : 1),
    ...(Platform.OS === 'web' ? { marginVertical: space(2) } : null),
    /**
     * ★★2026-09-01 Boss *"밴다이어 그램 안에 공백이 너무 많아"* — 실측(웹 1900px)에서
     *   고리가 **화면 폭을 다 먹고** 원국은 오른쪽에 몰려, 왼쪽이 통째로 비어 있었다.
     * ■ 왜 그랬나 — 고리는 `View` 라 **기본이 «폭 전부»** 다. 안쪽 내용은 그보다 훨씬 좁다.
     *   고리가 넷이면 그 빈칸이 **네 겹으로** 쌓인다.
     * ⇒ 고리를 **내용 폭만큼만** 잡고(`alignSelf:'center'`), 그 다음에 가운데로 놓는다.
     *   ⚠️`alignItems:'center'` 로는 안 된다 — 그건 **자식**을 가운데 놓을 뿐,
     *     고리 자신은 여전히 폭을 다 먹는다(그래서 테두리 안쪽이 빈다).
     * ★폰은 원래 화면이 좁아 고리가 거의 꽉 찬다 — 이 값이 있어도 보이는 게 안 바뀐다.
     */
    alignSelf: 'center',
  },
  ringHead: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), marginBottom: space(1.5), paddingHorizontal: space(0.5) },
  ringLabel: { ...font.caption, color: colors.inkSoft, fontWeight: '800' },
  ringSub: { ...font.caption, color: colors.inkFaint },
  // 원국 코어 — 흰 카드로 주인공 대비
  core: {
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ju, borderRadius: radius.md,
    paddingVertical: space(Platform.OS === 'web' ? 3.5 : 2),
    paddingHorizontal: space(Platform.OS === 'web' ? 2.5 : 1),
    alignItems: 'center',
  },
  coreRow: { flexDirection: 'row', gap: space(1), flexShrink: 1 },
  corePillar: { alignItems: 'center' },
  corePos: { fontSize: 10, lineHeight: 14, color: colors.inkFaint, fontWeight: '700', marginBottom: 2 },
  coreLabel: { ...font.caption, color: colors.ju, fontWeight: '800', marginTop: space(1.5) },
});
