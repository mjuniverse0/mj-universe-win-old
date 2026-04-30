#pragma once

#include <cmath>
#include <algorithm>

namespace verdant {

struct Vec2 {
  float x = 0.0f;
  float y = 0.0f;
};

// Converts raw mouse deltas into a bounded, controller-like radial input.
inline Vec2 mouseToStick(int dx, int dy, float scale = 0.0022f, float curve = 1.6f) {
  const float x = dx * scale;
  const float y = dy * scale;
  const float mag = std::sqrt(x * x + y * y);

  if (mag < 0.0001f) return {};

  const float nx = x / mag;
  const float ny = y / mag;
  const float curved = std::pow(std::min(mag, 1.0f), std::max(curve, 0.01f));

  return {
      nx * curved,
      ny * curved,
  };
}

}  // namespace verdant
