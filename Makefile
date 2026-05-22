# Compiler
CXX = g++

# Compiler flags
CXXFLAGS = -std=c++17 -Wall -Wextra -O3 -march=native -pthread

# Directories
IDIR    = include
SRCDIR  = src
OBJDIR  = obj
BINDIR  = bin
TESTDIR = tests

# Include flags
INCLUDES = -I$(IDIR) -I$(TESTDIR)

# Source files (all .cpp in src/)
SOURCES = $(wildcard $(SRCDIR)/*.cpp)
OBJECTS = $(patsubst $(SRCDIR)/%.cpp,$(OBJDIR)/%.o,$(SOURCES))

# Lib objects: everything except main.o (shared by tests & benchmarks)
LIB_OBJECTS = $(filter-out $(OBJDIR)/main.o, $(OBJECTS))

# Targets
TARGET     = $(BINDIR)/market_data_processor
TEST_BIN   = $(BINDIR)/run_tests
BENCH_BIN  = $(BINDIR)/benchmark

# ── Default ───────────────────────────────────────────────────────────────────
all: directories $(TARGET)

directories:
	@mkdir -p $(OBJDIR) $(BINDIR)

$(TARGET): $(OBJECTS)
	$(CXX) $(CXXFLAGS) $(OBJECTS) -o $(TARGET)
	@echo "Build complete: $(TARGET)"

$(OBJDIR)/%.o: $(SRCDIR)/%.cpp
	$(CXX) $(CXXFLAGS) $(INCLUDES) -c $< -o $@

# ── Tests ─────────────────────────────────────────────────────────────────────
$(TEST_BIN): $(TESTDIR)/tests.cpp $(LIB_OBJECTS) | directories
	$(CXX) $(CXXFLAGS) $(INCLUDES) $^ -o $@

test: $(TEST_BIN)
	@echo ""
	./$(TEST_BIN)

# ── Benchmarks ────────────────────────────────────────────────────────────────
$(BENCH_BIN): $(TESTDIR)/benchmark.cpp $(LIB_OBJECTS) | directories
	$(CXX) $(CXXFLAGS) $(INCLUDES) $^ -o $@

benchmark: $(BENCH_BIN)
	@echo ""
	./$(BENCH_BIN)

# ── Utility ───────────────────────────────────────────────────────────────────
clean:
	rm -rf $(OBJDIR) $(BINDIR)
	@echo "Clean complete"

run: all
	./$(TARGET)

debug: CXXFLAGS = -std=c++17 -Wall -Wextra -g -O0 -pthread
debug: clean all

performance: CXXFLAGS = -std=c++17 -Wall -Wextra -O3 -march=native -pthread -DNDEBUG -flto
performance: clean all

.PHONY: all clean run debug performance directories test benchmark
