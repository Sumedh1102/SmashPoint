"use client";

import { useState } from "react";

export function ScoreSlider({ name, label, defaultValue = 5 }: { name: string; label: string; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <label className="grid gap-1.5">
      <span className="flex items-center justify-between text-sm font-medium">
        {label}
        <span className="grid h-7 min-w-9 place-items-center rounded-lg border border-line bg-brand px-1 font-display text-white">{value}</span>
      </span>
      <input type="range" name={name} min={1} max={10} step={1} value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-full accent-[var(--color-brand)]" aria-valuetext={`${value} out of 10`} />
    </label>
  );
}
