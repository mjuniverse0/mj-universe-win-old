#include "aim_assist.hpp"

#include <algorithm>
#include <cmath>

namespace verdant::aim {

namespace {

constexpr float kEpsilon = 0.000001f;

float clamp01(float value) {
  return std::clamp(value, 0.0f, 1.0f);
}

float safePositive(float value, float fallback) {
  return value > kEpsilon ? value : fallback;
}

float smootherStep(float t) {
  t = clamp01(t);
  return t * t * t * (t * (t * 6.0f - 15.0f) + 10.0f);
}

float mix(float a, float b, float t) {
  return a + (b - a) * clamp01(t);
}

Vec2 normalizeOrZero(Vec2 value) {
  const float len = length(value);
  if (len <= kEpsilon) return {};
  return value / len;
}

bool isSelectable(const BonePoint& bone) {
  return bone.visible;
}

const BonePoint* boneFor(const AimTargetCandidate& candidate, AimBone bone) {
  switch (bone) {
    case AimBone::Head:
      return &candidate.head;
    case AimBone::Neck:
      return &candidate.neck;
    case AimBone::Chest:
      return &candidate.chest;
    case AimBone::Pelvis:
      return &candidate.pelvis;
    case AimBone::Custom:
      return nullptr;
  }

  return nullptr;
}

Target toTarget(const BonePoint& bone) {
  return {
      bone.screenPos,
      bone.screenVelocity,
      bone.hasVelocity,
      bone.bone,
  };
}

Vec2 applyRadialDeadzone(Vec2 input, float deadzone, float acceleration) {
  const float mag = length(input);
  const float dz = std::clamp(deadzone, 0.0f, 0.99f);

  if (mag <= dz) return {};

  const float normalizedMag = std::min(mag, 1.0f);
  const float scaledMag = (normalizedMag - dz) / (1.0f - dz);
  const float curvedMag = std::pow(clamp01(scaledMag), safePositive(acceleration, 1.0f));

  return normalizeOrZero(input) * curvedMag;
}

Vec2 smoothInput(Vec2 current, AimAssistState* state, float halfLife, float dtSeconds) {
  if (!state || halfLife <= 0.0f) return current;

  if (!state->hasSmoothedInput) {
    state->smoothedInput = current;
    state->hasSmoothedInput = true;
    return current;
  }

  const float dt = std::max(dtSeconds, 0.0f);
  const float alpha = 1.0f - std::pow(0.5f, dt / safePositive(halfLife, 0.001f));
  state->smoothedInput = state->smoothedInput + (current - state->smoothedInput) * clamp01(alpha);
  return state->smoothedInput;
}

}  // namespace

Vec2& Vec2::operator+=(Vec2 rhs) {
  x += rhs.x;
  y += rhs.y;
  return *this;
}

Vec2& Vec2::operator-=(Vec2 rhs) {
  x -= rhs.x;
  y -= rhs.y;
  return *this;
}

Vec2& Vec2::operator*=(float scalar) {
  x *= scalar;
  y *= scalar;
  return *this;
}

Vec2& Vec2::operator/=(float scalar) {
  x /= scalar;
  y /= scalar;
  return *this;
}

Vec2 operator+(Vec2 lhs, Vec2 rhs) {
  lhs += rhs;
  return lhs;
}

Vec2 operator-(Vec2 lhs, Vec2 rhs) {
  lhs -= rhs;
  return lhs;
}

Vec2 operator*(Vec2 value, float scalar) {
  value *= scalar;
  return value;
}

Vec2 operator*(float scalar, Vec2 value) {
  value *= scalar;
  return value;
}

Vec2 operator/(Vec2 value, float scalar) {
  value /= scalar;
  return value;
}

Vec3& Vec3::operator+=(Vec3 rhs) {
  x += rhs.x;
  y += rhs.y;
  z += rhs.z;
  return *this;
}

Vec3& Vec3::operator-=(Vec3 rhs) {
  x -= rhs.x;
  y -= rhs.y;
  z -= rhs.z;
  return *this;
}

Vec3& Vec3::operator*=(float scalar) {
  x *= scalar;
  y *= scalar;
  z *= scalar;
  return *this;
}

Vec3& Vec3::operator/=(float scalar) {
  x /= scalar;
  y /= scalar;
  z /= scalar;
  return *this;
}

Vec3 operator+(Vec3 lhs, Vec3 rhs) {
  lhs += rhs;
  return lhs;
}

Vec3 operator-(Vec3 lhs, Vec3 rhs) {
  lhs -= rhs;
  return lhs;
}

Vec3 operator*(Vec3 value, float scalar) {
  value *= scalar;
  return value;
}

Vec3 operator*(float scalar, Vec3 value) {
  value *= scalar;
  return value;
}

Vec3 operator/(Vec3 value, float scalar) {
  value /= scalar;
  return value;
}

float length(Vec2 value) {
  return std::sqrt(value.x * value.x + value.y * value.y);
}

float distance(Vec2 lhs, Vec2 rhs) {
  return length(lhs - rhs);
}

Vec2 clampLength(Vec2 value, float maxLength) {
  const float limit = std::max(maxLength, 0.0f);
  const float len = length(value);
  if (limit <= kEpsilon || len <= limit) return value;
  return value * (limit / len);
}

Vec3 lerp(Vec3 from, Vec3 to, float t) {
  return from + (to - from) * clamp01(t);
}

std::optional<Target> selectAimTarget(const AimTargetCandidate& candidate,
                                      Vec2 crosshair,
                                      Vec2 stickInput,
                                      const TargetSelectionConfig& cfg,
                                      TargetSelectionState* state,
                                      float dtSeconds) {
  const float assistRadius = safePositive(cfg.assistRadius, 1.0f);
  const float headRadius = std::clamp(cfg.headRadius, 0.0f, assistRadius);
  const float dt = std::max(dtSeconds, 0.0f);

  if (state) {
    if (length(stickInput) <= std::max(cfg.stableInputThreshold, 0.0f)) {
      state->stableAimSeconds += dt;
    } else {
      state->stableAimSeconds = 0.0f;
    }
  }

  const BonePoint* body = nullptr;
  for (const BonePoint* bone : {&candidate.chest, &candidate.neck, &candidate.pelvis}) {
    if (!isSelectable(*bone)) continue;
    if (distance(crosshair, bone->screenPos) > assistRadius) continue;

    if (!body || distance(crosshair, bone->screenPos) < distance(crosshair, body->screenPos)) {
      body = bone;
    }
  }

  const bool closeRange =
      !candidate.hasDistanceToPlayer || candidate.distanceToPlayer <= cfg.closeRangeDistance;
  const bool stableAim =
      !state || state->stableAimSeconds >= std::max(cfg.stableTimeForHead, 0.0f);

  const bool headAllowed = isSelectable(candidate.head) && closeRange && stableAim &&
                           distance(crosshair, candidate.head.screenPos) <= headRadius;

  const BonePoint* selected = body;
  if (headAllowed) {
    selected = &candidate.head;
  }

  if (!selected) {
    if (state) {
      state->hasSelectedBone = false;
      state->selectedBone = AimBone::Custom;
    }
    return std::nullopt;
  }

  if (state && state->hasSelectedBone && state->selectedBone != selected->bone) {
    const BonePoint* previous = boneFor(candidate, state->selectedBone);
    const bool previousAllowed = previous && (previous->bone != AimBone::Head || headAllowed);
    if (previousAllowed && isSelectable(*previous) &&
        distance(crosshair, previous->screenPos) <= assistRadius) {
      const float selectedDist = distance(crosshair, selected->screenPos);
      const float previousDist = distance(crosshair, previous->screenPos);
      if (previousDist <= selectedDist + std::max(cfg.switchMargin, 0.0f)) {
        selected = previous;
      }
    }
  }

  if (state) {
    state->selectedBone = selected->bone;
    state->hasSelectedBone = true;
  }

  return toTarget(*selected);
}

BoneChoiceResult chooseTargetBone(const Bones3D& bones,
                                  float distanceToPlayer,
                                  float screenDistance,
                                  const BoneChoiceConfig& cfg) {
  if (cfg.useSmoothBlend && cfg.smoothBlendDistance > kEpsilon) {
    const float rangeT = 1.0f - clamp01(distanceToPlayer / cfg.smoothBlendDistance);
    const float precisionT = 1.0f - clamp01(screenDistance / safePositive(cfg.headScreenDistance, 1.0f));
    const float headBlend = std::min(rangeT * precisionT, std::clamp(cfg.maxHeadBlend, 0.0f, 1.0f));

    if (headBlend > kEpsilon) {
      return {
          lerp(bones.chest, bones.head, headBlend),
          AimBone::Custom,
          headBlend,
      };
    }
  }

  if (distanceToPlayer < cfg.closeHeadDistance && screenDistance < cfg.headScreenDistance) {
    return {
        lerp(bones.chest, bones.head, std::clamp(cfg.headBias, 0.0f, 1.0f)),
        AimBone::Head,
        std::clamp(cfg.headBias, 0.0f, 1.0f),
    };
  }

  if (distanceToPlayer < cfg.neckDistance) {
    return {
        bones.neck,
        AimBone::Neck,
        0.0f,
    };
  }

  return {
      bones.chest,
      AimBone::Chest,
      0.0f,
  };
}

AimAssistResult applyAimAssist(Vec2 stickInput,
                               Vec2 crosshair,
                               std::optional<Target> target,
                               const AimAssistConfig& cfg,
                               AimAssistState* state,
                               float dtSeconds) {
  const float dt = std::max(dtSeconds, 0.0f);
  Vec2 adjustedInput = applyRadialDeadzone(stickInput, cfg.deadzone, cfg.inputAcceleration);
  Vec2 assistPull{};
  float slowdown = 1.0f;

  if (target && cfg.radius > kEpsilon) {
    const Vec2 toTarget = target->screenPos - crosshair;
    const float dist = length(toTarget);

    if (dist < cfg.radius) {
      const float proximity = 1.0f - clamp01(dist / cfg.radius);

      const float slowdownT =
          std::pow(smootherStep(proximity), safePositive(cfg.slowdownCurve, 1.0f));
      slowdown = mix(1.0f, std::clamp(cfg.minSlowdown, 0.0f, 1.0f), slowdownT);
      adjustedInput *= slowdown;

      const float magnetT =
          std::pow(smootherStep(proximity), safePositive(cfg.magnetCurve, 1.0f));
      assistPull += normalizeOrZero(toTarget) * (cfg.magnetStrength * magnetT);

      if (target->hasVelocity && cfg.followStrength != 0.0f) {
        assistPull += target->screenVelocity * (cfg.followStrength * magnetT * dt);
      }

      assistPull = clampLength(assistPull, cfg.maxPull);
      adjustedInput += assistPull;
    }
  }

  adjustedInput = smoothInput(adjustedInput, state, cfg.smoothingHalfLife, dt);

  Vec2 angularVelocity = adjustedInput * cfg.sensitivity;
  angularVelocity = clampLength(angularVelocity, cfg.maxAngularSpeed);

  return {
      angularVelocity.x * dt,
      angularVelocity.y * dt,
      adjustedInput,
      assistPull,
      slowdown,
  };
}

AimAssistConfig makeControllerFeelAimAssistConfig() {
  AimAssistConfig cfg{};
  cfg.deadzone = 0.04f;
  cfg.radius = 130.0f;
  cfg.minSlowdown = 0.45f;
  cfg.slowdownCurve = 2.0f;
  cfg.magnetStrength = 0.07f;
  cfg.magnetCurve = 1.8f;
  cfg.maxPull = 0.25f;
  cfg.followStrength = 0.025f;
  cfg.smoothingHalfLife = 0.045f;
  cfg.sensitivity = 360.0f;
  cfg.maxAngularSpeed = 720.0f;
  return cfg;
}

void resetAimAssist(AimAssistState& state) {
  state = {};
}

void resetTargetSelection(TargetSelectionState& state) {
  state = {};
}

}  // namespace verdant::aim
