"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="animate-fade-up rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-7">
      <div className="mb-6">
        <div className="flex items-center gap-2.5">
          <span className="h-1 w-1 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.9)]" />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-500">
            {label}
          </h2>
        </div>
        {hint && <p className="mt-2 text-xs leading-relaxed text-neutral-600">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function ControlLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-neutral-600">
      {children}
    </p>
  );
}

export function SegmentedControl<T extends string>({
  id,
  options,
  value,
  onChange,
}: {
  id: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`relative rounded-full px-5 py-2 text-sm font-medium transition-colors ${
            value === o.value
              ? "text-white"
              : "text-neutral-500 hover:text-neutral-200"
          }`}
        >
          {value === o.value && (
            <motion.span
              layoutId={`segmented-${id}`}
              className="absolute inset-0 rounded-full bg-red-600 shadow-[0_0_18px_rgba(220,38,38,0.4)]"
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
            />
          )}
          <span className="relative z-10">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function NumberField({
  value,
  onChange,
  min = 1,
  max = 999,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) =>
          onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))
        }
        className="w-10 bg-transparent text-center text-sm font-medium text-white outline-none"
      />
      {suffix && <span className="text-xs text-neutral-500">{suffix}</span>}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-red-600 px-8 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all hover:bg-red-500 hover:shadow-[0_0_45px_rgba(220,38,38,0.45)] disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </motion.button>
  );
}

export function StopButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="rounded-full border border-red-600/60 px-8 py-3.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-600/10"
    >
      {children}
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* VolumeSlider — custom-built so it renders identically in every      */
/* browser. The native input is invisible but handles all the actual   */
/* dragging, keyboard, and accessibility; the visuals are ours.        */
/* Step is derived from the range so a 0–1 scale (Spotify) and a        */
/* 0–100 scale (YouTube) both get 100 smooth increments.               */
/* ------------------------------------------------------------------ */

export function VolumeSlider({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const step = max > 0 ? max / 100 : 1;

  return (
    <div className="group relative flex h-6 flex-1 cursor-pointer items-center">
      {/* Track */}
      <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/[0.08]" />
      {/* Fill */}
      <div
        className="absolute h-1.5 rounded-full bg-gradient-to-r from-red-800 to-red-500 transition-[width] duration-100"
        style={{ width: `${pct * 100}%` }}
      />
      {/* Knob */}
      <div
        className="absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(220,38,38,0.6)] transition-transform duration-150 group-hover:scale-125"
        style={{ left: `${pct * 100}%` }}
      />
      {/* The real (invisible) input on top — drives all interaction */}
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Volume"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}