import Link from 'next/link';
import { LeaveRequestForm } from '@/components/LeaveRequestForm';
import SayText from '@/components/SayText';

export default function NewLeaveRequestPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/tech/leave-requests" className="text-blue-600 hover:underline mb-4 inline-block">
          <SayText text="← Back to my requests" />
        </Link>
        <h1 className="text-3xl font-bold"><SayText text="Request Leave" /></h1>
      </div>

      <div className="max-w-2xl">
        <LeaveRequestForm />
      </div>
    </div>
  );
}
