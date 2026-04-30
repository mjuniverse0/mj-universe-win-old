#include "overlay_input_adapter.hpp"

#include <algorithm>
#include <cmath>

#include "offsets.hpp"

namespace verdant {

namespace {

float vecLen(float x, float y) {
  return std::sqrt(x * x + y * y);
}

}  // namespace

bool applyOsMouseAssist(const POINT& cursor,
                        float crosshairX,
                        float crosshairY,
                        float targetX,
                        float targetY,
                        const OverlayMouseAssistConfig& cfg) {
  const float toTargetX = targetX - crosshairX;
  const float toTargetY = targetY - crosshairY;
  const float dist = vecLen(toTargetX, toTargetY);
  if (dist <= 0.001f || dist >= cfg.radiusPx) return false;

  const float proximity = 1.0f - (dist / cfg.radiusPx);
  const float step = std::min(cfg.maxStepPx, dist * cfg.gain * proximity);
  const float dirX = toTargetX / dist;
  const float dirY = toTargetY / dist;

  const int dx = static_cast<int>(std::lround(dirX * step));
  int dy = static_cast<int>(std::lround(dirY * step));
  if (cfg.invertY) dy = -dy;
  if (dx == 0 && dy == 0) return false;

  INPUT input{};
  input.type = INPUT_MOUSE;
  input.mi.dx = dx;
  input.mi.dy = dy;
  input.mi.dwFlags = MOUSEEVENTF_MOVE;
  if (offsets::win32::SendInput(1, &input, sizeof(INPUT)) == 1) return true;
  offsets::win32::SetCursorPos(cursor.x + dx, cursor.y + dy);
  return true;
}

}  // namespace verdant
