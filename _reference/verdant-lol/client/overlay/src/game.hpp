#pragma once

#include <cstdint>
#include "memory.hpp"

namespace verdant {

struct GameState {
    int health = 0;
    uintptr_t humanoid = 0;
};

GameState readGame(MemoryBackend& mem, uint32_t pid);

}