#pragma once

#include <algorithm>
#include <cmath>
#include <optional>
#include <vector>

#include "aim_assist.hpp"
#include "camera.hpp"
#include "target_assist.hpp"
#include "utils.hpp"
#include "win32_mouse_input.hpp"

namespace verdant {

struct CameraUpdateConfig {
  float mouseScale = 0.0022f;
  float mouseCurve = 1.6f;
  aim::Vec2 crosshair{};
};

struct CameraPipelineResult {
  aim::AimAssistResult assist{};
  aim::Vec2 input{};
  aim::Vec2 targetScreen{};
  int targetId = -1;
  aim::AimBone selectedBone = aim::AimBone::Custom;
  float headBlend = 0.0f;
  bool usedTarget = false;
  bool maintainedLock = false;
};

inline aim::Vec2 toAimVec2(Vec2 value) {
  return {value.x, value.y};
}

inline aim::Vec2 mouseFrameToAimInput(const input::MouseFrame& mouse,
                                      const CameraUpdateConfig& updateCfg = {}) {
  return toAimVec2(mouseToStick(mouse.deltaX, mouse.deltaY, updateCfg.mouseScale,
                                updateCfg.mouseCurve));
}

inline POINT aimAssistPullToMouseDelta(aim::Vec2 assistPull,
                                       const CameraUpdateConfig& updateCfg = {}) {
  const float scale = std::max(updateCfg.mouseScale, 0.0001f);
  return {
      static_cast<LONG>(std::lround(assistPull.x / scale)),
      static_cast<LONG>(std::lround(assistPull.y / scale)),
  };
}

inline void updateCameraFromMouse(CameraState& camera,
                                  const input::MouseFrame& mouse,
                                  const aim::Target* target,
                                  const aim::AimAssistConfig& aimCfg,
                                  aim::AimAssistState& aimState,
                                  float dtSeconds,
                                  const CameraUpdateConfig& updateCfg = {}) {
  const Vec2 stick = mouseToStick(mouse.deltaX, mouse.deltaY, updateCfg.mouseScale,
                                  updateCfg.mouseCurve);

  const auto result = aim::applyAimAssist(
      toAimVec2(stick),
      updateCfg.crosshair,
      target ? std::optional<aim::Target>(*target) : std::nullopt,
      aimCfg,
      &aimState,
      dtSeconds);

  camera.yaw += result.yawDelta * camera.sens * camera.accel;
  camera.pitch += result.pitchDelta * camera.sens * camera.accel;

  clampPitch(camera);
}

template <typename WorldToScreen>
inline CameraPipelineResult updateCameraFromMouseAndBones(CameraState& camera,
                                                          const input::MouseFrame& mouse,
                                                          const aim::Bones3D& bones,
                                                          float worldDistance,
                                                          float screenDistance,
                                                          WorldToScreen&& worldToScreen,
                                                          const aim::BoneChoiceConfig& boneCfg,
                                                          const aim::AimAssistConfig& aimCfg,
                                                          aim::AimAssistState& aimState,
                                                          float dtSeconds,
                                                          const CameraUpdateConfig& updateCfg = {}) {
  const aim::Vec2 input = mouseFrameToAimInput(mouse, updateCfg);
  const auto choice = aim::chooseTargetBone(bones, worldDistance, screenDistance, boneCfg);

  std::optional<aim::Target> target;
  aim::Vec2 targetScreen{};
  if (worldToScreen(choice.worldPos, targetScreen)) {
    target = aim::Target{
        targetScreen,
        {},
        false,
        choice.bone,
    };
  }

  const auto assist = aim::applyAimAssist(input,
                                          updateCfg.crosshair,
                                          target,
                                          aimCfg,
                                          &aimState,
                                          dtSeconds);

  camera.yaw += assist.yawDelta * camera.sens * camera.accel;
  camera.pitch += assist.pitchDelta * camera.sens * camera.accel;
  clampPitch(camera);

  return {
      assist,
      input,
      targetScreen,
      -1,
      choice.bone,
      choice.headBlend,
      target.has_value(),
      false,
  };
}

inline CameraPipelineResult updateCameraFromMouseAndTargets(
    CameraState& camera,
    const input::MouseFrame& mouse,
    const std::vector<aim::TargetAssistCandidate>& candidates,
    const aim::TargetAssistConfig& targetCfg,
    aim::TargetAssistState& targetState,
    const aim::AimAssistConfig& aimCfg,
    aim::AimAssistState& aimState,
    float dtSeconds,
    const CameraUpdateConfig& updateCfg = {}) {
  const aim::Vec2 input = mouseFrameToAimInput(mouse, updateCfg);
  const auto selected = aim::findBestTarget(candidates, updateCfg.crosshair, targetCfg,
                                            &targetState);

  const auto assist = aim::applyAimAssist(input,
                                          updateCfg.crosshair,
                                          selected.target,
                                          aimCfg,
                                          &aimState,
                                          dtSeconds);

  camera.yaw += assist.yawDelta * camera.sens * camera.accel;
  camera.pitch += assist.pitchDelta * camera.sens * camera.accel;
  clampPitch(camera);

  return {
      assist,
      input,
      selected.target ? selected.target->screenPos : aim::Vec2{},
      selected.id,
      selected.bone,
      0.0f,
      selected.target.has_value(),
      selected.maintainedLock,
  };
}

}  // namespace verdant
