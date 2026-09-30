"use client";

import { useLayoutEffect } from 'react';
import { usePhrase } from '@/lib/usePhrase';
import dynamic from 'next/dynamic';
import Link from "next/link";
import {
  decodeIntroClaims,
  installedShellBootstrapScript,
  installedShellLaunchPath,
  isInstalledShellClient,
  readIntroSession,
} from '@/lib/nativeIntro';

function MarketingShellFallback() {
  const say = usePhrase();
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white text-xl">{say("Loading FixTray...")}</div>
    </div>
  );
}

const MarketingShell = dynamic(() => import("@/components/MarketingShell"), {
  loading: MarketingShellFallback,
});

const primaryBtn: React.CSSProperties = {
  background: "#e5332a",
  color: "#fff",
  boxShadow: "0 2px 18px rgba(229,51,42,0.45)",
};

const ghostBtn: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.13)",
  background: "rgba(255,255,255,0.05)",
  color: "#f1f5f9",
  backdropFilter: "blur(10px)",
};

const glassCard: React.CSSProperties = {
  background: "rgba(8, 13, 26, 0.75)",
  backdropFilter: "blur(12px) saturate(1.25)",
  WebkitBackdropFilter: "blur(12px) saturate(1.25)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
};

const neonBadge: React.CSSProperties = {
  background: "rgba(229,51,42,0.14)",
  border: "1px solid rgba(229,51,42,0.28)",
  color: "#ffb3ad",
};

const roles = [
  {
    role: "Platform owner",
    summary: "Runs the FixTray site and the shop accounts on it.",
  },
  {
    role: "Shop owner",
    summary: "Runs the shop's work orders, team, and customer updates.",
  },
  {
    role: "Manager",
    summary: "Assigns work and follows the shop's jobs.",
  },
  {
    role: "Technician",
    summary: "Works roadside and in-shop jobs, with directions on the job screen. A tech can save a job for offline use.",
  },
  {
    role: "Customer",
    summary: "Approves work and follows updates on their job.",
  },
];

const included = [
  "Messaging, notifications, GPS, and team activity.",
  "Driving directions on the job screen in the browser.",
  "Reminders and repeat work.",
  "SLA timing on completed jobs.",
  "Email and text campaigns.",
];

export default function Home() {
  const say = usePhrase();
  useLayoutEffect(() => {
    if (!isInstalledShellClient()) return;
    const home = installedShellLaunchPath(readIntroSession(window.localStorage, decodeIntroClaims));
    window.location.replace(home);
  }, []);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: installedShellBootstrapScript() }} />
    <MarketingShell>
      <section
        className="mx-auto flex min-h-[74vh] max-w-5xl flex-col items-center justify-center px-6 pb-16 pt-24 text-center"
        style={{ width: '100%', maxWidth: 1120, marginLeft: 'auto', marginRight: 'auto' }}
      >
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em]" style={neonBadge}>
          <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#e5332a" }} />
          {say("Free for auto service")}{' '}</div>

        <h1 className="mt-8 text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
          {say("Work orders for roadside and in the shop.")}{' '}</h1>

        <p className="mx-auto mt-5 max-w-3xl text-lg text-slate-300">
          {say("FixTray is a free work-order system for auto service. There is a shop account and a customer account. Role-based pages cover work orders, approvals, and customer-ready updates.")}{' '}</p>

        <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-slate-300">
          {say("A mobile app is in development. Until then, FixTray works on the web. It also works on a phone you already have: open it in the phone's browser. On iPhone, use Safari and Add to Home Screen.")}{' '}</p>

        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <Link href="/get-started" className="rounded-xl px-7 py-3 text-sm font-semibold transition hover:opacity-90" style={primaryBtn}>
            {say("Get started")}{' '}</Link>
          <Link href="/contact" className="rounded-xl px-7 py-3 text-sm font-semibold transition" style={ghostBtn}>
            {say("Contact us")}{' '}</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24" style={{ width: '100%', maxWidth: 1152, marginLeft: 'auto', marginRight: 'auto' }}>
        <div className="flex flex-col items-center text-center gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: "#94a3b8" }}>{say("Five roles")}</p>
          <h2 className="text-3xl font-semibold text-white">{say("Platform owner, shop owner, manager, tech, and customer.")}</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((item) => (
            <div key={item.role} className="rounded-2xl p-6" style={glassCard}>
              <p className="text-lg font-semibold text-white">{say(item.role)}</p>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "#94a3b8" }}>{say(item.summary)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24" style={{ width: '100%', maxWidth: 1152, marginLeft: 'auto', marginRight: 'auto' }}>
        <div className="rounded-2xl p-7" style={glassCard}>
          <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: "#94a3b8" }}>{say("With the job")}</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">{say("Messages, directions, reminders, and campaigns.")}</h3>
          <div className="mt-6 grid gap-3">
            {included.map((line) => (
              <div key={line} className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: "#e5332a" }} />
                <p className="text-sm" style={{ color: "#cbd5e1" }}>{say(line)}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>
            {say("A shop can track parts inventory, run payroll from time entries, view work-order analytics, and switch between shops that share an email.")}{' '}</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-28" style={{ width: '100%', maxWidth: 1152, marginLeft: 'auto', marginRight: 'auto' }}>
        <div
          className="rounded-2xl px-10 py-12"
          style={{
            background: "rgba(229,51,42,0.08)",
            border: "1px solid rgba(229,51,42,0.22)",
            backdropFilter: "blur(10px) saturate(1.2)",
            WebkitBackdropFilter: "blur(10px) saturate(1.2)",
          }}
        >
          <div className="flex flex-col items-center text-center gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: "#94a3b8" }}>{say("Accounts")}</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">{say("Shop account or customer account.")}</h3>
              <p className="mt-2 text-sm" style={{ color: "#cbd5e1" }}>
                {say("Sign in if you already have an account. Otherwise create the shop account or the customer account.")}{' '}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/auth/login" className="rounded-xl px-7 py-3 text-sm font-semibold transition hover:opacity-90" style={primaryBtn}>
                {say("Sign in")}{' '}</Link>
              <Link href="/register/customer" className="rounded-xl px-7 py-3 text-sm font-semibold transition" style={ghostBtn}>
                {say("Create customer account")}{' '}</Link>
              <Link href="/auth/register/shop" className="rounded-xl px-7 py-3 text-sm font-semibold transition" style={ghostBtn}>
                {say("Register your shop")}{' '}</Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
    </>
  );
}



