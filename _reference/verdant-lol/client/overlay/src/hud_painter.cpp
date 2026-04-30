#include "hud_painter.hpp"

#include <algorithm>

#include "overlay_theme.hpp"

namespace verdant::hud {

D2D1_COLOR_F HudPainter::rgba(uint8_t r, uint8_t g, uint8_t b, float a) {
  return D2D1::ColorF(r / 255.0f, g / 255.0f, b / 255.0f, a);
}

void HudPainter::setDWriteFactory(IDWriteFactory* factory) {
  dwriteFactory_ = factory;
}

bool HudPainter::ensureTextFormats() {
  if (!dwriteFactory_) return false;
  if (textFormatBody_ && textFormatAuthor_ && textFormatHeader_ && textFormatStatus_ &&
      textFormatInput_) {
    return true;
  }

  auto makeFormat = [&](float size, DWRITE_FONT_WEIGHT weight,
                        ComPtr<IDWriteTextFormat>& out) -> bool {
    return SUCCEEDED(dwriteFactory_->CreateTextFormat(L"Segoe UI", nullptr, weight,
                                                      DWRITE_FONT_STYLE_NORMAL,
                                                      DWRITE_FONT_STRETCH_NORMAL, size, L"nb-NO",
                                                      out.GetAddressOf()));
  };

  if (!makeFormat(HudTheme::kBodyFontSize, DWRITE_FONT_WEIGHT_NORMAL, textFormatBody_)) return false;
  if (!makeFormat(HudTheme::kAuthorFontSize, DWRITE_FONT_WEIGHT_BOLD, textFormatAuthor_)) return false;
  if (!makeFormat(HudTheme::kHeaderFontSize, DWRITE_FONT_WEIGHT_SEMI_BOLD, textFormatHeader_)) return false;
  if (!makeFormat(HudTheme::kStatusFontSize, DWRITE_FONT_WEIGHT_NORMAL, textFormatStatus_)) return false;
  if (!makeFormat(HudTheme::kBodyFontSize, DWRITE_FONT_WEIGHT_NORMAL, textFormatInput_)) return false;

  textFormatBody_->SetWordWrapping(DWRITE_WORD_WRAPPING_WRAP);
  textFormatAuthor_->SetWordWrapping(DWRITE_WORD_WRAPPING_NO_WRAP);
  textFormatStatus_->SetTextAlignment(DWRITE_TEXT_ALIGNMENT_TRAILING);
  return true;
}

bool HudPainter::ensureBrushes(ID2D1HwndRenderTarget* renderTarget) {
  if (!renderTarget) return false;
  if (brushTarget_ == renderTarget && brushBg_ && brushPanelBorder_ && brushHeader_ &&
      brushHeaderAccent_ && brushMessageBg_ && brushInputBg_ && brushInputBgFocused_ &&
      brushBody_ && brushAuthor_ && brushDim_) {
    return true;
  }

  brushBg_.Reset();
  brushPanelBorder_.Reset();
  brushHeader_.Reset();
  brushHeaderAccent_.Reset();
  brushMessageBg_.Reset();
  brushInputBg_.Reset();
  brushInputBgFocused_.Reset();
  brushBody_.Reset();
  brushAuthor_.Reset();
  brushDim_.Reset();

  const auto bg = HudTheme::background;
  const auto panelBorder = HudTheme::panelBorder;
  const auto header = HudTheme::header;
  const auto accent = HudTheme::headerAccent;
  const auto messageBg = HudTheme::messageBg;
  const auto input = HudTheme::inputBg;
  const auto inputFocus = HudTheme::inputBgFocused;
  const auto body = HudTheme::bodyText;
  const auto author = HudTheme::authorText;
  const auto muted = HudTheme::mutedText;
  renderTarget->CreateSolidColorBrush(rgba(bg.r, bg.g, bg.b, bg.a), brushBg_.GetAddressOf());
  renderTarget->CreateSolidColorBrush(rgba(panelBorder.r, panelBorder.g, panelBorder.b, panelBorder.a),
                                      brushPanelBorder_.GetAddressOf());
  renderTarget->CreateSolidColorBrush(rgba(header.r, header.g, header.b, header.a),
                                      brushHeader_.GetAddressOf());
  renderTarget->CreateSolidColorBrush(rgba(accent.r, accent.g, accent.b, accent.a),
                                      brushHeaderAccent_.GetAddressOf());
  renderTarget->CreateSolidColorBrush(rgba(messageBg.r, messageBg.g, messageBg.b, messageBg.a),
                                      brushMessageBg_.GetAddressOf());
  renderTarget->CreateSolidColorBrush(rgba(input.r, input.g, input.b, input.a),
                                      brushInputBg_.GetAddressOf());
  renderTarget->CreateSolidColorBrush(rgba(inputFocus.r, inputFocus.g, inputFocus.b, inputFocus.a),
                                      brushInputBgFocused_.GetAddressOf());
  renderTarget->CreateSolidColorBrush(rgba(body.r, body.g, body.b, body.a), brushBody_.GetAddressOf());
  renderTarget->CreateSolidColorBrush(rgba(author.r, author.g, author.b, author.a),
                                      brushAuthor_.GetAddressOf());
  renderTarget->CreateSolidColorBrush(rgba(muted.r, muted.g, muted.b, muted.a), brushDim_.GetAddressOf());
  brushTarget_ = renderTarget;
  return true;
}

bool HudPainter::paint(ID2D1HwndRenderTarget* renderTarget, const HudState& state) {
  if (!renderTarget) return false;
  if (!ensureTextFormats()) return false;
  if (!ensureBrushes(renderTarget)) return false;

  const float w = state.width;
  const float h = state.height;
  const int padding = HudTheme::kPadding;
  const int headerHeight = HudTheme::kHeaderHeight;
  const int inputHeight = HudTheme::kInputHeight;

  renderTarget->BeginDraw();
  renderTarget->Clear(rgba(0, 0, 0, 0));

  D2D1_ROUNDED_RECT panel{D2D1::RectF(1.0f, 1.0f, w - 1.0f, h - 1.0f), 14.0f, 14.0f};
  renderTarget->FillRoundedRectangle(panel, brushBg_.Get());
  renderTarget->DrawRoundedRectangle(panel, brushPanelBorder_.Get(), 1.2f);

  D2D1_ROUNDED_RECT header{D2D1::RectF(1.0f, 1.0f, w - 1.0f, static_cast<float>(headerHeight) + 1.0f),
                           14.0f, 14.0f};
  renderTarget->FillRoundedRectangle(header, brushHeader_.Get());
  renderTarget->FillRectangle(
      D2D1::RectF(1.0f, 18.0f, w - 1.0f, static_cast<float>(headerHeight) + 1.0f),
      brushHeader_.Get());
  renderTarget->FillRectangle(
      D2D1::RectF(static_cast<float>(padding), static_cast<float>(headerHeight) - 3.0f,
                  w - static_cast<float>(padding), static_cast<float>(headerHeight) - 1.0f),
      brushHeaderAccent_.Get());

  renderTarget->DrawTextW(state.title.c_str(), static_cast<UINT32>(state.title.size()),
                          textFormatHeader_.Get(),
                          D2D1::RectF(static_cast<float>(padding), 10.0f, w - padding,
                                      static_cast<float>(headerHeight) - 18.0f),
                          brushBody_.Get());
  renderTarget->DrawTextW(state.statusText.c_str(), static_cast<UINT32>(state.statusText.size()),
                          textFormatStatus_.Get(),
                          D2D1::RectF(static_cast<float>(padding), static_cast<float>(headerHeight) - 22.0f,
                                      w - static_cast<float>(padding),
                                      static_cast<float>(headerHeight) - 6.0f),
                          brushDim_.Get());

  const float msgsTop = static_cast<float>(headerHeight) + 10.0f;
  const float msgsBottom = h - static_cast<float>(inputHeight) - 14.0f;
  const float msgsLeft = static_cast<float>(padding);
  const float msgsRight = w - static_cast<float>(padding);
  const float msgsWidth = msgsRight - msgsLeft;

  if (state.messages.empty()) {
    const wchar_t* hint = L"Ingen meldinger enn\u00e5.\nKlikk i feltet og trykk Enter for \u00e5 sende.";
    renderTarget->DrawTextW(hint, static_cast<UINT32>(wcslen(hint)), textFormatBody_.Get(),
                            D2D1::RectF(msgsLeft, msgsTop, msgsRight, msgsBottom), brushDim_.Get());
  } else {
    float y = msgsBottom;
    for (auto it = state.messages.rbegin(); it != state.messages.rend(); ++it) {
      const std::wstring author = it->wideAuthor().empty() ? L"anon" : it->wideAuthor();
      const std::wstring body = it->wideBody();

      ComPtr<IDWriteTextLayout> bodyLayout;
      const HRESULT hr = dwriteFactory_->CreateTextLayout(
          body.c_str(), static_cast<UINT32>(body.size()), textFormatBody_.Get(), msgsWidth, 1000.0f,
          bodyLayout.GetAddressOf());
      if (FAILED(hr)) continue;

      DWRITE_TEXT_METRICS bm{};
      bodyLayout->GetMetrics(&bm);
      const float bubblePaddingY = 8.0f;
      const float bodyTop = 20.0f;
      const float blockHeight = bm.height + bodyTop + bubblePaddingY * 2.0f;
      if (y - blockHeight < msgsTop) break;
      y -= blockHeight;

      D2D1_ROUNDED_RECT bubble{
          D2D1::RectF(msgsLeft, y, msgsRight, y + blockHeight),
          9.0f,
          9.0f,
      };
      renderTarget->FillRoundedRectangle(bubble, brushMessageBg_.Get());

      renderTarget->DrawTextW(author.c_str(), static_cast<UINT32>(author.size()),
                              textFormatAuthor_.Get(),
                              D2D1::RectF(msgsLeft + 9.0f, y + 5.0f, msgsRight - 9.0f, y + 18.0f),
                              brushAuthor_.Get());
      renderTarget->DrawTextLayout(D2D1::Point2F(msgsLeft + 9.0f, y + bodyTop), bodyLayout.Get(),
                                   brushBody_.Get());
      y -= 6.0f;
    }
  }

  D2D1_ROUNDED_RECT inputRect{
      D2D1::RectF(static_cast<float>(state.inputRect.left), static_cast<float>(state.inputRect.top),
                  static_cast<float>(state.inputRect.right), static_cast<float>(state.inputRect.bottom)),
      10.0f, 10.0f};
  renderTarget->FillRoundedRectangle(
      inputRect, state.inputFocused ? brushInputBgFocused_.Get() : brushInputBg_.Get());
  renderTarget->DrawRoundedRectangle(inputRect, brushPanelBorder_.Get(), 1.0f);

  std::wstring shown = state.inputText;
  if (state.inputFocused && state.caretOn) shown += L"\u2502";
  if (!state.inputFocused && shown.empty()) shown = L"Klikk for \u00e5 chatte\u2026";
  ID2D1SolidColorBrush* inputBrush =
      (!state.inputFocused && state.inputText.empty()) ? brushDim_.Get() : brushBody_.Get();
  renderTarget->DrawTextW(
      shown.c_str(), static_cast<UINT32>(shown.size()), textFormatInput_.Get(),
      D2D1::RectF(static_cast<float>(state.inputRect.left + 8), static_cast<float>(state.inputRect.top + 8),
                  static_cast<float>(state.inputRect.right - 8),
                  static_cast<float>(state.inputRect.bottom - 4)),
      inputBrush);

  const HRESULT hr = renderTarget->EndDraw();
  if (hr == D2DERR_RECREATE_TARGET) {
    brushTarget_ = nullptr;
    return false;
  }
  return SUCCEEDED(hr);
}

}  // namespace verdant::hud
