#include "TestRunner.h"
#include "Analytics.h"
#include "OrderBook.h"
#include "MatchingEngine.h"
#include <cstdio>

using namespace MarketData;

// ── CircularBuffer ────────────────────────────────────────────────────────────
void test_circular_buffer() {
    Test::suite("CircularBuffer", [] {
        CircularBuffer buf(4);

        EXPECT_EQ(buf.getSize(), 0u);
        EXPECT_NEAR(buf.getSum(), 0.0, 1e-9);

        buf.push(1.0); buf.push(2.0); buf.push(3.0); buf.push(4.0);
        EXPECT_EQ(buf.getSize(), 4u);
        EXPECT_NEAR(buf.getSum(), 10.0, 1e-9);

        // get(0) is oldest, get(3) is newest
        EXPECT_NEAR(buf.get(0), 1.0, 1e-9);
        EXPECT_NEAR(buf.get(3), 4.0, 1e-9);

        // Wrap around: push 5 evicts 1
        buf.push(5.0);
        EXPECT_EQ(buf.getSize(), 4u);
        EXPECT_NEAR(buf.getSum(), 14.0, 1e-9); // 2+3+4+5
        EXPECT_NEAR(buf.get(0), 2.0, 1e-9);
        EXPECT_NEAR(buf.get(3), 5.0, 1e-9);
    });
}

// ── OrderBook ─────────────────────────────────────────────────────────────────
void test_order_book() {
    Test::suite("OrderBook", [] {
        OrderBook book("AAPL");

        // Empty book
        EXPECT_NEAR(book.getBestBid(), 0.0, 1e-9);
        EXPECT_NEAR(book.getBestAsk(), 0.0, 1e-9);
        EXPECT_NEAR(book.getSpread(), 0.0, 1e-9);

        book.addOrder(Order("B1", "AAPL", 100.0, 50, 1000, true));
        book.addOrder(Order("B2", "AAPL",  99.0, 30, 1001, true));
        book.addOrder(Order("A1", "AAPL", 101.0, 40, 1002, false));
        book.addOrder(Order("A2", "AAPL", 102.0, 20, 1003, false));

        EXPECT_NEAR(book.getBestBid(), 100.0, 1e-9);
        EXPECT_NEAR(book.getBestAsk(), 101.0, 1e-9);
        EXPECT_NEAR(book.getSpread(),    1.0, 1e-9);

        // Depth: 2 bid levels → 50 + 30 = 80
        EXPECT_EQ(book.getDepth(true, 5), 80);
        // Depth: top 1 ask level → 40
        EXPECT_EQ(book.getDepth(false, 1), 40);

        // Remove an order; best bid should stay 100
        book.removeOrder("B2", true);
        EXPECT_NEAR(book.getBestBid(), 100.0, 1e-9);
        EXPECT_EQ(book.getDepth(true, 5), 50);

        // Remove the only bid at 100; book should be empty on bid side
        book.removeOrder("B1", true);
        EXPECT_NEAR(book.getBestBid(), 0.0, 1e-9);

        // Update quantity
        book.updateOrder("A1", 10, false);
        auto asks = book.getAskLevels(5);
        EXPECT_EQ(asks[0].second, 10);

        book.clear();
        EXPECT_NEAR(book.getBestAsk(), 0.0, 1e-9);
    });
}

// ── Analytics: SMA / EMA / VWAP ──────────────────────────────────────────────
void test_analytics_basic() {
    Test::suite("Analytics — SMA / EMA / VWAP", [] {
        Analytics a;

        // Feed 5 ticks: 10 11 12 13 14  → SMA(5) = 12
        for (int i = 10; i <= 14; ++i)
            a.updateTick("X", i, 100);

        EXPECT_NEAR(a.calculateSMA("X", 5), 12.0, 1e-6);

        // SMA of last 3 = (12+13+14)/3 = 13
        EXPECT_NEAR(a.calculateSMA("X", 3), 13.0, 1e-6);

        // VWAP with equal volumes == SMA
        EXPECT_NEAR(a.calculateVWAP("X", 5), 12.0, 1e-6);

        // EMA should be between first and last price
        double ema = a.calculateEMA("X", 5, 0.5);
        EXPECT_GT(ema, 10.0);
        EXPECT_LT(ema, 14.0);

        // getChangePercent: current=14, 4 ticks ago=10 → +40%
        EXPECT_NEAR(a.getChangePercent("X", 4), 40.0, 1e-4);

        // High/Low
        EXPECT_NEAR(a.getHighLow("X", 5, true),  14.0, 1e-9);
        EXPECT_NEAR(a.getHighLow("X", 5, false), 10.0, 1e-9);

        // Unknown symbol
        EXPECT_NEAR(a.calculateSMA("UNKNOWN", 5), 0.0, 1e-9);
    });
}

// ── Analytics: RSI ────────────────────────────────────────────────────────────
void test_analytics_rsi() {
    Test::suite("Analytics — RSI", [] {
        Analytics a;

        // Insufficient data → neutral (50)
        a.updateTick("S", 100.0, 1);
        auto r0 = a.calculateRSI("S", 14);
        EXPECT_NEAR(r0.value, 50.0, 1e-9);

        // Monotonically rising prices → RSI should be high (>= 70 overbought)
        for (int i = 1; i <= 30; ++i)
            a.updateTick("S", 100.0 + i, 1);
        auto rHigh = a.calculateRSI("S", 14);
        EXPECT_GT(rHigh.value, 70.0);
        EXPECT_TRUE(rHigh.isOverbought);
        EXPECT_FALSE(rHigh.isOversold);

        // Monotonically falling prices → RSI should be low (<= 30 oversold)
        Analytics b;
        for (int i = 0; i <= 30; ++i)
            b.updateTick("S", 100.0 - i, 1);
        auto rLow = b.calculateRSI("S", 14);
        EXPECT_LT(rLow.value, 30.0);
        EXPECT_TRUE(rLow.isOversold);
        EXPECT_FALSE(rLow.isOverbought);
    });
}

// ── Analytics: MACD ───────────────────────────────────────────────────────────
void test_analytics_macd() {
    Test::suite("Analytics — MACD", [] {
        Analytics a;

        // No data → zeros
        auto m0 = a.calculateMACD("X");
        EXPECT_NEAR(m0.macdLine, 0.0, 1e-9);

        // Rising prices: EMA12 > EMA26 after warmup → macdLine > 0
        for (int i = 0; i < 60; ++i)
            a.updateTick("X", 100.0 + i * 0.5, 1);
        auto mUp = a.calculateMACD("X");
        EXPECT_GT(mUp.macdLine, 0.0);

        // Falling prices: EMA12 < EMA26 → macdLine < 0
        Analytics b;
        for (int i = 0; i < 60; ++i)
            b.updateTick("X", 200.0 - i * 0.5, 1);
        auto mDown = b.calculateMACD("X");
        EXPECT_LT(mDown.macdLine, 0.0);

        // histogram == macdLine - signalLine
        EXPECT_NEAR(mUp.histogram, mUp.macdLine - mUp.signalLine, 1e-9);
    });
}

// ── Analytics: Bollinger Bands ────────────────────────────────────────────────
void test_analytics_bollinger() {
    Test::suite("Analytics — Bollinger Bands", [] {
        Analytics a;
        for (int i = 0; i < 25; ++i)
            a.updateTick("X", 100.0 + (i % 2 == 0 ? 1.0 : -1.0), 1);

        auto bb = a.calculateBollingerBands("X", 20);

        EXPECT_GT(bb.upper, bb.middle);
        EXPECT_LT(bb.lower, bb.middle);
        EXPECT_GT(bb.bandwidth, 0.0);

        // Constant price → zero std-dev → bands collapse to middle
        Analytics b;
        for (int i = 0; i < 25; ++i)
            b.updateTick("X", 50.0, 1);
        auto flat = b.calculateBollingerBands("X", 20);
        EXPECT_NEAR(flat.upper, flat.middle, 1e-6);
        EXPECT_NEAR(flat.lower, flat.middle, 1e-6);
        EXPECT_NEAR(flat.bandwidth, 0.0, 1e-6);
    });
}

// ── MatchingEngine ────────────────────────────────────────────────────────────
void test_matching_engine() {
    Test::suite("MatchingEngine", [] {
        MatchingEngine engine;

        // No resting orders → incoming order should sit in the book, no trades
        auto t1 = engine.submitOrder(Order("B1", "AAPL", 100.0, 100, 0, true));
        EXPECT_EQ(t1.size(), 0u);
        EXPECT_NEAR(engine.bestBid("AAPL"), 100.0, 1e-9);
        EXPECT_NEAR(engine.bestAsk("AAPL"),   0.0, 1e-9);

        // Ask above bid → no match
        auto t2 = engine.submitOrder(Order("A1", "AAPL", 101.0, 50, 1, false));
        EXPECT_EQ(t2.size(), 0u);
        EXPECT_NEAR(engine.bestAsk("AAPL"), 101.0, 1e-9);

        // Ask at bid price → full match (50 out of 100 fill)
        auto t3 = engine.submitOrder(Order("A2", "AAPL", 100.0, 50, 2, false));
        EXPECT_EQ(t3.size(), 1u);
        EXPECT_NEAR(t3[0].price,    100.0, 1e-9);
        EXPECT_EQ(t3[0].quantity,   50);
        EXPECT_NEAR(engine.bestBid("AAPL"), 100.0, 1e-9); // 50 remaining

        // Another sell that fully exhausts the remaining bid (50) and crosses 101 ask
        auto t4 = engine.submitOrder(Order("A3", "AAPL", 99.0, 60, 3, false));
        // 50 fills at 100 (resting bid), 10 left goes to ask book at 99
        EXPECT_EQ(t4.size(), 1u);
        EXPECT_EQ(t4[0].quantity, 50);
        EXPECT_NEAR(engine.bestBid("AAPL"), 0.0, 1e-9); // bid book emptied
        EXPECT_NEAR(engine.bestAsk("AAPL"), 99.0, 1e-9); // 10 resting at 99

        // Total trades so far: t3=1, t4=1 → 2
        EXPECT_EQ(engine.getTradeCount(), 2u);

        // Partial fill: incoming buy 200 @ 101 vs resting asks 99(10) + 101(50)
        auto t5 = engine.submitOrder(Order("B2", "AAPL", 101.0, 70, 4, true));
        EXPECT_EQ(t5.size(), 2u);          // matches both ask levels
        EXPECT_EQ(t5[0].quantity, 10);     // fills 10 @ 99
        EXPECT_EQ(t5[1].quantity, 50);     // fills 50 @ 101
        // 2 existing + t5's 2 = 4
        EXPECT_EQ(engine.getTradeCount(), 4u);
        EXPECT_NEAR(engine.bestBid("AAPL"), 101.0, 1e-9); // 10 remaining in bid book
        EXPECT_NEAR(engine.bestAsk("AAPL"),   0.0, 1e-9); // ask book cleared

        // Cancel the resting bid
        bool cancelled = engine.cancelOrder("B2", "AAPL", true);
        EXPECT_TRUE(cancelled);
        EXPECT_NEAR(engine.bestBid("AAPL"), 0.0, 1e-9);

        // Cancel non-existent order
        EXPECT_FALSE(engine.cancelOrder("GHOST", "AAPL", true));
    });
}

// ── Price alerts ──────────────────────────────────────────────────────────────
void test_price_alerts() {
    Test::suite("Analytics — Price Alerts", [] {
        Analytics a;
        a.addAlert(PriceAlert("AAPL", 150.0, true));   // trigger above 150
        a.addAlert(PriceAlert("AAPL", 100.0, false));  // trigger below 100

        auto none = a.checkAlerts("AAPL", 125.0);
        EXPECT_EQ(none.size(), 0u);

        auto above = a.checkAlerts("AAPL", 155.0);
        EXPECT_EQ(above.size(), 1u);
        EXPECT_TRUE(above[0].isAbove);
        EXPECT_TRUE(above[0].triggered);

        // Already triggered — should not fire again
        auto again = a.checkAlerts("AAPL", 160.0);
        EXPECT_EQ(again.size(), 0u);

        auto below = a.checkAlerts("AAPL", 95.0);
        EXPECT_EQ(below.size(), 1u);
        EXPECT_FALSE(below[0].isAbove);

        a.clearTriggeredAlerts();
        // After clearing, both were triggered so list is empty — no new fires
        auto afterClear = a.checkAlerts("AAPL", 200.0);
        EXPECT_EQ(afterClear.size(), 0u);
    });
}

int main() {
    std::printf("========================================\n");
    std::printf("  Market Data Processor — Unit Tests\n");
    std::printf("========================================\n");

    test_circular_buffer();
    test_order_book();
    test_analytics_basic();
    test_analytics_rsi();
    test_analytics_macd();
    test_analytics_bollinger();
    test_matching_engine();
    test_price_alerts();

    return Test::summary();
}
