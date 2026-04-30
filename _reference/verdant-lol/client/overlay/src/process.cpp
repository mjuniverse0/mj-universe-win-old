#include "process.hpp"

#ifdef _WIN32
#include <tlhelp32.h>
#endif

namespace verdant {

uint32_t findProcessId(const wchar_t* exeName) {
#ifdef _WIN32
  HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (snap == INVALID_HANDLE_VALUE) return 0;

  PROCESSENTRY32W pe{};
  pe.dwSize = sizeof(pe);
  uint32_t pid = 0;
  if (Process32FirstW(snap, &pe)) {
    do {
      if (_wcsicmp(pe.szExeFile, exeName) == 0) {
        pid = pe.th32ProcessID;
        break;
      }
    } while (Process32NextW(snap, &pe));
  }
  CloseHandle(snap);
  return pid;
#else
  (void)exeName;
  return 0;
#endif
}

RobloxTarget findRoblox() {
  static const wchar_t* kCandidates[] = {
      L"RobloxPlayerBeta.exe",
      L"RobloxStudioBeta.exe",
      L"RobloxPlayer.exe",
  };
  RobloxTarget t;
  for (const wchar_t* name : kCandidates) {
    uint32_t pid = findProcessId(name);
    if (pid != 0) {
      t.pid = pid;
      t.exeName = name;
      t.window = findMainWindow(pid);
      return t;
    }
  }
  return t;
}

namespace {

struct EnumCtx {
  DWORD pid;
  HWND best;
  LONG bestArea;
};

BOOL CALLBACK enumProc(HWND h, LPARAM lp) {
  auto* ctx = reinterpret_cast<EnumCtx*>(lp);
  DWORD wpid = 0;
  GetWindowThreadProcessId(h, &wpid);
  if (wpid != ctx->pid) return TRUE;
  if (!IsWindowVisible(h)) return TRUE;
  if (GetWindow(h, GW_OWNER) != nullptr) return TRUE;

  RECT r{};
  if (!GetClientRect(h, &r)) return TRUE;
  const LONG w = r.right - r.left;
  const LONG h_ = r.bottom - r.top;
  if (w < 200 || h_ < 200) return TRUE;

  const LONG area = w * h_;
  if (area > ctx->bestArea) {
    ctx->bestArea = area;
    ctx->best = h;
  }
  return TRUE;
}

}  // namespace

HWND findMainWindow(uint32_t pid) {
  if (pid == 0) return nullptr;
  EnumCtx ctx{pid, nullptr, 0};
  EnumWindows(&enumProc, reinterpret_cast<LPARAM>(&ctx));
  return ctx.best;
}

}  // namespace verdant
