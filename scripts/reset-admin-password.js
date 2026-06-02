// One-time script: reset admin password
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const username = process.argv[2];
  const newPassword = process.argv[3];
  if (!username || !newPassword) {
    console.error('Usage: node scripts/reset-admin-password.js <username> <newPassword>');
    process.exit(1);
  }
  const hash = await bcrypt.hash(newPassword, 12);
  const updated = await prisma.admin.update({
    where: { username },
    data: { password: hash },
  });
  console.log('Password reset for:', updated.username);
}

main().catch(console.error).finally(() => prisma.$disconnect());
