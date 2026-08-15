// scripts/check-relationmap.ts — 관계 지도 불변식(점수 단일화 · daniel 08-15 요청 3건)
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (2026-08-15 실사고):
//   `engine/relationMap.ts` 주석에 **"check:relationmap 이 이 정합을 본다"**고 적혀 있었는데
//   **그런 하네스가 없었다.** 그 사이 같은 두 사람이 궁합 화면 76 · 지도 65 로 갈렸다(최대 11점 차).
//   ★교훈: 주석에 적은 보증은 보증이 아니다. 파일이 없으면 아무도 안 본다.
//
// 무엇을 지키나
//   N. 숫자  — 지도 케미 === 궁합 점수(같은 함수·같은 값) · 정렬 · 범위
//   S. 소스  — 산식이 두 벌로 갈라지지 않는가 + daniel 08-15 요청 3건이 화면에 살아 있는가
//      ① 탭하면 궁합이 열린다 ② 지도에 점수가 보인다 ③ 이미지가 쓰인다
//   R. 배달  — 이미지 6장이 Storage 에 실제로 있는가(HTTP) — 오프라인이면 건너뛴다
//
// ★판정은 전부 **표현식**으로 한다(이름만 보면 주석·문자열에 뚫린다 · [[harness-judge-expression-not-name]]).
// ★음성 테스트: `npx tsx scripts/check-relationmap.ts --selftest`
//   — 깨뜨린 입력을 실제로 무는지 확인한다(통과만 확인하는 하네스는 하네스가 아니다).
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import { buildSajuChart } from '../engine/saju';
import { detectInteractions } from '../engine/structure';
import { analyzeCompatibility } from '../engine/compatibility';
import { compatScoreOf } from '../engine/compatScore';
import { buildRelationMap } from '../engine/relationMap';
import { entry001Self } from '../engine/fixtures/entry-001-self.fixture';
// ★문구 모듈은 **타입만** @engine 을 참조한다(런타임 import 0) → 이 스크립트가 alias 없이 부를 수 있다
import { compatBasis } from '../app/src/lib/content/relationMapPhrases';
import type { ChartInput } from '../spec/chart';

const MAP_SCREEN = 'app/src/app/(app)/relationmap.tsx';
const MAP_ENGINE = 'engine/relationMap.ts';
const APP_SCORE = 'app/src/lib/content/compatScore.ts';
const MAP_IMAGES = 'app/src/lib/content/relationMapImages.ts';

/** 주석·문자열 리터럴을 지운 '코드만'. 주석 속 단어에 걸리는 오탐을 없앤다. */
function codeOnly(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

type Finding = { rule: string; msg: string };

/**
 * 소스 규칙 판정 — 파일 네 개의 원문을 받아 위반 목록을 돌려준다.
 * @returns 빈 배열이면 통과. (테스트에서 깨뜨린 입력을 넣어 이 함수가 무는지 본다.)
 */
export function audit(src: { screen: string; engine: string; appScore: string; images: string }): Finding[] {
  const out: Finding[] = [];
  const screen = codeOnly(src.screen);
  const engine = codeOnly(src.engine);
  const appScore = codeOnly(src.appScore);
  const images = codeOnly(src.images);
  // 줄바꿈·들여쓰기를 눌러 한 줄로 본다 — JSX 를 여러 줄로 쪼개도 규칙이 안 깨지게
  const flat = (s: string) => s.replace(/\s+/g, ' ');

  // ── S1. 산식은 한 벌 ────────────────────────────────────────────────────
  if (!/chemi\s*:\s*compatScoreOf\s*\(/.test(flat(engine)))
    out.push({ rule: 'S1', msg: `${MAP_ENGINE}: 케미가 compatScoreOf() 에서 나오지 않는다(자체 산식이면 궁합 화면과 숫자가 갈린다)` });
  if (/function\s+chemiOf\b/.test(engine))
    out.push({ rule: 'S1', msg: `${MAP_ENGINE}: 두 번째 산식(chemiOf)이 되살아났다` });
  if (!/compatScoreOf\s*\(\s*dx\s*\)/.test(flat(appScore)))
    out.push({ rule: 'S2', msg: `${APP_SCORE}: 궁합 점수가 엔진(compatScoreOf)을 거치지 않는다` });
  if (/\b55\s*\+\s*season\b/.test(appScore))
    out.push({ rule: 'S2', msg: `${APP_SCORE}: 가중합이 앱에 다시 생겼다(정본은 engine/compatScore.ts)` });

  // ── S3. daniel ① 탭하면 궁합 ────────────────────────────────────────────
  //   지도 노드 JSX 영역에 궁합 열기가 있어야 한다.
  //   ⚠️`shown.map(` 은 위쪽 계산부(`const chemis = shown.map(...)`)에도 있다 —
  //     **JSX 쪽**(`{shown.map(`)을 집어야 한다. indexOf 로 잡으면 계산부를 보고 헛물을 켠다(실제로 겪음).
  const nodeAt = flat(screen).search(/\{\s*shown\.map\(/);
  const nodeRegion = nodeAt >= 0 ? flat(screen).slice(nodeAt, nodeAt + 1200) : '';
  if (nodeAt < 0) out.push({ rule: 'S3', msg: `${MAP_SCREEN}: 지도 노드 렌더({shown.map)를 못 찾았다` });
  if (!/setPeekId\s*\(/.test(nodeRegion))
    out.push({ rule: 'S3', msg: `${MAP_SCREEN}: 점을 눌러도 궁합이 안 열린다(노드 onPress 에 setPeekId 없음)` });
  if (!/<\s*CompatPeek\b/.test(screen))
    out.push({ rule: 'S3', msg: `${MAP_SCREEN}: 궁합 미리보기(CompatPeek)가 화면에 없다` });
  if (/\bcompatHook\s*\(/.test(screen))
    out.push({ rule: 'S3', msg: `${MAP_SCREEN}: 궁합 카드를 화면이 또 그린다 — CompatPeek 한 곳으로 모을 것` });

  // ── S4. daniel ② 지도에 점수 ────────────────────────────────────────────
  if (!/badgeTx[^]{0,60}n\.chemi/.test(flat(screen)))
    out.push({ rule: 'S4', msg: `${MAP_SCREEN}: 지도 노드에 점수(n.chemi)가 안 그려진다` });

  // ── S5. daniel ③ 이미지 ─────────────────────────────────────────────────
  if (!/<\s*ExpoImage[^]{0,160}RELMAP_HERO/.test(flat(screen)))
    out.push({ rule: 'S5', msg: `${MAP_SCREEN}: 히어로 이미지가 렌더되지 않는다` });
  if (!/<\s*ExpoImage[^]{0,200}ROLE_IMG\[/.test(flat(screen)))
    out.push({ rule: 'S5', msg: `${MAP_SCREEN}: 역할 이미지가 렌더되지 않는다` });
  // ⚠️키 앞을 `{`·`,`·공백으로 못박는다 — 안 그러면 오타(`x재성:`)도 통과한다(음성 테스트가 잡아냈다)
  for (const role of ['인성', '비견', '식상', '재성', '관성'])
    if (!new RegExp(`[{,\\s]${role}\\s*:\\s*A\\(`).test(images))
      out.push({ rule: 'S5', msg: `${MAP_IMAGES}: 역할 '${role}' 그림이 없다(그 역할만 빈 칸이 된다)` });

  return out;
}

// ═══ 실행부 ════════════════════════════════════════════════════════════════
const read = (p: string) => fs.readFileSync(p, 'utf8');

/** 음성 테스트 — 규칙마다 '깨뜨린 입력'을 넣어 audit 이 실제로 무는지 확인한다. */
function selftest(): number {
  const base = { screen: read(MAP_SCREEN), engine: read(MAP_ENGINE), appScore: read(APP_SCORE), images: read(MAP_IMAGES) };
  // [기대 규칙, 이름, 깨뜨린 입력] — ★어느 규칙이 물었는지까지 본다.
  //   "무엇이든 물었으면 통과"로 두면, 규칙 하나가 상시 켜져 있을 때 나머지가 다 통과로 보인다(실제로 겪음).
  const cases: [string, string, typeof base][] = [
    ['S1', '자체 산식 부활', { ...base, engine: base.engine.replace(/chemi: compatScoreOf\(dx\)\.score/, 'chemi: chemiOf(dx)') }],
    ['S2', '앱에 가중합 재생', { ...base, appScore: `${base.appScore}\nconst x = 55 + season;` }],
    ['S3', '탭이 궁합을 안 연다', { ...base, screen: base.screen.replace(/setPeekId\(on \? null : n\.id\)/, 'setOpenId(n.id)') }],
    ['S3', 'CompatPeek 제거', { ...base, screen: base.screen.replace(/<CompatPeek/g, '<View') }],
    ['S4', '점수 배지 제거', { ...base, screen: base.screen.replace(/\{n\.chemi\}<\/Text>/, '{n.role}</Text>') }],
    ['S5', '히어로 제거', { ...base, screen: base.screen.replace(/source=\{RELMAP_HERO\}/, 'source={undefined}') }],
    ['S5', '역할 그림 누락', { ...base, images: base.images.replace(/재성: A\(/, 'x재성: A(') }],
  ];
  let bad = 0;
  console.log('■ 음성 테스트 — 깨뜨린 입력을 무는가');
  const clean = audit(base);
  if (clean.length) { console.error(`  ❌ 정상 입력인데 위반이 나온다(오탐): ${clean.map((f) => f.rule).join(',')}`); bad++; }
  else console.log('  ✅ 정상 입력 = 위반 0');
  for (const [want, name, broken] of cases) {
    const hit = audit(broken);
    if (hit.some((f) => f.rule === want)) console.log(`  ✅ ${want} ${name} → 물었다`);
    else { console.error(`  ❌ ${want} ${name} → **못 물었다**(잡힌 규칙: ${hit.map((f) => f.rule).join(',') || '없음'})`); bad++; }
  }
  return bad;
}

async function main(): Promise<number> {
  let failed = 0;
  const fail = (m: string) => { console.error(`  ❌ ${m}`); failed++; };
  const pass = (m: string) => console.log(`  ✅ ${m}`);
  const ok = (c: boolean, m: string) => (c ? pass(m) : fail(m));

  if (process.argv.includes('--selftest')) return selftest();

  console.log('■ check:relationmap — 관계 지도(지도 케미 = 궁합 점수 · daniel 08-15 3건)\n');

  // ── N. 숫자: 지도와 궁합이 **같은 값**인가 ───────────────────────────────
  const me = buildSajuChart(entry001Self.input);
  me.interactions = detectInteractions(me);
  me.structure = entry001Self.saju.structure;
  const build = (i: ChartInput) => { const c = buildSajuChart(i); c.interactions = detectInteractions(c); return c; };
  const others: [string, ChartInput][] = [
    ['A', { birthDateTime: '1996-05-20 14:30', calendar: '양', timeAccuracy: '정확', sex: '여', birthPlace: '서울' }],
    ['B', { birthDateTime: '1988-11-03 09:00', calendar: '양', timeAccuracy: '정확', sex: '여', birthPlace: '부산' }],
    ['C', { birthDateTime: '1993-07-12 22:00', calendar: '양', timeAccuracy: '정확', sex: '여', birthPlace: '대구' }],
    ['D', { birthDateTime: '1975-02-11 05:00', calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '서울' }],
    ['E', { birthDateTime: '2001-09-30 18:20', calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '인천' }],
  ];
  const charts = others.map(([id, input]) => ({ id, chart: build(input) }));
  const { nodes } = buildRelationMap(me, charts);

  console.log('[N1] 지도 케미 = 궁합 점수 (같은 쌍이 화면마다 다르면 안 된다)');
  for (const n of nodes) {
    const direct = compatScoreOf(analyzeCompatibility(me, charts.find((c) => c.id === n.id)!.chart)).score;
    ok(n.chemi === direct, `${n.id}: 지도 ${n.chemi} = 궁합 ${direct}`);
  }

  console.log('\n[N2] 정렬 = 케미 내림차순(리스트 "잘 맞는 순")');
  ok(nodes.every((n, i) => i === 0 || nodes[i - 1].chemi >= n.chemi), `${nodes.map((n) => n.chemi).join(' ≥ ')}`);

  console.log('\n[N3] 점수 범위 [15,97] — §4 부정 증폭 금지(극단 회피)');
  ok(nodes.every((n) => n.chemi >= 15 && n.chemi <= 97), `최저 ${Math.min(...nodes.map((n) => n.chemi))} · 최고 ${Math.max(...nodes.map((n) => n.chemi))}`);

  // ── N4. 근거 문구가 **그 언어의 말**인가 ────────────────────────────────
  //   ★`check:copy` 로는 못 잡는다 — 이 문장들은 copy 파일이 아니라 **런타임에 조립**된다
  //     (엔진이 준 '해·원진' 같은 한국어 명리 용어가 영어 문장에 그대로 끼어 들어갔었다).
  //     [[i18n-untranslated-shipped]] — "키가 맞는가"와 "말이 그 언어인가"는 다른 질문이다.
  console.log('\n[N4] 근거 문구 3개 언어 — en/ja 에 한글이 새지 않는가');
  const HANGUL = /[가-힣]/;
  let leak = 0, empty = 0;
  for (const n of nodes) {
    const b = compatScoreOf(analyzeCompatibility(me, charts.find((c) => c.id === n.id)!.chart));
    for (const lang of ['ko', 'en', 'ja'] as const) {
      const lines = compatBasis(lang, b);
      if (!lines.length) empty++;
      for (const l of lines) {
        if (!l.text.trim() || l.text.includes('{{')) empty++;
        if (lang !== 'ko' && HANGUL.test(l.text)) { leak++; console.error(`     ↳ [${lang}] ${l.text}`); }
      }
    }
  }
  ok(leak === 0, `en/ja 한글 노출 ${leak}건`);
  ok(empty === 0, `빈 줄·자리표시자 ${empty}건`);

  // ── S. 소스 ─────────────────────────────────────────────────────────────
  console.log('\n[S] 소스 규칙 — 산식 단일화 + daniel 08-15 요청 3건');
  const found = audit({ screen: read(MAP_SCREEN), engine: read(MAP_ENGINE), appScore: read(APP_SCORE), images: read(MAP_IMAGES) });
  if (!found.length) pass('S1~S5 전부 통과(산식 한 벌 · 탭=궁합 · 지도 점수 · 이미지)');
  for (const f of found) fail(`${f.rule} ${f.msg}`);

  // ── R. 배달: 이미지가 Storage 에 실제로 있는가 ─────────────────────────
  //   ★코드가 가리키는 URL 이 404 면 화면엔 **빈 칸**이 뜬다 — 코드만 봐선 절대 안 보인다.
  console.log('\n[R] 이미지 6장이 Storage 에 있는가(HTTP)');
  const BASE = 'https://zpslflbcxzalaikbbdzk.supabase.co/storage/v1/object/public/assets/img/icons/relmap/';
  const KEYS = ['hero', 'inseong', 'bigeop', 'siksang', 'jaeseong', 'gwanseong'];
  try {
    const codes = await Promise.all(KEYS.map(async (k) => {
      const r = await fetch(`${BASE}${k}.jpg`, { method: 'HEAD', signal: AbortSignal.timeout(6000) });
      return [k, r.status] as const;
    }));
    for (const [k, code] of codes) ok(code === 200, `${k}.jpg → ${code}`);
  } catch (e) {
    console.log(`  ⏭️  네트워크 없음 — 건너뜀 (${(e as Error).message})`);
  }

  console.log(failed ? `\n❌ check:relationmap 실패 ${failed}건` : '\n✅ check:relationmap 통과');
  return failed;
}

main().then((n) => process.exit(n ? 1 : 0));
