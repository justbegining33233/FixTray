export type Shop = {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'pending' | 'suspended';
  owner: string;
  email: string;
  phone: string;
  totalJobs: number;
  completedJobs: number;
  completionRate: number;
  totalRevenue: number;
  revenueThisMonth: number;
  rating: number;
  reviewCount: number;
  techCount: number;
  activeTechs: number;
  joinedDate: Date;
};

export type LiveMetrics = {
  totalShops: number;
  activeShops: number;
  pendingShops: number;
  suspendedShops: number;
  newShopsThisMonth: number;
  shopGrowth: string;
  approvalRate: string;
  totalPlatformRevenue: number;
  revenueThisMonth: number;
  revenueGrowth: string;
  totalJobs: number;
  totalJobsThisMonth: number;
  jobsGrowth: string;
  shopTrend: number[];
};