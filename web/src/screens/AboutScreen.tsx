import type { ReactNode } from "react";
import { Link } from "react-router";
import { useArcade } from "../arcade/store";
import { Section } from "../components/controls";
import { Flywheel } from "../components/Flywheel";
import { BurnCounter } from "../components/BurnCounter";
import { Footer } from "../components/Footer";
import { Icon, type IconName } from "../components/Icon";
import { Screen } from "../components/Screen";
import { consoleConfig, DISCLAIMER } from "../config/console.config";
import { localize } from "../games/meta";
import { addressUrl } from "../web3/client";
import { formatWif } from "../web3/tokens";

function Card({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/90 p-5">
      <div className="mb-3 grid size-11 place-items-center rounded-xl bg-accent/15 text-accent-text">
        <Icon name={icon} className="size-6" />
      </div>
      <h3 className="mb-1.5 font-display text-lg font-extrabold">{title}</h3>
      <div className="text-muted">{children}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="relative rounded-2xl border border-line bg-surface/90 p-5 pl-16">
      <span className="absolute left-5 top-5 grid size-8 place-items-center rounded-full bg-accent font-display font-extrabold text-on-accent">{n}</span>
      <h3 className="mb-1 font-display text-lg font-extrabold">{title}</h3>
      <p className="text-muted">{children}</p>
    </li>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-line bg-surface/90 px-5 py-4 open:border-line-strong">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
        {q}
        <span className="text-xl text-muted transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-3 text-muted">{children}</div>
    </details>
  );
}

export default function AboutScreen() {
  const { params, decimals, games } = useArcade();
  const burn = params ? params.burnBps / 100 : 50;
  const dev = params ? params.devBps / 100 : 40;
  const tre = params ? params.treasuryBps / 100 : 10;
  const fee = params ? formatWif(params.listingFee, decimals) : "1,000";
  const min = params ? formatWif(params.minVote, decimals) : "100";
  const shelf = games.filter((g) => g.active && g.meta);
  const ex = (amount: number, self = false) => {
    const d = self ? 0 : (amount * dev) / 100, t = (amount * tre) / 100;
    return { burn: amount - d - t, dev: d, tre: t };
  };
  const a = ex(300), b = ex(200, true);
  const n = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1 });

  return (
    <Screen title="About PlayChain Flat">
      <div className="grid max-w-5xl gap-2">
        <p className="text-lg text-fg/85">
          PlayChain Flat is a console-style home for web3 games on Robinhood Chain. Developers list games by burning $WIF. Players vote for the
          games they love with $WIF, and the most-voted game of each day becomes tomorrow's Spotlight, the hero on the home screen. Every vote
          burns $WIF, pays the game's developer and funds the platform in one transaction, so players decide what gets seen and developers get
          paid for making games people come back to.
        </p>

        <div className="my-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface/90 p-5">
            <div className="text-sm font-bold uppercase tracking-[0.14em] text-muted">Games on the shelf</div>
            <div className="mt-1 font-display text-4xl font-extrabold text-accent-text">{shelf.length || 3}</div>
            <div className="text-sm text-muted">Each one free to play, right in the console</div>
          </div>
          <div className="rounded-2xl border border-line bg-surface/90 p-5">
            <div className="text-sm font-bold uppercase tracking-[0.14em] text-muted">Every vote</div>
            <div className="mt-1 font-display text-4xl font-extrabold"><span className="text-accent-2">{burn}%</span> burned</div>
            <div className="text-sm text-muted">{dev}% to the developer, {tre}% to the treasury</div>
          </div>
          <div className="rounded-2xl border border-line bg-surface/90 p-5">
            <div className="text-sm font-bold uppercase tracking-[0.14em] text-muted">New Spotlight</div>
            <div className="mt-1 font-display text-4xl font-extrabold text-teal">Every day</div>
            <div className="text-sm text-muted">Yesterday's most-voted game takes the hero spot</div>
          </div>
        </div>

        <BurnCounter className="mb-6 max-w-sm" />

        <Section title="How it works">
          <ol className="grid gap-3 md:grid-cols-2">
            <Step n={1} title="Browse and play">Pick a game from the shelf and play it full screen. No wallet, no sign-up, nothing to install.</Step>
            <Step n={2} title="Vote with $WIF">Liked it? Vote with {min} $WIF or more. You see exactly where every token goes before you sign.</Step>
            <Step n={3} title="Burn and pay, in one go">Your vote burns {burn}% of the $WIF, sends {dev}% to the game's developer and {tre}% to the treasury, straight from your wallet.</Step>
            <Step n={4} title="Crown the Spotlight">At the end of each day the most-voted game becomes tomorrow's Spotlight. Then a new race begins.</Step>
          </ol>
        </Section>

        <Section title="Who it's for">
          <div className="grid gap-3 md:grid-cols-2">
            <Card icon="gamepad" title="Players">
              <ul className="grid list-disc gap-1 pl-5">
                <li>Play every game for free, with keyboard, mouse, touch or a gamepad.</li>
                <li>Your vote decides what everyone sees on the home screen tomorrow.</li>
                <li>Watch the Live Race, the burn counter and the leaderboards move as people vote.</li>
                <li>Make it yours: themes, backgrounds and menu music in Settings.</li>
              </ul>
            </Card>
            <Card icon="upload" title="Developers">
              <ul className="grid list-disc gap-1 pl-5">
                <li>List any browser game by burning {fee} $WIF. No approval queue for the listing itself.</li>
                <li>Earn {dev}% of every vote your game gets, paid straight to your wallet.</li>
                <li>Win the Spotlight to put your game in front of every player for a day.</li>
                <li>
                  See <Link to="/developers" className="font-bold text-accent-text">the Developers page</Link> for the metadata format and the listing flow.
                </li>
              </ul>
            </Card>
          </div>
        </Section>

        <Section title="The flywheel">
          <Flywheel />
        </Section>

        <Section title="Where your vote goes">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface/90 p-5">
            <div className="mb-3 flex h-10 overflow-hidden rounded-lg font-bold" role="img" aria-label={`${burn}% burned, ${dev}% developer, ${tre}% treasury`}>
              <div className="grid place-items-center bg-accent-2 text-black" style={{ width: `${burn}%` }}>{burn}% burned</div>
              <div className="grid place-items-center bg-accent text-on-accent" style={{ width: `${dev}%` }}>{dev}% developer</div>
              <div className="grid place-items-center bg-teal text-black" style={{ width: `${tre}%` }}>{tre}%</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left">
                <thead className="text-sm uppercase tracking-wide text-muted">
                  <tr><th className="py-2 pr-4">Example</th><th className="py-2 pr-4">Burned</th><th className="py-2 pr-4">Developer</th><th className="py-2">Treasury</th></tr>
                </thead>
                <tbody className="tabular-nums">
                  <tr className="border-t border-line"><td className="py-2 pr-4">A developer lists a game ({fee} WIF)</td><td className="py-2 pr-4 text-accent-2">{fee}</td><td className="py-2 pr-4">0</td><td className="py-2">0</td></tr>
                  <tr className="border-t border-line"><td className="py-2 pr-4">A player votes 300 WIF</td><td className="py-2 pr-4 text-accent-2">{n(a.burn)}</td><td className="py-2 pr-4">{n(a.dev)}</td><td className="py-2">{n(a.tre)}</td></tr>
                  <tr className="border-t border-line"><td className="py-2 pr-4">The developer votes 200 WIF for their own game</td><td className="py-2 pr-4 text-accent-2">{n(b.burn)}</td><td className="py-2 pr-4">0</td><td className="py-2">{n(b.tre)}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted">A developer voting for their own game burns the developer share too, so nobody can buy the Spotlight at a discount.</p>
          </div>
        </Section>

        {shelf.length > 0 && (
          <Section title="The games">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shelf.map((g) => (
                <Link key={g.key} to={`/game/${g.key}`} className="group overflow-hidden rounded-2xl border border-line bg-surface/90 hover:border-line-strong">
                  <div className="aspect-video overflow-hidden bg-black">
                    <img src={localize(g.meta!.cover)} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <div className="p-4">
                    <div className="text-sm font-bold uppercase tracking-[0.12em] text-accent-text">{g.meta!.genre}</div>
                    <div className="font-display text-lg font-extrabold">{g.meta!.name}</div>
                    <div className="text-sm text-muted">{g.meta!.tagline}</div>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        <Section title="Safe by design">
          <div className="grid gap-3 md:grid-cols-3">
            <Card icon="shieldCheck" title="No custody">
              Tokens move straight from your wallet to the burn address, the developer and the treasury. The contract never holds $WIF, and its owner can't move anyone's tokens.
            </Card>
            <Card icon="shield" title="Capped fees">
              Fee changes are limited onchain: the treasury can never take more than 20%, and at least 20% of every vote always burns.
            </Card>
            <Card icon="eye" title="Sandboxed games">
              Every game runs in a locked-down frame with no access to your wallet. Only the console asks you to sign, and it always shows the split first.
            </Card>
          </div>
        </Section>

        <Section title="Questions">
          <div className="grid gap-2">
            <Faq q="Do I need $WIF to play?">No. Every game is free to play. You only need $WIF if you want to vote for a game.</Faq>
            <Faq q="What is demo mode?">
              Until the PlayChain contract is live on Robinhood Chain, the console runs a simulated arcade in your browser with test $WIF and the same rules as the
              contract. Nothing touches a real wallet.
            </Faq>
            <Faq q="How is the Spotlight chosen?">
              Each day (an epoch) the contract tracks which game has the most $WIF voted for it. When the day ends, that game becomes the Spotlight for the next day.
              If two games tie, the one that reached the top total first keeps it.
            </Faq>
            <Faq q="What happens to burned $WIF?">It is sent to the dead address 0x…dEaD, where nobody can ever spend it, so it leaves the supply for good.</Faq>
            <Faq q="Can I list my own game?">
              Yes, if it runs in a browser. Host it, write a small meta.json describing it, and list it from the{" "}
              <Link to="/developers" className="font-bold text-accent-text">Developers page</Link>. Your game must be served from an approved address so players stay safe.
            </Faq>
            <Faq q="How do I control the console?">
              Arrow keys move around, Enter opens, Esc goes back, V votes for the selected game and M opens the menu. A gamepad and touch work too. In a game, the round
              PlayChain button in the corner opens the console menu.
            </Faq>
            <Faq q="Is this affiliated with Robinhood?">No. PlayChain Flat is an independent project that runs on Robinhood Chain, a public network anyone can build on.</Faq>
          </div>
        </Section>

        <Section title="Built for the World is Flat hackathon">
          <div className="grid gap-3 md:grid-cols-3">
            <Card icon="trophy" title="A real reason to use $WIF">Voting is the whole game: $WIF decides what gets seen and who gets paid.</Card>
            <Card icon="clock" title="A flywheel that holds up">A new Spotlight every day brings players back, and developers bring their players to vote.</Card>
            <Card icon="check" title="Works and built well">Tested contract with no custody, sandboxed games, and a console you can drive with a gamepad.</Card>
          </div>
          <p className="text-muted">
            <a className="font-bold text-accent-text" href={consoleConfig.links.hackathon} target="_blank" rel="noreferrer">World is Flat hackathon</a>
            {" · "}
            <a className="font-bold text-accent-text" href={consoleConfig.links.repo} target="_blank" rel="noreferrer">Source code</a>
          </p>
        </Section>

        <Section title="Contracts">
          <ul className="grid gap-1 font-mono text-sm">
            <li>
              PlayChainArcade:{" "}
              {consoleConfig.arcadeAddress ? (
                <a className="text-accent-text" href={addressUrl(consoleConfig.arcadeAddress)} target="_blank" rel="noreferrer">
                  {consoleConfig.arcadeAddress}
                </a>
              ) : (
                "not deployed yet"
              )}
            </li>
            <li>
              $WIF:{" "}
              <a className="text-accent-text" href={addressUrl(consoleConfig.wifAddress)} target="_blank" rel="noreferrer">
                {consoleConfig.wifAddress}
              </a>
            </li>
            <li>Network: Robinhood Chain mainnet (chain id {consoleConfig.chainId})</li>
          </ul>
        </Section>

        <Section title="Disclaimer">
          <p className="text-muted">
            {DISCLAIMER} $WIF is used to vote and comes with no promise of value or return. Built for the World is Flat hackathon.
          </p>
        </Section>
      </div>
      <Footer />
    </Screen>
  );
}
