#ifndef MARKETDATAFEED_H
#define MARKETDATAFEED_H

#include "LockFreeQueue.h"
#include <string>
#include <functional>
#include <atomic>
#include <thread>
#include <vector>
#include <mutex>
#include <condition_variable>
#include <chrono>

namespace MarketData {

struct TickData {
    std::string symbol;
    double price;
    int volume;
    long long timestamp;
    std::string source; // "ALPHA_VANTAGE", "YAHOO", "SIMULATED"

    TickData() : price(0), volume(0), timestamp(0) {}
    TickData(const std::string& sym, double p, int vol, long long ts, const std::string& src)
        : symbol(sym), price(p), volume(vol), timestamp(ts), source(src) {}
};

class MarketDataFeed {
private:
    std::atomic<bool> running;
    std::vector<std::thread> feedThreads;

    // Lock-free queue: no mutex on the hot push/pop path
    LockFreeQueue<TickData, 65536> dataQueue;

    // Lightweight notification so consumers can sleep instead of spin
    std::mutex notifyMutex;
    std::condition_variable notifyCV;

    std::function<void(const TickData&)> dataCallback;

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
    // Block until a tick arrives or timeout elapses (avoids busy-spin in consumers)
    void waitForData(std::chrono::microseconds timeout);
    size_t getQueueSize() const;

    void enableSimulatedFeed(bool enable = true);
    void enableAlphaVantage(const std::string& apiKey);
    void enableYahooFinance();
};

} // namespace MarketData

#endif // MARKETDATAFEED_H
