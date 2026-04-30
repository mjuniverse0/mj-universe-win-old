#include <windows.h>

#include <cstdlib>
#include <memory>
#include <string>

#include "chat.hpp"
#include "memory.hpp"
#include "overlay.hpp"

namespace {

std::wstring envOr(const wchar_t* key, const wchar_t* fallback) {
  wchar_t buf[2048];
  DWORD n = GetEnvironmentVariableW(key, buf, 2048);
  if (n == 0 || n >= 2048) return fallback ? std::wstring(fallback) : std::wstring();
  return std::wstring(buf, n);
}

std::wstring computeAuthorId() {
  wchar_t name[256] = {0};
  DWORD sz = 256;
  if (GetComputerNameW(name, &sz)) {
    std::wstring base(name);
    DWORD pid = GetCurrentProcessId();
    return base + L"-" + std::to_wstring(pid);
  }
  return L"anon-" + std::to_wstring(GetCurrentProcessId());
}

std::wstring computeAuthorName() {
  wchar_t user[256] = {0};
  DWORD sz = 256;
  if (GetUserNameW(user, &sz)) return std::wstring(user, sz - 1);
  return L"anon";
}

}  // namespace

int APIENTRY wWinMain(HINSTANCE hInst, HINSTANCE, LPWSTR, int) {
  using namespace verdant;

  ChatConfig cfg;
  cfg.supabaseUrl = envOr(L"SUPABASE_URL", L"");
  cfg.supabaseAnonKey = envOr(L"SUPABASE_PUBLISHABLE_KEY", L"");
  if (cfg.supabaseAnonKey.empty()) cfg.supabaseAnonKey = envOr(L"SUPABASE_ANON_KEY", L"");
  cfg.roomId = envOr(L"VERDANT_CHAT_ROOM_ID", L"");
  cfg.authorId = envOr(L"VERDANT_CHAT_AUTHOR_ID", computeAuthorId().c_str());
  cfg.authorName = envOr(L"VERDANT_CHAT_AUTHOR_NAME", computeAuthorName().c_str());

  SupabaseChat chat(cfg);
  chat.start();

  // Kernel-only mode: no user-mode memory fallback.
  KernelDriver kernel;
  MemoryBackend* backend = nullptr;
  if (kernel.open()) {
    backend = &kernel;
  }

  OverlayWindow overlay;
  overlay.setChat(&chat);
  overlay.setBackend(backend);
  if (!overlay.create(hInst)) {
    chat.stop();
    return 1;
  }

  overlay.runMessageLoop();
  chat.stop();
  return 0;
}
