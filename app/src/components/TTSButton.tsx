// app/src/components/TTSButton.tsx — 풀이 음성 읽기(daniel 2026-06-24)
// ─────────────────────────────────────────────────────────────────────────
// expo-speech = **온디바이스 TTS**(기기 내장 음성 합성). API 비용 0 → 무료로 전체 제공(프리미엄 게이트 불필요).
//   ※ 클라우드 TTS(고품질 음성)는 호출당 과금이라 미사용. 비용 0이므로 daniel "비용 발생 시 프리미엄" 조건에 안 걸림.
//   다시 누르면 정지. 화면 벗어나면(언마운트) 자동 정지.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import * as Speech from 'expo-speech';
import { appLang } from '../lib/i18n';
import { colors, radius, space, font } from '../lib/theme';

// 풀이 객체(JSON) → 읽을 텍스트. sections 주면 그 순서·키만(analysis 등 비노출 키 제외).
function readingToText(reading: any, sections?: { key: string; label?: string }[]): string {
  if (reading == null) return '';
  if (typeof reading === 'string') return reading;
  if (typeof reading !== 'object') return String(reading);
  const parts: string[] = [];
  if (typeof reading.headline === 'string' && reading.headline.trim()) parts.push(reading.headline);
  const keys = sections?.length ? sections.map((s) => s.key) : Object.keys(reading).filter((k) => k !== 'analysis' && k !== 'headline' && k !== 'months');
  for (const k of keys) {
    const v = reading[k];
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) parts.push(v.map((x) => (typeof x === 'string' ? x : x?.text ?? '')).filter(Boolean).join('. '));
    else if (v && typeof v === 'object' && typeof v.text === 'string') parts.push(v.text);
  }
  return parts.filter(Boolean).join('\n\n');
}

export function TTSButton({ reading, sections }: { reading: any; sections?: { key: string; label?: string }[] }) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => { Speech.stop(); }, []); // 화면 이탈 시 정지

  const toggle = () => {
    if (speaking) { Speech.stop(); setSpeaking(false); return; }
    const text = readingToText(reading, sections).trim();
    if (!text) return;
    const lang = appLang() === 'ja' ? 'ja-JP' : appLang() === 'en' ? 'en-US' : 'ko-KR';
    setSpeaking(true);
    // 일부 OS는 한 번에 읽을 길이 제한 → 문단별로 끊어 큐잉(마지막에 speaking 해제).
    const chunks = text.split(/\n\n+/).filter(Boolean);
    chunks.forEach((c, i) => {
      Speech.speak(c, {
        language: lang, rate: 1.0, pitch: 1.0,
        onDone: i === chunks.length - 1 ? () => setSpeaking(false) : undefined,
        onStopped: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    });
  };

  if (reading?.error) return null;
  return (
    <Pressable style={styles.btn} onPress={toggle} accessibilityRole="button">
      <Text style={styles.tx}>{speaking ? '⏸  읽기 멈춤' : '🔊  음성으로 듣기'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: colors.card, borderColor: colors.juLine, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space(5), paddingVertical: space(2.5), marginTop: space(3) },
  tx: { ...font.label, color: colors.ju, fontWeight: '700' },
});
