#!/usr/bin/env node
/**
 * admin-inspect.js — Comprehensive admin account inspection tool
 *
 * Replaces: check_admin.js, check-admin.js, check-admin-pw.js,
 *           inspect-admin.js, inspect-admin-hash.js
 *
 * Usage:
 *   node scripts/admin-inspect.js
 *     -- look up default admin (admin1006), show full record
 *
 *   node scripts/admin-inspect.js --username <username>
 *     -- look up a specific admin by username
 *
 *   node scripts/admin-inspect.js --username <username> --password <plaintext>
 *     -- also bcrypt-compare the provided plaintext password against the stored hash
 *
 *   node scripts/admin-inspect.js --username <username> --compareHash "$2a$..."
 *     -- compare the stored hash string against a known hash (string equality + char codes)
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const argv = require('minimist')(process.argv.slice(2));
const username     = argv.username || argv.u || 'admin1006';
const plainPw      = argv.password || argv.p;
const compareHash  = argv.compareHash || argv.c;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: Set DATABASE_URL before running this script.');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    await prisma.$connect();

    // ── Fetch record ──────────────────────────────────────────────────────────
    const admin = await prisma.admin.findUnique({
      where: { username },
      select: { id: true, username: true, password: true, email: true },
    });

    if (!admin) {
      console.error(`Admin not found: "${username}"`);
      process.exit(1);
    }

    // ── Basic record ─────────────────────────────────────────────────────────
    console.log('\n─── Admin record ─────────────────────────────────────────────');
    console.log(JSON.stringify({ id: admin.id, username: admin.username, email: admin.email }, null, 2));

    // ── Hash details ─────────────────────────────────────────────────────────
    const stored = admin.password || '';
    console.log('\n─── Password hash ────────────────────────────────────────────');
    console.log('Exists :', !!stored);
    console.log('Length :', stored.length);
    console.log('Preview:', stored.slice(0, 40) + (stored.length > 40 ? '...' : ''));
    console.log('Is bcrypt ($2a/$2b):', /^\$2[ab]\$/.test(stored));

    // char-code diagnostic for first/last 60 chars (useful for encoding issues)
    if (stored.length > 0) {
      const head = stored.slice(0, 60);
      const tail = stored.slice(-60);
      console.log('Head codes:', head.split('').map(c => c.charCodeAt(0)).join(','));
      if (stored.length > 60) {
        console.log('Tail codes:', tail.split('').map(c => c.charCodeAt(0)).join(','));
      }
    }

    // ── Plaintext password comparison ─────────────────────────────────────────
    if (plainPw) {
      const bcrypt = require('bcrypt');
      console.log('\n─── Password check ───────────────────────────────────────────');
      const match = await bcrypt.compare(plainPw, stored);
      console.log('Plaintext matches stored hash:', match);
    }

    // ── Hash string comparison ────────────────────────────────────────────────
    if (compareHash) {
      console.log('\n─── Hash string comparison ───────────────────────────────────');
      console.log('Provided (raw) :', compareHash);
      console.log('Provided length:', compareHash.length);
      console.log('Strings equal  :', stored === compareHash);
      const provided = compareHash.slice(0, 60);
      console.log('Provided head codes:', provided.split('').map(c => c.charCodeAt(0)).join(','));
    }

    console.log('');
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

main();
