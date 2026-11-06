import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router";
import { useAutoFocus } from "../input/hooks";

export interface Crumb {
  label: string;
  to?: string;
}

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-sm">
      {crumbs.map((c, i) => (
        <Fragment key={`${c.label}-${i}`}>
          {i > 0 && (
            <span className="text-muted" aria-hidden="true">
              ›
            </span>
          )}
          {c.to && i < crumbs.length - 1 ? (
            <Link to={c.to} className="rounded text-fg/90 hover:text-accent-text">
              {c.label}
            </Link>
          ) : (
            <span className="text-accent-text" aria-current="page">
              {c.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

/** Page wrapper: breadcrumbs, title block, spacing under the header bar, focus on enter. */
export function Screen({
  title,
  subtitle,
  actions,
  crumbs,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Defaults to Home › title. Pass [] to hide. */
  crumbs?: Crumb[];
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useAutoFocus(ref);
  useEffect(() => {
    if (title) document.title = `${title} · PlayChain Flat`;
  }, [title]);
  const trail = crumbs ?? (title ? [{ label: "Home", to: "/" }, { label: title }] : []);
  return (
    <main ref={ref} className={`page fade-in pb-24 pt-24 sm:pt-36 ${className}`}>
      {trail.length > 0 && <Breadcrumbs crumbs={trail} />}
      {title && (
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-3xl">
            <h1 className="font-display text-[clamp(1.9rem,2.8vw,3.25rem)] font-extrabold leading-[1.1] tracking-tight">
              {title}
            </h1>
            {subtitle && <p className="mt-3 text-base text-fg/80">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </main>
  );
}
