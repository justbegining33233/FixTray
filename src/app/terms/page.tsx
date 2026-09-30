import Link from "next/link";
import MarketingShell from "@/components/MarketingShell";
import { fixtrayServiceFeeLabel } from "@/lib/publicFeeCopy";

export default function TermsPage() {
  const fee = fixtrayServiceFeeLabel();
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-24 text-slate-300">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Terms</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Terms of Service</h1>
        <p className="mt-3 text-sm text-slate-400">Last updated September 30, 2026.</p>
        <div className="mt-8 space-y-8 text-sm leading-7">
          <section>
            <h2 className="text-lg font-semibold text-white">Agreement</h2>
            <p className="mt-2">
              These terms are between you and FixTray for use of the website at fixtray.app. By creating an account, signing in, or using the site, you agree to these terms. FixTray publishes this page. Contact support@fixtray.app with a question about it.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">The service</h2>
            <p className="mt-2">
              FixTray is a work-order system for auto service. A shop uses it to run work orders. A customer uses it to follow a job, including the estimate, messages, approval, and payment. A mobile app is being built and is not in the app stores yet. Until it is available, you use the website, including in a phone browser. On iPhone, use Safari and Add to Home Screen if you want the site on your home screen.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Members are free</h2>
            <p className="mt-2">
              A member is a shop-side user: the shop owner and that shop&apos;s employees, including technicians and managers. FixTray is free for members. FixTray does not charge members a subscription. FixTray does not publish a member price. Creating a shop account, adding a technician or a manager, and using the shop&apos;s work-order tools do not create a member bill.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">What a customer pays</h2>
            <p className="mt-2">
              A customer is the shop&apos;s client, not a member. When a customer pays by card, the charge is the shop&apos;s quote plus a FixTray service fee when that fee applies. The fee named in the product is a flat {fee} per paid work order. That amount is charged when the platform has not configured a different fee. The fee, if any, is shown on the invoice and at checkout before the customer pays, and the amount shown is the amount charged. No service fee is added when the quote is zero or the configured fee is zero. The shop receives the quote on its connected Stripe account. FixTray retains the service fee. If the shop has not connected Stripe, FixTray does not charge that invoice. Card payments are processed by Stripe. Members are not charged this fee.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Accounts</h2>
            <p className="mt-2">
              Shop registration and customer registration are separate. You are responsible for the password on your account. Keep it to yourself. Do not use someone else&apos;s account. A shop decides who on its team may sign in as a technician or a manager. You must provide information that is accurate enough for the account to work, and you must use the site in line with the law.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Demo shops</h2>
            <p className="mt-2">
              A demo is a login for a demo shop, emailed after you enter an email address. It is not a meeting and it is not a calendar booking. The demo shop is only so you can see if you like FixTray before you sign up. Do not do real work in it. It is not your shop. The demo lasts 30 minutes. The 30 minutes start at the first login, not when the email is sent and not when the form is submitted. When the 30 minutes end, the password resets and any changes made in the demo shop reset too.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Approvals</h2>
            <p className="mt-2">
              A customer approves work by signing the estimate. The product does not treat a verbal go-ahead as that signature. The shop is responsible for the work it agrees to perform and for the prices it puts on an estimate.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Shops</h2>
            <p className="mt-2">
              A shop should keep job status, prices, and messages accurate. Shops are expected to do the work lawfully and not misuse a customer&apos;s information. A shop may use customer information to perform the job and to run that customer relationship. A shop may not sell that information or use the service to harm someone.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Acceptable use</h2>
            <p className="mt-2">
              Do not attempt to break into an account, interfere with the service, or use the service to commit fraud. Do not upload content you do not have the right to store. FixTray may suspend an account that breaks these terms or that puts other people&apos;s information at risk.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Stopping</h2>
            <p className="mt-2">
              You can stop using the site at any time. There is no self-serve button that deletes an account. Email support@fixtray.app and we will handle an account question, including a request to delete information, as described in the privacy policy.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">The service as it is</h2>
            <p className="mt-2">
              FixTray provides the website as it works today. A shop is responsible for its own repair work and for what it tells a customer. To the extent the law allows, FixTray is not liable for indirect or consequential damages arising from use of the site, and the service is provided without a warranty beyond what the law requires. Nothing in this section limits a liability that the law does not allow us to limit.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Changes</h2>
            <p className="mt-2">
              We may update these terms. The date at the top of this page will change when we do. The version on the website is the current one. If you keep using the site after an update, you are using it under the updated terms.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Contact</h2>
            <p className="mt-2">
              Email support@fixtray.app.
            </p>
          </section>
          <p>
            <Link href="/contact" className="text-white hover:underline">Contact</Link>
            {" · "}
            <Link href="/privacy" className="text-white hover:underline">Privacy</Link>
            {" · "}
            <Link href="/demo" className="text-white hover:underline">Try the demo shop</Link>
          </p>
        </div>
      </article>
    </MarketingShell>
  );
}
