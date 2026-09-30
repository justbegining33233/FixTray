"use client";

import { usePhrase } from '@/lib/usePhrase';
import Link from "next/link";
import MarketingShell from "@/components/MarketingShell";

const primaryBtn: React.CSSProperties = {
  background: "#e5332a",
  color: "#fff",
  boxShadow: "0 2px 18px rgba(229,51,42,0.45)",
};

const ghostBtn: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.13)",
  background: "rgba(255,255,255,0.05)",
  color: "#f1f5f9",
};

export default function GetStartedPage() {
  const say = usePhrase();
  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-6 pb-24 pt-24 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">{say("Get started")}</p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">{say("Create an account")}</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-300">
          {say("Choose a shop account or a customer account. Log in is only for people who already have one.")}{' '}
        </p>
        <div className="mx-auto mt-10 grid max-w-xl gap-4 text-left">
          <Link href="/auth/register/shop" className="rounded-2xl px-6 py-5" style={primaryBtn}>
            <p className="text-base font-semibold">{say("Register your shop")}</p>
            <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
              {say("For a shop that runs jobs, estimates, and payments.")}{' '}
            </p>
          </Link>
          <Link href="/register/customer" className="rounded-2xl px-6 py-5" style={ghostBtn}>
            <p className="text-base font-semibold">{say("Create customer account")}</p>
            <p className="mt-1 text-sm text-slate-300">
              {say("For someone booking service and following a job.")}{' '}
            </p>
          </Link>
        </div>
        <p className="mt-8 text-sm text-slate-400">
          <Link href="/auth/login" className="text-slate-200 hover:text-white">{say("Log in")}</Link>
        </p>
      </section>
    </MarketingShell>
  );
}
