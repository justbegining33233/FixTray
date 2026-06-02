const { PrismaClient } = require('../node_modules/.prisma/client');
const p = new PrismaClient();

async function main() {
  const admins = await p.admin.findMany({ select: { id: true, username: true, email: true, isSuperAdmin: true } });
  console.log('=== ADMINS ===');
  console.log(JSON.stringify(admins, null, 2));

  const shops = await p.shop.findMany({ select: { id: true, username: true, shopName: true, email: true, status: true } });
  console.log('\n=== SHOPS ===');
  console.log(JSON.stringify(shops, null, 2));

  const techs = await p.tech.findMany({ select: { id: true, email: true, firstName: true, lastName: true, role: true, shopId: true } });
  console.log('\n=== TECHS ===');
  console.log(JSON.stringify(techs, null, 2));

  const customers = await p.customer.findMany({ select: { id: true, email: true, firstName: true, lastName: true, username: true } });
  console.log('\n=== CUSTOMERS ===');
  console.log(JSON.stringify(customers, null, 2));

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
