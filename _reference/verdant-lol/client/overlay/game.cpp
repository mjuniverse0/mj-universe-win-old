#include "game.hpp"
#include "offsets.hpp"

namespace verdant {

GameState readGame(MemoryBackend& mem, uint32_t pid) {
    GameState s{};

    uintptr_t base = getModuleBase(pid);
    if (!base) return s;

    // 🔹 VisualEngine
    uintptr_t visualEngine = 0;
    if (!mem.read(base + offsets::VisualEnginePointer, &visualEngine, sizeof(visualEngine)))
        return s;

    // 🔹 DataModel
    uintptr_t datamodel = 0;
    if (!mem.read(visualEngine + offsets::FakeDataModelToDataModel, &datamodel, sizeof(datamodel)))
        return s;

    // 🔹 LocalPlayer
    uintptr_t localPlayer = 0;
    if (!mem.read(datamodel + offsets::LocalPlayer, &localPlayer, sizeof(localPlayer)))
        return s;

    // 🔹 Character / HumanoidRootPart (forenklet chain)
    uintptr_t humanoid = 0;
    mem.read(localPlayer + offsets::HumanoidRootPart, &humanoid, sizeof(humanoid));

    s.humanoid = humanoid;

    // 🔹 Health
    mem.read(humanoid + offsets::Health, &s.health, sizeof(s.health));

    return s;
}

}