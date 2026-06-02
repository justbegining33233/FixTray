import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendSms } from '@/lib/smsService';
import { sendEmail } from '@/lib/emailService';

// Cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

function verifyCron(request: NextRequest): boolean {
  // In production, CRON_SECRET is required
  if (!CRON_SECRET) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) return false;
    return true; // Allow in local dev only
  }
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${CRON_SECRET}`;
}

function fillTemplate(template: string, values: Record<string, string | number | null | undefined>) {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = values[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, '');
}

export async function GET(request: NextRequest) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, any> = {};
  const now = new Date();

  // ─── 1. Appointment Reminders (24h before) ───
  try {
    const reminderWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const reminderStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);

    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        scheduledDate: { gte: reminderStart, lte: reminderWindow },
        status: { in: ['scheduled', 'confirmed'] },
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        shop: { select: { shopName: true, phone: true } },
      },
    });

    // Create in-app notifications for upcoming appointments
    let reminderCount = 0;
    for (const appt of upcomingAppointments) {
      // Check if reminder already sent
      const existing = await prisma.notification.findFirst({
        where: {
          customerId: appt.customerId,
          type: 'appointment_reminder',
          appointmentId: appt.id,
        },
      });
      if (existing) continue;

      await prisma.notification.create({
        data: {
          customerId: appt.customerId,
          type: 'appointment_reminder',
          title: 'Upcoming Appointment',
          message: `Reminder: You have an appointment at ${appt.shop.shopName} tomorrow for ${appt.serviceType}.`,
          appointmentId: appt.id,
          deliveryMethod: 'in-app,sms',
        },
      });

      // Send SMS reminder
      if (appt.customer.phone) {
        const dateStr = new Date(appt.scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        sendSms(
          appt.customer.phone,
          `FixTray: Reminder — your appointment at ${appt.shop.shopName} is tomorrow (${dateStr}) for ${appt.serviceType}. Reply HELP for info.`
        ).catch(() => {});
      }

      reminderCount++;
    }
    results.appointmentReminders = { sent: reminderCount, checked: upcomingAppointments.length };
  } catch (error) {
    console.error('Appointment reminders error:', error);
    results.appointmentReminders = { error: 'Failed' };
  }

  // ─── 2. Low Stock Alerts ───
  try {
    const lowStockItems = await prisma.inventoryItem.findMany({
      where: {
        reorderPoint: { not: null },
        type: 'part',
      },
      include: {
        shop: { select: { id: true, shopName: true, email: true } },
      },
    });

    // Filter items where quantity <= reorderPoint
    const needsReorder = lowStockItems.filter(item => item.quantity <= (item.reorderPoint ?? 0));

    // Group by shop
    const byShop: Record<string, { shopName: string; items: string[] }> = {};
    for (const item of needsReorder) {
      if (!byShop[item.shopId]) {
        byShop[item.shopId] = { shopName: item.shop.shopName, items: [] };
      }
      byShop[item.shopId].items.push(`${item.name} (${item.quantity} left, reorder at ${item.reorderPoint})`);
    }

    // Create notifications for each shop (once per day — check existing)
    let alertCount = 0;
    const todayStr = now.toISOString().split('T')[0];
    for (const [shopId, data] of Object.entries(byShop)) {
      // Low stock alerts go to the first customer associated with the shop, or skip
      // Since Notification requires customerId, we create a log instead
      // For shop-facing alerts, we check if there's a recent one
      const existing = await prisma.notification.findFirst({
        where: {
          type: 'low_stock_alert',
          createdAt: { gte: new Date(todayStr) },
          metadata: { contains: shopId },
        },
      });
      if (existing) continue;

      // Find the shop owner (first tech or use a placeholder)
      // Store as metadata since this is a shop-facing notification
      const shopCustomers = await prisma.workOrder.findFirst({
        where: { shopId },
        select: { customerId: true },
      });
      if (!shopCustomers) continue;

      await prisma.notification.create({
        data: {
          customerId: shopCustomers.customerId,
          type: 'low_stock_alert',
          title: 'Low Stock Alert',
          message: `${data.items.length} item(s) are at or below reorder point: ${data.items.slice(0, 3).join(', ')}${data.items.length > 3 ? ` and ${data.items.length - 3} more` : ''}.`,
          deliveryMethod: 'in-app',
          metadata: JSON.stringify({ shopId, shopName: data.shopName }),
        },
      });
      alertCount++;
    }
    results.lowStockAlerts = { shopsNotified: alertCount, totalLowItems: needsReorder.length };
  } catch (error) {
    console.error('Low stock alerts error:', error);
    results.lowStockAlerts = { error: 'Failed' };
  }

  // ─── 3. Recurring Work Order Generation ───
  try {
    const dueRecurring = await prisma.recurringWorkOrder.findMany({
      where: {
        active: true,
        nextRunAt: { lte: now },
      },
      include: {
        shop: { select: { id: true, shopName: true } },
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });

    let createdCount = 0;
    for (const rec of dueRecurring) {
      // Create the work order
      await prisma.workOrder.create({
        data: {
          customerId: rec.customerId,
          shopId: rec.shopId,
          vehicleId: rec.vehicleId,
          vehicleType: rec.vehicleType || 'Standard',
          serviceLocation: 'in-shop',
          issueDescription: rec.title || rec.issueDescription || 'Recurring Service',
          status: rec.requiresApproval ? 'pending' : 'assigned',
          estimatedCost: rec.estimatedCost,
        },
      });

      // SMS notification for recurring work order created
      if (rec.customer.phone) {
        sendSms(
          rec.customer.phone,
          `FixTray: Your recurring service "${rec.title || 'Scheduled Maintenance'}" at ${rec.shop.shopName} has been created. Log in at fixtray.app/customer to review.`
        ).catch(() => {});
      }

      // Calculate next run date
      const nextRun = new Date(rec.nextRunAt!);
      switch (rec.frequency) {
        case 'weekly': nextRun.setDate(nextRun.getDate() + 7); break;
        case 'biweekly': nextRun.setDate(nextRun.getDate() + 14); break;
        case 'monthly': nextRun.setMonth(nextRun.getMonth() + 1); break;
        case 'quarterly': nextRun.setMonth(nextRun.getMonth() + 3); break;
        case 'annually': nextRun.setFullYear(nextRun.getFullYear() + 1); break;
        default: nextRun.setMonth(nextRun.getMonth() + 1);
      }

      await prisma.recurringWorkOrder.update({
        where: { id: rec.id },
        data: {
          lastRunAt: now,
          nextRunAt: nextRun,
        },
      });

      createdCount++;
    }
    results.recurringWorkOrders = { created: createdCount, checked: dueRecurring.length };
  } catch (error) {
    console.error('Recurring work orders error:', error);
    results.recurringWorkOrders = { error: 'Failed' };
  }

  // ─── 4. Custom Automation Rules Execution ───
  try {
    const activeRules = await prisma.automationRule.findMany({
      where: { active: true },
      include: {
        Shop: {
          select: {
            id: true,
            shopName: true,
          },
        },
      },
    });

    let ruleChecks = 0;
    let messagesSent = 0;
    let messagesFailed = 0;

    for (const rule of activeRules) {
      ruleChecks++;
      const triggerValue = Number(rule.triggerValue || 0);

      if (rule.type === 'appointment_reminder') {
        let targetTime = now;
        if (rule.trigger === 'days_before_appointment') {
          targetTime = new Date(now.getTime() + triggerValue * 24 * 60 * 60 * 1000);
        } else if (rule.trigger === 'hours_before_appointment') {
          targetTime = new Date(now.getTime() + triggerValue * 60 * 60 * 1000);
        } else {
          continue;
        }

        const windowStart = new Date(targetTime.getTime() - 30 * 60 * 1000);
        const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);

        const appointments = await prisma.appointment.findMany({
          where: {
            shopId: rule.shopId,
            status: { in: ['scheduled', 'confirmed'] },
            scheduledDate: { gte: windowStart, lte: windowEnd },
          },
          include: {
            customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            vehicle: { select: { year: true, make: true, model: true } },
          },
        });

        for (const appt of appointments) {
          const already = await prisma.automationExecution.findFirst({
            where: {
              ruleId: rule.id,
              customerId: appt.customer.id,
              channel: rule.channel,
              sentAt: { gte: new Date(now.getTime() - 20 * 60 * 60 * 1000) },
            },
          });
          if (already) continue;

          const customerName = [appt.customer.firstName, appt.customer.lastName].filter(Boolean).join(' ').trim() || 'Customer';
          const vehicle = appt.vehicle ? `${appt.vehicle.year || ''} ${appt.vehicle.make || ''} ${appt.vehicle.model || ''}`.replace(/\s+/g, ' ').trim() : 'your vehicle';
          const message = fillTemplate(rule.messageTemplate, {
            customer_name: customerName,
            vehicle,
            shop_name: rule.Shop.shopName,
            appointment_date: new Date(appt.scheduledDate).toLocaleDateString(),
            appointment_time: new Date(appt.scheduledDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          });

          const subject = `${rule.Shop.shopName} Appointment Reminder`;
          let sent = true;

          if (rule.channel === 'sms' || rule.channel === 'both') {
            if (appt.customer.phone) {
              const smsSent = await sendSms(appt.customer.phone, stripHtml(message).slice(0, 320));
              sent = sent && smsSent;
            } else {
              sent = false;
            }
          }

          if (rule.channel === 'email' || rule.channel === 'both') {
            if (appt.customer.email) {
              const emailSent = await sendEmail({ to: appt.customer.email, subject, html: `<p>${message}</p>` });
              sent = sent && emailSent;
            } else {
              sent = false;
            }
          }

          await prisma.automationExecution.create({
            data: {
              ruleId: rule.id,
              customerId: appt.customer.id,
              channel: rule.channel,
              status: sent ? 'sent' : 'failed',
            },
          });

          if (sent) messagesSent++;
          else messagesFailed++;
        }
      }

      if (rule.type === 'follow_up' || rule.type === 'review_request') {
        if (rule.trigger !== 'days_after_completion') continue;

        const targetStart = new Date(now.getTime() - (triggerValue + 1) * 24 * 60 * 60 * 1000);
        const targetEnd = new Date(now.getTime() - triggerValue * 24 * 60 * 60 * 1000);

        const completedOrders = await prisma.workOrder.findMany({
          where: {
            shopId: rule.shopId,
            status: { in: ['closed', 'completed'] },
            updatedAt: { gte: targetStart, lte: targetEnd },
          },
          include: {
            customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            vehicle: { select: { year: true, make: true, model: true } },
          },
        });

        for (const wo of completedOrders) {
          const already = await prisma.automationExecution.findFirst({
            where: {
              ruleId: rule.id,
              customerId: wo.customerId,
              workOrderId: wo.id,
              channel: rule.channel,
            },
          });
          if (already) continue;

          const customerName = [wo.customer.firstName, wo.customer.lastName].filter(Boolean).join(' ').trim() || 'Customer';
          const vehicle = wo.vehicle ? `${wo.vehicle.year || ''} ${wo.vehicle.make || ''} ${wo.vehicle.model || ''}`.replace(/\s+/g, ' ').trim() : 'your vehicle';
          const message = fillTemplate(rule.messageTemplate, {
            customer_name: customerName,
            vehicle,
            shop_name: rule.Shop.shopName,
            review_link: `${process.env.NEXT_PUBLIC_APP_URL || 'https://fixtray.app'}/shop/reviews`,
          });

          const subject = rule.type === 'review_request'
            ? `${rule.Shop.shopName} - How did we do?`
            : `${rule.Shop.shopName} Follow-up`;

          let sent = true;
          if (rule.channel === 'sms' || rule.channel === 'both') {
            if (wo.customer.phone) {
              const smsSent = await sendSms(wo.customer.phone, stripHtml(message).slice(0, 320));
              sent = sent && smsSent;
            } else {
              sent = false;
            }
          }

          if (rule.channel === 'email' || rule.channel === 'both') {
            if (wo.customer.email) {
              const emailSent = await sendEmail({ to: wo.customer.email, subject, html: `<p>${message}</p>` });
              sent = sent && emailSent;
            } else {
              sent = false;
            }
          }

          await prisma.automationExecution.create({
            data: {
              ruleId: rule.id,
              customerId: wo.customerId,
              workOrderId: wo.id,
              channel: rule.channel,
              status: sent ? 'sent' : 'failed',
            },
          });

          if (sent) messagesSent++;
          else messagesFailed++;
        }
      }

      if (rule.type === 'overdue_invoice') {
        if (rule.trigger !== 'invoice_overdue_days') continue;

        const overdueCutoff = new Date(now.getTime() - triggerValue * 24 * 60 * 60 * 1000);
        const overdueOrders = await prisma.workOrder.findMany({
          where: {
            shopId: rule.shopId,
            status: 'waiting-for-payment',
            updatedAt: { lte: overdueCutoff },
          },
          include: {
            customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        });

        for (const wo of overdueOrders) {
          const already = await prisma.automationExecution.findFirst({
            where: {
              ruleId: rule.id,
              customerId: wo.customerId,
              workOrderId: wo.id,
              channel: rule.channel,
            },
          });
          if (already) continue;

          const customerName = [wo.customer.firstName, wo.customer.lastName].filter(Boolean).join(' ').trim() || 'Customer';
          const message = fillTemplate(rule.messageTemplate, {
            customer_name: customerName,
            shop_name: rule.Shop.shopName,
            amount_due: Math.max(0, (wo.estimatedCost || 0) - (wo.amountPaid || 0)),
          });

          const subject = `${rule.Shop.shopName} Payment Reminder`;
          let sent = true;
          if (rule.channel === 'sms' || rule.channel === 'both') {
            if (wo.customer.phone) {
              const smsSent = await sendSms(wo.customer.phone, stripHtml(message).slice(0, 320));
              sent = sent && smsSent;
            } else {
              sent = false;
            }
          }

          if (rule.channel === 'email' || rule.channel === 'both') {
            if (wo.customer.email) {
              const emailSent = await sendEmail({ to: wo.customer.email, subject, html: `<p>${message}</p>` });
              sent = sent && emailSent;
            } else {
              sent = false;
            }
          }

          await prisma.automationExecution.create({
            data: {
              ruleId: rule.id,
              customerId: wo.customerId,
              workOrderId: wo.id,
              channel: rule.channel,
              status: sent ? 'sent' : 'failed',
            },
          });

          if (sent) messagesSent++;
          else messagesFailed++;
        }
      }
    }

    results.customAutomations = {
      rulesChecked: ruleChecks,
      sent: messagesSent,
      failed: messagesFailed,
    };
  } catch (error) {
    console.error('Custom automations error:', error);
    results.customAutomations = { error: 'Failed' };
  }

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    results,
  });
}
