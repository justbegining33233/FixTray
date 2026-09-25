#!/usr/bin/env node
/**
 * Reorganize scripts/ into categorized subdirectories.
 * Run once:  node scripts/reorganize.js
 * 
 * This will move scripts into:
 *   scripts/build/   scripts/admin/   scripts/db/
 *   scripts/debug/   scripts/auth/    scripts/test/
 *   scripts/stripe/
 * 
 * Safe to run: only moves files that still exist in the root scripts/ folder.
 */
const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = __dirname;

const mapping = {
  'build': [
    'build-with-dotenv.js',
    'check-database.js',
    'fix-encoding.js',
    'prevent-commit-secrets.js',
    'prisma-safe-generate.js',
    'secret-scan-detailed.js',
  ],
  'admin': [
    'check-admin.js',
    'create-super-admin.js',
    'reset-admin-pass.js',
    'seed-admin.js',
  ],
  'db': [
    'backup-user.js',
    'check_testshop_services.js',
    'db-info.js',
    'find-by-email.js',
    'find-record.js',
    'find_user.js',
    'get-workorder.js',
    'import_defaults_testshop.js',
    'list-accounts.js',
    'list-recent-entities.js',
    'list-techs.js',
    'rotate-db-password.js',
  ],
  'debug': [
    'check-admin-pw.js',
    'check-login-readiness.js',
    'check_tokens.js',
    'debug-admin-login-flow.js',
    'dump-users.js',
    'inspect-admin-hash.js',
    'inspect-admin.js',
    'inspect-passwords.js',
    'show-activity-logs.js',
    'show-admin-columns.js',
    'show-refresh-metadata.js',
  ],
  'auth': [
    'hash-user-if-plain.js',
    'rehash-plaintext-passwords.js',
    'rehash-single.js',
    'reset-password.js',
    'test-auth.js',
    'test-auth.ps1',
    'test-decode-token.js',
    'test-refresh-create.js',
    'verify-customer.js',
    'verify-login-cli.js',
  ],
  'test': [
    'create_test_customer.js',
    'quick-e2e.js',
    'test-prisma-connect.js',
  ],
};

let moved = 0;
let skipped = 0;

for (const [folder, files] of Object.entries(mapping)) {
  const destDir = path.join(SCRIPTS_DIR, folder);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    console.log(`  📁 Created ${folder}/`);
  }

  for (const file of files) {
    const src = path.join(SCRIPTS_DIR, file);
    const dest = path.join(destDir, file);

    if (!fs.existsSync(src)) {
      console.log(`  ⏭  ${file} — already moved or missing`);
      skipped++;
      continue;
    }

    fs.renameSync(src, dest);
    console.log(`  ✅ ${file} → ${folder}/${file}`);
    moved++;
  }
}

console.log(`\nDone — moved ${moved}, skipped ${skipped}`);

// ── Update references in package.json and .husky/pre-commit ──
const projectRoot = path.resolve(SCRIPTS_DIR, '..');

const pathUpdates = [
  {
    file: path.join(projectRoot, 'package.json'),
    replacements: [
      ['./scripts/check-database.js', './scripts/build/check-database.js'],
      ['./scripts/prisma-safe-generate.js', './scripts/build/prisma-safe-generate.js'],
    ],
  },
  {
    file: path.join(projectRoot, '.husky', 'pre-commit'),
    replacements: [
      ['scripts/prevent-commit-secrets.js', 'scripts/build/prevent-commit-secrets.js'],
    ],
  },
  {
    file: path.join(SCRIPTS_DIR, 'build', 'build-with-dotenv.js'),
    replacements: [
      ['./scripts/check-database.js', './scripts/build/check-database.js'],
    ],
  },
];

let updated = 0;
for (const { file, replacements } of pathUpdates) {
  if (!fs.existsSync(file)) {
    console.log(`  ⚠️  ${path.relative(projectRoot, file)} not found, skipping`);
    continue;
  }
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
      changed = true;
      updated++;
      console.log(`  🔗 ${path.relative(projectRoot, file)}: "${from}" → "${to}"`);
    }
  }
  if (changed) fs.writeFileSync(file, content, 'utf8');
}

console.log(`\nUpdated ${updated} reference(s).`);
console.log('You can safely delete this script: rm scripts/reorganize.js');
