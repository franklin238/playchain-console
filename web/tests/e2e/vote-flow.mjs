// End-to-end: real console build + anvil fork of Robinhood Chain + a test EIP-1193 wallet.
import { chromium } from "playwright-core";

const BASE = process.env.BASE || "http://localhost:4950";
const ACC = process.env.ACC || "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const OUT = process.env.OUT || "/tmp/e2e";

const providerScript = `
(() => {
  const ACC = ${JSON.stringify(ACC)};
  const RPC = "http://127.0.0.1:8545";
  let id = 0;
  const listeners = {};
  const rpc = async (method, params) => {
    const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params: params || [] }) });
    const j = await r.json();
    if (j.error) { const e = new Error(j.error.message); e.code = j.error.code; e.data = j.error.data; throw e; }
    return j.result;
  };
  const provider = {
    isMetaMask: false,
    request: async ({ method, params }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [ACC];
      if (method === "eth_chainId") return "0x1237";
      if (method === "net_version") return "4663";
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      if (method === "wallet_requestPermissions") return [{ parentCapability: "eth_accounts" }];
      if (method === "wallet_getPermissions") return [{ parentCapability: "eth_accounts" }];
      if (method === "eth_sendTransaction") { window.__txs = (window.__txs || 0) + 1; }
      return rpc(method, params);
    },
    on: (e, f) => { (listeners[e] = listeners[e] || []).push(f); },
    removeListener: (e, f) => { listeners[e] = (listeners[e] || []).filter((x) => x !== f); },
  };
  window.ethereum = provider;
  const info = { uuid: "e2e-0000-0000-0000-000000000001", name: "Test Wallet", icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='%23c8ff4d'/%3E%3C/svg%3E", rdns: "dev.playchain.test" };
  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
})();
`;

const errors = [];
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.addInitScript(providerScript);

await page.goto(BASE + "/");
await page.keyboard.press("Space"); // skip boot
await page.waitForSelector("text=Live Race");
await page.waitForSelector("text=Spotlight", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}-1-home.png` });

await page.getByRole("button", { name: "Connect wallet" }).click();
await page.getByRole("button", { name: /Test Wallet/ }).click();
await page.waitForSelector(`text=${ACC.slice(0, 6)}`, { timeout: 15000 });
await page.waitForTimeout(1500);

await page.goto(BASE + "/game/1");
await page.getByRole("button", { name: /Vote with \$WIF/ }).click();
await page.waitForSelector("text=You burn");
await page.getByRole("button", { name: "5x" }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}-2-sheet.png` });
await page.getByRole("button", { name: "Approve and vote" }).click();
await page.waitForSelector("text=Vote confirmed", { timeout: 60000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}-3-done.png` });
await page.getByRole("button", { name: "Done" }).click();

await page.goto(BASE + "/activity");
await page.waitForSelector("text=voted", { timeout: 30000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}-4-activity.png`, fullPage: true });

await page.goto(BASE + "/");
await page.keyboard.press("Space");
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}-5-home-after.png`, fullPage: true });

console.log("txs sent:", await page.evaluate(() => window.__txs || 0));
console.log("errors:", JSON.stringify(errors.filter((e) => !/favicon|ERR_BLOCKED|Failed to load resource/.test(e)), null, 1));
await browser.close();
