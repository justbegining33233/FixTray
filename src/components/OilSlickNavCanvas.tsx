"use client";

import { useEffect, useRef } from "react";

/**
 * MechanicalNavCanvas
 * Compact mechanical-parts animation sized to fill its parent container.
 * Shows tiny gears, bolts, and spark particles drifting horizontally —
 * matching the MechanicalCanvas full-page background theme.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

type NavPartKind = "gear" | "bolt" | "spark";

interface NavPart {
  kind: NavPartKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  rotSpeed: number;
  scale: number;
  alpha: number;
  life?: number;
  maxLife?: number;
}

// ─── Colour constants ────────────────────────────────────────────────────────

const STEEL  = "rgba(148,162,175,";
const IRON   = "rgba(100,108,116,";
const AMBER  = "rgba(200,155, 80,";
const CHROME = "rgba(190,200,210,";
const SPARK  = "rgba(255,200, 80,";

// ─── Drawing ─────────────────────────────────────────────────────────────────

function drawNavGear(c: CanvasRenderingContext2D, r: number, alpha: number) {
  const teeth = 9;
  const toothH = r * 0.3;
  const innerR = r - toothH * 0.55;
  const tw = (2 * Math.PI) / teeth;

  c.globalAlpha = alpha;
  c.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = i * tw - tw * 0.38;
    const a1 = i * tw - tw * 0.18;
    const a2 = i * tw + tw * 0.18;
    const a3 = i * tw + tw * 0.38;
    if (i === 0) c.moveTo(innerR * Math.cos(a0), innerR * Math.sin(a0));
    c.lineTo(r * Math.cos(a1), r * Math.sin(a1));
    c.lineTo((r + toothH * 0.5) * Math.cos((a1 + a2) / 2), (r + toothH * 0.5) * Math.sin((a1 + a2) / 2));
    c.lineTo(r * Math.cos(a2), r * Math.sin(a2));
    c.lineTo(innerR * Math.cos(a3), innerR * Math.sin(a3));
  }
  c.closePath();
  c.fillStyle = IRON + "0.5)";
  c.fill();
  c.strokeStyle = STEEL + "0.9)";
  c.lineWidth = 0.8;
  c.stroke();
  // bore
  c.beginPath();
  c.arc(0, 0, innerR * 0.3, 0, Math.PI * 2);
  c.fillStyle = IRON + "0.9)";
  c.fill();
  c.strokeStyle = CHROME + "0.6)";
  c.lineWidth = 0.6;
  c.stroke();
  c.globalAlpha = 1;
}

function drawNavBolt(c: CanvasRenderingContext2D, r: number, alpha: number) {
  const hexR = r;
  const shankL = r * 2.4;
  const shankW = r * 0.5;

  c.globalAlpha = alpha;
  // shank
  c.beginPath();
  c.rect(-shankW / 2, 0, shankW, shankL);
  c.fillStyle = STEEL + "0.6)";
  c.fill();
  // threads
  c.strokeStyle = IRON + "0.8)";
  c.lineWidth = 0.5;
  for (let i = 1; i <= 5; i++) {
    const ty = (i / 6) * shankL;
    c.beginPath();
    c.moveTo(-shankW / 2, ty);
    c.lineTo(shankW / 2, ty);
    c.stroke();
  }
  // hex head
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const ha = (i / 6) * Math.PI * 2 - Math.PI / 6;
    const px = hexR * Math.cos(ha);
    const py = hexR * Math.sin(ha) - hexR * 0.05;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  c.fillStyle = AMBER + "0.7)";
  c.fill();
  c.strokeStyle = CHROME + "0.75)";
  c.lineWidth = 0.7;
  c.stroke();
  c.globalAlpha = 1;
}

// ─── Spawners ────────────────────────────────────────────────────────────────

function spawnNavPart(kind: NavPartKind, w: number, h: number): NavPart {
  return {
    kind,
    x: kind === "spark" ? Math.random() * w : -20 - Math.random() * 40,
    y: Math.random() * h,
    vx: kind === "spark" ? (Math.random() - 0.5) * 1.2 : 0.3 + Math.random() * 0.6,
    vy: kind === "spark" ? (Math.random() - 0.5) * 0.8 : (Math.random() - 0.5) * 0.08,
    angle: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.025,
    scale: 0.4 + Math.random() * 0.5,
    alpha: 0.12 + Math.random() * 0.18,
    life: kind === "spark" ? 0 : undefined,
    maxLife: kind === "spark" ? 20 + Math.random() * 25 : undefined,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OilSlickNavCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const c = ctx;

    const parent = canvas.parentElement;
    let w = parent ? parent.offsetWidth : window.innerWidth;
    let h = parent ? parent.offsetHeight : 52;
    canvas.width = w;
    canvas.height = h;

    let animId: number;
    let sparkTimer = 0;

    // Populate with gears and bolts drifting right
    const parts: NavPart[] = [];
    const gearCount = Math.max(3, Math.floor(w / 200));
    const boltCount = Math.max(4, Math.floor(w / 120));

    for (let i = 0; i < gearCount; i++) {
      const p = spawnNavPart("gear", w, h);
      p.x = Math.random() * w; // scatter initially
      parts.push(p);
    }
    for (let i = 0; i < boltCount; i++) {
      const p = spawnNavPart("bolt", w, h);
      p.x = Math.random() * w;
      parts.push(p);
    }

    const sparks: NavPart[] = [];

    function frame() {
      // Dark background
      c.fillStyle = "#111214";
      c.fillRect(0, 0, w, h);

      // Subtle horizontal line
      c.strokeStyle = "rgba(255,255,255,0.04)";
      c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();

      // Update & draw parts
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.rotSpeed;

        if (p.x > w + 30) {
          p.x = -25;
          p.y = Math.random() * h;
        }

        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.angle);
        c.scale(p.scale, p.scale);

        if (p.kind === "gear") {
          drawNavGear(c, 10, p.alpha);
        } else if (p.kind === "bolt") {
          drawNavBolt(c, 5, p.alpha);
        }

        c.restore();
      }

      // Sparks
      sparkTimer++;
      if (sparkTimer > 55 && sparks.length < 20) {
        sparkTimer = 0;
        const src = parts[Math.floor(Math.random() * parts.length)];
        for (let s = 0; s < 2; s++) {
          sparks.push(spawnNavPart("spark", w, h));
          sparks[sparks.length - 1].x = src.x;
          sparks[sparks.length - 1].y = src.y;
        }
      }

      for (let si = sparks.length - 1; si >= 0; si--) {
        const s = sparks[si];
        s.x += s.vx;
        s.y += s.vy;
        s.life = (s.life ?? 0) + 1;
        const lifeAlpha = 1 - (s.life ?? 0) / (s.maxLife ?? 30);
        c.globalAlpha = lifeAlpha * 0.7;
        c.beginPath();
        c.arc(s.x, s.y, 1.0, 0, Math.PI * 2);
        c.fillStyle = SPARK + "1)";
        c.fill();
        c.globalAlpha = 1;
        if ((s.life ?? 0) >= (s.maxLife ?? 30)) sparks.splice(si, 1);
      }

      animId = requestAnimationFrame(frame);
    }

    frame();

    const onResize = () => {
      if (!parent) return;
      w = canvas.width = parent.offsetWidth;
      h = canvas.height = parent.offsetHeight;
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        display: "block",
        pointerEvents: "none",
      }}
    />
  );
}
