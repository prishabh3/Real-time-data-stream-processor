cmake_minimum_required(VERSION 3.10)
project(MarketDataProcessor VERSION 1.0 LANGUAGES CXX)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler flags for optimization
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra")
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -DNDEBUG -march=native")
set(CMAKE_CXX_FLAGS_DEBUG "-g -O0")

# Include directories
include_directories(${PROJECT_SOURCE_DIR}/include)

# Source files
set(SOURCES
    src/OrderBook.cpp
    src/MarketDataFeed.cpp
    src/Analytics.cpp
    src/StreamProcessor.cpp
    src/main.cpp
)

# Create executable
add_executable(market_data_processor ${SOURCES})

# Link threading library
find_package(Threads REQUIRED)
target_link_libraries(market_data_processor Threads::Threads)

# Installation
install(TARGETS market_data_processor DESTINATION bin)

# Print build information
message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "C++ Compiler: ${CMAKE_CXX_COMPILER}")
message(STATUS "C++ Standard: ${CMAKE_CXX_STANDARD}")
