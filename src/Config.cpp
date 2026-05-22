#include "Config.h"
#include <algorithm>
#include <cctype>
#include <fstream>
#include <sstream>
#include <stdexcept>

namespace MarketData {

// ── File loading ──────────────────────────────────────────────────────────────

bool Config::loadFile(const std::string& path) {
    std::ifstream f(path);
    if (!f.is_open()) return false;

    std::string line, section;
    while (std::getline(f, line)) {
        line = trim(line);
        if (line.empty() || line[0] == ';') continue;  // blank / comment

        if (line[0] == '[') {
            // Section header: [processor]
            auto end = line.find(']');
            if (end != std::string::npos)
                section = toLower(trim(line.substr(1, end - 1)));
            continue;
        }

        auto eq = line.find('=');
        if (eq == std::string::npos) continue;

        std::string key = toLower(trim(line.substr(0, eq)));
        std::string val = trim(line.substr(eq + 1));

        // Strip inline # comments
        auto comment = val.find('#');
        if (comment != std::string::npos) val = trim(val.substr(0, comment));

        data[(section.empty() ? "" : section + ".") + key] = val;
    }
    return true;
}

// ── Typed accessors ───────────────────────────────────────────────────────────

bool Config::has(const std::string& key) const {
    return data.count(toLower(key)) > 0;
}

std::string Config::getString(const std::string& key,
                               const std::string& def) const {
    auto it = data.find(toLower(key));
    return it != data.end() ? it->second : def;
}

int Config::getInt(const std::string& key, int def) const {
    auto it = data.find(toLower(key));
    if (it == data.end()) return def;
    try { return std::stoi(it->second); }
    catch (...) { return def; }
}

double Config::getDouble(const std::string& key, double def) const {
    auto it = data.find(toLower(key));
    if (it == data.end()) return def;
    try { return std::stod(it->second); }
    catch (...) { return def; }
}

bool Config::getBool(const std::string& key, bool def) const {
    std::string s = toLower(getString(key));
    if (s == "true"  || s == "1" || s == "yes" || s == "on")  return true;
    if (s == "false" || s == "0" || s == "no"  || s == "off") return false;
    return def;
}

std::vector<std::string> Config::getList(const std::string& key,
                                          char delim) const {
    std::string s = getString(key);
    std::vector<std::string> result;
    if (s.empty()) return result;

    std::istringstream ss(s);
    std::string token;
    while (std::getline(ss, token, delim)) {
        auto t = trim(token);
        if (!t.empty()) result.push_back(t);
    }
    return result;
}

// ── Private helpers ───────────────────────────────────────────────────────────

std::string Config::trim(const std::string& s) {
    auto b = s.find_first_not_of(" \t\r\n");
    auto e = s.find_last_not_of(" \t\r\n");
    return (b == std::string::npos) ? "" : s.substr(b, e - b + 1);
}

std::string Config::toLower(const std::string& s) {
    std::string out = s;
    std::transform(out.begin(), out.end(), out.begin(),
                   [](unsigned char c){ return std::tolower(c); });
    return out;
}

} // namespace MarketData
