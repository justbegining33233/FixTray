#!/usr/bin/env node
/**
 * password-tools.js — Comprehensive password inspection and repair utility
 *
 * Replaces: hash-user-if-plain.js, inspect-passwords.js, fix-shop-passwords.js
 *
 * Commands:
 *
 *   inspect   Show password hash preview for Admin, Tech, Shop, and Customer tables
 *     node scripts/password-tools.js inspect [--take <n>]
 *
 *   hash      Bcrypt-hash a plaintext password stored on a single record (safe to re-run:
 *             skips records that are already hashed)
 *     node scripts/password-tools.js hash --model <Admin|Tech|Shop|Customer>
 *                                          (--id <id> | --username <u> | --email <e>)
 *                                          [--password <plaintext>]
 *             If --password is omitted the CURRENT stored value is used as the plaintext.
 *
 *   fix-shops  Set a password for all approved shops that currently have none
 *     node scripts/password-tools.js fix-shops --password <newPassword>
 *       or: SHOP_DEFAULT_PASSWORD=xxx node scripts/password-tools.js fix-shops
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const argv    = require('minimist')(process.argv.slice(2));
const command = argv._[0];
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

function usage(msg) {
  if (msg) console.error('ERROR:', msg);
  console.log(`
Usage:
  node scripts/password-tools.js inspect [--take <n>]
  node scripts/password-tools.js hash --model <Admin|Tech|Shop|Customer>
                                       (--id <id> | --username <u> | --email <e>)
                                       [--password <plaintext>]
  node scripts/password-tools.js fix-shops [--password <newPassword>]
`);
  process.exit(2);
}

// ── inspect ───────────────────────────────────────────────────────────────────

async function inspect(prisma) {
  const take = parseInt(argv.take || '5', 10);

  async function showTable(label, records) {
    console.log(`\n── ${label} (${records.length}) ──────────────────────────────────`);
    records.forEach(r => {
      const identifier = r.username || r.email || r.id;
      const preview    = (r.password || '').slice(0, 40);
      const isHashed   = /^\$2[ab]\$/.test(r.password || '');
      console.log(`  ${r.id}  ${identifier}  ${preview}${r.password?.length > 40 ? '…' : ''}  [${isHashed ? 'bcrypt' : 'PLAIN?'}]`);
    });
  }

  await showTable('Admins', await prisma.admin.findMany({
    take, select: { id: true, username: true, password: true },
  }));
  await showTable('Techs', await prisma.tech.findMany({
    take, select: { id: true, email: true, password: true },
  }));
  await showTable('Shops', await prisma.shop.findMany({
    take, select: { id: true, email: true, password: true },
  }));
  await showTable('Customers', await prisma.customer.findMany({
    take, select: { id: true, email: true, password: true },
  }));
}

// ── hash ──────────────────────────────────────────────────────────────────────

async function hashRecord(prisma) {
  const modelName = argv.model || argv.m;
  if (!modelName) usage('--model is required');

  const modelKey    = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  const modelClient = prisma[modelKey];
  if (!modelClient) usage(`Unknown model: "${modelName}". Try Admin, Tech, Shop, or Customer.`);

  const id       = argv.id;
  const username = argv.username;
  const email    = argv.email;
  if (!id && !username && !email) usage('Provide --id, --username, or --email to identify the record.');

  const where = id       ? { id: String(id) }
              : username ? { username: String(username) }
              :            { email: String(email) };

  const record = await modelClient.findUnique({ where, select: { id: true, password: true } });
  if (!record) {
    console.error('No record found for', JSON.stringify(where));
    process.exit(1);
  }

  const plaintext = argv.password || argv.p || record.password || '';

  if (/^\$2[ab]\$/.test(plaintext)) {
    console.log('Password is already bcrypt-hashed for', JSON.stringify(where), '— skipping.');
    return;
  }

  if (!plaintext) {
    console.error('No password to hash: record has no password and --password was not provided.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(plaintext, BCRYPT_ROUNDS);
  await modelClient.update({ where, data: { password: hash } });
  console.log('Hashed password for', JSON.stringify(where));
}

// ── fix-shops ─────────────────────────────────────────────────────────────────

async function fixShops(prisma) {
  const newPassword = argv.password || argv.p || process.env.SHOP_DEFAULT_PASSWORD;
  if (!newPassword) {
    usage('--password <newPassword> or SHOP_DEFAULT_PASSWORD env var is required');
  }

  const shops = await prisma.shop.findMany({ where: { status: 'approved' } });
  const missing = shops.filter(s => !s.password);

  if (missing.length === 0) {
    console.log('All approved shops already have passwords — nothing to do.');
    return;
  }

  console.log(`Found ${missing.length} approved shop(s) without a password:`);
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  for (const shop of missing) {
    await prisma.shop.update({ where: { id: shop.id }, data: { password: hash } });
    console.log(`  Set password for: ${shop.shopName} (${shop.email}, ID: ${shop.id})`);
  }

  console.log('\nDone. Remind shops to change their password after first login.');
}

// ── entry point ───────────────────────────────────────────────────────────────

async function main() {
  if (!command) usage('A command is required: inspect | hash | fix-shops');

  if (!process.env.DATABASE_URL) {
    console.error('ERROR: Set DATABASE_URL before running this script.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();

    switch (command) {
      case 'inspect':    await inspect(prisma);     break;
      case 'hash':       await hashRecord(prisma);  break;
      case 'fix-shops':  await fixShops(prisma);    break;
      default:           usage(`Unknown command: "${command}"`);
    }
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main();
