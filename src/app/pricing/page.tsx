"use client";

import Link from "next/link";
import MarketingShell from "@/components/MarketingShell";

const capabilityGroups = [
  {
    title: "Daily Operations",
    items: ["Work order intake and dispatch", "Status tracking and approvals", "Messaging and customer updates"],
  },
  {
    title: "Shop Management",
    items: ["Team roles and permissions", "Service catalog and scheduling", "Inventory and vendor workflows"],
  },
  {
    title: "Business Control",
    items: ["Analytics and reporting", "Payroll and labor visibility", "Audit-friendly activity history"],
  },
];

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Capabilities</p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">Everything your shop needs in one platform.</h1>
        <p className="mt-5 text-lg text-slate-300">FixTray combines operations, communication, and reporting so your team can run faster with fewer handoffs.</p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {capabilityGroups.map((group) => (
            <div key={group.title} className="rounded-3xl border border-white/10 bg-black p-6">
              <h2 className="text-xl font-semibold text-white">{group.title}</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-200">
                {group.items.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href="/auth/login" className="inline-flex items-center justify-center rounded-full border border-slate-700/70 px-6 py-3 text-sm font-semibold text-slate-100">
            Start With FixTray
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
