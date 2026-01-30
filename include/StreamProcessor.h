#ifndef STREAMPROCESSOR_H
#define STREAMPROCESSOR_H

#include "OrderBook.h"
#include "MarketDataFeed.h"
#include "Analytics.h"
#include <unordered_map>
#include <memory>
#include <thread>
#include <atomic>
#include <chrono>

namespace MarketData {

struct PerformanceMetrics {
    long long totalTicksProcessed;
    double averageLatencyMs;
    double peakLatencyMs;
    double throughputPerSecond;
    long long startTime;
    
    PerformanceMetrics()
        : totalTicksProcessed(0), averageLatencyMs(0), peakLatencyMs(0),
          throughputPerSecond(0), startTime(0) {}
};

class StreamProcessor {
private:
    // Order books for each symbol
    std::unordered_map<std::string, std::shared_ptr<OrderBook>> orderBooks;
    
    // Analytics engine
    std::shared_ptr<Analytics> analytics;
    
    // Market data feed
    std::shared_ptr<MarketDataFeed> dataFeed;
    
    // Processing threads
    std::vector<std::thread> processingThreads;
    std::atomic<bool> running;
    
    // Performance tracking
    PerformanceMetrics metrics;
    mutable std::mutex metricsMutex;
    
    // Lock-free design consideration: Thread count
    int numProcessingThreads;
    
    void processingLoop();
    void processTick(const TickData& tick);
    void updateMetrics(long long latencyNs);
    
public:
    StreamProcessor(int threadCount = 4);
    ~StreamProcessor();
    
    void initialize(const std::vector<std::string>& symbols);
    void start();
    void stop();
    
    std::shared_ptr<OrderBook> getOrderBook(const std::string& symbol);
    std::shared_ptr<Analytics> getAnalytics();
    
    PerformanceMetrics getMetrics() const;
    void printMetrics() const;
    void resetMetrics();
    
    // Add market data source
    void addDataSource(const std::string& source, const std::string& apiKey = "");
    
    // Order management (for testing/simulation)
    void submitOrder(const Order& order);
    void cancelOrder(const std::string& orderId, const std::string& symbol, bool isBuy);
};

} // namespace MarketData

#endif // STREAMPROCESSOR_H
