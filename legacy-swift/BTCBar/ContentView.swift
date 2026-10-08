import SwiftUI

struct ContentView: View {
    @ObservedObject var bitcoinService: BitcoinPriceService
    @State private var cryptoInput: String = ""
    @State private var usdInput: String = ""
    @State private var cryptoOutput: String = ""
    @State private var usdOutput: String = ""
    @State private var isUpdatingUSD = false
    @State private var isUpdatingCrypto = false
    @State private var selectedCrypto: CryptoInfo = CryptoInfo(id: "bitcoin", symbol: "BTC", name: "Bitcoin", current_price: 0, market_cap_rank: 1, image: "")
    @State private var searchText: String = ""
    @State private var showingDropdown: Bool = false
    
    var body: some View {
        VStack(spacing: 16) {
            // Header with current price
            VStack(spacing: 4) {
                Text("Bitcoin Price")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text("$\(formatCurrency(bitcoinService.currentPrice))")
                    .font(.title2)
                    .fontWeight(.semibold)
                    .foregroundColor(.orange)
            }
            .padding(.top, 8)
            
            Divider()
            
            // Cryptocurrency selector
            VStack(alignment: .leading, spacing: 8) {
                Text("Select Cryptocurrency")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Button(action: {
                    showingDropdown.toggle()
                    print("Dropdown toggled: \(showingDropdown), Available cryptos: \(bitcoinService.availableCryptos.count)")
                }) {
                    HStack {
                        Text(selectedCrypto.symbol.uppercased())
                            .fontWeight(.medium)
                        Text(selectedCrypto.name)
                            .foregroundColor(.secondary)
                        Spacer()
                        Image(systemName: showingDropdown ? "chevron.up" : "chevron.down")
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(.controlBackgroundColor))
                    .cornerRadius(6)
                }
                .buttonStyle(PlainButtonStyle())
                
                if showingDropdown {
                    cryptoDropdown
                }
            }
            
            // Crypto to USD conversion
            VStack(alignment: .leading, spacing: 8) {
                Text("\(selectedCrypto.symbol.uppercased()) to USD")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                HStack {
                    Text(selectedCrypto.symbol.uppercased())
                        .foregroundColor(.orange)
                        .fontWeight(.medium)
                    
                    TextField("Enter \(selectedCrypto.symbol.uppercased()) amount", text: $cryptoInput)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .onChange(of: cryptoInput) { newValue in
                            if !isUpdatingUSD {
                                updateUSDFromCrypto(newValue)
                            }
                        }
                }
                
                HStack {
                    Text("$")
                        .foregroundColor(.secondary)
                    
                    TextField("USD amount", text: $usdOutput)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .foregroundColor(.secondary)
                }
            }
            
            // USD to Crypto conversion
            VStack(alignment: .leading, spacing: 8) {
                Text("USD to \(selectedCrypto.symbol.uppercased())")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                HStack {
                    Text("$")
                        .foregroundColor(.secondary)
                    
                    TextField("Enter USD amount", text: $usdInput)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .onChange(of: usdInput) { newValue in
                            if !isUpdatingCrypto {
                                updateCryptoFromUSD(newValue)
                            }
                        }
                }
                
                HStack {
                    Text(selectedCrypto.symbol.uppercased())
                        .foregroundColor(.orange)
                        .fontWeight(.medium)
                    
                    TextField("\(selectedCrypto.symbol.uppercased()) amount", text: $cryptoOutput)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            // Quit button
            Button("Quit BTCBar") {
                NSApplication.shared.terminate(nil)
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .padding(.bottom, 8)
        }
        .padding(16)
        .frame(width: 350, height: 450)
    }
    
    var cryptoDropdown: some View {
        VStack(spacing: 8) {
            // Search field
            TextField("Search cryptocurrencies...", text: $searchText)
                .textFieldStyle(RoundedBorderTextFieldStyle())
            
            // Crypto list (showing more items without ScrollView)
            VStack(spacing: 2) {
                ForEach(Array(filteredCryptos.prefix(12).enumerated()), id: \.element.id) { index, crypto in
                    Button(action: {
                        selectedCrypto = crypto
                        showingDropdown = false
                        searchText = ""
                        clearInputs()
                    }) {
                        HStack {
                            Text(crypto.symbol.uppercased())
                                .fontWeight(.medium)
                                .foregroundColor(.primary)
                            Text(crypto.name)
                                .foregroundColor(.secondary)
                            Spacer()
                            Text("$\(formatPrice(crypto.current_price))")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(crypto.id == selectedCrypto.id ? Color.accentColor.opacity(0.2) : Color.clear)
                        .cornerRadius(4)
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
            .background(Color(.controlBackgroundColor))
            .cornerRadius(6)
        }
        .padding(.top, 4)
    }
    
    var filteredCryptos: [CryptoInfo] {
        let result: [CryptoInfo]
        if searchText.isEmpty {
            result = bitcoinService.availableCryptos
        } else {
            result = bitcoinService.availableCryptos.filter { crypto in
                crypto.name.localizedCaseInsensitiveContains(searchText) ||
                crypto.symbol.localizedCaseInsensitiveContains(searchText)
            }
        }
        print("Filtered cryptos: \(result.count) (search: '\(searchText)')")
        return result
    }
    
    private func updateCryptoFromUSD(_ usdString: String) {
        let cryptoPrice = bitcoinService.getCryptoPrice(id: selectedCrypto.id)
        guard let usdValue = Double(usdString), usdValue > 0, cryptoPrice > 0 else {
            isUpdatingCrypto = true
            cryptoOutput = ""
            isUpdatingCrypto = false
            return
        }
        
        let cryptoValue = usdValue / cryptoPrice
        isUpdatingCrypto = true
        cryptoOutput = formatNumber(cryptoValue, maxDecimals: 8)
        isUpdatingCrypto = false
    }
    
    private func updateUSDFromCrypto(_ cryptoString: String) {
        let cryptoPrice = bitcoinService.getCryptoPrice(id: selectedCrypto.id)
        guard let cryptoValue = Double(cryptoString), cryptoValue > 0, cryptoPrice > 0 else {
            isUpdatingUSD = true
            usdOutput = ""
            isUpdatingUSD = false
            return
        }
        
        let usdValue = cryptoValue * cryptoPrice
        isUpdatingUSD = true
        usdOutput = formatNumber(usdValue, maxDecimals: 2)
        isUpdatingUSD = false
    }
    
    private func clearInputs() {
        cryptoInput = ""
        usdInput = ""
        cryptoOutput = ""
        usdOutput = ""
    }
    
    private func formatPrice(_ price: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.usesGroupingSeparator = true
        formatter.locale = Locale(identifier: "en_US")
        
        if price >= 1000 {
            formatter.minimumFractionDigits = 2
            formatter.maximumFractionDigits = 2
        } else if price >= 1 {
            formatter.minimumFractionDigits = 2
            formatter.maximumFractionDigits = 2
        } else {
            formatter.minimumFractionDigits = 6
            formatter.maximumFractionDigits = 6
        }
        
        return formatter.string(from: NSNumber(value: price)) ?? String(format: "%.2f", price)
    }
    
    private func formatCurrency(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.usesGroupingSeparator = true
        formatter.locale = Locale(identifier: "en_US")
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter.string(from: NSNumber(value: amount)) ?? String(format: "%.2f", amount)
    }
    
    private func formatNumber(_ value: Double, maxDecimals: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = maxDecimals
        formatter.usesGroupingSeparator = true
        formatter.locale = Locale(identifier: "en_US")
        return formatter.string(from: NSNumber(value: value)) ?? String(value)
    }
}