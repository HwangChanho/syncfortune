/**
 * scripts/covers-upload.ts — 상담가 **배경** 일괄 등록 (사진 또는 5초 영상)
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-26 *"배경화면은 5초 이하의 영상도 올릴수 있게하고 선생님들은 배경화면은 영상으로"*
 *
 * ■ 왜 스크립트인가
 *   열한 명을 관리자 콘솔에서 한 명씩 올리면 **열한 번** 사람이 반복해야 한다.
 *   파일은 이미 규격대로 온다 — 폴더에 넣고 한 번 돌리면 끝나야 한다.
 *
 * ■ 무엇을 하나 (파일 하나마다)
 *   ①`<폴더>/<id>.(mp4|webm|mov|jpg|png|webp)` — 파일명이 **상담가 id** 여야 한다
 *   ②⚠️**검사부터** 한다: 8MB 이하 · 영상이면 **5초 이내** · 알 수 없는 id 면 건너뛴다
 *     ★올린 뒤 되돌리려면 스토리지에 쓰레기가 남는다. 그래서 **올리기 전에** 막는다.
 *   ③`avatars` 버킷의 `covers/<id>.<ext>` 로 덮어쓴다
 *     ⚠️**옛 확장자 파일을 지운다** — 안 지우면 사진과 영상이 같이 남아 무엇이 보일지 모른다
 *   ④`consultants.cover` 에 경로를 적는다
 *   ⑤끝나고 **실제로 열리는지**까지 확인한다(HEAD 200)
 *
 * ■ ⚠️왜 `ffprobe` 가 아니라 `mdls` 인가
 *   macOS 기본 도구다. ffmpeg 를 새로 깔게 하면 기계를 옮길 때마다 막힌다.
 *   ★`mdls` 가 없거나 값을 못 주면 **길이를 모른다** 고 말하고 건너뛴다 — 넘겨짚지 않는다.
 *
 * 실행: npm run covers:upload            (design/covers 전체)
 *       npm run covers:upload -- <폴더>
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const DIR = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : 'design/covers';
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_SECONDS = 5.2;             // 0.2 는 인코더 반올림 여유(4.98s 를 튕기지 않게)
const VIDEO = new Set(['.mp4', '.webm', '.mov', '.m4v']);
const IMAGE = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const URL_BASE = process.env.SUPABASE_URL ?? '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!URL_BASE || !KEY) { console.error('❌ .env 의 SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

/** 영상 길이(초). 모르면 null — **넘겨짚지 않는다**. */
function seconds(file: string): number | null {
  try {
    const out = execFileSync('mdls', ['-name', 'kMDItemDurationSeconds', '-raw', file], { encoding: 'utf8' }).trim();
    const n = Number(out);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}

async function main(): Promise<void> {
  if (!existsSync(DIR)) { console.error(`❌ 폴더가 없습니다: ${DIR}`); process.exit(1); }

  const r = await fetch(`${URL_BASE}/rest/v1/consultants?select=id,name`, { headers: H });
  const known = new Map<string, string>(((await r.json()) as any[]).map((c) => [c.id, c.name]));

  const files = readdirSync(DIR).filter((f) => VIDEO.has(extname(f).toLowerCase()) || IMAGE.has(extname(f).toLowerCase()));
  if (!files.length) { console.log(`  ${DIR} 에 올릴 파일이 없습니다.`); return; }

  let done = 0; const skipped: string[] = [];
  for (const f of files) {
    const ext = extname(f).toLowerCase();
    const id = basename(f, ext);
    const path = join(DIR, f);

    if (!known.has(id)) { skipped.push(`${f} — 상담가 id 가 아닙니다(파일명을 id 로)`); continue; }
    const size = statSync(path).size;
    if (size > MAX_BYTES) { skipped.push(`${f} — ${(size / 1048576).toFixed(1)}MB (8MB 초과)`); continue; }
    if (VIDEO.has(ext)) {
      const s = seconds(path);
      if (s == null) { skipped.push(`${f} — 길이를 못 읽었습니다(넘겨짚지 않고 건너뜁니다)`); continue; }
      if (s > MAX_SECONDS) { skipped.push(`${f} — ${s.toFixed(1)}초 (5초 초과)`); continue; }
    }

    const clean = ext === '.jpeg' ? '.jpg' : ext;
    const key = `covers/${id}${clean}`;
    // ⚠️옛 확장자 정리 — 사진과 영상이 같이 남으면 무엇이 보일지 모른다
    for (const other of ['.jpg', '.png', '.webp', '.mp4', '.webm', '.mov']) {
      if (other !== clean) {
        await fetch(`${URL_BASE}/storage/v1/object/avatars/covers/${id}${other}`, { method: 'DELETE', headers: H }).catch(() => {});
      }
    }
    const type = VIDEO.has(ext)
      ? (ext === '.webm' ? 'video/webm' : ext === '.mov' ? 'video/quicktime' : 'video/mp4')
      : (clean === '.png' ? 'image/png' : clean === '.webp' ? 'image/webp' : 'image/jpeg');
    const up = await fetch(`${URL_BASE}/storage/v1/object/avatars/${key}`, {
      method: 'POST', headers: { ...H, 'Content-Type': type, 'x-upsert': 'true' }, body: readFileSync(path),
    });
    if (!up.ok) { skipped.push(`${f} — 업로드 실패 ${up.status} ${(await up.text()).slice(0, 80)}`); continue; }
    const patch = await fetch(`${URL_BASE}/rest/v1/consultants?id=eq.${id}`, {
      method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json' }, // ⚠️★`updated_at` 을 같이 올린다 — 앱이 이 값으로 CDN 캐시를 깬다(안 올리면 옛 배경이 계속 보인다)
      body: JSON.stringify({ cover: key, updated_at: new Date().toISOString() }),
    });
    if (!patch.ok) { skipped.push(`${f} — DB 저장 실패 ${patch.status}`); continue; }

    // ⑤ 실제로 열리는지 — 올렸다고 보이는 것은 아니다
    const pub = `${URL_BASE}/storage/v1/object/public/avatars/${key}`;
    const head = await fetch(pub, { method: 'HEAD' });
    console.log(`  ${head.ok ? '✅' : '⚠️'} ${known.get(id)} (${id}) — ${key} ${VIDEO.has(ext) ? `· ${seconds(path)?.toFixed(1)}초` : ''} ${head.ok ? '' : `· 열리지 않음(HTTP ${head.status})`}`);
    if (head.ok) done++;
  }
  console.log(`\n  올림 ${done}건 · 건너뜀 ${skipped.length}건`);
  for (const s of skipped) console.log(`   ⏭  ${s}`);
}
main().catch((e) => { console.error('❌', e); process.exit(1); });
