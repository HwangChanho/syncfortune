// app/src/components/ComputedNote.tsx — '계산 출처(provenance)' 표시 공용 컴포넌트
// ─────────────────────────────────────────────────────────────────────────
// 목적(App Store 4.3 '스팸/중복' 대응): 이 앱의 분석이 제네릭 호로스코프가 아니라,
//   유저 생년월일로 *알고리즘 계산된 개인화 결과*임을 리뷰어·유저가 화면에서 바로 보게 한다.
//   - 배너(기본): 만세력 상단 — 제목 + 본문 + 접이식 '?'(엔진 상세). 가장 강한 '계산' 증거.
//   - compact(배지): 분석 화면 상단 — 작은 pill 한 줄('내 생년월일로 계산됨').
//
// ★i18n(ko/en/ja) — computed.* 키(i18n.ts). 리뷰어는 앱을 영어로 보므로 en 필수.
// ★디자인: theme 토큰만(하드코딩 색 X) · 은은한 골드 틴트(juSoft) · 과밀 금지(화면당 1개).
// ★폰트 의존 최소화: 아이콘 대신 View 로 그린 골드 점을 시각 앵커로(이모지/특수문자 렌더 편차 회피).
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, font, shadow } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';

interface ComputedNoteProps {
  /** true = 작은 pill 배지(분석 화면용) / false·미지정 = 배너 카드(만세력 상단용). */
  compact?: boolean;
  /** 컨테이너 스타일 오버라이드(마진 등 미세 조정용·선택) — 배치 화면이 하드코딩 없이 간격만 조정. */
  style?: ViewStyle;
}

/**
 * ComputedNote — '이 결과는 당신의 생년월일로 계산됐다'는 출처(provenance) 표시.
 *
 * @param compact 배지(pill) 모드 여부. 기본 false(배너 카드).
 * @param style   컨테이너 스타일 오버라이드(마진 등). 기본 marginBottom 은 내부에서 지정.
 * @returns 배너(제목·본문·접이식 상세) 또는 compact 배지(한 줄 pill) 뷰.
 */
export function ComputedNote({ compact = false, style }: ComputedNoteProps) {
  const { t } = useTranslation();
  const { fs, ls } = useFontScale();                 // 본문 글자 크기(설정)에 맞춰 텍스트 스케일
  const [open, setOpen] = useState(false);       // 배너 '?' — 엔진 상세(computed.more) 펼침 여부
  const s = useMemo(() => makeStyles(fs), [fs]); // fs 변경 시에만 스타일 재생성

  // ── compact: 작은 pill 한 줄('내 생년월일로 계산됨') — 분석 화면 타이틀 근처 ──
  if (compact) {
    return (
      <View style={[s.pill, style]}>
        <View style={s.pillDot} />
        <Text style={s.pillTx} numberOfLines={1}>{t('computed.badge')}</Text>
      </View>
    );
  }

  // ── 배너: 제목 + 본문 + 접이식 '?'(엔진 상세) — 만세력 최상단(가장 강한 계산 증거) ──
  return (
    <View style={[s.card, style]}>
      <View style={s.headRow}>
        <View style={s.dot} />
        <Text style={s.title} numberOfLines={2}>{t('computed.title')}</Text>
        {/* '?' → 엔진 상세(computed.more) 펼침/접힘. hitSlop 으로 작은 버튼도 편히 탭. */}
        <Pressable
          onPress={() => setOpen((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('computed.title')}
          style={s.qBtn}
        >
          <Text style={s.qTx}>{open ? '−' : '?'}</Text>
        </Pressable>
      </View>
      <Text style={s.body}>{t('computed.body')}</Text>
      {open && <Text style={s.more}>{t('computed.more')}</Text>}
    </View>
  );
}

// fs(본문 배율)에 맞춰 텍스트만 스케일 — chrome(패딩·점·버튼)은 고정(과밀 방지).
const makeStyles = (fs: (n: number) => number) => StyleSheet.create({
  // 배너 — 은은한 골드 틴트 카드(juSoft) + 얇은 골드 선(juLine). 과하지 않게 soft 그림자만.
  card: {
    backgroundColor: colors.juSoft,
    borderWidth: 1,
    borderColor: colors.juLine,
    borderRadius: radius.md,
    paddingVertical: space(3),
    paddingHorizontal: space(3.5),
    marginBottom: space(3),
    ...shadow.soft,
  },
  headRow: { flexDirection: 'row', alignItems: 'center' },
  // 계산=골드 점(문자 폰트 의존 X — 어느 기기에서도 동일하게 렌더).
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ju, marginRight: space(2) },
  title: { flex: 1, ...font.label, color: colors.juDeep, fontWeight: '800', fontSize: fs(13) },
  // '?' 토글 버튼 — 카드 배경(순백)에 골드 테두리 원형(과하지 않은 인포 어포던스).
  qBtn: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.card,
    marginLeft: space(2),
  },
  qTx: { color: colors.ju, fontWeight: '900', fontSize: fs(13), lineHeight: fs(15) },
  body: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5), fontSize: fs(12.5), lineHeight: fs(18) },
  more: { ...font.caption, color: colors.inkFaint, marginTop: space(2), fontSize: fs(12), lineHeight: fs(17) },

  // compact — 작은 pill(분석 화면 상단). alignSelf: flex-start 로 폭을 내용에 맞춰 최소화.
  pill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: colors.juSoft,
    borderWidth: 1, borderColor: colors.juLine,
    borderRadius: radius.pill,
    paddingHorizontal: space(2.5), paddingVertical: space(1.25),
    marginBottom: space(3),
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ju, marginRight: space(1.5) },
  pillTx: { ...font.caption, color: colors.juDeep, fontWeight: '800', fontSize: fs(11.5) },
});
