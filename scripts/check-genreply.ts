#!/usr/bin/env tsx
/**
 * check:genreply — 풀이 진행 알림이 **담당자의 답장**으로 남아 있는지 지킨다.
 * ═══════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-25 *"각 카테고리별로 대표 인물이 카톡으로 답장해주는 식으로 하자"*.
 * 종전엔 홈 상단에 「…풀이 중… 45%」 진행률 막대였다.
 *
 * 왜 하네스가 필요한가 — 이 기능은 **세 파일이 맞물려야** 성립한다:
 *   ①홈이 배너를 쓰고 ②배너가 `consultants.routes` 를 뒤집어 담당자를 찾고
 *   ③진행 알림이 뜨는 라우트마다 담당자가 있어야 한다.
 *   하나만 어긋나도 화면은 «뜨긴 뜨는데 전부 같은 사람» 이 된다 — 조용한 고장이다.
 *
 * 규칙
 *   G1 홈이 진행률 막대를 **직접 그리지 않는다**(`GenReplyBanner` 를 쓴다)
 *   G2 담당자를 **별도 표로 만들지 않는다** — `consultantsSnapshot()` 을 읽는다
 *   G3 `setGenProgress` 가 쓰는 라우트마다 담당자가 있다(씨앗 기준). 없으면 전원이 노쌤이 된다
 *   G4 진행률 숫자를 **문장 안에 넣지 않는다** — "37% 보는 중" 은 사람의 말이 아니다
 *   G5 말풍선을 새로 만들지 않는다 — 대화창과 같은 모양(`borderTopLeftRadius`)
 *
 * 사용: npm run check:genreply · 자가테스트: npx tsx scripts/check-genreply.ts --selftest
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const P_HOME = 'app/src/app/(app)/index.tsx';
const P_BANNER = 'app/src/components/GenReplyBanner.tsx';
const P_MAP = 'app/src/lib/content/genReplier.ts';
const P_SEED = 'app/src/lib/talk/consultants.ts';
const P_PROGRESS = 'app/src/lib/backend/genProgress.ts';   // ★진행 알림을 방에 남기는 곳(2026-08-31)

type Fail = { rule: string; msg: string };
/** 주석을 걷어낸 소스 — '주석에 적힌 말'이 아니라 **코드**로 판정한다. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * @param src   `{home, banner, map, seed}` 원문
 * @param genRoutes `setGenProgress` 가 실제로 쓰는 라우트(경로만, 슬래시·꼬리표 제거)
 * @returns 위반 목록. 빈 배열이면 통과
 */
export function audit(
  src: { home: string; banner: string; map: string; seed: string; progress?: string },
  genRoutes: string[],
): Fail[] {
  const out: Fail[] = [];
  const home = code(src.home), banner = code(src.banner), map = code(src.map), seed = code(src.seed);

  // ── G1 진행 알림이 **담당자의 말**로 남는가 ──────────────────
  // ★★2026-08-31 규칙을 옮겼다(Boss *"또 이렇게나와 채팅창에서 나와야지"*).
  //   종전 G1 은 「홈이 `GenReplyBanner` 를 쓴다」였다 — 그런데 Boss 가 **홈에서 빼라**고 하자
  //   그 규칙이 **반려된 설계를 초록불로 강제**하게 됐다(이 저장소에서 여섯 번째다).
  //   ⇒ 지키려는 것은 «진행 알림 = 담당자의 답장» 이지 «홈에 배너가 있다» 가 아니다.
  //     그러니 **어디서 지키는지**만 옮긴다: 이제 `genProgress` 가 방에 글을 남긴다.
  if (!/postGenToTalk\s*\(/.test(src.progress ?? '')) {
    out.push({ rule: 'G1', msg: `진행 알림을 대화방에 남기지 않는다(\`postGenToTalk\` 호출 없음) — «담당자의 답장» 이 아니라 그냥 사라진다` });
  }
  // 홈이 다시 진행률을 직접 그리면 **두 곳에서 뜬다** — 읽음이 갈린다
  if (/<GenReplyBanner\b/.test(home)) out.push({ rule: 'G1', msg: `${P_HOME} 가 다시 진행 배너를 그린다 — 방과 이중으로 뜬다(Boss 08-31 로 홈에서 뺐다)` });
  if (/풀이 중…|풀이가 완성됐어요/.test(home)) out.push({ rule: 'G1', msg: `${P_HOME} 에 옛 진행률 문구가 남아 있다` });

  // ── G2 담당자를 상담가 표에서 찾는가 ────────────────────────
  if (!/consultantsSnapshot\s*\(/.test(map)) out.push({ rule: 'G2', msg: `${P_MAP} 가 consultantsSnapshot() 을 안 읽는다 — 담당 표를 따로 만들면 관리자가 바꿔도 이 화면만 옛 사람이 나온다` });
  if (/(ROUTE_OWNER|OWNER_BY_ROUTE|const\s+OWNERS)\s*[:=]/.test(map)) out.push({ rule: 'G2', msg: `${P_MAP} 에 담당 표가 직접 박혀 있다 — 상담가 표가 단일 원본이어야 한다` });

  // ── G3 라우트마다 담당자가 있는가 ──────────────────────────
  const owned = new Set<string>();
  for (const m of seed.matchAll(/routes:\s*\[([^\]]*)\]/g)) {
    for (const r of m[1].match(/'([a-z0-9]+)'/g) ?? []) owned.add(r.replace(/'/g, ''));
  }
  const usesKind = /kind=/.test(map);   // `/reading?kind=saju` 를 읽을 수 있는가
  for (const r of genRoutes) {
    if (owned.has(r)) continue;
    if (r === 'reading' && usesKind && owned.has('saju') && owned.has('ziwei')) continue;  // kind 로 갈린다
    out.push({ rule: 'G3', msg: `'${r}' 를 맡은 상담가가 없다 — 그 풀이는 전부 노쌤이 답한다(카테고리별 인물이 안 된다). ${P_SEED} 의 routes 에 넣어라` });
  }

  // ── G4 진행률이 문장 안에 들어갔나 ─────────────────────────
  if (/(pct|percent|진행률|%)\s*\}?\s*(%|퍼센트)?[^\n]*replyLine|replyLine[^\n]*\$\{[^}]*pct/.test(map)
      || /\$\{[^}]*pct[^}]*\}\s*%/.test(map)) {
    out.push({ rule: 'G4', msg: `${P_MAP} 의 문장에 진행률이 섞였다 — "37% 보는 중" 은 사람의 말이 아니다. 숫자는 말풍선 밖에 둔다` });
  }

  // ── G5 말풍선을 새로 만들지 않았는가 ───────────────────────
  if (!/borderTopLeftRadius/.test(banner)) out.push({ rule: 'G5', msg: `${P_BANNER} 의 말풍선이 대화창과 다른 모양이다(borderTopLeftRadius 없음) — 같은 사람이 화면마다 다르게 보인다` });
  if (!/replierFor\s*\(/.test(banner)) out.push({ rule: 'G5', msg: `${P_BANNER} 가 replierFor() 를 안 쓴다 — 담당자를 어디서 정하는지 갈라진다` });

  return out;
}

// ── 자가테스트 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const ok = {
    // ★정상 = 홈에는 배너가 **없고**, 진행 스토어가 방에 남긴다(2026-08-31 설계)
    home: `{/* 진행 알림은 대화방에 남는다 */}`,
    progress: `void postGenToTalk(next.route, next.label, 'working', next.chartLabel);`,
    banner: `const who = replierFor(route); borderTopLeftRadius: radius.sm,`,
    map: `const list = consultantsSnapshot(); const kind = /[?&]kind=([a-z0-9]+)/i.exec(raw)?.[1];`,
    seed: `routes: ['saju', 'gaeun'], routes: ['ziwei', 'timeline'], routes: ['love'],`,
  };
  const routes = ['gaeun', 'love', 'reading'];
  const cases: Array<[string, Fail[]]> = [
    ['정상', audit(ok, routes)],
    ['G1 방에 안 남김', audit({ ...ok, progress: `notifyReadingDone(...)` }, routes)],
    ['G1 홈이 다시 배너를 그림', audit({ ...ok, home: `<GenReplyBanner route={g.route} />` }, routes)],
    ['G1 옛 문구 잔존', audit({ ...ok, home: ok.home + `\n풀이가 완성됐어요!` }, routes)],
    ['G2 스냅샷 안 읽음', audit({ ...ok, map: `const OWNERS = { love: 'x' };` }, routes)],
    ['G2 표를 직접 박음', audit({ ...ok, map: ok.map + `\nconst ROUTE_OWNER = {};` }, routes)],
    ['G3 담당 없는 라우트', audit(ok, [...routes, 'taemong'])],
    ['G3 reading 은 kind 로 통과', audit({ ...ok, seed: ok.seed + ` routes: ['ziwei'],` }, ['reading'])],
    ['G4 문장에 진행률', audit({ ...ok, map: ok.map + '\nreturn `${pct}% 보는 중`;' }, routes)],
    ['G5 말풍선 새로 만듦', audit({ ...ok, banner: `const who = replierFor(route); borderRadius: 8,` }, routes)],
    ['G5 replierFor 안 씀', audit({ ...ok, banner: `borderTopLeftRadius: radius.sm,` }, routes)],
  ];
  let bad = 0;
  for (const [name, fails] of cases) {
    const shouldPass = name === '정상' || name.includes('통과');
    const passed = fails.length === 0;
    if (passed !== shouldPass) { console.error(`❌ 자가테스트 실패: ${name} → ${passed ? '통과' : fails.map((f) => f.rule).join(',')}`); bad++; }
    else console.log(`  ✓ ${name} → ${passed ? '통과' : [...new Set(fails.map((f) => f.rule))].join(',')}`);
  }
  console.log(bad ? `\n❌ 자가테스트 ${bad}건 실패` : '\n✅ check:genreply 자가테스트 통과 (10케이스)');
  process.exit(bad ? 1 : 0);
}

// ── 실행 ───────────────────────────────────────────────────
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
/** `setGenProgress` 를 부르는 파일에서 라우트를 긁는다(리터럴 · gpRoute 변수 둘 다). */
function collectRoutes(): string[] {
  const files = execFileSync('grep', ['-rl', 'setGenProgress(', 'app/src'], { cwd: ROOT, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  const out = new Set<string>();
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/(?:route:\s*|gpRoute\s*=\s*)['"`]([^'"`$]+)/g)) {
      const k = m[1].replace(/^\//, '').split(/[?#]/)[0].trim();
      if (k) out.add(k);
    }
  }
  return [...out].sort();
}
const fails = audit(
  { home: read(P_HOME), banner: read(P_BANNER), map: read(P_MAP), seed: read(P_SEED), progress: read(P_PROGRESS) },
  collectRoutes(),
);
if (fails.length) {
  console.error(`❌ check:genreply — ${fails.length}건`);
  for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:genreply — 진행 알림이 담당자의 답장으로 남아 있습니다');
