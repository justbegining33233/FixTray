"use client";

import { usePhrase } from '@/lib/usePhrase';
import MarketingShell from "@/components/MarketingShell";

export default function SecurityPage() {
  const say = usePhrase();
  return (
    <MarketingShell>
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">{say("Security")}</p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">{say("Security that matches the product.")}</h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-300">
          {say("FixTray ships practical, verifiable safeguards in the codebase today  -  authentication, authorization, CSRF protection, rate limiting, and input validation.")}{' '}</p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            { title: say("Role-based access"), detail: say("API endpoints enforce roles with requireAuth and requireRole.") },
            { title: say("JWT authentication"), detail: say("Access tokens are verified on protected routes.") },
            { title: say("Password hashing"), detail: say("User passwords are hashed with bcrypt.") },
            { title: say("CSRF protection"), detail: say("State-changing requests use CSRF tokens and double-submit validation.") },
            { title: say("Rate limiting"), detail: say("Auth and API routes apply request throttling.") },
            { title: say("Input validation"), detail: say("Requests are validated and sanitized before persistence.") },
            { title: say("Audit logging"), detail: say("Admin activity logs are recorded and retrievable via API.") }
          ].map((item) => (
            <div key={item.title} className="rounded-3xl border border-white/10 bg-black p-6">
              <p className="text-lg font-semibold text-white">{say(item.title)}</p>
              <p className="mt-3 text-sm text-slate-300">{say(item.detail)}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
