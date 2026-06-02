"use client";

import Link from "next/link";
import MarketingShell from "@/components/MarketingShell";

export default function FeaturesPage() {
  const glassCardStyle: React.CSSProperties = {
    background: "linear-gradient(145deg, rgba(15,23,42,0.78) 0%, rgba(30,41,59,0.88) 100%)",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 26,
    boxShadow: "0 30px 70px rgba(15, 23, 42, 0.45)"
  };

  return (
    <MarketingShell>
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Features</p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
          The full stack for world-class work orders.
        </h1>
        <p className="mt-5 mx-auto max-w-2xl text-lg text-slate-300">
          FixTray covers the full operating loop: work orders, dispatch, customer communication, team workflow, inventory, payroll, analytics, and multi-shop growth.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/auth/login" className="rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30">
            Start free
          </Link>
          <Link href="/pricing" className="rounded-full border border-white/10 bg-black px-6 py-3 text-sm font-semibold text-slate-200">
            View pricing
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 text-center">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Work order control", detail: "Manage intake, assignment, approvals, estimates, payments, and closeout from one system." },
            { title: "Dispatch + routing", detail: "Coordinate teams by role, availability, status, and location context." },
            { title: "Customer communication", detail: "Send approvals, updates, documents, and messages from the same workflow." },
            { title: "Mobile tech suite", detail: "Run time tracking, photos, inspections, and field updates from technician-ready screens." },
            { title: "Operational finance", detail: "Handle inventory, payroll, budget tracking, and reporting without separate back-office tooling." },
            { title: "Multi-shop visibility", detail: "Professional and above can operate multiple shops with shared owner-level oversight." }
          ].map((item) => (
            <div key={item.title} className="rounded-3xl p-6 text-center" style={glassCardStyle}>
              <p className="text-lg font-semibold text-white">{item.title}</p>
              <p className="mt-3 text-sm text-slate-300">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24 text-center">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-black p-8 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Automation</p>
            <h2 className="mt-4 text-2xl font-semibold text-white">Let the workflow run itself.</h2>
            <p className="mt-4 text-sm text-slate-300">
              Automate milestone-based updates, approvals, recurring work, reminders, and handoffs without manual chasing.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              {[
                "SLA alerts and escalation paths",
                "Recurring work orders and reminder flows",
                "Customer email and message sequences"
              ].map((item) => (
                <li key={item} className="flex items-center justify-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black p-8 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Mobile first</p>
            <h2 className="mt-4 text-2xl font-semibold text-white">Technicians stay in flow.</h2>
            <p className="mt-4 text-sm text-slate-300">
              Techs can clock time, capture photos, complete inspections, message the shop, and keep jobs moving without paperwork.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              {[
                "Offline capture and sync",
                "Photo, signature, and inspection capture",
                "Live routing and field-ready job context"
              ].map((item) => (
                <li key={item} className="flex items-center justify-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-pink-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
