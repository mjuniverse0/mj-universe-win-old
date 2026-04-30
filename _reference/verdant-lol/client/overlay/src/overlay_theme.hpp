#pragma once

#include <cstdint>

namespace verdant::hud {

struct ThemeColor {
  uint8_t r;
  uint8_t g;
  uint8_t b;
  float a;
};

struct HudTheme {
  static constexpr int kOverlayWidth = 420;
  static constexpr int kOverlayHeight = 520;
  static constexpr int kHeaderHeight = 56;
  static constexpr int kInputHeight = 46;
  static constexpr int kPadding = 14;
  static constexpr float kHeaderFontSize = 16.0f;
  static constexpr float kBodyFontSize = 13.5f;
  static constexpr float kAuthorFontSize = 12.0f;
  static constexpr float kStatusFontSize = 11.0f;

  static constexpr ThemeColor background{12, 16, 24, 0.95f};
  static constexpr ThemeColor panelBorder{56, 72, 102, 0.9f};
  static constexpr ThemeColor header{20, 26, 38, 0.98f};
  static constexpr ThemeColor headerAccent{108, 160, 255, 1.0f};
  static constexpr ThemeColor messageBg{24, 31, 46, 0.9f};
  static constexpr ThemeColor inputBg{23, 30, 44, 0.98f};
  static constexpr ThemeColor inputBgFocused{30, 40, 61, 1.0f};
  static constexpr ThemeColor bodyText{236, 241, 250, 1.0f};
  static constexpr ThemeColor authorText{126, 219, 190, 1.0f};
  static constexpr ThemeColor mutedText{154, 168, 191, 1.0f};
};

}  // namespace verdant::hud
