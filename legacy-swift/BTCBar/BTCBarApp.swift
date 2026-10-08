import SwiftUI
import AppKit

@main
struct BTCBarApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        Settings {
            EmptyView()
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var popover: NSPopover!
    private var bitcoinService: BitcoinPriceService!
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Hide the dock icon
        NSApp.setActivationPolicy(.accessory)
        
        // Initialize bitcoin service on main actor
        Task { @MainActor in
            bitcoinService = BitcoinPriceService()
            setupUI()
        }
    }
    
    @MainActor
    private func setupUI() {
        // Create status item with priority positioning (right next to system icons)
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.autosaveName = "BTCBarStatusItem"
        
        if let statusButton = statusItem.button {
            statusButton.title = "₿ Loading..."
            statusButton.action = #selector(togglePopover)
            statusButton.target = self
        }
        
        // Create popover
        popover = NSPopover()
        popover.contentSize = NSSize(width: 350, height: 450)
        popover.behavior = .transient
        popover.contentViewController = NSHostingController(rootView: ContentView(bitcoinService: bitcoinService))
        
        // Start price updates
        Task {
            await bitcoinService.startPriceUpdates { [weak self] price in
                Task { @MainActor in
                    if let statusButton = self?.statusItem.button {
                        let formatter = NumberFormatter()
                        formatter.numberStyle = .decimal
                        formatter.usesGroupingSeparator = true
                        formatter.locale = Locale(identifier: "en_US")
                        formatter.maximumFractionDigits = 0
                        let formattedPrice = formatter.string(from: NSNumber(value: price)) ?? String(format: "%.0f", price)
                        statusButton.title = "₿ $\(formattedPrice)"
                    }
                }
            }
        }
    }
    
    @objc func togglePopover() {
        if let button = statusItem.button {
            if popover.isShown {
                popover.performClose(nil)
            } else {
                popover.show(relativeTo: button.bounds, of: button, preferredEdge: NSRectEdge.minY)
            }
        }
    }
}