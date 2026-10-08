import Foundation
import Combine

@MainActor
class BitcoinPriceService: ObservableObject {
    @Published var currentPrice: Double = 0.0
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?
    @Published var cryptoPrices: [String: Double] = [:]
    @Published var availableCryptos: [CryptoInfo] = []
    
    private var updateTimer: Timer?
    private let session = URLSession.shared
    
    // CoinGecko API endpoints
    private let btcPriceURL = URL(string: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd")!
    private let cryptoListURL = URL(string: "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1")!
    
    func startPriceUpdates(onPriceUpdate: @escaping (Double) -> Void) async {
        // Initial fetch of BTC price and crypto list
        await fetchBitcoinPrice()
        await fetchAvailableCryptos()
        onPriceUpdate(currentPrice)
        
        // Set up timer for updates every 30 seconds
        updateTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { _ in
            Task { @MainActor in
                await self.fetchBitcoinPrice()
                onPriceUpdate(self.currentPrice)
            }
        }
    }
    
    nonisolated func stopPriceUpdates() {
        Task { @MainActor in
            updateTimer?.invalidate()
            updateTimer = nil
        }
    }
    
    private func fetchBitcoinPrice() async {
        isLoading = true
        errorMessage = nil
        
        do {
            let (data, response) = try await session.data(from: btcPriceURL)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                throw BitcoinPriceError.invalidResponse
            }
            
            let priceResponse = try JSONDecoder().decode(CoinGeckoPriceResponse.self, from: data)
            
            if let bitcoinData = priceResponse.bitcoin {
                self.currentPrice = bitcoinData.usd
            } else {
                throw BitcoinPriceError.invalidData
            }
            
        } catch {
            self.errorMessage = "Failed to fetch price: \(error.localizedDescription)"
            print("Error fetching Bitcoin price: \(error)")
        }
        
        isLoading = false
    }
    
    private func fetchAvailableCryptos() async {
        do {
            let (data, response) = try await session.data(from: cryptoListURL)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                print("Failed to fetch crypto list - HTTP status: \((response as? HTTPURLResponse)?.statusCode ?? 0)")
                loadFallbackCryptos()
                return
            }
            
            let cryptos = try JSONDecoder().decode([CryptoInfo].self, from: data)
            print("Successfully fetched \(cryptos.count) cryptocurrencies")
            self.availableCryptos = cryptos
            
            // Store prices for quick access
            for crypto in cryptos {
                self.cryptoPrices[crypto.id] = crypto.current_price
            }
            
        } catch {
            print("Error fetching crypto list: \(error)")
            loadFallbackCryptos()
        }
    }
    
    private func loadFallbackCryptos() {
        // Fallback list of popular cryptocurrencies
        self.availableCryptos = [
            CryptoInfo(id: "bitcoin", symbol: "btc", name: "Bitcoin", current_price: currentPrice, market_cap_rank: 1, image: ""),
            CryptoInfo(id: "ethereum", symbol: "eth", name: "Ethereum", current_price: 2500.0, market_cap_rank: 2, image: ""),
            CryptoInfo(id: "cardano", symbol: "ada", name: "Cardano", current_price: 0.5, market_cap_rank: 8, image: ""),
            CryptoInfo(id: "solana", symbol: "sol", name: "Solana", current_price: 150.0, market_cap_rank: 5, image: ""),
            CryptoInfo(id: "chainlink", symbol: "link", name: "Chainlink", current_price: 15.0, market_cap_rank: 15, image: ""),
            CryptoInfo(id: "polygon", symbol: "matic", name: "Polygon", current_price: 0.8, market_cap_rank: 12, image: ""),
            CryptoInfo(id: "litecoin", symbol: "ltc", name: "Litecoin", current_price: 80.0, market_cap_rank: 20, image: ""),
            CryptoInfo(id: "dogecoin", symbol: "doge", name: "Dogecoin", current_price: 0.1, market_cap_rank: 10, image: "")
        ]
        
        // Store fallback prices
        for crypto in availableCryptos {
            self.cryptoPrices[crypto.id] = crypto.current_price
        }
        
        print("Loaded \(availableCryptos.count) fallback cryptocurrencies")
    }
    
    func getCryptoPrice(id: String) -> Double {
        return cryptoPrices[id] ?? 0.0
    }
    
    deinit {
        stopPriceUpdates()
    }
}

// MARK: - Data Models

struct CoinGeckoPriceResponse: Codable {
    let bitcoin: BitcoinPrice?
}

struct BitcoinPrice: Codable {
    let usd: Double
}

struct CryptoInfo: Codable, Identifiable {
    let id: String
    let symbol: String
    let name: String
    let current_price: Double
    let market_cap_rank: Int?
    let image: String
}

// MARK: - Error Types

enum BitcoinPriceError: Error, LocalizedError {
    case invalidResponse
    case invalidData
    case networkError
    
    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from server"
        case .invalidData:
            return "Invalid data received"
        case .networkError:
            return "Network connection error"
        }
    }
}