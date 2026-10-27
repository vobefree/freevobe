"use client";

import { useRef, useState } from "react";
import type { Dict } from "@/lib/i18n";

export function ShapePlayground({ dict }: { dict: Dict }) {
  const [radius, setRadius] = useState(18);
  const [size, setSize] = useState(26);
  const drag = useRef<{ x: number; radius: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture can be unavailable in synthetic input */
    }
    drag.current = { x: event.clientX, radius };
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const delta = (event.clientX - drag.current.x) * 0.6;
    setRadius(Math.max(0, Math.min(46, Math.round(drag.current.radius + delta))));
  };
  const stop = () => {
    drag.current = null;
  };

  return (
    <div className="playground">
      <div className="playground__head">
        <span>{dict.studio.easyTitle}</span>
        <strong style={{ color: "#131310" }}>{radius}px</strong>
      </div>
      <div className="playground__stage">
        <div style={{ display: "grid", placeItems: "center", gap: 18, padding: "34px 20px 40px" }}>
          <div
            className="radius-demo"
            style={{ borderRadius: radius, background: "linear-gradient(135deg,#1c4a3a,#131310)", width: 130, height: 92 }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={stop}
            onPointerCancel={stop}
            role="slider"
            aria-label={dict.studio.shape}
            aria-valuenow={radius}
            aria-valuemin={0}
            aria-valuemax={46}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") setRadius((r) => Math.max(0, r - 2));
              if (event.key === "ArrowRight") setRadius((r) => Math.min(46, r + 2));
            }}
          >
            <span className="radius-demo__handle" />
          </div>
          <button
            type="button"
            style={{
              background: "#ff5a2a",
              color: "#fff",
              border: 0,
              padding: "12px 22px",
              borderRadius: radius,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'Inter Tight', sans-serif",
            }}
          >
            Din knapp
          </button>
        </div>
        <div className="playground__hint">{dict.studio.dragShape}</div>
      </div>
      <div className="playground__row">
        <div className="type-buttons">
          <button type="button" aria-label={dict.studio.minusSize} onClick={() => setSize((s) => Math.max(14, s - 3))}>
            A−
          </button>
          <span>{size}</span>
          <button type="button" aria-label={dict.studio.plusSize} onClick={() => setSize((s) => Math.min(54, s + 3))}>
            A+
          </button>
        </div>
        <span className="type-demo" style={{ fontSize: size }}>
          Aa
        </span>
      </div>
    </div>
  );
}
