#ifndef ANALYTICS_H
#define ANALYTICS_H

#include <vector>
#include <deque>
#include <string>
#include <unordered_map>
#include <mutex>

namespace MarketData {

struct PriceAlert {
    std::string symbol;
    double targetPrice;
    bool isAbove; // true for alert when price goes above, false for below
    bool triggered;
    
    PriceAlert(const std::string& sym, double price, bool above)
        : symbol(sym), targetPrice(price), isAbove(above), triggered(false) {}
};

class CircularBuffer {
private:
    std::vector<double> buffer;
    size_t capacity;
    size_t head;
    size_t size;
    
public:
    CircularBuffer() : capacity(0), head(0), size(0) {}  // Default constructor
    CircularBuffer(size_t cap);
    
    void push(double value);
    double get(size_t index) const;
    size_t getSize() const { return size; }
    size_t getCapacity() const { return capacity; }
    std::vector<double> toVector() const;
};

class Analytics {
private:
    // Symbol -> Price History (Circular Buffer for efficiency)
    std::unordered_map<std::string, CircularBuffer> priceHistory;
    
    // Symbol -> Volume History
    std::unordered_map<std::string, CircularBuffer> volumeHistory;
    
    // Price alerts
    std::vector<PriceAlert> alerts;
    
    mutable std::mutex analyticsMutex;
    
    // Window sizes (in number of ticks)
    static const size_t SHORT_WINDOW = 20;
    static const size_t MEDIUM_WINDOW = 50;
    static const size_t LONG_WINDOW = 200;
    
public:
    Analytics();
    
    // Update with new tick data
    void updateTick(const std::string& symbol, double price, int volume);
    
    // Moving averages (SMA - Simple Moving Average)
    double calculateSMA(const std::string& symbol, size_t window) const;
    double getShortTermSMA(const std::string& symbol) const;
    double getMediumTermSMA(const std::string& symbol) const;
    double getLongTermSMA(const std::string& symbol) const;
    
    // Exponential Moving Average
    double calculateEMA(const std::string& symbol, size_t window, double alpha = 0.1) const;
    
    // Volatility indicators
    double calculateStandardDeviation(const std::string& symbol, size_t window) const;
    double calculateVolatility(const std::string& symbol) const;
    
    // Volume-weighted average price
    double calculateVWAP(const std::string& symbol, size_t window) const;
    
    // Price alerts
    void addAlert(const PriceAlert& alert);
    std::vector<PriceAlert> checkAlerts(const std::string& symbol, double currentPrice);
    void clearTriggeredAlerts();
    
    // Get price history
    std::vector<double> getPriceHistory(const std::string& symbol, size_t count) const;
    
    // Performance metrics
    double getChangePercent(const std::string& symbol, size_t lookback) const;
    double getHighLow(const std::string& symbol, size_t window, bool getHigh = true) const;
};

} // namespace MarketData

#endif // ANALYTICS_H
