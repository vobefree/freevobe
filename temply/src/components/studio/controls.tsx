"use client";

import { useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Dict } from "@/lib/i18n";
import { FONTS, FONT_PAIRINGS, type FontKey, type ThemeConfig } from "@/lib/theme/types";
import { MOODS, PRESET_ORDER } from "@/lib/theme/presets";
import { MOOD_LABELS } from "@/lib/theme/labels";
import type { Locale, MoodId } from "@/lib/theme/types";

export function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <div className="field">
      <div className="field__label">
        <span>{label}</span>
        {value !== undefined && <b>{value}</b>}
      </div>
      {children}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <input className="input" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />;
}

export function TextArea({ value, onChange, rows = 3 }: { value: string; onChange: (value: string) => void; rows?: number }) {
  return <textarea className="textarea" rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />;
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label} value={`${value}${unit}`}>
      <input className="range" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </Field>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button key={String(option.value)} type="button" className={option.value === value ? "is-active" : ""} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <button type="button" className={`toggle${checked ? " is-on" : ""}`} aria-pressed={checked} aria-label={label} onClick={() => onChange(!checked)}>
        <i />
      </button>
    </div>
  );
}

export function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="color-row">
      <label>{label}</label>
      <span className="color-swatch" style={{ background: value }}>
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} />
      </span>
    </div>
  );
}

export function MoodCards({
  locale,
  active,
  onPick,
}: {
  locale: Locale;
  active?: MoodId | null;
  onPick: (mood: MoodId) => void;
}) {
  return (
    <div className="mood-cards">
      {PRESET_ORDER.map((id) => (
        <button type="button" key={id} className={`mood-card-ui${active === id ? " is-active" : ""}`} onClick={() => onPick(id)}>
          <span className="mood-card-ui__preview">
            <i style={{ background: MOODS[id].palette.background }} />
            <i style={{ background: MOODS[id].palette.primary }} />
            <i style={{ background: MOODS[id].palette.accent }} />
          </span>
          <span>{MOOD_LABELS[locale][id]}</span>
        </button>
      ))}
    </div>
  );
}

export function RadiusWidget({ radius, onChange, hint }: { radius: number; onChange: (value: number) => void; hint: string }) {
  const drag = useRef<{ x: number; radius: number } | null>(null);
  return (
    <div className="thumb-shape">
      <div
        className="radius-demo"
        style={{ borderRadius: radius }}
        onPointerDown={(event) => {
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /* pointer capture can be unavailable in synthetic input */
          }
          drag.current = { x: event.clientX, radius };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const delta = (event.clientX - drag.current.x) * 0.6;
          onChange(Math.max(0, Math.min(46, Math.round(drag.current.radius + delta))));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        role="slider"
        aria-label={hint}
        aria-valuenow={radius}
        aria-valuemin={0}
        aria-valuemax={46}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") onChange(Math.max(0, radius - 2));
          if (event.key === "ArrowRight") onChange(Math.min(46, radius + 2));
        }}
      >
        <span className="radius-demo__handle" />
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        {[2, 16, 32].map((value) => (
          <button key={value} type="button" className="chip" style={{ fontSize: 10 }} onClick={() => onChange(value)}>
            {value}px
          </button>
        ))}
      </div>
    </div>
  );
}

export function QuickShape({ radius, onChange, label, hint }: { radius: number; onChange: (value: number) => void; label: string; hint: string }) {
  const drag = useRef<{ x: number; radius: number } | null>(null);
  return (
    <div className="quickbar__group" title={hint}>
      <span className="quickbar__label">{label}</span>
      <div
        className="corner-widget"
        onPointerDown={(event) => {
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /* pointer capture can be unavailable in synthetic input */
          }
          drag.current = { x: event.clientX, radius };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          onChange(Math.max(0, Math.min(46, Math.round(drag.current.radius + (event.clientX - drag.current.x) * 0.7))));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        role="slider"
        aria-label={hint}
        aria-valuenow={radius}
        aria-valuemin={0}
        aria-valuemax={46}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") onChange(Math.max(0, radius - 2));
          if (event.key === "ArrowRight") onChange(Math.min(46, radius + 2));
        }}
      >
        <span className="corner-widget__shape" style={{ borderRadius: radius }} />
        <span className="corner-widget__handle" />
      </div>
    </div>
  );
}

export function TypeButtons({ size, onChange, dict }: { size: number; onChange: (value: number) => void; dict: Dict }) {
  return (
    <div className="quickbar__group">
      <span className="quickbar__label">{dict.studio.quickType}</span>
      <div className="type-buttons">
        <button type="button" aria-label={dict.studio.minusSize} onClick={() => onChange(Math.max(13, size - 1))}>A−</button>
        <span>{size}</span>
        <button type="button" aria-label={dict.studio.plusSize} onClick={() => onChange(Math.min(24, size + 1))}>A+</button>
      </div>
    </div>
  );
}

export function SpacingWidget({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  const drag = useRef<{ x: number; value: number } | null>(null);
  const position = Math.max(0, Math.min(100, ((value - 32) / 128) * 100));
  return (
    <div className="quickbar__group" title={label}>
      <span className="quickbar__label">{label}</span>
      <div
        className="spacing-widget"
        onPointerDown={(event) => {
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /* pointer capture can be unavailable in synthetic input */
          }
          drag.current = { x: event.clientX, value };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const delta = (event.clientX - drag.current.x) * 1.6;
          onChange(Math.max(32, Math.min(160, Math.round((drag.current.value + delta) / 4) * 4)));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        role="slider"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={32}
        aria-valuemax={160}
        tabIndex={0}
      >
        <span className="spacing-widget__track">
          <span className="spacing-widget__knob" style={{ left: `${position}%` }} />
        </span>
      </div>
    </div>
  );
}

export function FontPreview({ font, text, style }: { font: FontKey; text: string; style?: CSSProperties }) {
  return <span style={{ fontFamily: FONTS[font].stack, ...style }}>{text}</span>;
}

export function PairingPicker({ heading, body, onPick }: { heading: FontKey; body: FontKey; onPick: (heading: FontKey, body: FontKey) => void }) {
  return (
    <div className="font-list">
      {FONT_PAIRINGS.map((pair) => (
        <button
          type="button"
          key={pair.id}
          className={`font-card${pair.heading === heading && pair.body === body ? " is-active" : ""}`}
          onClick={() => onPick(pair.heading, pair.body)}
        >
          <span style={{ fontFamily: FONTS[pair.heading].stack, fontSize: 17 }}>Aa</span>
          <small>
            {FONTS[pair.heading].label} + {FONTS[pair.body].label}
          </small>
        </button>
      ))}
    </div>
  );
}

export function designReset(config: ThemeConfig, mood: MoodId = "warm"): ThemeConfig {
  const preset = MOODS[mood];
  return {
    ...config,
    palette: { ...preset.palette },
    typography: { ...preset.typography },
    shape: { ...preset.shape },
  };
}
