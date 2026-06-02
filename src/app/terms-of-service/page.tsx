import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <p className="text-slate-300">Last updated: May 29, 2026</p>
        </header>

        <section className="space-y-4 text-slate-200 leading-7">
          <p>
            These Terms of Service govern your use of the FixTray platform,
            including web and mobile access, shop management tools, and customer
            communication features.
          </p>
          <p>
            By using FixTray, you agree to use the service lawfully, provide
            accurate account details, and respect communications from shops,
            customers, and platform staff.
          </p>
          <p>
            FixTray may update these terms from time to time. Continued use of
            the platform after updates means you accept the revised terms.
          </p>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-sm text-slate-300">
          <p>
            For support or policy questions, contact the FixTray team through
            the in-app messaging system.
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
