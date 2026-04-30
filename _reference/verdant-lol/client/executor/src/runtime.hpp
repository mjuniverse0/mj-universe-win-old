#pragma once

#include <memory>
#include <string>

#include "memory.hpp"

namespace verdant {

struct RuntimeContext {
  // Memory backend the runtime may use to inspect/write the attached Roblox
  // process (kernel IOCTL bridge or RPM/WPM fallback). May be nullptr or
  // unattached - runtimes are expected to handle that.
  MemoryBackend* backend{nullptr};
  uintptr_t robloxBase{0};
  uint32_t robloxPid{0};
};

struct ScriptResult {
  bool success{false};
  std::string output;  // captured print() / stdout-style channel
  std::string error;
};

class LuaRuntime {
 public:
  virtual ~LuaRuntime() = default;

  // Returns a short human-readable identifier ("embedded-luau",
  // "kernel-injection", ...) used in /ack and logs.
  virtual std::string name() const = 0;

  // Whether this runtime is currently capable of running scripts. The
  // kernel-injection runtime, for example, requires an attached Roblox
  // process before it can deliver anything.
  virtual bool ready(const RuntimeContext& ctx) const = 0;

  virtual ScriptResult execute(const std::string& source, const RuntimeContext& ctx) = 0;
};

enum class RuntimeKind {
  Embedded,
  KernelInjection,
};

// Factory: returns nullptr if the requested kind is not compiled in.
std::unique_ptr<LuaRuntime> makeRuntime(RuntimeKind kind);

// Resolve a runtime kind from an environment string ("embedded", "kernel",
// "kernel-injection", "auto"). "auto" prefers Embedded if available.
RuntimeKind resolveRuntimeKind(const std::string& name);

}  // namespace verdant
