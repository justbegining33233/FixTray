"use client";

import { usePhrase } from '@/lib/usePhrase';
import MarketingShell from "@/components/MarketingShell";

export default function AboutPage() {
  const say = usePhrase();
  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-6 pt-24 pb-24">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">{say("About")}</p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">{say("Work orders for roadside and in the shop.")}</h1>
        <p className="mt-5 text-lg text-slate-300">
          {say("FixTray is a free work-order system for auto service. There is a shop account and a customer account. Role-based pages cover work orders, approvals, and customer-ready updates.")}{' '}</p>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          {say("Platform owner, shop owner, manager, tech, and customer.")}{' '}</p>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          {say("A mobile app is in development. Until then, FixTray works on the web. It also works on a phone you already have: open it in the phone's browser. On iPhone, use Safari and Add to Home Screen.")}{' '}</p>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          {say("A shop can track parts inventory, run payroll from time entries, view work-order analytics, and switch between shops that share an email.")}{' '}</p>
      </section>
    </MarketingShell>
  );
}
