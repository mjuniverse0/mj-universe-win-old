#pragma once

#include <cstdint>
#include <string>

#ifdef _WIN32
#include <windows.h>
#endif

namespace verdant {

struct RobloxTarget {
  uint32_t pid{0};
  HWND window{nullptr};
  std::wstring exeName;  // The matched .exe file name (RobloxPlayerBeta.exe etc.)
};

uint32_t findProcessId(const wchar_t* exeName);

// Try to locate any active Roblox client process. Tested names (in priority
// order): RobloxPlayerBeta.exe, RobloxStudioBeta.exe, RobloxPlayer.exe.
RobloxTarget findRoblox();

// Returns the largest visible top-level window owned by `pid`, or nullptr.
HWND findMainWindow(uint32_t pid);

}  // namespace verdant
