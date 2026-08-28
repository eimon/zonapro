"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

// Horizontal px of parallax shift per vertical px scrolled, clamped so the
// oversized/blurred image never reveals its edge.
const PARALLAX_FACTOR = 0.08;
const MAX_SHIFT_PX = 60;

export function HeroBackground() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || !layerRef.current) return;

    const el = layerRef.current;
    let ticking = false;

    function apply() {
      ticking = false;
      const shift = Math.max(
        -MAX_SHIFT_PX,
        Math.min(MAX_SHIFT_PX, window.scrollY * PARALLAX_FACTOR)
      );
      el.style.transform = `translate3d(${shift}px, 0, 0)`;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    }

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Scaled up so the blur radius + horizontal parallax never expose an edge */}
      <div ref={layerRef} className="absolute inset-0 scale-110 will-change-transform">
        <Image
          src="/hero-showroom.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover blur-[2px]"
        />
      </div>

      {/* Scrim: always the dark-mode treatment — the light one read oddly over the photo */}
      <div className="absolute inset-0 bg-zinc-950/75" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-blue/10 via-zinc-950/60 to-zinc-950" />
    </div>
  );
}
