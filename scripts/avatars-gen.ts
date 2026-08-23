/**
 * scripts/avatars-gen.ts — 상담가 얼굴 **로컬 생성**(Draw Things HTTP API)
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-23 *"다른 친구들 실사 이미지 작업하자 · 미남 미녀 이미지면 좋겠어"*.
 *
 * ■ 무엇을 하나
 *   `scripts/avatar-cast.ts` 의 캐스팅 시트 → 프롬프트 조립 → 로컬 이미지 생성기에 던져
 *   `design/avatars/<id>-<n>.png` 로 저장한다. 후보를 여러 장 뽑아 **고르는 방식**이다.
 *
 * ■ 왜 로컬인가
 *   외부 생성 API 는 유료·토큰 제한이고, 이 프로젝트는 **개발 단계에 API 를 안 쓴다**(CLAUDE.md 절대 0).
 *   Draw Things(무료 앱)의 A1111 호환 HTTP API 를 쓴다 — 127.0.0.1:7860.
 *   ⚠️앱이 떠 있고 설정에서 API 서버가 켜져 있어야 한다. 안 켜져 있으면 그렇게 말하고 끝낸다.
 *
 * ■ ⚠️모델이 자면 첫 장이 멈춘다
 *   idle 후 모델이 언로드되면 첫 txt2img 가 수백 초를 먹는다([[image-asset-pipeline]] 교훈).
 *   → 시작할 때 **짧은 6스텝 한 장으로 깨운다**.
 *
 * ■ ★정사각으로 뽑는다
 *   앱은 44px·22px **동그라미**에 `cover` 로 넣는다. 세로 사진을 주면 찌그러지는 게 아니라
 *   **위아래가 잘린다**(머리·턱이 날아간다). 그래서 원본부터 1:1 이다.
 *
 * 실행: npm run avatars:gen                 (전원 · 기본 후보 2장씩)
 *       npm run avatars:gen -- love_seoyun  (한 사람만)
 *       npm run avatars:gen -- love_seoyun 4 (한 사람 · 후보 4장)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { TO_GENERATE, buildPrompt, type CastMember } from './avatar-cast';

const API = 'http://127.0.0.1:7860';
const OUT_DIR = 'design/avatars';
/** 생성 해상도 — SDXL 계열의 정사각 기본값. 512 로 줄이는 건 업로드 스크립트가 한다. */
const SIZE = 1024;
/** 기본 후보 장수 — 얼굴은 한 번에 안 나온다. 골라야 한다. */
const DEFAULT_TRIES = 2;

/** 생성기가 살아 있는지 — 없으면 여기서 정직하게 끝낸다. */
async function alive(): Promise<boolean> {
  try {
    const r = await fetch(`${API}/sdapi/v1/options`, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch { return false; }
}

/**
 * 한 장 생성.
 * @param prompt 양성 프롬프트 / @param negative 음성 프롬프트 / @param seed 시드(후보마다 달라야 한다)
 * @param steps 스텝 수(깨우기용 6, 실제 28)
 * @returns PNG 바이트, 실패면 null
 */
async function txt2img(prompt: string, negative: string, seed: number, steps = 28): Promise<Buffer | null> {
  try {
    const res = await fetch(`${API}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt, negative_prompt: negative,
        width: SIZE, height: SIZE, steps, seed,
        // ★CFG 는 조금 낮게 — 인물 사진에서 높이면 피부가 플라스틱처럼 된다.
        cfg_scale: 6,
      }),
      signal: AbortSignal.timeout(600_000),
    });
    if (!res.ok) { console.log(`      HTTP ${res.status}`); return null; }
    const j = await res.json() as { images?: string[] };
    if (!j.images?.[0]) return null;
    return Buffer.from(j.images[0], 'base64');
  } catch (e) {
    console.log(`      실패: ${(e as Error).message}`);
    return null;
  }
}

/** 한 사람의 후보들을 뽑는다. */
async function generate(m: CastMember, tries: number): Promise<void> {
  const { prompt, negative } = buildPrompt(m);
  console.log(`\n■ ${m.name} (${m.id}) — ${m.role} · ${m.sex} ${m.age}`);
  console.log(`   ${m.impression}`);
  for (let i = 1; i <= tries; i++) {
    const t0 = Date.now();
    // ★시드는 사람·후보마다 고정으로 만든다 — 같은 명령을 다시 돌리면 같은 그림이 나와야
    //   "어느 후보가 몇 번인지" 대화가 된다(Math.random 이면 매번 다른 그림 = 지목 불가).
    const seed = Math.abs(hash(`${m.id}#${i}`)) % 2_147_483_647;
    const png = await txt2img(prompt, negative, seed);
    if (!png) { console.log(`   ${i}/${tries} 실패`); continue; }
    const path = `${OUT_DIR}/${m.id}-${i}.png`;
    writeFileSync(path, png);
    console.log(`   ${i}/${tries} → ${path}  (${Math.round((Date.now() - t0) / 1000)}초 · ${Math.round(png.length / 1024)}KB · seed ${seed})`);
  }
}

/** 문자열 → 안정적인 정수(시드 고정용). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h | 0;
}

// ── 실행 ───────────────────────────────────────────────────────────────────
const [who, triesArg] = process.argv.slice(2);
const tries = Number(triesArg) || DEFAULT_TRIES;
const targets = who ? TO_GENERATE.filter((m) => m.id === who) : TO_GENERATE;

if (who && !targets.length) {
  console.log(`\n'${who}' 는 생성 대상이 아닙니다. 가능한 id:\n  ${TO_GENERATE.map((m) => m.id).join(' · ')}\n`);
  process.exit(1);
}

if (!(await alive())) {
  console.log('\n⚠️ 로컬 이미지 생성기(Draw Things)가 응답하지 않습니다.');
  console.log('   앱을 켜고 설정에서 API 서버(127.0.0.1:7860)를 켠 뒤 다시 실행하세요.\n');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
console.log('\n🎨 상담가 얼굴 생성 — 모델을 깨웁니다(짧은 1장)…');
await txt2img('a red apple on a wooden table', 'blurry', 1, 6);   // ⚠️idle 언로드 대비(위 주석)

for (const m of targets) await generate(m, tries);

console.log(`\n완료 — ${OUT_DIR}/ 에서 고르세요.`);
console.log('   고른 파일을 `<id>.png` 로 남기고 `npm run avatars:upload` 하면 등록됩니다.\n');
