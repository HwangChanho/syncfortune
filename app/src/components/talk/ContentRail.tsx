// app/src/components/talk/ContentRail.tsx — 콘텐츠 가로 레일
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-20(카톡 실화면 지정): *"업데이트 프로필에는 우리 컨텐츠 하나씩 접근할수있게
//   저모양대로"*.
//   카톡의 「업데이트 프로필」 자리 = 동그란 얼굴이 가로로 흐르는 줄. 그 자리에 **우리 콘텐츠**를 둔다.
//
// ■ 왜 여기에 콘텐츠를 두나
//   친구목록은 사람 다섯뿐이라 세로가 비었다. 그 위 가로 한 줄이면
//   **아홉 개를 한 화면에** 두면서도 목록을 밀어내지 않는다(세로로 쌓으면 친구가 화면 밖으로 나간다).
//
// ■ ★홈 블록과 **같은 키**를 쓴다
//   `homeOrder` 의 블록 키를 그대로 받는다 — 여기서 새 목록을 만들면 운영자가 관리자에서
//   홈 구성을 바꿔도 이 줄만 그대로 남는다.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PressableScale } from '../PressableScale';
import { contentIcon, type ContentIcon } from '../../lib/ui/brandAsset';
import { HOME_BLOCK_LABEL, type HomeBlockKey } from '../../lib/ui/homeOrder';
import { colors, space, radius, font } from '../../lib/theme';

/** 블록 → 화면 경로. ★상세가 없는 블록은 레일에 올리지 않는다(눌러도 갈 곳이 없다). */
const ROUTE: Partial<Record<HomeBlockKey, string>> = {
  today: '/today',
  free3: '/contents',
  self: '/selfanalysis',
  persona: '/personatype',
  relation: '/compat',
  relmap: '/relationmap',
  biorhythm: '/biorhythm',
  luck: '/bok',
  decision: '/taegil',
};

/** 블록 → 아이콘. ★`contentIcon` 열 종 안에서만 고른다(없는 그림을 지어내지 않는다). */
const ICON: Partial<Record<HomeBlockKey, ContentIcon>> = {
  today: 'crystal',
  free3: 'book',
  self: 'idcard',
  persona: 'idcard',
  relation: 'heart',
  relmap: 'family',
  biorhythm: 'health',
  luck: 'coin',
  decision: 'crystal',
};

/** 이 블록이 레일에 오를 수 있나(= 갈 화면이 있나). ★목록과 개수가 어긋나지 않게 같은 판정을 쓴다. */
export const hasRailRoute = (k: HomeBlockKey): boolean => !!ROUTE[k];

/** 접었을 때 보여 줄 개수(Boss 2026-08-20 *"노출은 3개만"*). */
const COLLAPSED = 3;

/**
 * 콘텐츠 레일.
 *
 * ★가로 스크롤이 아니라 **접기/펼치기**다.
 *   가로로 흘리면 화면 밖에 있는 것은 **있는 줄도 모르고**, 아홉 개를 다 펴면
 *   목록 위 한 줄이 아니라 화면 절반을 먹는다. ⇒ 셋만 보이고 원하면 편다.
 *
 * @param keys 보여 줄 블록 키(홈 순서 그대로). 경로가 없는 키는 스스로 빠진다
 */
export function ContentRail({ keys }: { keys: readonly HomeBlockKey[] }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const items = keys.filter((k) => ROUTE[k]);
  if (!items.length) return null;
  const shown = open ? items : items.slice(0, COLLAPSED);
  const more = items.length - COLLAPSED;
  // ★가로 스크롤이 아니라 **줄바꿈**이다(Boss 2026-08-20 *"콘텐츠가 다 노출되게"*).
  //   가로로 흘리면 화면 밖에 있는 것은 **있는 줄도 모른다** — 목록 위 한 줄은 훑어보는 자리지
  //   스크롤해서 찾는 자리가 아니다. 줄이 늘어도 다 보이는 편이 낫다.
  return (
    <View style={styles.rail}>
      {shown.map((k) => (
        <PressableScale key={k} style={styles.cell} onPress={() => router.push(ROUTE[k] as never)}>
          <View style={styles.circle}>
            <ExpoImage source={contentIcon(ICON[k] ?? 'crystal')} style={styles.icon} contentFit="contain" />
          </View>
          {/* ★이름은 두 줄까지 — 자르면 「나는 어떤…」처럼 무엇인지 알 수 없게 된다 */}
          <Text style={styles.label} numberOfLines={2}>{HOME_BLOCK_LABEL[k]}</Text>
        </PressableScale>
      ))}
      {/* 더보기 / 접기 — ★둘 다 둔다(Boss 2026-08-20).
          처음엔 "한 번 편 사람은 계속 보고 싶다"고 보고 접기를 뺐는데, 그건 내 짐작이었다.
          펼치면 아홉 개가 화면을 꽤 먹으므로 **되돌릴 길**이 있어야 한다.
          ★같은 자리에 있어야 한다 — 편 버튼과 접는 버튼이 다른 곳에 있으면 눈이 다시 찾아야 한다. */}
      {more > 0 ? (
        <PressableScale style={styles.cell} onPress={() => setOpen((v) => !v)}>
          <View style={[styles.circle, styles.moreCircle]}>
            <Text style={styles.moreTx}>{open ? '−' : `+${more}`}</Text>
          </View>
          <Text style={styles.label} numberOfLines={2}>
            {open ? t('talk.collapse', '접기') : t('talk.more', '더보기')}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // ★`flexWrap` + `gap` — 칸이 좁으면 줄이 늘고, 넓으면 한 줄에 다 들어간다.
  //   폭에 따라 열 수를 계산하지 않는다(계산하면 화면 크기가 바뀔 때마다 틀어진다).
  rail: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: space(2), gap: space(3) },
  // 한 칸 = 원 + 이름. 폭을 고정해야 이름 길이에 따라 줄이 들쭉날쭉하지 않다
  cell: { width: 62, alignItems: 'center', gap: space(1.5) },
  // ★카톡 기준 비율로 잡았다(화면 폭의 약 12%) — 48pt.
  circle: {
    width: 48, height: 48, borderRadius: radius.lg,
    backgroundColor: colors.sunk, alignItems: 'center', justifyContent: 'center',
  },
  icon: { width: 26, height: 26 },
  // 더보기 — 아이콘 대신 남은 개수를 적는다(무엇이 더 있는지는 눌러야 알지만, 몇 개인지는 미리 알려준다)
  moreCircle: { borderWidth: 1, borderColor: colors.line, backgroundColor: 'transparent' },
  moreTx: { ...font.label, color: colors.inkSoft, fontWeight: '800' },
  label: { ...font.caption, color: colors.inkSoft, textAlign: 'center', lineHeight: 14 },
});
