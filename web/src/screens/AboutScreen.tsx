import { useArcade } from "../arcade/store";
import { Section } from "../components/controls";
import { Flywheel } from "../components/Flywheel";
import { BurnCounter } from "../components/BurnCounter";
import { Footer } from "../components/Footer";
import { Screen } from "../components/Screen";
import { consoleConfig, DISCLAIMER } from "../config/console.config";
import { addressUrl } from "../web3/client";
import { formatWif } from "../web3/tokens";

export default function AboutScreen() {
  const { params, decimals } = useArcade();
  const burn = params ? params.burnBps / 100 : 50;
  const dev = params ? params.devBps / 100 : 40;
  const tre = params ? params.treasuryBps / 100 : 10;
  const fee = params ? formatWif(params.listingFee, decimals) : "1,000";
  const min = params ? formatWif(params.minVote, decimals) : "100";

  return (
    <Screen title="About PlayChain Flat">
      <div className="grid max-w-4xl gap-2">
        <p className="text-lg text-fg/85">
          PlayChain Flat is a console-style home for web3 games on Robinhood Chain. Developers list games by burning $WIF. Players vote for the
          games they love with $WIF, and the most-voted game of each day becomes tomorrow's Spotlight, the hero on the home screen. Every vote
          burns $WIF, pays the game's developer and funds the platform in one transaction, so players decide what gets seen and developers get
          paid for making games people come back to.
        </p>

        <BurnCounter className="my-4 max-w-sm" />

        <Section title="The flywheel">
          <Flywheel />
        </Section>

        <Section title="How $WIF is used">
          <ul className="grid gap-2">
            <li>
              <b>Listing:</b> {fee} WIF, burned in full.
            </li>
            <li>
              <b>Voting:</b> minimum {min} WIF. {burn}% is burned, {dev}% goes to the game's developer, {tre}% to the treasury. A developer voting
              for their own game burns the developer share too, so the Spotlight can't be bought at a discount.
            </li>
            <li>
              <b>Spotlight:</b> each day (epoch) the contract tracks the leading game. Ties go to the game that reached the top total first.
            </li>
            <li>
              <b>No custody:</b> tokens move straight from your wallet to the burn address, the developer and the treasury. The contract never
              holds $WIF, and its owner can't move anyone's tokens. Fee changes are capped onchain (treasury at most 20%, burn at least 20%).
            </li>
          </ul>
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
