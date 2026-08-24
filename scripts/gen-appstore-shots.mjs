// scripts/gen-appstore-shots.mjs — App Store 스크린샷 6장 생성 (1242×2688 · 헤드리스 크롬)
// ═══════════════════════════════════════════════════════════════════════════
// 왜 다시 만드나 (2026-08-15 실측):
//   스토어에 올라간 6장이 **앱과 세 군데서 어긋났다.**
//     ① 브랜드 — 하단에 `팔자 八字` (앱 이름은 **니운내운**, 심사 노트는 `Wooni`)
//     ② 팔레트 — 감청+골드인데 앱은 08-10 부터 **라벤더**(#F7F5FD / #7C5CE0)
//     ③ 내용   — 4.3(b) 리젝의 반박 카드인 **관계 지도가 한 장도 없다**
//   심사자는 스크린샷을 가장 먼저 본다. 앱과 다른 그림은 그 자체로 리젝 사유(2.3.3)이고,
//   "또 하나의 운세 앱"이라는 4.3(b) 판단을 굳히는 자리이기도 하다.
//
// ■ 무엇을 지켰나
//   · 색은 **앱 토큰 그대로**(theme.ts LIGHT) — 스크린샷용 색을 새로 만들지 않는다.
//   · 문구는 **앱에 실제로 있는 말**만 쓴다(관계 지도 문구는 relationMapPhrases 원문).
//   · 1~2번째 = 관계 지도(4.3(b) 대응) · 나머지는 기존 6장의 주제를 잇는다.
//
// 실행: node scripts/gen-appstore-shots.mjs
//   → docs/release/screenshots-2026-08/{01..06}.png (1242×2688)
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const OUT = path.resolve(import.meta.dirname, '../docs/release/screenshots-2026-08');
const TMP = '/private/tmp/claude-501/-Users-danielhwang-Desktop-Projects-syncfortune/shotsrc';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

// ── 앱 팔레트 — ★**원본에서 읽는다**(사본을 두지 않는다) ─────────────────────
//   ⚠️2026-08-25 사고: 여기 하드코딩된 사본이 라벤더인 채로 남아, 앱이 **카멜로 바뀐 뒤에도**
//     스크린샷만 보라로 나올 뻔했다. 주석엔 *"앱 토큰 그대로"* 라 적혀 있었지만 **사본이었다.**
//     (스크린샷이 앱과 다르면 그 자체로 리젝 사유다 — 2.3.3. 이번 리젝의 원인 중 하나이기도 했다.)
//   ⇒ `theme/elementPalette.ts` 의 활성 팔레트를 **파싱해서** 쓴다. 앱이 바뀌면 여기가 따라온다.
const paletteSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../app/src/lib/theme/elementPalette.ts'), 'utf8');
const themeSrc = fs.readFileSync(path.resolve(import.meta.dirname, '../app/src/lib/theme.ts'), 'utf8');
/** `theme.ts` 의 `const EP = X;` 가 정본이다 — 그 이름의 팔레트를 읽는다. */
const EP_NAME = /const EP = (\w+);/.exec(themeSrc)?.[1];
if (!EP_NAME) throw new Error('theme.ts 에서 활성 팔레트(EP)를 못 찾았다 — 스크린샷 색이 앱과 갈린다');
const epBlock = new RegExp(`export const ${EP_NAME}: ElementPalette = \\{([\\s\\S]*?)\\n\\};`).exec(paletteSrc)?.[1];
if (!epBlock) throw new Error(`elementPalette.ts 에서 ${EP_NAME} 을 못 찾았다`);
const pick = (k) => {
  const m = new RegExp(`\\b${k}:\\s*'(#[0-9A-Fa-f]{6})'`).exec(epBlock);
  if (!m) throw new Error(`${EP_NAME}.${k} 를 못 읽었다`);
  return m[1];
};
const C = {
  bg: pick('bg'), card: pick('card'), sunk: pick('sunk'),
  ink: pick('ink'), inkSoft: pick('inkSoft'), inkFaint: pick('inkFaint'), line: pick('line'),
  ju: pick('ju'), juDeep: pick('juDeep'), juSoft: pick('juSoft'), juLine: pick('juLine'),
  // 마케팅 배경(깊은 색) — 팔레트에 없는 값이라 **강조색에서 파생**한다(따로 고르지 않는다).
  deep: (() => { const h = pick('juDeep').slice(1);
    const [r, g, b] = [0, 2, 4].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * 0.42));
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`; })(),
};
console.log(`팔레트 = ${EP_NAME} · bg ${C.bg} · ju ${C.ju} · deep ${C.deep}`);
/** 오행 색 — 관계 지도 노드와 같은 값 */
const EL = { 木: '#5FA98B', 火: '#D97A93', 土: '#C9A06A', 金: '#9AA0B8', 水: '#6E8FD1' };

/** 로컬 이미지를 data URI 로 — 헤드리스 크롬이 네트워크 없이 그리게 한다. */
const dataUri = (rel) => {
  const p = path.resolve(import.meta.dirname, '..', rel);
  return `data:image/${p.endsWith('.png') ? 'png' : 'jpeg'};base64,${fs.readFileSync(p).toString('base64')}`;
};
const ICON = dataUri('app/assets/icon.png');                       // 니운내운 아이콘(원본 = 앱과 같은 파일)
const MAP_HERO = dataUri('app/assets/icons/relmap/hero.jpg');      // 관계 지도 히어로

/** 공통 셸 — 배경·헤드라인·폰 프레임·브랜드 푸터. */
const page = ({ n, kicker, title, sub, card }) => `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; -webkit-font-smoothing:antialiased; }
  body {
    width:1242px; height:2688px; overflow:hidden; position:relative;
    font-family:-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif; color:#fff;
    background:
      radial-gradient(120% 70% at 50% 0%, ${C.deep} 0%, rgba(74,58,143,0) 60%),
      linear-gradient(180deg, #221C48 0%, ${C.deep} 45%, #191436 100%);
  }
  /* 은은한 별 — 기존 6장의 톤을 잇는다(완전히 다른 그림으로 보이면 그것도 어색하다) */
  .stars { position:absolute; inset:0; opacity:.5;
    background-image:
      radial-gradient(1.5px 1.5px at 12% 9%, #fff 50%, transparent),
      radial-gradient(1.5px 1.5px at 78% 6%, #fff 50%, transparent),
      radial-gradient(1.2px 1.2px at 30% 14%, ${C.juSoft} 50%, transparent),
      radial-gradient(1.2px 1.2px at 88% 17%, ${C.juSoft} 50%, transparent),
      radial-gradient(1.6px 1.6px at 60% 4%, #fff 50%, transparent); }
  .top { position:absolute; left:0; right:0; top:118px; text-align:center; padding:0 90px; }
  .n { font-size:30px; letter-spacing:.42em; color:rgba(255,255,255,.42); font-weight:600; }
  .kick { margin-top:22px; font-size:31px; letter-spacing:.34em; color:${C.juLine}; font-weight:800; }
  h1 { margin-top:26px; font-size:96px; line-height:1.14; font-weight:800; letter-spacing:-.022em; }
  .sub { margin-top:30px; font-size:41px; line-height:1.45; color:rgba(255,255,255,.66); font-weight:500; }

  /* 폰 프레임 — 안쪽이 앱 배경색(#F7F5FD)이라 '진짜 화면'과 같은 바탕이 된다 */
  /* 높이는 '내용이 화면을 채우는' 크기로 잡는다 — 아래가 텅 비면 만들다 만 화면으로 보인다 */
  .phone { position:absolute; left:50%; transform:translateX(-50%); top:1092px;
    width:790px; height:1330px; border-radius:78px; padding:26px;
    background:linear-gradient(180deg, rgba(255,255,255,.20), rgba(255,255,255,.06));
    box-shadow:0 60px 120px rgba(0,0,0,.45); }
  .screen { width:100%; height:100%; border-radius:56px; background:${C.bg}; overflow:hidden;
    padding:38px 34px; color:${C.ink}; }
  .notch { position:absolute; left:50%; transform:translateX(-50%); top:52px;
    width:170px; height:11px; border-radius:6px; background:rgba(255,255,255,.35); }

  /* 화면 안 공통(앱 컴포넌트와 같은 모양) */
  .head { display:flex; align-items:center; gap:20px; margin-bottom:26px; }
  .head img { width:74px; height:74px; border-radius:20px; }
  .h-t { font-size:34px; font-weight:800; }
  .h-s { font-size:25px; color:${C.inkSoft}; margin-top:4px; }
  .card { background:${C.card}; border-radius:34px; padding:30px; box-shadow:0 10px 30px rgba(44,39,67,.07); }
  .card + .card { margin-top:22px; }
  .lbl { font-size:24px; font-weight:800; color:${C.ju}; }
  .body { font-size:27px; line-height:1.5; color:${C.ink}; }
  .soft { color:${C.inkSoft}; }
  .chips { display:flex; flex-wrap:wrap; gap:14px; margin-top:22px; }
  .chip { background:${C.juSoft}; color:${C.juDeep}; border-radius:20px; padding:12px 22px; font-size:23px; font-weight:700; }
  .brand { position:absolute; left:0; right:0; bottom:96px; text-align:center;
    font-size:29px; color:rgba(255,255,255,.5); letter-spacing:.02em; }
  .brand b { color:rgba(255,255,255,.82); font-weight:800; }
</style></head><body>
  <div class="stars"></div>
  <div class="top">
    <div class="n">${n} / 06</div>
    <div class="kick">${kicker}</div>
    <h1>${title}</h1>
    <div class="sub">${sub}</div>
  </div>
  <div class="phone"><div class="notch"></div><div class="screen">${card}</div></div>
  <div class="brand"><b>니운내운</b> · 사주를 엔진으로 보는 나</div>
</body></html>`;

// ── 화면 조각 ────────────────────────────────────────────────────────────────
const head = (t, s) => `<div class="head"><img src="${ICON}"><div><div class="h-t">${t}</div><div class="h-s">${s}</div></div></div>`;

/** 관계 지도 — 실제 화면 구조 그대로(가운데 나 · 역할 방향 · 케미로 거리 · 점수 배지) */
function mapCard() {
  const R = 300, CX = R, CY = R;                              // 지도 600×600
  const nodes = [
    { name: '엄마',    el: '水', deg: -90, r: 168, s: 84 },   // 인성(위)
    { name: '지훈',    el: '金', deg: -18, r: 210, s: 71 },   // 비견
    { name: '민서',    el: '水', deg: 54,  r: 150, s: 88 },   // 식상
    { name: '수아',    el: '木', deg: 126, r: 232, s: 64 },   // 재성
    { name: '팀장님',  el: '火', deg: 198, r: 196, s: 76 },   // 관성
  ];
  const dots = nodes.map((n) => {
    const rad = (n.deg * Math.PI) / 180;
    const left = CX + Math.cos(rad) * n.r - 46;
    const top = CY + Math.sin(rad) * n.r - 46;
    return `<div style="position:absolute;left:${left}px;top:${top}px;width:92px;text-align:center">
      <div style="position:relative;width:92px;height:92px;border-radius:46px;background:${EL[n.el]};
                  display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:26px">
        ${n.el === '木' ? '나무' : n.el === '火' ? '불' : n.el === '土' ? '흙' : n.el === '金' ? '금' : '물'}
        <div style="position:absolute;right:-6px;bottom:-4px;min-width:50px;padding:3px 9px;border-radius:18px;
                    background:${C.card};border:2px solid ${C.juLine};color:${C.ju};font-size:22px;font-weight:800">${n.s}</div>
      </div>
      <div style="font-size:21px;margin-top:6px;color:${C.ink};white-space:nowrap">${n.name}</div>
    </div>`;
  }).join('');
  return `${head('관계 지도', '12명 · 가까울수록 케미가 잘 맞는 사람')}
    <img src="${MAP_HERO}" style="width:100%;height:186px;object-fit:cover;border-radius:28px;margin-bottom:22px">
    <div style="position:relative;width:${R * 2}px;height:${R * 2}px;margin:0 auto;border-radius:${R}px;background:${C.sunk}">
      <div style="position:absolute;left:${CX - 130}px;top:${CY - 130}px;width:260px;height:260px;border-radius:130px;border:2px solid ${C.juLine};opacity:.55"></div>
      <div style="position:absolute;left:${CX - 248}px;top:${CY - 248}px;width:496px;height:496px;border-radius:248px;border:2px solid ${C.juLine};opacity:.35"></div>
      <div style="position:absolute;left:${CX - 62}px;top:${CY - 62}px;width:124px;height:124px;border-radius:62px;background:${EL['金']};
                  display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff">
        <div style="font-size:31px;font-weight:800">금</div><div style="font-size:21px;opacity:.9">나</div>
      </div>
      ${dots}
    </div>
    <div class="card" style="margin-top:20px">
      <div class="body">주고받는 기운이 고르게 도는 구성이에요. 어느 한쪽으로 쏠리지 않아 관계에서 크게 지치지 않습니다.</div>
      <div class="chips">
        ${[['날 끌어주는', 3], ['같은 결', 2], ['내가 챙기는', 4], ['내가 움직이는', 1], ['날 긴장시키는', 2]]
          .map(([k, v]) => `<div class="chip"><b style="color:${C.ju}">${v}</b> ${k}</div>`).join('')}
      </div>
    </div>`;
}

/** 궁합 미리보기 — CompatPeek 그대로(점수·등급·근거·유도) */
function peekCard() {
  const line = (sign, tx) => `<div style="display:flex;margin-top:14px">
      <div style="width:34px;color:${sign === '+' ? C.ju : C.inkSoft};font-size:25px;font-weight:800">${sign === '+' ? '＋' : '－'}</div>
      <div style="flex:1;font-size:26px;line-height:1.45">${tx}</div></div>`;
  return `${head('민서님과 나', '식상 · 내가 챙기게 되는 사람')}
    <div class="card">
      <div style="display:flex;align-items:flex-end;justify-content:space-between">
        <div style="font-size:78px;font-weight:900;line-height:1">88<span style="font-size:27px;color:${C.inkSoft}"> / 100</span></div>
        <div style="text-align:right"><div style="font-size:28px;font-weight:800;color:${C.ju}">💞 천생연분</div>
        <div style="font-size:23px;color:${C.inkSoft};margin-top:4px">무료 · 온디바이스 계산</div></div>
      </div>
      ${line('+', '내게 필요한 기운을 이 사람이 넉넉히 갖고 있어요.')}
      ${line('+', '계절이 서로를 보완해요 — 더울 때 식혀 주고, 추울 때 데워 줍니다.')}
      ${line('+', '내게 없는 巳·申을 채워 줘요.')}
      ${line('-', '가장 가까이 붙는 자리(일지)에 형이 있어요 — 거리와 속도를 조절하면 가라앉습니다.')}
      <div style="margin-top:26px;background:${C.ju};border-radius:26px;padding:26px;text-align:center;color:#fff;font-size:28px;font-weight:800">
        민서님과의 궁합 제대로 보기</div>
    </div>
    <div style="font-size:28px;font-weight:800;margin:26px 0 14px">잘 맞는 순</div>
    ${[['민서', '水', 88, '내가 챙기게 되는 사람'], ['엄마', '水', 84, '날 끌어주는 사람'], ['팀장님', '火', 76, '날 긴장시키는 사람']]
      .map(([nm, el, sc, role]) => `<div class="card" style="display:flex;align-items:center;gap:20px;padding:22px 26px;margin-top:14px">
        <div style="width:60px;height:60px;border-radius:30px;background:${EL[el]};color:#fff;font-size:22px;font-weight:800;
                    display:flex;align-items:center;justify-content:center">${el === '水' ? '물' : '불'}</div>
        <div style="flex:1"><div style="font-size:27px;font-weight:700">${nm}</div>
        <div style="font-size:23px;color:${C.inkSoft}">${role}</div></div>
        <div style="font-size:36px;font-weight:800;color:${C.ju}">${sc}</div></div>`).join('')}`;
}

/** 성격유형 — 기존 01번 주제 유지 */
const personaCard = () => `${head('나의 성격유형', '120가지 중 나는 어떤 유형일까')}
  <div class="card" style="text-align:center">
    <div style="width:150px;height:190px;margin:6px auto 20px;border-radius:26px;background:${C.deep};
                display:flex;align-items:center;justify-content:center;color:#F0EBFE;font-size:74px;font-weight:800">辛</div>
    <div style="font-size:38px;font-weight:800;color:${C.ju}">단단한 원석형</div>
    <div class="chips" style="justify-content:center">
      <div class="chip">신중</div><div class="chip">예리함</div><div class="chip">자기중심</div>
    </div>
    <div class="body soft" style="margin-top:22px">겉은 서늘해도 안은 뜨거운 결.<br>다듬어질수록 빛나는 사람이에요.</div>
  </div>
  <div class="card" style="display:flex;gap:18px">
    <div style="flex:1"><div class="lbl">나라는 재료</div><div class="body" style="margin-top:6px">辛 · 서리 금</div></div>
    <div style="flex:1"><div class="lbl">놓인 계절</div><div class="body" style="margin-top:6px">未 · 늦여름</div></div>
  </div>`;

/** 만세력 원국 — 엔진(진태양시) */
function manseCard() {
  const cell = (ch, el, sub) => `<div style="flex:1;text-align:center">
      <div style="background:${EL[el]};border-radius:22px;padding:16px 0;color:#fff">
        <div style="font-size:52px;font-weight:800;line-height:1.1">${ch}</div>
        <div style="font-size:21px;opacity:.92">${el === '木' ? '목' : el === '火' ? '화' : el === '土' ? '토' : el === '金' ? '금' : '수'}</div>
      </div>${sub ? `<div style="font-size:20px;color:${C.inkFaint};margin-top:8px">${sub}</div>` : ''}</div>`;
  return `${head('만세력 · 원국', '1984-01-29 05:30 · 여수')}
    <div class="card">
      <div style="display:flex;gap:14px;color:${C.inkSoft};font-size:23px;text-align:center;margin-bottom:12px">
        <div style="flex:1">시</div><div style="flex:1">일</div><div style="flex:1">월</div><div style="flex:1">년</div></div>
      <div style="display:flex;gap:14px">${cell('戊', '土')}${cell('辛', '金')}${cell('乙', '木')}${cell('丙', '火')}</div>
      <div style="display:flex;gap:14px;margin-top:14px">${cell('戌', '土', '辛丁戊')}${cell('丑', '土', '癸辛己')}${cell('未', '土', '乙己丁')}${cell('午', '火', '丙己丁')}</div>
      <div class="chips"><div class="chip">지장간</div><div class="chip">충·합·형</div><div class="chip">신살</div>
        <div class="chip" style="background:${C.ju};color:#fff">진태양시 −28분 보정</div></div>
    </div>
    <div class="card"><div class="body">같은 시각이라도 <b style="color:${C.ju}">태어난 도시</b>가 다르면 시주가 달라집니다.</div></div>`;
}

/** 애정 패턴 — 기존 02번 주제 */
const loveCard = () => `${head('나의 애정흐름', '끌림과 안정, 두 축으로')}
  <div class="card">
    <div class="lbl">반복되는 결</div>
    <div class="body" style="margin-top:10px">가까워지면 거리를 두고 싶어지는 <b style="color:${C.ju}">배우자궁의 긴장</b>이 관계마다 되풀이돼요.</div>
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;font-size:24px;color:${C.inkSoft}"><span>끌림</span><span>안정</span></div>
    <div style="height:20px;border-radius:10px;background:${C.juSoft};margin-top:14px">
      <div style="width:68%;height:100%;border-radius:10px;background:${C.ju}"></div></div>
    <div style="height:20px;border-radius:10px;background:${C.juSoft};margin-top:14px">
      <div style="width:41%;height:100%;border-radius:10px;background:${C.juDeep};opacity:.65"></div></div>
    <div class="chips"><div class="chip">정관 = 안정</div><div class="chip" style="background:${C.ju};color:#fff">편관 = 끌림</div><div class="chip">일지 충</div></div>
  </div>`;

/** 교차검증 — 사주 × 자미두수 */
function crossCard() {
  const p = (nm, ch, on) => `<div style="flex:1;background:${on ? C.juSoft : C.sunk};border-radius:20px;padding:16px 12px;text-align:center">
      <div style="font-size:20px;color:${C.inkSoft}">${nm}</div>
      <div style="font-size:38px;font-weight:800;color:${on ? C.juDeep : C.ink};margin-top:6px">${ch}</div></div>`;
  return `${head('교차검증', '사주와 자미가 같은 방향인가')}
    <div class="card">
      <div class="lbl" style="margin-bottom:16px">자미두수 · 명궁 삼방</div>
      <div style="display:flex;gap:12px">${p('복덕', '武')}${p('명궁', '紫', 1)}${p('부모', '天')}${p('형제', '廉')}</div>
      <div style="display:flex;gap:12px;margin-top:12px">${p('관록', '府', 1)}${p('전택', '貪')}${p('노복', '巨')}${p('재백', '祿', 1)}</div>
    </div>
    <div class="card">
      <div class="lbl">수렴 · 두 체계 일치</div>
      <div class="body" style="margin-top:10px">사주의 <b style="color:${C.ju}">재관</b>과 자미의 <b style="color:${C.ju}">재백 화록</b>이 같은 시기를 가리켜요.</div>
    </div>`;
}

// ── 6장 정의 — 1~2번을 관계 지도로(4.3(b) 대응) ──────────────────────────────
const SHOTS = [
  { n: '01', kicker: '관 계 지 도', title: '내 사람들이<br>한 장에', sub: '역할과 케미를 지도로 — 무료·기기 안에서 계산', card: mapCard() },
  { n: '02', kicker: '궁 합', title: '점을 누르면<br>그 사람과 나', sub: '점수만 주지 않습니다 — 왜 그 점수인지까지', card: peekCard() },
  { n: '03', kicker: '자 기 이 해', title: '나는 어떤<br>사람인가', sub: '타고난 성격·기질·강점을 사주로', card: personaCard() },
  { n: '04', kicker: '엔 진', title: '생년월일로<br>계산한 명식', sub: '진태양시·경도·서머타임까지 보정한 만세력', card: manseCard() },
  { n: '05', kicker: '관 계', title: '왜 내 관계는<br>반복될까', sub: '애정 패턴과 인연의 결을 읽다', card: loveCard() },
  { n: '06', kicker: '교 차 검 증', title: '두 전통이<br>함께 본다', sub: '사주 × 자미두수, 두 관점의 수렴', card: crossCard() },
];

for (const s of SHOTS) {
  const html = path.join(TMP, `${s.n}.html`);
  const png = path.join(OUT, `${s.n}.png`);
  fs.writeFileSync(html, page(s));
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--window-size=1242,2688', `--screenshot=${png}`, `file://${html}`,
  ], { stdio: 'ignore' });
  console.log(`✅ ${png} (${fs.statSync(png).size} bytes)`);
}
console.log(`\n6장 생성 완료 → ${OUT}`);
