#pragma once

#include <algorithm>
#include <cmath>
#include <limits>
#include <optional>
#include <vector>

#include "aim_assist.hpp"

namespace verdant::aim {

struct TargetAssistBone {
  Vec2 screenPos{};
  Vec2 previousScreenPos{};
  Vec2 screenVelocity{};
  bool visible = false;
  bool hasPreviousScreenPos = false;
  bool hasVelocity = false;
};

struct TargetAssistCandidate {
  int id = -1;
  TargetAssistBone head{};
  TargetAssistBone chest{};

  // Higher values win ties for gameplay-specific priority.
  float priority = 1.0f;
};

struct TargetAssistConfig {
  float radius = 130.0f;
  float headRadius = 80.0f;
  float lockBreakRadius = 170.0f;

  // Lower score is better. Locked targets get multiplied by this.
  float lockScoreMultiplier = 0.65f;

  // New target must beat the lock by this many pixels to take over.
  float switchMargin = 18.0f;
};

struct TargetAssistState {
  int lockedId = -1;
  AimBone lockedBone = AimBone::Custom;
};

struct TargetAssistResult {
  std::optional<Target> target{};
  int id = -1;
  AimBone bone = AimBone::Custom;
  float screenDistance = 0.0f;
  bool maintainedLock = false;
};

inline float screenDistanceSq(Vec2 a, Vec2 b) {
  const float dx = a.x - b.x;
  const float dy = a.y - b.y;
  return dx * dx + dy * dy;
}

inline Vec2 resolveVelocity(const TargetAssistBone& bone) {
  if (bone.hasVelocity) return bone.screenVelocity;
  if (bone.hasPreviousScreenPos) {
    return {
        bone.screenPos.x - bone.previousScreenPos.x,
        bone.screenPos.y - bone.previousScreenPos.y,
    };
  }
  return {};
}

inline bool resolveCandidateTarget(const TargetAssistCandidate& candidate,
                                   Vec2 crosshair,
                                   float radius,
                                   float headRadius,
                                   Target& outTarget,
                                   float& outDistanceSq) {
  const float radiusSq = radius * radius;
  const float headRadiusSq = headRadius * headRadius;

  const bool headInRange =
      candidate.head.visible && screenDistanceSq(candidate.head.screenPos, crosshair) <= radiusSq;
  const bool chestInRange =
      candidate.chest.visible && screenDistanceSq(candidate.chest.screenPos, crosshair) <= radiusSq;

  if (!headInRange && !chestInRange) return false;

  const float headDistSq = headInRange ? screenDistanceSq(candidate.head.screenPos, crosshair)
                                       : std::numeric_limits<float>::infinity();
  const float chestDistSq = chestInRange ? screenDistanceSq(candidate.chest.screenPos, crosshair)
                                         : std::numeric_limits<float>::infinity();

  const bool useHead = headInRange && (headDistSq <= headRadiusSq || !chestInRange);
  const TargetAssistBone& selectedBone = useHead ? candidate.head : candidate.chest;

  outTarget.screenPos = selectedBone.screenPos;
  outTarget.screenVelocity = resolveVelocity(selectedBone);
  outTarget.hasVelocity = selectedBone.hasVelocity || selectedBone.hasPreviousScreenPos;
  outTarget.bone = useHead ? AimBone::Head : AimBone::Chest;
  outDistanceSq = useHead ? headDistSq : chestDistSq;
  return true;
}

inline TargetAssistResult findBestTarget(const std::vector<TargetAssistCandidate>& candidates,
                                         Vec2 crosshair,
                                         const TargetAssistConfig& cfg,
                                         TargetAssistState* state = nullptr) {
  const float radius = std::max(cfg.radius, 0.0f);
  const float lockRadius = std::max(cfg.lockBreakRadius, radius);
  const float switchMarginSq = std::max(cfg.switchMargin, 0.0f) *
                               std::max(cfg.switchMargin, 0.0f);

  TargetAssistResult best{};
  float bestScore = std::numeric_limits<float>::infinity();
  TargetAssistResult locked{};
  float lockedScore = std::numeric_limits<float>::infinity();

  for (const auto& candidate : candidates) {
    Target target{};
    float distSq = 0.0f;
    if (!resolveCandidateTarget(candidate, crosshair, radius, cfg.headRadius, target, distSq)) {
      continue;
    }

    const float priority = std::max(candidate.priority, 0.001f);
    float score = distSq / priority;
    if (state && candidate.id == state->lockedId) {
      score *= std::clamp(cfg.lockScoreMultiplier, 0.0f, 1.0f);

      if (screenDistanceSq(target.screenPos, crosshair) <= lockRadius * lockRadius) {
        locked.target = target;
        locked.id = candidate.id;
        locked.bone = target.bone;
        locked.screenDistance = std::sqrt(distSq);
        locked.maintainedLock = true;
        lockedScore = score;
      }
    }

    if (score < bestScore) {
      best.target = target;
      best.id = candidate.id;
      best.bone = target.bone;
      best.screenDistance = std::sqrt(distSq);
      best.maintainedLock = state && candidate.id == state->lockedId;
      bestScore = score;
    }
  }

  if (locked.target && lockedScore <= bestScore + switchMarginSq) {
    best = locked;
  }

  if (state) {
    if (best.target) {
      state->lockedId = best.id;
      state->lockedBone = best.bone;
    } else {
      state->lockedId = -1;
      state->lockedBone = AimBone::Custom;
    }
  }

  return best;
}

inline void resetTargetAssist(TargetAssistState& state) {
  state = {};
}

}  // namespace verdant::aim
