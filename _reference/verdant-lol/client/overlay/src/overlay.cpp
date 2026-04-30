#include "overlay.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <dwmapi.h>
#include <iomanip>
#include <limits>
#include <optional>
#include <sstream>

#include "explorer.hpp"
#include "offsets.hpp"
#include "overlay_input_adapter.hpp"
#include "overlay_theme.hpp"

#pragma comment(lib, "dwmapi.lib")

namespace verdant {

namespace {

constexpr wchar_t kClassName[] = L"VerdantOverlayClass";
constexpr UINT kTimerId = 1;
constexpr OverlayMouseAssistConfig kAssistCfg{};
constexpr float kTestTargetOffsetX = 100.0f;
constexpr float kTestTargetOffsetY = -50.0f;
constexpr float kMinClipW = 0.001f;
constexpr float kLockBreakRadiusPx = 170.0f;
constexpr float kSwitchMarginPx = 22.0f;
constexpr float kMaxLosSpanPx = 340.0f;

struct WorldVec3 {
  float x = 0.0f;
  float y = 0.0f;
  float z = 0.0f;
};

struct PartCFrame {
  float m[12]{};
};

struct ViewMatrix4x4 {
  float m[16]{};
};

struct ClipSpacePoint {
  float x = 0.0f;
  float y = 0.0f;
  float w = 0.0f;
};

struct ResolvedAimPoint {
  float screenX = 0.0f;
  float screenY = 0.0f;
  WorldVec3 world{};
  const wchar_t* source = L"none";
};

struct ScreenProjectionCandidate {
  float x = 0.0f;
  float y = 0.0f;
  float score = 0.0f;
  const wchar_t* tag = L"";
};

struct CharacterTeamEntry {
  uintptr_t character = 0;
  uintptr_t team = 0;
};

struct AimCandidate {
  uintptr_t character = 0;
  float absoluteX = 0.0f;
  float absoluteY = 0.0f;
  WorldVec3 world{};
  float score = 0.0f;
  const wchar_t* source = L"";
};

struct CameraRotationVec3 {
  float x = 0.0f;
  float y = 0.0f;
  float z = 0.0f;
};

bool computeAssistDelta(float centerX,
                        float centerY,
                        float targetX,
                        float targetY,
                        const OverlayMouseAssistConfig& cfg,
                        int& outDx,
                        int& outDy) {
  float dx = targetX - centerX;
  float dy = targetY - centerY;

  // Screen-space (+Y down) -> aim-space (+Y up).
  dy = -dy;

  const float dist = std::sqrt(dx * dx + dy * dy);
  if (!std::isfinite(dist) || dist <= 0.001f || dist >= cfg.radiusPx) return false;

  // Stable low-pass style pull.
  dx *= cfg.gain;
  dy *= cfg.gain;

  dx = std::clamp(dx, -cfg.maxStepPx, cfg.maxStepPx);
  dy = std::clamp(dy, -cfg.maxStepPx, cfg.maxStepPx);

  outDx = static_cast<int>(std::lround(dx));
  outDy = static_cast<int>(std::lround(dy));
  if (cfg.invertY) outDy = -outDy;
  return !(outDx == 0 && outDy == 0);
}

bool readPartWorldPosition(MemoryBackend& mem, uintptr_t part, WorldVec3& outPos) {
  PartCFrame cframe{};
  if (mem.read(part + offsets::spatial::CFrame, &cframe, sizeof(cframe))) {
    outPos = {
        cframe.m[3],
        cframe.m[7],
        cframe.m[11],
    };
    return std::isfinite(outPos.x) && std::isfinite(outPos.y) && std::isfinite(outPos.z);
  }

  // Fallback in case CFrame read fails on a specific build/object.
  if (!mem.read(part + offsets::spatial::Position, &outPos, sizeof(outPos))) {
    return false;
  }
  return std::isfinite(outPos.x) && std::isfinite(outPos.y) && std::isfinite(outPos.z);
}

bool tryApplyKernelCameraAssist(MemoryBackend& mem,
                                uint32_t pid,
                                const WorldVec3& targetWorld,
                                float speed,
                                int fallbackDx,
                                int fallbackDy) {
  if (pid == 0) return false;
  if (!std::isfinite(speed) || speed <= 0.0f) return false;

  uintptr_t moduleBase = getModuleBase(pid);
  if (!moduleBase) return false;

  uintptr_t visualEngine = 0;
  if (!mem.read(moduleBase + offsets::engine::VisualEnginePointer, &visualEngine,
                sizeof(visualEngine)) ||
      !visualEngine) {
    return false;
  }

  uintptr_t dataModel = 0;
  if (!mem.read(visualEngine + offsets::engine::FakeDataModelToDataModel, &dataModel,
                sizeof(dataModel)) ||
      !dataModel) {
    return false;
  }

  uintptr_t workspace = 0;
  if (!mem.read(dataModel + offsets::datamodel::Workspace, &workspace, sizeof(workspace)) ||
      !workspace) {
    return false;
  }

  uintptr_t camera = 0;
  if (!mem.read(workspace + offsets::render::Camera, &camera, sizeof(camera)) || !camera) {
    return false;
  }

  auto applyDeltaFallback = [&]() -> bool {
    if (fallbackDx == 0 && fallbackDy == 0) return false;
    CameraRotationVec3 rotation{};
    if (!mem.read(camera + offsets::render::CameraRotation, &rotation, sizeof(rotation))) {
      return false;
    }
    if (!std::isfinite(rotation.x) || !std::isfinite(rotation.y) || !std::isfinite(rotation.z)) {
      return false;
    }
    constexpr float kYawScale = 0.0025f;
    constexpr float kPitchScale = 0.0025f;
    rotation.y += static_cast<float>(fallbackDx) * kYawScale;
    rotation.x += static_cast<float>(fallbackDy) * kPitchScale;
    return mem.write(camera + offsets::render::CameraRotation, &rotation, sizeof(rotation));
  };

  WorldVec3 cameraPos{};
  if (!mem.read(camera + offsets::render::CameraPos, &cameraPos, sizeof(cameraPos))) {
    return applyDeltaFallback();
  }
  if (!std::isfinite(cameraPos.x) || !std::isfinite(cameraPos.y) || !std::isfinite(cameraPos.z)) {
    return applyDeltaFallback();
  }

  WorldVec3 dir{
      targetWorld.x - cameraPos.x,
      targetWorld.y - cameraPos.y,
      targetWorld.z - cameraPos.z,
  };
  const float lenSq = dir.x * dir.x + dir.y * dir.y + dir.z * dir.z;
  if (!std::isfinite(lenSq) || lenSq <= 1e-6f) return applyDeltaFallback();
  const float invLen = 1.0f / std::sqrt(lenSq);
  dir.x *= invLen;
  dir.y *= invLen;
  dir.z *= invLen;

  constexpr float kPi = 3.14159265358979323846f;
  const float targetYaw = std::atan2(dir.x, dir.z);
  const float targetPitch = -std::asin(std::clamp(dir.y, -1.0f, 1.0f));

  CameraRotationVec3 rotation{};
  if (!mem.read(camera + offsets::render::CameraRotation, &rotation, sizeof(rotation))) {
    return applyDeltaFallback();
  }

  if (!std::isfinite(rotation.x) || !std::isfinite(rotation.y) || !std::isfinite(rotation.z)) {
    return applyDeltaFallback();
  }

  auto wrapPi = [&](float a) {
    while (a > kPi) a -= 2.0f * kPi;
    while (a < -kPi) a += 2.0f * kPi;
    return a;
  };

  const float blend = std::clamp(speed, 0.0f, 1.0f);
  const float yawError = wrapPi(targetYaw - rotation.y);
  const float pitchError = targetPitch - rotation.x;

  // Aim-assist behavior: pull camera toward target, don't snap.
  rotation.y = wrapPi(rotation.y + yawError * blend);
  rotation.x += pitchError * blend;
  // Keep a small input-like pull so assist still responds even if angle model is imperfect.
  rotation.y += static_cast<float>(fallbackDx) * 0.0012f;
  rotation.x += static_cast<float>(fallbackDy) * 0.0012f;
  rotation.x = std::clamp(rotation.x, -1.55334306f, 1.55334306f);  // +/- 89 deg

  if (mem.write(camera + offsets::render::CameraRotation, &rotation, sizeof(rotation))) return true;
  return applyDeltaFallback();
}

bool tryGetKernelBackendPid(MemoryBackend* backend, uint32_t& outPid) {
  outPid = 0;
  if (!backend) return false;

  // Overlay logic is kernel-driver only. Reject non-kernel backends explicitly.
  auto* kernel = dynamic_cast<KernelDriver*>(backend);
  if (!kernel) return false;

  if (!kernel->isOpen() && !kernel->open()) return false;
  outPid = kernel->getProcessId();
  return outPid != 0;
}

bool tryGetWindowCenterScreen(HWND hwnd, float& outX, float& outY) {
  if (!hwnd) return false;
  RECT clientRect{};
  if (!GetClientRect(hwnd, &clientRect)) return false;
  POINT topLeft{0, 0};
  if (!ClientToScreen(hwnd, &topLeft)) return false;
  const float width = static_cast<float>(clientRect.right - clientRect.left);
  const float height = static_cast<float>(clientRect.bottom - clientRect.top);
  if (width < 10.0f || height < 10.0f) return false;
  outX = static_cast<float>(topLeft.x) + width * 0.5f;
  outY = static_cast<float>(topLeft.y) + height * 0.5f;
  return true;
}

bool hasFiniteMatrix(const ViewMatrix4x4& matrix) {
  float absSum = 0.0f;
  for (float value : matrix.m) {
    if (!std::isfinite(value)) return false;
    absSum += std::abs(value);
  }
  return absSum > 0.001f;
}

ClipSpacePoint projectColumnMajor(const ViewMatrix4x4& matrix, const WorldVec3& world) {
  return {
      world.x * matrix.m[0] + world.y * matrix.m[4] + world.z * matrix.m[8] + matrix.m[12],
      world.x * matrix.m[1] + world.y * matrix.m[5] + world.z * matrix.m[9] + matrix.m[13],
      world.x * matrix.m[3] + world.y * matrix.m[7] + world.z * matrix.m[11] + matrix.m[15],
  };
}

ClipSpacePoint projectRowMajor(const ViewMatrix4x4& matrix, const WorldVec3& world) {
  return {
      world.x * matrix.m[0] + world.y * matrix.m[1] + world.z * matrix.m[2] + matrix.m[3],
      world.x * matrix.m[4] + world.y * matrix.m[5] + world.z * matrix.m[6] + matrix.m[7],
      world.x * matrix.m[12] + world.y * matrix.m[13] + world.z * matrix.m[14] + matrix.m[15],
  };
}

bool clipToScreen(const ClipSpacePoint& clip,
                  float viewportWidth,
                  float viewportHeight,
                  float preferredX,
                  float preferredY,
                  ScreenProjectionCandidate& outCandidate) {
  if (!std::isfinite(clip.w) || clip.w <= kMinClipW) return false;

  const float ndcX = clip.x / clip.w;
  const float ndcY = clip.y / clip.w;
  if (!std::isfinite(ndcX) || !std::isfinite(ndcY)) return false;
  if (std::abs(ndcX) > 1.0f || std::abs(ndcY) > 1.0f) return false;

  const float x = (ndcX * 0.5f + 0.5f) * viewportWidth;
  if (!std::isfinite(x)) return false;

  const float yInverted = (1.0f - (ndcY * 0.5f + 0.5f)) * viewportHeight;
  const float yNormal = (ndcY * 0.5f + 0.5f) * viewportHeight;
  if (!std::isfinite(yInverted) || !std::isfinite(yNormal)) return false;

  const float dxInv = x - preferredX;
  const float dyInv = yInverted - preferredY;
  const float scoreInv = dxInv * dxInv + dyInv * dyInv;

  const float dxNorm = x - preferredX;
  const float dyNorm = yNormal - preferredY;
  const float scoreNorm = dxNorm * dxNorm + dyNorm * dyNorm;

  if (scoreInv <= scoreNorm) {
    outCandidate = {x, yInverted, scoreInv, L"yi"};
  } else {
    outCandidate = {x, yNormal, scoreNorm, L"yn"};
  }
  return true;
}

bool worldToScreen(const ViewMatrix4x4& matrix,
                   const WorldVec3& world,
                   float viewportWidth,
                   float viewportHeight,
                   float preferredX,
                   float preferredY,
                   float& outX,
                   float& outY,
                   const wchar_t*& outProjectionTag) {
  ScreenProjectionCandidate best{};
  bool hasBest = false;

  const auto columnClip = projectColumnMajor(matrix, world);
  ScreenProjectionCandidate columnCandidate{};
  if (clipToScreen(columnClip, viewportWidth, viewportHeight, preferredX, preferredY,
                   columnCandidate)) {
    best = columnCandidate;
    best.tag = (columnCandidate.tag == L"yi") ? L"cm-yi" : L"cm-yn";
    hasBest = true;
  }

  const auto rowClip = projectRowMajor(matrix, world);
  ScreenProjectionCandidate rowCandidate{};
  if (clipToScreen(rowClip, viewportWidth, viewportHeight, preferredX, preferredY,
                   rowCandidate)) {
    rowCandidate.tag = (rowCandidate.tag == L"yi") ? L"rm-yi" : L"rm-yn";
    if (!hasBest || rowCandidate.score < best.score) {
      best = rowCandidate;
      hasBest = true;
    }
  }

  if (!hasBest) return false;

  outX = best.x;
  outY = best.y;
  outProjectionTag = best.tag;
  return true;
}

bool tryReadViewMatrix(MemoryBackend& mem,
                       uintptr_t visualEngine,
                       ViewMatrix4x4& outViewMatrix) {
  std::array<uintptr_t, 4> candidates{};
  std::size_t count = 0;
  candidates[count++] = visualEngine;

  uintptr_t renderView = 0;
  if (mem.read(visualEngine + offsets::render::RenderView, &renderView, sizeof(renderView)) &&
      renderView != 0) {
    candidates[count++] = renderView;

    uintptr_t renderView2 = 0;
    if (mem.read(renderView + offsets::render::ToRenderView2, &renderView2,
                 sizeof(renderView2)) &&
        renderView2 != 0) {
      candidates[count++] = renderView2;

      uintptr_t renderView3 = 0;
      if (mem.read(renderView2 + offsets::render::ToRenderView3, &renderView3,
                   sizeof(renderView3)) &&
          renderView3 != 0) {
        candidates[count++] = renderView3;
      }
    }
  }

  for (std::size_t i = 0; i < count; ++i) {
    ViewMatrix4x4 candidate{};
    if (!mem.read(candidates[i] + offsets::render::ViewMatrix, &candidate, sizeof(candidate))) {
      continue;
    }
    if (!hasFiniteMatrix(candidate)) continue;
    outViewMatrix = candidate;
    return true;
  }

  return false;
}

std::optional<ResolvedAimPoint> tryResolveAimPoint(MemoryBackend& mem,
                                                   uint32_t pid,
                                                   HWND robloxWindow,
                                                   float crosshairScreenX,
                                                   float crosshairScreenY,
                                                   uintptr_t& lockedCharacter) {
  if (pid == 0 || !robloxWindow) return std::nullopt;

  uintptr_t moduleBase = getModuleBase(pid);
  if (!moduleBase) return std::nullopt;

  uintptr_t visualEngine = 0;
  if (!mem.read(moduleBase + offsets::engine::VisualEnginePointer, &visualEngine,
                sizeof(visualEngine)) ||
      !visualEngine) {
    return std::nullopt;
  }

  uintptr_t dataModel = 0;
  if (!mem.read(visualEngine + offsets::engine::FakeDataModelToDataModel, &dataModel,
                sizeof(dataModel)) ||
      !dataModel) {
    return std::nullopt;
  }

  uintptr_t localPlayer = 0;
  if (!mem.read(dataModel + offsets::player::LocalPlayer, &localPlayer, sizeof(localPlayer)) ||
      !localPlayer) {
    return std::nullopt;
  }

  uintptr_t localCharacter = 0;
  mem.read(localPlayer + offsets::player::Character, &localCharacter, sizeof(localCharacter));
  uintptr_t localTeam = 0;
  mem.read(localPlayer + offsets::player::Team, &localTeam, sizeof(localTeam));

  uintptr_t workspace = 0;
  if (!mem.read(dataModel + offsets::datamodel::Workspace, &workspace, sizeof(workspace)) ||
      !workspace) {
    return std::nullopt;
  }

  ViewMatrix4x4 viewMatrix{};
  if (!tryReadViewMatrix(mem, visualEngine, viewMatrix)) return std::nullopt;

  RECT clientRect{};
  if (!GetClientRect(robloxWindow, &clientRect)) return std::nullopt;
  const float viewportWidth = static_cast<float>(clientRect.right - clientRect.left);
  const float viewportHeight = static_cast<float>(clientRect.bottom - clientRect.top);
  if (viewportWidth < 10.0f || viewportHeight < 10.0f) return std::nullopt;

  POINT origin{0, 0};
  if (!ClientToScreen(robloxWindow, &origin)) return std::nullopt;
  const float crosshairClientX = crosshairScreenX - static_cast<float>(origin.x);
  const float crosshairClientY = crosshairScreenY - static_cast<float>(origin.y);

  const auto workspaceChildren = getChildren(mem, workspace);
  if (workspaceChildren.empty()) return std::nullopt;

  uintptr_t playersService = 0;
  const auto dataModelChildren = getChildren(mem, dataModel);
  for (const auto& child : dataModelChildren) {
    if (child.className == "Players") {
      playersService = child.address;
      break;
    }
  }

  std::vector<CharacterTeamEntry> characterTeams;
  if (playersService != 0) {
    const auto players = getChildren(mem, playersService);
    characterTeams.reserve(players.size());
    for (const auto& player : players) {
      uintptr_t character = 0;
      if (!mem.read(player.address + offsets::player::Character, &character, sizeof(character)) ||
          !character) {
        continue;
      }
      uintptr_t team = 0;
      mem.read(player.address + offsets::player::Team, &team, sizeof(team));
      characterTeams.push_back({character, team});
    }
  }

  const auto findTeamForCharacter = [&](uintptr_t character) -> uintptr_t {
    for (const auto& entry : characterTeams) {
      if (entry.character == character) return entry.team;
    }
    return 0;
  };

  AimCandidate bestCandidate{};
  bool hasBest = false;
  AimCandidate lockedCandidate{};
  bool hasLockedCandidate = false;

  for (const auto& model : workspaceChildren) {
    if (model.className != "Model") continue;
    if (model.address == 0 || model.address == localCharacter) continue;

    if (localTeam != 0) {
      const uintptr_t team = findTeamForCharacter(model.address);
      if (team != 0 && team == localTeam) continue;
    }

    const auto parts = getChildren(mem, model.address);
    if (parts.empty()) continue;

    uintptr_t head = 0;
    uintptr_t neck = 0;
    uintptr_t torsoLike = 0;
    uintptr_t rootPart = 0;
    for (const auto& part : parts) {
      if (part.address == 0) continue;
      if (part.name == "Head") {
        head = part.address;
        continue;
      }
      if (!neck && part.name == "Neck") {
        neck = part.address;
      }
      if (!torsoLike && (part.name == "UpperTorso" || part.name == "Torso")) {
        torsoLike = part.address;
      }
      if (!rootPart && part.name == "HumanoidRootPart") {
        rootPart = part.address;
      }
    }

    const uintptr_t targetPart = head ? head : (neck ? neck : (torsoLike ? torsoLike : rootPart));
    if (!targetPart) continue;

    WorldVec3 worldPos{};
    if (!readPartWorldPosition(mem, targetPart, worldPos)) continue;

    // Slight upward bias helps keep lock near head center.
    worldPos.y += 0.5f;

    float clientX = 0.0f;
    float clientY = 0.0f;
    const wchar_t* projectionTag = L"proj";
    if (!worldToScreen(viewMatrix, worldPos, viewportWidth, viewportHeight, crosshairClientX,
                       crosshairClientY, clientX, clientY, projectionTag)) {
      continue;
    }

    // Practical visibility/LOS gate: require two body anchors to project cleanly and
    // keep a sane on-screen body span so we skip malformed/occluded candidates.
    const uintptr_t upperAnchor = head ? head : neck;
    if (upperAnchor != 0 && (torsoLike != 0 || rootPart != 0)) {
      WorldVec3 upperPos{};
      WorldVec3 torsoPos{};
      const uintptr_t torsoAnchor = torsoLike ? torsoLike : rootPart;
      if (!readPartWorldPosition(mem, upperAnchor, upperPos) ||
          !readPartWorldPosition(mem, torsoAnchor, torsoPos)) {
        continue;
      }
      float upperX = 0.0f;
      float upperY = 0.0f;
      float torsoX = 0.0f;
      float torsoY = 0.0f;
      const wchar_t* upperProj = L"";
      const wchar_t* torsoProj = L"";
      if (!worldToScreen(viewMatrix, upperPos, viewportWidth, viewportHeight, crosshairClientX,
                         crosshairClientY, upperX, upperY, upperProj) ||
          !worldToScreen(viewMatrix, torsoPos, viewportWidth, viewportHeight, crosshairClientX,
                         crosshairClientY, torsoX, torsoY, torsoProj)) {
        continue;
      }
      const float spanX = upperX - torsoX;
      const float spanY = upperY - torsoY;
      const float span = std::sqrt(spanX * spanX + spanY * spanY);
      if (!std::isfinite(span) || span < 2.0f || span > kMaxLosSpanPx) continue;
    }

    const float absoluteX = static_cast<float>(origin.x) + clientX;
    const float absoluteY = static_cast<float>(origin.y) + clientY;
    const float dx = absoluteX - crosshairScreenX;
    const float dy = absoluteY - crosshairScreenY;
    const float score = dx * dx + dy * dy;
    if (!std::isfinite(score)) continue;

    AimCandidate candidate{
        model.address,
        absoluteX,
        absoluteY,
        worldPos,
        score,
        projectionTag,
    };

    if (!hasBest || candidate.score < bestCandidate.score) {
      bestCandidate = candidate;
      hasBest = true;
    }

    if (lockedCharacter != 0 && model.address == lockedCharacter) {
      lockedCandidate = candidate;
      hasLockedCandidate = true;
    }
  }

  const float lockBreakRadiusSq = kLockBreakRadiusPx * kLockBreakRadiusPx;
  const float switchMarginSq = kSwitchMarginPx * kSwitchMarginPx;

  if (!hasBest) {
    lockedCharacter = 0;
    return std::nullopt;
  }

  AimCandidate selected = bestCandidate;
  if (hasLockedCandidate && lockedCandidate.score <= lockBreakRadiusSq) {
    selected = lockedCandidate;
    if (bestCandidate.character != lockedCandidate.character &&
        bestCandidate.score + switchMarginSq < lockedCandidate.score) {
      selected = bestCandidate;
    }
  }

  lockedCharacter = selected.character;
  return ResolvedAimPoint{
      selected.absoluteX,
      selected.absoluteY,
      selected.world,
      selected.source,
  };
}

}  // namespace

OverlayWindow::OverlayWindow() = default;

OverlayWindow::~OverlayWindow() {
  releaseRenderTargets();
  if (hwnd_) DestroyWindow(hwnd_);
}

LRESULT CALLBACK OverlayWindow::staticWndProc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
  OverlayWindow* self = nullptr;
  if (msg == WM_NCCREATE) {
    auto* cs = reinterpret_cast<CREATESTRUCTW*>(lp);
    self = reinterpret_cast<OverlayWindow*>(cs->lpCreateParams);
    SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
    self->hwnd_ = hwnd;
  } else {
    self = reinterpret_cast<OverlayWindow*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
  }
  if (self) return self->wndProc(msg, wp, lp);
  return DefWindowProcW(hwnd, msg, wp, lp);
}

bool OverlayWindow::create(HINSTANCE hInst) {
  hInst_ = hInst;
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

  WNDCLASSEXW wc{};
  wc.cbSize = sizeof(wc);
  wc.style = CS_HREDRAW | CS_VREDRAW;
  wc.lpfnWndProc = &OverlayWindow::staticWndProc;
  wc.hInstance = hInst;
  wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
  wc.hbrBackground = nullptr;
  wc.lpszClassName = kClassName;
  if (!RegisterClassExW(&wc) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) return false;

  const DWORD exStyle = WS_EX_LAYERED | WS_EX_TOPMOST | WS_EX_TOOLWINDOW;
  const DWORD style = WS_POPUP | WS_VISIBLE;
  hwnd_ = CreateWindowExW(exStyle, kClassName, L"Verdant HUD", style, 0, 0, hud::HudTheme::kOverlayWidth,
                          hud::HudTheme::kOverlayHeight, nullptr, nullptr, hInst, this);
  if (!hwnd_) return false;

  SetLayeredWindowAttributes(hwnd_, 0, 235, LWA_ALPHA);
  mouseInput_.registerRawMouse(hwnd_);

  HRESULT hr = D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED, d2dFactory_.GetAddressOf());
  if (FAILED(hr)) return false;
  hr = DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED, __uuidof(IDWriteFactory),
                           reinterpret_cast<IUnknown**>(dwriteFactory_.GetAddressOf()));
  if (FAILED(hr)) return false;
  hudPainter_.setDWriteFactory(dwriteFactory_.Get());

  positionToCorner();
  ShowWindow(hwnd_, SW_SHOWNOACTIVATE);
  SetTimer(hwnd_, kTimerId, 33, nullptr);
  return true;
}

void OverlayWindow::positionToCorner() {
  RECT work{};
  HMONITOR mon = MonitorFromWindow(hwnd_, MONITOR_DEFAULTTOPRIMARY);
  MONITORINFO mi{sizeof(mi)};
  if (GetMonitorInfoW(mon, &mi)) {
    work = mi.rcWork;
  } else {
    SystemParametersInfoW(SPI_GETWORKAREA, 0, &work, 0);
  }
  const int margin = 16;
  const int x = work.right - hud::HudTheme::kOverlayWidth - margin;
  const int y = work.bottom - hud::HudTheme::kOverlayHeight - margin;
  SetWindowPos(hwnd_, HWND_TOPMOST, x, y, hud::HudTheme::kOverlayWidth, hud::HudTheme::kOverlayHeight,
               SWP_NOACTIVATE | SWP_SHOWWINDOW);
}

bool OverlayWindow::ensureRenderTargets() {
  if (renderTarget_) return true;
  RECT rc{};
  GetClientRect(hwnd_, &rc);
  const D2D1_SIZE_U size = D2D1::SizeU(rc.right - rc.left, rc.bottom - rc.top);
  const HRESULT hr = d2dFactory_->CreateHwndRenderTarget(
      D2D1::RenderTargetProperties(), D2D1::HwndRenderTargetProperties(hwnd_, size),
      renderTarget_.GetAddressOf());
  return SUCCEEDED(hr);
}

void OverlayWindow::releaseRenderTargets() {
  renderTarget_.Reset();
}

void OverlayWindow::onTick() {
  const auto now = std::chrono::steady_clock::now();
  const auto mouseFrame = mouseInput_.consumeFrame();

  POINT cursor{};
  if (!offsets::win32::GetCursorPos(&cursor)) cursor = mouseFrame.cursor;
  bool moved = false;
  bool usedKernelAim = false;
  float targetX = static_cast<float>(cursor.x);
  float targetY = static_cast<float>(cursor.y);
  int assistDx = 0;
  int assistDy = 0;
  float crossX = static_cast<float>(cursor.x);
  float crossY = static_cast<float>(cursor.y);
  const bool hasWindowCenter = tryGetWindowCenterScreen(lastRobloxWindow_, crossX, crossY);
  std::wstring targetSource = L"kernel-only";
  uint32_t kernelPid = 0;
  const bool hasKernelPid = tryGetKernelBackendPid(backend_, kernelPid);
  if (mouseFrame.rightDown) {
    if (!hasKernelPid) {
      targetSource = L"no-kernel";
    } else {
      std::optional<ResolvedAimPoint> resolved;
      resolved = tryResolveAimPoint(*backend_, kernelPid, lastRobloxWindow_, crossX, crossY,
                                    lockedTargetCharacter_);

      if (resolved) {
        targetX = resolved->screenX;
        targetY = resolved->screenY;
        targetSource = resolved->source;
      } else {
        targetSource = L"no-target";
      }

      if (resolved &&
          computeAssistDelta(crossX, crossY, targetX, targetY, kAssistCfg, assistDx, assistDy)) {
        const float dxF = targetX - crossX;
        const float dyF = targetY - crossY;
        const float screenDist = std::sqrt(dxF * dxF + dyF * dyF);
        const float normalized =
            std::clamp(screenDist / std::max(1.0f, kAssistCfg.radiusPx), 0.0f, 1.0f);
        const float assistSpeed = 0.02f + normalized * 0.20f;
        usedKernelAim = tryApplyKernelCameraAssist(*backend_, kernelPid, resolved->world,
                                                   assistSpeed, assistDx, assistDy);
        moved = usedKernelAim;
      }
    }
  }

  std::wostringstream aimStatus;
  aimStatus << std::fixed << std::setprecision(1) << L"Cursor " << cursor.x << L"," << cursor.y
            << L" Center " << crossX << L"," << crossY
            << L" Target " << targetX << L"," << targetY << L" raw " << mouseFrame.deltaX << L","
            << mouseFrame.deltaY << L" assist " << (moved ? L"on" : L"off") << L" d "
            << assistDx << L"," << assistDy << L" src " << targetSource << L" mode "
            << (usedKernelAim ? L"kernel" : L"none") << L" center "
            << (hasWindowCenter ? L"win" : L"cursor");
  lastAimStatus_ = aimStatus.str();

  if (now - lastCaretBlink_ > std::chrono::milliseconds(500)) {
    caretOn_ = !caretOn_;
    lastCaretBlink_ = now;
  }

  if (now - lastTargetCheck_ > std::chrono::milliseconds(2000)) {
    lastTargetCheck_ = now;
    RobloxTarget t = findRoblox();
    if (t.pid == 0) {
      lastRobloxWindow_ = nullptr;
      lockedTargetCharacter_ = 0;
      if (backend_ && backend_->getProcessId() != 0) backend_->setProcessId(0);
      lastTargetStatus_ = L"Roblox ikke funnet";
    } else {
      lastRobloxWindow_ = t.window;
      if (backend_) {
        if (backend_->getProcessId() != t.pid) backend_->setProcessId(t.pid);
        if (!backend_->isOpen()) backend_->open();
      }
      uint32_t statusPid = 0;
      const bool statusHasKernelPid = tryGetKernelBackendPid(backend_, statusPid);
      uintptr_t base = statusHasKernelPid ? getModuleBase(statusPid) : 0;
      lastTargetStatus_ = statusHasKernelPid
                              ? (L"Kernel PID " + std::to_wstring(statusPid) +
                                 (base != 0 ? L" • base 0x" + std::to_wstring(base) : L""))
                              : L"Kernel/PID ikke tilgjengelig";
    }
  }

  InvalidateRect(hwnd_, nullptr, FALSE);
}

void OverlayWindow::onPaint() {
  if (!ensureRenderTargets()) return;

  RECT rc{};
  GetClientRect(hwnd_, &rc);
  const float w = static_cast<float>(rc.right - rc.left);
  const float h = static_cast<float>(rc.bottom - rc.top);
  inputRect_ = {
      static_cast<LONG>(hud::HudTheme::kPadding),
      static_cast<LONG>(h - hud::HudTheme::kInputHeight - hud::HudTheme::kPadding),
      static_cast<LONG>(w - hud::HudTheme::kPadding),
      static_cast<LONG>(h - hud::HudTheme::kPadding),
  };

  std::wstring statusText = lastTargetStatus_;
  if (!lastAimStatus_.empty()) statusText = lastAimStatus_ + L" • " + statusText;
  if (chat_) {
    std::wstring s = chat_->statusLine();
    if (!s.empty()) statusText = s + L" • " + lastTargetStatus_;
  }

  hudState_.width = w;
  hudState_.height = h;
  hudState_.title = title_;
  hudState_.statusText = statusText;
  hudState_.inputText = inputText_;
  hudState_.inputFocused = inputFocused_;
  hudState_.caretOn = caretOn_;
  hudState_.inputRect = inputRect_;
  hudState_.messages = chat_ ? chat_->snapshotMessages() : std::vector<ChatMessage>{};
  if (!hudPainter_.paint(renderTarget_.Get(), hudState_)) {
    releaseRenderTargets();
  }
}

void OverlayWindow::appendInputChar(wchar_t c) {
  if (inputText_.size() >= 500) return;
  inputText_.push_back(c);
}

void OverlayWindow::backspaceInput() {
  if (!inputText_.empty()) inputText_.pop_back();
}

void OverlayWindow::submitInput() {
  if (inputText_.empty()) return;
  if (chat_) chat_->sendMessage(inputText_);
  inputText_.clear();
}

LRESULT OverlayWindow::wndProc(UINT msg, WPARAM wp, LPARAM lp) {
  switch (msg) {
    case WM_PAINT: {
      PAINTSTRUCT ps{};
      BeginPaint(hwnd_, &ps);
      onPaint();
      EndPaint(hwnd_, &ps);
      return 0;
    }
    case WM_TIMER:
      if (wp == kTimerId) onTick();
      return 0;
    case WM_INPUT:
      mouseInput_.handleRawInput(lp);
      return 0;
    case WM_LBUTTONDOWN: {
      POINT p{LOWORD(lp), HIWORD(lp)};
      inputFocused_ = (p.x >= inputRect_.left && p.x <= inputRect_.right && p.y >= inputRect_.top &&
                       p.y <= inputRect_.bottom);
      InvalidateRect(hwnd_, nullptr, FALSE);
      return 0;
    }
    case WM_KEYDOWN:
      if (!inputFocused_) return 0;
      if (wp == VK_RETURN) {
        submitInput();
        return 0;
      }
      if (wp == VK_BACK) {
        backspaceInput();
        return 0;
      }
      if (wp == VK_ESCAPE) {
        inputText_.clear();
        inputFocused_ = false;
        return 0;
      }
      return 0;
    case WM_CHAR:
      if (!inputFocused_) return 0;
      if (wp >= 32 && wp != 127) appendInputChar(static_cast<wchar_t>(wp));
      return 0;
    case WM_SIZE:
      if (renderTarget_) {
        RECT sizeRc{};
        GetClientRect(hwnd_, &sizeRc);
        renderTarget_->Resize(D2D1::SizeU(sizeRc.right - sizeRc.left, sizeRc.bottom - sizeRc.top));
      }
      return 0;
    case WM_DISPLAYCHANGE:
      positionToCorner();
      InvalidateRect(hwnd_, nullptr, FALSE);
      return 0;
    case WM_NCHITTEST: {
      LRESULT hit = DefWindowProcW(hwnd_, msg, wp, lp);
      POINT p{LOWORD(lp), HIWORD(lp)};
      ScreenToClient(hwnd_, &p);
      if (p.y >= 0 && p.y < hud::HudTheme::kHeaderHeight) return HTCAPTION;
      return hit;
    }
    case WM_DESTROY:
      KillTimer(hwnd_, kTimerId);
      PostQuitMessage(0);
      return 0;
  }
  return DefWindowProcW(hwnd_, msg, wp, lp);
}

void OverlayWindow::runMessageLoop() {
  MSG msg{};
  while (GetMessageW(&msg, nullptr, 0, 0)) {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }
}

}  // namespace verdant
