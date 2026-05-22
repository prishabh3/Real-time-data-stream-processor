#include "Analytics.h"
#include "OrderBook.h"
#include "MatchingEngine.h"
#include "LockFreeQueue.h"
#include <chrono>
#include <cstdio>
#include <cmath>
#include <vector>
#include <random>
#include <thread>
#include <atomic>

using namespace MarketData;
using Clock = std::chrono::high_resolution_clock;

static double elapsedMs(Clock::time_point a, Clock::time_point b) {
    return std::chrono::duration<double, std::milli>(b - a).count();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

static void printBench(const char* name, long long iters, double ms) {
    double nsPerOp  = (ms * 1e6) / iters;
    double mOpsPerS = iters / (ms * 1000.0);
    std::printf("  %-40s  %7.2f ns/op  %6.2f M-ops/s\n", name, nsPerOp, mOpsPerS);
}

// ── LockFreeQueue throughput (single-producer / single-consumer) ──────────────
void bench_lfq() {
    std::printf("\n[Lock-Free Queue]\n");
    constexpr long long N = 2'000'000;
    LockFreeQueue<int, 65536> q;

    std::atomic<bool> start{false};
    long long produced = 0, consumed = 0;
    bool consumerDone = false;
    (void)consumerDone;

    auto consumer = [&] {
        while (!start.load(std::memory_order_relaxed)) {}
        int val;
        while (consumed < N) {
            if (q.tryPop(val)) consumed++;
        }
    };

    std::thread thr(consumer);
    start.store(true);

    auto t0 = Clock::now();
    while (produced < N) {
        while (!q.tryPush(static_cast<int>(produced))) {} // spin if full
        produced++;
    }
    thr.join();
    auto t1 = Clock::now();

    printBench("SPSC round-trip (2 M items)", N, elapsedMs(t0, t1));
}

// ── Analytics: tick update ────────────────────────────────────────────────────
void bench_analytics_tick() {
    std::printf("\n[Analytics]\n");
    Analytics a;
    constexpr long long N = 500'000;
    std::mt19937 rng(42);
    std::normal_distribution<double> price(100.0, 1.0);

    // Warm up
    for (int i = 0; i < 300; ++i) a.updateTick("X", price(rng), 100);

    auto t0 = Clock::now();
    for (long long i = 0; i < N; ++i)
        a.updateTick("X", price(rng), 100);
    auto t1 = Clock::now();
    printBench("updateTick", N, elapsedMs(t0, t1));

    // SMA (short window — O(n=20) loop)
    auto t2 = Clock::now();
    volatile double sink = 0;
    for (long long i = 0; i < N; ++i)
        sink += a.calculateSMA("X", 20);
    auto t3 = Clock::now();
    printBench("calculateSMA(20)", N, elapsedMs(t2, t3));
    (void)sink;

    // Long SMA — O(1) running sum
    auto t4 = Clock::now();
    for (long long i = 0; i < N; ++i)
        sink += a.getLongTermSMA("X");
    auto t5 = Clock::now();
    printBench("getLongTermSMA (O(1) running sum)", N, elapsedMs(t4, t5));

    // RSI
    auto t6 = Clock::now();
    for (long long i = 0; i < N; ++i)
        sink += a.calculateRSI("X").value;
    auto t7 = Clock::now();
    printBench("calculateRSI(14)", N, elapsedMs(t6, t7));

    // MACD — O(1) streaming state
    auto t8 = Clock::now();
    for (long long i = 0; i < N; ++i)
        sink += a.calculateMACD("X").macdLine;
    auto t9 = Clock::now();
    printBench("calculateMACD (O(1) streaming)", N, elapsedMs(t8, t9));

    // Bollinger Bands
    auto t10 = Clock::now();
    for (long long i = 0; i < N; ++i)
        sink += a.calculateBollingerBands("X").bandwidth;
    auto t11 = Clock::now();
    printBench("calculateBollingerBands(20)", N, elapsedMs(t10, t11));
}

// ── OrderBook: add / remove ───────────────────────────────────────────────────
void bench_order_book() {
    std::printf("\n[OrderBook]\n");
    constexpr long long N = 200'000;
    OrderBook book("BENCH");
    std::mt19937 rng(1);
    std::uniform_real_distribution<double> priceD(90.0, 110.0);
    std::uniform_int_distribution<int>     qtyD(1, 1000);

    std::vector<std::string> ids;
    ids.reserve(N);
    for (long long i = 0; i < N; ++i) ids.push_back("O" + std::to_string(i));

    auto t0 = Clock::now();
    for (long long i = 0; i < N; ++i)
        book.addOrder(Order(ids[i], "BENCH", priceD(rng), qtyD(rng), i, i % 2 == 0));
    auto t1 = Clock::now();
    printBench("OrderBook::addOrder", N, elapsedMs(t0, t1));

    auto t2 = Clock::now();
    for (long long i = 0; i < N; ++i)
        book.removeOrder(ids[i], i % 2 == 0);
    auto t3 = Clock::now();
    printBench("OrderBook::removeOrder", N, elapsedMs(t2, t3));
}

// ── MatchingEngine: order submission ─────────────────────────────────────────
void bench_matching() {
    std::printf("\n[MatchingEngine]\n");
    constexpr long long N = 100'000;
    MatchingEngine engine;
    std::mt19937 rng(7);
    std::uniform_real_distribution<double> priceD(99.0, 101.0);
    std::uniform_int_distribution<int>     qtyD(1, 100);
    long long trades = 0;

    auto t0 = Clock::now();
    for (long long i = 0; i < N; ++i) {
        bool isBuy = (i % 2 == 0);
        double price = isBuy ? std::floor(priceD(rng) * 100) / 100.0
                             : std::ceil (priceD(rng) * 100) / 100.0;
        auto t = engine.submitOrder(
            Order("O" + std::to_string(i), "X", price, qtyD(rng), i, isBuy));
        trades += static_cast<long long>(t.size());
    }
    auto t1 = Clock::now();
    printBench("submitOrder (mixed buy/sell)", N, elapsedMs(t0, t1));
    std::printf("    → %lld trades generated (%.1f%% match rate)\n",
                trades, 100.0 * trades / N);
}

int main() {
    std::printf("========================================\n");
    std::printf("  Market Data Processor — Benchmarks\n");
    std::printf("  (compiled with -O3 -march=native)\n");
    std::printf("========================================\n");

    bench_lfq();
    bench_analytics_tick();
    bench_order_book();
    bench_matching();

    std::printf("\n");
    return 0;
}
