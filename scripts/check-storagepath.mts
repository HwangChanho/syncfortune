/**
 * scripts/check-storagepath.mts — **업로드 경로가 정책과 맞는가** (`check:storagepath`)
 * ═════════════════════════════════════════════════════════════════════════
 * ■ ★왜 만들었나 — 2026-08-28, **두 기능이 처음부터 동작하지 않고 있었다**
 *   스토리지 정책은 `(storage.foldername(name))[1] = auth.uid()` —
 *   즉 **첫 폴더가 올리는 사람의 uid** 여야 한다.
 *   그런데 코드는 `rooms/<방>/…` · `community/<uid>/…` 로 올리고 있었다 ⇒ **전부 403**.
 *   ⚠️★그 실패가 **조용했다**: 업로드 함수가 `null` 을 돌려주고 화면은 아무 말도 안 했다.
 *     대화 사진(08-27 신설)은 **한 번도 성공한 적이 없었는데** 아무도 몰랐다.
 *
 * ■ 무엇을 보나 — `storage.from('<버킷>').upload(<경로>, …)` 의 **경로 첫 조각**
 *   그것이 «uid 로 보이는 변수 보간» 이 아니면 잡는다.
 *   ★관리자 전용 경로(`consultants/…`)는 **정책이 따로 있어** 면제한다 — 목록으로 적어 둔다.
 *
 * ■ ⚠️판정은 «이름» 이 아니라 **경로 문자열의 첫 조각**으로 한다
 *   ([[harness-judge-expression-not-name]]). 변수명이 `path` 든 `p` 든 상관없다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** 정책이 uid 를 요구하지 않는 경로(첫 조각) — 관리자 전용. 늘릴 때는 정책을 먼저 확인한다. */
const EXEMPT_PREFIX = new Set(['consultants', 'covers']);

type Hit = { file: string; line: number; path: string; why: string };
const hits: Hit[] = [];
const files: string[] = [];

function collect(d: string) {
  for (const e of readdirSync(d)) {
    if (e === 'node_modules' || e === '.expo' || e === 'dist' || e.startsWith('.')) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) collect(p);
    else if (/\.(ts|tsx)$/.test(p)) files.push(p);
  }
}

/** 업로드 경로 문자열에서 **첫 조각**을 뽑는다(`\`${uid}/rooms/x\`` → `${uid}`). */
export function firstSegment(tpl: string): string {
  const body = tpl.replace(/^[`'"]|[`'"]$/g, '');
  return body.split('/')[0] ?? '';
}
/** 그 조각이 «uid 보간» 인가 — 통째로 하나의 `${…}` 이고 이름에 uid/user/me/owner 가 보이면 참. */
export function looksLikeUid(seg: string): boolean {
  const m = /^\$\{([^}]+)\}$/.exec(seg.trim());
  if (!m) return false;
  return /\b(uid|user|me|owner|auth)\b/i.test(m[1]);
}

if (process.argv.includes('--selftest')) {
  const cases: [string, boolean][] = [
    ['`${user.id}/rooms/a.png`', true],
    ['`${me}/community/a.png`', true],
    ['`${uid}/avatar.jpg`', true],
    ['`rooms/${sessionId}/a.png`', false],       // ★실제로 막혀 있던 그 경로
    ['`community/${me}/a.png`', false],          // ★내가 새로 만들었다가 막힌 경로
    ['`${sessionId}/a.png`', false],             // uid 가 아닌 보간
  ];
  let bad = 0;
  for (const [tpl, want] of cases) {
    const got = looksLikeUid(firstSegment(tpl));
    if (got !== want) { bad++; console.log(`  ❌ ${tpl} → ${got} (기대 ${want})`); }
    else console.log(`  ✅ ${tpl} → ${got}`);
  }
  console.log(bad ? `\n❌ 자가테스트 ${bad}건 실패` : '\n✅ 자가테스트 통과(6케이스)');
  process.exit(bad ? 1 : 0);
}

collect('app/src');
const RE = /storage\s*\.\s*from\(\s*['"]([^'"]+)['"]\s*\)\s*\.\s*upload\(\s*([^,]+),/g;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  RE.lastIndex = 0;
  for (const m of src.matchAll(RE)) {
    const bucket = m[1];
    const arg = m[2].trim();
    const line = src.slice(0, m.index ?? 0).split('\n').length;
    // 경로가 변수면 그 변수의 대입을 찾아 본다(`const path = \`…\`` 형태)
    let tpl = arg;
    if (!/^[`'"]/.test(arg)) {
      const decl = new RegExp(`\\b${arg.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*=\\s*(\`[^\`]*\`)`).exec(src);
      if (decl) tpl = decl[1];
      else {
        /**
         * ★한 단계 더 따라간다 — 경로를 **헬퍼가 짓는** 경우(2026-08-31).
         *   `const path = newPath(user.id, 'avatar', type)` 처럼 쓰면 종전 판정은
         *   «못 따라갔다» 로 손을 들었다. 규칙(첫 칸 = uid)은 지켜지는데도 빨간불이다
         *   ([[harness-goes-blind-on-refactor]] — 자리·모양으로 판정하면 리팩터링에 눈이 먼다).
         * ⇒ 대입이 **같은 파일의 함수 호출**이면 그 함수의 `return` 템플릿을 본다.
         * ⚠️한 단계만 본다 — 더 깊이 좇으면 판정이 «작은 인터프리터» 가 되어 스스로 틀린다.
         */
        const esc2 = arg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const call = new RegExp(`\\b${esc2}\\s*=\\s*(\\w+)\\s*\\(`).exec(src);
        const fn = call?.[1];
        const ret = fn
          ? new RegExp(`function\\s+${fn}\\b[\\s\\S]*?return\\s+(\`[^\`]*\`)`).exec(src)
          : null;
        if (ret) tpl = ret[1];
        else { hits.push({ file: f, line, path: arg, why: '경로를 못 따라갔다 — 사람이 확인할 것' }); continue; }
      }
    }
    const seg = firstSegment(tpl);
    if (EXEMPT_PREFIX.has(seg)) continue;                       // 관리자 전용(정책 별도)
    if (looksLikeUid(seg)) continue;                            // ✅정상
    hits.push({ file: f, line, path: tpl.slice(0, 60), why: `첫 폴더가 «${seg}» 다 — 정책은 uid 를 요구한다(버킷 ${bucket})` });
  }
}

if (!hits.length) { console.log('✅ check:storagepath — 업로드 경로가 전부 uid 로 시작한다'); process.exit(0); }
console.log(`❌ check:storagepath — ${hits.length}건 (업로드가 **조용히** 403 으로 실패한다)`);
for (const h of hits) console.log(`  ${h.file}:${h.line}  ${h.path}\n      ${h.why}`);
process.exit(1);
