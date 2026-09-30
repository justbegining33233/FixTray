import Link from "next/link";
import MarketingShell from "@/components/MarketingShell";

export default function TermsPage() {
  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-24 text-slate-300">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Terms</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Terms</h1>
        <p className="mt-3 text-sm text-slate-400">Last updated September 29, 2026.</p>
        <div className="mt-8 space-y-8 text-sm leading-7">
          <p>
            These terms describe the FixTray website as it works today. You are responsible for the password on your account. Use the site in line with the law. This page does not claim a certification.
          </p>
          <section>
            <h2 className="text-lg font-semibold text-white">The website</h2>
            <p className="mt-2">
              FixTray is a website where a shop runs work orders and a customer follows those jobs: estimates, messages, approvals, and payments. A mobile app is in development. Until then, you use the website, including in a phone browser.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Accounts</h2>
            <p className="mt-2">
              Shop registration and customer registration are separate. Keep your password to yourself. Do not use someone else&apos;s account.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Approvals and payment</h2>
            <p className="mt-2">
              A customer approves work by signing the estimate. The product does not treat a verbal go-ahead as that signature. Card payment goes through Stripe. The charge is the shop&apos;s quote plus a FixTray service fee, and the shop is paid the quote on its connected Stripe account. If the shop has not connected Stripe, the site does not charge that invoice.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Shops</h2>
            <p className="mt-2">
              A shop should keep job status, prices, and messages accurate. Shops are expected to do the work lawfully and not misuse a customer&apos;s information.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-white">Stopping</h2>
            <p className="mt-2">
              You can stop using the site. There is no self-serve button that deletes an account. Email support@fixtray.app with an account question.
            </p>
          </section>
          <p>
            <Link href="/contact" className="text-white hover:underline">Contact</Link>
            {" · "}
            <Link href="/privacy" className="text-white hover:underline">Privacy</Link>
          </p>
        </div>
      </article>
    </MarketingShell>
  );
}
