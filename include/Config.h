#ifndef CONFIG_H
#define CONFIG_H

#include <string>
#include <unordered_map>
#include <vector>

namespace MarketData {

// Simple INI-file configuration loader.
// Keys are stored as "section.key" (lower-cased).
// Inline # comments are stripped. Blank lines and ; comments are skipped.
//
// Example config.ini:
//   [processor]
//   symbols = AAPL,GOOGL,MSFT
//   thread_count = 4
//
// Accessed as: Config::instance().getInt("processor.thread_count", 4)
class Config {
public:
    static Config& instance() {
        static Config inst;
        return inst;
    }

    Config(const Config&)            = delete;
    Config& operator=(const Config&) = delete;

    // Load from file. Returns false if file cannot be opened (defaults still work).
    bool loadFile(const std::string& path);

    std::string              getString(const std::string& key,
                                       const std::string& def = "") const;
    int                      getInt   (const std::string& key, int    def = 0)    const;
    double                   getDouble(const std::string& key, double def = 0.0)  const;
    bool                     getBool  (const std::string& key, bool   def = false) const;
    // Split a comma-separated (or custom-delimited) string value into a list.
    std::vector<std::string> getList  (const std::string& key, char delim = ',')  const;

    bool has(const std::string& key) const;

private:
    Config() = default;

    std::unordered_map<std::string, std::string> data;

    static std::string trim(const std::string& s);
    static std::string toLower(const std::string& s);
};

} // namespace MarketData

#endif // CONFIG_H
