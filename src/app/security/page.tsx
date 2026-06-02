"use client";

import MarketingShell from "@/components/MarketingShell";

export default function SecurityPage() {
  return (
    <MarketingShell>
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Security</p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">Security that matches the product.</h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-300">
          FixTray ships practical, verifiable safeguards in the codebase today  -  authentication, authorization, CSRF protection, rate limiting, and input validation.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            { title: "Role-based access", detail: "API endpoints enforce roles with requireAuth and requireRole." },
            { title: "JWT authentication", detail: "Access tokens are verified on protected routes." },
            { title: "Password hashing", detail: "User passwords are hashed with bcrypt." },
            { title: "CSRF protection", detail: "State-changing requests use CSRF tokens and double-submit validation." },
            { title: "Rate limiting", detail: "Auth and API routes apply request throttling." },
            { title: "Input validation", detail: "Requests are validated and sanitized before persistence." },
            { title: "Audit logging", detail: "Admin activity logs are recorded and retrievable via API." }
          ].map((item) => (
            <div key={item.title} className="rounded-3xl border border-white/10 bg-black p-6">
              <p className="text-lg font-semibold text-white">{item.title}</p>
              <p className="mt-3 text-sm text-slate-300">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
