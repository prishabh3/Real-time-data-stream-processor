#include "StreamProcessor.h"
#include "MatchingEngine.h"
#include "Logger.h"
#include "Config.h"
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

    std::cout << "Short-term SMA (20):  $" << analytics->getShortTermSMA(symbol) << "\n";
    std::cout << "Medium-term SMA (50): $" << analytics->getMediumTermSMA(symbol) << "\n";
    std::cout << "Long-term SMA (200):  $" << analytics->getLongTermSMA(symbol) << "\n";
    std::cout << "EMA (20):             $" << analytics->calculateEMA(symbol, 20, 0.1) << "\n";
    std::cout << "Volatility:            " << analytics->calculateVolatility(symbol) << "\n";
    std::cout << "VWAP (20):            $" << analytics->calculateVWAP(symbol, 20) << "\n";
    std::cout << "5-tick Change:         " << analytics->getChangePercent(symbol, 5) << "%\n";

    // ── New indicators ────────────────────────────────────────────────────
    auto rsi = analytics->calculateRSI(symbol);
    std::cout << "RSI (14):              " << std::setprecision(1) << rsi.value;
    if (rsi.isOverbought) std::cout << "  ⚠ OVERBOUGHT";
    if (rsi.isOversold)   std::cout << "  ⚠ OVERSOLD";
    std::cout << "\n";

    auto macd = analytics->calculateMACD(symbol);
    std::cout << std::setprecision(4);
    std::cout << "MACD line:             " << macd.macdLine   << "\n";
    std::cout << "MACD signal:           " << macd.signalLine << "\n";
    std::cout << "MACD histogram:        " << macd.histogram  << "\n";

    auto bb = analytics->calculateBollingerBands(symbol);
    std::cout << std::setprecision(2);
    std::cout << "Bollinger Upper:      $" << bb.upper     << "\n";
    std::cout << "Bollinger Middle:     $" << bb.middle    << "\n";
    std::cout << "Bollinger Lower:      $" << bb.lower     << "\n";
    std::cout << "Bollinger Bandwidth:   " << bb.bandwidth << "\n";

    std::cout << "==========================================\n";
}

void runMatchingEngineDemo() {
    std::cout << "\n========== Matching Engine Demo ==========\n";
    MatchingEngine engine;

    // Place resting orders
    engine.submitOrder(Order("B1", "DEMO", 100.00, 200, 1, true));
    engine.submitOrder(Order("B2", "DEMO",  99.50, 150, 2, true));
    engine.submitOrder(Order("A1", "DEMO", 101.00, 100, 3, false));
    engine.submitOrder(Order("A2", "DEMO", 102.00,  80, 4, false));

    std::cout << "Resting book: bid=" << engine.bestBid("DEMO")
              << "  ask=" << engine.bestAsk("DEMO") << "\n";

    // Aggressive sell crosses the best bid
    auto trades = engine.submitOrder(Order("A3", "DEMO", 99.00, 250, 5, false));
    std::cout << "Sell 250 @ 99.00 generated " << trades.size() << " trade(s):\n";
    for (auto& t : trades)
        std::cout << "  " << t.tradeId << "  qty=" << t.quantity
                  << "  price=" << t.price
                  << "  buy=" << t.buyOrderId << "  sell=" << t.sellOrderId << "\n";

    std::cout << "After match: bid=" << engine.bestBid("DEMO")
              << "  ask=" << engine.bestAsk("DEMO") << "\n";
    std::cout << "Total trades executed: " << engine.getTradeCount() << "\n";
    std::cout << "==========================================\n";
}

int main() {
    std::cout << "========================================\n";
    std::cout << "  Real-Time Market Data Stream Processor\n";
    std::cout << "  High-Performance Financial Data System\n";
    std::cout << "========================================\n\n";

    // ── Load config ───────────────────────────────────────────────────────────
    auto& cfg = Config::instance();
    bool cfgLoaded = cfg.loadFile("config.ini");

    // ── Configure logger ──────────────────────────────────────────────────────
    auto& logger = Logger::instance();
    logger.setLevel(cfg.getString("logging.level", "INFO"));
    if (cfg.getBool("logging.log_to_file", false)) {
        std::string logFile = cfg.getString("logging.log_file", "market_data.log");
        logger.openFile(logFile);
        std::cout << "Logging to file: " << logFile << "\n";
    }

    if (cfgLoaded) {
        LOG_INFO("Configuration loaded from config.ini");
    } else {
        LOG_WARN("config.ini not found — using built-in defaults");
    }

    // Setup signal handling
    signal(SIGINT, signalHandler);
    signal(SIGTERM, signalHandler);

    // ── Symbols ───────────────────────────────────────────────────────────────
    auto symbols = cfg.getList("processor.symbols");
    if (symbols.empty()) {
        symbols = {"AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "JPM", "BAC"};
        LOG_WARN("No symbols in config — using built-in defaults");
    }

    std::cout << "Tracking " << symbols.size() << " symbol(s): ";
    for (size_t i = 0; i < symbols.size(); ++i) {
        std::cout << symbols[i];
        if (i < symbols.size() - 1) std::cout << ", ";
    }
    std::cout << "\n\n";

    // ── Create and initialize stream processor ────────────────────────────────
    const int NUM_THREADS = cfg.getInt("processor.thread_count", 4);
    StreamProcessor processor(NUM_THREADS);
    g_processor = &processor;

    std::cout << "Initializing stream processor with " << NUM_THREADS << " thread(s)...\n";
    processor.initialize(symbols);

    // ── Price alerts from config ──────────────────────────────────────────────
    // Config stores keys in lowercase; symbols like "AAPL" become "aapl".
    auto analytics = processor.getAnalytics();
    int alertsAdded = 0;
    for (const auto& sym : symbols) {
        std::string symLc = sym;
        std::transform(symLc.begin(), symLc.end(), symLc.begin(), ::tolower);

        std::string aboveKey = "alerts." + symLc + "_above";
        std::string belowKey = "alerts." + symLc + "_below";

        if (cfg.has(aboveKey)) {
            double p = cfg.getDouble(aboveKey, 0.0);
            if (p > 0.0) {
                analytics->addAlert(PriceAlert(sym, p, true));
                std::cout << "  Alert: " << sym << " above $" << p << "\n";
                ++alertsAdded;
            }
        }
        if (cfg.has(belowKey)) {
            double p = cfg.getDouble(belowKey, 0.0);
            if (p > 0.0) {
                analytics->addAlert(PriceAlert(sym, p, false));
                std::cout << "  Alert: " << sym << " below $" << p << "\n";
                ++alertsAdded;
            }
        }
    }
    if (alertsAdded == 0) {
        analytics->addAlert(PriceAlert("AAPL", 200.0, true));
        analytics->addAlert(PriceAlert("TSLA", 150.0, false));
        std::cout << "  Alert: AAPL above $200 (default)\n";
        std::cout << "  Alert: TSLA below $150 (default)\n";
    }
    std::cout << "\n";

    // ── Start ─────────────────────────────────────────────────────────────────
    std::cout << "Starting real-time data processing...\n";
    std::cout << "Target: <100ms latency, >10,000 ticks/sec throughput\n\n";
    processor.start();

    const int DEMO_DURATION_SEC = cfg.getInt("processor.demo_duration_sec", 30);
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
    
    // Matching engine demo
    runMatchingEngineDemo();

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
