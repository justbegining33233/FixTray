import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-slate-300">Last updated: May 29, 2026</p>
        </header>

        <section className="space-y-4 text-slate-200 leading-7">
          <p>
            FixTray collects account, shop, vehicle, and work-order data needed
            to deliver scheduling, messaging, invoicing, and platform support
            services.
          </p>
          <p>
            We use your information to operate and improve the platform,
            maintain security, and provide support. We do not sell your personal
            information.
          </p>
          <p>
            You can request updates to your account information and contact
            support for privacy-related requests through official FixTray
            channels.
          </p>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-300">
          <p>
            By using FixTray, you acknowledge this policy and consent to the
            data practices described here.
          </p>
        </section>

        <div>
          <Link href="/auth/login" className="text-red-400 hover:text-red-300">
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}
