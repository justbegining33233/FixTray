import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { AuthUser } from '@/lib/auth';
import { sendSms } from '@/lib/smsService';
import { findUnconfiguredShopServices } from '@/lib/shopServiceValidation';
import { hasAppointmentVehicle, isScheduledDateInPast, appointmentStatusUpdates } from '@/lib/appointmentValidation';
import { locationShareIsLive } from '@/lib/customerJobTracking';
import { isRoadsideLocation } from '@/lib/waitingRoomBoard';

async function reconcileAppointmentStatuses<T extends {
  id: string;
  status?: string | null;
  scheduledDate?: Date | string | null;
}>(appointments: T[]): Promise<T[]> {
  const updates = appointmentStatusUpdates(appointments);
  if (updates.length === 0) return appointments;
  await Promise.all(updates.map((update) => prisma.appointment.update({
    where: { id: update.id },
    data: { status: update.status },
  }).catch((error) => {
    console.error('Appointment status reconcile error:', error);
  })));
  const statusById = new Map(updates.map((update) => [update.id, update.status]));
  return appointments.map((row) => {
    const status = statusById.get(row.id);
    return status ? { ...row, status } : row;
  });
}

type AppointmentMatch = {
  id: string;
  customerId?: string | null;
  shopId?: string | null;
  vehicleId?: string | null;
  scheduledDate?: Date | string | null;
  serviceType?: string | null;
  createdAt?: Date | string | null;
};

type WorkOrderMatch = {
  id: string;
  customerId: string;
  shopId: string;
  vehicleId: string | null;
  serviceLocation: string | null;
  dueDate: Date | null;
  createdAt: Date;
  issueDescription: string;
  location: unknown;
  tracking: { updatedAt: Date } | null;
};

function timeMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function isAppointmentWorkOrder(order: { issueDescription?: string | null; location?: unknown }): boolean {
  const location = order.location;
  if (location && typeof location === 'object') {
    const record = location as Record<string, unknown>;
    if (record.createdFrom === 'appointment' || record.source === 'appointment') return true;
  }
  return typeof order.issueDescription === 'string' && order.issueDescription.startsWith('Appointment:');
}

/** Score the work order that belongs to this appointment. A later shop-wide update does not win. */
function appointmentWorkOrderScore(appointment: AppointmentMatch, order: WorkOrderMatch): number | null {
  if (!appointment.customerId || !appointment.shopId) return null;
  if (order.customerId !== appointment.customerId || order.shopId !== appointment.shopId) return null;
  if (appointment.vehicleId && order.vehicleId && appointment.vehicleId !== order.vehicleId) return null;

  const due = timeMs(order.dueDate);
  const scheduled = timeMs(appointment.scheduledDate);
  const dueDelta = due != null && scheduled != null ? Math.abs(due - scheduled) : null;
  const created = timeMs(order.createdAt);
  const opened = timeMs(appointment.createdAt);
  const createdDelta = created != null && opened != null ? Math.abs(created - opened) : null;
  const service = String(appointment.serviceType || '').trim();
  const description = order.issueDescription || '';
  const serviceHit = service.length > 0 && description.includes(service);
  const fromAppointment = isAppointmentWorkOrder(order);

  if (fromAppointment && dueDelta != null && dueDelta <= 60_000) return 1_000_000 - dueDelta;
  if (dueDelta != null && dueDelta <= 60_000 && (fromAppointment || serviceHit)) return 800_000 - dueDelta;
  if (fromAppointment && serviceHit && createdDelta != null && createdDelta <= 5 * 60_000) return 500_000 - createdDelta;
  return null;
}

function soleAppointmentJob(appointment: AppointmentMatch, orders: WorkOrderMatch[]): WorkOrderMatch | null {
  const service = String(appointment.serviceType || '').trim();
  const matches = orders.filter((order) => {
    if (!appointment.customerId || !appointment.shopId) return false;
    if (order.customerId !== appointment.customerId || order.shopId !== appointment.shopId) return false;
    if (appointment.vehicleId && order.vehicleId && appointment.vehicleId !== order.vehicleId) return false;
    if (!isAppointmentWorkOrder(order)) return false;
    if (service && !order.issueDescription.includes(service)) return false;
    return true;
  });
  return matches.length === 1 ? matches[0] : null;
}

function withTrackableWorkOrder<T extends AppointmentMatch>(appointment: T, orders: WorkOrderMatch[]) {
  let best: WorkOrderMatch | null = null;
  let bestScore = -1;
  for (const order of orders) {
    const score = appointmentWorkOrderScore(appointment, order);
    if (score == null) continue;
    const olderTie = score === bestScore && best != null && order.createdAt.getTime() < best.createdAt.getTime();
    if (!best || score > bestScore || olderTie) {
      best = order;
      bestScore = score;
    }
  }
  if (!best) best = soleAppointmentJob(appointment, orders);
  if (!best) {
    return { ...appointment, workOrderId: null as string | null, serviceLocation: null as string | null, sharingLocation: false };
  }
  const sharingLocation = locationShareIsLive(best.tracking?.updatedAt);
  const trackable = isRoadsideLocation(best.serviceLocation) || sharingLocation;
  return {
    ...appointment,
    workOrderId: trackable ? best.id : null,
    serviceLocation: best.serviceLocation,
    sharingLocation,
  };
}

// GET - Get appointments
export async function GET(request: NextRequest) {
  // Use cookie/header-aware auth
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const shopId = searchParams.get('shopId');
    const status = searchParams.get('status');

    const where: { customerId?: string; shopId?: string; status?: string } = {};

    // Filter by user role
    const user = auth as AuthUser;
    if (user.role === 'customer') {
      where.customerId = user.id;
    } else if (user.role === 'shop' || user.role === 'manager') {
      where.shopId = shopId || user.shopId;
    }

    if (customerId && (user.role === 'shop' || user.role === 'admin')) {
      where.customerId = customerId;
    }

    if (status) {
      where.status = status;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        shop: {
          select: {
            id: true,
            shopName: true,
            phone: true,
            address: true,
            city: true,
            state: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            vin: true,
          },
        },
      },
      orderBy: {
        scheduledDate: 'asc',
      },
    });

    const presented = await reconcileAppointmentStatuses(appointments);
    const seenPairs = new Set<string>();
    const pairs: { customerId: string; shopId: string }[] = [];
    for (const row of presented) {
      if (!row.customerId || !row.shopId) continue;
      const key = `${row.customerId}:${row.shopId}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      pairs.push({ customerId: row.customerId, shopId: row.shopId });
    }
    const orders: WorkOrderMatch[] = pairs.length === 0 ? [] : await prisma.workOrder.findMany({
      where: { OR: pairs },
      select: {
        id: true,
        customerId: true,
        shopId: true,
        vehicleId: true,
        serviceLocation: true,
        dueDate: true,
        createdAt: true,
        issueDescription: true,
        location: true,
        tracking: { select: { updatedAt: true } },
      },
    });
    return NextResponse.json({
      appointments: presented.map((row) => withTrackableWorkOrder(row, orders)),
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create appointment
export async function POST(request: NextRequest) {
  // Use cookie/header-aware auth
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const {
      shopId,
      vehicleId,
      scheduledDate,
      serviceType,
      notes,
      appointmentType,
      vehicleInfo,
      mediaUrls,
    } = body;

    const normalizedAppointmentType = appointmentType === 'road-call' ? 'road-call' : 'in-shop';

    if (!shopId || !scheduledDate || !serviceType) {
      return NextResponse.json(
        { error: 'Shop ID, scheduled date, and service type are required' },
        { status: 400 }
      );
    }

    if (isScheduledDateInPast(String(scheduledDate))) {
      return NextResponse.json(
        { error: 'Appointment date cannot be in the past' },
        { status: 400 }
      );
    }

    const hasVehicle = Boolean(vehicleId) || hasAppointmentVehicle({
      selectedVehicleId: vehicleId,
      vehicleMake: vehicleInfo?.make,
      vehicleModel: vehicleInfo?.model,
    });
    if (!hasVehicle) {
      return NextResponse.json(
        { error: 'A vehicle is required to create an appointment' },
        { status: 400 }
      );
    }

    const serviceValidation = await findUnconfiguredShopServices(shopId, [String(serviceType)]);
    if (!serviceValidation.hasConfiguredServices) {
      return NextResponse.json(
        { error: 'This shop has no services configured. Ask the shop admin to add services first.' },
        { status: 400 }
      );
    }
    if (serviceValidation.invalidServices.length > 0) {
      return NextResponse.json(
        {
          error: 'Selected service is not offered by this shop.',
          invalidServices: serviceValidation.invalidServices,
        },
        { status: 400 }
      );
    }

    const user = auth as AuthUser;

    // Get vehicle info if provided
    let vehicle = null;
    if (vehicleId) {
      vehicle = await prisma.vehicle.findFirst({
        where: {
          id: vehicleId,
          customerId: user.id,
        },
      });

      if (!vehicle) {
        return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
      }
    }

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        customerId: user.id,
        shopId,
        vehicleId: vehicleId || null,
        scheduledDate: new Date(scheduledDate),
        serviceType,
        notes: notes || null,
        status: 'scheduled',
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        shop: {
          select: {
            shopName: true,
            phone: true,
          },
        },
        vehicle: {
          select: {
            make: true,
            model: true,
            year: true,
            vehicleType: true,
          },
        },
      },
    });

    // Create a work order for this appointment
    const workOrder = await prisma.workOrder.create({
      data: {
        customerId: user.id,
        shopId,
        vehicleId: vehicleId || null,
        vehicleType: vehicle?.vehicleType || appointment.vehicle?.vehicleType || 'gas',
        serviceLocation: normalizedAppointmentType,
        issueDescription: `Appointment: ${serviceType}${normalizedAppointmentType === 'road-call' ? ' (Road Call)' : ''}${notes ? `\n\nCustomer Notes: ${notes}` : ''}`,
        maintenance: [serviceType],
        location: normalizedAppointmentType === 'road-call'
          ? {
              type: 'road-call',
              source: 'appointment',
              createdFrom: 'appointment',
              vehicleInfo: vehicleInfo || null,
              mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
            }
          : {
              type: 'in-shop',
              source: 'appointment',
              createdFrom: 'appointment',
              vehicleInfo: vehicleInfo || null,
              mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
            },
        pictures: Array.isArray(mediaUrls) ? mediaUrls : [],
        status: 'pending',
        dueDate: new Date(scheduledDate),
      },
    });

    // If customer provided notes, start a message thread in the DirectMessage system (visible in shop MessagingCard)
    if (notes && notes.trim()) {
      const vehicleSummary = vehicleInfo
        ? [vehicleInfo.year, vehicleInfo.make, vehicleInfo.model, vehicleInfo.licensePlate].filter(Boolean).join(' ')
        : '';
      const mediaCount = Array.isArray(mediaUrls) ? mediaUrls.length : 0;
      const customerName = `${appointment.customer.firstName} ${appointment.customer.lastName}`;
      const messageBody = `${notes.trim()}\n\nVisit Type: ${normalizedAppointmentType === 'road-call' ? 'Road Call' : 'In Shop'}${vehicleSummary ? `\nVehicle: ${vehicleSummary}` : ''}${mediaCount > 0 ? `\nMedia attached: ${mediaCount}` : ''}`;
      await prisma.directMessage.create({
        data: {
          senderId: user.id,
          senderRole: 'customer',
          senderName: customerName,
          receiverId: shopId,
          receiverRole: 'shop',
          receiverName: appointment.shop.shopName,
          body: messageBody,
          shopId,
        },
      });
    }

    // Send SMS confirmation to customer
    if (appointment.customer.phone) {
      const dateStr = new Date(scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      sendSms(
        appointment.customer.phone,
        `FixTray: Your appointment at ${appointment.shop.shopName} is confirmed for ${dateStr}. Service: ${serviceType}.`,
        shopId,
      ).catch(() => {});
    }

    return NextResponse.json({ 
      appointment,
      workOrderId: workOrder.id,
      messageThreadStarted: !!(notes && notes.trim()),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating appointment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
