#ifndef LOGGER_H
#define LOGGER_H

#include <atomic>
#include <fstream>
#include <mutex>
#include <sstream>
#include <string>

namespace MarketData {

enum class LogLevel : int { DEBUG = 0, INFO = 1, WARN = 2, ERROR = 3 };

class Logger {
public:
    static Logger& instance() {
        static Logger inst;
        return inst;
    }

    Logger(const Logger&)            = delete;
    Logger& operator=(const Logger&) = delete;

    void setLevel(LogLevel lvl) {
        minLevel.store(static_cast<int>(lvl), std::memory_order_relaxed);
    }
    void setLevel(const std::string& lvl); // "DEBUG"|"INFO"|"WARN"|"ERROR"
    void openFile(const std::string& path);

    // Fast pre-check so the macro skips ostringstream construction when filtered
    bool shouldLog(LogLevel lvl) const {
        return static_cast<int>(lvl) >= minLevel.load(std::memory_order_relaxed);
    }

    void log(LogLevel lvl, const std::string& msg,
             const char* file = nullptr, int line = 0);

private:
    Logger() = default;

    std::atomic<int> minLevel{static_cast<int>(LogLevel::INFO)};
    std::ofstream    fileStream;
    std::mutex       logMutex;

    static std::string makeTimestamp();
    static const char* levelTag(LogLevel lvl);
    static const char* levelColor(LogLevel lvl);
    static const char* basename(const char* path);
};

} // namespace MarketData

// Stream-style macros — usage: LOG_INFO("tick " << sym << " @ " << price)
// The shouldLog guard avoids building the ostringstream when level is filtered.
#define LOG_DEBUG(msg) do { \
    auto& _lg = ::MarketData::Logger::instance(); \
    if (_lg.shouldLog(::MarketData::LogLevel::DEBUG)) { \
        std::ostringstream _s; _s << msg; \
        _lg.log(::MarketData::LogLevel::DEBUG, _s.str(), __FILE__, __LINE__); \
    } \
} while(0)

#define LOG_INFO(msg) do { \
    auto& _lg = ::MarketData::Logger::instance(); \
    if (_lg.shouldLog(::MarketData::LogLevel::INFO)) { \
        std::ostringstream _s; _s << msg; \
        _lg.log(::MarketData::LogLevel::INFO, _s.str(), __FILE__, __LINE__); \
    } \
} while(0)

#define LOG_WARN(msg) do { \
    auto& _lg = ::MarketData::Logger::instance(); \
    if (_lg.shouldLog(::MarketData::LogLevel::WARN)) { \
        std::ostringstream _s; _s << msg; \
        _lg.log(::MarketData::LogLevel::WARN, _s.str(), __FILE__, __LINE__); \
    } \
} while(0)

#define LOG_ERROR(msg) do { \
    auto& _lg = ::MarketData::Logger::instance(); \
    if (_lg.shouldLog(::MarketData::LogLevel::ERROR)) { \
        std::ostringstream _s; _s << msg; \
        _lg.log(::MarketData::LogLevel::ERROR, _s.str(), __FILE__, __LINE__); \
    } \
} while(0)

#endif // LOGGER_H
