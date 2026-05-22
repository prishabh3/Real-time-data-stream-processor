# Real-Time Market Data Stream Processor

**Live demo: [real-time-data-stream-processor.vercel.app](https://real-time-data-stream-processor.vercel.app)**

A high-performance financial data streaming system built in **C++17** with a **React trading dashboard**. Processes real-time market data with **sub-100ms latency** and **10,000+ ticks/second** throughput across 8 concurrent symbols.

---

## Features

| Category | What's included |
|---|---|
| **Market data** | Lock-free simulated feed, pluggable Alpha Vantage / Yahoo Finance adapters |
| **Order book** | Red-Black Tree price levels, O(log n) add/remove, O(1) best-bid/ask |
| **Analytics** | SMA, EMA, VWAP, Volatility, **RSI**, **MACD**, **Bollinger Bands**, price alerts |
| **Matching engine** | Price-time priority, partial fills, cancel by ID |
| **Performance** | Vyukov MPMC lock-free queue, O(1) long-term SMA, cache-line isolation |
| **Quality** | Thread-safe logger, INI config file, input validation, zero-dependency tests |
| **Dashboard** | Next.js 16 + React 19 trading UI — live candlestick chart, order book, analytics panel |

---

## Quick Start

### Prerequisites

- C++17 compiler (GCC 7+, Clang 5+)
- POSIX threads (`-pthread`)
- `make`

### Build & run

```bash
# Clone
git clone https://github.com/prishabh3/Real-time-data-stream-processor
cd Real-time-data-stream-processor

# Build (optimised — O3 + march=native)
make

# Run the 30-second demo
make run
# or directly:
./bin/market_data_processor
```

### Run tests

```bash
make test
```

Expected output:
```
  PASS  buf.getSize() == 0u
  PASS  book.getBestBid() ≈ 100.0
  PASS  rHigh.isOverbought
  PASS  t3.size() == 1u
  ...
  80 / 80 tests passed  ✓ all green
```

### Run benchmarks

```bash
make benchmark
```

Sample results (Apple M-series, `-O3 -march=native`):

```
[Lock-Free Queue]
  SPSC round-trip (2 M items)                 11 ns/op   ~90 M-ops/s

[Analytics]
  updateTick                                  67 ns/op   ~15 M-ops/s
  calculateSMA(20)                            18 ns/op   ~54 M-ops/s
  getLongTermSMA  (O(1) running sum)          12 ns/op   ~83 M-ops/s
  calculateMACD   (O(1) streaming state)      10 ns/op  ~100 M-ops/s
  calculateRSI(14)                            85 ns/op   ~12 M-ops/s
  calculateBollingerBands(20)                 38 ns/op   ~26 M-ops/s

[OrderBook]
  addOrder                                   306 ns/op    ~3 M-ops/s
  removeOrder  (orderId-index, O(log n))     380 ns/op    ~3 M-ops/s

[MatchingEngine]
  submitOrder (mixed buy/sell)               160 ns/op    ~6 M-ops/s
  → 76 634 trades at 76.6 % match rate
```

### Other build targets

```bash
make debug        # -g -O0, no optimisation
make performance  # -O3 -flto -DNDEBUG, link-time optimisation
make clean        # remove obj/ and bin/
```

---

## Trading Dashboard (Frontend)

A fully functional institutional trading dashboard built with **Next.js 16**, **React 19**, **TypeScript**, and **Tailwind CSS v4**.

### Prerequisites

- Node.js 18+
- npm

### Live demo

**[real-time-data-stream-processor.vercel.app](https://real-time-data-stream-processor.vercel.app)** — hosted on Vercel, no setup needed.

### Run locally

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> The dashboard runs in **mock mode** by default (`NEXT_PUBLIC_USE_MOCK=true` in `frontend/.env.local`) — no backend connection required. It simulates live tick streams at 100ms intervals using the same symbols and data shapes as the C++ backend.

### Dashboard features

| Panel | Details |
|---|---|
| **Candlestick chart** | OHLC candles via `lightweight-charts`, 6 timeframes (1m → 1D), SMA overlay |
| **Order book** | Live bid/ask ladder with depth visualisation and recent trades |
| **Analytics panel** | RSI, MACD histogram, Bollinger Bands, VWAP — updates every tick |
| **Watchlist sidebar** | 8 symbols with sparklines, price, and % change |
| **Status bar** | Connection state, latency, throughput, NYSE clock |
| **Keyboard shortcuts** | `1–8` to switch symbols, `/` to focus search |

### Tech stack

- **Framework**: Next.js 16.2 (Turbopack)
- **UI**: React 19, Tailwind CSS v4, Radix UI primitives, Lucide icons
- **Charts**: `lightweight-charts` v5
- **State**: Zustand v5
- **Language**: TypeScript 5

---

## Configuration

All runtime settings live in `config.ini` — no recompilation needed.

```ini
[processor]
symbols             = AAPL,GOOGL,MSFT,AMZN,TSLA,NVDA,JPM,BAC
thread_count        = 4
update_frequency_ms = 10
demo_duration_sec   = 30

[logging]
# DEBUG | INFO | WARN | ERROR
level        = INFO
log_to_file  = false
log_file     = market_data.log

[alerts]
# Fires when the named symbol crosses the threshold
AAPL_above = 200.0
TSLA_below = 150.0
```

If `config.ini` is absent the application falls back to safe built-in defaults and logs a warning.

---

## Architecture

```
config.ini
    │
    ▼
main.cpp  ──────────────────────────────────────────────────────┐
    │                                                            │
    ▼                                                            ▼
StreamProcessor                                         MatchingEngine
    ├── MarketDataFeed  (lock-free MPMC queue, CV wake)
    ├── OrderBook × N  (Red-Black Tree + orderId index)
    └── Analytics       (CircularBuffer + streaming EMA state)
            ├── SMA / EMA / VWAP / StdDev
            ├── RSI  (Wilder smoothing)
            ├── MACD (streaming EMA12/26/signal — O(1))
            └── Bollinger Bands
```

### Core components

| File | Responsibility |
|---|---|
| `include/OrderBook.h` | Bid/ask price levels, orderId→price index |
| `include/MarketDataFeed.h` | Lock-free tick queue, feed threads |
| `include/Analytics.h` | Circular buffer, all indicator declarations |
| `include/StreamProcessor.h` | Thread pool, metrics, wires everything together |
| `include/MatchingEngine.h` | Price-time priority matching, partial fills |
| `include/LockFreeQueue.h` | Vyukov bounded MPMC queue template |
| `include/Logger.h` | Thread-safe levelled logger with ANSI colours |
| `include/Config.h` | INI file parser with typed accessors |

---

## Performance design

### Lock-free data path

The hot path (producer → consumer) uses `LockFreeQueue<TickData, 65536>` — a Dmitry Vyukov bounded MPMC queue. Push and pop are CAS loops with no kernel calls. A lightweight condition variable wakes sleeping consumers instead of the old 100 µs busy-sleep.

### O(1) analytics

- **Long-term SMA**: `CircularBuffer` maintains a running sum updated on every push (add new value, subtract evicted value). No loop needed.
- **MACD**: `Analytics::updateTick` advances `ema12`, `ema26`, and `signalLine` in-place. `calculateMACD()` is a single struct read — O(1).
- **RSI**: Wilder's exponential smoothing over the stored price history. O(period).
- **Bollinger Bands**: one SMA + one StdDev pass over the window. O(period).

### Cache-line isolation

`std::atomic<bool> running` and `PerformanceMetrics metrics` are each decorated with `alignas(64)` in `StreamProcessor`. This prevents false sharing between the per-tick loop check and the per-tick metrics update across four threads.

### OrderBook removal

`OrderBook` maintains an `unordered_map<orderId, price>`. `removeOrder` looks up the price in O(1) then erases the map entry in O(log n), eliminating the original O(N) full-scan.

---

## Analytics API

```cpp
auto a = processor.getAnalytics();

// Classic indicators
double sma   = a->getShortTermSMA("AAPL");       // SMA(20)
double ema   = a->calculateEMA("AAPL", 20, 0.1);
double vwap  = a->calculateVWAP("AAPL", 20);
double vol   = a->calculateVolatility("AAPL");

// RSI
auto rsi = a->calculateRSI("AAPL");        // period = 14 (default)
// rsi.value        0–100
// rsi.isOverbought true when value > 70
// rsi.isOversold   true when value < 30

// MACD
auto macd = a->calculateMACD("AAPL");
// macd.macdLine    EMA(12) − EMA(26)
// macd.signalLine  EMA(9) of macdLine
// macd.histogram   macdLine − signalLine

// Bollinger Bands
auto bb = a->calculateBollingerBands("AAPL");  // period = 20 (default)
// bb.upper / bb.middle / bb.lower
// bb.bandwidth  = (upper − lower) / middle
```

## Order book API

```cpp
auto book = processor.getOrderBook("AAPL");
double bid    = book->getBestBid();
double ask    = book->getBestAsk();
double spread = book->getSpread();
int    depth  = book->getDepth(true, 5);   // total qty across top-5 bid levels
auto   bids   = book->getBidLevels(10);    // vector<pair<price, qty>>
```

## Matching engine API

```cpp
MatchingEngine engine;

// Resting limit orders
engine.submitOrder(Order("B1", "AAPL", 150.0, 100, ts, true));   // buy limit
engine.submitOrder(Order("A1", "AAPL", 151.0,  50, ts, false));  // sell limit

// Aggressive order — returns all generated trades (may be empty)
auto trades = engine.submitOrder(Order("A2", "AAPL", 150.0, 80, ts, false));
for (auto& t : trades)
    std::cout << t.tradeId << " qty=" << t.quantity << " @ " << t.price << "\n";

engine.cancelOrder("B1", "AAPL", true);  // cancel resting bid
```

## Logging API

```cpp
// Set in config.ini or at runtime
Logger::instance().setLevel("DEBUG");
Logger::instance().openFile("app.log");

// Anywhere in the codebase:
LOG_DEBUG("tick received: " << sym << " @ " << price);
LOG_INFO("processor started with " << n << " threads");
LOG_WARN("queue full — dropping tick for " << sym);
LOG_ERROR("invalid order: price=" << p);
```

Output format:
```
[14:32:01.047] [INFO ] StreamProcessor started with 4 processing thread(s)
[14:32:05.112] [WARN ] [OrderBook.cpp:18] rejected order O9 — invalid price -1
[14:32:10.334] [WARN ] PRICE ALERT: AAPL is above target 200  (current: 201.34)
```

---

## Project structure

```
.
├── include/
│   ├── Analytics.h          # Indicator declarations + result structs
│   ├── Config.h             # INI config loader
│   ├── LockFreeQueue.h      # Vyukov MPMC ring buffer
│   ├── Logger.h             # Thread-safe levelled logger
│   ├── MarketDataFeed.h     # Tick ingestion feed
│   ├── MatchingEngine.h     # Price-time priority matching engine
│   ├── OrderBook.h          # Bid/ask order book
│   └── StreamProcessor.h   # Top-level coordinator
├── src/
│   ├── Analytics.cpp
│   ├── Config.cpp
│   ├── Logger.cpp
│   ├── MarketDataFeed.cpp
│   ├── MatchingEngine.cpp
│   ├── OrderBook.cpp
│   ├── StreamProcessor.cpp
│   └── main.cpp
├── tests/
│   ├── TestRunner.h         # Zero-dependency test framework
│   ├── tests.cpp            # 80 unit tests
│   └── benchmark.cpp        # Latency & throughput benchmarks
├── frontend/                # React trading dashboard
│   ├── app/                 # Next.js app router
│   ├── components/          # Chart, OrderBook, Analytics, Sidebar, StatusBar
│   ├── lib/
│   │   ├── mock/            # Simulated market data generators
│   │   └── websocket/       # Data stream hooks
│   ├── store/               # Zustand state (market, orderbook, metrics)
│   ├── public/
│   ├── .env.local           # NEXT_PUBLIC_USE_MOCK=true
│   └── package.json
├── docs/
│   ├── ARCHITECTURE.md
│   └── PERFORMANCE.md
├── config.ini               # Runtime configuration
├── Makefile
└── CMakeLists.txt
```

---

## Roadmap

- [ ] WebSocket feed adapter (Binance / Polygon.io) — connect dashboard to live data
- [ ] Historical data replay and strategy backtesting
- [ ] SIMD-accelerated analytics (AVX2)
- [ ] Prometheus metrics endpoint
- [x] GUI trading dashboard (Next.js + React)

---

## License

Created for educational and demonstration purposes.
