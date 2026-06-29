// app/src/components/TTSButton.tsx — 풀이 음성 읽기(daniel 2026-06-24)
// ─────────────────────────────────────────────────────────────────────────
// expo-speech = **온디바이스 TTS**(기기 내장 음성 합성). API 비용 0 → 무료로 전체 제공(프리미엄 게이트 불필요).
//   ※ 클라우드 TTS(고품질 음성)는 호출당 과금이라 미사용. 비용 0이므로 daniel "비용 발생 시 프리미엄" 조건에 안 걸림.
//   다시 누르면 정지. 화면 벗어나면(언마운트) 자동 정지.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
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
  // ★세션 토큰 — 정지/언마운트 시 증가시켜, 진행 중이던 청크 체인이 *다음 청크로 넘어가지 않게* 막는다.
  //   iOS는 Speech.stop() 이 현재 청크의 onDone 을 부르는 경우가 있어, 체인이 계속 이어지며
  //   "멈춤 눌러도·화면 나가도 계속 읽힘"(daniel)이 발생. 세션이 바뀌면 onDone 이 와도 다음 청크를 안 읽는다.
  const sessionRef = useRef(0);
  useEffect(() => () => { sessionRef.current++; Speech.stop(); }, []); // 화면 이탈 = 세션 무효화 + 정지

  // 문단(청크)을 *순차 체인*으로 읽되, 매 청크 전에 세션 유효성 확인 — 무효(정지/이탈)면 더 읽지 않음.
  const speakChain = (chunks: string[], i: number, lang: string, session: number) => {
    if (session !== sessionRef.current) return;        // 정지/이탈된 세션 → 체인 중단
    if (i >= chunks.length) { setSpeaking(false); return; }
    Speech.speak(chunks[i], {
      language: lang,
      pitch: 0.8,  // 중저음(daniel) — 1.0=기본, 낮출수록 깊은 목소리. rate 생략=기본 속도.
      onDone: () => speakChain(chunks, i + 1, lang, session),
      onStopped: () => {},
      onError: () => { if (session === sessionRef.current) setSpeaking(false); },
    });
  };
  const stop = () => { sessionRef.current++; Speech.stop(); setSpeaking(false); }; // 세션 무효화로 체인까지 확실히 중단
  const toggle = () => {
    if (speaking) { stop(); return; }
    const text = readingToText(reading, sections).trim();
    if (!text) return;
    const lang = appLang() === 'ja' ? 'ja-JP' : appLang() === 'en' ? 'en-US' : 'ko-KR';
    const session = ++sessionRef.current;              // 새 재생 세션 시작
    setSpeaking(true);
    speakChain(text.split(/\n\n+/).filter(Boolean), 0, lang, session);
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
