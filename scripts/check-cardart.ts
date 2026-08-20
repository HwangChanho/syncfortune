// scripts/check-cardart.ts — 콘텐츠 카드 그림 불변식
//   [사진] 두 콘텐츠가 같은 **사진**을 쓰지 않는다   [아이콘] 같은 아이콘은 **나눠 써도 된다**
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (2026-08-16, 웹 화면을 훑다 눈으로 발견)
//   풀이 > 연애 를 3열로 펼치니 「관계의 고비」와 「재회 가능할까?」가 **같은 빨간 밧줄 그림**이었다.
//   전수 조사하니 네 쌍이 그림을 공유하고 있었다. 폰에서 세로로 볼 땐 서로 멀어 눈에 안 띄는데,
//   **데스크톱 3열에서는 나란히 놓여** 복사 실수처럼 보인다.
//   ⇒ 카드아트는 이 제품의 주력 자산이다([[card-image-legibility]]). 중복은 '아직 안 만든 것'이지
//     '이렇게 두기로 한 것'이 아니므로, 목록으로 못 박아 **더 늘지 않게** 한다.
//
// ⚠️★2026-08-19 전제가 바뀌었다 (daniel *"콘텐츠 이미지 카드들 안쓰니깐 다 제거하고 시안대로"*)
//   사진 카드 46장을 걷어내고 시안 카드(밝은 면 + 제목 + 아이콘)로 통일했다. 그래서:
//     · 사진(`A('icons/…')`) 은 이제 **0장** — C1 은 사진이 돌아왔을 때를 위해 남겨 둔다
//     · 아이콘(`contentIcon('…')`)은 **10종을 55개가 나눠 쓴다** — 이건 실수가 아니라 설계다
//       (아이콘은 그 콘텐츠를 '정확히 가리킬 때만' 붙인다 — 현재 18/55, 나머지는 제목 카드)
//   ⇒ C1 을 아이콘에 적용하면 **옳은 디자인을 막는다**([[harness-can-enforce-wrong-rule]]).
//     그래서 사진에만 적용하고, 아이콘은 C3(정확도)로 따로 지킨다.
//
// 무엇을 지키나
//   C1. 같은 **사진**을 두 콘텐츠가 쓰지 않는다 — 단 아래 `PENDING_ART` 에 적힌 것만 예외
//   C2. `PENDING_ART` 가 **낡지 않게** — 이미 해결된 항목이 남아 있으면 실패(목록을 지우게 만든다)
//   C3. 아이콘은 `brandAsset.contentIcon` 이 아는 이름만 쓴다 — 오타는 **빈 칸**으로 조용히 나간다
//
// ★C2 가 요점이다. 예외 목록은 두면 잊힌다 — 해결됐는데도 남아 있으면 하네스가 **실패**해서
//   지우도록 강제한다([[harness-can-enforce-wrong-rule]]: 초록불이 낡은 판단을 굳히지 않게).
// ★음성 테스트: `npx tsx scripts/check-cardart.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';

const SRC = 'app/src/lib/content/contentSections.ts';

/**
 * **아직 전용 사진이 없어** 다른 콘텐츠와 나눠 쓰는 항목들.
 * daniel 이 카드아트를 만들면 여기서 지운다(그때 C2 가 통과한다).
 * key = 그림이 없는 쪽 · sharesWith = 빌려 쓰는 상대
 * ★2026-08-19 사진 카드가 사라져 지금은 **비어 있다** — 사진이 돌아오면 다시 채운다.
 */
// ★2026-08-18: `reunionAsk`·`crushAsk`·`jobAsk` 를 뺐다 — Boss 가 준 시안 아이콘(반지·하트·명함)이
//   들어가 **자기 그림**을 갖게 됐다. C2 가 "이미 갖고 있다"고 잡아 줘서 알았다(목록이 낡지 않게).
const PENDING_ART: Array<{ key: string; sharesWith: string; note: string }> = [];

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/**
 * `contentSections.ts` 에서 (콘텐츠 key → 카드 이미지 경로) 짝을 뽑는다.
 * @param src 소스 전문
 * @returns `[{ key, img }]` — 이미지가 붙은 항목만
 */
export function extractCardArt(src: string): Array<{ key: string; img: string }> {
  const out: Array<{ key: string; img: string }> = [];
  // 한 항목은 한 줄에 쓰여 있다: `{ key: 'x', …, image: A('icons/y.jpg'), … }`
  for (const line of src.split('\n')) {
    const k = line.match(/key:\s*'([^']+)'/);
    const i = line.match(/image:\s*A\('([^']+)'\)/);
    if (k && i) out.push({ key: k[1], img: i[1] });
  }
  return out;
}

if (!fs.existsSync(SRC)) {
  fail('C0', `${SRC} 이 없다 — 경로가 바뀌었으면 이 하네스를 고칠 것`);
} else {
  const raw = fs.readFileSync(SRC, 'utf8');
  const items = extractCardArt(raw);

  // C3 — 아이콘 이름이 `contentIcon` 유니온 안에 있는가(오타는 빈 칸으로 조용히 나간다)
  const known = new Set(
    (fs.readFileSync('app/src/lib/ui/brandAsset.ts', 'utf8')
      // ⚠️★이름 목록은 **타입 선언**에서 읽는다(2026-08-20에 고쳤다).
      //   종전엔 `contentIcon = (name: 'a'|'b'…)` 의 인라인 union 을 읽었는데,
      //   그 union 을 `export type ContentIcon` 으로 빼자 하네스가 **열 개를 전부 모른다**고 했다.
      //   코드는 멀쩡했고 하네스만 낡은 것이다 — 단일 출처가 타입으로 옮겨갔으니 거기서 읽는다.
      .match(/export type ContentIcon =([\s\S]*?);/)?.[1] ?? '')
      .match(/'([a-z]+)'/g)?.map((x) => x.replace(/'/g, '')) ?? [],
  );
  const used = [...raw.matchAll(/contentIcon\('([a-z]+)'\)/g)].map((m) => m[1]);
  if (!used.length) fail('C0', `콘텐츠 항목에 아이콘이 하나도 없다 — 파싱이 깨졌을 수 있다`);
  for (const u of new Set(used)) {
    if (!known.has(u)) fail('C3', `contentIcon('${u}') — brandAsset 이 모르는 이름이다(빈 칸으로 나간다)`);
  }

  const byImg = new Map<string, string[]>();
  for (const { key, img } of items) byImg.set(img, [...(byImg.get(img) ?? []), key]);

  const allowed = new Set(PENDING_ART.map((p) => p.key));
  const stillShared = new Set<string>();

  for (const [img, keys] of byImg) {
    if (keys.length < 2) continue;
    // 이 그림을 빌려 쓰는 쪽(예외 목록에 있는 것)을 빼고도 둘 이상이면 진짜 중복
    const notAllowed = keys.filter((k) => !allowed.has(k));
    keys.filter((k) => allowed.has(k)).forEach((k) => stillShared.add(k));
    if (notAllowed.length > 1) {
      fail('C1', `같은 그림을 쓴다: ${img}\n        ← ${notAllowed.join(', ')}  (3열 그리드에서 나란히 뜨면 복사 실수로 보인다)`);
    }
  }

  // C2 — 해결된 예외가 목록에 남아 있으면 지우게 만든다
  for (const p of PENDING_ART) {
    if (!stillShared.has(p.key)) {
      fail('C2', `PENDING_ART 의 '${p.key}' 는 이미 전용 그림을 갖고 있다 — 목록에서 지울 것(${p.note})`);
    }
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const parse = extractCardArt;
  const cases: Array<{ name: string; run: () => boolean }> = [
    {
      name: '파싱: key + image 한 줄을 뽑는다',
      run: () => parse("  { key: 'love', image: A('icons/love.jpg'), route: '/love' },").length === 1,
    },
    {
      name: '파싱: 이미지 없는 줄은 안 뽑는다',
      run: () => parse("  { key: 'sec', titleKey: 'x' },").length === 0,
    },
    {
      name: 'C1: 두 콘텐츠가 같은 그림이면 잡힌다',
      run: () => {
        const it = parse("{ key: 'a', image: A('i.jpg') },\n{ key: 'b', image: A('i.jpg') },");
        const m = new Map<string, string[]>();
        for (const x of it) m.set(x.img, [...(m.get(x.img) ?? []), x.key]);
        return [...m.values()].some((v) => v.length > 1);
      },
    },
    {
      name: 'C1: 서로 다른 그림이면 안 잡힌다(오탐 없음)',
      run: () => {
        const it = parse("{ key: 'a', image: A('i.jpg') },\n{ key: 'b', image: A('j.jpg') },");
        const m = new Map<string, string[]>();
        for (const x of it) m.set(x.img, [...(m.get(x.img) ?? []), x.key]);
        return ![...m.values()].some((v) => v.length > 1);
      },
    },
    {
      name: 'C2: 예외 목록이 실제 상태와 맞는가(지금 파일 기준)',
      run: () => !out.some((f) => f.rule === 'C2'),
    },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { const ok = c.run(); console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:cardart — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log(`✅ check:cardart — 카드 그림 중복 없음 (전용 그림 대기: ${PENDING_ART.map((p) => p.key).join(', ') || '없음'})`);
