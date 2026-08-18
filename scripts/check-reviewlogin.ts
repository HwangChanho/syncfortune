#!/usr/bin/env tsx
/**
 * check:reviewlogin — App Store 리뷰어의 **유일한 로그인 통로**를 지킨다.
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜 생겼나
 *   이 앱은 SNS 전용 로그인이다(이메일·비번 입력창이 화면에 없다 — daniel 결정).
 *   그래서 App Store 리뷰어가 데모계정으로 들어올 길은 **로그인 화면 타이틀 롱프레스(0.8초)**
 *   하나뿐이다(daniel 2026-07-07). 심사 노트에도 그렇게 적혀 있다.
 *
 *   이 앱은 이미 **두 번 리젝**당했다([[appstore-rejection-2026-07-08]] · 4.3b · 5.1.1).
 *   여기서 제스처를 잃으면 리뷰어가 아예 못 들어와 **또 리젝**되는데,
 *   화면은 멀쩡해 보이고 우리 중 누구도 롱프레스를 눌러 볼 일이 없어서 **Apple 이 알려줄 때까지 모른다**.
 *   실제로 2026-08-18 시안 로고를 붙이면서 타이틀 `<Text>` 를 건드렸다 — 그때 만든 자물쇠다.
 *
 * 규칙
 *   R1 `AuthScreen` 에 `onLongPress` 로 `setReviewMode(true)` 를 켜는 자리가 있다
 *   R2 그 `Pressable` 안에 **타이틀 텍스트가 남아 있다** — 이미지만 남으면 못 뜰 때 누를 것이 없다
 *   R3 `reviewMode` 가 켜졌을 때 **이메일·비밀번호 입력과 제출 버튼**이 실제로 그려진다
 *   R4 `delayLongPress` 가 1.2초를 넘지 않는다(리뷰어가 그전에 손을 뗀다)
 *
 * 사용: npm run check:reviewlogin  ·  자가테스트: npx tsx scripts/check-reviewlogin.ts --selftest
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const P = 'app/src/screens/AuthScreen.tsx';

type Fail = { rule: string; msg: string };

/** 주석을 걷어낸 소스 — '주석에 적힌 말'이 아니라 **코드**로 판정한다. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * 심사용 히든 로그인이 살아 있는지 본다.
 *
 * @param src `AuthScreen.tsx` 원문
 * @returns 위반 목록. 빈 배열이면 통과
 */
export function audit(src: string): Fail[] {
  const out: Fail[] = [];
  const c = code(src);

  // R1 — 제스처 자체
  if (!/onLongPress=\{[^}]*setReviewMode\(true\)/.test(c)) {
    out.push({ rule: 'R1', msg: `${P} 에 롱프레스로 심사모드를 켜는 자리가 없다 — 리뷰어가 로그인할 길이 사라진다(리젝)` });
  }

  // R2 — 누를 것이 남아 있는가. Pressable 블록 안에 타이틀 텍스트가 있어야 한다.
  //   ★이미지만 두면 원격 이미지가 안 떴을 때 **누를 면적이 0** 이 된다.
  const block = c.match(/<Pressable[^>]*onLongPress=\{[^}]*setReviewMode\(true\)[^>]*>([\s\S]*?)<\/Pressable>/);
  if (block && !/<Text[^>]*>\s*\{t\(['"]appName/.test(block[1])) {
    out.push({ rule: 'R2', msg: `${P} 롱프레스 영역 안에 타이틀 텍스트가 없다 — 이미지가 안 뜨면 누를 면적이 0 이 된다` });
  }

  // R3 — 켜진 뒤 실제로 로그인할 수 있는가
  const hasEmail = /secureTextEntry/.test(c) && /placeholder="email"/.test(c);
  const hasSubmit = /onPress=\{submit\}/.test(c);
  if (!/\{reviewMode &&/.test(c) || !hasEmail || !hasSubmit) {
    out.push({ rule: 'R3', msg: `${P} 심사모드에서 이메일·비번 입력과 제출 버튼이 다 갖춰지지 않았다 — 모드는 켜지는데 로그인은 못 한다` });
  }

  // R4 — 너무 긴 롱프레스
  const d = c.match(/delayLongPress=\{(\d+)\}/);
  if (d && Number(d[1]) > 1200) {
    out.push({ rule: 'R4', msg: `${P} delayLongPress=${d[1]}ms — 1200ms 를 넘으면 리뷰어가 그전에 손을 뗀다` });
  }
  return out;
}

// ── 자가테스트: 규칙마다 **깨진 입력**을 넣어 정말 잡는지 본다(음성 테스트) ──
if (process.argv.includes('--selftest')) {
  const ok = `
    <Pressable onLongPress={() => setReviewMode(true)} delayLongPress={800}>
      <ExpoImage source={brandMark()} />
      <Text style={styles.title}>{t('appName')}</Text>
    </Pressable>
    {reviewMode && (
      <View>
        <TextInput placeholder="email" />
        <TextInput placeholder="password" secureTextEntry />
        <PressableScale onPress={submit}><Text>로그인</Text></PressableScale>
      </View>
    )}`;
  const cases: Array<[string, Fail[]]> = [
    ['정상', audit(ok)],
    ['R1 제스처 제거', audit(ok.replace('onLongPress={() => setReviewMode(true)} ', ''))],
    ['R2 타이틀을 이미지로 교체', audit(ok.replace(`<Text style={styles.title}>{t('appName')}</Text>`, '<ExpoImage source={wordmark()} />'))],
    ['R3 입력창 제거', audit(ok.replace('<TextInput placeholder="password" secureTextEntry />', ''))],
    ['R3 제출 제거', audit(ok.replace('onPress={submit}', 'onPress={noop}'))],
    ['R4 롱프레스 2초', audit(ok.replace('delayLongPress={800}', 'delayLongPress={2000}'))],
    // ★주석에만 적어 두고 코드에서 지운 경우
    ['주석뿐인 제스처', audit(`// onLongPress={() => setReviewMode(true)}\n<View />`)],
  ];
  let bad = 0;
  for (const [name, fails] of cases) {
    const shouldPass = name === '정상';
    const passed = fails.length === 0;
    if (passed !== shouldPass) { console.error(`❌ 자가테스트 실패: ${name} → ${passed ? '통과' : fails.map((f) => f.rule).join(',')}`); bad++; }
    else console.log(`  ✓ ${name} → ${passed ? '통과' : fails.map((f) => f.rule).join(',')}`);
  }
  console.log(bad ? `\n❌ 자가테스트 ${bad}건 실패` : '\n✅ check:reviewlogin 자가테스트 통과 (7케이스)');
  process.exit(bad ? 1 : 0);
}

const fails = audit(readFileSync(join(ROOT, P), 'utf8'));
if (fails.length) {
  console.error(`❌ check:reviewlogin — ${fails.length}건`);
  for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:reviewlogin — 심사용 히든 로그인 살아 있음');
