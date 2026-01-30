#include "Analytics.h"
#include <cmath>
#include <algorithm>
#include <numeric>
#include <stdexcept>

namespace MarketData {

// CircularBuffer Implementation
CircularBuffer::CircularBuffer(size_t cap) 
    : capacity(cap), head(0), size(0) {
    buffer.resize(capacity);
}

void CircularBuffer::push(double value) {
    buffer[head] = value;
    head = (head + 1) % capacity;
    if (size < capacity) {
        size++;
    }
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

// Analytics Implementation
Analytics::Analytics() {}

void Analytics::updateTick(const std::string& symbol, double price, int volume) {
    std::lock_guard<std::mutex> lock(analyticsMutex);
    
    // Initialize buffers if they don't exist
    if (priceHistory.find(symbol) == priceHistory.end()) {
        priceHistory.emplace(symbol, CircularBuffer(LONG_WINDOW));
        volumeHistory.emplace(symbol, CircularBuffer(LONG_WINDOW));
    }
    
    priceHistory[symbol].push(price);
    volumeHistory[symbol].push(static_cast<double>(volume));
}

double Analytics::calculateSMA(const std::string& symbol, size_t window) const {
    std::lock_guard<std::mutex> lock(analyticsMutex);
    
    auto it = priceHistory.find(symbol);
    if (it == priceHistory.end()) {
        return 0.0;
    }
    
    const CircularBuffer& buffer = it->second;
    size_t count = std::min(window, buffer.getSize());
    
    if (count == 0) return 0.0;
    
    double sum = 0.0;
    for (size_t i = buffer.getSize() - count; i < buffer.getSize(); ++i) {
        sum += buffer.get(i);
    }
    
    return sum / count;
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
    if (it == priceHistory.end()) {
        return 0.0;
    }
    
    const CircularBuffer& buffer = it->second;
    size_t count = std::min(window, buffer.getSize());
    
    if (count < 2) return 0.0;
    
    // Calculate mean
    double sum = 0.0;
    for (size_t i = buffer.getSize() - count; i < buffer.getSize(); ++i) {
        sum += buffer.get(i);
    }
    double mean = sum / count;
    
    // Calculate variance
    double variance = 0.0;
    for (size_t i = buffer.getSize() - count; i < buffer.getSize(); ++i) {
        double diff = buffer.get(i) - mean;
        variance += diff * diff;
    }
    variance /= count;
    
    return std::sqrt(variance);
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

} // namespace MarketData
