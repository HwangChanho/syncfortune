// 글자크기(fs) 일괄 적용 하네스 (daniel: 반복작업=하네스) — 한 화면 파일을 makeStyles(fs)로 변환.
//   ① useFontScale/useMemo import ② StyleSheet.create → makeStyles(fs)+scaledFont ③ 스타일 블록의
//   ...font.X→...f.X, fontSize/lineHeight 리터럴→fs(). ★훅(const{fs}=…/const styles=useMemo)은 tsc가
//   'styles 없음'으로 가리키는 곳에 수동 삽입 — 컴포넌트마다 위치가 달라 자동화 안 함(오삽입 방지).
// 사용: node scripts/apply-fontscale.mjs <파일경로>
import { readFileSync, writeFileSync } from 'fs';

const file = process.argv[2];
if (!file) { console.error('need file'); process.exit(1); }
let s = readFileSync(file, 'utf8');

if (!s.includes('StyleSheet.create(')) { console.log('SKIP (no StyleSheet):', file); process.exit(0); }
if (s.includes('makeStyles')) { console.log('SKIP (already done):', file); process.exit(0); }

// import 경로(파일 위치별 상대경로)
const rel = file.includes('/app/(app)/') ? '../../lib/fontScale'
          : file.includes('/screens/') || file.includes('/components/') ? '../lib/fontScale'
          : './lib/fontScale';

// ① useFontScale import (react-native import 뒤)
if (!s.includes('useFontScale')) {
  s = s.replace(/(import .*? from 'react-native';\n)/, `$1import { useFontScale } from '${rel}';\n`);
}
// useMemo 보강(react import에 없으면) — 훅에서 useMemo 사용
s = s.replace(/import \{([^}]*)\} from 'react';/, (m, g) =>
  g.includes('useMemo') ? m : `import {${g.replace(/\s*\}?\s*$/, '')}, useMemo } from 'react';`);

// ② StyleSheet.create({ … }) 범위 brace 매칭
const createIdx = s.indexOf('StyleSheet.create(');
const braceStart = s.indexOf('{', createIdx);
let depth = 0, i = braceStart, end = -1;
for (; i < s.length; i++) {
  if (s[i] === '{') depth++;
  else if (s[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
}
const closeParen = s.indexOf(')', end); // create( 의 닫는 )
const semi = s.indexOf(';', closeParen);

let block = s.slice(braceStart, end + 1); // { …스타일… }
const hasSpread = /\.\.\.font\./.test(block);

// ③ 스타일 블록 내부 치환(스프레드는 scaledFont의 f.X로, 리터럴은 fs()로)
block = block
  .replace(/\.\.\.font\.(title|heading|body|label|caption)/g, '...f.$1')
  .replace(/fontSize: ([0-9.]+)/g, 'fontSize: fs($1)')
  .replace(/lineHeight: ([0-9.]+)/g, 'lineHeight: fs($1)');

// ④ 조립 — scaledFont(스프레드 있을 때만) + makeStyles 래퍼
const scaledFont = hasSpread
  ? `const scaledFont = (fs: (n: number) => number) => ({\n` +
    `  title: { ...font.title, fontSize: fs(22) },\n` +
    `  heading: { ...font.heading, fontSize: fs(17) },\n` +
    `  body: { ...font.body, fontSize: fs(15) },\n` +
    `  label: { ...font.label, fontSize: fs(13) },\n` +
    `  caption: { ...font.caption, fontSize: fs(12) },\n});\n`
  : '';
const fDecl = hasSpread ? ' const f = scaledFont(fs);' : '';
const head = s.slice(0, createIdx).replace(/const styles = $/, '');
const open = `${scaledFont}const makeStyles = (fs: (n: number) => number) => {${fDecl} return StyleSheet.create(`;
const tail = s.slice(semi + 1);

s = head + open + block + s.slice(end + 1, semi + 1) + ' };' + tail;

writeFileSync(file, s);
console.log(`OK ${hasSpread ? '(font+literal)' : '(literal only)'}:`, file);
