#pragma once

#include <windows.h>

namespace verdant {

struct OverlayMouseAssistConfig {
  float radiusPx = 140.0f;
  float gain = 0.22f;
  float maxStepPx = 8.0f;
  bool invertY = false;
};

bool applyOsMouseAssist(const POINT& cursor,
                        float crosshairX,
                        float crosshairY,
                        float targetX,
                        float targetY,
                        const OverlayMouseAssistConfig& cfg);

}  // namespace verdant
