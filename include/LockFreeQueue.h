#ifndef LOCKFREEQUEUE_H
#define LOCKFREEQUEUE_H

#include <atomic>
#include <array>
#include <cstddef>
#include <type_traits>

namespace MarketData {

// Dmitry Vyukov's bounded MPMC queue.
// Capacity must be a power of 2.
// tryPush returns false if full; tryPop returns false if empty.
template<typename T, size_t Capacity>
class LockFreeQueue {
    static_assert((Capacity & (Capacity - 1)) == 0,
                  "LockFreeQueue: Capacity must be a power of 2");

    struct alignas(64) Slot {
        std::atomic<size_t> seq{0};
        T data;
    };

    static constexpr size_t MASK = Capacity - 1;

    alignas(64) std::array<Slot, Capacity> slots_;
    alignas(64) std::atomic<size_t> enqPos_{0};
    alignas(64) std::atomic<size_t> deqPos_{0};

public:
    LockFreeQueue() {
        for (size_t i = 0; i < Capacity; ++i)
            slots_[i].seq.store(i, std::memory_order_relaxed);
    }

    LockFreeQueue(const LockFreeQueue&) = delete;
    LockFreeQueue& operator=(const LockFreeQueue&) = delete;

    bool tryPush(T item) {
        size_t pos = enqPos_.load(std::memory_order_relaxed);
        for (;;) {
            Slot& slot = slots_[pos & MASK];
            size_t seq = slot.seq.load(std::memory_order_acquire);
            intptr_t diff = static_cast<intptr_t>(seq) - static_cast<intptr_t>(pos);
            if (diff == 0) {
                if (enqPos_.compare_exchange_weak(pos, pos + 1,
                                                   std::memory_order_relaxed)) {
                    slot.data = std::move(item);
                    slot.seq.store(pos + 1, std::memory_order_release);
                    return true;
                }
            } else if (diff < 0) {
                return false; // full
            } else {
                pos = enqPos_.load(std::memory_order_relaxed);
            }
        }
    }

    bool tryPop(T& item) {
        size_t pos = deqPos_.load(std::memory_order_relaxed);
        for (;;) {
            Slot& slot = slots_[pos & MASK];
            size_t seq = slot.seq.load(std::memory_order_acquire);
            intptr_t diff = static_cast<intptr_t>(seq) - static_cast<intptr_t>(pos + 1);
            if (diff == 0) {
                if (deqPos_.compare_exchange_weak(pos, pos + 1,
                                                   std::memory_order_relaxed)) {
                    item = std::move(slot.data);
                    slot.seq.store(pos + Capacity, std::memory_order_release);
                    return true;
                }
            } else if (diff < 0) {
                return false; // empty
            } else {
                pos = deqPos_.load(std::memory_order_relaxed);
            }
        }
    }

    size_t size() const {
        size_t enq = enqPos_.load(std::memory_order_relaxed);
        size_t deq = deqPos_.load(std::memory_order_relaxed);
        return enq > deq ? enq - deq : 0;
    }
};

} // namespace MarketData

#endif // LOCKFREEQUEUE_H
