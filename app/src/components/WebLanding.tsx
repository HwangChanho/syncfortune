// app/src/components/WebLanding.tsx — 웹으로 처음 들어온 사람에게 '이게 뭔지' 먼저 말한다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-15: 웹 UI 개편 — 첫 방문자 랜딩.
//
// ■ 왜 필요한가
//   앱은 **설치라는 문턱**이 이미 설명을 대신한다(스토어 페이지를 보고 받는다).
//   웹은 링크 하나로 들어오므로 **첫 화면이 곧 소개**다. 지금은 곧바로 홈이라
//   "이게 뭐 하는 서비스인지" 말하는 자리가 없었다.
//
// ■ 무엇을 말하나 — 앱이 실제로 하는 것만
//   ① 사주와 자미두수를 결합한 복합 해석(Boss 문구) ② 관계 지도 ③ 정밀 만세력
//   ④ 누구에게나 같은 글이 아니다
//   ★없는 기능을 약속하지 않는다. 여기 적힌 네 줄은 전부 지금 코드가 하는 일이다.
//
// ■ 언제 보이나
//   **웹 + 등록된 명식 0개**일 때만. 명식이 생기면 사라진다(그때부턴 홈이 할 일이 있다).
//   네이티브에서는 아예 렌더되지 않는다.
// ═══════════════════════════════════════════════════════════════════════════
import { View, Text, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { RELMAP_HERO } from '../lib/content/relationMapImages'; // 성좌도 — 이미 있는 자산을 쓴다
import { useWebCols } from './WebShell';
import { PressableScale } from './PressableScale';
import { colors, radius, space } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';

/** 특징 3칸 — 문구는 실제 기능에서 그대로 가져왔다(스토어 설명과 같은 말). */
const FEATURES = [
  {
    k: 'map',
    title: '관계 지도',
    body: '가족·친구·동료를 등록하면 각자가 나에게 어떤 자리에 서는 사람인지 한 장의 지도로 그려집니다. 점을 누르면 그 사람과 나의 궁합까지.',
    tag: '무료 · 기기 안에서 계산',
  },
  {
    k: 'engine',
    title: '정밀 만세력',
    body: '진태양시·출생지 경도·역사적 표준자오선·서머타임을 보정합니다. 같은 시각이라도 태어난 도시가 다르면 시주가 달라집니다.',
    tag: '8분 차이도 다른 결과',
  },
  {
    k: 'unique',
    title: '누구에게나 같은 글이 아닙니다',
    body: '열두 별자리 같은 분류함이 없습니다. 같은 문장을 두 사람이 받는 일이 없고, 모든 결과는 그 사람의 명식에서 계산돼 나옵니다.',
    tag: '사주 × 자미두수 교차',
  },
];

export function WebLanding() {
  const router = useRouter();
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const cols = useWebCols();
  const s = mkStyles(fs);

  return (
    <View style={s.wrap}>
      {/* 히어로 — 그림 위에 글. 좁은 화면에서도 같은 구성이라 분기가 없다 */}
      <View style={s.hero}>
        <ExpoImage source={RELMAP_HERO} style={StyleSheet.absoluteFill as never} contentFit="cover" transition={200} />
        <View style={s.scrim} />
        <View style={s.heroTx}>
          <Text style={s.brand}>니운내운</Text>
          <Text style={s.tagline}>사주와 자미두수를 결합한 복합적인 해석</Text>
          <Text style={s.lead}>
            생년월일시로 명식을 계산하고, 그 계산으로 나와 내 주변 사람을 읽습니다.
          </Text>
          <View style={s.ctas}>
            <PressableScale style={s.cta} onPress={() => router.push('/light')}>
              <Text style={s.ctaTx}>{t('home.lightCta', '가볍게 보기')}</Text>
            </PressableScale>
            <PressableScale style={s.ctaGhost} onPress={() => router.push('/register')}>
              <Text style={s.ctaGhostTx}>{t('home.noChartCta', '+ 명식 등록')}</Text>
            </PressableScale>
          </View>
          <Text style={s.note}>가입 없이 시작 · 생년월일만 넣으면 바로 결과 · 저장하지 않습니다</Text>
        </View>
      </View>

      {/* 특징 — 넓으면 3열, 좁으면 세로 */}
      <View style={[s.feats, cols > 1 && s.featsRow]}>
        {FEATURES.map((f) => (
          <View key={f.k} style={[s.feat, cols > 1 && s.featCol]}>
            <Text style={s.featTag}>{f.tag}</Text>
            <Text style={s.featTitle}>{f.title}</Text>
            <Text style={s.featBody}>{f.body}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const mkStyles = (fs: (n: number) => number) => StyleSheet.create({
  wrap: { marginBottom: space(5) },
  hero: { height: 300, borderRadius: radius.md, overflow: 'hidden', justifyContent: 'flex-end' },
  // 그림 위 글이 읽히게 어둡게 깐다 — 원본이 어두운 남색이라 옅게만
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,17,45,0.45)' },
  heroTx: { padding: space(6) },
  brand: { color: '#fff', fontSize: fs(30), lineHeight: fs(38), fontWeight: '900' },
  tagline: { color: '#E7DEFF', fontSize: fs(15), lineHeight: fs(23), fontWeight: '700', marginTop: space(1) },
  lead: { color: 'rgba(255,255,255,0.82)', fontSize: fs(14), lineHeight: fs(22), marginTop: space(3), maxWidth: 520 },
  ctas: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(4), flexWrap: 'wrap' },
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(6) },
  ctaTx: { color: '#fff', fontSize: fs(15), lineHeight: fs(21), fontWeight: '800' },
  ctaGhost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(5) },
  ctaGhostTx: { color: '#fff', fontSize: fs(14), lineHeight: fs(20), fontWeight: '700' },
  note: { color: 'rgba(255,255,255,0.62)', fontSize: fs(12), lineHeight: fs(18), marginTop: space(3) },

  feats: { marginTop: space(4), gap: space(3) },
  featsRow: { flexDirection: 'row', alignItems: 'stretch' },
  feat: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(4) },
  featCol: { flex: 1 },
  featTag: { color: colors.ju, fontSize: fs(11), lineHeight: fs(17), fontWeight: '800' },
  featTitle: { color: colors.ink, fontSize: fs(17), lineHeight: fs(25), fontWeight: '800', marginTop: space(1) },
  featBody: { color: colors.inkSoft, fontSize: fs(13), lineHeight: fs(21), marginTop: space(2) },
});
