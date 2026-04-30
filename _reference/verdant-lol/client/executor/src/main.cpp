#include <windows.h>

#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <mutex>
#include <nlohmann/json.hpp>
#include <string>
#include <thread>

#include "memory.hpp"
#include "poller.hpp"
#include "process.hpp"
#include "runtime.hpp"
#include "server.hpp"

using nlohmann::json;
using namespace verdant;

namespace {

struct EngineState {
  std::mutex mu;
  std::unique_ptr<MemoryBackend> backend;
  std::string backendKind{"none"};
  uint32_t pid{0};
  uintptr_t base{0};
  std::wstring exeName;
  uint64_t scriptsExecuted{0};
  uint64_t bytesExecuted{0};
  std::string lastScriptPreview;
};

std::atomic<bool> g_running{true};
HttpServer* g_server = nullptr;

BOOL WINAPI ctrlHandler(DWORD type) {
  if (type == CTRL_C_EVENT || type == CTRL_BREAK_EVENT || type == CTRL_CLOSE_EVENT) {
    g_running.store(false);
    if (g_server) g_server->stop();
    return TRUE;
  }
  return FALSE;
}

unsigned short parsePort(const char* fallback) {
  const char* p = std::getenv("VERDANT_EXECUTOR_PORT");
  const char* val = (p && *p) ? p : fallback;
  int v = std::atoi(val);
  if (v <= 0 || v > 65535) v = 6969;
  return static_cast<unsigned short>(v);
}

std::string envOrEmpty(const char* key) {
  const char* v = std::getenv(key);
  return (v && *v) ? std::string(v) : std::string();
}

std::wstring utf8ToWide(const std::string& s) {
  if (s.empty()) return L"";
  int len = MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), nullptr, 0);
  std::wstring out(static_cast<size_t>(len), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.data(), static_cast<int>(s.size()), out.data(), len);
  return out;
}

std::wstring computeHwidFallback() {
  wchar_t name[256] = {0};
  DWORD sz = 256;
  if (GetComputerNameW(name, &sz)) return std::wstring(name, sz);
  return L"unknown-host";
}

void attachLoop(EngineState& state) {
  while (g_running.load()) {
    RobloxTarget t = findRoblox();
    {
      std::lock_guard<std::mutex> lk(state.mu);
      if (t.pid == 0) {
        if (state.pid != 0) {
          state.pid = 0;
          state.base = 0;
          state.exeName.clear();
          if (state.backend) state.backend->setProcessId(0);
        }
      } else if (t.pid != state.pid) {
        state.pid = t.pid;
        state.exeName = t.exeName;
        if (state.backend) {
          state.backend->setProcessId(t.pid);
          if (!state.backend->isOpen()) state.backend->open();
        }
        state.base = getModuleBase(t.pid);
        std::wcout << L"[executor] attached to " << state.exeName << L" pid=" << t.pid
                   << L" base=0x" << std::hex << state.base << std::dec << std::endl;
      } else if (state.base == 0) {
        state.base = getModuleBase(t.pid);
      }
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(2000));
  }
}

}  // namespace

int main() {
  SetConsoleOutputCP(CP_UTF8);
  SetConsoleCtrlHandler(&ctrlHandler, TRUE);

  EngineState state;

  // Prefer kernel driver; fall back to user-mode (OpenProcess + RPM).
  auto kernel = std::make_unique<KernelDriver>();
  if (kernel->open()) {
    state.backend = std::move(kernel);
    state.backendKind = "kernel";
    std::cout << "[executor] kernel driver bridge opened (\\\\.\\VerdantKM)" << std::endl;
  } else {
    state.backend = std::make_unique<UserModeBackend>();
    state.backendKind = "usermode";
    std::cout << "[executor] kernel driver not available, using user-mode (RPM/WPM)" << std::endl;
  }

  RuntimeKind runtimeKind = resolveRuntimeKind(envOrEmpty("VERDANT_EXECUTOR_RUNTIME"));
  std::unique_ptr<LuaRuntime> runtime = makeRuntime(runtimeKind);
  std::cout << "[executor] runtime: " << (runtime ? runtime->name() : std::string("none"))
            << std::endl;

  HttpServer server;
  g_server = &server;

  server.route("GET", "/", [](const HttpRequest&) {
    HttpReply r;
    r.body = "ok";
    return r;
  });

  server.route("GET", "/health", [&state](const HttpRequest&) {
    std::lock_guard<std::mutex> lk(state.mu);
    json j = {
        {"ok", true},
        {"backend", state.backendKind},
        {"attached", state.pid != 0},
        {"pid", state.pid},
        {"base", state.base},
        {"scripts_executed", state.scriptsExecuted},
        {"bytes_executed", state.bytesExecuted},
    };
    HttpReply r;
    r.contentType = "application/json";
    r.body = j.dump();
    return r;
  });

  server.route("POST", "/execute", [&state, &runtime](const HttpRequest& req) {
    HttpReply r;
    r.contentType = "application/json";

    std::string script = req.body;
    auto ct = req.headers.find("content-type");
    if (ct != req.headers.end() && ct->second.find("application/json") != std::string::npos) {
      try {
        json j = json::parse(req.body);
        if (j.contains("script") && j["script"].is_string()) {
          script = j["script"].get<std::string>();
        } else if (j.contains("code") && j["code"].is_string()) {
          script = j["code"].get<std::string>();
        }
      } catch (...) {
        // fall through; treat raw body as script
      }
    }

    RuntimeContext ctx;
    {
      std::lock_guard<std::mutex> lk(state.mu);
      state.scriptsExecuted += 1;
      state.bytesExecuted += script.size();
      state.lastScriptPreview = script.substr(0, std::min<size_t>(120, script.size()));
      ctx.backend = state.backend.get();
      ctx.robloxBase = state.base;
      ctx.robloxPid = state.pid;
    }

    ScriptResult sr;
    if (runtime) sr = runtime->execute(script, ctx);

    json j = {
        {"ok", sr.success},
        {"runtime", runtime ? runtime->name() : std::string("none")},
        {"backend", state.backendKind},
        {"attached", state.pid != 0},
        {"received_bytes", script.size()},
    };
    if (!sr.output.empty()) j["output"] = sr.output;
    if (!sr.error.empty()) j["error"] = sr.error;
    r.body = j.dump();
    std::cout << "[executor] /execute " << script.size() << " bytes -> "
              << (runtime ? runtime->name() : "none") << " "
              << (sr.success ? "ok" : "fail") << std::endl;
    return r;
  });

  std::thread attacher([&] { attachLoop(state); });

  // Long-poll agent against verdant.lol (or whatever VERDANT_EXECUTOR_BASE
  // points at). When a script lands we attempt to deliver it through the
  // memory backend and ack the queue id back. Real Lua execution lives in
  // the TODO(real-impl) block below.
  PollerConfig pollCfg;
  std::string baseUtf8 = envOrEmpty("VERDANT_EXECUTOR_BASE");
  if (baseUtf8.empty()) baseUtf8 = "https://verdant.lol/api/executor";
  pollCfg.baseUrl = utf8ToWide(baseUtf8);
  std::string hwidUtf8 = envOrEmpty("VERDANT_EXECUTOR_HWID");
  pollCfg.hwid = hwidUtf8.empty() ? computeHwidFallback() : utf8ToWide(hwidUtf8);
  pollCfg.license = utf8ToWide(envOrEmpty("VERDANT_EXECUTOR_LICENSE"));
  pollCfg.author = utf8ToWide(envOrEmpty("VERDANT_EXECUTOR_AUTHOR"));
  pollCfg.waitSeconds = 25;

  Poller poller(pollCfg, [&state, &runtime](const PullJob& job) -> AckResult {
    RuntimeContext ctx;
    {
      std::lock_guard<std::mutex> lk(state.mu);
      state.scriptsExecuted += 1;
      state.bytesExecuted += job.script.size();
      state.lastScriptPreview = job.script.substr(0, std::min<size_t>(120, job.script.size()));
      ctx.backend = state.backend.get();
      ctx.robloxBase = state.base;
      ctx.robloxPid = state.pid;
    }
    AckResult r;
    if (!runtime) {
      r.error = "no runtime configured";
      return r;
    }
    ScriptResult sr = runtime->execute(job.script, ctx);
    r.success = sr.success;
    r.output = sr.output;
    r.error = sr.error;
    return r;
  });
  poller.start();

  std::wcout << L"[executor] poll agent: " << pollCfg.baseUrl << L"  hwid=" << pollCfg.hwid
             << std::endl;

  unsigned short port = parsePort("6969");
  std::cout << "[executor] listening on http://127.0.0.1:" << port
            << " (GET /, GET /health, POST /execute)" << std::endl;
  bool ok = server.listenAndServe(port);
  if (!ok) {
    std::cerr << "[executor] failed to bind 127.0.0.1:" << port
              << " \u2014 is another daemon running?" << std::endl;
  }

  poller.stop();
  g_running.store(false);
  attacher.join();
  g_server = nullptr;

  if (state.backend) state.backend->close();
  return ok ? 0 : 1;
}
