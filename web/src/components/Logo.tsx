/** PlayChain Flat mark: a flat disc with a play notch, then the wordmark. Original artwork. */
export function LogoMark({ className = "size-[1.15em]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="pcf-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--color-accent)" }} />
          <stop offset="1" stopColor="#4de1c1" />
        </linearGradient>
      </defs>
      <ellipse cx="16" cy="19" rx="14" ry="6" fill="#0d1a12" stroke="url(#pcf-g)" strokeWidth="2" />
      <path d="M12 6.5v11l9.5-5.5z" fill="url(#pcf-g)" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap font-display font-extrabold uppercase tracking-[0.03em] ${className}`}>
      <LogoMark />
      <span>
        PlayChain <span className="text-accent-text">Flat</span>
      </span>
    </span>
  );
}
