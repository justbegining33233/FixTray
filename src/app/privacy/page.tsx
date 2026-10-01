import Link from "next/link";
import MarketingShell from "@/components/MarketingShell";

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-24 text-slate-300">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Privacy</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-400">Last updated September 30, 2026.</p>
        <div className="mt-8 space-y-8 text-sm leading-7">
          <section>
            <h2 className="text-lg font-semibold text-white">Who we are</h2>
            <p className="mt-2">
              FixTray operates the website at fixtray.app. This policy describes the information that website collects and how FixTray uses it. It is published by FixTray. Contact support@fixtray.app with a privacy question.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">The service</h2>
            <p className="mt-2">
              FixTray is a work-order system for auto service, roadside and in the shop. A shop runs jobs. A customer follows those jobs, including estimates, messages, approvals, and payments. A mobile app is being built and is not in the app stores yet. Until it is available, people use the website, including in a phone browser. On iPhone, Safari and Add to Home Screen are the way to keep the site on the home screen.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Members and customers</h2>
            <p className="mt-2">
              A member is a shop-side user: the shop owner and that shop&apos;s employees, including technicians and managers. FixTray is free for members. FixTray does not charge members a subscription. A customer is the shop&apos;s client. When a customer pays by card, the charge is the shop&apos;s quote plus a FixTray service fee when that fee applies. The amount shown at checkout is the amount charged. Payment details are below. The terms describe the charge.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Accounts</h2>
            <p className="mt-2">
              Creating an account stores the name, email, username, and password you enter. The password is stored as a bcrypt hash, not as the password you typed. A shop registration also stores the shop name, owner name, phone, address, and the other fields on the form. A technician or manager record stores the name, email, phone, role, and employment details the shop enters. A customer account stores the name, email, phone, and company if you provide them.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Jobs and shop records</h2>
            <p className="mt-2">
              The site stores what people put on a job: vehicles, appointments, estimates, signed approvals, messages, photos, documents, inventory, schedules, time entries, and payroll records. A customer sees their own jobs. People at that shop see the jobs they work.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Payments</h2>
            <p className="mt-2">
              Card payments are processed by Stripe. A shop connects its own Stripe account. FixTray stores the payment status, the amount, and the Stripe payment identifier on the work order. If a customer saves a card, FixTray stores the card brand, the last four digits, the expiration month and year, and the Stripe payment-method identifier. FixTray does not store a full card number or a card security code. The shop receives the quote. FixTray retains the service fee when that fee applies.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Location</h2>
            <p className="mt-2">
              When a technician shares a location, or a roadside job has a map pin, the site stores those coordinates so the shop and the customer can see the job.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Demo requests</h2>
            <p className="mt-2">
              If you ask for a demo, we store the email address you enter and send a username and password for a demo shop from noreply@fixtray.app. The demo shop is sample data so you can see the product before you sign up. It is not your shop. The 30 minutes start at the first login. When they end, the password is reset and changes in that demo shop are cleared.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Password reset, contact, and page views</h2>
            <p className="mt-2">
              Forgot password asks for an email or username and emails a code. The contact form emails FixTray the name, email, company, and message you type. The support address on the site is support@fixtray.app. Sign-in records the IP address and browser information sent with the request, in an activity log. If a page view is recorded, the service stores the page path, the browser, a referrer if one was sent, and a hash of the IP address rather than the raw address.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">How we use information</h2>
            <p className="mt-2">
              We use this information to run the service: to create and secure accounts, to show a shop its jobs and a customer their jobs, to send estimates, reminders, and support mail, to process a customer card payment, to provide a demo shop login, and to investigate abuse or a security incident. We do not use member accounts to bill a subscription.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Sharing</h2>
            <p className="mt-2">
              We share information with the people who need it to do the job. Shop members see that shop&apos;s records. A customer sees their own jobs. Stripe processes card payments and shop payouts. Resend sends email, including demo logins, password codes, and job notices. Twilio sends a text message when a shop uses texting and texting is configured. Cloudinary stores photos and files uploaded on a job. We also share information when the law requires it, or to prevent abuse of the service. We do not sell personal information.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Security</h2>
            <p className="mt-2">
              Passwords are hashed with bcrypt. Sign-in uses a signed access token stored in an httpOnly cookie, plus a refresh cookie. Requests that change data use a security token. Sign-in and other routes apply rate limits, and repeated failed sign-ins can lock an account for a short time. API routes check the person&apos;s role before they act on a shop or a job. Card numbers are handled by Stripe, as described above. These are the controls the product uses. This page is not a certification.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Retention</h2>
            <p className="mt-2">
              We keep account, shop, and job records while the account is in use, and afterward as needed to operate the service, resolve a dispute, or meet a legal duty. There is no button in the product that deletes an account. A demo shop is different: when the 30 minutes end, the password is reset and the changes in that demo shop are cleared. Email support@fixtray.app to ask what we store for you, or to ask us to delete it. We may keep a record of the request and any information we still have to retain.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Changes</h2>
            <p className="mt-2">
              If we change this policy, we will update the date at the top of this page. The version on the website is the current one.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Contact</h2>
            <p className="mt-2">
              Email support@fixtray.app. You can also use the contact form.
            </p>
          </section>
          <p>
            <Link href="/contact" className="text-white hover:underline">Contact</Link>
            {" · "}
            <Link href="/terms" className="text-white hover:underline">Terms</Link>
            {" · "}
            <Link href="/demo" className="text-white hover:underline">Try the demo shop</Link>
          </p>
        </div>
      </article>
    </MarketingShell>
  );
}
