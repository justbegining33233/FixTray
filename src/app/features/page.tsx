"use client";

import { usePhrase } from '@/lib/usePhrase';
import Link from "next/link";
import MarketingShell from "@/components/MarketingShell";

export default function FeaturesPage() {
  const say = usePhrase();
  const glassCardStyle: React.CSSProperties = {
    background: "linear-gradient(145deg, rgba(15,23,42,0.78) 0%, rgba(30,41,59,0.88) 100%)",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 26,
    boxShadow: "0 30px 70px rgba(15, 23, 42, 0.45)"
  };

  return (
    <MarketingShell>
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">{say("Features")}</p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
          {say("The full stack for world-class work orders.")}{' '}</h1>
        <p className="mt-5 mx-auto max-w-2xl text-lg text-slate-300">
          {say("FixTray covers the full operating loop: work orders, dispatch, customer communication, team workflow, inventory, payroll, analytics, and multi-shop growth.")}{' '}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/auth/login" className="rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30">
            {say("Start free")}{' '}</Link>
          <Link href="/pricing" className="rounded-full border border-white/10 bg-black px-6 py-3 text-sm font-semibold text-slate-200">
            {say("View pricing")}{' '}</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 text-center">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { title: say("Work order control"), detail: say("Manage intake, assignment, approvals, estimates, payments, and closeout from one system.") },
            { title: say("Dispatch + routing"), detail: say("Coordinate teams by role, availability, status, and location context.") },
            { title: say("Customer communication"), detail: say("Send approvals, updates, documents, and messages from the same workflow.") },
            { title: say("Mobile tech suite"), detail: say("Run time tracking, photos, inspections, and field updates from technician-ready screens.") },
            { title: say("Operational finance"), detail: say("Handle inventory, payroll, budget tracking, and reporting without separate back-office tooling.") },
            { title: say("Multi-shop visibility"), detail: say("Professional and above can operate multiple shops with shared owner-level oversight.") }
          ].map((item) => (
            <div key={item.title} className="rounded-3xl p-6 text-center" style={glassCardStyle}>
              <p className="text-lg font-semibold text-white">{say(item.title)}</p>
              <p className="mt-3 text-sm text-slate-300">{say(item.detail)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24 text-center">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-black p-8 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{say("Automation")}</p>
            <h2 className="mt-4 text-2xl font-semibold text-white">{say("Let the workflow run itself.")}</h2>
            <p className="mt-4 text-sm text-slate-300">
              {say("Automate milestone-based updates, approvals, recurring work, reminders, and handoffs without manual chasing.")}{' '}</p>
            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              {[
                say("SLA alerts and escalation paths"),
                say("Recurring work orders and reminder flows"),
                say("Customer email and message sequences")
              ].map((item) => (
                <li key={item} className="flex items-center justify-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  {say(item)}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black p-8 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{say("Mobile first")}</p>
            <h2 className="mt-4 text-2xl font-semibold text-white">{say("Technicians stay in flow.")}</h2>
            <p className="mt-4 text-sm text-slate-300">
              {say("Techs can clock time, capture photos, complete inspections, message the shop, and keep jobs moving without paperwork.")}{' '}</p>
            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              {[
                say("Offline capture and sync"),
                say("Photo, signature, and inspection capture"),
                say("Live routing and field-ready job context")
              ].map((item) => (
                <li key={item} className="flex items-center justify-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-pink-400" />
                  {say(item)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
