# Real-Time Market Data Stream Processor

A C++17 engine that ingests simulated stock price ticks, maintains per-symbol order books, computes technical indicators, and runs a price-time priority matching engine — paired with a Next.js trading dashboard that visualises everything live.

**Live demo:** [real-time-data-stream-processor.vercel.app](https://real-time-data-stream-processor.vercel.app)

---

## Tech stack

| Layer | Technology | What it does |
|---|---|---|
| Core engine | C++17 | Tick processing, analytics, order book, matching engine |
| Concurrency | `std::thread`, `std::atomic` | Multi-threaded tick consumers; lock-free queue between producer and consumers |
| Build | Make + CMake | `make` for day-to-day builds; CMake for IDE/CI integration |
| Configuration | INI file (`config.ini`) | Symbols, thread count, log level, price alerts |
| Frontend framework | Next.js 16 + React 19 | Single-page trading dashboard |
| State management | Zustand 5 | Three stores: market data, order book, metrics |
| Charts | Lightweight Charts v5 | Candlestick, RSI, MACD, Bollinger — GPU-composited canvas rendering |
| UI components | Radix UI + Tailwind CSS 4 | Accessible primitives, utility styling |
| Language (frontend) | TypeScript 5 | Types mirror C++ structs one-to-one |

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        C++ Backend Process                         │
│                                                                    │
│  ┌──────────────────────┐   LockFreeQueue<TickData, 65536>         │
│  │   MarketDataFeed     │ ─────────────────────────────────────┐   │
│  │   (1 feed thread)    │                                      │   │
│  │   simulateFeed()     │   8 symbols × every 10 ms            │   │
│  └──────────────────────┘                                      │   │
│                                                                │   │
│                                           ┌────────────────────▼──┐│
│                                           │   StreamProcessor     ││
│                                           │   (N worker threads)  ││
│                                           │   processingLoop()    ││
│                                           └──────────┬────────────┘│
│                                                      │             │
│                             ┌────────────────────────┼──────────┐  │
│                             │                        │          │  │
│                             ▼                        ▼          │  │
│                    ┌─────────────────┐    ┌──────────────────┐  │  │
│                    │   OrderBook     │    │    Analytics     │  │  │
│                    │  (per symbol)   │    │  (per symbol)    │  │  │
│                    │  bids: std::map │    │  CircularBuffer  │  │  │
│                    │  asks: std::map │    │  SMA/EMA/VWAP    │  │  │
│                    │  orderIndex     │    │  RSI/MACD/BB     │  │  │
│                    └─────────────────┘    │  PriceAlerts     │  │  │
│                                           └──────────────────┘  │  │
│                                                                  │  │
│   ┌─────────────────────────────────────────────────────────┐   │  │
│   │  MatchingEngine  (runs as standalone demo at end)       │   │  │
│   │  price-time priority · bid map desc · ask map asc       │   │  │
│   │  fills, partial fills, cancel by ID                     │   │  │
│   └─────────────────────────────────────────────────────────┘   │  │
└────────────────────────────────────────────────────────────────────┘

         (no WebSocket yet — frontend runs its own mock simulator)

┌────────────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (port 3000)                    │
│                                                                    │
│  useDataStreams() hook                                             │
│     setInterval 100 ms → generateTick() × 8 symbols               │
│     setInterval 1000 ms → generateMetrics()                       │
│                                                                    │
│  Zustand stores                                                    │
│  ┌───────────────┐  ┌──────────────────┐  ┌───────────────────┐   │
│  │ marketStore   │  │ orderbookStore   │  │  metricsStore     │   │
│  │ candles       │  │ snapshots        │  │  latency history  │   │
│  │ analytics     │  │ trade tape       │  │  throughput       │   │
│  │ lastPrices    │  └──────────────────┘  └───────────────────┘   │
│  └───────────────┘                                                 │
│                                                                    │
│  Components: StatusBar · Sidebar · ChartPanel · OrderBookPanel     │
│              AnalyticsPanel (RSI, MACD, Bollinger, VWAP, ...)      │
└────────────────────────────────────────────────────────────────────┘
```

The backend and frontend are **currently decoupled**. The frontend ships its own TypeScript simulator (`lib/mock/`) that reproduces the same tick-generation behaviour as the C++ `simulateFeed()`. The env var `NEXT_PUBLIC_USE_MOCK=true` controls which path runs. A real deployment would replace the mock intervals in `useDataStreams` with a WebSocket connection to port 8080.

---

## How the pieces fit together

### C++ data path

1. **`MarketDataFeed`** runs one feed thread. Every 10 ms it loops over all 8 configured symbols, draws a new price from a Gaussian random walk (`std::normal_distribution<>(0, 0.5)`), packages it as a `TickData`, and calls `dataQueue.tryPush(tick)`. If the queue is full (65,536 slots) the tick is dropped and a WARN is logged. After pushing, it signals a condition variable so consumer threads wake up instead of spinning.

2. **`StreamProcessor`** spawns N worker threads (default 4, controlled by `processor.thread_count` in `config.ini`). Each thread calls `dataFeed->getNextTick()` in a loop. When a tick arrives, `processTick()` does three things: updates the `Analytics` engine, checks whether any price alert threshold was crossed, then adds a synthetic bid (price × 0.999) and ask (price × 1.001) order to that symbol's `OrderBook`.

3. **`Analytics`** stores up to 200 prices and volumes per symbol in a `CircularBuffer`. The buffer maintains a running sum so full-window SMA is O(1). MACD state (`ema12`, `ema26`, `signalLine`) is updated incrementally on every call to `updateTick` — also O(1). RSI uses Wilder's smoothed average over available history.

4. **`OrderBook`** keeps two `std::map` containers — bids sorted descending, asks ascending — guarded by a per-book mutex. An `orderIndex` hash map (`unordered_map<orderId, price>`) lets `removeOrder` find the right price level in O(1) rather than scanning every level.

5. **`MatchingEngine`** is a standalone component that runs a price-time priority demo at the end of the 30-second run. It is not connected to the live tick feed. Incoming orders walk the opposite side of the book, filling resting orders at each crossing price; unfilled remainder rests in the book. Each price level uses a `std::deque` for strict FIFO ordering within the level.

### Frontend data path

1. `useDataStreams()` (called once from `page.tsx`) starts two `setInterval` loops. The tick loop fires every 100 ms — 10× slower than the backend — because calling React `setState` 800 times per second would be wasteful. Each tick is generated by `generateTick()`, which uses an Ornstein–Uhlenbeck process (mean-reverting Brownian motion) around each symbol's base price.

2. Each tick updates three Zustand stores: `marketStore` gets the new last price and an updated OHLCV candle (aggregated by `aggregateTick()` into the active timeframe bucket), `orderbookStore` gets a fresh order book snapshot 30% of the time and a new trade record 15% of the time.

3. Analytics recompute is further throttled: only when the rolling price buffer has ≥30 entries and a 5% random coin-flip passes does `computeAnalytics()` run. This means indicators update roughly every 2 seconds per symbol rather than every tick.

4. Components subscribe to exactly the slice of store state they need (Zustand selector pattern), so a price update for AAPL does not re-render the GOOGL watchlist row.

---

## Quick start

### C++ backend

**Prerequisites:** g++ ≥ 9 with C++17 support, `pthread`.

```bash
# Clone and enter the repo
git clone https://github.com/prishabh3/Real-time-data-stream-processor
cd "Real-Time Market Data Stream Processor"

# Build with release flags (-O3 -march=native)
make

# Run for 30 seconds (duration set in config.ini)
make run
# or:
./bin/market_data_processor
```

The binary searches for `config.ini` in the **current working directory**. If not found it logs a warning and falls back to built-in defaults (8 symbols, 4 threads, 30 s demo, INFO log level).

```bash
make test        # unit tests
make benchmark   # throughput benchmarks (ns/op and M-ops/s)
make debug       # -g -O0 debug build
make performance # -O3 -flto -DNDEBUG link-time optimised build
make clean       # remove obj/ and bin/
```

### Frontend

**Prerequisites:** Node.js ≥ 18, npm.

```bash
cd frontend
npm install
```

The `.env.local` file is committed with mock mode on:

```
NEXT_PUBLIC_WS_HOST=localhost:8080
NEXT_PUBLIC_REST_HOST=localhost:8080
NEXT_PUBLIC_USE_MOCK=true
```

`NEXT_PUBLIC_USE_MOCK=true` means the frontend runs entirely in-browser with no backend required. Set it to `false` when you wire up a real WebSocket server on port 8080.

```bash
npm run dev     # development server at http://localhost:3000
npm run build   # production build
npm run start   # serve the production build
```

There is no database, no seed step, and no authentication.

---

## Feature walkthrough

1. **Open the dashboard** at `http://localhost:3000`. The status bar shows connection state (`CONNECTING` → `CONNECTED` after 800 ms), the active symbol, live throughput, and average latency.

2. **Watchlist (left sidebar):** Eight symbols with live price, absolute change, and percent change. Click any row to switch the main chart. Keyboard shortcut: press `1`–`8` to jump directly to a symbol; press `/` to focus the search box and filter the list.

3. **Candlestick chart (centre):** OHLCV candles for the active symbol. Use the toolbar to change timeframe (`1m`, `5m`, `15m`, `1H`, `4H`, `1D`). Toggle SMA(20), EMA(20), VWAP, and Bollinger Bands with the buttons above the chart. The candle series keeps the last 500 bars per symbol-timeframe combination.

4. **Analytics panel (bottom strip):** Seven tabs — RSI, MACD, Bollinger, VWAP, Latency, Throughput, Queue. RSI shows horizontal lines at 70 (overbought) and 30 (oversold). MACD shows the histogram alongside the signal and MACD lines. All panels update on the same ~2 s analytics recompute cycle.

5. **Order book (right panel):** Live bid and ask levels with a depth bar showing relative volume on each side. Below that is the trades tape — a scrolling list of recent fills with price, quantity, side, and timestamp.

---

## API reference

This project has no HTTP API. The table below documents the public C++ interfaces that a WebSocket server layer would call.

### `StreamProcessor`

| Method | Signature | Description |
|---|---|---|
| `initialize` | `(vector<string> symbols)` | Creates an `OrderBook` and analytics entry for each symbol; resets metrics. Must be called before `start`. |
| `start` | `()` | Starts the feed thread and N worker threads. |
| `stop` | `()` | Sets `running = false`, wakes sleeping consumers via CV, joins all threads. |
| `getOrderBook` | `(string symbol) → shared_ptr<OrderBook>` | Returns the live order book for a symbol, or `nullptr` if unknown. |
| `getAnalytics` | `() → shared_ptr<Analytics>` | Shared analytics engine used by all worker threads. |
| `getMetrics` | `() → PerformanceMetrics` | Thread-safe copy of current throughput and latency stats. |
| `submitOrder` | `(Order)` | Adds an order to the symbol's `OrderBook` directly (bypasses matching engine). |
| `cancelOrder` | `(orderId, symbol, isBuy)` | Removes a resting order from the `OrderBook` by ID. |

### `MatchingEngine`

| Method | Signature | Description |
|---|---|---|
| `submitOrder` | `(Order) → vector<Trade>` | Matches against resting orders at crossing prices; rests any unfilled remainder. Returns all fills generated. |
| `cancelOrder` | `(orderId, symbol, isBuy) → bool` | Removes a resting order. Returns `false` if not found. |
| `bestBid` | `(symbol) → double` | Best bid price, or 0.0 if the bid side is empty. |
| `bestAsk` | `(symbol) → double` | Best ask price, or 0.0 if the ask side is empty. |
| `getRecentTrades` | `(count=20) → vector<Trade>` | Last N fills from the trade history log. |

**Example: placing crossing orders**

```cpp
MatchingEngine engine;

// Two resting orders — no cross yet
engine.submitOrder(Order("B1", "AAPL", 100.00, 200, 1, /*isBuy=*/true));
engine.submitOrder(Order("A1", "AAPL", 101.00, 100, 2, false));
// bestBid=100, bestAsk=101 — $1 spread, nothing fills

// Aggressive sell at $99 crosses the $100 bid
auto trades = engine.submitOrder(Order("S1", "AAPL", 99.00, 250, 3, false));
// → 1 trade: qty=200 @ 100.00  (fills B1 entirely, trade price = resting bid)
//   50 shares of S1 rest in ask book at 99.00
```

### `Analytics`

| Method | Returns | Description |
|---|---|---|
| `updateTick(symbol, price, volume)` | void | Push a new price/volume; updates circular buffer and streaming MACD state. Call on every tick. |
| `calculateSMA(symbol, window)` | double | Simple moving average over last `window` prices. |
| `getShortTermSMA(symbol)` | double | SMA(20). |
| `getMediumTermSMA(symbol)` | double | SMA(50). |
| `getLongTermSMA(symbol)` | double | SMA(200) — O(1) via running sum. |
| `calculateEMA(symbol, window, alpha)` | double | Exponential MA with explicit smoothing factor `alpha`. |
| `calculateVWAP(symbol, window)` | double | Volume-weighted average price over last `window` ticks. |
| `calculateRSI(symbol, period=14)` | `RSIResult` | Wilder's RSI. `isOverbought` when value > 70; `isOversold` when < 30. Returns 50 when insufficient data. |
| `calculateMACD(symbol)` | `MACDResult` | EMA(12)−EMA(26) MACD line, EMA(9) signal line, histogram. O(1) — reads streaming state. |
| `calculateBollingerBands(symbol, period=20)` | `BollingerBands` | Middle (SMA), upper/lower (±2σ), bandwidth `(upper−lower)/middle`. |
| `addAlert(PriceAlert)` | void | Register a price threshold alert. |
| `checkAlerts(symbol, price)` | `vector<PriceAlert>` | Returns alerts that just triggered. Each alert fires at most once. |
| `clearTriggeredAlerts` | void | Removes all alerts that have already fired. |

---

## Data layout

There is no database. All state lives in memory for the duration of the process.

### C++ in-memory structures

| Structure | Location | What it stores |
|---|---|---|
| `LockFreeQueue<TickData, 65536>` | `MarketDataFeed` | Ring buffer of unprocessed ticks between the feed thread and worker threads. 65,536 slots = ~81 seconds of headroom at 8 symbols × 100 ticks/s. |
| `CircularBuffer(200)` prices | `Analytics` per symbol | Last 200 prices; maintains a running sum for O(1) full-window SMA. |
| `CircularBuffer(200)` volumes | `Analytics` per symbol | Last 200 volumes; used for VWAP calculation. |
| `SymbolState` | `Analytics` per symbol | `ema12`, `ema26`, `signalLine`, `macdLine`, `tickCount` — streaming MACD state updated on every tick. |
| `map<double, PriceLevel, greater>` bids | `OrderBook` | Bid price levels sorted highest-first. Each `PriceLevel` holds a `vector<Order>` and a total quantity sum. |
| `map<double, PriceLevel>` asks | `OrderBook` | Ask price levels sorted lowest-first. |
| `unordered_map<string, double>` orderIndex | `OrderBook` | `orderId → price` for O(1) cancellation lookup. |
| `map<double, deque<Order>, greater>` bidBooks | `MatchingEngine` | Per-symbol bid side. `deque` preserves arrival order for FIFO time priority. |
| `map<double, deque<Order>>` askBooks | `MatchingEngine` | Per-symbol ask side. |
| `vector<Trade>` tradeHistory | `MatchingEngine` | Append-only log of every fill. |
| `PerformanceMetrics` | `StreamProcessor` | Cumulative moving average latency, peak latency, tick count, throughput (ticks/s). |

### Frontend Zustand stores

| Store | Key state |
|---|---|
| `marketStore` | `candles: Record<"SYMBOL:timeframe", OHLCVCandle[]>` (capped at 500 per key), `lastPrices`, `analytics` per symbol, `priceHistory` (last 120 data points per symbol for sparklines), `showSMA/EMA/Bollinger/VWAP` toggle flags. |
| `orderbookStore` | `snapshots: Record<symbol, OrderBookSnapshot>`, `trades: Record<symbol, TradeRecord[]>` (last 100 trades per symbol). |
| `metricsStore` | `metrics: PerformanceMetrics`, `latencyHistory` (last 60 values), `throughputHistory` (last 60 values), `connectionState`. |

---

## Key design decisions

### Lock-free queue (Dmitry Vyukov MPMC)

`LockFreeQueue` ([include/LockFreeQueue.h](include/LockFreeQueue.h)) is an implementation of Dmitry Vyukov's bounded MPMC queue. Each slot has a sequence number stored in its own 64-byte `alignas(64)` cache line, so producers and consumers can advance their positions without invalidating each other's cache lines. The enqueue and dequeue positions are also on separate cache lines (`alignas(64)`) to prevent false sharing between the feed thread and the worker threads.

The capacity must be a power of 2 (checked via `static_assert`). The `MASK = Capacity - 1` trick replaces modulo arithmetic with a bitwise AND on the hot path.

### MACD as O(1) streaming state

A naïve MACD implementation would scan the last 26 prices on every call — O(n). Instead, `Analytics` maintains three doubles per symbol (`ema12`, `ema26`, `signalLine`) and updates them with each call to `updateTick` using the standard EMA recurrence: `ema = alpha * price + (1 - alpha) * ema`. `calculateMACD()` just reads those three values under a mutex. The benchmark reports ~10 ns/op for MACD vs ~18 ns/op for a windowed SMA(20) scan.

### CircularBuffer with incremental running sum

`CircularBuffer::push()` maintains a `runningSum` field. When the buffer is full, it subtracts the evicted value and adds the new one: two arithmetic ops instead of an O(n) loop. `getLongTermSMA()` divides `runningSum` by the buffer size — O(1). Partial-window SMA (before warmup completes) still loops, but that only applies during the first 200 ticks.

### OrderBook uses a hash index for O(1) removal

Without the `orderIndex` map, cancelling an order requires scanning every price level to find the order ID — O(levels × orders per level). The index maps `orderId → price`, so removal is: one O(1) hash lookup to find the price, one O(log n) `std::map` lookup to find the level, then a linear scan of only that level's orders. Levels typically hold few orders, so the inner scan is negligible.

### Price-time priority matching

`MatchingEngine` stores each price level's orders in a `std::deque`. New orders are `push_back`; fills come from `pop_front`. This gives strict time priority within a price level — an earlier order always fills before a later one at the same price.

Trade price is always the **resting order's price** (the passive side). If an aggressive sell at $99 crosses a resting bid at $100, the fill happens at $100. This matches how real exchange matching works.

### Frontend: 100 ms UI interval vs 10 ms backend rate

The mock tick loop fires every 100 ms even though the backend model runs at 10 ms. Calling React `setState` 800 times per second (8 symbols × 100 Hz) would cause excessive re-renders. The 100 ms cadence fires once and processes all 8 symbols in a single pass, then lets Zustand batch the resulting store updates into one React render cycle.

Analytics recompute is further gated at 5% probability per tick to keep indicator panels from re-rendering on every pass. This gives roughly one analytics update per symbol every 2 seconds.

### Cache-line isolation in StreamProcessor

`std::atomic<bool> running` and `PerformanceMetrics metrics` are each decorated with `alignas(64)` in `StreamProcessor`. The `running` flag is read by every worker thread on every loop iteration; `metrics` is written by every worker thread after every tick. Putting them on separate cache lines prevents the CPU from stalling workers when the metrics struct is updated.

---

## Testing

```bash
make test       # build and run unit tests
make benchmark  # build and run benchmarks
```

### Unit tests (`tests/tests.cpp`)

| Suite | What is verified |
|---|---|
| `CircularBuffer` | Push/pop; wrap-around eviction; running sum stays correct after wrap. |
| `OrderBook` | Empty book returns 0; best bid/ask update after adds; depth aggregation across levels; remove updates best price; `clear` empties the book. |
| `Analytics — SMA/EMA/VWAP` | SMA over full and partial windows; VWAP equals SMA when all volumes are equal; EMA stays between first and last price; `getChangePercent` arithmetic; high/low extraction; unknown symbol returns 0. |
| `Analytics — RSI` | Returns 50 (neutral) when fewer than `period+1` prices exist; monotonically rising prices produce RSI > 70 with `isOverbought = true`; falling prices produce RSI < 30 with `isOversold = true`. |
| `Analytics — MACD` | No data returns zeros; rising prices → positive MACD line; falling prices → negative MACD line; `histogram == macdLine − signalLine` identity. |
| `Analytics — Bollinger` | `upper > middle > lower` with volatile prices; constant price collapses all three bands to the same value with zero bandwidth. |
| `MatchingEngine` | No resting orders → order rests, no trades; non-crossing bid and ask coexist; crossing order produces fill at resting price; partial fill leaves remainder in book; multi-level fill generates one trade per price level; bid book empties correctly; cancel found / cancel non-existent order. |
| `Analytics — Price Alerts` | Mid-range price triggers no alerts; price crossing threshold triggers once; same alert does not re-fire; `clearTriggeredAlerts` removes all triggered alerts. |

The test runner (`tests/TestRunner.h`) is a 50-line header-only framework. It prints each assertion in green (PASS) or red (FAIL) with the file and line number, and exits with code 1 if any assertion fails.

### Benchmarks (`tests/benchmark.cpp`)

The benchmarks use `-O3 -march=native`. Representative results on Apple M-series hardware:

| Benchmark | Iterations | ~ns/op | ~M-ops/s |
|---|---|---|---|
| `LockFreeQueue` SPSC round-trip | 2 M | 11 | 90 |
| `Analytics::updateTick` | 500 K | 67 | 15 |
| `calculateSMA(20)` | 500 K | 18 | 54 |
| `getLongTermSMA` (O(1) running sum) | 500 K | 12 | 83 |
| `calculateMACD` (O(1) streaming) | 500 K | 10 | 100 |
| `calculateRSI(14)` | 500 K | 85 | 12 |
| `calculateBollingerBands(20)` | 500 K | 38 | 26 |
| `OrderBook::addOrder` | 200 K | 306 | 3 |
| `OrderBook::removeOrder` | 200 K | 380 | 3 |
| `MatchingEngine::submitOrder` (mixed) | 100 K | 160 | 6 |

---

## Project structure

```
.
├── config.ini                     # Runtime config: symbols, threads, log level, alerts
├── Makefile                       # Primary build system
├── CMakeLists.txt                 # Alternative CMake build
│
├── include/                       # All headers — declarations, templates, macros
│   ├── LockFreeQueue.h            # Vyukov MPMC ring buffer (template, header-only)
│   ├── MarketDataFeed.h           # TickData struct + feed class interface
│   ├── OrderBook.h                # Order, PriceLevel, OrderBook
│   ├── Analytics.h                # CircularBuffer, RSIResult, MACDResult, BollingerBands, Analytics
│   ├── MatchingEngine.h           # Trade struct + MatchingEngine
│   ├── StreamProcessor.h          # PerformanceMetrics + StreamProcessor
│   ├── Config.h                   # Singleton INI loader with typed accessors
│   └── Logger.h                   # Singleton logger + LOG_DEBUG/INFO/WARN/ERROR macros
│
├── src/                           # Implementation (.cpp) files
│   ├── main.cpp                   # Entry point: loads config, runs 30 s demo, prints final report
│   ├── MarketDataFeed.cpp         # simulateFeed() Gaussian random walk; Alpha Vantage/Yahoo stubs
│   ├── OrderBook.cpp              # add/remove/update/query with per-book mutex
│   ├── Analytics.cpp              # CircularBuffer, all indicator calculations
│   ├── MatchingEngine.cpp         # matchBuy/matchSell with price-time priority
│   ├── StreamProcessor.cpp        # processingLoop, processTick, cumulative metrics
│   ├── Config.cpp                 # INI parser: sections, inline comments, typed getters
│   └── Logger.cpp                 # Thread-safe logger with ANSI colour output + optional file
│
├── tests/
│   ├── TestRunner.h               # 50-line header-only test framework (EXPECT_* macros)
│   ├── tests.cpp                  # Unit tests for all components
│   └── benchmark.cpp              # Throughput benchmarks for every hot path
│
├── bin/                           # Compiled binaries (produced by make)
│   ├── market_data_processor
│   └── run_tests
│
└── frontend/                      # Next.js trading dashboard
    ├── .env.local                 # NEXT_PUBLIC_USE_MOCK=true (no backend required)
    ├── app/
    │   ├── layout.tsx             # Root layout, dark background (#0d0f12)
    │   └── page.tsx               # TradingDashboard: wires useDataStreams + keyboard shortcuts
    ├── components/
    │   ├── StatusBar/             # Top bar: connection state, symbol, throughput, latency
    │   ├── Sidebar/               # Watchlist with search, symbol rows, price/change
    │   ├── Chart/                 # Candlestick chart (Lightweight Charts), toolbar, price ticker
    │   ├── OrderBook/             # Bid/ask depth table, pressure bar, trades tape
    │   └── Analytics/             # RSI, MACD, Bollinger, VWAP, Latency, Throughput, Queue widgets
    ├── lib/
    │   ├── types.ts               # TypeScript interfaces mirroring all C++ structs
    │   ├── websocket/
    │   │   └── useDataStreams.ts  # Tick/metrics/orderbook intervals; switches mock ↔ live via env var
    │   └── mock/
    │       ├── marketSimulator.ts  # Ornstein–Uhlenbeck price simulation + OHLCV candle aggregation
    │       ├── orderbookSimulator.ts # Synthetic bid/ask level snapshots
    │       ├── metricsSimulator.ts   # Simulated latency/throughput metrics
    │       └── tradesSimulator.ts    # Individual trade records for the tape
    └── store/
        ├── marketStore.ts         # Candles, analytics, last prices, indicator toggle flags
        ├── orderbookStore.ts      # Order book snapshots + rolling trade tape
        └── metricsStore.ts        # Performance metrics + time-series history (last 60 s)
```

---

## Common issues

### `config.ini not found — using built-in defaults`
The binary searches for `config.ini` in the **current working directory**, not the directory the binary lives in. Use `make run` (which runs from the project root) or `cd` to the project root before running `./bin/market_data_processor` directly.

### Build fails: `error: 'shared_mutex' is not a member of 'std'`
The project requires C++17. Check your compiler: `g++ --version`. On macOS the system `g++` command is actually Apple Clang; try `brew install gcc` then `CXX=g++-14 make`.

### Build fails on Linux: linker error for `-lpthread`
Install the development headers: `sudo apt-get install build-essential`.

### Frontend: `Cannot find module '@/...'`
Run `npm install` inside the `frontend/` directory. The `@/` path alias is resolved via `tsconfig.json` from `frontend/` as the root. Running `npm install` from the project root won't work.

### Analytics panel shows zeroes for several seconds after launch
This is expected. RSI needs at least `period + 1 = 15` prices; MACD needs at least 2 ticks to have non-zero EMA state; Bollinger needs at least 2 prices. All indicators return safe zero or neutral values during warmup. The mock simulator seeds 300 historical candles at startup, so by the time the dashboard renders, enough data should exist — but the analytics recompute is probabilistic (5% per tick), so you may see a brief delay before the first update fires.

### Price alerts never trigger in the C++ backend
Alert keys in `config.ini` are stored lowercase internally. The section must be `[alerts]` and keys must follow the `SYMBOL_above` / `SYMBOL_below` pattern (e.g. `AAPL_above = 200.0`). The parser lower-cases everything, so `aapl_above = 200.0` also works. Verify the value is a positive float, not zero.

### `make benchmark` shows unexpectedly low throughput
Ensure you are not running a debug build. `make clean && make benchmark` forces a fresh release build with `-O3 -march=native`. Running under a profiler (Instruments, perf), inside a VM, or with thermal throttling active will also reduce measured throughput significantly.
