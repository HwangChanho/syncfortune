/**
 * scripts/covers-brief.ts — 캐스팅 시트 → **배경(cover) 작업 지시서**
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-26 *"배경 이미지도 뽑자 전신사진으로 뽑자 실내에서 맨발로 있으면 좋겠어"* ·
 *   *"선생님들은 배경화면은 영상으로 놓자"* · *"배경 영상 요청도 병행으로 해둬"*
 *
 * ■ 왜 문서를 **만들어 내는가**(직접 쓰지 않고)
 *   인물 설정이 문서와 코드 두 곳에 있으면 **말없이 갈라진다**.
 *   원본은 `scripts/avatar-cast.ts` 하나 — 이 스크립트는 읽어서 옮겨 적을 뿐이다.
 *   [[duplicate-ui-single-source]]
 *
 * 실행: npm run covers:brief   → docs/design/consultant-covers-brief.md
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { CAST, COVER_STYLE, COVER_NEGATIVE, COVER_VIDEO_SPEC, COVER_MOTION } from './avatar-cast';

const OUT = 'docs/design/consultant-covers-brief.md';
const L: string[] = [];
const w = (s = '') => L.push(s);

w('# 상담가 **배경(cover)** 작업 지시서');
w();
w('> ⚠️이 문서는 `scripts/avatar-cast.ts` 에서 **생성된 것**입니다. 여기를 고치지 말고 그 파일을 고치세요.');
w('> 다시 뽑기: `npm run covers:brief`');
w();
w('## 무엇을 만드나');
w();
w('프로필 창(카카오톡식)의 **뒷그림**입니다. 프로필 사진과 **규격이 정반대**입니다.');
w();
w('| | 프로필 사진(avatar) | **배경(cover)** |');
w('|---|---|---|');
w('| 비율 | 1:1 정사각 | **9:16 세로** |');
w('| 담기는 것 | 얼굴이 화면의 60% | **전신 — 발끝까지** |');
w('| 전신 | ❌ negative 로 금지 | ✅ **필수** |');
w('| 매체 | 사진만 | 사진 **또는 5초 이하 영상** |');
w();
w('⚠️**같은 사진으로 둘 다 쓰지 마세요.** 지난번에 세로 사진을 동그라미에 넣어 머리가 잘렸습니다.');
w();
w('## 공통 조건 (Boss 지시)');
w();
w('- **실내** — 조용한 한국식 방(한지 벽·나무 바닥·격자창으로 드는 햇빛)');
w('- **맨발** — 신발·양말·슬리퍼 ❌. **발이 잘리면 안 됩니다**(맨발이 안 보이면 지시를 못 지킨 것)');
w('- 인물은 프레임 **아래 2/3**, 위쪽은 여백(그 위에 이름·버튼이 얹힙니다)');
w('- 색은 앱 팔레트 — 카멜·오커·짙은 갈색·한지 톤');
w();
w('## 영상 규격 (선생님 배경은 영상으로)');
w();
w('| 항목 | 값 |');
w('|---|---|');
Object.entries(COVER_VIDEO_SPEC).forEach(([k, v]) => {
  const label: Record<string, string> = {
    seconds: '길이', maxSeconds: '최대 길이', fps: 'fps', size: '해상도',
    maxBytes: '최대 용량', format: '형식', motion: '움직임', loop: '반복',
  };
  const val = k === 'maxBytes' ? `${Math.round(Number(v) / 1024 / 1024)}MB` : String(v);
  w(`| ${label[k] ?? k} | ${val} |`);
});
w();
w('⚠️**움직임은 아주 적게.** 프로필 창 뒤에서 도는 그림이라, 크게 움직이면 그 위의 글자를 못 읽습니다.');
w('⚠️**무음**이어야 합니다 — 자동재생은 소리가 있으면 브라우저·OS 가 막습니다.');
w();
w('## ★만드는 순서 — **2단계** (Boss 2026-08-26 *"기존 이미지에서 카테고리별로 알맞게"*)');
w();
w('기존 프로필 사진은 **1:1 얼굴**이고 배경은 **9:16 전신**입니다. 얼굴 사진을 늘려 전신을 만들 수는 없습니다.');
w('그 대신 **얼굴을 고정한 채 새로 찍는** 방식으로 갑니다 — 같은 사람으로 보여야 하니까요.');
w();
w('| 단계 | 도구 | 하는 일 |');
w('|---|---|---|');
w('| ① 스틸 | **PuLID-Flux**(얼굴 고정) | 기존 `avatars/consultants/<id>.jpg` 의 **얼굴을 레퍼런스**로 넣고, 아래 프롬프트로 **9:16 전신·실내·맨발** 스틸을 뽑습니다 |');
w('| ② 영상 | **Wan 2.2 (i2v)** | ①에서 나온 스틸을 첫 프레임으로 **5초 루프** 영상을 만듭니다 |');
w();
w('⚠️①에서 **얼굴이 달라지면 거기서 멈추고** 다시 뽑아 주세요 — 프로필 사진과 다른 사람이면 안 됩니다.');
w('⚠️`nossem`(노쌤)은 **실존 인물**이라 ①②를 하지 않습니다.');
w();
w('## 사람별');
w();
const targets = CAST.filter((m) => !m.real);
const skipped = CAST.filter((m) => m.real);
for (const m of targets) {
  w(`### ${m.name} (\`${m.id}\`)`);
  w();
  w(`- 하는 일: ${m.role} · ${m.group === 'teacher' ? '선생님 AI' : '함께하면 좋은 친구'}`);
  if (m.sex || m.age) w(`- ${[m.sex, m.age].filter(Boolean).join(' · ')}`);
  if (m.impression) w(`- 인상: ${m.impression}`);
  if (m.caution) w(`- ⚠️${m.caution}`);
  w();
  w('```text');
  w([COVER_STYLE, m.look, m.sex === '남' ? 'a Korean man' : 'a Korean woman', m.ageEn].filter(Boolean).join(', '));
  w('```');
  w();
  w(`**② 영상 움직임**(Wan i2v): \`${COVER_MOTION[m.id] ?? 'slow calm breathing, occasional slow blink'}\`, camera locked, no pan, no zoom, seamless loop`);
  w();
  w('negative:');
  w('```text');
  w([COVER_NEGATIVE, m.extraNegative].filter(Boolean).join(', '));
  w('```');
  w();
}
if (skipped.length) {
  w('## 만들지 않는 사람');
  w();
  for (const m of skipped) w(`- **${m.name}**(\`${m.id}\`) — 실존 인물입니다. 사진·영상은 Boss 가 직접 줍니다.`);
  w();
}
w('## 다 만든 뒤');
w();
w('```bash');
w('npm run covers:upload <폴더>     # 8MB 이하 검사 → 스토리지 → consultants.cover → 열리는지 확인');
w('```');
w();
w('⚠️파일명은 **상담가 id** 로 해 주세요(`love_seoyun.mp4` · `heal_yuri.jpg`).');

mkdirSync('docs/design', { recursive: true });
writeFileSync(OUT, L.join('\n'), 'utf8');
console.log(`✅ ${OUT} — 대상 ${targets.length}명 · 제외 ${skipped.length}명 · ${L.join('\n').length.toLocaleString()}자`);
