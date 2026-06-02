/**
 * seed-qa-users.js
 * Creates one test account for every role so QA can log in as each.
 * Run: node scripts/seed-qa-users.js
 * Credentials are also written to: qa-test-credentials.txt
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const PASSWORD = 'QATest2026!';
const SALT_ROUNDS = 12;

const creds = [];

async function upsertAdmin(username, email, isSuperAdmin) {
  const hashed = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  const existing = await prisma.admin.findUnique({ where: { username } });
  if (existing) {
    console.log(`  [SKIP] Admin already exists: ${username}`);
  } else {
    await prisma.admin.create({ data: { username, email, password: hashed, isSuperAdmin } });
    console.log(`  [OK]   Created admin: ${username} (superadmin=${isSuperAdmin})`);
  }
  creds.push({ role: isSuperAdmin ? 'Superadmin' : 'Admin', loginUrl: 'https://fixtray.app/admin/login', username, password: PASSWORD, email });
}

async function upsertShop() {
  const username = 'qa_shop';
  const email = 'qa_shop@fixtray-qa.com';
  const hashed = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  let shop = await prisma.shop.findUnique({ where: { username } });
  if (shop) {
    console.log(`  [SKIP] Shop already exists: ${username}`);
  } else {
    shop = await prisma.shop.create({
      data: {
        username,
        email,
        password: hashed,
        shopName: 'QA Test Shop',
        ownerName: 'QA Owner',
        phone: '5550001234',
        zipCode: '90210',
        address: '123 QA Street',
        city: 'Testville',
        state: 'CA',
        status: 'approved',
        profileComplete: true,
      },
    });
    console.log(`  [OK]   Created shop: ${username}`);
  }
  creds.push({ role: 'Shop Owner', loginUrl: 'https://fixtray.app/shop/login', username, password: PASSWORD, email });
  return shop.id;
}

async function upsertTech(shopId, roleLabel, firstName, lastName, emailAddr) {
  const hashed = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  const existing = await prisma.tech.findUnique({ where: { email: emailAddr } });
  if (existing) {
    console.log(`  [SKIP] Tech already exists: ${emailAddr}`);
  } else {
    await prisma.tech.create({
      data: {
        shopId,
        email: emailAddr,
        password: hashed,
        firstName,
        lastName,
        role: roleLabel.toLowerCase(), // 'tech' or 'manager'
        available: true,
      },
    });
    console.log(`  [OK]   Created ${roleLabel}: ${emailAddr}`);
  }
  creds.push({ role: roleLabel, loginUrl: 'https://fixtray.app/tech/login', username: emailAddr, password: PASSWORD, email: emailAddr });
}

async function upsertCustomer() {
  const email = 'qa_customer@fixtray-qa.com';
  const hashed = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    console.log(`  [SKIP] Customer already exists: ${email}`);
  } else {
    await prisma.customer.create({
      data: {
        email,
        password: hashed,
        firstName: 'QA',
        lastName: 'Customer',
        emailVerified: true,
      },
    });
    console.log(`  [OK]   Created customer: ${email}`);
  }
  creds.push({ role: 'Customer', loginUrl: 'https://fixtray.app/auth/login', username: email, password: PASSWORD, email });
}

async function main() {
  console.log('\n=== FixTray QA User Seed ===\n');

  await upsertAdmin('qa_admin',      'qa_admin@fixtray-qa.com',      false);
  await upsertAdmin('qa_superadmin', 'qa_superadmin@fixtray-qa.com', true);

  const shopId = await upsertShop();

  await upsertTech(shopId, 'Tech',    'QA',   'Technician', 'qa_tech@fixtray-qa.com');
  await upsertTech(shopId, 'Manager', 'QA',   'Manager',    'qa_manager@fixtray-qa.com');

  await upsertCustomer();

  // Write credentials file
  const lines = [
    '============================================================',
    '  FixTray QA Test Credentials',
    `  Generated: ${new Date().toLocaleString()}`,
    '============================================================',
    '',
    ...creds.map(c => [
      `Role       : ${c.role}`,
      `Login URL  : ${c.loginUrl}`,
      `Username   : ${c.username}`,
      `Password   : ${c.password}`,
      '',
    ].join('\n')),
    '============================================================',
  ];

  const outPath = path.join(__dirname, '..', 'qa-test-credentials.txt');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('\n=== Credentials saved to: qa-test-credentials.txt ===\n');
  console.log(lines.join('\n'));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
