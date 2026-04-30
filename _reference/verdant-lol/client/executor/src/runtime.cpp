#include "runtime.hpp"

#include <algorithm>
#include <cctype>
#include <cstring>
#include <iostream>
#include <memory>
#include <sstream>

#ifdef VERDANT_HAVE_LUAU
#include <Luau/Compiler.h>
#include <lua.h>
#include <lualib.h>
#endif

namespace verdant {

namespace {

std::string toLower(std::string s) {
  std::transform(s.begin(), s.end(), s.begin(),
                 [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  return s;
}

#ifdef VERDANT_HAVE_LUAU

/* Minimal sandboxed Luau runtime.
 *
 * Compiles the incoming source to Luau bytecode in-process and runs it on a
 * private lua_State. Standard libraries are opened (math, string, table,
 * etc.) but `print` is replaced with a buffered version so the captured
 * output can be returned to the launcher / verdant.lol /ack endpoint.
 *
 * This runtime does *not* have access to Roblox-specific globals (game,
 * workspace, Instance, ...). It is useful for syntax validation, sandboxed
 * Lua execution, and as a baseline so the rest of the pipeline works
 * end-to-end while the in-process Roblox runtime is being implemented.
 */
class EmbeddedLuauRuntime final : public LuaRuntime {
 public:
  EmbeddedLuauRuntime() = default;
  ~EmbeddedLuauRuntime() override = default;

  std::string name() const override { return "embedded-luau"; }
  bool ready(const RuntimeContext&) const override { return true; }

  ScriptResult execute(const std::string& source, const RuntimeContext&) override {
    ScriptResult result;
    lua_State* L = luaL_newstate();
    if (!L) {
      result.error = "luaL_newstate() failed";
      return result;
    }
    luaL_openlibs(L);
    installPrintCapture(L);

    Luau::CompileOptions copts;
    copts.optimizationLevel = 1;
    copts.debugLevel = 1;
    std::string bytecode = Luau::compile(source, copts);

    if (luau_load(L, "@verdant", bytecode.data(), bytecode.size(), 0) != 0) {
      const char* msg = lua_tostring(L, -1);
      result.error = msg ? msg : "luau_load failed";
      lua_close(L);
      return result;
    }

    int rc = lua_pcall(L, 0, 0, 0);
    if (rc != 0) {
      const char* msg = lua_tostring(L, -1);
      result.error = msg ? msg : "lua_pcall failed";
      lua_close(L);
      return result;
    }

    lua_getfield(L, LUA_REGISTRYINDEX, kBufferKey);
    const char* buf = lua_tostring(L, -1);
    if (buf) result.output.assign(buf);
    lua_close(L);
    result.success = true;
    return result;
  }

 private:
  static constexpr const char* kBufferKey = "verdant_print_buffer";

  static int luaPrint(lua_State* L) {
    std::ostringstream line;
    int n = lua_gettop(L);
    for (int i = 1; i <= n; ++i) {
      if (i > 1) line << "\t";
      const char* s = luaL_tolstring(L, i, nullptr);
      if (s) line << s;
      lua_pop(L, 1);
    }
    line << "\n";

    lua_getfield(L, LUA_REGISTRYINDEX, kBufferKey);
    const char* prev = lua_tostring(L, -1);
    std::string acc = prev ? prev : "";
    lua_pop(L, 1);
    acc += line.str();
    lua_pushlstring(L, acc.data(), acc.size());
    lua_setfield(L, LUA_REGISTRYINDEX, kBufferKey);
    return 0;
  }

  static void installPrintCapture(lua_State* L) {
    lua_pushlstring(L, "", 0);
    lua_setfield(L, LUA_REGISTRYINDEX, kBufferKey);
    lua_pushcfunction(L, &EmbeddedLuauRuntime::luaPrint, "print");
    lua_setglobal(L, "print");
  }
};

#endif  // VERDANT_HAVE_LUAU

/* Sketch of the kernel-injection runtime.
 *
 * The intent is: take the source string, compile it (either via Luau in the
 * agent process or via a server-side compile step), then deliver the
 * resulting Luau bytecode into the attached Roblox process so its own VM
 * loads/executes it inside a privileged scriptcontext.
 *
 * The real implementation needs Roblox-build-specific information that
 * MUST be reverse-engineered fresh for each Roblox release:
 *
 *   - Address of the active L:Proto* (or scriptcontext) the agent wants
 *     to inject into.
 *   - Layout of the Proto / TString / GCObject structs for the current
 *     Luau revision shipped by Roblox.
 *   - Whatever runtime check / Hyperion mitigation needs to be tolerated
 *     for the chosen write strategy.
 *
 * NONE of those constants are provided here on purpose - they are not
 * stable, they are not generic across builds, and shipping them would just
 * rot. Wire your own resolver in resolveProtoAddress() / writeBytecode().
 */
class KernelInjectionRuntime final : public LuaRuntime {
 public:
  std::string name() const override { return "kernel-injection"; }

  bool ready(const RuntimeContext& ctx) const override {
    return ctx.backend && ctx.backend->isOpen() && ctx.robloxPid != 0 && ctx.robloxBase != 0;
  }

  ScriptResult execute(const std::string& source, const RuntimeContext& ctx) override {
    ScriptResult r;
    if (!ready(ctx)) {
      r.error = "kernel-injection runtime not ready (no Roblox attached or backend closed)";
      return r;
    }

#ifdef VERDANT_HAVE_LUAU
    Luau::CompileOptions copts;
    copts.optimizationLevel = 1;
    std::string bytecode = Luau::compile(source, copts);
#else
    // Without an embedded compiler we cannot produce bytecode locally.
    // A real impl would either ship a precompiled blob from the server or
    // call back to /api/executor/compile.
    std::string bytecode = source;
#endif

    uintptr_t target = resolveProtoAddress(ctx);
    if (target == 0) {
      r.error = "could not resolve target Proto address (offset table missing for current build)";
      return r;
    }
    if (!writeBytecode(ctx, target, bytecode)) {
      r.error = "memory write failed (driver blocked / wrong region)";
      return r;
    }

    // After the write a real impl would also have to: flag the Proto as
    // "needs reload", trigger a luau_load equivalent inside Roblox, and
    // wait for an in-game callback that signals execution outcome. None of
    // that is wired here - see the file-level comment.
    r.success = true;
    r.output = "kernel-injection: bytecode staged (" + std::to_string(bytecode.size()) +
               " bytes) at 0x" + toHex(target);
    return r;
  }

 private:
  static std::string toHex(uintptr_t v) {
    std::ostringstream oss;
    oss << std::hex << v;
    return oss.str();
  }

  // PLACEHOLDER. Returns 0 to force the caller to surface the "no offset
  // table" error rather than silently writing to an arbitrary address.
  uintptr_t resolveProtoAddress(const RuntimeContext& /*ctx*/) const { return 0; }

  // PLACEHOLDER. A real impl would copy the bytecode blob to a scratch
  // region (e.g. an unused .data slot or a freshly-allocated remote page),
  // then point an existing Proto at it. Left intentionally trivial so the
  // wiring is obvious without providing exploit-grade code.
  bool writeBytecode(const RuntimeContext& ctx, uintptr_t target, const std::string& bytecode) {
    if (!ctx.backend) return false;
    return ctx.backend->write(target, bytecode.data(), bytecode.size());
  }
};

}  // namespace

std::unique_ptr<LuaRuntime> makeRuntime(RuntimeKind kind) {
  switch (kind) {
    case RuntimeKind::Embedded:
#ifdef VERDANT_HAVE_LUAU
      return std::make_unique<EmbeddedLuauRuntime>();
#else
      std::cerr << "[runtime] embedded-luau requested but VERDANT_HAVE_LUAU was not "
                   "compiled in; falling back to kernel-injection runtime."
                << std::endl;
      return std::make_unique<KernelInjectionRuntime>();
#endif
    case RuntimeKind::KernelInjection:
      return std::make_unique<KernelInjectionRuntime>();
  }
  return nullptr;
}

RuntimeKind resolveRuntimeKind(const std::string& nameRaw) {
  const std::string n = toLower(nameRaw);
  if (n == "kernel" || n == "kernel-injection" || n == "inject") {
    return RuntimeKind::KernelInjection;
  }
  if (n == "embedded" || n == "embedded-luau" || n == "sandbox") {
    return RuntimeKind::Embedded;
  }
  // "auto" / unknown
#ifdef VERDANT_HAVE_LUAU
  return RuntimeKind::Embedded;
#else
  return RuntimeKind::KernelInjection;
#endif
}

}  // namespace verdant
