import { LeaveRequestList } from '@/components/LeaveRequestList';
import SayText from '@/components/SayText';

export default function ManagerLeaveRequestsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8"><SayText text="Leave Request Management" /></h1>

      <div className="bg-white rounded-lg shadow p-6">
        <LeaveRequestList role="manager" filter="all" />
      </div>
    </div>
  );
}
