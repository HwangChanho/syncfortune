/**
 * scripts/avatars-receive.ts — 다른 기계에서 **메시지로 넘어온 사진**을 파일로 앉힌다
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-23 *"너가 통신툴로 이동시켜 직접"* — 이미지 생성 기계(E드라이브)와 이 저장소는
 * 파일시스템을 공유하지 않는다. 그래서 base64 로 실어 보내고 여기서 되돌린다.
 *
 * ■ ★왜 크기·해시를 대조하나
 *   전송은 **조용히 잘린다.** 잘린 base64 도 디코드는 되고, 깨진 JPEG 도 파일로는 만들어진다.
 *   그러면 업로드까지 통과하고 **앱에서만 깨진 그림**이 뜬다 — 그때는 원인을 찾기 어렵다.
 *   ⇒ 보낸 쪽이 알려 준 바이트 수·SHA256 과 **여기서 다시 계산한 값**을 맞춰 본다.
 *     안 맞으면 파일을 쓰지 않는다(반쪽 파일을 남기면 다음 사람이 그걸 진짜로 믿는다).
 *
 * ■ 추가로 보는 것 — **정말 이미지인가**
 *   JPEG 매직바이트(FFD8FF)·PNG 시그니처를 확인하고, `sips` 로 실제 크기를 읽어 찍는다.
 *   "디코드 성공"은 "이미지"를 뜻하지 않는다(오류 메시지가 base64 로 와도 디코드는 된다).
 *
 * 실행:
 *   npm run avatars:recv -- <id> <기대바이트> <sha256앞16자리>   # base64 는 stdin 으로
 *   예) cat blob.txt | npm run avatars:recv -- love_seoyun 72841 3f9a2c81b0d4e6f7
 *   검증만 하고 저장 안 하려면 마지막에 --dry 를 붙인다.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { TO_GENERATE } from './avatar-cast';

const OUT_DIR = 'design/avatars';

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
// ⚠️`--dry` 를 크기 자리로 읽으면 `Number('--dry')=NaN` 이 되어 **엉뚱한 불일치**를 외친다(자체 테스트에서 잡힘).
//   플래그는 위치 인자에서 걷어낸다.
const [id, sizeArg, shaArg] = argv.filter((a) => !a.startsWith('--'));

if (!id) {
  console.log('\n사용법: npm run avatars:recv -- <id> [기대바이트] [sha256앞자리] [--dry]');
  console.log(`  id: ${TO_GENERATE.map((m) => m.id).join(' · ')} · overview\n`);
  process.exit(1);
}
// ★아는 id 인지 본다 — 오타로 엉뚱한 파일명이 생기면 업로드가 그 사람을 영영 못 찾는다.
if (id !== 'overview' && !TO_GENERATE.some((m) => m.id === id)) {
  console.log(`\n⚠️ '${id}' 는 상담가 id 가 아닙니다.`);
  console.log(`   가능한 값: ${TO_GENERATE.map((m) => m.id).join(' · ')} · overview\n`);
  process.exit(1);
}

// stdin 전체를 읽는다(base64 는 한 줄로 길게 온다)
const chunks: Buffer[] = [];
for await (const c of process.stdin) chunks.push(c as Buffer);
const raw = Buffer.concat(chunks).toString('utf8');

// ⚠️보낸 쪽이 머리말(FILE:/SIZE:/BASE64:)을 같이 붙였을 수 있다 — base64 로 쓸 수 있는 글자만 남긴다.
const b64 = raw.replace(/^[\s\S]*?BASE64:\s*/i, '').replace(/[^A-Za-z0-9+/=]/g, '');
if (!b64) { console.log('\n❌ base64 내용이 비어 있습니다(stdin 으로 넣었는지 확인).\n'); process.exit(1); }

const buf = Buffer.from(b64, 'base64');
const sha = createHash('sha256').update(buf).digest('hex');

console.log(`\n📥 ${id}`);
console.log(`   받은 바이트 ${buf.length}`);
console.log(`   sha256      ${sha.slice(0, 16)}`);

let bad = 0;

// ① 바이트 수
if (sizeArg) {
  const want = Number(sizeArg);
  if (buf.length !== want) { bad++; console.log(`   ❌ 크기 불일치 — 기대 ${want} · 받은 ${buf.length} (차이 ${buf.length - want})`); }
  else console.log('   ✅ 크기 일치');
}
// ② 해시
if (shaArg) {
  const want = shaArg.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (!sha.startsWith(want)) { bad++; console.log(`   ❌ 해시 불일치 — 기대 ${want} · 실제 ${sha.slice(0, want.length)}`); }
  else console.log('   ✅ 해시 일치');
}
// ③ 정말 이미지인가 — 매직바이트
const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
if (!isJpeg && !isPng) {
  bad++;
  console.log(`   ❌ 이미지가 아닙니다 — 앞 8바이트: ${buf.subarray(0, 8).toString('hex')}`);
  console.log(`      (앞부분을 글자로 보면: ${JSON.stringify(buf.subarray(0, 60).toString('utf8'))})`);
} else {
  console.log(`   ✅ ${isJpeg ? 'JPEG' : 'PNG'} 맞음`);
}

if (bad) {
  console.log(`\n   ⚠️ ${bad}건 어긋남 — **파일을 쓰지 않습니다.** 그 장만 다시 받으세요.\n`);
  process.exit(1);
}

if (dry) { console.log('\n   (--dry) 저장하지 않았습니다.\n'); process.exit(0); }

mkdirSync(OUT_DIR, { recursive: true });
const ext = isJpeg ? 'jpg' : 'png';
const path = `${OUT_DIR}/${id}.${ext}`;
writeFileSync(path, buf);

// ④ 저장한 파일의 **실제 픽셀 크기**를 찍는다 — 규격(정사각)에서 벗어나면 여기서 보인다.
try {
  const info = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path], { encoding: 'utf8' });
  const w = /pixelWidth:\s*(\d+)/.exec(info)?.[1];
  const h = /pixelHeight:\s*(\d+)/.exec(info)?.[1];
  const square = w === h ? '정사각 ✅' : '⚠️ 정사각 아님 — 업로드 때 가운데를 자릅니다';
  console.log(`   💾 ${path}  ${w}×${h}  ${square}\n`);
} catch {
  console.log(`   💾 ${path} (크기 확인 실패 — 파일은 저장됨)\n`);
}
