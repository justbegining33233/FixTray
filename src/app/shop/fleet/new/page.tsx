import { FleetAccountForm } from '@/components/FleetAccountForm';

export const metadata = {
  title: 'Create Fleet Account',
  description: 'Create a new fleet account',
};

export default function NewFleetAccountPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Create Fleet Account</h1>
      <FleetAccountForm />
    </div>
  );
}
