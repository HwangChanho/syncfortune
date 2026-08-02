#!/usr/bin/env tsx
/**
 * check:alertonce — 확인 알림은 **한 번 뜨면 한 번만 닫힌다**를 강제한다.
 * ───────────────────────────────────────────────────────────────────────────
 * 왜 하네스인가(daniel 2026-08-02 "광고제거 구매하면 앱 크래시"):
 *   AppAlert 의 close() 는 setOpts(null) 만 했고, 상태 반영은 다음 렌더라 그 사이
 *   버튼이 **여전히 눌렸다.** 같은 프레임에 두 번 닿으면
 *     ① 버튼 콜백이 두 번 → 구매 RPC 두 번 = **중복 차감**
 *        (실측: coin_ledger 에 adfree_30 −30 이 0.653ms 간격으로 2건)
 *     ② alertDismissed 가 두 번 → pump() 두 번 → 앞 모달 transition 중 다음 모달 present
 *        = iOS terminate. **큐가 막으려던 바로 그 크래시를 닫기가 되살렸다.**
 *   확인 알림은 결제·삭제 등 위험한 동작의 공통 관문이라, 이 불변식이 깨지면 곧 돈이 샌다.
 *
 * ★판정은 '이름'이 아니라 **표현식**으로 한다(08-01 교훈) — 주석에 단어가 있다고 통과시키지 않는다.
 * ★음성 테스트: 각 규칙은 아래 NEGATIVE 샘플(일부러 깨진 코드)에 반드시 물어야 한다.
 *
 * 사용: npm run check:alertonce
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const HOST = join(ROOT, 'app/src/components/AppAlert.tsx');
const QUEUE = join(ROOT, 'app/src/lib/ui/alert.ts');

/** 주석을 걷어낸 소스 — '주석에 적힌 단어'가 규칙을 통과시키는 걸 막는다. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

type Rule = { id: string; desc: string; test: (host: string, queue: string) => boolean };

const RULES: Rule[] = [
  {
    id: 'A1',
    desc: 'AppAlert 가 처리된 알림을 기억하는 ref 를 둔다',
    test: (h) => /useRef<[^>]*>\(\s*null\s*\)/.test(h) && /handledRef/.test(h),
  },
  {
    id: 'A2',
    desc: 'close() 가 이미 처리된 알림이면 **즉시 반환**한다(중복 닫기 차단)',
    // 표현식으로: close 정의 안에 `handledRef.current === opts` 비교 후 return 이 있어야 한다.
    test: (h) => {
      const m = h.match(/const\s+close\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\};/);
      if (!m) return false;
      const body = m[1];
      return /if\s*\(\s*handledRef\.current\s*===\s*opts\s*\)\s*return\b/.test(body)
        && /handledRef\.current\s*=\s*opts/.test(body);
    },
  },
  {
    id: 'A3',
    desc: 'close() 안에서 표식 지정이 setOpts/​setTimeout **앞**에 온다(먼저 잠그고 나서 닫는다)',
    test: (h) => {
      const m = h.match(/const\s+close\s*=\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\};/);
      if (!m) return false;
      const body = m[1];
      const mark = body.indexOf('handledRef.current = opts');
      const set = body.indexOf('setOpts(');
      const timer = body.indexOf('setTimeout(');
      return mark >= 0 && set > mark && timer > mark;
    },
  },
  {
    id: 'Q1',
    desc: 'alertDismissed() 가 중복 호출에 방어한다(current 없으면 아무것도 안 함)',
    test: (_h, q) => {
      const m = q.match(/export function alertDismissed\s*\(\)\s*\{([\s\S]*?)\n\}/);
      if (!m) return false;
      const body = m[1];
      // 'current 가 비어 있으면 return' 이 **pump 호출보다 앞**에 있어야 한다.
      const guard = body.search(/if\s*\(\s*!\s*current\s*\)\s*return\b/);
      const pump = body.indexOf('pump(');
      return guard >= 0 && pump > guard;
    },
  },
];

// ── 음성 테스트: 일부러 깨진 코드에 규칙이 무는지 확인한다 ────────────────────
const NEG_HOST_NO_GUARD = `
  const handledRef = useRef<AlertOpts | null>(null);
  const close = () => { setOpts(null); setTimeout(alertDismissed, 350); };
`;
const NEG_HOST_COMMENT_ONLY = `
  // handledRef.current === opts 로 중복을 막는다
  const close = () => { setOpts(null); setTimeout(alertDismissed, 350); };
`;
const NEG_HOST_ORDER = `
  const handledRef = useRef<AlertOpts | null>(null);
  const close = () => {
    if (handledRef.current === opts) return;
    setOpts(null);
    handledRef.current = opts;
    setTimeout(alertDismissed, 350);
  };
`;
const NEG_QUEUE = `
export function alertDismissed() {
  current = null;
  pump();
}
`;

const host = code(HOST);
const queue = code(QUEUE);

console.log('\n🔔 check:alertonce — 알림 1회 표시 = 1회 처리 불변식\n');

let failed = 0;
for (const r of RULES) {
  const ok = r.test(host, queue);
  console.log(`  ${ok ? '✓' : '✗'} [${r.id}] ${r.desc}`);
  if (!ok) failed++;
}

// 음성 테스트 — 규칙이 실제로 무는지(안 물면 하네스가 없느니만 못하다)
const NEG: { name: string; host: string; queue: string; mustFail: string[] }[] = [
  { name: '가드 없는 close()', host: NEG_HOST_NO_GUARD, queue, mustFail: ['A2'] },
  { name: '주석에만 있는 가드', host: code2(NEG_HOST_COMMENT_ONLY), queue, mustFail: ['A1', 'A2'] },
  { name: '표식이 setOpts 뒤',  host: NEG_HOST_ORDER, queue, mustFail: ['A3'] },
  { name: '무방비 alertDismissed', host, queue: NEG_QUEUE, mustFail: ['Q1'] },
];
function code2(s: string): string { return s.replace(/(^|[^:])\/\/.*$/gm, '$1 '); }

console.log('\n  ── 음성 테스트(깨뜨려 보고 무는가) ──');
let negFailed = 0;
for (const n of NEG) {
  for (const id of n.mustFail) {
    const r = RULES.find((x) => x.id === id)!;
    const bites = !r.test(n.host, n.queue);
    console.log(`  ${bites ? '✓' : '✗'} [${id}] "${n.name}" 을(를) ${bites ? '잡는다' : '★못 잡는다'}`);
    if (!bites) negFailed++;
  }
}

if (failed || negFailed) {
  console.error(`\n❌ check:alertonce 실패 — 규칙 ${failed}건 · 음성테스트 ${negFailed}건\n`);
  process.exit(1);
}
console.log('\n✅ check:alertonce 통과 — 중복 닫기·중복 콜백·모달 연속 present 차단됨\n');
