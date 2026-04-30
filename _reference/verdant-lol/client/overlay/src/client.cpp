#include "offsets.hpp"
#include "memory.hpp"

namespace verdant {

int getHealth(MemoryBackend& mem, uintptr_t moduleBase) {
    uintptr_t player = 0;

    mem.read(moduleBase + offsets::LOCAL_PLAYER, &player, sizeof(player));

    int health = 0;
    mem.read(player + offsets::HEALTH, &health, sizeof(health));

    return health;
}

}