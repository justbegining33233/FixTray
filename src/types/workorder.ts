// 1. Vehicle Type
export type VehicleType = 'semi-truck' | 'trailer' | 'equipment' | 'personal-vehicle';

// Service Type
export type ServiceLocationType = 'roadside' | 'in-shop';

// 2. Services & Repairs
export type RepairType = 'engine' | 'electrical' | 'tires-wheels' | 'brakes' | 'other-repair';
export type MaintenanceType = 'oil-change' | 'tire-service' | 'tire-rotation';
export type TireServiceType = 'flat-repair' | 'tire-replacement' | 'bead-air-leak';

export interface RepairService {
  type: RepairType;
  description?: string;
}

export interface MaintenanceService {
  type: MaintenanceType;
  oilSupplied?: boolean;
  techBringOil?: boolean;
  vehicleGreased?: boolean; // semi/trailer only
  tireServiceType?: TireServiceType;
}

export interface Service {
  repairs?: RepairService[];
  maintenance?: MaintenanceService[];
}

// 3. Parts & Materials
export interface PartsMaterials {
  customerProvided: boolean;
  techBringParts: boolean;
  notes?: string;
  partNumbers?: string;
}

// 4. Issue Description
export interface IssueDescription {
  symptoms: string;
  pictures: string[]; // image paths/URLs
  additionalNotes?: string;
}

// 4.5. Vehicle Location
export interface VehicleLocation {
  locationType: 'geolocation' | 'address' | 'not-provided';
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

// 5. Technician Labor
export interface TechnicianLabor {
  startTime?: Date;
  completionTime?: Date;
  totalHours?: number;
}

// 6. Completion & Verification
export interface CompletionVerification {
  correctiveAction?: string;
  completionComments?: string;
  roadTestRequired?: boolean;
  verificationResult?: 'pass' | 'fail';
  technicianName?: string;
  customerSignature?: string;
}

// 7. Parts & Labor Breakdown
export interface PartLaborBreakdown {
  partsUsed?: { name: string; quantity: number; unitPrice?: number }[];
  laborHours?: number;
  laborLines?: { description: string; hours: number; ratePerHour?: number }[];
  subletWork?: string;
  additionalCharges?: { description: string; amount: number }[];
}

// 9. VIN Photo
export interface VINPhoto {
  vin?: string;
  vinPhotoPath?: string;
}

// Messaging (customers, techs, managers)
export interface Message {
  id: string;
  sender: 'customer' | 'tech' | 'manager';
  senderName?: string;
  body: string;
  timestamp: Date;
}

// Estimate proposal with itemized line items (Feature 10)
export interface EstimateLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: 'parts' | 'labor' | 'sublet' | 'other';
}

export interface Estimate {
  amount?: number;
  details?: string;
  submittedBy?: string; // tech or manager
  status?: 'proposed' | 'accepted' | 'rejected';
  submittedAt?: Date;
  scheduledDate?: Date; // date/time scheduled for the work (set after estimate accepted)
  scheduledBy?: string; // tech or manager who scheduled the work
  lineItems?: EstimateLineItem[]; // itemized breakdown for customer approval (Feature 10)
  serviceFee?: number; // FixTray platform service fee (hardcoded $5 per work order)
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
}

// Payment tracking (Feature 1)
export interface Payment {
  id?: string;
  amount: number;
  method: 'cash' | 'check' | 'card' | 'ach' | 'other';
  receivedAt?: Date;
  timestamp?: Date;
  receivedBy?: string;
  notes?: string;
}

// Work history/audit log (Feature 4)
export interface WorkOrderEvent {
  id: string;
  timestamp: Date;
  action: string;
  changedBy?: string;
  previousValue?: unknown;
  newValue?: unknown;
  details?: string;
}

// Work photos (Feature 5)
export interface WorkPhoto {
  id: string;
  url: string;
  type: 'before' | 'after' | 'progress' | 'documentation';
  uploadedAt: Date;
  uploadedBy?: string;
  caption?: string;
}

// SLA/Turnaround tracking (Feature 6)
export interface SLA {
  promisedCompletionDate?: Date;
  actualCompletionDate?: Date;
  hoursOverdue?: number;
}

// Customer notifications (Feature 3)
export interface NotificationPreference {
  emailUpdates: boolean;
  smsUpdates: boolean;
  email?: string;
  phone?: string;
}

// Customer dashboard data (Feature 8)
export interface CustomerWorkOrderSummary {
  totalOrders: number;
  pending: number;
  inProgress: number;
  completed: number;
  totalSpent: number;
}

// Main Work Order
export interface WorkOrder {
  id: string;
  
  // Basic Info
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  assignedTo?: string;
  bay?: number; // Bay number (1-999) where work is being performed
  shop?: {
    shopName: string;
    phone?: string;
    email?: string;
  };
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  
  // 1. Vehicle Type
  vehicleType: VehicleType;
  
  // Service Location Type
  serviceLocationType?: ServiceLocationType;
  
  // 2. Services
  services: Service;
  
  // 3. Parts & Materials
  partsMaterials?: PartsMaterials;
  
  // 4. Issue Description
  issueDescription: IssueDescription;
  
  // 4.5. Vehicle Location
  vehicleLocation?: VehicleLocation;
  
  // 5. Technician Labor (for tech use)
  technicianLabor?: TechnicianLabor;
  
  // 6. Completion & Verification (for tech use)
  completionVerification?: CompletionVerification;
  
  // 7. Parts & Labor Breakdown (for tech use)
  partLaborBreakdown?: PartLaborBreakdown;
  
  // 8. Work Order Status
  status: 'pending' | 'assigned' | 'in-progress' | 'en-route' | 'waiting-estimate' | 'waiting-for-payment' | 'closed' | 'denied-estimate';
  statusNotes?: string;
  scheduledDate?: Date;
  deniedAt?: Date;
  denialReason?: 'no-longer-want' | 'wrong-parts' | 'too-expensive' | 'other';
  denialReasonText?: string; // for 'other' reason
  
  // Messaging + Estimates
  messages?: Message[];
  estimate?: Estimate | null;
  
  // 9. VIN Photo
  vinPhoto?: VINPhoto;
  
  // Feature 1: Payment tracking
  payments?: Payment[];
  
  // Feature 3: Customer notifications
  notificationPreferences?: NotificationPreference;
  
  // Feature 4: Work history/audit log
  events?: WorkOrderEvent[];
  
  // Feature 5: Work photos (before/after/progress)
  workPhotos?: WorkPhoto[];
  photos?: { url: string; type: string; caption?: string; timestamp: Date }[];
  
  // Feature 6: SLA/Turnaround time
  sla?: SLA;
  
  // Feature 7: Inventory sync
  inventoryUpdated?: boolean;
}

export interface WorkOrderFormData {
  shopId?: string;
  vehicleType: VehicleType;
  serviceLocationType?: ServiceLocationType;
  services: Service;
  estimatedCost?: number;
  techLabor?: TechnicianLabor;
  partsMaterials?: PartsMaterials;
  issueDescription: IssueDescription;
  vehicleLocation?: VehicleLocation;
  vinPhoto?: VINPhoto;
}
