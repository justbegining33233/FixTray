"use client";

import { useState, FormEvent } from "react";
import MarketingShell from "@/components/MarketingShell";

export default function DemoPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "We could not send the demo login.");
      }
      setStatus("sent");
      setEmail("");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "We could not send the demo login.");
    }
  }

  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-24 text-slate-300">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Demo</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Try a demo shop</h1>
        <div className="mt-6 space-y-4 text-sm leading-7">
          <p>
            Enter your email. We will email you a username and password for a demo shop. This is not a meeting, and we do not book a time on a calendar.
          </p>
          <p>
            This demo shop is only so you can see if you like FixTray before signing up. Do not do real work in it. It is not your shop.
          </p>
          <p>
            The demo lasts 30 minutes. The 30 minutes start at your first login. They do not start when the email is sent, and they do not start when you submit this form.
          </p>
          <p>
            When the 30 minutes end, the password resets and any changes made in the demo shop reset too.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 rounded-3xl border border-white/10 bg-black p-8">
          <label htmlFor="demo-email" className="text-sm font-semibold text-white">Email</label>
          <input
            id="demo-email"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
            placeholder="you@shop.com"
            autoComplete="email"
          />
          {status === "sent" && (
            <p className="mt-4 text-sm text-emerald-400">
              Check that email for the demo shop username and password. The 30 minutes start when you first log in.
            </p>
          )}
          {status === "error" && (
            <p className="mt-4 text-sm text-red-400">{errorMsg}</p>
          )}
          <button
            type="submit"
            disabled={status === "sending"}
            className="mt-6 rounded-full px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#e5332a" }}
          >
            {status === "sending" ? "Sending..." : "Email me a demo login"}
          </button>
        </form>
      </article>
    </MarketingShell>
  );
}
