import type { GameEntry } from "../arcade/store";
import { localize } from "../games/meta";
import { formatWifShort } from "../web3/tokens";

/** Shelf tile: 16:9 cover, title, genre and lifetime votes. */
export function GameTile({
  game,
  onSelect,
  onFocus,
  navDefault = false,
  eager = false,
  decimals,
  badge,
}: {
  game: GameEntry;
  onSelect: () => void;
  onFocus?: () => void;
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
      aria-label={m.name}
      data-game-key={game.key}
      data-nav-default={navDefault ? "" : undefined}
      className="tile flex w-[15rem] shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-surface text-left sm:w-[17.5rem]"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-bg-2">
        <img src={localize(m.cover)} alt="" loading={eager ? "eager" : "lazy"} decoding="async" className="absolute inset-0 size-full object-cover" />
        {badge && (
          <span className="absolute left-3 top-3 rounded-md bg-black/75 px-2.5 py-1 text-sm font-bold uppercase tracking-wide text-accent-text">
            {badge}
          </span>
        )}
      </div>
      <div className="w-full px-4 py-3">
        <div className="truncate font-bold leading-snug">{m.name}</div>
        <div className="mt-0.5 flex justify-between gap-2 text-sm text-muted">
          <span className="truncate">{m.genre}</span>
          {game.id != null && <span className="shrink-0 tabular-nums">{formatWifShort(game.totalVotes, decimals)} WIF voted</span>}
        </div>
      </div>
    </button>
  );
}
