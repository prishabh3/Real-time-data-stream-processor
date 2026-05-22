#ifndef MATCHINGENGINE_H
#define MATCHINGENGINE_H

#include "OrderBook.h"
#include <map>
#include <deque>
#include <vector>
#include <string>
#include <atomic>
#include <mutex>
#include <chrono>
#include <unordered_map>

namespace MarketData {

struct Trade {
    std::string tradeId;
    std::string symbol;
    double      price;
    int         quantity;
    long long   timestamp;
    std::string buyOrderId;
    std::string sellOrderId;

    Trade(const std::string& id, const std::string& sym, double p, int qty,
          long long ts, const std::string& bid, const std::string& sid)
        : tradeId(id), symbol(sym), price(p), quantity(qty),
          timestamp(ts), buyOrderId(bid), sellOrderId(sid) {}
};

// Price-time priority matching engine.
// Bids sorted descending (highest first), asks ascending (lowest first).
// Incoming orders match against resting orders at crossing prices;
// any unfilled remainder is added to the book.
class MatchingEngine {
private:
    using BidBook = std::map<double, std::deque<Order>, std::greater<double>>;
    using AskBook = std::map<double, std::deque<Order>>;

    std::unordered_map<std::string, BidBook> bidBooks;
    std::unordered_map<std::string, AskBook> askBooks;

    std::vector<Trade> tradeHistory;
    mutable std::mutex engineMutex;
    std::atomic<int>   tradeCounter{0};

    static long long now() {
        return std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
    }

    std::vector<Trade> matchBuy(Order order);
    std::vector<Trade> matchSell(Order order);

public:
    // Submit an order; returns all trades generated (may be empty if no cross).
    std::vector<Trade> submitOrder(Order order);

    // Cancel a resting order by ID. Returns true if found and removed.
    bool cancelOrder(const std::string& orderId, const std::string& symbol, bool isBuy);

    // Best prices (0 if book is empty on that side)
    double bestBid(const std::string& symbol) const;
    double bestAsk(const std::string& symbol) const;

    std::vector<Trade> getRecentTrades(size_t count = 20) const;
    size_t getTradeCount() const;
};

} // namespace MarketData

#endif // MATCHINGENGINE_H
