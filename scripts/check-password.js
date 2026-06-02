const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

(async () => {
  try {
    const shop = await prisma.shop.findUnique({ where: { username: 'shopowner1' }, select: { id: true, username: true, password: true } });
    console.log('Found shop:', shop.username, 'hash:', shop.password.substring(0, 30) + '...');
    const match123 = await bcrypt.compare('Test1234!', shop.password);
    const matchOld = await bcrypt.compare('password123', shop.password);
    console.log('Test1234! matches:', match123);
    console.log('password123 matches:', matchOld);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
