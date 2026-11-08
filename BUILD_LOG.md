# Build log

Dated entries of what was built. Building for the World is Flat hackathon started 21 Oct 2026, 17:30 UTC. Submissions close 12 Nov 2026, 17:30 UTC.

## 2026-11-04

- Verified chain facts against mainnet: chain id 4663 from `https://rpc.mainnet.chain.robinhood.com`; $WIF at `0x5173b8eA6923c2d40267890D45C46a3480954773` returns symbol `WIF`, name `World is Flat`, 18 decimals, total supply about 1e9, contract code present.
- Wrote `PlayChainArcade.sol`: listing fee burn, Spotlight voting with a 50/40/10 burn/developer/treasury split, self-vote rule, per-epoch leader tracking in constant time, capped owner powers, Ownable2Step, Pausable, ReentrancyGuard, no custody.
- Tests: 41 unit and fuzz tests, 4 invariants (contract never holds $WIF, conservation, lifetime totals, leader is max), 2 mainnet fork tests against the real $WIF. 100% line, branch and function coverage on the contract.
- Fork test confirmed $WIF has no fee on transfer, so the split lands exactly.
- Slither: 2 informational findings, explained in the README.
- Ported the console shell from the main PlayChain project (input and focus navigation, gamepad, boot screen, wallpapers, settings) into a new repo, re-skinned it, and replaced its Solana/Supabase backend with Robinhood Chain reads and wagmi/viem wallet code.
- Built the console screens: Spotlight hero, game shelf, Live Race, vote sheet with live split preview, Developers (list and edit), Activity feed with totals, About with flywheel diagram, disclaimer footer.
- Built a sandboxed game player with a validated postMessage bridge (ready, score, exit, save, load).
- End-to-end test on a local fork of mainnet: deployed the arcade, listed 3 games, voted 500 WIF through the UI with a test wallet. Onchain: 250 burned, 200 to developer, 50 to treasury.
- Games: Neon Tide, Hollow Kingdom and Signal Lost built from their specs as single-file browser games. Rise of Gamdom Man was left out: it uses a third-party brand without permission (rule 13).

## 2026-11-06

- Home: hovering, focusing or touching a shelf game previews it in the Spotlight hero, and the last one touched stays there.
- About: rebuilt the flywheel diagram. Player: a floating PlayChain menu replaces the top bar so games get the full screen.
- Demo mode: a simulated arcade in the browser (`web/src/arcade/demo.ts`) with the same rules as the contract (50/40/10 split, self-vote burn, daily Spotlight), a demo wallet with test $WIF, and seeded history. It runs until a contract address is configured, so judges can try every flow with no wallet.
- Platform: burn counter, leaderboards (games, developers, voting streaks), shelf search and filters, a double-click launcher (`Start PlayChain.bat`) and a quick start in the README.
- Platform audio: new lobby music, sounds for moving focus, selecting, opening sheets, voting and burning, and ducking while a game plays.
- Signal Lost: Mixer tile, 9 regions and 101 solver-verified levels; Static Storm mode, pulse, achievements, radio fragments, Daily Signal and an in-game guide.
- Hollow Kingdom: five-kingdom campaign with crowns, wave warnings, daily events and a guide. Rebuilt the audio engine to stop crackling.
- Neon Tide: boost fuel, 12 levels with star ratings, a How to Play guide, new soundtrack and a crackle-free audio chain.

## 2026-11-07

- Signal Lost: 100 more sectors (201 in total, all verified by the solver) and 8 star awards, from Static Listener (25 stars) to Perfect Signal (every star), shown on the title, the map and at the end of the campaign. Save data migrates so existing progress is kept.
- Signal Lost: new score per region (key, tempo, bass groove and hook) whose layers build as receivers lock on, new sound effects, compressor and limiter on the master. Measured in the browser with no clipping.
- Hollow Kingdom overhaul: six-wave hordes from both walls from the first night; a Soldiers job that fights outside the gates; four new monsters (Brute, Bat, Burster, Shaman) and its own colour for every kind; slower gathering and a new iron mine; an Armory with five weapons; daily orders with rewards; a different castle shape, roof and room style for each kingdom; thin health bars. New score and effects.
- Hollow Kingdom balance re-tuned with the bot in `tools/balance.cjs`: the first two kingdoms are winnable every time, the last three are much harder.
- Neon Tide: vibrant colours back, with calmer collectible orbs.

## 2026-11-08

- Pre-submission review against the build spec and the official rules. Updated this log, the README (games section, links), `SUBMISSION.md` (repo link) and `DEPLOY.md` (repo visibility for judges, deploy timing).
- Still to do before submitting: mainnet deploy and source verification, game listings and demo votes on mainnet, the Vercel site, the demo video, and making the repo visible to the judges.
