// scripts/check-overlayroot.ts — **UnlockOverlay 는 ScrollView 밖에 있어야 한다**
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-12: *"풀이를 누르면 저렇게 좌물쇠가 위에있어서 안보여"* (스크린샷)
//
// ■ 증상
//   생성 중 화면이 하얗게 씻긴 채, 자물쇠·진행률·메시지는 **하나도 안 보이고**
//   '홈으로 나가기' 버튼만 본문 중간에 둥 떠 있었다. 콘텐츠는 읽을 수 없다.
//
// ■ 원인 (실측)
//   `UnlockOverlay` 는 Modal 이 아니라 **`StyleSheet.absoluteFill` View** 다
//   (2026-07-15 VideoView 가 Modal 안에서 iOS 렌더 실패해서 바꿨다 — 영상은 08-05 전면 제거됨).
//   absoluteFill 은 **부모**를 채운다. 그런데 6개 화면이 이걸 **ScrollView 안에** 두고 있었다:
//     love · gaeun · newyear · lifegraph · career · TimelineScreen
//   ⇒ 오버레이 높이 = **스크롤 내용 전체 높이**(화면의 몇 배).
//     `justifyContent: 'center'` 가 자식들을 그 **긴 내용의 한가운데**에 놓으니 화면 밖으로 나간다.
//     마지막 자식인 '홈으로 나가기'만 우연히 보이는 위치에 걸렸던 것.
//
// ★왜 Modal 로 되돌리지 않았나: [[alert-double-fire-crash]] 에서 **모달 연속 present 가 iOS 를
//   terminate 시킨 실측 이력**이 있다. 그 위험을 다시 들이는 대신 배치 규칙을 기계가 지키게 한다.
//
// ■ 판정
//   호출부보다 **앞에서 열린 채 안 닫힌 `<ScrollView>` 가 하나라도 있으면 실패**.
//   [[harness-judge-expression-not-name]] 대로 이름이 아니라 **열림/닫힘 균형**으로 센다.
//
// 실행: npm run check:overlayroot
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const ROOTS = ['app/src'];

/** .tsx 를 모두 모은다(오버레이는 화면 어디서나 쓰일 수 있다). */
const files: string[] = [];
(function walk(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.tsx')) files.push(p);
  }
})(ROOTS[0]);

/** 스크롤 컨테이너 — absoluteFill 이 '내용 높이'로 늘어나는 부모들. */
const SCROLLERS = ['ScrollView', 'FlatList', 'SectionList', 'KeyboardAwareScrollView'];

let bad = 0, ok = 0;
console.log('\n🔒 UnlockOverlay 가 스크롤 밖에 있는가\n');

for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!line.includes('<UnlockOverlay')) return;
    const head = lines.slice(0, i).join('\n');
    // 열린 채 안 닫힌 스크롤 컨테이너 세기 — 자기닫힘(`<FlatList … />`)은 자식을 안 가지므로 제외
    let depth = 0;
    for (const s of SCROLLERS) {
      // ★제네릭 타입 인자를 JSX 로 세지 않는다 — `useRef<ScrollView>(null)` 이 여는 태그로 잡혀
      //   TimelineScreen 을 오탐했다([[error-harness-prebuild-check]] 오탐을 좁혀라).
      //   JSX 여는 태그는 앞이 공백/`{`/`(` 이고, 제네릭은 **식별자 바로 뒤**에 붙는다.
      const open = (head.match(new RegExp(`(?<![A-Za-z0-9_])<${s}(?=[\\s>/])`, 'g')) ?? []).length;
      const self = (head.match(new RegExp(`<${s}[^>]*/>`, 'g')) ?? []).length;
      const close = (head.match(new RegExp(`</${s}>`, 'g')) ?? []).length;
      depth += open - self - close;
    }
    const rel = f.replace('app/src/', '');
    if (depth <= 0) { ok++; console.log(`   ✅ ${rel}:${i + 1}`); return; }
    bad++;
    console.log(`   ❌ ${rel}:${i + 1} — **스크롤 컨테이너 안**에 있습니다(깊이 ${depth}).`);
    console.log(`      absoluteFill 이 화면이 아니라 **스크롤 내용 전체 높이**를 채웁니다.`);
    console.log(`      ⇒ 자물쇠·진행률·메시지가 화면 밖으로 밀려 사용자는 '홈으로 나가기'만 보게 됩니다.`);
    console.log(`      스크롤 컨테이너 **뒤(형제)** 로 옮기세요:  <>{ …<ScrollView>…</ScrollView>  <UnlockOverlay …/> }</>`);
  });
}

console.log(`\n   호출부 ${ok + bad}곳 · 정상 ${ok} · 위반 ${bad}`);
console.log(bad ? '\n❌ check:overlayroot 실패\n' : '\n✅ check:overlayroot 통과 — 오버레이가 전부 스크롤 밖\n');
if (bad) process.exitCode = 1;
