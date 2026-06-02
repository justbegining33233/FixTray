"use client";

import { useState, FormEvent } from "react";
import MarketingShell from "@/components/MarketingShell";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), company: company.trim(), message: message.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("sent");
      setName("");
      setEmail("");
      setCompany("");
      setMessage("");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "Failed to send message");
    }
  }

  return (
    <MarketingShell>
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Contact</p>
        <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">Let's build your command center.</h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-300">
          Tell us about your operation and we'll tailor the rollout. Expect a response within one business day.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-black p-8">
            <h2 className="text-2xl font-semibold text-white">Contact details</h2>
            <ul className="mt-6 space-y-4 text-sm text-slate-300">
              <li><span className="text-slate-500">Email:</span> support@fixtray.app</li>
              <li><span className="text-slate-500">Availability:</span> Mon-Fri, 8am-6pm</li>
            </ul>
          </div>
          <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-black p-8">
            <div className="grid gap-4">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                placeholder="Full name"
              />
              <input
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                placeholder="Work email"
                type="email"
              />
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                placeholder="Company"
              />
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                placeholder="Tell us about your operation"
              />

              {status === "sent" && (
                <p className="text-sm text-emerald-400">Message sent! We&apos;ll be in touch shortly.</p>
              )}
              {status === "error" && (
                <p className="text-sm text-red-400">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 disabled:opacity-50"
              >
                {status === "sending" ? "Sending..." : "Send message"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </MarketingShell>
  );
}
