"use client";

import dynamic from 'next/dynamic';
import Link from "next/link";
import Image from "next/image";

const MarketingShell = dynamic(() => import("@/components/MarketingShell"), {
  loading: () => (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white text-xl">Loading FixTray...</div>
    </div>
  ),
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

const platformHighlights = [
  {
    title: "Role-based control",
    detail: "Admin, superadmin, shop, manager, tech, and customer experiences tied to one data model.",
  },
  {
    title: "Work order lifecycle",
    detail: "From intake and dispatch to approvals, invoicing, payment, and close-out with live status history.",
  },
  {
    title: "Real-time operations",
    detail: "Messaging, notifications, GPS tracking, and team activity flow through the same platform timeline.",
  },
  {
    title: "Business intelligence",
    detail: "Analytics, payroll, labor, inventory, and financial reporting in operational context.",
  },
  {
    title: "Specialized shop tooling",
    detail: "DVI, core returns, loaners, state inspections, fleets, AR aging, and environmental fee workflows.",
  },
  {
    title: "Platform-ready foundation",
    detail: "Security events, API keys, webhooks, multi-location controls, and deployment tooling.",
  },
];

const roleCenters = [
  {
    role: "Super Admin",
    summary: "Platform infrastructure, shop visibility, deployments, system analytics, and global controls.",
  },
  {
    role: "Admin",
    summary: "Shop approvals, customer and user oversight, revenue, backups, and command center operations.",
  },
  {
    role: "Shop Owner",
    summary: "Work orders, staffing, payroll, templates, vendors, scheduling, and full business execution.",
  },
  {
    role: "Manager",
    summary: "Daily assignment flow, estimates, team permissions, inventory supervision, and operational accountability.",
  },
  {
    role: "Technician",
    summary: "Roadside and in-shop jobs, diagnostics, photos, parts checks, time tracking, and customer communication.",
  },
  {
    role: "Customer",
    summary: "Booking, approvals, messages, vehicles, rewards, payments, history, and live service visibility.",
  },
];

const operations = [
  "Work order creation, assignment, and status orchestration",
  "Messaging, unread counters, notifications, and customer communication",
  "Shop scheduling, blocked dates, bays, and capacity control",
  "Inventory stock, low-stock logic, purchase orders, and vendor workflows",
  "Payroll schedules, attendance, overtime, pay periods, and paystubs",
  "Recurring work orders and recurring approval handling",
  "Stripe checkout, portal, links, and webhook processing",
  "Reviews, referrals, campaigns, and customer insights",
];

const reliability = [
  "JWT auth, CSRF controls, role-based route gating",
  "Session and security event pipelines with hardened fallbacks",
  "Rate limit support, health endpoints, and diagnostics",
  "Offline-aware mobile patterns and native integration hooks",
  "Production build + route scanning workflow for broken-link prevention",
];

const carouselSlides = [
  {
    src: "/images/landing-carousel/admin-home.jpg",
    title: "Admin Command Center",
    caption: "Daily platform oversight, approvals, and core operations in one view.",
  },
  {
    src: "/images/landing-carousel/admin-user-management.jpg",
    title: "User Management",
    caption: "Central control over accounts, roles, and lifecycle actions.",
  },
  {
    src: "/images/landing-carousel/admin-guide.jpg",
    title: "Live Feature Guide",
    caption: "A detailed map of active modules, routes, and operational coverage.",
  },
  {
    src: "/images/landing-carousel/features-page.jpg",
    title: "Features Overview",
    caption: "Public-facing product breakdown of real workflow capabilities.",
  },
  {
    src: "/images/landing-carousel/pricing-page.jpg",
    title: "Capabilities",
    caption: "Operational modules aligned to shop size, team growth, and multi-location scale.",
  },
  {
    src: "/images/landing-carousel/contact-page.jpg",
    title: "Contact & Onboarding",
    caption: "Direct intake path for demos, onboarding, and rollout planning.",
  },
];

export default function Home() {
  return (
    <MarketingShell>
      <section
        className="mx-auto flex min-h-[74vh] max-w-5xl flex-col items-center justify-center px-6 pb-16 pt-24 text-center"
        style={{ width: '100%', maxWidth: 1120, marginLeft: 'auto', marginRight: 'auto' }}
      >
        <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em]" style={neonBadge}>
          <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#e5332a" }} />
          FixTray Platform Overview
        </div>

        <h1 className="mt-8 text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
          One operating system for
          <span
            style={{
              display: 'block',
              background: "linear-gradient(90deg, #e5332a, #ff6b5e, #ff948d)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            modern auto service operations
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-3xl text-lg text-slate-300">
          FixTray now unifies every major workflow in the app: role-driven portals, real-time communications,
          work order orchestration, payroll, inventory, analytics, customer lifecycle, and specialized shop services.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <Link href="/auth/login" className="rounded-xl px-7 py-3 text-sm font-semibold transition hover:opacity-90" style={primaryBtn}>
            Open FixTray
          </Link>
          <Link href="/contact" className="rounded-xl px-7 py-3 text-sm font-semibold transition" style={ghostBtn}>
            Talk to sales
          </Link>
        </div>

        <div className="mt-14 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Role experiences", value: "6" },
            { label: "Major operational modules", value: "20+" },
            { label: "API routes in production", value: "150+" },
            { label: "Realtime + automation", value: "Built in" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl px-6 py-5" style={glassCard}>
              <p className="text-2xl font-semibold text-white">{s.value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.25em]" style={{ color: "#94a3b8" }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-3 pb-24" style={{ width: '100%', marginLeft: 'auto', marginRight: 'auto' }}>
        <div className="flex flex-col items-center text-center gap-3 px-3 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: "#94a3b8" }}>Visual product tour</p>
          <h2 className="text-3xl font-semibold text-white">Live dashboards and feature surfaces</h2>
          <p className="max-w-3xl text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
            Captured from the running app for clear, non-blurry previews of real admin and superadmin workflows.
          </p>
        </div>

        <div className="relative mt-10 overflow-hidden rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.10)", background: "rgba(8,13,26,0.6)" }}>
          <div className="carousel-track flex w-max gap-4 p-4">
            {[...carouselSlides, ...carouselSlides].map((slide, idx) => (
              <article key={`${slide.src}-${idx}`} className="w-[340px] sm:w-[420px] lg:w-[520px] shrink-0 overflow-hidden rounded-xl border" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(2,6,23,0.85)" }}>
                <div className="relative h-[210px] sm:h-[260px] lg:h-[300px]">
                  <Image
                    className="carousel-shot"
                    src={slide.src}
                    alt={slide.title}
                    fill
                    sizes="(max-width: 640px) 340px, (max-width: 1024px) 420px, 520px"
                    style={{ objectFit: "cover", objectPosition: "left top" }}
                    quality={75}
                    priority={idx < carouselSlides.length}
                  />
                </div>
                <div className="px-4 py-3">
                  <p className="text-sm font-semibold text-white">{slide.title}</p>
                  <p className="mt-1 text-xs" style={{ color: "#94a3b8" }}>{slide.caption}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24" style={{ width: '100%', maxWidth: 1152, marginLeft: 'auto', marginRight: 'auto' }}>
        <div className="flex flex-col items-center text-center gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: "#94a3b8" }}>Current platform scope</p>
          <h2 className="text-3xl font-semibold text-white">What is live in FixTray today</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {platformHighlights.map((item) => (
            <div key={item.title} className="rounded-2xl p-6" style={glassCard}>
              <p className="text-lg font-semibold text-white">{item.title}</p>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "#94a3b8" }}>{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 lg:grid-cols-2" style={{ width: '100%', maxWidth: 1152, marginLeft: 'auto', marginRight: 'auto' }}>
        <div className="rounded-2xl p-7" style={glassCard}>
          <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: "#94a3b8" }}>Role command centers</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">Every team works in context</h3>
          <div className="mt-6 grid gap-3">
            {roleCenters.map((entry) => (
              <div
                key={entry.role}
                className="rounded-xl px-4 py-3"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <p className="text-sm font-semibold text-white">{entry.role}</p>
                <p className="mt-1 text-sm" style={{ color: "#94a3b8" }}>{entry.summary}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-7" style={glassCard}>
          <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: "#94a3b8" }}>Operational depth</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">Beyond basic work orders</h3>
          <div className="mt-6 grid gap-3">
            {operations.map((line) => (
              <div key={line} className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: "#e5332a" }} />
                <p className="text-sm" style={{ color: "#cbd5e1" }}>{line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24" style={{ width: '100%', maxWidth: 1152, marginLeft: 'auto', marginRight: 'auto' }}>
        <div className="rounded-2xl px-8 py-10" style={{ background: "rgba(8,13,26,0.75)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: "#94a3b8" }}>Reliability and security</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">Production hardening built into the app</h3>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "#cbd5e1" }}>
                FixTray includes route protection, session governance, hardened auth flows, scanning-driven link validation,
                and production-safe fallbacks for advanced operational surfaces.
              </p>
            </div>
            <div className="grid gap-3">
              {reliability.map((item) => (
                <div key={item} className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-sm" style={{ color: "#cbd5e1" }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
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
              <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: "#94a3b8" }}>Ready to run</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">Everything your team needs is now in one place.</h3>
              <p className="mt-2 text-sm" style={{ color: "#cbd5e1" }}>
                Launch fast with the complete FixTray workflow stack, from customer intake to final payment and reporting.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/auth/login" className="rounded-xl px-7 py-3 text-sm font-semibold transition hover:opacity-90" style={primaryBtn}>
                Sign in
              </Link>
              <Link href="/register/customer" className="rounded-xl px-7 py-3 text-sm font-semibold transition" style={ghostBtn}>
                Create customer account
              </Link>
              <Link href="/auth/register/shop" className="rounded-xl px-7 py-3 text-sm font-semibold transition" style={ghostBtn}>
                Register your shop
              </Link>
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        .carousel-track {
          animation: carouselScroll 52s linear infinite;
        }

        .carousel-track:hover {
          animation-play-state: paused;
        }

        .carousel-shot {
          clip-path: inset(0 14px 0 0);
        }

        @keyframes carouselScroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </MarketingShell>
  );
}



