#pragma once

#include <d2d1.h>
#include <dwrite.h>
#include <windows.h>
#include <wrl/client.h>

#include <chrono>
#include <cstdint>
#include <string>
#include <vector>

#include "chat.hpp"
#include "hud_painter.hpp"
#include "hud_state.hpp"
#include "memory.hpp"
#include "process.hpp"
#include "win32_mouse_input.hpp"

namespace verdant {

class OverlayWindow {
 public:
  OverlayWindow();
  ~OverlayWindow();

  bool create(HINSTANCE hInst);
  void setChat(SupabaseChat* chat) { chat_ = chat; }
  void setBackend(MemoryBackend* backend) { backend_ = backend; }
  void runMessageLoop();

  HWND hwnd() const { return hwnd_; }

 private:
  static LRESULT CALLBACK staticWndProc(HWND, UINT, WPARAM, LPARAM);
  LRESULT wndProc(UINT, WPARAM, LPARAM);

  bool ensureRenderTargets();
  void releaseRenderTargets();
  void onPaint();
  void onTick();

  void positionToCorner();

  void appendInputChar(wchar_t c);
  void backspaceInput();
  void submitInput();

  template <typename T>
  using ComPtr = Microsoft::WRL::ComPtr<T>;

  HWND hwnd_{nullptr};
  HINSTANCE hInst_{nullptr};

  ComPtr<ID2D1Factory> d2dFactory_;
  ComPtr<IDWriteFactory> dwriteFactory_;
  ComPtr<ID2D1HwndRenderTarget> renderTarget_;
  hud::HudPainter hudPainter_;

  SupabaseChat* chat_{nullptr};
  MemoryBackend* backend_{nullptr};
  std::wstring title_{L"Verdant HUD"};

  std::wstring inputText_;
  bool inputFocused_{false};
  bool caretOn_{true};
  std::chrono::steady_clock::time_point lastCaretBlink_;

  std::wstring lastTargetStatus_{L"S\u00f8ker etter Roblox..."};
  std::wstring lastAimStatus_{L"HUD: venter p\u00e5 input"};
  std::chrono::steady_clock::time_point lastTargetCheck_{};
  HWND lastRobloxWindow_{nullptr};
  uintptr_t lockedTargetCharacter_{0};

  input::Win32MouseInput mouseInput_;
  RECT inputRect_{0, 0, 0, 0};
  hud::HudState hudState_{};
};

}  // namespace verdant
