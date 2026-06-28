/**
 * Input Validation Schemas
 * Version: 0.0.2
 * 
 * Zod schemas for validating API request bodies
 */

import { z } from 'zod';

// Work Order Schemas
export const workOrderUpdateSchema = z.object({
  issueDescription: z.string().max(5000).optional(),
  status: z.enum(['pending', 'assigned', 'in-progress', 'waiting-estimate', 'estimate-submitted', 'waiting-for-payment', 'closed', 'denied-estimate']).optional(),
  bay: z.number().int().min(1).max(999).nullable().optional(),
  assignedTechId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().nullable().optional(),
  estimatedCost: z.number().min(0).optional(),
  amountPaid: z.number().min(0).optional(),
  dueDate: z.string().datetime().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).optional(),
  statusReason: z.string().optional(),
  estimate: z.object({
    lineItems: z.array(z.object({
      description: z.string().max(500),
      quantity: z.number().min(0),
      unitPrice: z.number().min(0),
      total: z.number().min(0),
    })).optional(),
    subtotal: z.number().min(0).optional(),
    taxRate: z.number().min(0).max(100).optional(),
    tax: z.number().min(0).optional(),
    total: z.number().min(0).optional(),
    notes: z.string().max(2000).optional(),
  }).optional(),
  techLabor: z.any().optional(),
  partsUsed: z.array(z.object({
    name: z.string().min(1),
    quantity: z.number().min(0),
    unitPrice: z.number().min(0).optional(),
    sku: z.string().optional(),
  })).optional(),
}).strict(); // Reject unknown fields

// User Update Schemas
export const userUpdateSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  role: z.enum(['admin', 'manager', 'tech', 'customer', 'shop']).optional(),
}).strict();

// Tech/Employee Update Schema
export const techUpdateSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  role: z.enum(['tech', 'manager']).optional(),
  available: z.boolean().optional(),
  hourlyRate: z.number().min(0).max(1000).optional(),
}).strict();

// Shop Settings Update Schema
export const shopSettingsUpdateSchema = z.object({
  defaultLaborRate: z.number().min(0).optional(),
  inventoryMarkup: z.number().min(0).max(5).optional(), // Allow up to 500% markup
  overtimeMultiplier: z.number().min(1).max(3).optional(),
  businessHours: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  allowTimeTracking: z.boolean().optional(),
  requireClockInOut: z.boolean().optional(),
  gpsVerificationEnabled: z.boolean().optional(),
  shopLatitude: z.number().min(-90).max(90).nullable().optional(),
  shopLongitude: z.number().min(-180).max(180).nullable().optional(),
  gpsRadiusMeters: z.number().min(10).max(5000).optional(),
  weeklyPayrollBudget: z.number().min(0).nullable().optional(),
  monthlyPayrollBudget: z.number().min(0).nullable().optional(),
}).strict();

// Time Entry Schema
export const timeEntrySchema = z.object({
  techId: z.string().uuid(),
  clockIn: z.string().datetime().optional(),
  clockOut: z.string().datetime().optional(),
  breakStart: z.string().datetime().nullable().optional(),
  breakEnd: z.string().datetime().nullable().optional(),
  breaks: z.any().optional(), // array of break records (stored as JSON)
  workOrderId: z.string().optional(),
  isPto: z.boolean().optional(),
  approved: z.boolean().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  locked: z.boolean().optional(),
  hoursWorked: z.number().optional(),
  notes: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
}).strict();

// Inventory Item Schema
export const inventoryItemUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sku: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  quantity: z.number().int().min(0).optional(),
  minQuantity: z.number().int().min(0).optional(),
  maxQuantity: z.number().int().min(0).optional(),
  unitCost: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  category: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
}).strict();

// Message Schema
export const messageSchema = z.object({
  workOrderId: z.string().uuid(),
  sender: z.enum(['customer', 'shop', 'tech']),
  senderName: z.string().min(1).max(100),
  body: z.string().min(1).max(5000),
}).strict();

// Shop Approval Schema
export const shopApprovalSchema = z.object({
  approved: z.boolean(),
  rejectionReason: z.string().max(500).optional(),
}).strict();

/**
 * Validate request body against schema
 * Returns validation result with typed data or errors
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      return { success: false, errors };
    }
    return { success: false, errors: ['Invalid request data'] };
  }
}
