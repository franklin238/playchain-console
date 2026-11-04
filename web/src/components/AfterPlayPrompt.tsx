import { useRef } from "react";
import { useEntry } from "../arcade/store";
import { useAutoFocus, useBackHandler, useRestoreFocus } from "../input/hooks";
import { useSheets } from "../stores/sheets";
import { Button } from "./controls";

/** Shown when a player leaves a game: "Did you enjoy it? Vote with $WIF". */
export function AfterPlayPrompt() {
  const key = useSheets((s) => s.afterPlayKey);
  const setAfterPlay = useSheets((s) => s.setAfterPlay);
  const openVote = useSheets((s) => s.openVote);
  const game = useEntry(key ?? undefined);
  const ref = useRef<HTMLDivElement>(null);
  const open = !!key && !!game?.meta;
  useRestoreFocus(open);
  useAutoFocus(ref, [open]);
  useBackHandler(() => setAfterPlay(null), open, 40);
  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 sm:p-6" role="dialog" aria-label="Vote for this game">
      <div ref={ref} data-nav-scope="modal" className="fade-in flex w-full max-w-xl flex-wrap items-center gap-4 rounded-2xl border border-accent/40 bg-bg-2 p-4 shadow-2xl sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-extrabold">Did you enjoy {game!.meta!.name}?</div>
          <div className="text-sm text-muted">Vote with $WIF. 40% goes to its developer, half burns.</div>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" data-nav-default="" onClick={() => openVote(key!)}>
            Vote
          </Button>
          <Button variant="ghost" onClick={() => setAfterPlay(null)}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
