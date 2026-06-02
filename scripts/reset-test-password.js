const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

(async () => {
  try {
    const hash = await bcrypt.hash('Test1234!', 10);
    const r = await prisma.shop.update({ where: { username: 'shopowner1' }, data: { password: hash } });
    console.log('Updated:', r.username, r.shopName);
    console.log('Password: Test1234!');
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
