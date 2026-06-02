const fs = require('fs');
const path = require('path');

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files = files.concat(walk(full));
    else if (f.endsWith('.ts')) files.push(full);
  }
  return files;
}

const files = walk(path.join(__dirname, '..', 'src', 'app', 'api'));
let changed = 0;

for (const file of files) {
  let c = fs.readFileSync(file, 'utf8');
  const orig = c;

  // Collapse nested/duplicate superadmin role checks created by repeated replacements
  for (let i = 0; i < 10; i++) {
    // Positive: (auth.role === 'superadmin') || auth.role === 'superadmin' -> auth.role === 'superadmin'
    c = c.replace(/\(?auth\.role === 'superadmin'\)?\s*\|\|\s*auth\.role === 'superadmin'/g, "auth.role === 'superadmin'");
    c = c.replace(/\(?decoded\.role === 'superadmin'\)?\s*\|\|\s*decoded\.role === 'superadmin'/g, "decoded.role === 'superadmin'");
    // Negative: (auth.role !== 'superadmin') && auth.role !== 'superadmin' -> auth.role !== 'superadmin'
    c = c.replace(/\(?auth\.role !== 'superadmin'\)?\s*&&\s*auth\.role !== 'superadmin'/g, "auth.role !== 'superadmin'");
    c = c.replace(/\(?decoded\.role !== 'superadmin'\)?\s*&&\s*decoded\.role !== 'superadmin'/g, "decoded.role !== 'superadmin'");
  }

  if (c !== orig) {
    fs.writeFileSync(file, c, 'utf8');
    changed++;
  }
}

console.log('Done:', changed, 'files cleaned');
