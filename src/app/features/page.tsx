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
          {say("Work orders for roadside and in the shop.")}{' '}</h1>
        <p className="mt-5 mx-auto max-w-2xl text-lg text-slate-300">
          {say("FixTray is a free work-order system for auto service. There is a shop account and a customer account. Role-based pages cover work orders, approvals, and customer-ready updates.")}{' '}</p>
        <p className="mt-4 mx-auto max-w-2xl text-sm leading-relaxed text-slate-300">
          {say("A shop can track parts inventory, run payroll from time entries, view work-order analytics, and switch between shops that share an email.")}{' '}</p>
        <p className="mt-4 mx-auto max-w-2xl text-sm leading-relaxed text-slate-300">
          {say("A mobile app is in development. Until then, FixTray works on the web. It also works on a phone you already have: open it in the phone's browser. On iPhone, use Safari and Add to Home Screen.")}{' '}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/get-started" className="rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30">
            {say("Get started")}{' '}</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 text-center">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            { title: say("Work orders"), detail: say("Intake, assignment, approvals, estimates, payments, and closeout.") },
            { title: say("Driving directions"), detail: say("On a road call or assigned job, a technician follows turn-by-turn directions on the job screen in the browser.") },
            { title: say("Customer communication"), detail: say("Messages and updates stay in the workflow. A denied estimate carries a notification flag so a person can look. The flag does not approve, deny, or hand the job off.") },
            { title: say("Technician screens"), detail: say("Run time tracking, photos, inspections, and field updates from technician screens in the browser.") },
            { title: say("Five roles"), detail: say("Platform owner, shop owner, manager, tech, and customer.") },
            { title: say("Messages and GPS"), detail: say("Messaging, notifications, GPS, and team activity stay with the job.") }
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
            <h2 className="mt-4 text-2xl font-semibold text-white">{say("Reminders and repeat work.")}</h2>
            <p className="mt-4 text-sm text-slate-300">
              {say("Shops can turn on appointment reminders, review requests, overdue invoice notes, and recurring work orders. Approvals still wait for the customer.")}{' '}</p>
            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              {[
                say("SLA timing for completed jobs"),
                say("Recurring work orders and reminder flows"),
                say("Email and text campaigns, plus reminder messages")
              ].map((item) => (
                <li key={item} className="flex items-center justify-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  {say(item)}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black p-8 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{say("On a phone")}</p>
            <h2 className="mt-4 text-2xl font-semibold text-white">{say("Technicians stay in flow.")}</h2>
            <p className="mt-4 text-sm text-slate-300">
              {say("Techs can clock time, capture photos, complete inspections, message the shop, and keep jobs moving without paperwork.")}{' '}</p>
            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              {[
                say("Save a job for offline use"),
                say("Photos, inspections, and customer signatures on approvals"),
                say("Road-call map, shared location, and the job on the tech's screen."),
                say("Turn-by-turn directions on the job screen in the phone browser")
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
