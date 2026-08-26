// scripts/check-mediaver.ts — **사진·영상을 갈면 반드시 버전이 바뀐다**
// ═══════════════════════════════════════════════════════════════════════════
// E드라이브 스튜디오 지적(2026-08-26): *"«관리자가 같은 경로에 덮어쓴다»면 `?v=` 가 없을 때
//   CDN 이 옛 사진을 계속 준다는 건, 다음에 아바타를 갈 때도 그대로 걸리는 함정"*
//
// ■ 무엇이 문제였나
//   ①주소에 `?v=<1분 단위 시각>` 을 붙여 캐시를 깨고 있었다. 사진(50KB)은 견딜 만했지만
//     **배경 영상(최대 8MB)** 에서는 주소가 바뀔 때마다 **다시 받고 재생이 처음으로 돌아간다.**
//   ②그렇다고 버전을 없애면, 관리자가 **같은 경로에 덮어쓰므로** CDN 이 옛 파일을 계속 준다.
//   ⇒ 버전을 «시계» 가 아니라 **«그 행이 바뀐 시각»** 으로 바꿨다. media 가 바뀔 때만 바뀐다.
//
// ■ ⚠️★그래서 생긴 **새 의무**
//   `updated_at` 은 **자동으로 안 따라간다**(실측 2026-08-26: 사진 08-25 ↔ updated_at 08-21).
//   ⇒ media 를 갈아 끼우는 **모든 경로**가 `updated_at` 을 함께 올려야 한다.
//     하나라도 빠뜨리면 **그 경로로 바꾼 사진만 영원히 안 바뀐다** — 화면엔 아무 증상이 없다.
//
// ★음성 테스트: `npx tsx scripts/check-mediaver.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';

/** media 를 쓰는 경로들 — 여기 하나라도 빠지면 옛 파일이 계속 보인다. */
const WRITERS = [
  { file: 'docs/admin/index.html', what: '관리자 콘솔(사진)', key: 'avatar: path' },
  { file: 'docs/admin/index.html', what: '관리자 콘솔(배경)', key: 'cover: path' },
  { file: 'scripts/avatars-upload.ts', what: 'avatars:upload', key: 'avatar: `consultants/' },
  { file: 'scripts/covers-upload.ts', what: 'covers:upload', key: 'cover: key' },
];
const READER = 'app/src/lib/talk/consultants.ts';

export type Fail = { rule: string; msg: string };

/** 이 쓰기 지점이 `updated_at` 을 **같은 update 안에서** 올리는가. */
export function judgeWriter(src: string, key: string): boolean {
  const i = src.indexOf(key);
  if (i < 0) return false;
  // 같은 객체 리터럴 안(뒤 200자)에 updated_at 이 있어야 한다.
  //   ★«근처에 글자가 있나» 가 아니라 **같은 update 페이로드인가** 를 본다.
  return /updated_at/.test(src.slice(i, i + 200));
}

/** 앱이 버전을 **시계가 아니라 행의 시각**으로 만드는가. */
export function judgeReader(src: string): Fail[] {
  const out: Fail[] = [];
  const i = src.indexOf('function avatarUrl');
  const seg = i < 0 ? '' : src.slice(i, i + 900);
  if (!seg) { out.push({ rule: 'M0', msg: `${READER} 의 avatarUrl 을 못 찾았다 — 하네스를 고칠 것` }); return out; }
  if (!/Date\.parse\(ver\)/.test(seg)) {
    out.push({ rule: 'M2', msg: '★버전이 «행이 바뀐 시각» 이 아니다 — 시계로 깨면 8MB 배경 영상이 계속 다시 받아지고 재생이 끊긴다' });
  }
  if (!/updated_at/.test(src)) {
    out.push({ rule: 'M2', msg: 'updated_at 을 읽지 않는다 — 버전을 만들 재료가 없다' });
  }
  return out;
}

if (process.argv.includes('--selftest')) {
  const t = (l: string, v: boolean) => { console.log(`  ${v ? '✅' : '❌'} ${l}`); return v; };
  const reader = fs.existsSync(READER) ? fs.readFileSync(READER, 'utf8') : '';
  const r = [
    t('현재 쓰기 경로 4곳 전부 통과', WRITERS.every((w) => judgeWriter(fs.readFileSync(w.file, 'utf8'), w.key))),
    t('현재 읽기 경로 통과', judgeReader(reader).length === 0),
    t('updated_at 을 빼면 **잡는다**', !judgeWriter("update({ cover: key })", 'cover: key')),
    t('멀리 떨어진 updated_at 은 **안 쳐준다**', !judgeWriter("update({ cover: key })" + ' '.repeat(300) + 'updated_at', 'cover: key')),
    t('시계로 되돌리면 **잡는다**',
      judgeReader(reader.replace(/Date\.parse\(ver\)/g, 'NaN')).some((f) => f.rule === 'M2')),
  ];
  const ok = r.every(Boolean);
  console.log(ok ? '✅ selftest 통과' : '❌ selftest 실패');
  process.exit(ok ? 0 : 1);
}

const fails: Fail[] = [];
for (const w of WRITERS) {
  if (!fs.existsSync(w.file)) { fails.push({ rule: 'M1', msg: `${w.file} 이 없다` }); continue; }
  if (!judgeWriter(fs.readFileSync(w.file, 'utf8'), w.key)) {
    fails.push({ rule: 'M1', msg: `★${w.what} 이 media 를 갈면서 updated_at 을 안 올린다 — **그 경로로 바꾼 것만 영원히 안 바뀐다**(화면엔 증상이 없다)` });
  }
}
fails.push(...judgeReader(fs.existsSync(READER) ? fs.readFileSync(READER, 'utf8') : ''));

if (!fails.length) {
  console.log(`✅ check:mediaver — 쓰기 ${WRITERS.length}곳이 updated_at 을 올리고, 앱이 그 값으로 캐시를 깬다`);
  process.exit(0);
}
console.error(`❌ check:mediaver — ${fails.length}건\n`);
for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
process.exit(1);
