#include "StreamProcessor.h"
#include "Logger.h"
#include <iostream>
#include <iomanip>

namespace MarketData {

StreamProcessor::StreamProcessor(int threadCount)
    : running(false), numProcessingThreads(threadCount), nextOrderId(0) {
    analytics = std::make_shared<Analytics>();
}

StreamProcessor::~StreamProcessor() {
    stop();
}

void StreamProcessor::initialize(const std::vector<std::string>& symbols) {
    // Create order books for each symbol
    for (const auto& symbol : symbols) {
        orderBooks[symbol] = std::make_shared<OrderBook>(symbol);
    }
    
    // Initialize market data feed
    dataFeed = std::make_shared<MarketDataFeed>(symbols, 10); // 10ms update frequency
    
    // Reset metrics
    resetMetrics();
    metrics.startTime = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
}

void StreamProcessor::start() {
    if (running.load()) return;
    
    running.store(true);
    
    // Start market data feed
    dataFeed->start();
    
    // Start processing threads
    for (int i = 0; i < numProcessingThreads; ++i) {
        processingThreads.emplace_back(&StreamProcessor::processingLoop, this);
    }
    
    LOG_INFO("StreamProcessor started with " << numProcessingThreads << " processing thread(s)");
}

void StreamProcessor::stop() {
    if (!running.load()) return;
    
    running.store(false);
    
    // Stop data feed
    if (dataFeed) {
        dataFeed->stop();
    }
    
    // Wait for processing threads to finish
    for (auto& thread : processingThreads) {
        if (thread.joinable()) {
            thread.join();
        }
    }
    processingThreads.clear();
    
    LOG_INFO("StreamProcessor stopped");
}

void StreamProcessor::processingLoop() {
    while (running.load(std::memory_order_relaxed)) {
        TickData tick;

        if (dataFeed->getNextTick(tick)) {
            auto startTime = std::chrono::high_resolution_clock::now();

            processTick(tick);

            auto endTime = std::chrono::high_resolution_clock::now();
            long long latencyNs = std::chrono::duration_cast<std::chrono::nanoseconds>(
                endTime - startTime
            ).count();

            updateMetrics(latencyNs);
        } else {
            // Block on CV until new data arrives or 500µs elapses
            dataFeed->waitForData(std::chrono::microseconds(500));
        }
    }
}

void StreamProcessor::processTick(const TickData& tick) {
    // Update analytics
    analytics->updateTick(tick.symbol, tick.price, tick.volume);
    
    // Check for price alerts
    auto triggeredAlerts = analytics->checkAlerts(tick.symbol, tick.price);
    for (const auto& alert : triggeredAlerts) {
        LOG_WARN("PRICE ALERT: " << alert.symbol
                 << " is " << (alert.isAbove ? "above" : "below")
                 << " target " << alert.targetPrice
                 << "  (current: " << tick.price << ")");
    }
    
    // Update order book (simulate market orders based on tick)
    // In a real system, this would come from actual order data
    auto orderBook = orderBooks[tick.symbol];
    if (orderBook) {
        // For simulation: add some bid/ask orders around current price
        int bidId = nextOrderId.fetch_add(1);
        int askId = nextOrderId.fetch_add(1);

        Order bid("BID_" + std::to_string(bidId), tick.symbol,
                  tick.price * 0.999, tick.volume / 2, tick.timestamp, true);
        orderBook->addOrder(bid);

        Order ask("ASK_" + std::to_string(askId), tick.symbol,
                  tick.price * 1.001, tick.volume / 2, tick.timestamp, false);
        orderBook->addOrder(ask);
    }
}

void StreamProcessor::updateMetrics(long long latencyNs) {
    std::lock_guard<std::mutex> lock(metricsMutex);
    
    double latencyMs = latencyNs / 1000000.0;
    
    // Update average latency (moving average)
    metrics.averageLatencyMs = (metrics.averageLatencyMs * metrics.totalTicksProcessed + latencyMs) 
                                / (metrics.totalTicksProcessed + 1);
    
    // Update peak latency
    if (latencyMs > metrics.peakLatencyMs) {
        metrics.peakLatencyMs = latencyMs;
    }
    
    metrics.totalTicksProcessed++;
    
    // Calculate throughput
    long long currentTime = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
    
    long long elapsedMs = currentTime - metrics.startTime;
    if (elapsedMs > 0) {
        metrics.throughputPerSecond = (metrics.totalTicksProcessed * 1000.0) / elapsedMs;
    }
}

std::shared_ptr<OrderBook> StreamProcessor::getOrderBook(const std::string& symbol) {
    auto it = orderBooks.find(symbol);
    if (it != orderBooks.end()) {
        return it->second;
    }
    return nullptr;
}

std::shared_ptr<Analytics> StreamProcessor::getAnalytics() {
    return analytics;
}

PerformanceMetrics StreamProcessor::getMetrics() const {
    std::lock_guard<std::mutex> lock(metricsMutex);
    return metrics;
}

void StreamProcessor::printMetrics() const {
    auto m = getMetrics();
    
    std::cout << "\n========== Performance Metrics ==========\n";
    std::cout << std::fixed << std::setprecision(2);
    std::cout << "Total Ticks Processed: " << m.totalTicksProcessed << "\n";
    std::cout << "Average Latency: " << m.averageLatencyMs << " ms\n";
    std::cout << "Peak Latency: " << m.peakLatencyMs << " ms\n";
    std::cout << "Throughput: " << m.throughputPerSecond << " ticks/sec\n";
    std::cout << "=========================================\n\n";
}

void StreamProcessor::resetMetrics() {
    std::lock_guard<std::mutex> lock(metricsMutex);
    metrics = PerformanceMetrics();
}

void StreamProcessor::addDataSource(const std::string& source, const std::string& apiKey) {
    if (source == "ALPHA_VANTAGE") {
        dataFeed->enableAlphaVantage(apiKey);
    } else if (source == "YAHOO") {
        dataFeed->enableYahooFinance();
    }
}

void StreamProcessor::submitOrder(const Order& order) {
    auto orderBook = getOrderBook(order.symbol);
    if (orderBook) {
        orderBook->addOrder(order);
    }
}

void StreamProcessor::cancelOrder(const std::string& orderId, const std::string& symbol, bool isBuy) {
    auto orderBook = getOrderBook(symbol);
    if (orderBook) {
        orderBook->removeOrder(orderId, isBuy);
    }
}

} // namespace MarketData
