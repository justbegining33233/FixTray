// Zod validation schemas for API endpoints
import { z } from 'zod';

// Customer validation
export const customerRegistrationSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  company: z.string().optional(),
});

export const customerLoginSchema = z.object({
  email: z.string().optional(),
  username: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
}).refine(data => data.email || data.username || data.phone, {
  message: 'Email, username, or phone is required',
});

// Shop validation
export const shopRegistrationSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  shopName: z.string().min(1, 'Shop name is required'),
  ownerName: z.string().min(1, 'Owner name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  zipCode: z.string().min(5, 'Valid zip code is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  businessLicense: z.string().optional(),
  insurancePolicy: z.string().optional(),
  shopType: z.enum(['diesel', 'gas', 'small-engine', 'heavy-equipment', 'resurfacing', 'welding', 'tire', 'mixed']).optional(),
});

// Work order validation
export const workOrderCreateSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  shopId: z.string().min(1, 'Shop ID is required'),
  vehicleId: z.string().optional(),
  vehicleType: z.string().min(1, 'Vehicle type is required'),
  serviceLocation: z.enum(['roadside', 'in-shop']),
  issueDescription: z.string().min(10, 'Please provide a detailed description'),
  repairs: z.any().optional(),
  maintenance: z.any().optional(),
  partsMaterials: z.any().optional(),
  location: z.any().optional(),
  pictures: z.any().optional(),
});

export const workOrderUpdateSchema = z.object({
  status: z.enum(['pending', 'assigned', 'in-progress', 'waiting-estimate', 'waiting-for-payment', 'closed', 'denied-estimate']).optional(),
  assignedTechId: z.string().optional(),
  estimate: z.any().optional(),
  techLabor: z.any().optional(),
  partsUsed: z.any().optional(),
  workPhotos: z.any().optional(),
  completion: z.any().optional(),
  paymentStatus: z.enum(['unpaid', 'pending', 'paid', 'refunded']).optional(),
  totalCost: z.number().optional(),
});

// Tech/Employee validation
export const techCreateSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  role: z.enum(['tech', 'manager']),
  hourlyRate: z.number().min(0).optional(),
});

// Service validation
export const serviceCreateSchema = z.object({
  shopId: z.string().min(1, 'Shop ID is required'),
  serviceName: z.string().min(1, 'Service name is required'),
  category: z.enum(['diesel', 'gas', 'small-engine', 'heavy-equipment', 'resurfacing', 'welding', 'tire']),
  price: z.number().min(0).optional(),
  duration: z.number().min(0).optional(),
  description: z.string().optional(),
});

export const serviceUpdateSchema = z.object({
  serviceName: z.string().min(1).optional(),
  category: z.enum(['diesel', 'gas']).optional(),
  price: z.number().min(0).optional(),
  duration: z.number().min(0).optional(),
  description: z.string().optional(),
});

// Inventory validation
export const inventoryCreateSchema = z.object({
  shopId: z.string().min(1, 'Shop ID is required'),
  type: z.string().min(1, 'Type is required'),
  name: z.string().min(1, 'Name is required'),
  sku: z.string().optional(),
  quantity: z.number().int().min(0),
  price: z.number().min(0),
  reorderPoint: z.number().int().min(0).optional(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});

export const inventoryUpdateSchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().int().min(0).optional(),
  price: z.number().min(0).optional(),
  reorderPoint: z.number().int().min(0).optional(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
});

// Payment validation
export const paymentIntentSchema = z.object({
  workOrderId: z.string().min(1, 'Work order ID is required'),
  amount: z.number().min(1, 'Amount must be greater than 0'),
});

// Vehicle validation
export const vehicleCreateSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  vehicleType: z.string().min(1, 'Vehicle type is required'),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  vin: z.string().optional(),
  licensePlate: z.string().optional(),
});

// Estimate validation
export const estimateCreateSchema = z.object({
  workOrderId: z.string().min(1, 'Work order ID is required'),
  lineItems: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().min(0),
    unitPrice: z.number().min(0),
    total: z.number().min(0),
  })),
  subtotal: z.number().min(0),
  tax: z.number().min(0),
  total: z.number().min(0),
  notes: z.string().optional(),
});

// Helper function to validate request body
export async function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; errors: z.ZodError }> {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}
