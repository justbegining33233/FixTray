import { ShiftForm } from '@/components/ShiftForm';

export default function CreateShiftPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Create New Shift</h1>
      <div className="max-w-lg">
        <ShiftForm />
      </div>
    </div>
  );
}
