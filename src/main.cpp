#include "StreamProcessor.h"
#include <iostream>
#include <iomanip>
#include <thread>
#include <csignal>

using namespace MarketData;

// Global processor for signal handling
StreamProcessor* g_processor = nullptr;

void signalHandler(int signal) {
    std::cout << "\nReceived signal " << signal << ", shutting down..." << std::endl;
    if (g_processor) {
        g_processor->stop();
    }
    exit(0);
}

void printOrderBook(const std::string& symbol, std::shared_ptr<OrderBook> book) {
    std::cout << "\n========== Order Book: " << symbol << " ==========\n";
    
    std::cout << "Best Bid: $" << std::fixed << std::setprecision(2) << book->getBestBid() << "\n";
    std::cout << "Best Ask: $" << book->getBestAsk() << "\n";
    std::cout << "Spread: $" << book->getSpread() << "\n";
    
    std::cout << "\nTop 5 Bids:\n";
    auto bids = book->getBidLevels(5);
    for (const auto& [price, qty] : bids) {
        std::cout << "  $" << price << " x " << qty << "\n";
    }
    
    std::cout << "\nTop 5 Asks:\n";
    auto asks = book->getAskLevels(5);
    for (const auto& [price, qty] : asks) {
        std::cout << "  $" << price << " x " << qty << "\n";
    }
    
    std::cout << "==========================================\n";
}

void printAnalytics(const std::string& symbol, std::shared_ptr<Analytics> analytics) {
    std::cout << "\n========== Analytics: " << symbol << " ==========\n";
    std::cout << std::fixed << std::setprecision(2);
    
    std::cout << "Short-term SMA (20): $" << analytics->getShortTermSMA(symbol) << "\n";
    std::cout << "Medium-term SMA (50): $" << analytics->getMediumTermSMA(symbol) << "\n";
    std::cout << "Long-term SMA (200): $" << analytics->getLongTermSMA(symbol) << "\n";
    std::cout << "EMA (20): $" << analytics->calculateEMA(symbol, 20, 0.1) << "\n";
    std::cout << "Volatility: " << analytics->calculateVolatility(symbol) << "\n";
    std::cout << "VWAP (20): $" << analytics->calculateVWAP(symbol, 20) << "\n";
    std::cout << "5-tick Change: " << analytics->getChangePercent(symbol, 5) << "%\n";
    
    std::cout << "==========================================\n";
}

int main() {
    std::cout << "========================================\n";
    std::cout << "  Real-Time Market Data Stream Processor\n";
    std::cout << "  High-Performance Financial Data System\n";
    std::cout << "========================================\n\n";
    
    // Setup signal handling
    signal(SIGINT, signalHandler);
    signal(SIGTERM, signalHandler);
    
    // Define symbols to track
    std::vector<std::string> symbols = {
        "AAPL",   // Apple
        "GOOGL",  // Google
        "MSFT",   // Microsoft
        "AMZN",   // Amazon
        "TSLA",   // Tesla
        "NVDA",   // NVIDIA
        "JPM",    // JPMorgan
        "BAC"     // Bank of America
    };
    
    std::cout << "Tracking " << symbols.size() << " symbols: ";
    for (size_t i = 0; i < symbols.size(); ++i) {
        std::cout << symbols[i];
        if (i < symbols.size() - 1) std::cout << ", ";
    }
    std::cout << "\n\n";
    
    // Create and initialize stream processor
    const int NUM_THREADS = 4; // Multi-threaded processing
    StreamProcessor processor(NUM_THREADS);
    g_processor = &processor;
    
    std::cout << "Initializing stream processor with " << NUM_THREADS << " threads...\n";
    processor.initialize(symbols);
    
    // Add price alerts
    auto analytics = processor.getAnalytics();
    analytics->addAlert(PriceAlert("AAPL", 200.0, true));   // Alert when AAPL > $200
    analytics->addAlert(PriceAlert("TSLA", 150.0, false));  // Alert when TSLA < $150
    
    std::cout << "Added price alerts:\n";
    std::cout << "  - AAPL above $200\n";
    std::cout << "  - TSLA below $150\n\n";
    
    // Start processing
    std::cout << "Starting real-time data processing...\n";
    std::cout << "Target: <100ms latency, >10,000 ticks/sec throughput\n\n";
    processor.start();
    
    // Run for demonstration period
    const int DEMO_DURATION_SEC = 30;
    std::cout << "Running for " << DEMO_DURATION_SEC << " seconds...\n\n";
    
    for (int i = 0; i < DEMO_DURATION_SEC; ++i) {
        std::this_thread::sleep_for(std::chrono::seconds(1));
        
        // Print metrics every 5 seconds
        if ((i + 1) % 5 == 0) {
            processor.printMetrics();
            
            // Show sample analytics for first symbol
            if (i == 9) {  // After 10 seconds
                printAnalytics(symbols[0], analytics);
                
                auto orderBook = processor.getOrderBook(symbols[0]);
                if (orderBook) {
                    printOrderBook(symbols[0], orderBook);
                }
            }
        }
    }
    
    // Final metrics
    std::cout << "\nFinal Performance Report:\n";
    processor.printMetrics();
    
    // Show analytics for all symbols
    std::cout << "\nFinal Analytics Summary:\n";
    for (const auto& symbol : symbols) {
        auto history = analytics->getPriceHistory(symbol, 5);
        if (!history.empty()) {
            std::cout << symbol << ": Current Price = $" << std::fixed << std::setprecision(2) 
                      << history.back() << ", SMA(20) = $" << analytics->getShortTermSMA(symbol) 
                      << ", Volatility = " << analytics->calculateVolatility(symbol) << "\n";
        }
    }
    
    // Cleanup
    std::cout << "\nStopping processor...\n";
    processor.stop();
    
    std::cout << "\nProcessor stopped successfully.\n";
    std::cout << "========================================\n";
    
    return 0;
}
