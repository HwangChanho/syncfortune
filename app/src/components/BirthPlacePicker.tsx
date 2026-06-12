// app/src/components/BirthPlacePicker.tsx — 출생지 도시 검색 선택 (Nominatim/OSM, 키 불필요, 글로벌)
// ─────────────────────────────────────────────────────────────────────────
// 자유입력 대신 도시·지역 검색 → 선택(검증된 입력 — 오타·무의미 문자 차단).
//   좌표(lon)는 진태양시 보정(ADR-008 미구현)용으로 함께 보관 → 추후 시주 경도 보정에 연결.
// Nominatim(OpenStreetMap) forward geocoding — API 키 불필요·무료·전세계.
//   ※ 이용약관: User-Agent 필수, ~1req/s(디바운스 450ms로 충족).
//     프로덕션 대량 호출 시 Google Places/자체 호스팅 검토(ADR).
// 검색 실패·미등록 지역 대비 '그대로 사용' fallback 제공(시골 등).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, shadow, font } from '../lib/theme';

type Place = { name: string; lon: number | null };

export function BirthPlacePicker({ value, onSelect }: { value: string; onSelect: (p: Place) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ name: string; lon: number }[]>([]);
  const [loading, setLoading] = useState(false);

  // 디바운스(450ms) 검색 — 타이핑이 멈추면 Nominatim 조회(rate-limit 약관 충족)
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        // featuretype=settlement → 도시·마을·행정구역만(역·건물 POI 제외). 진태양시는 도시 경도면 충분.
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&featuretype=settlement&addressdetails=1&accept-language=ko&q=${encodeURIComponent(query.trim())}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'SyncFortune/1.0 (fortune app)' } });
        const data = await res.json();
        setResults((data ?? []).map((d: any) => {
          const a = d.address ?? {};
          const city = a.city || a.town || a.village || a.county || a.municipality || a.suburb || '';
          const region = a.state || a.province || '';
          const name = [city, region, a.country].filter(Boolean).join(', ') || String(d.display_name).split(',').slice(0, 2).join(',').trim();
          return { name, lon: parseFloat(d.lon) };
        }));
      } catch {
        setResults([]); // 네트워크 실패 → 아래 '그대로 사용' fallback 으로 진행 가능
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(id);
  }, [query]);

  function choose(p: Place) {
    onSelect(p);
    setOpen(false);
    setQuery('');
    setResults([]);
  }

  return (
    <>
      {/* 출생지 필드 — 탭하면 검색 바텀시트 */}
      <Pressable style={styles.select} onPress={() => setOpen(true)}>
        <Text style={[styles.selectText, !value && styles.placeholder]} numberOfLines={1}>
          {value || t('register.birthPlacePh')}
        </Text>
        <Text style={styles.icon}>🔍</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        {/* 키보드가 시트(입력·결과)를 가리지 않게 위로 올림(daniel) */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.title}>{t('register.birthPlaceSearch')}</Text>
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder={t('register.birthPlaceSearchPh')}
              placeholderTextColor={colors.inkFaint}
              autoFocus
            />
            {loading && <ActivityIndicator style={{ marginTop: space(3) }} color={colors.ju} />}
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {results.map((r, i) => (
                <Pressable key={i} style={styles.row} onPress={() => choose({ name: r.name, lon: r.lon })}>
                  <Text style={styles.rowText} numberOfLines={2}>{r.name}</Text>
                </Pressable>
              ))}
              {/* fallback: 검색 결과가 없거나 미등록 지역 — 입력값 그대로 사용(좌표 없음) */}
              {query.trim().length >= 2 && !loading && (
                <Pressable style={styles.row} onPress={() => choose({ name: query.trim(), lon: null })}>
                  <Text style={styles.rowAsIs}>{t('register.useAsIs', { q: query.trim() })}</Text>
                </Pressable>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  select: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.sm, paddingVertical: space(3.25), paddingHorizontal: space(3.5), ...shadow.soft,
  },
  selectText: { flex: 1, fontSize: 15, color: colors.ink },
  placeholder: { color: colors.inkFaint },
  icon: { fontSize: 14, marginLeft: space(2) },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: space(5), paddingTop: space(2.5), paddingBottom: space(6), maxHeight: '80%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: space(3) },
  title: { ...font.heading, marginBottom: space(3) },
  search: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm,
    paddingVertical: space(3), paddingHorizontal: space(3.5), fontSize: 15, color: colors.ink,
  },
  list: { marginTop: space(2), flexGrow: 0 },
  row: { paddingVertical: space(3.5), borderBottomWidth: 1, borderBottomColor: colors.line },
  rowText: { fontSize: 14, color: colors.ink, lineHeight: 19 },
  rowAsIs: { fontSize: 14, color: colors.ju, fontWeight: '600' },
});
