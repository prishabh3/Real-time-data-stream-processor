#ifndef ANALYTICS_H
#define ANALYTICS_H

#include <vector>
#include <deque>
#include <string>
#include <unordered_map>
#include <mutex>

namespace MarketData {

// ── Indicator result types ────────────────────────────────────────────────────

struct RSIResult {
    double value;       // 0–100
    bool isOverbought;  // value > 70
    bool isOversold;    // value < 30
};

struct MACDResult {
    double macdLine;    // EMA(12) − EMA(26)
    double signalLine;  // EMA(9) of macdLine
    double histogram;   // macdLine − signalLine
};

struct BollingerBands {
    double upper;
    double middle;      // SMA(period)
    double lower;
    double bandwidth;   // (upper − lower) / middle — measures relative volatility
};

// ─────────────────────────────────────────────────────────────────────────────

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
    double runningSum; // maintained incrementally for O(1) full-window sum

public:
    CircularBuffer() : capacity(0), head(0), size(0), runningSum(0.0) {}
    CircularBuffer(size_t cap);

    void push(double value);
    double get(size_t index) const;
    size_t getSize() const { return size; }
    size_t getCapacity() const { return capacity; }
    double getSum() const { return runningSum; }
    std::vector<double> toVector() const;
};

class Analytics {
private:
    std::unordered_map<std::string, CircularBuffer> priceHistory;
    std::unordered_map<std::string, CircularBuffer> volumeHistory;
    std::vector<PriceAlert> alerts;
    mutable std::mutex analyticsMutex;

    static const size_t SHORT_WINDOW  = 20;
    static const size_t MEDIUM_WINDOW = 50;
    static const size_t LONG_WINDOW   = 200;

    // Streaming EMA state for O(1) MACD (updated every tick)
    struct SymbolState {
        double ema12{0.0};
        double ema26{0.0};
        double signalLine{0.0};
        double macdLine{0.0};
        size_t tickCount{0};
    };
    std::unordered_map<std::string, SymbolState> symbolStates;

    // Private helpers — caller must hold analyticsMutex
    double computeSMA(const CircularBuffer& buf, size_t window) const;
    double computeStdDev(const CircularBuffer& buf, size_t window) const;

public:
    Analytics();

    void updateTick(const std::string& symbol, double price, int volume);

    // Moving averages
    double calculateSMA(const std::string& symbol, size_t window) const;
    double getShortTermSMA(const std::string& symbol) const;
    double getMediumTermSMA(const std::string& symbol) const;
    double getLongTermSMA(const std::string& symbol) const;

    // Exponential Moving Average
    double calculateEMA(const std::string& symbol, size_t window, double alpha = 0.1) const;

    // Volatility
    double calculateStandardDeviation(const std::string& symbol, size_t window) const;
    double calculateVolatility(const std::string& symbol) const;

    // Volume-weighted average price
    double calculateVWAP(const std::string& symbol, size_t window) const;

    // ── New indicators ────────────────────────────────────────────────────────
    RSIResult      calculateRSI(const std::string& symbol, size_t period = 14) const;
    MACDResult     calculateMACD(const std::string& symbol) const;
    BollingerBands calculateBollingerBands(const std::string& symbol, size_t period = 20) const;
    // ─────────────────────────────────────────────────────────────────────────

    // Price alerts
    void addAlert(const PriceAlert& alert);
    std::vector<PriceAlert> checkAlerts(const std::string& symbol, double currentPrice);
    void clearTriggeredAlerts();

    std::vector<double> getPriceHistory(const std::string& symbol, size_t count) const;
    double getChangePercent(const std::string& symbol, size_t lookback) const;
    double getHighLow(const std::string& symbol, size_t window, bool getHigh = true) const;
};

} // namespace MarketData

#endif // ANALYTICS_H
