'use client';

interface CapabilityCardProps {
  title: string;
  items: string[];
}

function CapabilityCard({ title, items }: CapabilityCardProps) {

  return (
    <div className="relative rounded-2xl" style={{background:"rgba(10,16,32,0.68)",border:"1px solid rgba(255,255,255,0.08)"}}>
      <div className="p-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-[#f1f5f9]">{title}</h3>
        </div>

        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li key={item} className="flex items-center text-[#f1f5f9]">
              <svg className="h-5 w-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const sections = [
    {
      title: 'Operations Core',
      items: ['Work order intake and dispatch', 'Technician updates and status flow', 'Customer communication timeline'],
    },
    {
      title: 'Shop Control',
      items: ['Service catalog and scheduling', 'Team permissions and roles', 'Inventory and vendor tracking'],
    },
    {
      title: 'Business Visibility',
      items: ['Payroll and labor context', 'Reporting and performance analytics', 'Audit-ready activity history'],
    },
  ];

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-[#f1f5f9] sm:text-5xl">
            Platform capabilities built for modern shops
          </h1>
          <p className="mt-4 text-xl text-[#94a3b8]">
            Run front-office coordination and back-shop execution from one connected workspace.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sections.map((section) => (
            <CapabilityCard key={section.title} title={section.title} items={section.items} />
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center text-[#f1f5f9] mb-8">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-[#f1f5f9] mb-2">
                How quickly can we get started?
              </h3>
              <p className="text-[#94a3b8]">
                Most shops can begin onboarding immediately and configure their workflow in the same day.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#f1f5f9] mb-2">
                Does it support multi-role teams?
              </h3>
              <p className="text-[#94a3b8]">
                Yes. Owners, managers, technicians, and admins can each work with role-based access and workflows.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#f1f5f9] mb-2">
                Is mobile workflow included?
              </h3>
              <p className="text-[#94a3b8]">
                Yes. Field teams and front desk users can manage jobs, updates, and communication on mobile-friendly screens.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#f1f5f9] mb-2">
                Can we migrate from another tool?
              </h3>
              <p className="text-[#94a3b8]">
                Yes. We can help map existing shop data into FixTray during onboarding.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <h2 className="text-3xl font-bold text-[#f1f5f9] mb-4">
            Ready to streamline your shop operations?
          </h2>
          <p className="text-xl text-[#94a3b8] mb-8">
            Join thousands of diesel and gas shops already using FixTray
          </p>
          <button className="text-white px-8 py-4 rounded-lg font-semibold text-lg hover:opacity-90 transition-colors" style={{background:'#e5332a'}}>
            Start Onboarding
          </button>
        </div>
      </div>
    </div>
  );
}
