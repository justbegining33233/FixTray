/**
 * Fix all syntax issues left by the mass role-check replacement in src/.
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
let totalFixed = 0;

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;

  // 1. Double-paren if conditions: if ((auth.role ...)) -> if (auth.role ...)
  //    Handles both === and !==, auth and decoded
  src = src.replace(/if\s*\(\(((?:auth|decoded)\.role\s*[!=]==\s*'superadmin')\)\)/g, 'if ($1)');

  // 2. Unclosed const assignment: const foo = (auth.role === 'superadmin';
  //                               -> const foo = auth.role === 'superadmin';
  src = src.replace(/=\s*\(((?:auth|decoded)\.role\s*[!=]==\s*'superadmin');/g, '= $1;');

  if (src !== orig) {
    fs.writeFileSync(file, src, 'utf8');
    const rel = file.replace(ROOT + path.sep, '').replace(/\\/g, '/');
    console.log('fixed:', rel);
    totalFixed++;
  }
}

console.log(`\nDone: ${totalFixed} file(s) fixed.`);
