// app/src/components/FortuneVideoCard.tsx — **월별·년별 운세 풀이 영상**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-25 *"월별운세같은건 영상으로 만들어서 풀어줄수 있게 하자"*
//
// ■ ★08-05 에 없앤 영상과 **다른 것**이다
//   그때 없앤 것은 **장식**(풀이 진입 연출·로딩화면)이고, 문제는 둘이었다:
//     ①mp4 를 **번들에 넣어** 11MB 가 붙었다  ②껐는데 계속 나오는 게이트 버그
//   이건 사용자가 **보러 오는 콘텐츠**이고, **원격 URL 스트리밍**이라 번들이 안 붙는다.
//   Boss 정정: *"저건 풀이진입 영상이랑 로딩화면 이야기고 월별 년별 전체 운세풀이 영상은 다른거잖아"*
//   ⇒ `check:reading-video` 를 장식/콘텐츠로 갈라 놨다(V2 번들 금지는 그대로).
//
// ■ 영상은 **운영자가 넣는다**(앱 배포 없이)
//   `app_config.fortune_video` = `{ "2026-08": "https://…", "2026": "https://…" }`
//   · 월 키 = `YYYY-MM` · 연 키 = `YYYY`
//   · 그 달/해 영상이 **없으면 아무것도 그리지 않는다** — 빈 재생기를 남기지 않는다.
//
// ■ ⚠️mp4 를 `require` 하지 말 것 — 번들에 실린다(V2 가 막는다). 항상 **원격 URL**.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/core/withTimeout';
import { colors, radius, space, font } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';
import { useHeroCap } from '../lib/ui/heroSize';   // ★넓은 웹에서 16:9 가 700px 로 자라는 것을 막는다

/** 이 달/해의 영상 주소를 가져온다. 없으면 null(그리지 않는다). */
async function loadVideoUrl(key: string): Promise<string | null> {
  try {
    const r = await withTimeout(
      supabase.from('app_config').select('value').eq('key', 'fortune_video').maybeSingle(), 8000,
    ) as { data?: { value?: unknown } | null; error?: unknown } | undefined;
    if (!r || r.error) return null;
    const map = r.data?.value;
    if (!map || typeof map !== 'object') return null;
    const url = (map as Record<string, unknown>)[key];
    // ★http(s) 만 받는다 — 다른 스킴은 재생기에 넘기지 않는다
    return typeof url === 'string' && /^https?:\/\//.test(url) ? url : null;
  } catch { return null; }
}

/**
 * 운세 풀이 영상 카드.
 *
 * @param periodKey `2026-08`(월) 또는 `2026`(연)
 * @param title     카드 제목(예: `이달의 운세 영상`)
 */
export function FortuneVideoCard({ periodKey, title }: { periodKey: string; title: string }) {
  const { fs } = useFontScale();
  // ⚠️`aspectRatio: 16/9` 는 전폭이면 데스크톱 컬럼(1120px)에서 **630px** 로 자란다.
  //   `check:herosize` H2 가 잡아 줬다 — 넓은 웹에서만 높이를 묶는다(네이티브는 그대로).
  const cap = useHeroCap();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void loadVideoUrl(periodKey).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [periodKey]);

  // ⚠️훅은 조건 위에서 부른다 — url 이 없으면 플레이어에 null 을 준다(훅 순서를 흔들지 않는다)
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.muted = false;   // 콘텐츠 영상이라 소리가 주인공이다(장식이 아니다)
  });

  // ★영상이 없으면 **아무것도 그리지 않는다** — 빈 재생기는 고장으로 보인다
  if (!url) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { fontSize: fs(13.5), lineHeight: Math.round(fs(13.5) * 1.5) }]}>{title}</Text>
      <VideoView
        style={[styles.video, cap]}
        player={player}
        allowsFullscreen
        nativeControls
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space(3), marginBottom: space(2) },
  title: { ...font.body, color: colors.ink, fontWeight: '800', marginBottom: space(2), paddingHorizontal: space(1) },
  // 16:9 — 세로 영상이 오면 `contentFit="contain"` 이 레터박스로 받는다(잘리지 않게)
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.sunk, borderRadius: radius.md, overflow: 'hidden' },
});
