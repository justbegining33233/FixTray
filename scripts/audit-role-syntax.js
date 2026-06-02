/**
 * Audit every .ts file under src/ for syntax problems left by the mass role-check replacement.
 * Reports every suspicious line without modifying anything.
 */
const fs = require('fs');
const path = require('path');

function walk(dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const ROOT = path.join(__dirname, '..', 'src');
const files = walk(ROOT);

// Patterns that indicate broken code from the mass replacement
const PATTERNS = [
  // double open paren never closed on same line
  { re: /if\s*\(\((?:auth|decoded)\.role\b/, label: 'double-open-paren in if' },
  // comma instead of closing paren  e.g. (auth.role === 'superadmin',
  { re: /\((?:auth|decoded)\.role\s*[!=]==\s*'superadmin',/, label: 'role check ends with comma' },
  // unclosed paren: (auth.role !== 'superadmin' && ...  with no closing ) before ;/{
  // (we'll check open vs close count on lines that contain a role check)
  { re: /(?:auth|decoded)\.role/, label: 'COUNT_CHECK' },
];

let issues = 0;
const results = [];

for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const rel = file.replace(ROOT + path.sep, '').replace(/\\/g, '/');

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;

    for (const p of PATTERNS) {
      if (p.label === 'COUNT_CHECK') {
        // Only flag lines that contain a role check AND are on a single logical line
        // (don't start a multi-line expression — heuristic: line ends with { or ;)
        if (!p.re.test(line)) continue;
        if (!/[{;,]$/.test(line.trim())) continue; // multi-line, skip
        const opens  = (line.match(/\(/g) || []).length;
        const closes = (line.match(/\)/g) || []).length;
        if (opens !== closes) {
          results.push({ file: rel, lineNo, label: `unbalanced parens (${opens}o/${closes}c)`, line: line.trim() });
          issues++;
        }
      } else {
        if (p.re.test(line)) {
          results.push({ file: rel, lineNo, label: p.label, line: line.trim() });
          issues++;
        }
      }
    }
  });
}

if (results.length === 0) {
  console.log('✅  No issues found.');
} else {
  console.log(`\n⚠️  ${issues} issue(s) found:\n`);
  for (const r of results) {
    console.log(`  ${r.file}:${r.lineNo}  [${r.label}]`);
    console.log(`    ${r.line.substring(0, 120)}`);
    console.log();
  }
}
