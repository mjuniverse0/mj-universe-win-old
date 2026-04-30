#pragma once

#include <string>
#include <vector>

#include "chat.hpp"

namespace verdant::hud {

struct HudState {
  float width = 0.0f;
  float height = 0.0f;
  std::wstring title{L"Verdant HUD"};
  std::wstring statusText;
  std::wstring inputText;
  bool inputFocused = false;
  bool caretOn = true;
  RECT inputRect{0, 0, 0, 0};
  std::vector<ChatMessage> messages;
};

}  // namespace verdant::hud
