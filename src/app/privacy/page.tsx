import Link from "next/link";
import MarketingShell from "@/components/MarketingShell";

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-24 text-slate-300">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Privacy</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Privacy</h1>
        <p className="mt-3 text-sm text-slate-400">Last updated September 30, 2026.</p>
        <div className="mt-8 space-y-8 text-sm leading-7">
          <p>
            FixTray is a website for repair shops and their customers. This page describes information the product stores, based on how the site works. It is not a certification.
          </p>
          <section>
            <h2 className="text-lg font-semibold text-white">Accounts</h2>
            <p className="mt-2">
              Creating an account stores the name, email, username, and password you enter. The password is stored as a hash, not as the password you typed. A shop registration also stores the shop name, owner name, phone, and address entered on the form.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Jobs and shop records</h2>
            <p className="mt-2">
              The site stores what people put on a job: vehicles, appointments, estimates, signed approvals, messages, photos, documents, inventory, schedules, and payroll records. A customer sees their own jobs. People at that shop see the jobs they work.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Payments</h2>
            <p className="mt-2">
              Card payments are sent to Stripe. A shop connects its own Stripe account. The customer is charged the shop&apos;s quote plus a FixTray service fee, and the shop receives the quote.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Location</h2>
            <p className="mt-2">
              When a technician shares a location, or a roadside job has a map pin, the site stores those coordinates so the shop and the customer can see the job.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Password reset and the contact form</h2>
            <p className="mt-2">
              Forgot password asks for an email or username and emails a code. The contact form sends the name, email, company, and message you type. The support address shown on the site is support@fixtray.app.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Sign-in</h2>
            <p className="mt-2">
              Signing in stores a session cookie so the site knows who you are. Requests that change data also use a security token.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Asking about your information</h2>
            <p className="mt-2">
              The product does not have a self-serve button that deletes an account. Email support@fixtray.app if you want to ask about the information stored for your account.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Phone</h2>
            <p className="mt-2">
              A mobile app is in development. Until then, FixTray is the website, including when you open it in a phone browser.
            </p>
          </section>
          <p>
            <Link href="/contact" className="text-white hover:underline">Contact</Link>
            {" · "}
            <Link href="/terms" className="text-white hover:underline">Terms</Link>
          </p>
        </div>
      </article>
    </MarketingShell>
  );
}
