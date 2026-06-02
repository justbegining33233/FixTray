"use client";

import { useEffect, useRef } from "react";

/**
 * MechanicalCanvas
 * Dark garage-floor background with slowly drifting, rotating mechanical
 * components: gears, pistons, bolts, connecting rods, wrenches, and spark
 * particles — evoking an automotive shop rebuild in progress.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

type PartKind =
  | "gear"
  | "piston"
  | "bolt"
  | "connectingRod"
  | "wrench"
  | "spark";

interface Part {
  kind: PartKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  rotSpeed: number; // rad/frame
  scale: number;
  alpha: number;
  // For pulse breathing
  breathPhase: number;
  breathSpeed: number;
  // Spark-specific
  life?: number;
  maxLife?: number;
}

// ─── Counts ───────────────────────────────────────────────────────────────────

const BASE_GEAR_COUNT = 8;
const BASE_PISTON_COUNT = 5;
const BASE_BOLT_COUNT = 10;
const BASE_ROD_COUNT = 4;
const BASE_WRENCH_COUNT = 3;
const BASE_SPARK_MAX = 18;

// ─── Colour palette ───────────────────────────────────────────────────────────
// Muted steel blues, iron greys, warm oil-stained ambers

const STEEL = "rgba(148,162,175,";   // cool grey-blue
const IRON  = "rgba(100,108,116,";   // dark iron
const AMBER = "rgba(200,155, 80,";   // oil-stained brass/amber
const CHROME= "rgba(190,200,210,";   // bright chrome highlight
const SPARK_COL = "rgba(255,200, 80,"; // spark orange-yellow

// ─── Drawing helpers ─────────────────────────────────────────────────────────

function pathRoundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const rr = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  if (typeof c.roundRect === "function") {
    c.beginPath();
    c.roundRect(x, y, width, height, rr);
    return;
  }

  c.beginPath();
  c.moveTo(x + rr, y);
  c.lineTo(x + width - rr, y);
  c.quadraticCurveTo(x + width, y, x + width, y + rr);
  c.lineTo(x + width, y + height - rr);
  c.quadraticCurveTo(x + width, y + height, x + width - rr, y + height);
  c.lineTo(x + rr, y + height);
  c.quadraticCurveTo(x, y + height, x, y + height - rr);
  c.lineTo(x, y + rr);
  c.quadraticCurveTo(x, y, x + rr, y);
  c.closePath();
}

/** Draw a spur gear centred at origin. */
function drawGear(
  c: CanvasRenderingContext2D,
  teeth: number,
  r: number,
  alpha: number
) {
  const toothH = r * 0.28;
  const innerR = r - toothH * 0.6;
  const toothW = (2 * Math.PI) / teeth;

  c.globalAlpha = alpha;
  c.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = i * toothW - toothW * 0.38;
    const a1 = i * toothW - toothW * 0.18;
    const a2 = i * toothW + toothW * 0.18;
    const a3 = i * toothW + toothW * 0.38;
    if (i === 0) c.moveTo(innerR * Math.cos(a0), innerR * Math.sin(a0));
    c.lineTo(r * Math.cos(a1), r * Math.sin(a1));
    c.lineTo((r + toothH * 0.55) * Math.cos((a1 + a2) / 2), (r + toothH * 0.55) * Math.sin((a1 + a2) / 2));
    c.lineTo(r * Math.cos(a2), r * Math.sin(a2));
    c.lineTo(innerR * Math.cos(a3), innerR * Math.sin(a3));
  }
  c.closePath();
  c.strokeStyle = STEEL + "1)";
  c.fillStyle = IRON + "0.55)";
  c.lineWidth = 1.2;
  c.fill();
  c.stroke();

  // Bore hole
  c.beginPath();
  c.arc(0, 0, innerR * 0.32, 0, Math.PI * 2);
  c.fillStyle = IRON + "0.9)";
  c.fill();
  c.strokeStyle = CHROME + "0.7)";
  c.lineWidth = 0.8;
  c.stroke();

  // Spoke lines
  const spokes = Math.max(3, Math.floor(teeth / 5));
  for (let s = 0; s < spokes; s++) {
    const sa = (s / spokes) * Math.PI * 2;
    c.beginPath();
    c.moveTo(innerR * 0.35 * Math.cos(sa), innerR * 0.35 * Math.sin(sa));
    c.lineTo(innerR * 0.85 * Math.cos(sa), innerR * 0.85 * Math.sin(sa));
    c.strokeStyle = STEEL + "0.5)";
    c.lineWidth = 1.0;
    c.stroke();
  }

  c.globalAlpha = 1;
}

/** Draw a simplified engine piston + partial cylinder wall. */
function drawPiston(c: CanvasRenderingContext2D, r: number, alpha: number) {
  const h = r * 2.2;
  const w = r * 1.7;
  const ringH = r * 0.14;

  c.globalAlpha = alpha;

  // Cylinder walls (ghost)
  c.beginPath();
  c.moveTo(-w * 0.62, -h * 0.55);
  c.lineTo(-w * 0.62, h * 0.2);
  c.strokeStyle = STEEL + "0.25)";
  c.lineWidth = 1.5;
  c.stroke();
  c.beginPath();
  c.moveTo(w * 0.62, -h * 0.55);
  c.lineTo(w * 0.62, h * 0.2);
  c.stroke();

  // Piston body
  pathRoundRect(c, -w / 2, -h * 0.35, w, h * 0.7, 4);
  c.fillStyle = IRON + "0.7)";
  c.fill();
  c.strokeStyle = STEEL + "0.9)";
  c.lineWidth = 1.2;
  c.stroke();

  // Compression rings
  for (let i = 0; i < 3; i++) {
    const ry = -h * 0.18 + i * (ringH * 1.8);
    c.beginPath();
    c.rect(-w / 2 + 1, ry, w - 2, ringH);
    c.fillStyle = i === 0 ? CHROME + "0.8)" : STEEL + "0.5)";
    c.fill();
  }

  // Wrist pin
  c.beginPath();
  c.ellipse(0, h * 0.18, w * 0.12, r * 0.11, 0, 0, Math.PI * 2);
  c.fillStyle = CHROME + "0.85)";
  c.fill();
  c.strokeStyle = STEEL + "0.6)";
  c.lineWidth = 0.7;
  c.stroke();

  // Connecting rod stub
  c.beginPath();
  c.moveTo(0, h * 0.22);
  c.lineTo(0, h * 0.52);
  c.strokeStyle = AMBER + "0.7)";
  c.lineWidth = w * 0.18;
  c.stroke();

  c.globalAlpha = 1;
}

/** Draw a hex bolt with shank. */
function drawBolt(c: CanvasRenderingContext2D, r: number, alpha: number) {
  const hexR = r * 0.9;
  const shankL = r * 2.6;
  const shankW = r * 0.52;

  c.globalAlpha = alpha;

  // Shank
  c.beginPath();
  c.rect(-shankW / 2, 0, shankW, shankL);
  c.fillStyle = STEEL + "0.7)";
  c.fill();

  // Threads (simple lines)
  c.strokeStyle = IRON + "0.9)";
  c.lineWidth = 0.6;
  const threadCount = 7;
  for (let i = 1; i <= threadCount; i++) {
    const ty = (i / (threadCount + 1)) * shankL;
    c.beginPath();
    c.moveTo(-shankW / 2, ty);
    c.lineTo(shankW / 2, ty);
    c.stroke();
  }

  // Hex head
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const ha = (i / 6) * Math.PI * 2 - Math.PI / 6;
    const px = hexR * Math.cos(ha);
    const py = hexR * Math.sin(ha) - hexR * 0.05;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  c.fillStyle = AMBER + "0.75)";
  c.fill();
  c.strokeStyle = CHROME + "0.8)";
  c.lineWidth = 1.0;
  c.stroke();

  // Hex highlight
  c.beginPath();
  c.arc(hexR * 0.25, -hexR * 0.3, hexR * 0.2, 0, Math.PI * 2);
  c.fillStyle = CHROME + "0.3)";
  c.fill();

  c.globalAlpha = 1;
}

/** Draw a connecting rod. */
function drawConnectingRod(
  c: CanvasRenderingContext2D,
  len: number,
  alpha: number
) {
  const bigR = len * 0.22;
  const smallR = len * 0.13;
  const rodW = len * 0.085;

  c.globalAlpha = alpha;

  // I-beam body
  const y0 = -len / 2 + bigR;
  const y1 = len / 2 - smallR;
  const flangeH = len * 0.07;

  c.beginPath();
  c.rect(-rodW / 2, y0, rodW, y1 - y0);
  c.fillStyle = IRON + "0.65)";
  c.fill();
  // Top flange
  c.beginPath();
  c.rect(-rodW * 1.5, y0, rodW * 3, flangeH);
  c.fill();
  // Bottom flange
  c.beginPath();
  c.rect(-rodW * 1.5, y1 - flangeH, rodW * 3, flangeH);
  c.fill();

  // Big end (crank) ring
  c.beginPath();
  c.arc(0, -len / 2 + bigR, bigR, 0, Math.PI * 2);
  c.strokeStyle = STEEL + "0.9)";
  c.lineWidth = 1.5;
  c.stroke();
  c.beginPath();
  c.arc(0, -len / 2 + bigR, bigR * 0.55, 0, Math.PI * 2);
  c.strokeStyle = CHROME + "0.5)";
  c.lineWidth = 0.8;
  c.stroke();

  // Small end (wrist pin) ring
  c.beginPath();
  c.arc(0, len / 2 - smallR, smallR, 0, Math.PI * 2);
  c.strokeStyle = STEEL + "0.9)";
  c.lineWidth = 1.2;
  c.stroke();

  c.strokeStyle = STEEL + "0.6)";
  c.lineWidth = 1.0;
  c.beginPath();
  c.rect(-rodW / 2, y0, rodW, y1 - y0);
  c.stroke();

  c.globalAlpha = 1;
}

/** Draw a combination wrench. */
function drawWrench(c: CanvasRenderingContext2D, len: number, alpha: number) {
  const handleW = len * 0.1;
  const headR = len * 0.19;

  c.globalAlpha = alpha;

  // Handle
  pathRoundRect(c, -handleW / 2, -len * 0.25, handleW, len * 0.7, handleW / 2);
  c.fillStyle = STEEL + "0.55)";
  c.fill();
  c.strokeStyle = CHROME + "0.7)";
  c.lineWidth = 0.9;
  c.stroke();

  // Open-end head (top)
  const gapAngle = 0.72; // radians
  c.beginPath();
  c.arc(0, -len * 0.35, headR, Math.PI / 2 + gapAngle, Math.PI / 2 - gapAngle + Math.PI * 2);
  c.strokeStyle = STEEL + "0.85)";
  c.lineWidth = headR * 0.42;
  c.lineCap = "round";
  c.stroke();
  c.lineCap = "butt";

  // Box-end head (bottom) — 12-point ring
  const boxCx = 0, boxCy = len * 0.38;
  c.beginPath();
  c.arc(boxCx, boxCy, headR, 0, Math.PI * 2);
  c.strokeStyle = STEEL + "0.85)";
  c.lineWidth = headR * 0.38;
  c.stroke();
  // 12-point notches
  for (let i = 0; i < 12; i++) {
    const na = (i / 12) * Math.PI * 2;
    const nx = boxCx + headR * Math.cos(na);
    const ny2 = boxCy + headR * Math.sin(na);
    c.beginPath();
    c.arc(nx, ny2, headR * 0.09, 0, Math.PI * 2);
    c.fillStyle = IRON + "0.9)";
    c.fill();
  }

  // Chrome sheen stripe
  pathRoundRect(c, -handleW * 0.25, -len * 0.1, handleW * 0.5, len * 0.45, handleW * 0.25);
  c.fillStyle = CHROME + "0.22)";
  c.fill();

  c.globalAlpha = 1;
}

// ─── Spawners ─────────────────────────────────────────────────────────────────

function spawnPart(kind: PartKind, w: number, h: number): Part {
  const edge = Math.random() < 0.3;
  return {
    kind,
    x: edge ? (Math.random() < 0.5 ? -60 : w + 60) : Math.random() * w,
    y: edge ? Math.random() * h : Math.random() * h,
    vx: (Math.random() - 0.5) * 0.22,
    vy: (Math.random() - 0.5) * 0.18,
    angle: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.006,
    scale: 0.55 + Math.random() * 0.7,
    alpha: 0.08 + Math.random() * 0.2,
    breathPhase: Math.random() * Math.PI * 2,
    breathSpeed: 0.005 + Math.random() * 0.008,
  };
}

function spawnSpark(
  x: number,
  y: number
): Part {
  const angle = Math.random() * Math.PI * 2;
  const spd = 0.6 + Math.random() * 1.8;
  return {
    kind: "spark",
    x,
    y,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd - 1.0,
    angle: 0,
    rotSpeed: 0,
    scale: 1,
    alpha: 0.9,
    breathPhase: 0,
    breathSpeed: 0,
    life: 0,
    maxLife: 25 + Math.random() * 30,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface OilSlickCanvasProps {
  intensity?: 'subtle' | 'standard';
}

export default function OilSlickCanvas({ intensity = 'subtle' }: OilSlickCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const c = ctx;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = window.innerWidth;
    let h = window.innerHeight;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const density = intensity === 'standard' ? 1 : 0.65;
    const alphaScale = intensity === 'standard' ? 1 : 0.65;

    const GEAR_COUNT = Math.max(3, Math.round(BASE_GEAR_COUNT * density));
    const PISTON_COUNT = Math.max(2, Math.round(BASE_PISTON_COUNT * density));
    const BOLT_COUNT = Math.max(4, Math.round(BASE_BOLT_COUNT * density));
    const ROD_COUNT = Math.max(2, Math.round(BASE_ROD_COUNT * density));
    const WRENCH_COUNT = Math.max(2, Math.round(BASE_WRENCH_COUNT * density));
    const SPARK_MAX = Math.max(6, Math.round(BASE_SPARK_MAX * density));

    // ── Static parts ────────────────────────────────────────────────────────
    const parts: Part[] = [];

    const addKind = (kind: PartKind, count: number) => {
      for (let i = 0; i < count; i++) {
        const p = spawnPart(kind, w, h);
        // Stagger phases
        p.breathPhase = (i / count) * Math.PI * 2;
        p.alpha *= alphaScale;
        parts.push(p);
      }
    };

    addKind("gear",          GEAR_COUNT);
    addKind("piston",        PISTON_COUNT);
    addKind("bolt",          BOLT_COUNT);
    addKind("connectingRod", ROD_COUNT);
    addKind("wrench",        WRENCH_COUNT);

    // ── Spark pool ───────────────────────────────────────────────────────────
    const sparks: Part[] = [];
    let sparkTimer = 0;

    let animId = 0;

    const frame = () => {
      // ── Background ─────────────────────────────────────────────────────
      c.fillStyle = "#090a0c";
      c.fillRect(0, 0, w, h);

      // Subtle grid lines — like a shop floor
      c.strokeStyle = intensity === 'standard' ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.012)";
      c.lineWidth = 0.5;
      const gridSize = 48;
      for (let gx = 0; gx < w; gx += gridSize) {
        c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, h); c.stroke();
      }
      for (let gy = 0; gy < h; gy += gridSize) {
        c.beginPath(); c.moveTo(0, gy); c.lineTo(w, gy); c.stroke();
      }

      // ── Update & draw mechanical parts ─────────────────────────────────
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.rotSpeed;
        p.breathPhase += p.breathSpeed;

        // Breath alpha pulse
        const breathAlpha = p.alpha + Math.sin(p.breathPhase) * 0.04;

        // Wrap around edges
        const margin = 100;
        if (p.x < -margin) p.x = w + margin;
        if (p.x > w + margin) p.x = -margin;
        if (p.y < -margin) p.y = h + margin;
        if (p.y > h + margin) p.y = -margin;

        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.angle);
        c.scale(p.scale, p.scale);

        if (p.kind === "gear") {
          const teeth = 10 + Math.floor(p.scale * 6);
          const r = 22 + p.scale * 10;
          drawGear(c, teeth, r, breathAlpha);
        } else if (p.kind === "piston") {
          drawPiston(c, 18 + p.scale * 8, breathAlpha);
        } else if (p.kind === "bolt") {
          drawBolt(c, 6 + p.scale * 4, breathAlpha);
        } else if (p.kind === "connectingRod") {
          drawConnectingRod(c, 55 + p.scale * 25, breathAlpha);
        } else if (p.kind === "wrench") {
          drawWrench(c, 60 + p.scale * 30, breathAlpha);
        }

        c.restore();
      }

      // ── Sparks ─────────────────────────────────────────────────────────
      sparkTimer++;
      if (sparkTimer > 65 && sparks.length < SPARK_MAX) {
        sparkTimer = 0;
        // Burst from a random part location
        const srcPart = parts[Math.floor(Math.random() * parts.length)];
        const burstCount = 1 + Math.floor(Math.random() * 3);
        for (let s = 0; s < burstCount && sparks.length < SPARK_MAX; s++) {
          sparks.push(spawnSpark(srcPart.x, srcPart.y));
        }
      }

      for (let si = sparks.length - 1; si >= 0; si--) {
        const s = sparks[si];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.06; // gravity
        s.life = (s.life ?? 0) + 1;
        const life = s.life ?? 0;
        const maxLife = s.maxLife ?? 40;
        const lifeAlpha = 1 - life / maxLife;

        c.globalAlpha = lifeAlpha * (intensity === 'standard' ? 0.6 : 0.38);
        c.beginPath();
        c.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
        c.fillStyle = SPARK_COL + "1)";
        c.fill();
        c.globalAlpha = 1;

        if (life >= maxLife) sparks.splice(si, 1);
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);

    const onResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      resize();
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
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        display: "block",
        pointerEvents: "none",
      }}
    />
  );
}
