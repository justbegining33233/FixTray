import { LeaveRequestList } from '@/components/LeaveRequestList';
import SayText from '@/components/SayText';

export default function ManagerLeaveRequestsPage() {
  return (
    <div className="container mx-auto min-h-screen bg-[#020608] px-4 py-8 text-[#e5e7eb]">
      <h1 className="text-3xl font-bold mb-8 text-[#e5e7eb]"><SayText text="Leave Request Management" /></h1>

      <div className="rounded-lg border border-[#1e293b] bg-[#0b1220] p-4 sm:p-6">
        <LeaveRequestList role="manager" filter="all" />
      </div>
    </div>
  );
}
