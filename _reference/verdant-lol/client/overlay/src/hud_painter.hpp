#pragma once

#include <d2d1.h>
#include <dwrite.h>
#include <windows.h>
#include <wrl/client.h>

#include "hud_state.hpp"

namespace verdant::hud {

class HudPainter {
 public:
  template <typename T>
  using ComPtr = Microsoft::WRL::ComPtr<T>;

  void setDWriteFactory(IDWriteFactory* factory);
  bool paint(ID2D1HwndRenderTarget* renderTarget, const HudState& state);

 private:
  bool ensureTextFormats();
  bool ensureBrushes(ID2D1HwndRenderTarget* renderTarget);
  static D2D1_COLOR_F rgba(uint8_t r, uint8_t g, uint8_t b, float a = 1.0f);

  ComPtr<IDWriteFactory> dwriteFactory_;
  ID2D1HwndRenderTarget* brushTarget_{nullptr};

  ComPtr<IDWriteTextFormat> textFormatBody_;
  ComPtr<IDWriteTextFormat> textFormatAuthor_;
  ComPtr<IDWriteTextFormat> textFormatHeader_;
  ComPtr<IDWriteTextFormat> textFormatStatus_;
  ComPtr<IDWriteTextFormat> textFormatInput_;

  ComPtr<ID2D1SolidColorBrush> brushBg_;
  ComPtr<ID2D1SolidColorBrush> brushPanelBorder_;
  ComPtr<ID2D1SolidColorBrush> brushHeader_;
  ComPtr<ID2D1SolidColorBrush> brushHeaderAccent_;
  ComPtr<ID2D1SolidColorBrush> brushMessageBg_;
  ComPtr<ID2D1SolidColorBrush> brushInputBg_;
  ComPtr<ID2D1SolidColorBrush> brushInputBgFocused_;
  ComPtr<ID2D1SolidColorBrush> brushBody_;
  ComPtr<ID2D1SolidColorBrush> brushAuthor_;
  ComPtr<ID2D1SolidColorBrush> brushDim_;
};

}  // namespace verdant::hud
