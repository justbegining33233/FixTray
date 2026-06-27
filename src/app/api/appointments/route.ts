import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/middleware';
import { AuthUser } from '@/lib/auth';
import { sendSms } from '@/lib/smsService';
import { findUnconfiguredShopServices } from '@/lib/shopServiceValidation';

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

    return NextResponse.json({ appointments });
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

    // If customer provided notes, start a message thread
    if (notes && notes.trim()) {
      const vehicleSummary = vehicleInfo
        ? [vehicleInfo.year, vehicleInfo.make, vehicleInfo.model, vehicleInfo.licensePlate].filter(Boolean).join(' ')
        : '';
      const mediaCount = Array.isArray(mediaUrls) ? mediaUrls.length : 0;
      await prisma.customerMessage.create({
        data: {
          customerId: user.id,
          workOrderId: workOrder.id,
          from: 'customer',
          content: `${notes.trim()}\n\nVisit Type: ${normalizedAppointmentType === 'road-call' ? 'Road Call' : 'In Shop'}${vehicleSummary ? `\nVehicle: ${vehicleSummary}` : ''}${mediaCount > 0 ? `\nMedia attached: ${mediaCount}` : ''}`,
          read: false,
        },
      });
    }

    // Send SMS confirmation to customer
    if (appointment.customer.phone) {
      const dateStr = new Date(scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      sendSms(
        appointment.customer.phone,
        `FixTray: Your appointment at ${appointment.shop.shopName} is confirmed for ${dateStr}. Service: ${serviceType}.`
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
