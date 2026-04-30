#include "win32_mouse_input.hpp"

namespace verdant::input {

namespace {

LONG normalizeAbsoluteCoord(int pixel, int origin, int size) {
  if (size <= 1) return 0;
  const long long numerator = static_cast<long long>(pixel - origin) * 65535LL;
  const long long denominator = static_cast<long long>(size - 1);
  return static_cast<LONG>(numerator / denominator);
}

}  // namespace

bool Win32MouseInput::registerRawMouse(HWND hwnd) {
  RAWINPUTDEVICE device{};
  device.usUsagePage = 0x01;  // Generic desktop controls.
  device.usUsage = 0x02;      // Mouse.
  device.dwFlags = 0;         // Foreground input for the owning window.
  device.hwndTarget = hwnd;

  return RegisterRawInputDevices(&device, 1, sizeof(device)) == TRUE;
}

void Win32MouseInput::handleRawInput(LPARAM lParam) {
  UINT size = 0;
  if (GetRawInputData(reinterpret_cast<HRAWINPUT>(lParam), RID_INPUT, nullptr, &size,
                      sizeof(RAWINPUTHEADER)) != 0) {
    return;
  }

  RAWINPUT input{};
  if (size > sizeof(input)) return;

  if (GetRawInputData(reinterpret_cast<HRAWINPUT>(lParam), RID_INPUT, &input, &size,
                      sizeof(RAWINPUTHEADER)) != size) {
    return;
  }

  if (input.header.dwType != RIM_TYPEMOUSE) return;

  frame_.deltaX += input.data.mouse.lLastX;
  frame_.deltaY += input.data.mouse.lLastY;
}

void Win32MouseInput::pollButtonsAndCursor() {
  GetCursorPos(&frame_.cursor);
  frame_.leftDown = (GetAsyncKeyState(VK_LBUTTON) & 0x8000) != 0;
  frame_.rightDown = (GetAsyncKeyState(VK_RBUTTON) & 0x8000) != 0;
  frame_.middleDown = (GetAsyncKeyState(VK_MBUTTON) & 0x8000) != 0;
}

bool Win32MouseInput::sendRelativeMove(int dx, int dy) const {
  if (dx == 0 && dy == 0) return true;

  INPUT input{};
  input.type = INPUT_MOUSE;
  input.mi.dx = dx;
  input.mi.dy = dy;
  input.mi.dwFlags = MOUSEEVENTF_MOVE;
  return SendInput(1, &input, sizeof(INPUT)) == 1;
}

bool Win32MouseInput::sendAbsoluteMove(int x, int y) const {
  const int left = GetSystemMetrics(SM_XVIRTUALSCREEN);
  const int top = GetSystemMetrics(SM_YVIRTUALSCREEN);
  const int width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
  const int height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
  if (width <= 0 || height <= 0) return false;

  INPUT input{};
  input.type = INPUT_MOUSE;
  input.mi.dx = normalizeAbsoluteCoord(x, left, width);
  input.mi.dy = normalizeAbsoluteCoord(y, top, height);
  input.mi.dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;
  return SendInput(1, &input, sizeof(INPUT)) == 1;
}

MouseFrame Win32MouseInput::consumeFrame() {
  pollButtonsAndCursor();

  MouseFrame out = frame_;
  frame_.deltaX = 0;
  frame_.deltaY = 0;
  return out;
}

}  // namespace verdant::input
