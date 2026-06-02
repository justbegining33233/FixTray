const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check QA Test Shop subscription
  const sub = await prisma.subscription.findUnique({ where: { shopId: 'cmpamglu40002lf1ukstqqi0l' } });
  console.log('QA Test Shop existing sub:', sub);

  if (!sub) {
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const created = await prisma.subscription.create({
      data: {
        shopId: 'cmpamglu40002lf1ukstqqi0l',
        plan: 'pro',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        maxUsers: 10,
        maxShops: 5,
        cancelAtPeriodEnd: false
      }
    });
    console.log('Created Pro subscription for QA Test Shop:', created.id, created.plan, created.status);
  } else {
    console.log('QA Test Shop already has a subscription');
  }

  // Fix QA Test Shop approvedAt if missing
  const qaShop = await prisma.shop.findUnique({
    where: { id: 'cmpamglu40002lf1ukstqqi0l' },
    select: { id: true, shopName: true, status: true, approvedAt: true }
  });
  console.log('QA Test Shop before fix:', qaShop);

  if (!qaShop.approvedAt) {
    const updated = await prisma.shop.update({
      where: { id: 'cmpamglu40002lf1ukstqqi0l' },
      data: { approvedAt: new Date() }
    });
    console.log('Fixed approvedAt:', updated.approvedAt);
  }

  // Verify Demo Auto Shop
  const demoShop = await prisma.shop.findUnique({
    where: { id: 'cmop4a77v0000votq68yyyw91' },
    select: { id: true, shopName: true, status: true, approvedAt: true }
  });
  const demoSub = await prisma.subscription.findUnique({ where: { shopId: 'cmop4a77v0000votq68yyyw91' } });
  console.log('Demo Auto Shop:', demoShop.shopName, '| status:', demoShop.status, '| approvedAt:', demoShop.approvedAt);
  console.log('Demo Auto Shop subscription:', demoSub ? demoSub.plan + ' / ' + demoSub.status : 'NONE');
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
