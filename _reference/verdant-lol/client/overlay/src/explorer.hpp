#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include "memory.hpp"

namespace verdant {

struct Instance {
    uintptr_t address = 0;
    std::string name;
    std::string className;
};

// Leser Roblox string (basic, ikke full RBX string impl)
std::string readString(MemoryBackend& mem, uintptr_t strPtr);

// Leser children-array til en instance
std::vector<Instance> getChildren(MemoryBackend& mem, uintptr_t instance);

// Entry point (debug dump)
void dumpDataModel(MemoryBackend& mem, uint32_t pid);

}