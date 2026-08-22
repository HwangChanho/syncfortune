/**
 * scripts/avatars-status.ts — 상담가 **사진 등록 현황**
 * ─────────────────────────────────────────────────────────────────────────
 * Boss 2026-08-22 *"상담가 사진 12장 등록할 준비해줘"*.
 *
 * ■ ★이건 게이트가 아니라 **보고서**다 (항상 exit 0)
 *   사진은 Boss 슬롯이라 `preflight` 에 넣으면 **상시 빨간불**이 된다 —
 *   그러면 초록불이 의미를 잃고, 진짜 고장도 같이 묻힌다([[verify-gate-pending-stance]] 교훈).
 *   ⇒ 필요할 때 `npm run avatars` 로 본다.
 *
 * ■ 무엇을 보나 (이름이 아니라 **실제 상태**)
 *   ①`consultants.avatar` 에 경로가 있는가
 *   ②그 경로가 **실제로 열리는가**(공개 URL 200) — DB 에만 적혀 있고 파일이 없으면
 *     앱에서는 깨진 이미지가 된다. 경로 존재만 세면 그 사고를 못 잡는다.
 *   ③크기가 상식적인가(0바이트·1KB 미만이면 업로드가 잘린 것이다)
 *
 * 실행: npm run avatars
 */
import { readFileSync } from 'node:fs';

const env = readFileSync('.env', 'utf8');
const pick = (k: string) => (new RegExp(`^${k}=(.*)$`, 'm').exec(env)?.[1] ?? '').replace(/['"]/g, '').trim();
const URL_BASE = pick('SUPABASE_URL') || 'https://zpslflbcxzalaikbbdzk.supabase.co';
const ANON = pick('SUPABASE_ANON_KEY');

type Row = { id: string; name: string; tagline: string | null; avatar: string | null; sort_order: number };

const res = await fetch(
  `${URL_BASE}/rest/v1/consultants?select=id,name,tagline,avatar,sort_order&enabled=eq.true&order=sort_order`,
  { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } },
);
if (!res.ok) { console.log(`조회 실패 HTTP ${res.status}`); process.exit(0); }
const rows = (await res.json()) as Row[];

console.log('\n🖼  상담가 사진 등록 현황\n');
let ok = 0, missing = 0, broken = 0;

for (const [i, r] of rows.entries()) {
  const n = String(i + 1).padStart(2);
  if (!r.avatar) { missing++; console.log(`${n}. ${r.name.padEnd(20)} — 없음`); continue; }
  // ★파일이 실제로 열리는지 본다 — DB 에 경로만 있고 파일이 없으면 앱에서 깨진 그림이 된다
  const url = `${URL_BASE}/storage/v1/object/public/avatars/${r.avatar}`;
  let note = '';
  try {
    const h = await fetch(url, { method: 'HEAD' });
    if (!h.ok) { broken++; note = `⚠️ 파일 없음(HTTP ${h.status})`; }
    else {
      const len = Number(h.headers.get('content-length') ?? 0);
      if (len > 0 && len < 1024) { broken++; note = `⚠️ ${len}B — 너무 작다(업로드가 잘렸다)`; }
      else { ok++; note = `✅ ${Math.round(len / 1024)}KB`; }
    }
  } catch { broken++; note = '⚠️ 확인 실패(네트워크)'; }
  console.log(`${n}. ${r.name.padEnd(20)} ${note}`);
}

console.log(`\n   등록 ${ok} · 없음 ${missing} · 문제 ${broken}  (전체 ${rows.length})`);
if (missing || broken) {
  console.log('   → 관리자 콘솔 「상담가」 탭에서 사진을 올립니다: https://syncfortune-admin.pages.dev/');
  console.log('     (자르기 편집기가 512×512 jpeg 로 맞춰 줍니다 — 원본은 8MB 이하면 됩니다)');
}
// ★항상 0 — 이건 보고서다(위 주석 참조)
process.exit(0);
