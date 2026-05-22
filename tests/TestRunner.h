#pragma once
#include <cmath>
#include <cstdio>
#include <functional>
#include <string>
#include <vector>

namespace Test {

struct Result { int passed = 0, failed = 0; };
static Result g_result;

inline void check(bool cond, const char* expr, const char* file, int line) {
    if (cond) {
        std::printf("  \033[32mPASS\033[0m  %s\n", expr);
        g_result.passed++;
    } else {
        std::printf("  \033[31mFAIL\033[0m  %s  (%s:%d)\n", expr, file, line);
        g_result.failed++;
    }
}

inline void suite(const char* name, std::function<void()> fn) {
    std::printf("\n\033[1m%s\033[0m\n", name);
    fn();
}

inline int summary() {
    int total = g_result.passed + g_result.failed;
    std::printf("\n─────────────────────────────────────\n");
    std::printf("  %d / %d tests passed", g_result.passed, total);
    if (g_result.failed == 0) std::printf("  \033[32m✓ all green\033[0m");
    else                      std::printf("  \033[31m%d failed\033[0m", g_result.failed);
    std::printf("\n─────────────────────────────────────\n");
    return g_result.failed == 0 ? 0 : 1;
}

} // namespace Test

#define EXPECT_TRUE(cond)          Test::check(!!(cond), #cond, __FILE__, __LINE__)
#define EXPECT_FALSE(cond)         Test::check(!(cond),  "!" #cond, __FILE__, __LINE__)
#define EXPECT_EQ(a, b)            Test::check((a)==(b), #a " == " #b, __FILE__, __LINE__)
#define EXPECT_NE(a, b)            Test::check((a)!=(b), #a " != " #b, __FILE__, __LINE__)
#define EXPECT_GT(a, b)            Test::check((a)>(b),  #a " > " #b,  __FILE__, __LINE__)
#define EXPECT_LT(a, b)            Test::check((a)<(b),  #a " < " #b,  __FILE__, __LINE__)
#define EXPECT_GE(a, b)            Test::check((a)>=(b), #a " >= " #b, __FILE__, __LINE__)
#define EXPECT_NEAR(a, b, eps)     Test::check(std::abs((double)(a)-(double)(b)) < (eps), \
                                               #a " ≈ " #b, __FILE__, __LINE__)
