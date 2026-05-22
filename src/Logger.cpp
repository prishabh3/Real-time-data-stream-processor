#include "Logger.h"
#include <chrono>
#include <cstring>
#include <ctime>
#include <iomanip>
#include <iostream>

namespace MarketData {

// ── Public API ────────────────────────────────────────────────────────────────

void Logger::setLevel(const std::string& lvl) {
    if      (lvl == "DEBUG") setLevel(LogLevel::DEBUG);
    else if (lvl == "INFO")  setLevel(LogLevel::INFO);
    else if (lvl == "WARN")  setLevel(LogLevel::WARN);
    else if (lvl == "ERROR") setLevel(LogLevel::ERROR);
}

void Logger::openFile(const std::string& path) {
    std::lock_guard<std::mutex> lock(logMutex);
    fileStream.open(path, std::ios::app);
}

void Logger::log(LogLevel lvl, const std::string& msg,
                 const char* file, int line) {
    std::ostringstream entry;
    entry << "[" << makeTimestamp() << "] "
          << "[" << levelTag(lvl) << "] ";

    // For WARN and ERROR include the source location
    if (file && lvl >= LogLevel::WARN)
        entry << "[" << basename(file) << ":" << line << "] ";

    entry << msg;
    std::string text = entry.str();

    std::lock_guard<std::mutex> lock(logMutex);

    std::cerr << levelColor(lvl) << text << "\033[0m\n";

    if (fileStream.is_open()) {
        fileStream << text << '\n';
        fileStream.flush();
    }
}

// ── Private helpers ───────────────────────────────────────────────────────────

std::string Logger::makeTimestamp() {
    using namespace std::chrono;
    auto now = system_clock::now();
    auto ms  = duration_cast<milliseconds>(now.time_since_epoch()) % 1000;
    std::time_t t = system_clock::to_time_t(now);

    struct tm buf{};
#ifdef _WIN32
    localtime_s(&buf, &t);
#else
    localtime_r(&t, &buf);
#endif

    std::ostringstream oss;
    oss << std::put_time(&buf, "%H:%M:%S")
        << '.' << std::setfill('0') << std::setw(3) << ms.count();
    return oss.str();
}

const char* Logger::levelTag(LogLevel lvl) {
    switch (lvl) {
        case LogLevel::DEBUG: return "DEBUG";
        case LogLevel::INFO:  return "INFO ";
        case LogLevel::WARN:  return "WARN ";
        case LogLevel::ERROR: return "ERROR";
        default:              return "?????";
    }
}

// ANSI colour codes — reset applied by caller after the message
const char* Logger::levelColor(LogLevel lvl) {
    switch (lvl) {
        case LogLevel::DEBUG: return "\033[90m";  // dark grey
        case LogLevel::INFO:  return "\033[0m";   // default
        case LogLevel::WARN:  return "\033[33m";  // yellow
        case LogLevel::ERROR: return "\033[31m";  // red
        default:              return "\033[0m";
    }
}

const char* Logger::basename(const char* path) {
    const char* s = std::strrchr(path, '/');
    return s ? s + 1 : path;
}

} // namespace MarketData
