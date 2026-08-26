/**
 * scripts/avatars-upload.ts — 상담가 사진 **일괄 등록**(파일 → 스토리지 → DB)
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-23 *"다른 친구들 실사 이미지 작업하자"*.
 *
 * ■ 왜 스크립트인가
 *   관리자 콘솔에서 한 장씩 올리면 **열한 번**을 사람이 반복해야 한다(파일 고르기 → 원 안에
 *   얼굴 맞추기 → 저장). 사진은 이미 규격대로 온다 — 사람이 할 일이 없다.
 *   ⇒ 폴더에 넣고 한 번 돌리면 끝나게 한다. Boss 슬롯을 기계로 옮기는 것이 이 프로젝트의 방식이다.
 *
 * ■ 무엇을 하나 (파일 하나마다)
 *   ①`design/avatars/<id>.(png|jpg|jpeg|webp)` 를 찾는다 — 없는 사람은 조용히 건너뛴다
 *   ②**512×512 jpeg** 로 맞춘다(cover: 짧은 변을 512 로 맞춘 뒤 가운데를 정사각으로 자른다)
 *   ③공개 버킷 `avatars` 의 `consultants/<id>.jpg` 로 **덮어쓴다**(파일이 쌓이지 않는다)
 *   ④`consultants.avatar` 에 경로를 적는다
 *   ⑤끝나고 **실제로 열리는지**까지 확인한다(`npm run avatars` 와 같은 검사)
 *
 * ■ ⚠️왜 `sips` 인가
 *   macOS 기본 도구다. 이미지 라이브러리(sharp 등)를 새로 넣으면 네이티브 바이너리가 딸려 오고
 *   기계를 옮길 때마다 빌드가 깨진다. 리사이즈 한 번 하자고 그 비용을 지불하지 않는다.
 *
 * ■ ★비율이 안 맞아도 **찌그러뜨리지 않는다**
 *   앱은 이걸 동그라미에 `cover` 로 넣는다. 세로 사진을 그대로 올리면 화면에서 위아래가 잘려
 *   머리·턱이 날아간다. 여기서 **미리 가운데를 정사각으로** 잘라 두면 화면에서 다시 잘릴 게 없다.
 *   ⚠️다만 자동 중앙 크롭은 얼굴 위치를 모른다 — 정사각이 아닌 입력은 **경고**를 찍는다.
 *
 * 실행: npm run avatars:upload            (design/avatars 전체)
 *       npm run avatars:upload -- <폴더>   (다른 폴더에서)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAST } from './avatar-cast';

const DRY = process.argv.includes('--dry-run');   // ★검사만 하고 **아무것도 안 올린다**
const SRC_DIR = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'design/avatars';
const EXTS = ['png', 'jpg', 'jpeg', 'webp'];
const SIZE = 512;              // 저장 규격 — 관리자 콘솔 자르기 편집기와 같은 값
const JPEG_QUALITY = 90;       // 대략 100KB — 버킷 제한(2MB) 한참 안쪽

// ── 환경 ───────────────────────────────────────────────────────────────────
const env = readFileSync('.env', 'utf8');
const pick = (k: string) => (new RegExp(`^${k}=(.*)$`, 'm').exec(env)?.[1] ?? '').replace(/['"]/g, '').trim();
const URL_BASE = pick('SUPABASE_URL');
const SERVICE = pick('SUPABASE_SERVICE_ROLE_KEY');
const ANON = pick('SUPABASE_ANON_KEY');
if (!URL_BASE || !SERVICE) {
  console.log('\n⚠️ .env 에 SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.\n');
  process.exit(1);
}

/**
 * 이미지 한 장을 512×512 jpeg 로 맞춘다(cover 방식).
 *
 * @param src 원본 경로
 * @param out 결과 jpeg 경로
 * @returns 원본이 정사각이 아니었으면 그 크기(경고용), 정사각이면 null
 *
 * ⚠️`sips -Z` 는 **긴 변**을 맞춘다 — 그걸 쓰면 짧은 변이 512 에 못 미쳐 여백이 생긴다(letterbox).
 *   그래서 **짧은 변**을 512 로 맞춘 뒤(`--resampleWidth`/`--resampleHeight`) 가운데를 자른다.
 */
function toSquareJpeg(src: string, out: string): { w: number; h: number } | null {
  const info = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', src], { encoding: 'utf8' });
  const w = Number(/pixelWidth:\s*(\d+)/.exec(info)?.[1] ?? 0);
  const h = Number(/pixelHeight:\s*(\d+)/.exec(info)?.[1] ?? 0);
  if (!w || !h) throw new Error(`크기를 읽지 못했습니다: ${src}`);

  const args = ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(JPEG_QUALITY)];
  // 짧은 변을 512 로(비율 유지) → 가운데 512×512 크롭
  if (w <= h) args.push('--resampleWidth', String(SIZE));
  else args.push('--resampleHeight', String(SIZE));
  args.push('-c', String(SIZE), String(SIZE));      // sips -c 는 **가운데 기준** 크롭이다
  args.push(src, '--out', out);
  execFileSync('sips', args, { stdio: 'pipe' });
  return w === h ? null : { w, h };
}

/**
 * 파일이 **실제로 이미지인가** — 앞 몇 바이트(매직 넘버)로 본다.
 *
 * ⚠️왜 필요한가(2026-08-25 실측): `design/avatars/` 에 **구글 «Error 400» HTML 페이지**가
 *   `.jpg` 로 열한 장 들어 있었다. 드라이브에서 받다가 권한·바이러스검사 안내 페이지가
 *   그대로 저장된 것이다(1,695 바이트). 확장자만 믿으면 **HTML 을 누군가의 얼굴로 올린다.**
 *   그 상태로 올라가면 앱에서 사진이 깨져 보이는데 원인은 안 보인다.
 *
 * @param p 파일 경로
 * @returns 이미지면 null, 아니면 사람이 읽을 수 있는 사유
 */
function notAnImage(p: string): string | null {
  const b = readFileSync(p).subarray(0, 12);
  if (b.length < 12) return '파일이 너무 짧다';
  const is = (sig: number[], off = 0) => sig.every((v, i) => b[off + i] === v);
  if (is([0xFF, 0xD8, 0xFF])) return null;                                   // jpeg
  if (is([0x89, 0x50, 0x4E, 0x47])) return null;                             // png
  if (is([0x52, 0x49, 0x46, 0x46]) && is([0x57, 0x45, 0x42, 0x50], 8)) return null;  // webp
  const head = b.toString('utf8').trim().slice(0, 9).toLowerCase();
  if (head.startsWith('<html') || head.startsWith('<!doctype')) return 'HTML 이다 — 드라이브 오류 페이지를 받은 것 같다';
  return `이미지가 아니다(앞 4바이트 ${[...b.subarray(0, 4)].map((x) => x.toString(16).padStart(2, '0')).join(' ')})`;
}

/** 폴더에서 이 id 의 원본 파일을 찾는다(확장자는 아무거나). */
function findSource(id: string): string | null {
  for (const e of EXTS) {
    const p = join(SRC_DIR, `${id}.${e}`);
    if (existsSync(p)) return p;
  }
  return null;
}

/** 스토리지 업로드 — 같은 경로에 **덮어쓴다**(x-upsert). */
async function upload(id: string, jpeg: Buffer): Promise<void> {
  const path = `consultants/${id}.jpg`;
  const res = await fetch(`${URL_BASE}/storage/v1/object/avatars/${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'image/jpeg', 'x-upsert': 'true',
    },
    body: new Uint8Array(jpeg),
  });
  if (!res.ok) throw new Error(`업로드 실패 HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
}

/** DB 에 경로를 적는다. ★파일이 올라간 **뒤에** 적는다 — 반대로 하면 깨진 그림이 남는다. */
async function link(id: string): Promise<void> {
  const res = await fetch(`${URL_BASE}/rest/v1/consultants?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    // ⚠️★`updated_at` 을 같이 올린다 — 앱이 이 값으로 CDN 캐시를 깬다(안 올리면 옛 사진이 계속 보인다)
    body: JSON.stringify({ avatar: `consultants/${id}.jpg`, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`DB 연결 실패 HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
}

// ── 실행 ───────────────────────────────────────────────────────────────────
if (!existsSync(SRC_DIR)) {
  console.log(`\n⚠️ 폴더가 없습니다: ${SRC_DIR}`);
  console.log('   사진을 그 폴더에 `<id>.png` 이름으로 넣고 다시 실행하세요.');
  console.log(`   id 목록: ${CAST.filter((m) => !m.real).map((m) => m.id).join(' · ')}\n`);
  process.exit(1);
}

console.log(`\n📤 상담가 사진 등록 — ${SRC_DIR}${DRY ? '   ⚠️ --dry-run: 검사만 하고 올리지 않는다' : ''}\n`);
const tmp = mkdtempSync(join(tmpdir(), 'avatars-'));
let done = 0, skipped = 0, failed = 0;

for (const m of CAST) {
  if (m.real) {
    // 실존 인물 — 사진은 Boss 가 준 파일을 쓴다. 폴더에 있으면 올리되, 없다고 문제 삼지 않는다.
    if (!findSource(m.id)) { console.log(`  ·  ${m.name.padEnd(8)} 건너뜀(실존 인물 — 기존 사진 유지)`); skipped++; continue; }
  }
  const src = findSource(m.id);
  if (!src) { console.log(`  ·  ${m.name.padEnd(8)} 파일 없음 — 건너뜀 (${m.id}.png)`); skipped++; continue; }
  // ★확장자를 믿지 않는다 — 내용을 본다(위 notAnImage 주석의 사고 참조)
  const why = notAnImage(src);
  if (why) { console.log(`  ❌ ${m.name.padEnd(8)} ${why} — 올리지 않았다: ${src}`); failed++; continue; }
  try {
    const out = join(tmp, `${m.id}.jpg`);
    const odd = toSquareJpeg(src, out);
    const jpeg = readFileSync(out);
    // ★--dry-run 은 스토리지·DB 를 **건드리지 않는다**. 검사만 하려고 돌렸다가
    //   실서비스 사진을 갈아 끼우는 일이 없게 한다(2026-08-25 내가 그럴 뻔했다).
    if (!DRY) { await upload(m.id, jpeg); await link(m.id); }
    done++;
    const note = odd ? ` ⚠️ 원본이 ${odd.w}×${odd.h}(정사각 아님) — 가운데를 잘랐습니다. 얼굴이 중앙이 아니면 다시 주세요` : '';
    console.log(`  ✅ ${m.name.padEnd(8)} ${Math.round(jpeg.length / 1024)}KB → consultants/${m.id}.jpg${note}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${m.name.padEnd(8)} ${(e as Error).message}`);
  }
}

console.log(`\n   등록 ${done} · 건너뜀 ${skipped} · 실패 ${failed}`);

// ★끝났다고 믿지 않는다 — **실제로 열리는지** 확인한다.
//   DB 에 경로만 있고 파일이 없으면 관리자 화면엔 등록된 것처럼 보이는데 앱에선 깨진 그림이 된다.
if (done) {
  console.log('\n   확인 중(공개 URL 이 실제로 열리는가)…');
  const res = await fetch(
    `${URL_BASE}/rest/v1/consultants?select=name,avatar&enabled=eq.true&order=sort_order`,
    { headers: { apikey: ANON || SERVICE, Authorization: `Bearer ${ANON || SERVICE}` } },
  );
  const rows = (await res.json()) as { name: string; avatar: string | null }[];
  let ok = 0, bad = 0;
  for (const r of rows) {
    if (!r.avatar) continue;
    const h = await fetch(`${URL_BASE}/storage/v1/object/public/avatars/${r.avatar}`, { method: 'HEAD' });
    const len = Number(h.headers.get('content-length') ?? 0);
    if (!h.ok || len < 1024) { bad++; console.log(`   ⚠️ ${r.name} — 열리지 않거나 너무 작습니다(${h.status} · ${len}B)`); }
    else ok++;
  }
  console.log(`   ✅ 열림 ${ok}${bad ? ` · ⚠️ 문제 ${bad}` : ''}\n`);
}
