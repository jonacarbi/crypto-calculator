// Web stand-in for the Tauri bridge so the real app UI runs on the landing page.
let vs = 'usd';
async function fetchSnap() {
  const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=${vs}&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h`);
  if (!r.ok) throw r.status === 429 ? 'CoinGecko rate limit hit — try again shortly' : `CoinGecko returned HTTP ${r.status}`;
  const snap = { vs, coins: await r.json(), fetched_at: Date.now() };
  const btc = snap.coins.find((c) => c.id === 'bitcoin');
  if (btc) {
    // Kept on window too: the parent may not be listening yet when the first price lands.
    window.__tray = { type: 'tray', vs, price: btc.current_price };
    parent.postMessage(window.__tray, location.origin);
  }
  return snap;
}
window.__TAURI__ = {
  core: {
    invoke: async (cmd, args) => {
      if (cmd === 'get_snapshot') return null;
      if (cmd === 'set_currency') { vs = args.vs; return fetchSnap(); }
      if (cmd === 'refresh') return fetchSnap();
      return null; // quit / hide are no-ops on the web
    },
  },
  event: { listen: async () => {} },
  window: { getCurrentWindow: () => ({ hide() {} }) },
};
