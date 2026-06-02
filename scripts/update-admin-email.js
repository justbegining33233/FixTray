// One-time script: update admin email
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const username = process.argv[2];
  const email = process.argv[3];
  if (!username || !email) {
    console.error('Usage: node scripts/update-admin-email.js <username> <email>');
    process.exit(1);
  }
  const updated = await prisma.admin.update({
    where: { username },
    data: { email },
  });
  console.log('Done. Username:', updated.username, '| Email:', updated.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
