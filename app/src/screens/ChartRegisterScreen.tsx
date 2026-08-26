// app/src/screens/ChartRegisterScreen.tsx — 명식 등록 폼 (한지·먹 테마, 다국어)
// ─────────────────────────────────────────────────────────────────────────
// 개선(2026-06):
//   · 생년월일: 숫자 입력 자동 하이픈(19900315 → 1990-03-15, formatBirthDate)
//   · 태어난 시각: 드롭다운 필드 클릭 → 바텀시트에서 12시진(자·축·인·묘…) 스크롤 선택 + '모름'
//   · 관계: 프리셋 칩 + '직접 입력'(자유 텍스트) — 사용자가 직접 작성 등록 가능
//   · label(이름)·relation 을 onSubmit input 에 포함(기존 누락 버그 수정)
// 입력 → onSubmit(input) 콜백(라우트가 myChart 저장 + /myeongsik 전달). PII 기기 잔류(ADR-005).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Modal, BackHandler, Platform } from 'react-native';
import { PressableScale } from '../components/PressableScale';
import { useTranslation } from 'react-i18next';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { SIJIN, formatBirthDate } from '../lib/engine/sijin';
import { trueSolarOffsetMin, tzOf } from '@engine/solartime'; // 진태양시 보정 + 시간대 판정 — 경계시 경고·해외 표준시 표시용
import { validateBirthInput } from '@engine/saju'; // 생년월일 유효성(감사 H3/H4/H6) — 없는 날짜·없는 윤달을 저장 입구에서 차단
import { BirthPlacePicker } from '../components/BirthPlacePicker';
import { useNavigation } from 'expo-router'; // ★뒤로가기를 이 화면이 먼저 받는다(2026-08-24)
import { getCategories, addCategory, removeCategory, OTHER_CATEGORY, isRemovable } from '../lib/core/categories'; // ★카테고리 관리(생성·삭제·명식 재배치·daniel 07-18)
import { parseBirthTime, hourHint } from '../lib/engine/birthTime'; // ★시각 입력 변환 단일 출처(daniel 08-11 00:03 건)
import { Alert } from '../lib/ui/alert'; // 카테고리 삭제 확인


// defaultRelation/submitLabel = 궁합 상대 등록 등 재사용 시 기본 관계·CTA 문구 주입(옵션, 기존 호출 영향 0).
//
// ★`stepped`(2026-08-18 · 시안 p03) — 한 화면에 다 쏟지 않고 **4단계**로 나눠 묻는다.
//   왜: 신규 등록에서 이름·성별·생년월일·시각·출생지·카테고리·내 상황·대표설정이 **한 화면에 전부** 있었다.
//   첫 진입자가 마주치는 첫 화면이 가장 긴 폼이면, 채우기도 전에 나간다.
//   ⚠️필드·검증·제출 로직은 **하나도 바꾸지 않았다** — 같은 상태를 단계별로 *보여 주기만* 한다.
//     (쪼개면서 검증을 다시 짜면 그때부터 두 벌이 된다.)
//   ⚠️기본값 false — 궁합 상대 등록 등 **재사용처는 종전 그대로** 한 화면이다(거기선 이미 맥락이 있다).
export function ChartRegisterScreen({ onSubmit, defaultRelation, submitLabel, showMakeRep = true, initial, autoSave, onAutoSave, stepped = false }: { onSubmit: (input: any) => void; defaultRelation?: string; submitLabel?: string; showMakeRep?: boolean; initial?: any; autoSave?: boolean; onAutoSave?: (input: any) => void; stepped?: boolean }) {
  const { t } = useTranslation();
  // 편집모드(initial) = 기존 명식 값으로 폼 prefill. 신규면 빈 값. 시각은 hm(대표시각)으로 시진 역매핑.
  const initTime = initial && initial.timeAccuracy !== '미상' ? String(initial.birthDateTime ?? '').split(' ')[1] : null;
  const [label, setLabel] = useState(initial?.label ?? '');
  const [birthDate, setBirthDate] = useState(initial ? String(initial.birthDateTime ?? '').split(' ')[0] : '');
  const initSijinIdx = initTime ? SIJIN.findIndex((s) => s.hm === initTime) : -1;
  const [sijinIdx, setSijinIdx] = useState<number>(initSijinIdx); // -1 = 시각 모름(또는 정확시각 모드)
  const [sijinOpen, setSijinOpen] = useState(false);     // 시각 선택 바텀시트
  const [catOpen, setCatOpen] = useState(false);         // 카테고리 드롭박스(daniel 08-12 — 종전 칩 나열)
  const [newCat, setNewCat] = useState('');              // 시트 안 '새 카테고리' 입력 — relation(선택값)과 분리한다
                                                         //   종전엔 입력칸이 relation 을 직접 편집해, 타이핑하는 동안
                                                         //   '이 명식의 카테고리'가 미완성 문자열로 바뀌어 있었다.
  // 정확한 시각 — **24시간제 직접 입력**(daniel 2026-08-11 "오전오후 나누지말고 24시간 기준으로").
  //   이력: 07-17 에 `12:30` 이 낮/밤 헷갈린다고 오전/오후 토글을 넣었는데, 08-11 에 **`00:03` 이 등록이 안 되는**
  //   문제가 났다(12시간제라 시가 1~12 뿐). 저장 형식이 어차피 24시간제이므로 입력도 24시간제로 받아
  //   **변환 자체를 없앴다** — 0=자정 · 12=정오 · 23=밤 11시.
  const init24H = initTime && initSijinIdx < 0 ? parseInt(initTime.split(':')[0] ?? '', 10) : NaN;
  const [exactH, setExactH] = useState(!isNaN(init24H) ? String(init24H) : '');
  const [exactM, setExactM] = useState(initTime && initSijinIdx < 0 ? (initTime.split(':')[1] ?? '') : '');
  const [calendar, setCalendar] = useState<'양' | '음'>(initial?.calendar ?? '양');
  const [isLeap, setIsLeap] = useState<boolean>((initial as any)?.isLeap ?? false); // ⑧ 윤달(daniel) — 음력 윤달 구분
  const [sex, setSex] = useState<'남' | '여'>(initial?.sex ?? '남');
  // ★기본 출생지 = 대한민국 서울(daniel 2026-07-24) — 대다수 사용자 편의로 미리 채움(진태양시 경도·위도 포함). 신규 등록만(편집=기존값 우선).
  // ★기본값을 '서울'로 두지 않는다(daniel 2026-08-14 "기존 등록된건 알맞게 고치고").
  //   종전엔 안 고르면 조용히 **서울 출생으로 단정**됐다 — 부산 사람은 시주가 갈린다
  //   (실측: 1994-03-16 13:35 → 서울 甲午 / 부산 乙未).
  //   ⇒ 비워 두면 엔진이 한국 평균(127.5°)으로 떨어뜨린다. 오차가 ±3분으로 **단정보다 작다.**
  //   ⚠️기존에 저장된 '서울'은 **자동으로 못 고친다** — 진짜 서울인지 안 고른 건지 구분할 수 없다.
  //     대신 아래 안내로 사용자가 직접 확인·수정하게 한다.
  const [birthPlace, setBirthPlace] = useState(initial?.birthPlace ?? '');
  const [birthPlaceLon, setBirthPlaceLon] = useState<number | null>(initial?.birthLon ?? null);
  const [birthPlaceLat, setBirthPlaceLat] = useState<number | null>(initial?.birthLat ?? 37.5665);  // 점성술 상승궁 위도 — 서울 기본
  const [relation, setRelation] = useState<string>(initial?.relation ?? defaultRelation ?? 'self');
  const [cats, setCats] = useState<string[]>(() => getCategories()); // 관리 카테고리 목록(프리셋+커스텀+기타·self 제외)
  const [makeRep, setMakeRep] = useState(false); // 이 명식을 대표로 설정(register 전용)

  // ── 4단계 입력(시안 p03) ────────────────────────────────────────────────
  //   1 누구인가(이름·성별) → 2 언제(생년월일·양음·윤달) → **3 어디서(출생지·카테고리·상황)** → **4 몇 시(시각)**
  //
  //   ⚠️★★2026-08-23 **3·4 를 맞바꿨다** (Boss: *"시간보정 제대로 받으려면 출생지를 먼저 받아야 하는 거 아니야?"*).
  //     Boss 말이 맞았고, 근거는 이 파일 안에 이미 있었다 —
  //     시진 선택 모달은 `boundaryInfo` 로 **"거주지 보정 +N분 → 실제 HH:MM (○시)"** 를 이미 띄운다.
  //     그런데 그 모달이 뜨는 시점이 **출생지를 묻기 전**이라 `birthPlaceLon` 이 null 이었고,
  //     `lonOf()` 가 **한국 평균 127.5** 로 떨어져 **틀린 보정값을 보여 주고 있었다.**
  //     ⇒ 출생지를 먼저 받으면 그 미리보기가 비로소 맞는 값이 된다.
  //   ★결과(시주) 자체는 순서와 무관하다 — 엔진은 등록을 마친 뒤 네 값을 한꺼번에 받아 보정한다.
  //     바뀌는 것은 **입력 중에 보여 주는 값의 정확도**다.
  //   ★쉬운 것부터 묻는다는 원칙은 유지 — 이름·성별은 고민이 없고, 출생지·상황은 모르면 건너뛴다.
  //   ★시각을 **마지막 한 칸**으로 둔 이유는 그대로다: '모른다'가 정당한 답이라 다른 칸과 섞지 않는다.
  const [step, setStep] = useState(0);
  const [stepHint, setStepHint] = useState<string | null>(null);   // 왜 못 넘어가는지(빈 반응 방지)
  const STEP_COUNT = 4;
  // ★출생지 시트가 떠 있는가 — 뒤로가기를 가로채려면 **부모가 알아야** 한다(아래 goBack 참조).
  const [placeOpen, setPlaceOpen] = useState(false);
  /** 이 단계를 채웠는가 — 못 채우면 '다음'을 막는다(마지막 검증은 종전 handleSubmit 이 한다). */
  const stepReady = (i: number): boolean => {
    // ★★2026-08-27 Boss: *"이름 없음 안나오게 무조건 이름필드 입력 받게해 명식이랑"*
    //   ⚠️종전엔 «이름은 비어도 된다(관계명으로 대체)» 였다. 그래서 친구 목록·대화방에
    //     **「이름 없음」** 이 떴다 — 실제로 Boss 친구가 그렇게 보였다.
    //   ★두 글자 이상을 요구한다: 한 글자는 사람을 가리키지 못하고(「ㅇ」), 공백만 친 것도 막힌다.
    if (i === 0) return label.trim().length >= 2;
    if (i === 1) return birthDate.replace(/\D/g, '').length === 8;
    return true;                                    // 시각·출생지는 '모름'이 정당한 답이다
  };
  /** 단계형에서 이 블록을 지금 보여줄 것인가(단계형이 아니면 늘 보여 준다). */
  const at = (i: number): boolean => !stepped || step === i;

  // ── ★뒤로가기를 이 화면이 **먼저 받는다** (Boss 2026-08-24) ──────────────
  //   제보: *"도시입력중에 뒤로가기하면 저장된상태로 이전등록 화면으로 가야지"* —
  //   지금은 시트가 떠 있든 3단계까지 채웠든 **화면 전체가 빠져나가** 입력이 전부 날아간다.
  //   원인은 단순하다: 뒤로가기를 **아무도 가로채지 않았다**(앱 전체에 BackHandler 가 한 곳도 없었다).
  //
  //   ★가로채는 순서 = 화면에서 가장 위에 떠 있는 것부터 (사용자가 마지막에 연 것이 먼저 닫힌다)
  //     ① 열린 시트(출생지·시각·카테고리) → 그것만 닫는다
  //     ② 단계형이고 첫 단계가 아니면 → **이전 단계**로. 입력값은 그대로 남는다(state 를 안 건드린다)
  //     ③ 그 외 → 막지 않는다. 화면을 떠난다
  //   ⚠️막을 이유가 없을 때는 **반드시 통과시킨다** — 못 나가는 화면이 제일 나쁘다.
  const navigation = useNavigation();
  const goBack = useCallback((): boolean => {
    if (placeOpen) { setPlaceOpen(false); return true; }
    if (sijinOpen) { setSijinOpen(false); return true; }
    if (catOpen) { setCatOpen(false); return true; }
    if (stepped && step > 0) { setStepHint(null); setStep((v) => Math.max(0, v - 1)); return true; }
    return false;
  }, [placeOpen, sijinOpen, catOpen, stepped, step]);

  // 안드로이드 하드웨어/제스처 뒤로가기
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
  }, [goBack]);

  // iOS 스와이프·헤더 뒤로
  //   ⚠️⚠️**사용자가 뒤로 갈 때만** 가로챈다(`GO_BACK`·`POP`).
  //     처음엔 모든 이탈을 가로챘다가 **등록 자체가 막혔다**(2026-08-24 웹 실측):
  //     저장을 마치고 `router.replace('/analyzed')` 를 부르는데 그것도 '화면 이탈'이라
  //     `beforeRemove` 가 잡아 취소해 버렸다 — 등록을 눌러도 화면이 그대로였다.
  //     `beforeRemove` 는 replace·reset 같은 **프로그램 이동에도 불린다.** 종류를 봐야 한다.
  //   ⚠️`preventDefault` 는 **막을 때만.** 통과시킬 때 건드리면 화면이 갇힌다.
  useEffect(() => {
    const unsub = (navigation as any)?.addListener?.('beforeRemove', (e: any) => {
      const type = e?.data?.action?.type;
      if (type !== 'GO_BACK' && type !== 'POP') return;   // 프로그램 이동(replace 등)은 건드리지 않는다
      if (!goBack()) return;      // 막을 이유가 없다 → 그대로 나간다
      e.preventDefault();         // 시트를 닫았거나 한 단계 물러섰다 → 화면은 그대로 둔다
    });
    return unsub;
  }, [navigation, goBack]);

  // ★★웹 브라우저 뒤로가기는 **위 둘 중 어느 것도 안 잡는다** (2026-08-24 실측).
  //   `BackHandler` 는 안드로이드 전용이고, `beforeRemove` 는 브라우저 popstate 로는 안 불린다.
  //   ⇒ 히스토리에 **예비 칸**을 하나 쌓아 뒤로가기가 그걸 먼저 먹게 한다.
  //     먹었을 때 되돌릴 게 남아 있으면 다시 한 칸 쌓아 화면에 머물고, 없으면 진짜로 나간다.
  //
  //   ⚠️★한 번 이걸 **범인으로 잘못 지목해 걷어냈다가 되살렸다**(같은 날).
  //     증상: 등록을 마쳐도 홈으로 튕긴다. 이 가드가 히스토리를 어긋나게 한 줄 알았는데,
  //     걷어내고 다시 재 보니 **증상이 그대로였다** — 진짜 원인은 웹에서 `router.replace({params})`
  //     가 값을 못 넘기는 것이었고(analyzed 가 빈손으로 뜸), 이 가드는 무죄였다.
  //     ★교훈: 고친 뒤 **다시 재기 전까지는** 원인을 지목하지 말 것.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const w = globalThis as any;
    if (!w?.history?.pushState || !w?.addEventListener) return;
    w.history.pushState({ __regGuard: true }, '');
    const onPop = () => {
      if (goBack()) w.history.pushState({ __regGuard: true }, '');  // 아직 되돌릴 게 있다 -> 머문다
      else w.history.back();                                        // 다 되돌렸다 -> 진짜로 나간다
    };
    w.addEventListener('popstate', onPop);
    return () => w.removeEventListener('popstate', onPop);
  }, [goBack]);
  // 풀이 grounding 기본정보(선택, daniel) — 하는 일·관계상태·관심/고민·메모. 입력 시 통변이 더 정확(특히 R25: 현재 배우자 유무가 연애·결혼·궁합 풀이를 좌우).
  // ★상황(daniel 2026-07-28 "풀이가 너무 직장인에만 포커스") — **고정 키** 칩.
  //   자유 텍스트('하는 일')는 사람마다 표기가 제각각이라(회사원/직딩/백수…) 모델이 일관되게 못 쓴다.
  //   또 자유 텍스트를 프롬프트에 그대로 넣는 건 인젝션 표면이다 — 키는 서버가 화이트리스트로 라벨링한다.
  const [situation, setSituation] = useState<string>(initial?.context?.situation ?? '');
  const [job, setJob] = useState(initial?.context?.job ?? '');
  const [relationship, setRelationship] = useState<string>(initial?.context?.relationship ?? '');
  const [concern, setConcern] = useState(initial?.context?.concern ?? '');
  const [note, setNote] = useState(initial?.context?.note ?? '');

  const sj = sijinIdx >= 0 ? SIJIN[sijinIdx] : null;
  // 정확 시각(12시간제 입력: 오전/오후 + 1~12시) → 24시간제(exH24)로 변환해 진태양시 보정·저장에 사용.
  // ★변환 규칙은 `lib/engine/birthTime.ts` **한 곳**에만 둔다 — 화면과 골든이 같은 함수를 쓴다.
  //   여기 식을 다시 적으면 골든이 복사본을 검사하게 되고, 한쪽만 고쳐도 통과해 버린다.
  const bt = parseBirthTime(exactH, exactM);
  const { hour: exH24, minute: exM, why: exactWhy } = bt;
  const exactStr = bt.h24;
  const exactValid = exactStr !== null;
  const hint = exactValid ? hourHint(exH24) : null;   // 0시·12시만 '자정'·'정오' 꼬리표
  const timeLabel = exactStr ? `${exH24}:${String(exM).padStart(2, '0')}${hint ? ` (${hint})` : ''}`
    : sj ? `${sj.gz} ${sj.ko} (${sj.range})` : t('register.timeUnknown');

  function pickSijin(i: number) { setSijinIdx(i); setExactH(''); setExactM(''); setSijinOpen(false); } // 시진/모름 선택 = 정확시각 해제
  function confirmExact() { if (exactStr) { setSijinIdx(-1); setSijinOpen(false); } }                 // 정확시각 확정(시진 무시)

  // ── 카테고리 관리(daniel 07-18): 신규 생성 → 목록·선택 반영 / 길게 눌러 삭제 → 소속 명식 '기타'로 ──
  async function addNewCat() {
    const n = newCat.trim();
    if (!n) return;
    await addCategory(n);
    setCats(getCategories());
    setRelation(n);   // 방금 만든 카테고리를 이 명식에 선택
    setNewCat('');    // 입력칸 비우기 — 연속 추가가 자연스럽게
    setCatOpen(false);
  }
  function confirmRemoveCat(r: string) {
    if (!isRemovable(r)) return; // self·기타는 삭제 불가
    // ★★Modal 두 개를 동시에 present 하지 않는다.
    //   이 앱의 Alert 는 **RN Modal 기반**이고(lib/ui/alert), RN Modal 은 한 번에 하나만 뜬다.
    //   카테고리 시트가 열린 채로 확인창을 띄우면 확인창이 안 보이거나 iOS 가 죽는다
    //   ([[alert-double-fire-crash]] — 모달 연속 present 로 실제 terminate 된 이력).
    //   ⇒ 시트를 먼저 닫고, dismiss 애니가 끝난 뒤(380ms — confirmChart 와 같은 값) 확인창을 띄운다.
    //   취소·삭제 어느 쪽이든 **시트로 되돌려** 사용자가 하던 흐름을 잃지 않게 한다.
    setCatOpen(false);
    setTimeout(() => Alert.alert(
      t('register.catDeleteTitle', '카테고리 삭제'),
      t('register.catDeleteMsg', `‘${r}’ 카테고리를 삭제할까요? 이 카테고리의 명식들은 ‘기타’로 옮겨집니다.`),
      [
        { text: t('common.cancel', '취소'), style: 'cancel', onPress: () => setCatOpen(true) },
        { text: t('common.delete', '삭제'), style: 'destructive', onPress: async () => {
          await removeCategory(r);   // ★소속 명식 relation → '기타' 일괄(reassignRelation)
          setCats(getCategories());
          if (relation === r) setRelation(OTHER_CATEGORY); // 선택 중이던 카테고리면 기타로
          setCatOpen(true);
        } },
      ],
      () => setCatOpen(true),   // 뒤로가기로 닫아도 시트로 복귀(길이 끊기지 않게)
    ), 380);
  }

  // 경계시 보정(daniel) — 정확시각 입력 시 진태양시 = 시계 + 거주지 보정. 시진 경계 ±20분이면 경고(시주가 바뀔 수 있음).
  const boundaryInfo = useMemo(() => {
    if (!exactStr) return null;
    const [by, bm, bd] = birthDate.split('-').map((x) => parseInt(x, 10));
    if (!by || !bm || !bd) return null;
    // ⚠️birthLat 도 넘긴다 — 애리조나·퀸즐랜드처럼 **같은 나라 안에서 위도로 서머타임이 갈리는** 곳이 있다.
    const input = { birthDateTime: `${birthDate} ${exactStr}`, calendar, sex, birthPlace, birthLon: birthPlaceLon ?? undefined, birthLat: birthPlaceLat ?? undefined } as any;
    const offset = Math.round(trueSolarOffsetMin(input, by, bm, bd, exH24, exM));
    const solarMin = (((exH24 * 60 + exM + offset) % 1440) + 1440) % 1440;           // 진태양시 분(0~1439)
    const fromStart = (((solarMin - 1380) % 120) + 120) % 120;                       // 시진 블록(子 23:00 시작, 2h) 경계로부터
    const toBoundary = Math.min(fromStart, 120 - fromStart);                         // 가까운 시진 경계까지(분)
    const blockIdx = Math.floor(((((solarMin - 1380) % 1440) + 1440) % 1440) / 120); // 0=자..11=해
    const SIJI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
    // ★시간대 판정을 **입력 중에 보여 준다**(2026-08-23) — 밀라노 출생이 서머타임 없이 계산되던 사고 이후.
    //   보정 분수만 보면 그게 어느 나라 표준시로 계산된 값인지 알 수 없어, 틀려도 조용히 지나간다.
    const tz = tzOf(input, by, bm, bd, exH24, exM);
    return {
      offset,
      solarTime: `${String(Math.floor(solarMin / 60)).padStart(2, '0')}:${String(solarMin % 60).padStart(2, '0')}`,
      siji: SIJI[blockIdx], toBoundary, warn: toBoundary <= 20,
      zone: tz.zone, dst: tz.dstApplied, overseas: tz.source !== 'korea', tzUncertain: tz.uncertain,
    };
  }, [exactStr, birthDate, calendar, sex, birthPlace, birthPlaceLon, birthPlaceLat, exH24, exM]);

  // input 구성 — 수동 제출·자동저장 공용. label/relation 은 메타(ChartInput PII 계약 외).
  function buildInput() {
    return {
      // ★이름은 위 `stepReady(0)` 가 이미 막았으므로 여기 폴백은 **단계형이 아닌 경로**의 안전망이다.
      //   (폴백을 없애면 옛 화면에서 저장이 통째로 막힌다 — 규칙은 앞에서 걸고 뒤는 남긴다.)
      label: label.trim() || (relation === 'self' ? t('register.selfLabel') : relation),
      birthDateTime: `${birthDate} ${exactStr ?? (sj ? sj.hm : '0:0')}`, // 정확시각 우선(진태양시 보정 대상) → 없으면 시진 대표시각 → 모름=0:0
      calendar, sex, birthPlace, birthLon: birthPlaceLon ?? undefined, birthLat: birthPlaceLat ?? undefined, // 진태양시 경도 + 점성술 위도
      relation,
      timeAccuracy: (exactStr || sj) ? '정확' : '미상', // 정확시각 또는 시진 알면 시주 확정 → 정확
      makeRep, // 대표 설정 여부 — register 라우트가 처리(궁합 상대 등록 시 showMakeRep=false 라 무시)
      // 풀이 grounding 기본정보(선택) — 하나라도 채워졌을 때만 context 전달(빈 값은 undefined로 정리).
      context: (situation || job.trim() || relationship || concern.trim() || note.trim())
        ? { situation: situation || undefined, job: job.trim() || undefined, relationship: relationship || undefined, concern: concern.trim() || undefined, note: note.trim() || undefined }
        : undefined,
      ...(calendar === '음' && isLeap ? { isLeap: true } : {}), // ⑧ 윤달 — 음력 윤달일 때만 전달(saju.ts solarYmd가 음수 month로 변환)
    };
  }
  function handleSubmit() {
    const input = buildInput();
    // ★생년월일 유효성 게이트(감사 H3/H4/H6 · 2026-07-26). 엔진은 지금까지 입력을 검증하지 않아
    //   없는 날짜(2월 30일·월 13)를 조용히 롤오버해 팔자를 만들고, 없는 윤달은 음력→양력 변환에
    //   실패한 채 *양력으로 폴백*했다(음력 입력인데 양력 사주). 사주는 하루만 어긋나도 일주가
    //   통째로 달라지므로 **저장 입구에서 막는다** — 이미 저장된 명식은 그대로 열람(회귀 0).
    const problems = validateBirthInput(input as any);
    if (problems.length) { Alert.alert(t('register.invalidDateTitle', '생년월일을 확인해 주세요'), problems.join('\n')); return; }
    onSubmit(input);
  }

  // 자동저장(편집모드) — 필드 변경 600ms 후 저장(저장 버튼 따로 안 눌러도 됨, daniel). 초기 prefill 은 skip(불필요 저장 방지).
  const firstAuto = useRef(true);
  useEffect(() => {
    if (!autoSave || !onAutoSave) return;
    if (firstAuto.current) { firstAuto.current = false; return; }
    // ★유효하지 않은 입력은 **조용히 저장 스킵**(감사 H3/H4/H6). 편집 중에는 타이핑 도중 일시적으로
    //   날짜가 불완전해지는 게 정상이라 여기서 Alert 을 띄우면 방해만 된다 — 경고는 수동 저장(handleSubmit)에서.
    const id = setTimeout(() => { const inp = buildInput(); if (!validateBirthInput(inp as any).length) onAutoSave(inp); }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, birthDate, sijinIdx, exactStr, calendar, isLeap, sex, birthPlace, birthPlaceLon, birthPlaceLat, relation, makeRep, situation, job, relationship, concern, note, autoSave]);
  // ★exactStr(정확시각·오전/오후)·birthPlaceLat 를 deps 에 포함 — 빠져 있어서 시각·위도 수정이 자동저장 안 됐다(daniel 07-18 "확인 안 눌러도 반영").

  return (
    <>
      <ScrollView
        style={styles.screen} contentContainerStyle={styles.form}
        // ★명식 등록 = 입력이 많고 아래쪽(관계·직업)은 키보드에 정확히 덮이는 자리다.
        //   iOS 자동 인셋으로 입력창이 항상 보이게(daniel 07-18 표준 · check:keyboard 가 강제).
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        {/* ★단계 머리말(시안 p03) — 제목 + 진행 점. 단계형일 때만 */}
        {stepped ? (
          <View style={styles.stepHead}>
            <Text style={styles.stepTitle}>{t('register.stepTitle', '사주 정보 입력')}</Text>
            <View style={styles.dots}>
              {Array.from({ length: STEP_COUNT }).map((_, i) => (
                <View key={i} style={[styles.dot, i === step && styles.dotOn, i < step && styles.dotDone]} />
              ))}
            </View>
            <Text style={styles.stepDesc}>{t(`register.step${step}Desc`)}</Text>
          </View>
        ) : null}

        {/* 이름·별칭 */}
        {/* ── 1단계 · 누구인가 (이름 · 성별) ─────────────────────────────
              ★쉬운 것부터 묻는다 — 고민이 필요 없는 두 칸이라 첫 화면의 부담이 가장 낮다. */}
        {at(0) ? (<>
          <Text style={styles.label}>{t('register.name')}</Text>
          <TextInput style={styles.input} value={label} onChangeText={setLabel}
            placeholder={t('register.namePh')} placeholderTextColor={colors.inkFaint} />

          <Text style={styles.label}>{t('register.sex')}</Text>
          <Segmented options={[{ value: '남', label: t('register.male') }, { value: '여', label: t('register.female') }]}
            value={sex} onChange={(v) => setSex(v as '남' | '여')} />
        </>) : null}

        {/* ── 2단계 · 언제 (생년월일 · 양음 · 윤달) ────────────────────────
              ★양력/음력을 생년월일 **바로 아래** 둔다. 종전엔 시각 블록이 사이에 끼어 있어
                날짜를 적고 한참 아래에서 음력을 고르게 돼 있었다. */}
        {at(1) ? (<>
          {/* 생년월일 — 숫자 입력 자동 하이픈(19900315 → 1990-03-15) */}
          <Text style={styles.label}>{t('register.birthDate')}</Text>
          <TextInput style={styles.input} value={birthDate}
            onChangeText={(v) => setBirthDate(formatBirthDate(v))}
            placeholder={t('register.birthDatePh')} placeholderTextColor={colors.inkFaint}
            keyboardType="number-pad" maxLength={10} />

          <Text style={styles.label}>{t('register.calendar')}</Text>
          <Segmented options={[{ value: '양', label: t('register.solar') }, { value: '음', label: t('register.lunar') }]}
            value={calendar} onChange={(v) => setCalendar(v as '양' | '음')} />
          {/* ⑧ 윤달(daniel) — 음력 선택 시 평달/윤달 구분(같은 달이 두 번 드는 해) */}
          {calendar === '음' && (
            <Segmented options={[{ value: 'false', label: t('register.normalMonth', '평달') }, { value: 'true', label: t('register.leapMonth', '윤달') }]}
              value={String(isLeap)} onChange={(v) => setIsLeap(v === 'true')} />
          )}
        </>) : null}

        {/* ── 3단계 · 몇 시 (태어난 시각) ─────────────────────────────────
              ★한 칸만 두는 단계다 — 시각은 '모른다'가 정당한 답이고, 여기서 망설이는 사람이 많다.
                다른 칸과 섞어 두면 모름을 고르는 것이 포기처럼 보인다. */}
        {at(3) ? (<>
          <Text style={styles.label}>{t('register.birthTimeSijin')}</Text>
          <PressableScale style={styles.select} onPress={() => setSijinOpen(true)}>
            <Text style={[styles.selectText, !exactStr && !sj && styles.selectPlaceholder]}>{timeLabel}</Text>
            <Text style={styles.selectChevron}>▾</Text>
          </PressableScale>
        </>) : null}

        {/* ── 4단계 · 어디서 + 나머지 (출생지 · 카테고리 · 내 상황 · 대표) ── */}
        {at(2) ? (<>
        {/* 출생지 — 도시 검색 선택(Nominatim, 검증된 입력 + 진태양시 경도 보관) */}
        <Text style={styles.label}>{t('register.birthPlace')}</Text>
        <BirthPlacePicker
          value={birthPlace}
          onSelect={(p) => { setBirthPlace(p.name); setBirthPlaceLon(p.lon); setBirthPlaceLat(p.lat); }}
          onOpenChange={setPlaceOpen}   /* ★뒤로가기가 시트를 먼저 닫게 하려면 부모가 알아야 한다 */
        />
        {/* 왜 묻는지 밝힌다 — 안 고르면 어떻게 되는지도 함께(몰래 기본값을 쓰지 않는다) */}
        <Text style={styles.placeHint}>
          {birthPlaceLon == null
            ? t('register.placeHintNone', '지역마다 해 뜨는 시각이 달라 태어난 시가 갈릴 수 있어요. 고르지 않으면 한국 평균으로 계산해요.')
            : t('register.placeHintSet', '이 지역의 실제 태양시로 태어난 시를 맞춥니다.')}
        </Text>

        {/* 관계(카테고리) — **드롭박스**(daniel 2026-08-12 *"버블형식으로 나열하지말고 드랍박스로하자"*).
            종전엔 칩을 flexWrap 으로 늘어놓아, 카테고리를 추가할수록 화면이 밀려 내려갔고
            **삭제가 '길게 누르기'뿐이라 아무도 찾을 수 없었다.** 시트 안에서 선택·추가·삭제를 모두 한다.
            (시트 관용구는 아래 시진 선택과 동일 — 화면 안에서 두 방식이 갈리지 않게) */}
        <Text style={styles.label}>{t('register.relation')}</Text>
        <PressableScale style={styles.dropBox} onPress={() => setCatOpen(true)}>
          <Text style={styles.dropTx}>{relation === 'self' ? t('register.selfLabel') : (relation || t('register.pickCategory', '카테고리 선택'))}</Text>
          <Text style={styles.dropCaret}>▾</Text>
        </PressableScale>

        {/* 내 상황(선택) — 풀이 grounding 기본정보. R25: 현재 배우자 유무가 연애·결혼·궁합 풀이를 좌우 */}
        <View style={styles.ctxBox}>
          <Text style={styles.ctxTitle}>{t('register.ctxTitle')}</Text>
          <Text style={styles.ctxDesc}>{t('register.ctxDesc')}</Text>

          {/* ★상황 칩 — 자유 입력보다 위에 둔다. 한 번 눌러 끝나므로 채워질 확률이 훨씬 높고,
              고정 키라 모델이 일관되게 쓴다(자유 텍스트는 보조 설명 역할로 남긴다). */}
          <Text style={styles.ctxLabel}>{t('register.ctxSit')}</Text>
          <Text style={styles.ctxHint}>{t('register.ctxSitDesc')}</Text>
          <View style={styles.chipRow}>
            {([['study', t('register.sitStudy')], ['work', t('register.sitWork')], ['biz', t('register.sitBiz')], ['free', t('register.sitFree')],
               ['home', t('register.sitHome')], ['seek', t('register.sitSeek')], ['retire', t('register.sitRetire')], ['etc', t('register.sitEtc')]] as const).map(([v, lbl]) => {
              const on = situation === v;
              return (
                <PressableScale key={v} style={[styles.chip, on && styles.chipOn]} onPress={() => setSituation(on ? '' : v)}>
                  <Text style={on ? styles.chipOnText : styles.chipText}>{lbl}</Text>
                </PressableScale>
              );
            })}
          </View>

          <Text style={styles.ctxLabel}>{t('register.ctxJob')}</Text>
          <TextInput style={styles.input} value={job} onChangeText={setJob}
            placeholder={t('register.ctxJobPh')} placeholderTextColor={colors.inkFaint} />

          <Text style={styles.ctxLabel}>{t('register.ctxRel')}</Text>
          <View style={styles.chipRow}>
            {([['single', t('register.ctxRelSingle')], ['dating', t('register.ctxRelDating')], ['married', t('register.ctxRelMarried')], ['other', t('register.ctxRelOther')]] as const).map(([v, lbl]) => {
              const on = relationship === v;
              return (
                <PressableScale key={v} style={[styles.chip, on && styles.chipOn]} onPress={() => setRelationship(on ? '' : v)}>
                  <Text style={on ? styles.chipOnText : styles.chipText}>{lbl}</Text>
                </PressableScale>
              );
            })}
          </View>

          <Text style={styles.ctxLabel}>{t('register.ctxConcern')}</Text>
          <TextInput style={[styles.input, styles.inputMulti]} value={concern} onChangeText={setConcern}
            placeholder={t('register.ctxConcernPh')} placeholderTextColor={colors.inkFaint} multiline />

          <Text style={styles.ctxLabel}>{t('register.ctxNote')}</Text>
          <TextInput style={[styles.input, styles.inputMulti]} value={note} onChangeText={setNote}
            placeholder={t('register.ctxNotePh')} placeholderTextColor={colors.inkFaint} multiline />
        </View>

        {/* 대표 명식으로 설정 — register 전용(궁합 상대 등록 시 숨김) */}
        {showMakeRep && (
          <PressableScale style={styles.repCheck} onPress={() => setMakeRep((v) => !v)}>
            <View style={[styles.repBox, makeRep && styles.repBoxOn]}>{makeRep ? <Text style={styles.repChk}>✓</Text> : null}</View>
            <Text style={styles.repLabel}>{t('register.makeRep')}</Text>
          </PressableScale>
        )}

        </>) : null}

        {/* 제출 — 단계형에서는 **마지막 단계에서만** 뜬다. 그 전에는 [이전][다음]. */}
        {!stepped || step === STEP_COUNT - 1 ? (
          <PressableScale style={styles.submit} onPress={handleSubmit}>
            <Text style={styles.submitText}>{submitLabel ?? t('register.submit')}</Text>
          </PressableScale>
        ) : null}

        {/* 단계 이동 — '다음'은 이 단계를 채워야 눌린다(마지막 검증은 종전 handleSubmit 이 한다) */}
        {stepped ? (
          <>
          {stepHint ? <Text style={styles.stepHint}>{stepHint}</Text> : null}
          <View style={styles.navRow}>
            {step > 0 ? (
              <PressableScale style={styles.navGhost} onPress={() => setStep((v) => Math.max(0, v - 1))}>
                <Text style={styles.navGhostTx}>{t('register.prev', '이전')}</Text>
              </PressableScale>
            ) : null}
            {step < STEP_COUNT - 1 ? (
              <PressableScale
                style={[styles.navNext, !stepReady(step) && styles.navNextOff]}
                onPress={() => {
                  if (stepReady(step)) { setStepHint(null); setStep((v) => Math.min(STEP_COUNT - 1, v + 1)); return; }
                  // ⚠️눌렀는데 **아무 일도 안 일어나면 고장으로 읽힌다**(실물에서 확인).
                  //   막는 데서 끝내지 않고 무엇이 모자란지 적는다.
                  setStepHint(t('register.needDate', '생년월일 8자리를 입력해 주세요.'));
                }}
              >
                <Text style={styles.navNextTx}>{t('register.next', '다음')}</Text>
              </PressableScale>
            ) : null}
          </View>
          </>
        ) : null}
      </ScrollView>

      {/* ★카테고리 드롭박스(daniel 2026-08-12) — 선택·추가·삭제를 **한 곳에서**.
          · 삭제는 각 줄의 '✕' 로 **보이게** 한다. 종전엔 길게 누르기뿐이라 기능이 있어도 없는 것과 같았다.
          · '본인'과 '기타'는 ✕ 를 아예 그리지 않는다(isRemovable) — 누를 수 없는 버튼을 보여 주지 않는다.
          · 삭제하면 그 카테고리의 명식들은 **전부 '기타'로** 옮겨진다(removeCategory→reassignRelation).
          시트 관용구·스타일은 아래 시진 선택과 동일하게 맞췄다([[duplicate-ui-single-source]]). */}
      <Modal statusBarTranslucent visible={catOpen} transparent animationType="slide" onRequestClose={() => setCatOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCatOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('register.relation')}</Text>
            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {/* 본인(self) — 고정(삭제 불가) */}
              <Pressable style={styles.catRow} onPress={() => { setRelation('self'); setCatOpen(false); }}>
                <Text style={[styles.catRowTx, relation === 'self' && styles.catRowOn]}>{t('register.selfLabel')}</Text>
                {relation === 'self' && <Text style={styles.catCheck}>✓</Text>}
              </Pressable>
              {cats.map((r) => (
                <Pressable key={r} style={styles.catRow} onPress={() => { setRelation(r); setCatOpen(false); }}>
                  <Text style={[styles.catRowTx, relation === r && styles.catRowOn]}>{r}</Text>
                  {relation === r && <Text style={styles.catCheck}>✓</Text>}
                  {/* ★기타·본인은 ✕ 자체를 안 그린다 — 삭제 불가를 눌러 보고 알게 하지 않는다 */}
                  {isRemovable(r) && (
                    <Pressable hitSlop={10} style={styles.catDel} onPress={() => confirmRemoveCat(r)}>
                      <Text style={styles.catDelTx}>✕</Text>
                    </Pressable>
                  )}
                </Pressable>
              ))}
            </ScrollView>
            {/* 새 카테고리 — 시트 안에서 바로 추가하고 그대로 선택된다 */}
            <Text style={styles.sheetDivider}>{t('register.newCategory', '새 카테고리')}</Text>
            <View style={{ flexDirection: 'row', gap: space(2) }}>
              <TextInput style={[styles.input, { flex: 1, marginTop: 0 }]} value={newCat} onChangeText={setNewCat}
                placeholder={t('register.newCategoryPh', '새 카테고리 이름')} placeholderTextColor={colors.inkFaint} />
              <PressableScale style={[styles.addCatBtn, !newCat.trim() && styles.addCatBtnOff]} onPress={addNewCat} disabled={!newCat.trim()}>
                <Text style={styles.addCatBtnTx}>{t('common.add', '추가')}</Text>
              </PressableScale>
            </View>
            <Text style={styles.catHint}>{t('register.catDelHint', '카테고리를 지우면 그 명식들은 ‘기타’로 옮겨져요. ‘기타’는 지울 수 없어요.')}</Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 시진 선택 바텀시트 — 클릭 시 슬라이드 업, 스크롤로 12시진+모름 선택 */}
      <Modal statusBarTranslucent visible={sijinOpen} transparent animationType="slide" onRequestClose={() => setSijinOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSijinOpen(false)}>
          {/* 시트 영역 탭은 닫히지 않게(빈 onPress 로 전파 차단) */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('register.birthTimeSijin')}</Text>
            {/* 정확한 시각(시:분) — 알면 우선(진태양시 보정). 출생지 경도로 시주 정밀 산출(daniel). */}
            <View style={styles.exactBox}>
              <Text style={styles.exactLabel}>{t('register.exactTime', '정확한 시각을 알아요 (출생지 경도로 진태양시 보정)')}</Text>
              <View style={styles.exactRow}>
                <TextInput style={styles.exactInput} value={exactH} onChangeText={(v) => setExactH(v.replace(/[^0-9]/g, '').slice(0, 2))} placeholder={t('register.hour24', '시(0~23)')} placeholderTextColor={colors.inkFaint} keyboardType="number-pad" maxLength={2} />
                <Text style={styles.exactColon}>:</Text>
                <TextInput style={styles.exactInput} value={exactM} onChangeText={(v) => setExactM(v.replace(/[^0-9]/g, '').slice(0, 2))} placeholder={t('register.minute', '분')} placeholderTextColor={colors.inkFaint} keyboardType="number-pad" maxLength={2} />
                <PressableScale style={[styles.exactBtn, !exactStr && styles.exactBtnOff]} onPress={confirmExact} disabled={!exactStr}>
                  <Text style={styles.exactBtnTx}>{t('common.confirm', '확인')}</Text>
                </PressableScale>
              </View>
              {/* 0시·12시만 꼬리표 — 24시간제에서 유일하게 헷갈리는 두 자리다 */}
              {hint ? <Text style={styles.exactHint}>{t('register.hourHint', '{{h}}시 = {{hint}}', { h: exH24, hint })}</Text> : null}
              {/* ★막힌 이유를 말한다 — 종전엔 확인 버튼만 회색이라 왜 안 되는지 알 수 없었다 */}
              {exactWhy ? <Text style={styles.exactWhy}>{exactWhy}</Text> : null}
              {boundaryInfo && (
                <View style={{ marginTop: space(2.5), padding: space(3), borderRadius: radius.md, backgroundColor: 'rgba(201,161,74,0.1)', borderWidth: 1, borderColor: colors.juLine }}>
                  <Text style={{ fontSize: 13, color: colors.ju, fontWeight: '700' }}>
                    {t('register.solarAdjust', '거주지 보정 {{sign}}{{min}}분 → 실제 {{time}} ({{siji}}시)', {
                      sign: boundaryInfo.offset >= 0 ? '+' : '', min: boundaryInfo.offset,
                      time: boundaryInfo.solarTime, siji: boundaryInfo.siji,
                    })}
                  </Text>
                  {/* ★해외 출생이면 **어느 표준시로 계산했는지** 보여 준다 — 틀린 가정이 조용히 지나가지 않게 */}
                  {boundaryInfo.overseas && (
                    <Text style={{ fontSize: 12, color: colors.ju, marginTop: space(1.5), lineHeight: 17 }}>
                      {boundaryInfo.zone}{boundaryInfo.dst ? ` · ${t('register.dstApplied', '서머타임 적용')}` : ` ${t('register.tzBasis', '기준')}`}
                    </Text>
                  )}
                  {/* ⚠️서머타임 이력을 확정하지 못한 시기·지역 — 추측해 채우지 않고 그대로 알린다 */}
                  {boundaryInfo.tzUncertain && (
                    <Text style={{ fontSize: 12, color: colors.ju, marginTop: space(1.5), lineHeight: 17 }}>
                      ⚠️ 이 시기·지역의 서머타임 이력은 확인되지 않았어요. 시각이 1시간 어긋날 수 있습니다.
                    </Text>
                  )}
                  {boundaryInfo.warn && (
                    <Text style={{ fontSize: 12, color: colors.ju, marginTop: space(1.5), lineHeight: 17 }}>
                      ⚠️ 시(時) 경계까지 {boundaryInfo.toBoundary}분 — 시각이 조금만 달라도 시주가 바뀔 수 있어요. 정확한지 확인하세요.
                    </Text>
                  )}
                </View>
              )}
            </View>
            <Text style={styles.sheetDivider}>{t('register.orSijin', '또는 시진(2시간)만 알 때')}</Text>
            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {/* 모름 */}
              <PressableScale style={styles.optionRow} onPress={() => pickSijin(-1)}>
                <Text style={styles.optionGz}>?</Text>
                <Text style={styles.optionText}>{t('register.timeUnknown')}</Text>
                {sijinIdx === -1 && <Text style={styles.optionCheck}>✓</Text>}
              </PressableScale>
              {SIJIN.map((s, i) => {
                const on = sijinIdx === i;
                return (
                  <PressableScale key={s.gz} style={[styles.optionRow, on && styles.optionRowOn]} onPress={() => pickSijin(i)}>
                    <Text style={[styles.optionGz, on && styles.optionGzOn]}>{s.gz}</Text>
                    <Text style={[styles.optionText, on && styles.optionTextOn]}>{s.ko} · {s.range}</Text>
                    {on && <Text style={styles.optionCheck}>✓</Text>}
                  </PressableScale>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// 세그먼트(양음/남녀) — 선택 시 먹 배경.
function Segmented({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <PressableScale key={o.value} style={[styles.segItem, on && styles.segOn]} onPress={() => onChange(o.value)}>
            <Text style={on ? styles.segOnText : styles.segText}>{o.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' }, // 전역 배경 투과(ContentBackdrop)
  // ★하단 여백 = 하단 크롬(광고 배너 50 + 네비바 86 + 홈 인디케이터 34 ≈ 170pt)을 덮고도 남게.
  //   daniel 2026-08-07 "명식 등록이 짤려" — 맨 아래 '명식 계산·등록' 버튼에 **영영 닿지 못했다**.
  //   실측(시뮬 scrollToEnd): space(12)=48 이면 끝까지 내려도 '대표로 설정' 체크박스가 마지막이고
  //   버튼은 안 나온다 / space(44)=176 이면 버튼이 배너 위에 온전히 뜬다.
  //   ★마지막 요소가 **주 CTA** 인 화면은 하단 여백을 크롬 높이 기준으로 잡아야 한다 —
  //     '조금 잘리는' 게 아니라 **버튼 자체가 사라져** 등록이 불가능해진다.
  form: { padding: space(5), paddingBottom: space(44), gap: space(1.5) },
  label: { ...font.label, marginTop: space(4) },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.sm, paddingVertical: space(3), paddingHorizontal: space(3.5),
    fontSize: 15, color: colors.ink, ...shadow.soft,
  },
  // 시진 드롭다운 필드
  select: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.sm, paddingVertical: space(3.25), paddingHorizontal: space(3.5), ...shadow.soft,
  },
  selectText: { fontSize: 15, color: colors.ink },
  selectPlaceholder: { color: colors.inkFaint },
  selectChevron: { fontSize: 14, color: colors.inkSoft, marginLeft: space(2) },
  // 바텀시트
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: space(5), paddingTop: space(2.5), paddingBottom: space(6), maxHeight: '72%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: space(3) },
  sheetTitle: { ...font.heading, marginBottom: space(2) },
  // 정확한 시각(시:분) 입력 — 시진 병행(daniel: 진태양시 정밀)
  exactBox: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(3.5), marginBottom: space(3) },
  exactLabel: { ...font.label, fontSize: 12, color: colors.inkSoft, marginBottom: space(2.5) },
  // 24시간제로 친 값을 어떻게 읽었는지 · 왜 확인이 안 눌리는지 — 둘 다 **말해 준다**(침묵 금지)
  exactHint: { fontSize: 12, lineHeight: 18, color: colors.ju, marginTop: space(2), fontWeight: '700' },
  // 출생지 안내 — 강조가 아니라 설명이라 차분한 톤(exactHint 는 ju 강조색이라 따로 둔다)
  placeHint: { fontSize: 12, lineHeight: 18, color: colors.inkSoft, marginTop: space(2) },
  exactWhy: { fontSize: 12, lineHeight: 18, color: colors.inkSoft, marginTop: space(2) },
  exactRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  exactInput: { width: 56, textAlign: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: space(2.5), fontSize: 16, color: colors.ink },
  exactColon: { fontSize: 18, fontWeight: '700', color: colors.ink },
  exactBtn: { marginLeft: 'auto', backgroundColor: colors.ju, borderRadius: radius.sm, paddingVertical: space(2.5), paddingHorizontal: space(4) },
  exactBtnOff: { backgroundColor: colors.line },
  exactBtnTx: { color: colors.bg, fontWeight: '700', fontSize: 14 },
  // 오전/오후 토글(daniel 07-17)
  sheetDivider: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginBottom: space(2) },
  sheetList: { flexGrow: 0 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: space(3.5),
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  optionRowOn: { },
  optionGz: { fontSize: 22, fontWeight: '700', color: colors.ink, width: 40 },
  optionGzOn: { color: colors.ju },
  optionText: { flex: 1, fontSize: 15, color: colors.inkSoft },
  optionTextOn: { color: colors.ink, fontWeight: '600' },
  optionCheck: { fontSize: 18, color: colors.ju, fontWeight: '700' },
  // 관계 칩
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(1) },
  // ── 카테고리 드롭박스(daniel 2026-08-12 "버블형식으로 나열하지말고 드랍박스로하자") ──
  //   생김새는 위 input 과 맞춘다 — 같은 폼 안에서 입력칸과 선택칸이 달라 보이면 그 자체가 잡음이다.
  dropBox: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    paddingVertical: space(3), paddingHorizontal: space(3.5), marginTop: space(1),
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dropTx: { color: colors.ink, fontSize: 15 },
  dropCaret: { color: colors.inkFaint, fontSize: 13 },
  // 시트 안 한 줄 = [이름 ………… ✓ ✕]
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(3), borderBottomWidth: 1, borderBottomColor: colors.line },
  catRowTx: { flex: 1, color: colors.inkSoft, fontSize: 15 },
  catRowOn: { color: colors.ju, fontWeight: '800' },
  catCheck: { color: colors.ju, fontSize: 15, fontWeight: '800', marginRight: space(3) },
  // ✕ 는 **삭제 가능한 줄에만** 그린다(isRemovable) — 못 누르는 버튼을 보여 주지 않는다
  catDel: { paddingHorizontal: space(2), paddingVertical: space(1) },
  catDelTx: { color: colors.inkFaint, fontSize: 15 },

  chip: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.pill, paddingVertical: space(2), paddingHorizontal: space(3.5),
  },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipText: { color: colors.inkSoft, fontSize: 14 },
  // 카테고리 신규 추가 버튼 + 삭제 힌트(daniel 07-18)
  addCatBtn: { paddingHorizontal: space(4), justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.ju },
  addCatBtnOff: { backgroundColor: colors.line },
  addCatBtnTx: { color: colors.bg, fontWeight: '700', fontSize: 14 },
  catHint: { ...font.caption, color: colors.inkFaint, marginTop: space(2) },
  chipOnText: { color: colors.bg, fontSize: 14, fontWeight: '700' },
  // 세그먼트
  segment: { flexDirection: 'row', gap: space(2), marginTop: space(1) },
  segItem: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.sm, paddingVertical: space(3), alignItems: 'center',
  },
  segOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  segText: { color: colors.inkSoft, fontSize: 15 },
  segOnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  // 대표 설정 체크
  repCheck: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(5) },
  repBox: { width: 22, height: 22, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  repBoxOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  repChk: { color: colors.bg, fontSize: 14, fontWeight: '800' },
  repLabel: { ...font.body, color: colors.ink },
  // 내 상황(context) 입력 박스
  ctxBox: { marginTop: space(5), padding: space(4), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, ...shadow.soft },
  ctxTitle: { ...font.heading, fontSize: 15 },
  ctxDesc: { ...font.body, fontSize: 12, color: colors.inkSoft, marginTop: space(1), marginBottom: space(1) },
  ctxHint: { ...font.caption, color: colors.inkFaint, marginTop: -2, marginBottom: space(1.5) },
  ctxLabel: { ...font.label, marginTop: space(3.5), marginBottom: space(1) },
  inputMulti: { minHeight: 60, textAlignVertical: 'top', paddingTop: space(2.5) },
  // 제출 CTA (주색)
  submit: {
    backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4),
    alignItems: 'center', marginTop: space(8), ...shadow.card,
  },
  // ── 4단계 입력(시안 p03) ────────────────────────────────────────────────
  stepHead: { alignItems: 'center', marginBottom: space(4), gap: space(3) },
  stepTitle: { fontSize: 22, lineHeight: 30, fontWeight: '900', color: colors.ink, letterSpacing: -0.3 },
  // 진행 점 — 지난 단계는 채우고, 지금은 길게(어디쯤 왔는지 형태로 보이게)
  dots: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.juLine },
  dotDone: { backgroundColor: colors.ju, opacity: 0.55 },
  dotOn: { width: 22, backgroundColor: colors.ju, opacity: 1 },
  stepDesc: { ...font.caption, color: colors.inkSoft, textAlign: 'center' },
  stepHint: { ...font.caption, color: colors.ju, marginTop: space(3), textAlign: 'center' },
  navRow: { flexDirection: 'row', gap: space(2), marginTop: space(2) },
  navGhost: {
    flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine,
    paddingVertical: space(3.5), alignItems: 'center',
  },
  navGhostTx: { ...font.label, color: colors.ju, fontWeight: '800' },
  navNext: { flex: 2, borderRadius: radius.md, backgroundColor: colors.ju, paddingVertical: space(3.5), alignItems: 'center' },
  // 못 누른다는 것을 **색으로** 알린다 — opacity 0.4 만으로는 실물에서 활성과 구분되지 않았다
  navNextOff: { backgroundColor: colors.juLine },
  navNextTx: { ...font.label, color: colors.onJu, fontWeight: '900' },
  submitText: { color: colors.bg, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});
