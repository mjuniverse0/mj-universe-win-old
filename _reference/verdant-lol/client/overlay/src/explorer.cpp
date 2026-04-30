#include "explorer.hpp"
#include "offsets.hpp"

#include <iostream>
#include <iomanip>

namespace verdant {

std::string readString(MemoryBackend& mem, uintptr_t strPtr) {
    if (!strPtr) return "";

    int length = 0;
    if (!mem.read(strPtr + offsets::StringLength, &length, sizeof(length)))
        return "";

    // sanity check
    if (length <= 0 || length > 200)
        return "";

    char buffer[256]{};

    if (!mem.read(strPtr, buffer, length))
        return "";

    return std::string(buffer, length);
}

std::vector<Instance> getChildren(MemoryBackend& mem, uintptr_t instance) {
    std::vector<Instance> out;

    if (!instance) return out;

    uintptr_t childrenStart = 0;
    if (!mem.read(instance + offsets::datamodel::Children,
                  &childrenStart, sizeof(childrenStart)))
        return out;

    uintptr_t childrenEnd = 0;
    if (!mem.read(childrenStart + offsets::datamodel::ChildrenEnd,
                  &childrenEnd, sizeof(childrenEnd)))
        return out;

    // sanity
    if (!childrenStart || !childrenEnd || childrenEnd < childrenStart)
        return out;

    for (uintptr_t current = childrenStart;
         current < childrenEnd;
         current += sizeof(uintptr_t)) {

        uintptr_t child = 0;
        if (!mem.read(current, &child, sizeof(child)))
            continue;

        if (!child) continue;

        Instance inst{};
        inst.address = child;

        // 🔹 Name
        uintptr_t namePtr = 0;
        if (mem.read(child + offsets::datamodel::Name,
                     &namePtr, sizeof(namePtr))) {
            inst.name = readString(mem, namePtr);
        }

        // 🔹 Class
        uintptr_t classDesc = 0;
        if (mem.read(child + offsets::datamodel::ClassDescriptor,
                     &classDesc, sizeof(classDesc))) {

            uintptr_t classNamePtr = 0;
            if (mem.read(classDesc + offsets::datamodel::ClassDescriptorToClassName,
                         &classNamePtr, sizeof(classNamePtr))) {

                inst.className = readString(mem, classNamePtr);
            }
        }

        out.push_back(inst);
    }

    return out;
}

void dumpDataModel(MemoryBackend& mem, uint32_t pid) {
    uintptr_t base = getModuleBase(pid);
    if (!base) {
        std::cout << "[explorer] no module base\n";
        return;
    }

    // 🔹 VisualEngine
    uintptr_t visualEngine = 0;
    if (!mem.read(base + offsets::engine::VisualEnginePointer,
                  &visualEngine, sizeof(visualEngine))) {
        std::cout << "[explorer] failed VisualEngine\n";
        return;
    }

    // 🔹 DataModel
    uintptr_t dataModel = 0;
    if (!mem.read(visualEngine + offsets::engine::FakeDataModelToDataModel,
                  &dataModel, sizeof(dataModel))) {
        std::cout << "[explorer] failed DataModel\n";
        return;
    }

    std::cout << "[DataModel] 0x"
              << std::hex << dataModel << std::dec << "\n";

    // 🔹 Workspace
    uintptr_t workspace = 0;
    if (!mem.read(dataModel + offsets::datamodel::Workspace,
                  &workspace, sizeof(workspace))) {
        std::cout << "[explorer] failed Workspace\n";
        return;
    }

    std::cout << "Workspace: 0x"
              << std::hex << workspace << std::dec << "\n";

    // 🔹 Children
    auto children = getChildren(mem, workspace);

    std::cout << "Children count: " << children.size() << "\n";

    for (const auto& c : children) {
        std::cout << "[0x" << std::hex << c.address << std::dec << "] "
                  << (c.className.empty() ? "?" : c.className)
                  << " : "
                  << (c.name.empty() ? "?" : c.name)
                  << "\n";
    }
}

}