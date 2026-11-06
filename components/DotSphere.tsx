"use client";
// Halftone dot sphere: points on a slowly rotating sphere, drawn as dots whose
// size and darkness follow their depth. 2D canvas, no libraries.
import { useEffect, useRef } from "react";

export default function DotSphere() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fibonacci sphere
    const N = 1100;
    const pts: [number, number, number][] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }

    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const color = () => getComputedStyle(canvas).color || "#141414";

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.46;
      const cx = w / 2, cy = h / 2;
      const a = t * 0.00012, tilt = 0.45;
      const ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(tilt), st = Math.sin(tilt);
      ctx.fillStyle = color();
      for (const [x, y, z] of pts) {
        // rotate around Y, then tilt around X
        const x1 = x * ca + z * sa;
        const z1 = -x * sa + z * ca;
        const y2 = y * ct - z1 * st;
        const z2 = y * st + z1 * ct;
        const depth = (z2 + 1) / 2; // 0 = back, 1 = front
        const size = 0.5 + depth * depth * 2.6;
        ctx.globalAlpha = 0.12 + depth * 0.85;
        ctx.beginPath();
        ctx.arc(cx + x1 * R, cy + y2 * R, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
    io.observe(canvas);
    let raf = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (visible && !document.hidden) draw(t);
    };
    if (reduced) draw(2000);
    else raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="ed-dots" aria-hidden="true" />;
}
