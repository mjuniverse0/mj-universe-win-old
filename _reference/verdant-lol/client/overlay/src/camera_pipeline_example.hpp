#pragma once

#include <vector>

#include "aim_assist.hpp"
#include "camera_update.hpp"
#include "target_assist.hpp"
#include "win32_mouse_input.hpp"

namespace verdant::example {

struct ExamplePlayer {
  int id = -1;
  aim::Vec3 head{};
  aim::Vec3 chest{};

  aim::Vec2 previousHeadScreen{};
  aim::Vec2 previousChestScreen{};
  bool hasPreviousScreen = false;
};

struct ExampleAimContext {
  CameraState camera{};
  aim::AimAssistConfig aimCfg = aim::makeControllerFeelAimAssistConfig();
  aim::AimAssistState aimState{};
  aim::TargetAssistConfig targetCfg{};
  aim::TargetAssistState targetState{};
  CameraUpdateConfig updateCfg{};
};

template <typename WorldToScreen>
CameraPipelineResult updateExampleCamera(ExampleAimContext& ctx,
                                         const input::MouseFrame& mouseFrame,
                                         const std::vector<ExamplePlayer>& players,
                                         WorldToScreen&& worldToScreen,
                                         float dtSeconds) {
  std::vector<aim::TargetAssistCandidate> candidates;
  candidates.reserve(players.size());

  for (const auto& player : players) {
    aim::Vec2 headScreen{};
    aim::Vec2 chestScreen{};

    const bool headVisible = worldToScreen(player.head, headScreen);
    const bool chestVisible = worldToScreen(player.chest, chestScreen);
    if (!headVisible && !chestVisible) continue;

    aim::TargetAssistCandidate candidate{};
    candidate.id = player.id;

    candidate.head.screenPos = headScreen;
    candidate.head.previousScreenPos = player.previousHeadScreen;
    candidate.head.visible = headVisible;
    candidate.head.hasPreviousScreenPos = player.hasPreviousScreen && headVisible;

    candidate.chest.screenPos = chestScreen;
    candidate.chest.previousScreenPos = player.previousChestScreen;
    candidate.chest.visible = chestVisible;
    candidate.chest.hasPreviousScreenPos = player.hasPreviousScreen && chestVisible;

    candidates.push_back(candidate);
  }

  return updateCameraFromMouseAndTargets(ctx.camera,
                                         mouseFrame,
                                         candidates,
                                         ctx.targetCfg,
                                         ctx.targetState,
                                         ctx.aimCfg,
                                         ctx.aimState,
                                         dtSeconds,
                                         ctx.updateCfg);
}

}  // namespace verdant::example
