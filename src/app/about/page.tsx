"use client";

import MarketingShell from "@/components/MarketingShell";

export default function AboutPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">About</p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">We build the calm inside the chaos.</h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-300">
          FixTray is built for service operators who need one system for work orders, team coordination, customer communication, and multi-shop growth.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            { title: "Mission", detail: "Give shops one clear operating system for work orders, teams, customers, and operations." },
            { title: "Vision", detail: "Every shop should be able to scale from one bay to multiple locations without replacing its workflow stack." },
            { title: "Values", detail: "Operational clarity, practical speed, and honest product behavior over flashy shelfware." }
          ].map((item) => (
            <div key={item.title} className="rounded-3xl border border-white/10 bg-black p-6">
              <p className="text-lg font-semibold text-white">{item.title}</p>
              <p className="mt-3 text-sm text-slate-300">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl border border-white/10 bg-black p-8">
          <h2 className="text-2xl font-semibold text-white">Our story</h2>
          <p className="mt-4 text-sm text-slate-300">
            FixTray started inside a real service operation that had outgrown disconnected tools for dispatch, approvals, customer follow-up, payroll, and shop reporting. What began as an internal system became a platform designed to support both single-shop teams and multi-shop operators.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { year: "2022", detail: "First live deployment to replace manual work order coordination inside one active service operation." },
              { year: "2024", detail: "Expanded into messaging, inventory, reporting, and multi-shop ownership workflows." },
              { year: "2026", detail: "FixTray ships as a full operations platform for shops, teams, and larger service groups." }
            ].map((item) => (
              <div key={item.year} className="rounded-2xl border border-white/10 bg-black p-4">
                <p className="text-lg font-semibold text-white">{item.year}</p>
                <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
