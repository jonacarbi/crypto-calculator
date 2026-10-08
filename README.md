# Crypto Calculator 2

Live crypto ⇄ fiat converter that lives in your menu bar (macOS) or system tray (Windows, Linux).
Rust + Tauri 2 core, zero-dependency HTML/CSS/JS UI. Prices from CoinGecko's free API (no key).

- Tray title shows the live BTC price (macOS/Linux; tooltip on Windows), refreshed every 60 s
- Top-100 coins with search (`/` or `⌘K`), 24h change and 7-day sparkline
- Two-way converter: type in either field; 9 fiat currencies; quick amounts; copy buttons
- Light/dark follows the system; keyboard first: `Esc` hides, `⌘R` refreshes, `⌘Q` quits
- Single instance; closing the window just hides it

## Develop

```bash
npm install
npm run dev        # run with hot reload
npm test           # JS number helpers + Rust unit tests
npm run build      # bundles for the current OS → src-tauri/target/release/bundle
```

Linux build deps: `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev`.

## Release builds (all platforms)

Push to `main` (or run the `build` workflow manually). GitHub Actions produces:
macOS universal `.dmg`/`.app`, Windows `.exe` (NSIS) + `.msi`, Linux `.deb`/`.rpm`/`.AppImage`.
Download them from the run's artifacts.

Builds are unsigned: on macOS right-click → Open the first time; on Windows choose "More info → Run anyway".

## Layout

- `src-tauri/src/market.rs` – CoinGecko fetch, currency allowlist, tray price formatting
- `src-tauri/src/lib.rs` – tray, window toggling, refresh loop, commands
- `src/` – UI (`main.js`, `num.js` helpers, `styles.css`)
- `design/` – logo + tray icon sources (`npx tauri icon design/logo.svg` regenerates app icons)
- `legacy-swift/` – the original SwiftUI v1 (macOS only)
