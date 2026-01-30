#include "MarketDataFeed.h"
#include <random>
#include <chrono>
#include <iostream>

namespace MarketData {

MarketDataFeed::MarketDataFeed(const std::vector<std::string>& syms, int freqMs)
    : running(false), symbols(syms), updateFrequencyMs(freqMs) {}

MarketDataFeed::~MarketDataFeed() {
    stop();
}

void MarketDataFeed::start() {
    if (running.load()) return;
    
    running.store(true);
    
    // Start simulated feed by default
    feedThreads.emplace_back(&MarketDataFeed::simulateFeed, this);
}

void MarketDataFeed::stop() {
    if (!running.load()) return;
    
    running.store(false);
    queueCV.notify_all();
    
    for (auto& thread : feedThreads) {
        if (thread.joinable()) {
            thread.join();
        }
    }
    feedThreads.clear();
}

void MarketDataFeed::setCallback(std::function<void(const TickData&)> callback) {
    dataCallback = callback;
}

bool MarketDataFeed::getNextTick(TickData& tick) {
    std::unique_lock<std::mutex> lock(queueMutex);
    
    if (dataQueue.empty()) {
        return false;
    }
    
    tick = dataQueue.front();
    dataQueue.pop();
    return true;
}

size_t MarketDataFeed::getQueueSize() const {
    std::lock_guard<std::mutex> lock(queueMutex);
    return dataQueue.size();
}

void MarketDataFeed::simulateFeed() {
    std::random_device rd;
    std::mt19937 gen(rd());
    
    // Initial prices for symbols
    std::unordered_map<std::string, double> currentPrices;
    for (const auto& symbol : symbols) {
        std::uniform_real_distribution<> priceDist(50.0, 500.0);
        currentPrices[symbol] = priceDist(gen);
    }
    
    while (running.load()) {
        for (const auto& symbol : symbols) {
            // Simulate price movement (realistic random walk)
            std::normal_distribution<> priceChange(0.0, 0.5);
            double change = priceChange(gen);
            currentPrices[symbol] += change;
            
            // Keep price positive
            if (currentPrices[symbol] < 1.0) {
                currentPrices[symbol] = 1.0;
            }
            
            // Random volume
            std::uniform_int_distribution<> volumeDist(100, 10000);
            int volume = volumeDist(gen);
            
            // Create tick
            long long timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::system_clock::now().time_since_epoch()
            ).count();
            
            TickData tick(symbol, currentPrices[symbol], volume, timestamp, "SIMULATED");
            
            {
                std::lock_guard<std::mutex> lock(queueMutex);
                dataQueue.push(tick);
            }
            queueCV.notify_one();
            
            // Call callback if set
            if (dataCallback) {
                dataCallback(tick);
            }
        }
        
        // Sleep for update frequency
        std::this_thread::sleep_for(std::chrono::milliseconds(updateFrequencyMs));
    }
}

void MarketDataFeed::alphaVantageFeed() {
    // TODO: Implement Alpha Vantage API integration
    // This would use HTTP requests to fetch real-time data
    // Placeholder for now
}

void MarketDataFeed::yahooFinanceFeed() {
    // TODO: Implement Yahoo Finance API integration
    // This would use HTTP requests to fetch real-time data
    // Placeholder for now
}

void MarketDataFeed::enableSimulatedFeed(bool enable) {
    // Implementation for toggling simulated feed
}

void MarketDataFeed::enableAlphaVantage(const std::string& apiKey) {
    // Start Alpha Vantage feed thread
    // feedThreads.emplace_back(&MarketDataFeed::alphaVantageFeed, this);
}

void MarketDataFeed::enableYahooFinance() {
    // Start Yahoo Finance feed thread
    // feedThreads.emplace_back(&MarketDataFeed::yahooFinanceFeed, this);
}

} // namespace MarketData
