// app/src/components/YongsinCard.tsx — 만세력 용신 카드(canonical 엔진 + 격국용신·API 0)
// ─────────────────────────────────────────────────────────────────────────
// Boss 2026-07-22: "만세력에 용신도 잡아줘(격국용신·억부용신·희신 등)" → 표준 자평진전 상신으로 격국용신 추가.
//   ▶ 주용신(억부/병약/조후/종격/통관)·희신·기신 = canonical `computeYongsinApprox`(daniel 승인·골든 검증·발명0).
//   ▶ 격국용신(상신) = **표준 자평진전**(daniel 07-22 "표준으로") — 격(월령 십신) + 원국 십신 + 신강약 조건.
//     ★상신 분기 조건은 daniel 검수 슬롯(표준 통설 인코딩). "상신은 원국에 있어야 강함"(전문가) = 원국 有/無 표기.
// ⚠️주용신(예: 병약 土)과 격국용신(예: 재격 상신 火 관살)은 *관점이 달라 다를 수 있다* — 그게 구분의 목적([[yongsin-app-engine-drift]]).
// ─────────────────────────────────────────────────────────────────────────
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SajuChart, PillarPos } from '@spec/chart';
import { computeYongsinApprox } from '../lib/content/yongsinApprox';
import { elementColor } from '../lib/engine/ohaeng';
import { useTranslation } from 'react-i18next';
import { termLabel } from '../lib/ui/termLabel';   // ★명리 용어 — 한국어는 그대로, 그 밖은 한자(Boss 2026-08-27)
import { colors, radius, space, font, shadow } from '../lib/theme';
import { elGloss } from '../lib/content/ohaengLabel';   // ★오행 이름표 단일 소스(사본 만들지 말 것)
import { sipsinGroupOf, type Elem5 } from '@engine/sipsinGroup';   // 오행→십신 단일 원본(2026-08-24)

// 오행 생/극(표준 통설) — 십신↔오행 변환.
const GEN: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };   // e가 생하는(식상)
const CTRL: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };  // e가 극하는(재성)
const GEN_BY: Record<string, string> = { 火: '木', 土: '火', 金: '土', 水: '金', 木: '水' }; // e를 생하는(인성)
const CTRL_BY: Record<string, string> = { 土: '木', 水: '土', 火: '水', 金: '火', 木: '金' };// e를 극하는(관살)

type Group = '비겁' | '식상' | '재성' | '관살' | '인성';
const SIP_GROUP: Record<string, Group> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상',
  정재: '재성', 편재: '재성', 정관: '관살', 편관: '관살', 정인: '인성', 편인: '인성',
};
/** 상신 그룹 → 오행(일간 D 기준). */
function groupElement(D: string, g: Group): string {
  return g === '비겁' ? D : g === '식상' ? GEN[D] : g === '재성' ? CTRL[D] : g === '관살' ? CTRL_BY[D] : GEN_BY[D];
}
/**
 * 일간 오행 D 기준, 대상 오행 T 의 십신 그룹 — **화면에 찍는 이름**.
 *
 * ★2026-08-24 엔진(`@engine/sipsinGroup`)에 위임했다. 표가 여기와 개운 모듈 **두 곳에** 있었고,
 *   바로 아래 개운 블록이 같은 오행을 말하므로 이름이 갈리면 한 화면에서 모순이 된다.
 * ⚠️갈려 있던 이름도 맞췄다 — 여기만 `관살`, 앱의 나머지(24곳·`tenGods.distribution` 포함)는 `관성`이었다.
 *   아래 격국 상신 쪽 `Group` 타입은 **그대로 둔다**(그건 표시가 아니라 분기 조건이다).
 */
function sipsinGroup(D: string, T: string): string {
  return sipsinGroupOf(D as Elem5, T as Elem5);
}

// 관점(method) 일상어 설명 — daniel 검수 슬롯.

// ── 격국용신(상신) — 표준 자평진전(daniel 07-22 "표준으로"·분기조건 검수 슬롯) ──────────────
type GyeokKind = '재격' | '정관격' | '칠살격' | '인수격' | '식신격' | '상관격' | '건록격' | '양인격';
function gyeokKindOf(sip: string): GyeokKind | null {
  if (sip === '정재' || sip === '편재') return '재격';
  if (sip === '정관') return '정관격';
  if (sip === '편관' || sip === '칠살') return '칠살격';
  if (sip === '정인' || sip === '편인' || sip === '인수') return '인수격';
  if (sip === '식신') return '식신격';
  if (sip === '상관') return '상관격';
  if (sip === '비견' || sip === '건록' || sip === '녹겁') return '건록격';
  // ★daniel 2026-07-28 "양인격으로 보내" — 겁재 계열(양인·겁재·구 월겁)은 전부 양인격 상신(역용)으로.
  if (sip === '겁재' || sip === '양인' || sip === '월겁') return '양인격';
  return null;
}
/**
 * 표준 자평진전 상신(격국용신). 순용격(재·정관·인수·식신)=보호/생 · 역용격(칠살·상관·양인·건록)=제/화.
 *
 * ⚠️★종전엔 분기마다 `note`(근거 한 줄)를 함께 돌려줬는데, **화면이 그것을 안 쓴다** —
 *   daniel 2026-08-04 *"쓸데없는 설명 다 빼"* 로 그 줄을 지운 뒤로 죽은 값이었다.
 *   ⇒ 근거는 **주석**으로 옮겼다. 지식은 남기되 «안 쓰는 문자열» 을 들고 다니지 않는다
 *     (안 그러면 번역 대상으로도 계속 잡힌다).
 *
 * @param has    십신 그룹 존재 여부(원국 천간+지지본기)
 * @param hasSip 특정 십신 존재(상관·칠살 등 세부 분기)
 * @param strong 신강/신왕 여부
 */
function gyeokgukSangsin(kind: GyeokKind, has: (g: Group) => boolean, hasSip: (s: string) => boolean, strong: boolean): { g: Group } {
  switch (kind) {
    case '재격': // 順用 — 생/보호
      if (has('비겁')) return { g: '관살' };   // 비겁이 재를 겁탈 → 관성으로 비겁 제압
      if (has('식상')) return { g: '식상' };   // 식상생재(식상으로 재를 생조)
      if (!strong) return { g: '인성' };       // 재다신약 → 인성·비겁으로 감당
      return { g: '식상' };                    // 식상으로 재 생조
    case '정관격': // 順用
      if (hasSip('상관')) return { g: '인성' }; // 상관견관 방어 → 인성으로 정관 보호(관인상생)
      if (!strong) return { g: '인성' };        // 신약 → 인성으로 정관 감당
      return { g: '재성' };                     // 재생관(재로 정관 생조)
    case '인수격': // 順用
      if (strong) return { g: '재성' };         // 인다신강 → 재성으로 인성 제압
      if (has('관살')) return { g: '관살' };    // 관인상생(관살로 인성 생조)
      return { g: '관살' };                     // 관살로 인성 생조
    case '식신격': // 順用(칠살 있으면 제살)
      if (hasSip('편관') || hasSip('칠살')) return { g: '식상' };  // 식신제살(식신으로 칠살 제압)
      return { g: '재성' };                     // 식신생재(식신으로 재 생조)
    case '칠살격': // 逆用 — 제/화
      if (has('식상')) return { g: '식상' };    // 식신제살(식상으로 칠살 제압)
      if (has('인성')) return { g: '인성' };    // 살인상생(칠살을 인성으로 받아 돌림)
      return { g: '식상' };                     // 식상으로 칠살 제압
    case '상관격': // 逆用
      if (has('인성')) return { g: '인성' };    // 상관패인(인성으로 상관 제어)
      if (has('재성')) return { g: '재성' };    // 상관생재(상관으로 재 생조)
      return { g: '인성' };                     // 상관패인(인성으로 상관 제어)
    case '양인격': // 逆用
      return { g: '관살' };                     // 양인은 관살로 제압(상신은 원국에 있어야 강함)
    case '건록격': // 逆用 — 설/제
      if (has('재성')) return { g: '재성' };    // 재로 왕한 록겁을 돌림(식상 통관)
      if (has('관살')) return { g: '관살' };    // 관살로 록겁 제압
      return { g: '식상' };                     // 식상으로 왕한 비겁 설기
  }
}

/** 만세력 용신 카드. saju = computeChart 결과의 .saju · pattern = c.pattern(격국). */
export function YongsinCard({ saju, pattern, timeUnknown }: { saju: SajuChart; pattern?: { name?: string } | null; timeUnknown?: boolean }) {
  // ★훅은 조기 return 위에(React #310)
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const ys = useMemo(() => { try { return computeYongsinApprox(saju, { timeUnknown }); } catch { return null; } }, [saju, timeUnknown]);
  const dayEl = String(saju.dayMaster?.element ?? '');

  // 격국용신(상신) — 격(pattern.name 십신) + 원국 present 십신 + 신강.
  const gyeokguk = useMemo(() => {
    try {
      // ★★이름을 파싱하지 않는다 — 엔진이 월지 본기 십신을 **따로** 내보낸다(2026-08-10).
      //   격국 stance 가 세 번 바뀌며 `name` 형식이 계속 달라졌고, 파싱은 그때마다 **에러 없이** 빗나가
      //   격국용신 섹션이 통째로 사라졌다. 이제 '격 없음'(격 불성립) 상태까지 생겨 파싱은 더 위험하다.
      //   ⚠️격이 안 서는 명식에서도 월지 본기 십신은 있으므로 상신은 그대로 계산한다
      //     (격의 성립 여부와 "월지가 무슨 십신인가"는 다른 축이다).
      const sip = String((pattern as { monthMainTenGod?: string } | null | undefined)?.monthMainTenGod
        ?? String(pattern?.name ?? '').replace(/[격국]$/, ''));   // 폴백: 구버전 캐시 차트
      const kind = gyeokKindOf(sip);
      if (!kind || !ys) return null;
      const POS: PillarPos[] = timeUnknown ? ['년', '월', '일'] : ['년', '월', '일', '시'];
      const present = new Set<string>();                                    // 원국 천간+지지본기 십신(가시)
      for (const p of POS) { const d: any = (saju.pillars as any)?.[p]; if (d) { if (d.stemTenGod) present.add(d.stemTenGod); if (d.branchMainTenGod) present.add(d.branchMainTenGod); } }
      const has = (g: Group) => [...present].some((s) => SIP_GROUP[s] === g);
      const hasSip = (s: string) => present.has(s);
      const strong = /강|왕/.test(String(ys.strengthVerdict ?? ''));
      const { g } = gyeokgukSangsin(kind, has, hasSip, strong);
      const el = groupElement(dayEl, g);
      return { kind, group: g, el, inChart: has(g) };                 // inChart = 상신이 원국에 있나("있어야 강함")
    } catch { return null; }
  }, [saju, pattern, ys, timeUnknown, dayEl]);

  if (!ys) return null;

  const rows: { label: string; el: string | null }[] = [
    { label: '용신', el: ys.yongsin },
    { label: '희신', el: ys.huisin ?? null },
    { label: '기신', el: ys.gisin },
  ];

  // ★용어 표기는 언어에 따라 달라진다 — 한국어는 「비겁」, 그 밖은 「比劫」(Boss 규칙)
  const T = (k: string) => termLabel(k, lang);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{T('용신')}</Text>
        <View style={styles.methodPill}><Text style={styles.methodTx}>{T(ys.method)}{T('용신')}</Text></View>
      </View>
      {rows.map((r) => r.el ? (
        <View key={r.label} style={styles.row}>
          <Text style={styles.rowLabel}>{T(r.label)}</Text>
          <View style={[styles.elDot, { backgroundColor: elementColor[r.el] ?? colors.inkFaint }]} />
          <Text style={[styles.elTx, { color: elementColor[r.el] ?? colors.ink }]}>{r.el}({elGloss(r.el, lang)})</Text>
          <Text style={styles.sipsin}>{T(sipsinGroup(dayEl, r.el))}</Text>
        </View>
      ) : null)}

      {/* 격국용신(상신) — 병약용신처럼 '배지 + 동일 정렬 행'으로 표시(daniel 2026-07-25 IMG_8182). 주용신과 관점이 달라 다를 수 있음. */}
      {gyeokguk ? (
        <View style={styles.gyeokBox}>
          {/* head = 주용신 카드 상단과 동일 구조(좌 제목 '용신' + 우측 배지 '격국용신') */}
          <View style={styles.head}>
            <Text style={styles.title}>{T('용신')}</Text>
            <View style={styles.methodPill}><Text style={styles.methodTx}>{T('격국')}{T('용신')}</Text></View>
          </View>
          {/* 상신 행 — 병약용신 행(용신/희신/기신)과 완전히 같은 정렬(라벨 40폭·닷·오행·십성) */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{T('용신')}</Text>
            <View style={[styles.elDot, { backgroundColor: elementColor[gyeokguk.el] ?? colors.inkFaint }]} />
            <Text style={[styles.elTx, { color: elementColor[gyeokguk.el] ?? colors.ink }]}>{gyeokguk.el}({elGloss(gyeokguk.el, lang)})</Text>
            <Text style={styles.sipsin}>{T(gyeokguk.group)}{gyeokguk.inChart ? '' : ` ·${T('원국')}無`}</Text>
          </View>
        </View>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginTop: space(3), marginBottom: space(2), ...shadow.card },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2) },
  title: { ...font.heading, color: colors.ink, fontWeight: '900' },
  methodPill: { backgroundColor: colors.juSoft, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(0.5) },
  methodTx: { fontSize: 12, fontWeight: '800', color: colors.ju },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginVertical: space(0.5) },
  rowLabel: { ...font.body, color: colors.inkSoft, width: 40, fontWeight: '700' },
  elDot: { width: 12, height: 12, borderRadius: 6 },
  elTx: { fontSize: 15, fontWeight: '900', width: 78 },
  sipsin: { ...font.body, color: colors.inkSoft, fontWeight: '700', flexShrink: 1 },
  gyeokBox: { marginTop: space(3), paddingTop: space(3), borderTopWidth: 1, borderTopColor: colors.line },
});
