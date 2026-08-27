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
import { PressableScale } from './PressableScale';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useSheetLayout } from './WebShell'; // 넓은 웹 = 바텀시트를 가운데 다이얼로그로

type Place = { name: string; lon: number | null; lat: number | null }; // lat=점성술 상승궁(daniel: 출생지에서 추출)

/**
 * @param value    지금 고른 출생지 표시명
 * @param onSelect 고르면 부르는 함수
 * @param onOpenChange ★시트가 열리고 닫힐 때 알린다(2026-08-23).
 *   왜 필요한가: 뒤로가기를 화면이 가로채려면 **지금 시트가 떠 있는지**를 알아야 한다.
 *   열림 상태가 이 컴포넌트 안에만 있으면 부모는 알 수 없어, 도시를 입력하던 중에 뒤로가기를 누르면
 *   시트만 닫히는 게 아니라 **등록 화면 전체가 빠져나가 버린다**(Boss 2026-08-24 제보).
 */
export function BirthPlacePicker({ value, onSelect, onOpenChange }: {
  value: string;
  onSelect: (p: Place) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const sheetL = useSheetLayout();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // ★`setOpen` 호출부가 여러 곳이라 **여기 한 곳에서** 알린다(호출부마다 붙이면 하나를 빠뜨린다).
  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ name: string; lon: number; lat: number }[]>([]);
  const [loading, setLoading] = useState(false);
  // ★검색이 '안 되는' 두 경우를 **구분**한다(daniel 2026-08-01 "지역검색이 안된대").
  //   예전엔 `catch { setResults([]) }` 하나로 뭉개서, 아래 셋이 화면상 전부 똑같았다:
  //     ① 그런 도시가 없다  ② 네트워크가 끊겼다  ③ 서버가 막았다(429 rate-limit 등)
  //   사용자는 ②③ 을 보고도 "검색이 안 된다"고만 말할 수 있다 — 우리도 원인을 알 수 없었다.
  //   → 실패는 실패라고 말하고 **다시 시도**를 준다. null=실패 아님.
  const [failure, setFailure] = useState<'network' | 'blocked' | null>(null);
  const [retryTick, setRetryTick] = useState(0); // '다시 시도' → 같은 query 로 effect 재실행

  // 디바운스(450ms) 검색 — 타이핑이 멈추면 Nominatim 조회(rate-limit 약관 충족)
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setFailure(null); return; }
    const id = setTimeout(async () => {
      setLoading(true);
      setFailure(null);
      // ★상한 8초 + **실제 취소**(daniel 07-31 교훈: fetch 는 기본 타임아웃이 없다).
      //   withTimeout 은 UI 잠금만 풀고 요청은 살려 두는데, 여기선 요청 자체를 끊는 게 맞다 —
      //   느린 회선에서 디바운스마다 요청이 쌓이면 그게 rate-limit 을 부른다.
      const ac = new AbortController();
      const killer = setTimeout(() => ac.abort(), 8000);
      try {
        // featuretype=settlement → 도시·마을·행정구역만(역·건물 POI 제외). 진태양시는 도시 경도면 충분.
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&featuretype=settlement&addressdetails=1&accept-language=ko&q=${encodeURIComponent(query.trim())}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'SyncFortune/1.0 (fortune app)' }, signal: ac.signal });
        // ★HTTP 상태를 **먼저** 본다 — 200 이 아닌데 body 를 파싱하면 그 예외가 '결과 없음'으로 둔갑한다.
        //   429(요청 과다)·403(차단)은 우리가 고칠 수 있는 문제라 따로 표시한다.
        if (!res.ok) { setResults([]); setFailure(res.status === 429 || res.status === 403 ? 'blocked' : 'network'); return; }
        const data = await res.json();
        // 원시 결과 → { name, lon, lat } 변환
        const mapped: { name: string; lon: number; lat: number }[] = (data ?? []).map((d: any) => {
          const a = d.address ?? {};
          const city = a.city || a.town || a.village || a.county || a.municipality || a.suburb || '';
          const region = a.state || a.province || '';
          const name = [city, region, a.country].filter(Boolean).join(', ') || String(d.display_name).split(',').slice(0, 2).join(',').trim();
          return { name, lon: parseFloat(d.lon), lat: parseFloat(d.lat) };
        });
        // 같은 name이 행정구역 세분/좌표 차이로 여러 번 올 수 있음(예: 여수시, 여수군 등).
        // name을 키로 Map에 first-win 삽입 → 대표 1개(첫 좌표 유지)만 표시.
        const seen = new Map<string, { name: string; lon: number; lat: number }>();
        for (const item of mapped) {
          if (!seen.has(item.name)) seen.set(item.name, item);
        }
        setResults(Array.from(seen.values()));
      } catch {
        // 타임아웃(abort)·DNS·오프라인 전부 여기. '결과 없음'이 아니라 **실패**로 표시한다.
        setResults([]);
        setFailure('network');
      } finally {
        clearTimeout(killer);
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(id);
  }, [query, retryTick]);

  function choose(p: Place) {
    onSelect(p);
    setOpen(false);
    setQuery('');
    setResults([]);
  }

  return (
    <>
      {/* 출생지 필드 — 탭하면 검색 바텀시트 */}
      <PressableScale style={styles.select} onPress={() => setOpen(true)}>
        <Text style={[styles.selectText, !value && styles.placeholder]} numberOfLines={1}>
          {value || t('register.birthPlacePh')}
        </Text>
        <Text style={styles.icon}>🔍</Text>
      </PressableScale>

      <Modal statusBarTranslucent visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        {/* 키보드가 시트(입력·결과)를 가리지 않게 위로 올림(daniel) */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={[styles.backdrop, sheetL.backdrop]} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, sheetL.sheet]} onPress={() => {}}>
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
              {/* ★검색이 실패했을 때 — '결과 없음'인 척하지 않는다. 원인을 말하고 되돌릴 길을 준다.
                  아래 '그대로 사용'은 그대로 남아 있어, 네트워크가 안 되어도 등록은 끝까지 진행된다
                  (출생지 좌표는 진태양시 보정용 부가정보지 필수값이 아니다). */}
              {!!(!loading && failure) && (
                <View style={styles.failBox}>
                  <Text style={styles.failTx}>
                    {failure === 'blocked'
                      ? t('register.placeSearchBlocked', '지역 검색이 잠시 제한됐어요. 30초쯤 뒤에 다시 시도해 주세요.')
                      : t('register.placeSearchFailed', '지역 검색을 불러오지 못했어요. 연결을 확인해 주세요.')}
                  </Text>
                  <PressableScale style={styles.retryBtn} onPress={() => setRetryTick((n) => n + 1)}>
                    <Text style={styles.retryTx}>{t('common.retry', '다시 시도')}</Text>
                  </PressableScale>
                </View>
              )}
              {results.map((r, i) => (
                <PressableScale key={i} style={styles.row} onPress={() => choose({ name: r.name, lon: r.lon, lat: r.lat })}>
                  <Text style={styles.rowText} numberOfLines={2}>{r.name}</Text>
                </PressableScale>
              ))}
              {/* fallback: 검색 결과가 없거나 미등록 지역 — 입력값 그대로 사용(좌표 없음) */}
              {query.trim().length >= 2 && !loading && (
                <PressableScale style={styles.row} onPress={() => choose({ name: query.trim(), lon: null, lat: null })}>
                  <Text style={styles.rowAsIs}>{t('register.useAsIs', { q: query.trim() })}</Text>
                </PressableScale>
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
  // 검색 실패 안내 — '결과 없음'과 시각적으로 구분되게 박스로(그냥 텍스트면 또 같은 오해를 준다).
  failBox: { backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: space(3.5), marginTop: space(2), gap: space(2.5) },
  failTx: { ...font.caption, color: colors.inkSoft, lineHeight: 18 },
  retryBtn: { alignSelf: 'flex-start', backgroundColor: colors.ju, borderRadius: radius.pill, paddingVertical: space(1.75), paddingHorizontal: space(4) },
  retryTx: { color: colors.bg, fontSize: 13, fontWeight: '700' },
  rowText: { fontSize: 14, color: colors.ink, lineHeight: 19 },
  rowAsIs: { fontSize: 14, color: colors.ju, fontWeight: '600' },
});
