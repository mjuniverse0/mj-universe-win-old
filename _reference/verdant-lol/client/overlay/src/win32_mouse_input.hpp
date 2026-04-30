#pragma once

#include <windows.h>

namespace verdant::input {

struct MouseFrame {
  int deltaX = 0;
  int deltaY = 0;
  POINT cursor{};
  bool leftDown = false;
  bool rightDown = false;
  bool middleDown = false;
};

class Win32MouseInput {
 public:
  bool registerRawMouse(HWND hwnd);
  void handleRawInput(LPARAM lParam);
  void pollButtonsAndCursor();
  bool sendRelativeMove(int dx, int dy) const;
  bool sendAbsoluteMove(int x, int y) const;

  // Returns accumulated movement since the previous consume call.
  MouseFrame consumeFrame();
  MouseFrame snapshot() const { return frame_; }

 private:
  MouseFrame frame_{};
};

}  // namespace verdant::input
