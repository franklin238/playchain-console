import { consoleConfig, DISCLAIMER } from "../config/console.config";
import { addressUrl } from "../web3/client";

export function Footer() {
  return (
    <footer className="mt-10 border-t border-line pb-24 pt-6 text-sm text-muted">
      <p className="max-w-3xl">{DISCLAIMER}</p>
      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        {consoleConfig.arcadeAddress ? (
          <a className="underline-offset-4 hover:text-accent-text hover:underline" href={addressUrl(consoleConfig.arcadeAddress)} target="_blank" rel="noreferrer">
            PlayChainArcade contract
          </a>
        ) : (
          <span>Contract: not deployed yet (preview)</span>
        )}
        <a className="underline-offset-4 hover:text-accent-text hover:underline" href={addressUrl(consoleConfig.wifAddress)} target="_blank" rel="noreferrer">
          $WIF token
        </a>
        <a className="underline-offset-4 hover:text-accent-text hover:underline" href={consoleConfig.links.repo} target="_blank" rel="noreferrer">
          Source code
        </a>
        <span>Built on Robinhood Chain for the World is Flat hackathon</span>
      </p>
    </footer>
  );
}
