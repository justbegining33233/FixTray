import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getConfiguredPlatformServiceFeeUsd, getPlatformServiceFeeUsd } from '@/lib/platformFee';
import { customerSeesPayButton, type ConnectAccountSnapshot } from '@/lib/customerCardPay';
import { cardPaymentOfferForShop } from '@/lib/customerCardPayServer';
import { customerChargeDisplay, customerLedgerSummary, isPaidRecord } from '@/lib/customerLedger';
import { frozenCustomerFeeUsd } from '@/lib/feeSnapshot';
import { quoteAmount } from '@/lib/workOrderCloseout';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload || payload.role !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerId = payload.id;

    // Fetch all work orders for this customer that have an estimate or payment
    const workOrders = await prisma.workOrder.findMany({
      where: {
        customerId,
        OR: [
          { paymentStatus: 'paid' },
          { status: 'waiting-for-payment' },
          { estimatedCost: { not: null } },
        ],
      },
      include: {
        shop: {
          select: { shopName: true, address: true, phone: true, stripeAccountId: true },
        },
        vehicle: {
          select: { make: true, model: true, year: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const fixtrayFee = (await getPlatformServiceFeeUsd()) ?? 0;
    const configuredFee = await getConfiguredPlatformServiceFeeUsd();
    const accountCache = new Map<string, ConnectAccountSnapshot | null>();

    const ledgerOrders = workOrders.map((wo) => {
      const quote = quoteAmount(wo);
      const frozen = frozenCustomerFeeUsd(wo.completion, quote);
      if (frozen == null) return wo;
      return { ...wo, estimatedCost: quote, frozenCustomerFeeUsd: frozen };
    });

    const payments = await Promise.all(ledgerOrders.map(async (wo) => {
      // Paid rows use the recorded charge. Open invoices use the checkout snapshot when one exists.
      const charge = customerChargeDisplay(wo, fixtrayFee);

      const offer = await cardPaymentOfferForShop(wo.shop?.stripeAccountId, {
        serviceFeeUsd: configuredFee,
        cache: accountCache,
      });
      const invoiceOpen = customerSeesPayButton({
        paymentStatus: wo.paymentStatus,
        status: wo.status,
        totalDue: charge.amount,
        cardPaymentAvailable: true,
      });
      return {
        id: wo.id,
        status: isPaidRecord(wo) ? 'Paid' : 'Pending',
        workOrderStatus: wo.status,
        amount: charge.amount,
        serviceCost: charge.serviceCost,
        fixtrayFee: charge.fixtrayFee,
        amountPaid: wo.amountPaid || 0,
        service: wo.issueDescription || 'Vehicle Service',
        shop: wo.shop?.shopName || 'Unknown Shop',
        shopAddress: wo.shop?.address || '',
        vehicle: wo.vehicle
          ? `${wo.vehicle.year} ${wo.vehicle.make} ${wo.vehicle.model}`
          : 'Unknown Vehicle',
        date: wo.createdAt.toISOString(),
        paidAt: wo.updatedAt.toISOString(),
        canPay: invoiceOpen && offer.available,
        cardPaymentMessage: invoiceOpen && !offer.available ? offer.message : null,
      };
    }));

    const ledger = customerLedgerSummary(ledgerOrders, fixtrayFee);

    return NextResponse.json({
      success: true,
      payments,
      summary: {
        totalPaid: ledger.totalPaid,
        totalPending: ledger.totalPending,
        paidCount: ledger.paidCount,
        pendingCount: ledger.pendingCount,
      },
    });
  } catch (error) {
    console.error('Customer payments error:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}
