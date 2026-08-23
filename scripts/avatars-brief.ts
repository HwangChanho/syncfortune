/**
 * scripts/avatars-brief.ts — 캐스팅 시트 → **작업 지시서**(마크다운) 생성
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-23 *"다른 컴퓨터 세션에 이미지 영상작업할수있게 해뒀으니깐"*.
 *
 * ■ 왜 문서를 **만들어 내는가**(직접 쓰지 않고)
 *   인물 설정이 문서와 코드 두 곳에 있으면 **말없이 갈라진다** — 프롬프트를 고쳤는데 안내지는
 *   옛 설정을 말하는 식이다([[duplicate-ui-single-source]]).
 *   ⇒ 원본은 `scripts/avatar-cast.ts` 하나. 이 스크립트는 그걸 **읽어서 옮겨 적을** 뿐이다.
 *
 * 실행: npm run avatars:brief   → docs/design/consultant-avatars-brief.md
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { CAST, HOUSE_STYLE, NEGATIVE, buildPrompt } from './avatar-cast';

const OUT = 'docs/design/consultant-avatars-brief.md';

const L: string[] = [];
const w = (s = '') => L.push(s);

w('# 상담가 열두 얼굴 — 실사 이미지 작업 지시서');
w();
w('> 이 문서는 **자동 생성**됩니다. 고칠 곳은 `scripts/avatar-cast.ts` 이고,');
w('> `npm run avatars:brief` 로 이 파일을 다시 만듭니다. 여기 직접 쓰면 다음 생성 때 사라집니다.');
w();

// ── 규격 ──────────────────────────────────────────────────────────────────
w('## 1. 규격 (먼저 읽을 것)');
w();
w('| 항목 | 값 | 왜 |');
w('|---|---|---|');
w('| 비율 | **정사각 1:1** | 앱이 44px·22px **동그라미**에 `cover` 로 넣는다. 세로 사진은 위아래가 잘려 머리·턱이 날아간다 |');
w('| 해상도 | 1024×1024 이상 | 최종은 512×512 로 줄인다. 원본이 크면 다시 쓸 수 있다 |');
w('| 구도 | 얼굴이 화면 높이의 **약 60%**, 눈은 위쪽 1/3 | 44px 에서 전신·원거리 사진은 **누구인지 식별 불가** |');
w('| 여백 | 얼굴이 **중앙 원 안**에 들어오게 | 동그라미로 잘리므로 네 귀퉁이는 사라진다 |');
w('| 파일 | `<id>.png` (아래 표의 id) | 업로드 스크립트가 그 이름으로 찾는다 |');
w('| 금지 | 실존 인물·연예인 닮은 얼굴 | 가상의 인물이어야 한다(초상권) |');
w();

// ── 공통 프롬프트 ─────────────────────────────────────────────────────────
w('## 2. 공통 프롬프트 (열한 명 모두 앞에 붙인다)');
w();
w('```text');
w(HOUSE_STYLE);
w('```');
w();
w('### 공통 negative');
w();
w('```text');
w(NEGATIVE);
w('```');
w();

// ── 인물 ──────────────────────────────────────────────────────────────────
w('## 3. 인물 열둘');
w();
const real = CAST.filter((m) => m.real);
if (real.length) {
  w('### ⛔ 생성하지 않는 사람');
  w();
  for (const m of real) w(`- **${m.name}** (\`${m.id}\`) — ${m.caution}`);
  w();
}

for (const group of ['teacher', 'friend'] as const) {
  const list = CAST.filter((m) => !m.real && m.group === group);
  if (!list.length) continue;
  w(`### ${group === 'teacher' ? '✦ 선생님 AI' : '✦ 함께하면 좋은 친구들'} · ${list.length}명`);
  w();
  for (const m of list) {
    const { prompt, negative } = buildPrompt(m);
    w(`#### ${m.name} · ${m.role}`);
    w();
    w(`- **파일명** \`${m.id}.png\` · **${m.sex}** · ${m.age}`);
    w(`- **인상** ${m.impression}`);
    w(`- **근거** ${m.why}`);
    if (m.caution) w(`- ⚠️ ${m.caution}`);
    w();
    w('```text');
    w(prompt);
    w('```');
    if (negative !== NEGATIVE) {
      w();
      w('추가 negative:');
      w();
      w('```text');
      w(m.extraNegative!);
      w('```');
    }
    w();
  }
}

// ── 넘기는 방법 ───────────────────────────────────────────────────────────
w('## 4. 다 만든 뒤');
w();
w('1. 사람마다 **후보 2~3장**을 뽑고 가장 나은 것을 `<id>.png` 로 남긴다(나머지는 `<id>-2.png` 식으로 둬도 된다).');
w('2. 파일을 이 저장소의 `design/avatars/` 에 넣는다.');
w('3. `npm run avatars:upload` — 512×512 jpeg 로 줄여 스토리지에 올리고 DB까지 연결한다.');
w('4. `npm run avatars` — 열두 줄이 모두 ✅ 인지 확인한다(경로만 있고 파일이 없는 사고를 잡는다).');
w();

mkdirSync('docs/design', { recursive: true });
writeFileSync(OUT, L.join('\n'));
console.log(`\n📝 ${OUT} — ${CAST.filter((m) => !m.real).length}명분 프롬프트 생성 완료\n`);
