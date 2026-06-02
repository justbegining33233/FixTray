'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

interface RevenueChartProps {
  data: { month: string; amount: number }[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
        <Legend />
        <Line
          type="monotone"
          dataKey="amount"
          stroke="#8884d8"
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface CompletionTimesChartProps {
  data: { time: string; count: number }[];
}

export function CompletionTimesChart({ data }: CompletionTimesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip formatter={(value) => [`${value}`, 'Jobs']} />
        <Bar dataKey="count" fill="#82ca9d" />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface TechPerformanceChartProps {
  data: { name: string; jobs: number; rating: number }[];
}

export function TechPerformanceChart({ data }: TechPerformanceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="jobs" fill="#8884d8" name="Jobs Completed" />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface StatusDistributionChartProps {
  data: { status: string; count: number }[];
}

export function StatusDistributionChart({ data }: StatusDistributionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ percent, payload }: { percent?: number; payload?: { status?: string } }) => `${payload?.status ?? ''} ${percent ? (percent * 100).toFixed(0) : 0}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="count"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

interface MonthlyTrendsChartProps {
  data: { month: string; jobs: number; revenue: number }[];
}

export function MonthlyTrendsChart({ data }: MonthlyTrendsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="jobs"
          stroke="#8884d8"
          strokeWidth={2}
          name="Jobs Completed"
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#82ca9d"
          strokeWidth={2}
          name="Revenue"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Main component that renders all charts
interface AnalyticsChartsProps {
  data: {
    revenue: { month: string; amount: number }[];
    completionTimes: { time: string; count: number }[];
    techPerformance: { name: string; jobs: number; rating: number }[];
    statusDistribution: { status: string; count: number }[];
    monthlyTrends: { month: string; jobs: number; revenue: number }[];
  };
}

export default function AnalyticsCharts({ data }: AnalyticsChartsProps) {
  return (
    <div className="space-y-8">
      {/* Revenue Chart */}
      <div className="p-6 rounded-lg" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
        <h3 className="text-lg font-semibold mb-4">Revenue Trends</h3>
        <RevenueChart data={data.revenue} />
      </div>

      {/* Completion Time Chart */}
      <div className="p-6 rounded-lg" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
        <h3 className="text-lg font-semibold mb-4">Average Completion Time</h3>
        <CompletionTimesChart data={data.completionTimes} />
      </div>

      {/* Tech Performance Chart */}
      <div className="p-6 rounded-lg" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
        <h3 className="text-lg font-semibold mb-4">Tech Performance</h3>
        <TechPerformanceChart data={data.techPerformance} />
      </div>

      {/* Status Distribution Pie Chart */}
      <div className="p-6 rounded-lg" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
        <h3 className="text-lg font-semibold mb-4">Work Order Status Distribution</h3>
        <StatusDistributionChart data={data.statusDistribution} />
      </div>

      {/* Monthly Trends */}
      <div className="p-6 rounded-lg" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
        <h3 className="text-lg font-semibold mb-4">Monthly Trends</h3>
        <MonthlyTrendsChart data={data.monthlyTrends} />
      </div>
    </div>
  );
}