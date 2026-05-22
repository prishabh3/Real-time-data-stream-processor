#include "Analytics.h"
#include "Logger.h"
#include <cmath>
#include <algorithm>
#include <numeric>
#include <stdexcept>

namespace MarketData {

// CircularBuffer Implementation
CircularBuffer::CircularBuffer(size_t cap)
    : capacity(cap), head(0), size(0), runningSum(0.0) {
    buffer.resize(capacity);
}

void CircularBuffer::push(double value) {
    if (size == capacity) {
        runningSum -= buffer[head]; // evict oldest value from sum
    } else {
        size++;
    }
    runningSum += value;
    buffer[head] = value;
    head = (head + 1) % capacity;
}

double CircularBuffer::get(size_t index) const {
    if (index >= size) {
        throw std::out_of_range("Index out of range");
    }
    
    size_t actualIndex = (head + capacity - size + index) % capacity;
    return buffer[actualIndex];
}

std::vector<double> CircularBuffer::toVector() const {
    std::vector<double> result;
    result.reserve(size);
    
    for (size_t i = 0; i < size; ++i) {
        result.push_back(get(i));
    }
    
    return result;
}

// ── Private helpers (caller holds analyticsMutex) ────────────────────────────

double Analytics::computeSMA(const CircularBuffer& buf, size_t window) const {
    size_t count = std::min(window, buf.getSize());
    if (count == 0) return 0.0;
    if (count == buf.getSize()) return buf.getSum() / static_cast<double>(count);
    double sum = 0.0;
    for (size_t i = buf.getSize() - count; i < buf.getSize(); ++i)
        sum += buf.get(i);
    return sum / static_cast<double>(count);
}

double Analytics::computeStdDev(const CircularBuffer& buf, size_t window) const {
    size_t count = std::min(window, buf.getSize());
    if (count < 2) return 0.0;
    double mean = computeSMA(buf, window);
    double variance = 0.0;
    for (size_t i = buf.getSize() - count; i < buf.getSize(); ++i) {
        double d = buf.get(i) - mean;
        variance += d * d;
    }
    return std::sqrt(variance / static_cast<double>(count));
}

// ── Analytics Implementation ──────────────────────────────────────────────────

Analytics::Analytics() {}

void Analytics::updateTick(const std::string& symbol, double price, int volume) {
    if (symbol.empty()) {
        LOG_WARN("Analytics::updateTick: empty symbol — ignoring");
        return;
    }
    if (price <= 0.0) {
        LOG_WARN("Analytics::updateTick[" << symbol << "]: invalid price "
                 << price << " — ignoring");
        return;
    }
    if (volume < 0) {
        LOG_WARN("Analytics::updateTick[" << symbol << "]: negative volume "
                 << volume << " — clamping to 0");
        volume = 0;
    }

    std::lock_guard<std::mutex> lock(analyticsMutex);

    if (priceHistory.find(symbol) == priceHistory.end()) {
        priceHistory.emplace(symbol, CircularBuffer(LONG_WINDOW));
        volumeHistory.emplace(symbol, CircularBuffer(LONG_WINDOW));
    }

    priceHistory[symbol].push(price);
    volumeHistory[symbol].push(static_cast<double>(volume));

    // Update streaming EMA state for MACD (Wilder / standard EMA multipliers)
    constexpr double alpha12     = 2.0 / 13.0;
    constexpr double alpha26     = 2.0 / 27.0;
    constexpr double alphaSignal = 2.0 / 10.0;

    auto& s = symbolStates[symbol];
    s.tickCount++;

    if (s.tickCount == 1) {
        s.ema12 = s.ema26 = price; // seed both EMAs on first tick
    } else {
        s.ema12 = alpha12 * price + (1.0 - alpha12) * s.ema12;
        s.ema26 = alpha26 * price + (1.0 - alpha26) * s.ema26;
        s.macdLine   = s.ema12 - s.ema26;
        s.signalLine = alphaSignal * s.macdLine + (1.0 - alphaSignal) * s.signalLine;
    }
}

double Analytics::calculateSMA(const std::string& symbol, size_t window) const {
    std::lock_guard<std::mutex> lock(analyticsMutex);
    auto it = priceHistory.find(symbol);
    if (it == priceHistory.end()) return 0.0;
    return computeSMA(it->second, window);
}

double Analytics::getShortTermSMA(const std::string& symbol) const {
    return calculateSMA(symbol, SHORT_WINDOW);
}

double Analytics::getMediumTermSMA(const std::string& symbol) const {
    return calculateSMA(symbol, MEDIUM_WINDOW);
}

double Analytics::getLongTermSMA(const std::string& symbol) const {
    return calculateSMA(symbol, LONG_WINDOW);
}

double Analytics::calculateEMA(const std::string& symbol, size_t window, double alpha) const {
    std::lock_guard<std::mutex> lock(analyticsMutex);
    
    auto it = priceHistory.find(symbol);
    if (it == priceHistory.end() || it->second.getSize() == 0) {
        return 0.0;
    }
    
    const CircularBuffer& buffer = it->second;
    size_t count = std::min(window, buffer.getSize());
    
    if (count == 0) return 0.0;
    
    double ema = buffer.get(buffer.getSize() - count);
    
    for (size_t i = buffer.getSize() - count + 1; i < buffer.getSize(); ++i) {
        ema = alpha * buffer.get(i) + (1 - alpha) * ema;
    }
    
    return ema;
}

double Analytics::calculateStandardDeviation(const std::string& symbol, size_t window) const {
    std::lock_guard<std::mutex> lock(analyticsMutex);
    auto it = priceHistory.find(symbol);
    if (it == priceHistory.end()) return 0.0;
    return computeStdDev(it->second, window);
}

double Analytics::calculateVolatility(const std::string& symbol) const {
    return calculateStandardDeviation(symbol, MEDIUM_WINDOW);
}

double Analytics::calculateVWAP(const std::string& symbol, size_t window) const {
    std::lock_guard<std::mutex> lock(analyticsMutex);
    
    auto priceIt = priceHistory.find(symbol);
    auto volumeIt = volumeHistory.find(symbol);
    
    if (priceIt == priceHistory.end() || volumeIt == volumeHistory.end()) {
        return 0.0;
    }
    
    const CircularBuffer& priceBuffer = priceIt->second;
    const CircularBuffer& volumeBuffer = volumeIt->second;
    
    size_t count = std::min(window, priceBuffer.getSize());
    if (count == 0) return 0.0;
    
    double sumPriceVolume = 0.0;
    double sumVolume = 0.0;
    
    for (size_t i = priceBuffer.getSize() - count; i < priceBuffer.getSize(); ++i) {
        double price = priceBuffer.get(i);
        double volume = volumeBuffer.get(i);
        sumPriceVolume += price * volume;
        sumVolume += volume;
    }
    
    return sumVolume > 0 ? sumPriceVolume / sumVolume : 0.0;
}

void Analytics::addAlert(const PriceAlert& alert) {
    std::lock_guard<std::mutex> lock(analyticsMutex);
    alerts.push_back(alert);
}

std::vector<PriceAlert> Analytics::checkAlerts(const std::string& symbol, double currentPrice) {
    std::lock_guard<std::mutex> lock(analyticsMutex);
    
    std::vector<PriceAlert> triggered;
    
    for (auto& alert : alerts) {
        if (alert.symbol == symbol && !alert.triggered) {
            bool shouldTrigger = false;
            
            if (alert.isAbove && currentPrice >= alert.targetPrice) {
                shouldTrigger = true;
            } else if (!alert.isAbove && currentPrice <= alert.targetPrice) {
                shouldTrigger = true;
            }
            
            if (shouldTrigger) {
                alert.triggered = true;
                triggered.push_back(alert);
            }
        }
    }
    
    return triggered;
}

void Analytics::clearTriggeredAlerts() {
    std::lock_guard<std::mutex> lock(analyticsMutex);
    
    alerts.erase(
        std::remove_if(alerts.begin(), alerts.end(),
                      [](const PriceAlert& alert) { return alert.triggered; }),
        alerts.end()
    );
}

std::vector<double> Analytics::getPriceHistory(const std::string& symbol, size_t count) const {
    std::lock_guard<std::mutex> lock(analyticsMutex);
    
    auto it = priceHistory.find(symbol);
    if (it == priceHistory.end()) {
        return {};
    }
    
    const CircularBuffer& buffer = it->second;
    size_t actualCount = std::min(count, buffer.getSize());
    
    std::vector<double> history;
    history.reserve(actualCount);
    
    for (size_t i = buffer.getSize() - actualCount; i < buffer.getSize(); ++i) {
        history.push_back(buffer.get(i));
    }
    
    return history;
}

double Analytics::getChangePercent(const std::string& symbol, size_t lookback) const {
    std::lock_guard<std::mutex> lock(analyticsMutex);
    
    auto it = priceHistory.find(symbol);
    if (it == priceHistory.end() || it->second.getSize() < lookback + 1) {
        return 0.0;
    }
    
    const CircularBuffer& buffer = it->second;
    double oldPrice = buffer.get(buffer.getSize() - lookback - 1);
    double currentPrice = buffer.get(buffer.getSize() - 1);
    
    if (oldPrice == 0.0) return 0.0;
    return ((currentPrice - oldPrice) / oldPrice) * 100.0;
}

double Analytics::getHighLow(const std::string& symbol, size_t window, bool getHigh) const {
    std::lock_guard<std::mutex> lock(analyticsMutex);
    
    auto it = priceHistory.find(symbol);
    if (it == priceHistory.end()) {
        return 0.0;
    }
    
    const CircularBuffer& buffer = it->second;
    size_t count = std::min(window, buffer.getSize());
    
    if (count == 0) return 0.0;
    
    double result = buffer.get(buffer.getSize() - count);
    
    for (size_t i = buffer.getSize() - count + 1; i < buffer.getSize(); ++i) {
        double price = buffer.get(i);
        if (getHigh) {
            result = std::max(result, price);
        } else {
            result = std::min(result, price);
        }
    }
    
    return result;
}

// ── RSI (Relative Strength Index) ────────────────────────────────────────────
// Uses Wilder's smoothed averages over the available price history.
RSIResult Analytics::calculateRSI(const std::string& symbol, size_t period) const {
    std::lock_guard<std::mutex> lock(analyticsMutex);

    auto it = priceHistory.find(symbol);
    if (it == priceHistory.end() || it->second.getSize() < period + 1)
        return {50.0, false, false}; // neutral when insufficient data

    const CircularBuffer& buf = it->second;
    size_t n = buf.getSize();

    // Seed: simple average of the first 'period' price changes
    double avgGain = 0.0, avgLoss = 0.0;
    size_t warmupStart = (n > period * 3) ? n - period * 3 : 0;
    size_t warmupEnd   = warmupStart + period;
    if (warmupEnd > n - 1) warmupEnd = n - 1;

    for (size_t i = warmupStart; i < warmupEnd; ++i) {
        double diff = buf.get(i + 1) - buf.get(i);
        if (diff > 0) avgGain += diff;
        else          avgLoss -= diff;
    }
    size_t warmupLen = warmupEnd - warmupStart;
    if (warmupLen > 0) { avgGain /= warmupLen; avgLoss /= warmupLen; }

    // Wilder smoothing for remaining ticks
    for (size_t i = warmupEnd; i < n - 1; ++i) {
        double diff = buf.get(i + 1) - buf.get(i);
        double gain = diff > 0 ?  diff : 0.0;
        double loss = diff < 0 ? -diff : 0.0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    double value = (avgLoss < 1e-10) ? 100.0
                                     : 100.0 - (100.0 / (1.0 + avgGain / avgLoss));
    return {value, value > 70.0, value < 30.0};
}

// ── MACD ─────────────────────────────────────────────────────────────────────
// Uses the streaming EMA state maintained in updateTick — all O(1).
MACDResult Analytics::calculateMACD(const std::string& symbol) const {
    std::lock_guard<std::mutex> lock(analyticsMutex);

    auto it = symbolStates.find(symbol);
    if (it == symbolStates.end() || it->second.tickCount < 2)
        return {0.0, 0.0, 0.0};

    const SymbolState& s = it->second;
    return {s.macdLine, s.signalLine, s.macdLine - s.signalLine};
}

// ── Bollinger Bands ───────────────────────────────────────────────────────────
BollingerBands Analytics::calculateBollingerBands(const std::string& symbol,
                                                   size_t period) const {
    std::lock_guard<std::mutex> lock(analyticsMutex);

    auto it = priceHistory.find(symbol);
    if (it == priceHistory.end() || it->second.getSize() < 2)
        return {0.0, 0.0, 0.0, 0.0};

    const CircularBuffer& buf = it->second;
    double middle = computeSMA(buf, period);
    double stddev = computeStdDev(buf, period);

    double upper = middle + 2.0 * stddev;
    double lower = middle - 2.0 * stddev;
    double bw    = (middle > 0.0) ? (upper - lower) / middle : 0.0;
    return {upper, middle, lower, bw};
}

} // namespace MarketData
