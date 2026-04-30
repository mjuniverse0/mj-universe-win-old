#pragma once

#include <algorithm>

namespace verdant {

struct CameraState {
  float yaw = 0.0f;
  float pitch = 0.0f;

  // Extra camera-side multiplier applied after aim assist produces degrees.
  float sens = 0.10f;
  float accel = 1.0f;
};

inline void clampPitch(CameraState& camera) {
  camera.pitch = std::clamp(camera.pitch, -89.0f, 89.0f);
}

}  // namespace verdant
