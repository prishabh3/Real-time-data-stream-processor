#include "OrderBook.h"
#include "Logger.h"
#include <algorithm>
#include <stdexcept>
#include <limits>

namespace MarketData {

OrderBook::OrderBook(const std::string& sym) : symbol(sym) {}

void OrderBook::addOrder(const Order& order) {
    if (order.orderId.empty()) {
        LOG_WARN("OrderBook[" << symbol << "]: rejected order with empty ID");
        return;
    }
    if (order.price <= 0.0) {
        LOG_WARN("OrderBook[" << symbol << "]: rejected order " << order.orderId
                 << " — invalid price " << order.price);
        return;
    }
    if (order.quantity <= 0) {
        LOG_WARN("OrderBook[" << symbol << "]: rejected order " << order.orderId
                 << " — invalid quantity " << order.quantity);
        return;
    }

    std::lock_guard<std::mutex> lock(bookMutex);

    if (orderIndex.count(order.orderId)) {
        LOG_WARN("OrderBook[" << symbol << "]: duplicate order ID " << order.orderId
                 << " — ignoring");
        return;
    }

    orderIndex[order.orderId] = order.price;

    if (order.isBuy) {
        bids[order.price].addOrder(order);
    } else {
        asks[order.price].addOrder(order);
    }

    LOG_DEBUG("OrderBook[" << symbol << "]: added "
              << (order.isBuy ? "BID" : "ASK")
              << " " << order.orderId
              << " qty=" << order.quantity << " @ " << order.price);
}

void OrderBook::removeOrder(const std::string& orderId, bool isBuy) {
    std::lock_guard<std::mutex> lock(bookMutex);

    auto idxIt = orderIndex.find(orderId);
    if (idxIt == orderIndex.end()) return;
    double price = idxIt->second;
    orderIndex.erase(idxIt);

    if (isBuy) {
        auto levelIt = bids.find(price);
        if (levelIt != bids.end()) {
            levelIt->second.removeOrder(orderId);
            if (levelIt->second.orders.empty()) bids.erase(levelIt);
        }
    } else {
        auto levelIt = asks.find(price);
        if (levelIt != asks.end()) {
            levelIt->second.removeOrder(orderId);
            if (levelIt->second.orders.empty()) asks.erase(levelIt);
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
    orderIndex.clear();
}

} // namespace MarketData
