const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) results = results.concat(walk(full));
    else if (f.endsWith('.ts')) results.push(full);
  }
  return results;
}

const files = walk(path.join(__dirname, '..', 'src', 'app', 'api'));
let changed = 0;

for (const file of files) {
  let c = fs.readFileSync(file, 'utf8');
  const orig = c;

  // Fix extra opening paren: if ((decoded.role !== 'superadmin' && ...) {
  // Should be:              if (decoded.role !== 'superadmin' && ...) {
  c = c.replace(/if \(\((decoded\.role !== 'superadmin') && /g, "if ($1 && ");
  c = c.replace(/if \(\((auth\.role !== 'superadmin') && /g,    "if ($1 && ");
  c = c.replace(/if \(\((decoded\.role === 'superadmin') \|\| /g,"if ($1 || ");
  c = c.replace(/if \(\((auth\.role === 'superadmin') \|\| /g,   "if ($1 || ");

  if (c !== orig) {
    fs.writeFileSync(file, c, 'utf8');
    changed++;
    console.log('fixed:', file.replace(path.join(__dirname, '..', 'src', 'app', 'api') + path.sep, ''));
  }
}

console.log('\nDone:', changed, 'files fixed');
