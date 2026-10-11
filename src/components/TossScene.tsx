import { useEffect, useRef, useState } from "react";

// Scene geometry (SVG user units).
const GROUND = 322;
const POLE_TOP = 172;
const LEFT_POLE_X = 150;
const RIGHT_POLE_X = 792;
const BOTTLE_HALF_H = 32;
const BOTTLE_HALF_W = 11;
const BOTTLE_REST = { x: RIGHT_POLE_X, y: POLE_TOP - BOTTLE_HALF_H };
const FRISBEE_RX = 30;
const FRISBEE_RY = 8;

// On wider screens the scene fills a short, full-width strip: the viewBox is
// extra wide and "slice" trims the sides to fit, keeping the poles centered.
// Phones get a tighter crop around the poles so the bottles aren't tiny.
const VIEW_WIDE = "-350 30 1640 320";
const VIEW_NARROW = "110 30 880 320";

// Timeline (seconds).
const THROW_AT = 0.3;
const FLIGHT = 1.05;
const IMPACT_AT = THROW_AT + FLIGHT;
const FADE_AT = 3.9;
const FADE = 0.45;
const RESET_AT = FADE_AT + FADE;
const DROP_IN = 0.5;
const LOOP = RESET_AT + DROP_IN + 0.5;

// Flight path: a quadratic curve from the thrower to the bottle.
const P0 = { x: LEFT_POLE_X + 30, y: 212 };
const C = { x: 470, y: 70 };
const P1 = { x: RIGHT_POLE_X - BOTTLE_HALF_W - FRISBEE_RX + 8, y: BOTTLE_REST.y + 8 };

interface Frame {
  bottle: { x: number; y: number; r: number };
  frisbee: { x: number; y: number; tilt: number; spin: number };
  pole: number;
}

const STEP = 1 / 120;

/** Precomputes the post-impact tumble so the loop is identical every time. */
function simulate(): Frame[] {
  const frames: Frame[] = [];
  const g = 1500;
  const b = { ...BOTTLE_REST, r: 0, vx: 95, vy: -420, vr: 560, settled: false };
  const f = { x: P1.x, y: P1.y, vx: -55, vy: 20, tilt: 8, spin: 0, spinRate: 34, grounded: false };

  for (let t = 0; t <= LOOP - IMPACT_AT; t += STEP) {
    // Bottle
    if (!b.settled) {
      b.vy += g * STEP;
      b.x += b.vx * STEP;
      b.y += b.vy * STEP;
      b.r += b.vr * STEP;
      const rad = (b.r * Math.PI) / 180;
      const extent = Math.abs(Math.cos(rad)) * BOTTLE_HALF_H + Math.abs(Math.sin(rad)) * BOTTLE_HALF_W;
      if (b.y + extent >= GROUND) {
        b.y = GROUND - extent;
        if (Math.abs(b.vy) < 140) {
          b.settled = true;
        } else {
          b.vy = -b.vy * 0.3;
          b.vx *= 0.55;
          b.vr *= 0.45;
        }
      }
    } else {
      // Roll onto its side and slide to a stop.
      const target = Math.round((b.r - 90) / 180) * 180 + 90;
      b.r += (target - b.r) * Math.min(1, STEP * 10);
      b.vx *= Math.exp(-5 * STEP);
      b.x += b.vx * STEP;
      const rad = (b.r * Math.PI) / 180;
      b.y = GROUND - (Math.abs(Math.cos(rad)) * BOTTLE_HALF_H + Math.abs(Math.sin(rad)) * BOTTLE_HALF_W);
    }

    // Frisbee: floats down after the hit and skids along the grass.
    if (!f.grounded) {
      f.vy += 700 * STEP;
      f.x += f.vx * STEP;
      f.y += f.vy * STEP;
      f.tilt += (24 - f.tilt) * Math.min(1, STEP * 3);
      if (f.y + FRISBEE_RY * 0.6 >= GROUND) {
        f.y = GROUND - FRISBEE_RY * 0.6;
        f.grounded = true;
      }
    } else {
      f.vx *= Math.exp(-4 * STEP);
      f.x += f.vx * STEP;
      f.tilt += (0 - f.tilt) * Math.min(1, STEP * 12);
      f.spinRate *= Math.exp(-3 * STEP);
    }
    f.spin += f.spinRate * STEP;

    const pole = 7 * Math.exp(-5 * t) * Math.sin(t * 24);
    frames.push({
      bottle: { x: b.x, y: b.y, r: b.r },
      frisbee: { x: f.x, y: f.y, tilt: f.tilt, spin: f.spin },
      pole,
    });
  }
  return frames;
}

function bezier(t: number) {
  const u = 1 - t;
  return {
    x: u * u * P0.x + 2 * u * t * C.x + t * t * P1.x,
    y: u * u * P0.y + 2 * u * t * C.y + t * t * P1.y,
    dx: 2 * u * (C.x - P0.x) + 2 * t * (P1.x - C.x),
    dy: 2 * u * (C.y - P0.y) + 2 * t * (P1.y - C.y),
  };
}

const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export function TossScene() {
  const narrow = useMediaQuery("(max-width: 640px)");
  const frisbee = useRef<SVGGElement>(null);
  const stripe = useRef<SVGRectElement>(null);
  const bottle = useRef<SVGGElement>(null);
  const pole = useRef<SVGGElement>(null);
  const burst = useRef<SVGGElement>(null);
  const frisbeeShadow = useRef<SVGEllipseElement>(null);
  const bottleShadow = useRef<SVGEllipseElement>(null);

  useEffect(() => {
    const frames = simulate();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const render = (time: number) => {
      let fx: number, fy: number, tilt: number, spin: number, fOpacity = 1;
      let bx = BOTTLE_REST.x, by = BOTTLE_REST.y, br = 0, bOpacity = 1;
      let poleAngle = 0;
      let burstScale = 0, burstOpacity = 0;

      if (time < IMPACT_AT) {
        const t = Math.max(0, (time - THROW_AT) / FLIGHT);
        const p = bezier(t);
        fx = p.x;
        fy = p.y;
        tilt = (Math.atan2(p.dy, p.dx) * 180) / Math.PI * 0.3;
        spin = time * 34;
        fOpacity = time < THROW_AT ? time / THROW_AT : 1;
      } else {
        const since = time - IMPACT_AT;
        const frame = frames[Math.min(frames.length - 1, Math.floor(since / STEP))];
        ({ x: fx, y: fy, tilt, spin } = frame.frisbee);
        ({ x: bx, y: by, r: br } = frame.bottle);
        poleAngle = frame.pole;

        if (since < 0.9) {
          burstScale = since < 0.12 ? (since / 0.12) * 1.15 : 1.15 - Math.min(0.15, (since - 0.12) * 1.5);
          burstOpacity = since < 0.6 ? 1 : 1 - (since - 0.6) / 0.3;
        }
        if (time >= FADE_AT) {
          const fade = Math.max(0, 1 - (time - FADE_AT) / FADE);
          fOpacity = fade;
          bOpacity = fade;
        }
        if (time >= RESET_AT) {
          // A fresh bottle drops back onto the pole.
          const t = Math.min(1, (time - RESET_AT) / DROP_IN);
          bx = BOTTLE_REST.x;
          by = BOTTLE_REST.y - 90 * (1 - easeOutBack(t));
          br = 0;
          bOpacity = Math.min(1, t * 2);
          fOpacity = 0;
        }
      }

      frisbee.current?.setAttribute("transform", `translate(${fx} ${fy}) rotate(${tilt})`);
      frisbee.current?.setAttribute("opacity", String(fOpacity));
      const s = Math.sin(spin);
      stripe.current?.setAttribute("x", String(s * (FRISBEE_RX - 9) - 4));
      stripe.current?.setAttribute("opacity", Math.cos(spin) > 0 ? "0.9" : "0");
      bottle.current?.setAttribute("transform", `translate(${bx} ${by}) rotate(${br})`);
      bottle.current?.setAttribute("opacity", String(bOpacity));
      pole.current?.setAttribute("transform", `rotate(${poleAngle} ${RIGHT_POLE_X} ${GROUND})`);
      burst.current?.setAttribute("transform", `translate(${P1.x - 46} ${P1.y - 54}) scale(${burstScale}) rotate(-8)`);
      burst.current?.setAttribute("opacity", String(Math.max(0, burstOpacity)));

      const shadow = (el: SVGEllipseElement | null, x: number, height: number, size: number, opacity: number) => {
        if (!el) return;
        const near = Math.max(0, 1 - height / 220);
        el.setAttribute("cx", String(x));
        el.setAttribute("rx", String(size * (0.5 + near * 0.6)));
        el.setAttribute("opacity", String(opacity * (0.08 + near * 0.22)));
      };
      shadow(frisbeeShadow.current, fx, GROUND - fy, FRISBEE_RX, fOpacity);
      shadow(bottleShadow.current, bx, Math.max(0, GROUND - by - 30), 18, bOpacity);
    };

    if (reduced) {
      render(IMPACT_AT + 0.22);
      return;
    }

    let raf = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now;
      render(((now - start) / 1000) % LOOP);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg className="toss-scene" viewBox={narrow ? VIEW_NARROW : VIEW_WIDE}
      preserveAspectRatio={narrow ? "xMidYMid meet" : "xMidYMid slice"}
      role="img" aria-label="A frisbee flies across the lawn and knocks a bottle off its pole">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc8f2" />
          <stop offset="0.65" stopColor="#c9e9f5" />
          <stop offset="1" stopColor="#ffe6b3" />
        </linearGradient>
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5cb85c" />
          <stop offset="1" stopColor="#2f7a3a" />
        </linearGradient>
        <linearGradient id="pole" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9dfe4" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c3cbd2" />
        </linearGradient>
        <radialGradient id="sun">
          <stop offset="0.55" stopColor="#ffd45c" />
          <stop offset="1" stopColor="#ffd45c" stopOpacity="0" />
        </radialGradient>
        <g id="bottle-shape" fill="#d62839" stroke="#7d1220" strokeWidth="1.5" strokeLinejoin="round">
          <rect x="-5.5" y="-35" width="11" height="5" rx="1.5" />
          <path d="M-4.5 -32 h9 v13 q11.5 6 11.5 17 v29 a3 3 0 0 1 -3 3 h-23 a3 3 0 0 1 -3 -3 v-29 q0 -11 11.5 -17 z" />
        </g>
      </defs>

      <rect x="-400" width="1800" height="400" fill="url(#sky)" />
      <circle cx="610" cy="80" r="62" fill="url(#sun)" />
      <circle cx="610" cy="80" r="30" fill="#ffd45c" />
      <g className="cloud cloud-a" fill="#fff" opacity="0.9">
        <ellipse cx="160" cy="80" rx="46" ry="18" />
        <ellipse cx="196" cy="70" rx="34" ry="22" />
        <ellipse cx="226" cy="84" rx="38" ry="15" />
      </g>
      <g className="cloud cloud-c" fill="#fff" opacity="0.8">
        <ellipse cx="-220" cy="92" rx="40" ry="14" />
        <ellipse cx="-190" cy="82" rx="30" ry="18" />
        <ellipse cx="-160" cy="94" rx="34" ry="12" />
        <ellipse cx="1110" cy="70" rx="38" ry="14" />
        <ellipse cx="1140" cy="60" rx="28" ry="17" />
        <ellipse cx="1168" cy="72" rx="32" ry="12" />
      </g>
      <g className="cloud cloud-b" fill="#fff" opacity="0.75">
        <ellipse cx="380" cy="64" rx="36" ry="13" />
        <ellipse cx="408" cy="56" rx="26" ry="16" />
        <ellipse cx="432" cy="66" rx="30" ry="11" />
      </g>

      <path d="M-400 280 Q -250 300 -100 286 Q 50 262 110 290 T 430 284 T 750 280 T 1070 274 T 1400 280 V 330 H -400 Z" fill="#9ed37f" />
      <path d="M-400 316 Q -200 308 40 318 T 520 314 T 1000 316 T 1480 314 V 400 H -400 Z" fill="url(#grass)" />
      <g stroke="#2a6e33" strokeWidth="2" strokeLinecap="round" opacity="0.5">
        <path d="M-300 340 l-4 -10 M-296 340 l2 -12 M-292 340 l6 -9" />
        <path d="M-90 342 l-4 -10 M-86 342 l2 -12 M-82 342 l6 -9" />
        <path d="M250 346 l-4 -10 M254 346 l2 -12 M258 346 l6 -9" />
        <path d="M560 340 l-4 -10 M564 340 l2 -12 M568 340 l6 -9" />
        <path d="M1010 344 l-4 -10 M1014 344 l2 -12 M1018 344 l6 -9" />
        <path d="M1220 340 l-4 -10 M1224 340 l2 -12 M1228 340 l6 -9" />
      </g>

      {/* Thrower's pole */}
      <ellipse cx={LEFT_POLE_X} cy={GROUND + 4} rx="22" ry="5" fill="#000" opacity="0.18" />
      <rect x={LEFT_POLE_X - 4.5} y={POLE_TOP} width="9" height={GROUND - POLE_TOP} rx="2" fill="url(#pole)" stroke="#8d989f" strokeWidth="1" />
      <use href="#bottle-shape" transform={`translate(${LEFT_POLE_X} ${POLE_TOP - BOTTLE_HALF_H})`} />

      {/* Target pole */}
      <ellipse ref={bottleShadow} cx={RIGHT_POLE_X} cy={GROUND + 5} rx="18" ry="4" fill="#000" opacity="0.1" />
      <ellipse cx={RIGHT_POLE_X} cy={GROUND + 4} rx="22" ry="5" fill="#000" opacity="0.18" />
      <g ref={pole}>
        <rect x={RIGHT_POLE_X - 4.5} y={POLE_TOP} width="9" height={GROUND - POLE_TOP} rx="2" fill="url(#pole)" stroke="#8d989f" strokeWidth="1" />
      </g>
      <g ref={bottle} transform={`translate(${BOTTLE_REST.x} ${BOTTLE_REST.y})`}>
        <use href="#bottle-shape" />
      </g>

      <ellipse ref={frisbeeShadow} cx={P0.x} cy={GROUND + 6} rx="20" ry="4" fill="#000" opacity="0" />
      <g ref={frisbee} transform={`translate(${P0.x} ${P0.y})`} opacity="0">
        <ellipse rx={FRISBEE_RX} ry={FRISBEE_RY} fill="#ff5a36" stroke="#b8321a" strokeWidth="1.5" />
        <ellipse cy="-1.5" rx={FRISBEE_RX - 9} ry={FRISBEE_RY - 4} fill="#ff8a66" />
        <rect ref={stripe} x="-4" y={-FRISBEE_RY + 1.5} width="8" height={FRISBEE_RY * 2 - 3} rx="3" fill="#fff" opacity="0.9" />
      </g>

      <g ref={burst} opacity="0">
        <g stroke="#ffcf3f" strokeWidth="4" strokeLinecap="round">
          <path d="M-46 -8 l-16 -6 M-38 -30 l-10 -14 M-14 -40 l-2 -16 M42 -8 l16 -6 M34 -30 l10 -14 M10 -40 l2 -16" />
        </g>
        <text className="burst-text" textAnchor="middle" y="6">
          CLINK!
        </text>
      </g>
    </svg>
  );
}
