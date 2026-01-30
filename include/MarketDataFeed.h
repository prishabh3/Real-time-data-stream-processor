#ifndef MARKETDATAFEED_H
#define MARKETDATAFEED_H

#include <string>
#include <functional>
#include <atomic>
#include <thread>
#include <vector>
#include <queue>
#include <mutex>
#include <condition_variable>

namespace MarketData {

struct TickData {
    std::string symbol;
    double price;
    int volume;
    long long timestamp;
    std::string source; // "ALPHA_VANTAGE", "YAHOO", "SIMULATED"
    
    TickData(const std::string& sym, double p, int vol, long long ts, const std::string& src)
        : symbol(sym), price(p), volume(vol), timestamp(ts), source(src) {}
};

class MarketDataFeed {
private:
    std::atomic<bool> running;
    std::vector<std::thread> feedThreads;
    std::queue<TickData> dataQueue;
    mutable std::mutex queueMutex;
    std::condition_variable queueCV;
    
    std::function<void(const TickData&)> dataCallback;
    
    // Feed simulation parameters
    std::vector<std::string> symbols;
    int updateFrequencyMs;
    
    void simulateFeed();
    void alphaVantageFeed();
    void yahooFinanceFeed();
    
public:
    MarketDataFeed(const std::vector<std::string>& syms, int freqMs = 10);
    ~MarketDataFeed();
    
    void start();
    void stop();
    void setCallback(std::function<void(const TickData&)> callback);
    
    bool getNextTick(TickData& tick);
    size_t getQueueSize() const;
    
    void enableSimulatedFeed(bool enable = true);
    void enableAlphaVantage(const std::string& apiKey);
    void enableYahooFinance();
};

} // namespace MarketData

#endif // MARKETDATAFEED_H
