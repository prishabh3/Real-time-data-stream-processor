#include "OrderBook.h"
#include <algorithm>
#include <stdexcept>
#include <limits>

namespace MarketData {

OrderBook::OrderBook(const std::string& sym) : symbol(sym) {}

void OrderBook::addOrder(const Order& order) {
    std::lock_guard<std::mutex> lock(bookMutex);
    
    if (order.isBuy) {
        auto it = bids.find(order.price);
        if (it != bids.end()) {
            it->second.addOrder(order);
        } else {
            PriceLevel level(order.price);
            level.addOrder(order);
            bids[order.price] = level;
        }
    } else {
        auto it = asks.find(order.price);
        if (it != asks.end()) {
            it->second.addOrder(order);
        } else {
            PriceLevel level(order.price);
            level.addOrder(order);
            asks[order.price] = level;
        }
    }
}

void OrderBook::removeOrder(const std::string& orderId, bool isBuy) {
    std::lock_guard<std::mutex> lock(bookMutex);
    
    if (isBuy) {
        for (auto& [price, level] : bids) {
            level.removeOrder(orderId);
            if (level.orders.empty()) {
                bids.erase(price);
                break;
            }
        }
    } else {
        for (auto& [price, level] : asks) {
            level.removeOrder(orderId);
            if (level.orders.empty()) {
                asks.erase(price);
                break;
            }
        }
    }
}

void OrderBook::updateOrder(const std::string& orderId, int newQuantity, bool isBuy) {
    std::lock_guard<std::mutex> lock(bookMutex);
    
    if (isBuy) {
        for (auto& [price, level] : bids) {
            for (auto& order : level.orders) {
                if (order.orderId == orderId) {
                    level.totalQuantity -= order.quantity;
                    order.quantity = newQuantity;
                    level.totalQuantity += newQuantity;
                    return;
                }
            }
        }
    } else {
        for (auto& [price, level] : asks) {
            for (auto& order : level.orders) {
                if (order.orderId == orderId) {
                    level.totalQuantity -= order.quantity;
                    order.quantity = newQuantity;
                    level.totalQuantity += newQuantity;
                    return;
                }
            }
        }
    }
}

double OrderBook::getBestBid() const {
    std::lock_guard<std::mutex> lock(bookMutex);
    if (bids.empty()) return 0.0;
    return bids.begin()->first;
}

double OrderBook::getBestAsk() const {
    std::lock_guard<std::mutex> lock(bookMutex);
    if (asks.empty()) return 0.0;
    return asks.begin()->first;
}

double OrderBook::getSpread() const {
    std::lock_guard<std::mutex> lock(bookMutex);
    if (bids.empty() || asks.empty()) return 0.0;
    return asks.begin()->first - bids.begin()->first;
}

int OrderBook::getDepth(bool isBuy, int levels) const {
    std::lock_guard<std::mutex> lock(bookMutex);
    
    int depth = 0;
    int count = 0;
    
    if (isBuy) {
        for (const auto& [price, level] : bids) {
            depth += level.totalQuantity;
            if (++count >= levels) break;
        }
    } else {
        for (const auto& [price, level] : asks) {
            depth += level.totalQuantity;
            if (++count >= levels) break;
        }
    }
    
    return depth;
}

std::vector<std::pair<double, int>> OrderBook::getBidLevels(int count) const {
    std::lock_guard<std::mutex> lock(bookMutex);
    std::vector<std::pair<double, int>> levels;
    
    int i = 0;
    for (const auto& [price, level] : bids) {
        levels.push_back({price, level.totalQuantity});
        if (++i >= count) break;
    }
    
    return levels;
}

std::vector<std::pair<double, int>> OrderBook::getAskLevels(int count) const {
    std::lock_guard<std::mutex> lock(bookMutex);
    std::vector<std::pair<double, int>> levels;
    
    int i = 0;
    for (const auto& [price, level] : asks) {
        levels.push_back({price, level.totalQuantity});
        if (++i >= count) break;
    }
    
    return levels;
}

void OrderBook::clear() {
    std::lock_guard<std::mutex> lock(bookMutex);
    bids.clear();
    asks.clear();
}

} // namespace MarketData
