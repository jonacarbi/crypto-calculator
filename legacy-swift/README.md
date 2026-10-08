# BTCBar - Bitcoin Price Menu Bar App

A sleek macOS menu bar application that displays real-time Bitcoin prices and provides instant USD ⟷ BTC conversion.

## Features

- **Live Bitcoin Price**: Real-time BTC price displayed in the menu bar, updating every 30 seconds
- **Currency Conversion**: Instant bidirectional conversion between USD and BTC
- **Clean Interface**: Modern SwiftUI design with rounded text fields and intuitive layout
- **Menu Bar Integration**: Runs as a lightweight menu bar app (no dock icon)
- **Real-time Updates**: Conversion values update as you type
- **Reliable API**: Uses CoinGecko's free API for accurate price data

## Requirements

- macOS 14.0 (Sequoia) or later
- Xcode 15.0 or later
- Apple Silicon (M1/M2/M3) or Intel Mac

## Installation & Setup

1. **Open the Project**:
   ```bash
   open BTCBar.xcodeproj
   ```

2. **Configure Code Signing**:
   - Select the BTCBar target in Xcode
   - Go to "Signing & Capabilities"
   - Set your Development Team
   - Xcode will automatically configure signing for local development

3. **Build & Run**:
   - Press `Cmd+R` to build and run
   - The app will appear in your menu bar as "₿ Loading..." then show the current price
   - No dock icon will appear (this is intentional)

## Usage

1. **View Price**: The current Bitcoin price is always visible in the menu bar
2. **Open Converter**: Click the menu bar icon to open the conversion popover
3. **Convert Currencies**: 
   - Enter USD amount to see equivalent BTC
   - Enter BTC amount to see equivalent USD
   - Values update in real-time as you type
4. **Quit**: Use the "Quit BTCBar" button in the popover

## Architecture

The app follows MVVM architecture with these key components:

- **BTCBarApp.swift**: Main app entry point and AppKit integration
- **ContentView.swift**: SwiftUI interface for the conversion popover
- **BitcoinPriceService.swift**: API service using async/await and URLSession
- **AppDelegate**: Manages menu bar integration and app lifecycle

## API

Uses CoinGecko's free public API:
- Endpoint: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd`
- No API key required
- Rate limit: Generous for personal use
- Updates every 30 seconds

## Troubleshooting

- **App doesn't appear**: Check menu bar on the right side, look for ₿ symbol
- **Network errors**: Ensure internet connection and firewall allows the app
- **Build errors**: Verify you're using Xcode 15+ and macOS 14+ deployment target

## License

This project is provided as-is for educational and personal use.