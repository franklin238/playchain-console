import type { GameEntry } from "../arcade/store";
import { localize } from "../games/meta";
import { formatWifShort } from "../web3/tokens";

/** Shelf tile: 16:9 cover, title, genre and lifetime votes. */
export function GameTile({
  game,
  onSelect,
  onFocus,
  onTouchStart,
  onTouchEnd,
  active = false,
  navDefault = false,
  eager = false,
  decimals,
  badge,
}: {
  game: GameEntry;
  onSelect: () => void;
  onFocus?: () => void;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
  /** Highlighted because the hero is previewing this game. */
  active?: boolean;
  navDefault?: boolean;
  eager?: boolean;
  decimals: number;
  badge?: string;
}) {
  const m = game.meta!;
  return (
    <button
      type="button"
      onClick={onSelect}
      onFocus={onFocus}
      onMouseEnter={onFocus}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      aria-label={m.name}
      data-game-key={game.key}
      data-nav-default={navDefault ? "" : undefined}
      data-active={active ? "" : undefined}
      // Phones: a list row (cover on the left). From sm up: a shelf tile (cover on top).
      className="tile flex w-full shrink-0 select-none flex-row items-center overflow-hidden rounded-xl border border-line bg-surface text-left [-webkit-touch-callout:none] sm:w-[17.5rem] sm:flex-col sm:items-stretch"
    >
      <div className="relative aspect-video w-28 shrink-0 overflow-hidden bg-bg-2 sm:w-full">
        <img src={localize(m.cover)} alt="" draggable={false} loading={eager ? "eager" : "lazy"} decoding="async" className="absolute inset-0 size-full object-cover" />
        {badge && (
          <span className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-text sm:left-3 sm:top-3 sm:rounded-md sm:px-2.5 sm:py-1 sm:text-sm">
            {badge}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 px-3 py-2 sm:w-full sm:flex-none sm:px-4 sm:py-3">
        <div className="truncate text-[0.95rem] font-bold leading-snug sm:text-base">{m.name}</div>
        <div className="mt-0.5 flex flex-col text-xs text-muted sm:flex-row sm:justify-between sm:gap-2 sm:text-sm">
          <span className="truncate">{m.genre}</span>
          {game.id != null && <span className="shrink-0 tabular-nums">{formatWifShort(game.totalVotes, decimals)} WIF voted</span>}
        </div>
      </div>
    </button>
  );
}
