// app/src/components/TTSButton.tsx — 풀이 음성 읽기(daniel 2026-06-24)
// ─────────────────────────────────────────────────────────────────────────
// expo-speech = **온디바이스 TTS**(기기 내장 음성 합성). API 비용 0 → 무료로 전체 제공(프리미엄 게이트 불필요).
//   ※ 클라우드 TTS(고품질 음성)는 호출당 과금이라 미사용. 비용 0이므로 daniel "비용 발생 시 프리미엄" 조건에 안 걸림.
//   다시 누르면 정지. 화면 벗어나면(언마운트) 자동 정지.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
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

  // 문단(청크)을 *순차 체인*으로 읽는다 — 한 번에 큐잉하면 중간 청크가 끊길 때 멈추던 문제 방지.
  //   각 청크가 끝나면(onDone) 다음 청크를 읽고, 마지막이면 speaking 해제. 정지(stop)=onStopped로 체인 중단.
  const speakFrom = (chunks: string[], i: number, lang: string) => {
    if (i >= chunks.length) { setSpeaking(false); return; }
    Speech.speak(chunks[i], {
      language: lang, pitch: 1.0, // rate 생략=기본 속도(iOS는 rate×기본이라 1.0=정상, 생략도 동일)
      onDone: () => speakFrom(chunks, i + 1, lang),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };
  const toggle = () => {
    if (speaking) { Speech.stop(); setSpeaking(false); return; }
    const text = readingToText(reading, sections).trim();
    if (!text) return;
    const lang = appLang() === 'ja' ? 'ja-JP' : appLang() === 'en' ? 'en-US' : 'ko-KR';
    setSpeaking(true);
    speakFrom(text.split(/\n\n+/).filter(Boolean), 0, lang);
  };

  if (reading?.error) return null;
  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable style={styles.btn} onPress={toggle} accessibilityRole="button">
        <Text style={styles.tx}>{speaking ? '⏸  읽기 멈춤' : '🔊  음성으로 듣기'}</Text>
      </Pressable>
      {/* iOS는 expo-speech가 무음 스위치를 따라 음소거 → 소리 안 들리면 무음 끄기 안내(daniel) */}
      <Text style={styles.hint}>소리가 안 들리면 휴대폰 무음(측면 스위치)을 꺼 주세요</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: colors.card, borderColor: colors.juLine, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space(5), paddingVertical: space(2.5), marginTop: space(3) },
  tx: { ...font.label, color: colors.ju, fontWeight: '700' },
  hint: { ...font.caption, color: colors.inkFaint, marginTop: space(1.5), textAlign: 'center' },
});
