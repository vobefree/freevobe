import Link from "next/link";

/** ThemeFolds logotyp: ett vikt pappersark i en rundad kvadrat. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="brand__mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="var(--mark-bg)" />
      <path
        d="M11 23.8V8.7h7.9l5.1 5.1v10H11Z"
        fill="none"
        stroke="var(--mark-ink)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M18.9 8.7v5.1h5.1" fill="none" stroke="var(--mark-ink)" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="14.6" cy="18.4" r="1.5" fill="var(--mark-dot)" />
    </svg>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="ThemeFold">
      <BrandMark />
      <span className="brand__word">
        theme<span className="brand__fold">fold</span>
      </span>
    </Link>
  );
}
