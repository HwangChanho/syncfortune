// app/src/lib/share.ts — 이슈17: 풀이 결과 공유
// ─────────────────────────────────────────────────────────────────────────
// daniel 설계: ① 공유 링크는 *앱 설치 시에만* 풀이 열람(웹에 내용 노출 X) ② 공유 대상=풀이 결과
//   ③ 만료 없음(앱 게이트라 불필요).
// 동작: 공유 시 풀이 결과를 shared_readings 에 *스냅샷*으로 저장(랜덤 id) → 스마트링크를 공유 시트로.
//   받는 사람: 앱 설치돼 있으면 syncfortune://shared/<id> 로 앱이 열려 풀이 표시,
//   미설치면 stub 페이지가 App Store 로 유도(내용은 안 보임). 읽기는 get_shared_reading RPC(id 단건)만.
// ─────────────────────────────────────────────────────────────────────────
import { Share } from 'react-native';
import { supabase } from '../supabase';

export const APP_STORE_URL = 'https://apps.apple.com/app/id6779321930';
// Supabase Edge Function 스마트링크(깃헙 제거·daniel 2026-06): 앱 설치 시 syncfortune://shared/<id>(1회성 뷰어),
//   미설치 시 App Store 유도. 내용 페이지 아님(최소 리다이렉트). 함수 share(no-verify-jwt 공개).
const SHARE_LINK_BASE = 'https://zpslflbcxzalaikbbdzk.supabase.co/functions/v1/share';
// ★공유 페이지는 GitHub Pages 에서 서빙한다 — Supabase 는 HTML 을 렌더링시키지 않는다(text/plain + sandbox 강제).
const PAGES_BASE = 'https://hwangchanho.github.io/syncfortune';

// 앱 게이트 공유라 충분히 unguessable 한 랜덤 id(22자). expo-crypto 미설치 → Math.random 조합.
function randomShareId(): string {
  let s = '';
  for (let i = 0; i < 5; i++) s += Math.random().toString(36).slice(2, 9);
  return s.replace(/[^a-z0-9]/g, '').slice(0, 22);
}

/**
 * ★무료 성격유형 공유 링크 — **웹에서 보이는** 유일한 공유 경로(daniel 2026-07-26 승인 · L2).
 *
 * 위 `shareReading`(유료 풀이)과 근본적으로 다르다:
 *   · DB 에 아무것도 저장하지 않는다 — 유형 키만 URL 로 넘긴다. 그래서
 *     ①비로그인(가볍게 보기 사용자)도 공유할 수 있고 — `shared_readings` INSERT 는 authenticated 전용이다
 *     ②열거·유출·삭제 대상이 없고 ③되돌리려면 share 함수만 재배포하면 된다.
 *   · **PII 를 담지 않는다** — 생년월일·시각·이름 없음. 유형 키(일간+월지)+성별뿐이라 연도가 없어
 *     생일 역산이 안 된다. 일주 60갑자 글자는 앱에만 남긴다.
 *   · 표시 문구도 담지 않는다 — 서버가 표를 갖는다(임의 텍스트로 브랜드 페이지 위조 차단).
 *
 * @param dayStem 일간 한자 · @param monthBranch 월지 한자 · @param sex 성별(이미지 선택용)
 * @returns 공유 링크 URL
 */
// 일간·월지 한자 → 로마자(파일명용). ★서버 표(_shared/personaShare.ts)와 **같은 값**이어야 한다 — check:share 가 지킨다.
const GAN_ROMA: Record<string, string> = { '甲': 'gap', '乙': 'eul', '丙': 'byeong', '丁': 'jeong', '戊': 'mu', '己': 'gi', '庚': 'gyeong', '辛': 'sin', '壬': 'im', '癸': 'gye' };
const JI_ROMA: Record<string, string> = { '子': 'ja', '丑': 'chuk', '寅': 'in', '卯': 'myo', '辰': 'jin', '巳': 'sa', '午': 'o', '未': 'mi', '申': 'sin', '酉': 'yu', '戌': 'sul', '亥': 'hae' };

export function personaShareUrl(dayStem: string, monthBranch: string, sex: '남' | '여'): string {
  // ★★GitHub Pages 정적 페이지로 보낸다(daniel 2026-07-29 검증에서 발견).
  //   종전 Edge `share?p=` 는 **브라우저에서 열리지 않았다** — Supabase 가 응답을 text/plain +
  //   CSP sandbox 로 강제해 HTML 이 글자로 보였다(에러가 없어 여태 몰랐다).
  //   또 카톡 미리보기는 **크롤러가 OG 태그를 읽어** 만드는데, 크롤러는 JS 를 실행하지 않는다
  //   → 유형별 그림·이름이 뜨려면 유형마다 **정적 HTML**이 있어야 한다(scripts/build-share-pages.mjs 로 240종 생성).
  const g = GAN_ROMA[dayStem], j = JI_ROMA[monthBranch];
  const sx = sex === '여' ? 'f' : 'm';
  if (!g || !j) return `${SHARE_LINK_BASE}?p=${encodeURIComponent(`${dayStem}${monthBranch}`)}&s=${sx}`; // 미지의 글자 = 종전 경로(안내 페이지)
  return `${PAGES_BASE}/s/p/${g}-${j}-${sx}.html`;
}

/**
 * 성격유형 카드를 공유 시트로 내보낸다(카톡·메시지 등).
 * @returns 공유한 링크 URL. 공유 시트를 사용자가 닫아도 예외로 보지 않는다(정상 취소).
 */
export async function sharePersona(p: { dayStem: string; monthBranch: string; sex: '남' | '여'; name: string }): Promise<string> {
  const url = personaShareUrl(p.dayStem, p.monthBranch, p.sex);
  await Share.share({ message: `내 성격유형은 '${p.name}' — 운이\n${url}`, url });
  return url;
}

export type ShareReadingInput = {
  kind: string;            // saju/ziwei/love/lifegraph/...
  category?: string;       // 영역/궁/카테고리
  title?: string;          // 표시용 제목
  content: any;            // 풀이 결과(스냅샷으로 저장)
};

/**
 * 풀이 스냅샷을 shared_readings 에 저장하고 *스마트링크만* 반환(공유 시트는 호출측이 — 이미지+링크를 함께 보낼 때).
 *   받는 사람: 앱 설치 시 syncfortune://shared/<id> 로 풀이 열람 / 미설치 시 App Store 유도. 실패 시 null(폴백).
 */
export async function createSharedLink(p: ShareReadingInput): Promise<string | null> {
  try {
    const id = randomShareId();
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('shared_readings').insert({
      id, kind: p.kind, category: p.category ?? null, title: p.title ?? null, content: p.content, created_by: auth?.user?.id ?? null,
    });
    if (error) return null;
    return `${PAGES_BASE}/s/?id=${id}`;
  } catch { return null; }
}

/**
 * 풀이 결과를 공유한다 — shared_readings 에 스냅샷 저장 후 공유 시트(카톡/라인 등)를 띄운다.
 * @returns 공유 링크(성공 시) / 실패 시 throw
 */
export async function shareReading(p: ShareReadingInput): Promise<string> {
  const id = randomShareId();
  const { data: auth } = await supabase.auth.getUser();
  // 생성 정책: created_by = 본인(auth.uid()). 비로그인은 insert 정책에 막힘 → 사실상 로그인 사용자만 공유.
  const { error } = await supabase.from('shared_readings').insert({
    id,
    kind: p.kind,
    category: p.category ?? null,
    title: p.title ?? null,
    content: p.content,
    created_by: auth?.user?.id ?? null,
  });
  if (error) throw error;
  const url = `${PAGES_BASE}/s/?id=${id}`;
  await Share.share({
    message: `${p.title ?? '내 운세 풀이'} — 운이\n${url}`,
    url, // iOS: 링크 카드로 공유
  });
  return url;
}

/** 공유받은 풀이 조회(id 단건 RPC — 열거 불가). 없으면 null. */
export async function fetchSharedReading(id: string): Promise<ShareReadingInput | null> {
  const { data, error } = await supabase.rpc('get_shared_reading', { p_id: id });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data; // 단일행 반환(드라이버에 따라 배열일 수 있음)
  return row ? { kind: row.kind, category: row.category, title: row.title, content: row.content } : null;
}
