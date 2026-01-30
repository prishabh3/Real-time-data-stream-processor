#ifndef ORDERBOOK_H
#define ORDERBOOK_H

#include <map>
#include <memory>
#include <string>
#include <vector>
#include <mutex>

namespace MarketData {

struct Order {
    std::string orderId;
    double price;
    int quantity;
    long long timestamp;
    bool isBuy;
    
    Order(const std::string& id, double p, int qty, long long ts, bool buy)
        : orderId(id), price(p), quantity(qty), timestamp(ts), isBuy(buy) {}
};

struct PriceLevel {
    double price;
    int totalQuantity;
    std::vector<Order> orders;
    
    PriceLevel() : price(0.0), totalQuantity(0) {}  // Default constructor
    PriceLevel(double p) : price(p), totalQuantity(0) {}
    
    void addOrder(const Order& order) {
        orders.push_back(order);
        totalQuantity += order.quantity;
    }
    
    void removeOrder(const std::string& orderId) {
        for (auto it = orders.begin(); it != orders.end(); ++it) {
            if (it->orderId == orderId) {
                totalQuantity -= it->quantity;
                orders.erase(it);
                break;
            }
        }
    }
};

class OrderBook {
private:
    std::string symbol;
    // Using std::map (Red-Black Tree) for O(log n) insertion and sorted order
    std::map<double, PriceLevel, std::greater<double>> bids; // Descending order
    std::map<double, PriceLevel> asks; // Ascending order
    mutable std::mutex bookMutex;
    
public:
    OrderBook(const std::string& sym);
    
    void addOrder(const Order& order);
    void removeOrder(const std::string& orderId, bool isBuy);
    void updateOrder(const std::string& orderId, int newQuantity, bool isBuy);
    
    double getBestBid() const;
    double getBestAsk() const;
    double getSpread() const;
    int getDepth(bool isBuy, int levels = 5) const;
    
    std::vector<std::pair<double, int>> getBidLevels(int count = 10) const;
    std::vector<std::pair<double, int>> getAskLevels(int count = 10) const;
    
    void clear();
    std::string getSymbol() const { return symbol; }
};

} // namespace MarketData

#endif // ORDERBOOK_H
