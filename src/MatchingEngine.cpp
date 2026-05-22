#include "MatchingEngine.h"
#include "Logger.h"
#include <algorithm>

namespace MarketData {

// ── Internal matching helpers ─────────────────────────────────────────────────

std::vector<Trade> MatchingEngine::matchBuy(Order order) {
    std::vector<Trade> trades;
    auto& askBook = askBooks[order.symbol];

    while (order.quantity > 0 && !askBook.empty()) {
        auto it = askBook.begin(); // lowest ask
        if (it->first > order.price) break; // no price cross

        auto& queue = it->second;
        while (order.quantity > 0 && !queue.empty()) {
            Order& resting = queue.front();
            int fillQty = std::min(order.quantity, resting.quantity);

            trades.emplace_back(
                "T_" + std::to_string(tradeCounter.fetch_add(1)),
                order.symbol, it->first, fillQty, now(),
                order.orderId, resting.orderId
            );

            order.quantity   -= fillQty;
            resting.quantity -= fillQty;
            if (resting.quantity == 0) queue.pop_front();
        }
        if (queue.empty()) askBook.erase(it);
    }

    if (order.quantity > 0)
        bidBooks[order.symbol][order.price].push_back(order);

    return trades;
}

std::vector<Trade> MatchingEngine::matchSell(Order order) {
    std::vector<Trade> trades;
    auto& bidBook = bidBooks[order.symbol];

    while (order.quantity > 0 && !bidBook.empty()) {
        auto it = bidBook.begin(); // highest bid
        if (it->first < order.price) break; // no price cross

        auto& queue = it->second;
        while (order.quantity > 0 && !queue.empty()) {
            Order& resting = queue.front();
            int fillQty = std::min(order.quantity, resting.quantity);

            trades.emplace_back(
                "T_" + std::to_string(tradeCounter.fetch_add(1)),
                order.symbol, it->first, fillQty, now(),
                resting.orderId, order.orderId
            );

            order.quantity   -= fillQty;
            resting.quantity -= fillQty;
            if (resting.quantity == 0) queue.pop_front();
        }
        if (queue.empty()) bidBook.erase(it);
    }

    if (order.quantity > 0)
        askBooks[order.symbol][order.price].push_back(order);

    return trades;
}

// ── Public API ────────────────────────────────────────────────────────────────

std::vector<Trade> MatchingEngine::submitOrder(Order order) {
    if (order.orderId.empty() || order.symbol.empty()) {
        LOG_WARN("MatchingEngine: rejected order with empty ID or symbol");
        return {};
    }
    if (order.price <= 0.0) {
        LOG_WARN("MatchingEngine: rejected order " << order.orderId
                 << " — invalid price " << order.price);
        return {};
    }
    if (order.quantity <= 0) {
        LOG_WARN("MatchingEngine: rejected order " << order.orderId
                 << " — invalid quantity " << order.quantity);
        return {};
    }

    std::lock_guard<std::mutex> lock(engineMutex);

    auto trades = order.isBuy ? matchBuy(order) : matchSell(order);

    if (!trades.empty()) {
        LOG_DEBUG("MatchingEngine[" << order.symbol << "]: "
                  << trades.size() << " trade(s) from order " << order.orderId);
        tradeHistory.insert(tradeHistory.end(), trades.begin(), trades.end());
    }

    return trades;
}

bool MatchingEngine::cancelOrder(const std::string& orderId,
                                  const std::string& symbol, bool isBuy) {
    std::lock_guard<std::mutex> lock(engineMutex);

    auto erase = [&](auto& book) -> bool {
        auto symIt = book.find(symbol);
        if (symIt == book.end()) return false;
        for (auto& [price, queue] : symIt->second) {
            for (auto it = queue.begin(); it != queue.end(); ++it) {
                if (it->orderId == orderId) {
                    queue.erase(it);
                    if (queue.empty()) symIt->second.erase(price);
                    return true;
                }
            }
        }
        return false;
    };

    return isBuy ? erase(bidBooks) : erase(askBooks);
}

double MatchingEngine::bestBid(const std::string& symbol) const {
    std::lock_guard<std::mutex> lock(engineMutex);
    auto it = bidBooks.find(symbol);
    if (it == bidBooks.end() || it->second.empty()) return 0.0;
    return it->second.begin()->first;
}

double MatchingEngine::bestAsk(const std::string& symbol) const {
    std::lock_guard<std::mutex> lock(engineMutex);
    auto it = askBooks.find(symbol);
    if (it == askBooks.end() || it->second.empty()) return 0.0;
    return it->second.begin()->first;
}

std::vector<Trade> MatchingEngine::getRecentTrades(size_t count) const {
    std::lock_guard<std::mutex> lock(engineMutex);
    size_t n = std::min(count, tradeHistory.size());
    return {tradeHistory.end() - static_cast<long>(n), tradeHistory.end()};
}

size_t MatchingEngine::getTradeCount() const {
    std::lock_guard<std::mutex> lock(engineMutex);
    return tradeHistory.size();
}

} // namespace MarketData
