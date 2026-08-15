// scripts/upload-assets.mjs — 로컬 이미지를 Storage(`assets` 버킷 `img/`)로 올린다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 필요한가: 앱은 이미지를 **번들이 아니라 Storage 에서** 받는다([[app-size-remote-images]]).
//   그래서 `app/assets/…` 에 파일을 만든 것만으로는 화면에 안 뜬다 — 올려야 뜬다.
//   종전엔 이 단계가 스크립트 없이 손으로 돌아 **빠뜨리면 화면에 빈 칸**이 났다(코드만 봐선 안 보인다).
//
// 사용: node scripts/upload-assets.mjs icons/relmap
//   → `app/assets/icons/relmap/*.{jpg,png,webp}` 를 `img/icons/relmap/*` 로 올린다(있으면 덮어쓴다).
//   경로 규칙은 `app/src/lib/ui/remoteAsset.ts` 의 `A(path)` 와 **1:1**이다. 새 키 체계를 만들지 않는다.
//
// ⚠️인증: `.env` 의 `SUPABASE_SERVICE_ROLE_KEY`. 이 프로젝트 키는 JWT 가 아니라 `sb_secret_…` 이라
//   **`apikey` 헤더가 반드시 필요**하다(Authorization 만 보내면 `Invalid Compact JWS` 로 403).
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');

/** `.env` 를 읽어 필요한 값만 뽑는다(dotenv 의존 없이 — 이 스크립트는 앱 밖에서 돈다). */
function env(key) {
  const line = fs.readFileSync(path.join(ROOT, '.env'), 'utf8')
    .split('\n').find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`.env 에 ${key} 가 없다`);
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '');
}

const SUPABASE_URL = env('SUPABASE_URL');
const KEY = env('SUPABASE_SERVICE_ROLE_KEY');

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

const rel = process.argv[2];
if (!rel) { console.error('사용: node scripts/upload-assets.mjs <assets 아래 경로>  예) icons/relmap'); process.exit(2); }

const dir = path.join(ROOT, 'app/assets', rel);
if (!fs.existsSync(dir)) { console.error(`없는 폴더: ${dir}`); process.exit(2); }

const files = fs.readdirSync(dir).filter((f) => MIME[path.extname(f).toLowerCase()]);
if (!files.length) { console.error(`올릴 이미지가 없다: ${dir}`); process.exit(2); }

let ok = 0, fail = 0;
for (const f of files) {
  const body = fs.readFileSync(path.join(dir, f));
  const dest = `img/${rel}/${f}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/assets/${dest}`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': MIME[path.extname(f).toLowerCase()],
      'x-upsert': 'true',            // 다시 돌려도 안전하게(같은 파일을 두 번 만들지 않는다)
      'cache-control': '31536000',   // 콘텐츠 이미지는 안 바뀐다 — 앱/CDN 이 오래 캐시하게
    },
    body,
  });
  if (res.ok) { console.log(`✅ ${dest} (${body.length} bytes)`); ok++; }
  else { console.error(`❌ ${dest} → ${res.status} ${await res.text()}`); fail++; }
}
console.log(`\n올림 ${ok}건 · 실패 ${fail}건`);
process.exit(fail ? 1 : 0);
