"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import OilSlickCanvas from "@/components/OilSlickCanvas";
import { BrandWordmark } from "@/components/BrandLogo";

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" }
];

interface MarketingShellProps {
  children: ReactNode;
}

export default function MarketingShell({ children }: MarketingShellProps) {
  const pageStyle: React.CSSProperties = {
    background: "#09090b",
    fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
    position: "relative",
  };

  return (
    <div className="min-h-screen text-slate-100" style={pageStyle}>
      <OilSlickCanvas intensity="subtle" />

      <header
        className="relative border-b backdrop-blur"
        style={{
          zIndex: 10,
          borderColor: "rgba(255,255,255,0.08)",
          background: "rgba(9, 9, 11, 0.92)",
        }}
      >
        <div
          className="flex items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-6 sm:py-3"
          style={{ width: "100%", maxWidth: 1152, marginLeft: "auto", marginRight: "auto" }}
        >
          <Link href="/" className="min-w-0 shrink">
            <BrandWordmark variant="header" priority />
          </Link>

          <nav className="hidden items-center gap-6 text-sm md:flex" style={{ color: "#94a3b8" }}>
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href as Route} className="transition hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
            <Link href="/auth/login" style={{ color: "#94a3b8" }} className="whitespace-nowrap text-xs transition hover:text-white sm:text-sm">
              Log in
            </Link>
            <Link
              href="/auth/login"
              className="whitespace-nowrap rounded-[9px] px-3 py-1.5 text-xs font-bold text-white transition sm:px-[18px] sm:py-2 sm:text-[13px]"
              style={{
                background: "#e5332a",
                boxShadow: "0 2px 10px rgba(229,51,42,0.35)",
              }}
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="relative" style={{ zIndex: 1 }} data-marketing-main>
        {children}
      </main>

      <footer
        className="relative border-t"
        style={{
          zIndex: 1,
          borderColor: "rgba(255,255,255,0.08)",
          background: "rgba(9, 9, 11, 0.92)",
        }}
      >
        <div
          className="grid max-w-6xl gap-8 px-6 py-12 text-center md:grid-cols-4 md:text-left"
          style={{ width: "100%", maxWidth: 1152, marginLeft: "auto", marginRight: "auto" }}
        >
          <div>
            <BrandWordmark variant="footer" className="mx-auto md:mx-0" />
            <p className="mt-3 text-sm" style={{ color: "#94a3b8" }}>
              The command center for modern work orders, approvals, and customer-ready updates.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: "#94a3b8" }}>Product</p>
            <ul className="mt-4 space-y-2 text-sm" style={{ color: "#cbd5e1" }}>
              <li><Link href="/features" className="hover:text-white">Features</Link></li>
              <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
              <li><Link href="/security" className="hover:text-white">Security</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: "#94a3b8" }}>Company</p>
            <ul className="mt-4 space-y-2 text-sm" style={{ color: "#cbd5e1" }}>
              <li><Link href="/about" className="hover:text-white">About</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: "#94a3b8" }}>Support</p>
            <ul className="mt-4 space-y-2 text-sm" style={{ color: "#cbd5e1" }}>
              <li><Link href="/contact" className="hover:text-white">Help Center</Link></li>
              <li><Link href="/contact" className="hover:text-white">Book a demo</Link></li>
            </ul>
          </div>
        </div>
        <div
          className="flex flex-wrap items-center justify-center gap-4 px-6 py-6 text-center text-xs"
          style={{
            width: "100%",
            maxWidth: 1152,
            marginLeft: "auto",
            marginRight: "auto",
            color: "#64748b",
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <span> 2026 FixTray. All rights reserved.</span>
          <span>Built for owner-operators, growing shop teams, and multi-shop service groups.</span>
        </div>
      </footer>
    </div>
  );
}
