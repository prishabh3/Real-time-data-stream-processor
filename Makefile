# Compiler
CXX = g++

# Compiler flags
CXXFLAGS = -std=c++17 -Wall -Wextra -O3 -march=native -pthread

# Directories
IDIR = include
SRCDIR = src
OBJDIR = obj
BINDIR = bin

# Include flags
INCLUDES = -I$(IDIR)

# Source files
SOURCES = $(wildcard $(SRCDIR)/*.cpp)

# Object files
OBJECTS = $(patsubst $(SRCDIR)/%.cpp,$(OBJDIR)/%.o,$(SOURCES))

# Target executable
TARGET = $(BINDIR)/market_data_processor

# Default target
all: directories $(TARGET)

# Create necessary directories
directories:
	@mkdir -p $(OBJDIR)
	@mkdir -p $(BINDIR)

# Link object files to create executable
$(TARGET): $(OBJECTS)
	$(CXX) $(CXXFLAGS) $(OBJECTS) -o $(TARGET)
	@echo "Build complete: $(TARGET)"

# Compile source files to object files
$(OBJDIR)/%.o: $(SRCDIR)/%.cpp
	$(CXX) $(CXXFLAGS) $(INCLUDES) -c $< -o $@

# Clean build artifacts
clean:
	rm -rf $(OBJDIR) $(BINDIR)
	@echo "Clean complete"

# Run the application
run: all
	./$(TARGET)

# Debug build
debug: CXXFLAGS = -std=c++17 -Wall -Wextra -g -O0 -pthread
debug: clean all

# Performance build (maximum optimization)
performance: CXXFLAGS = -std=c++17 -Wall -Wextra -O3 -march=native -pthread -DNDEBUG -flto
performance: clean all

.PHONY: all clean run debug performance directories
