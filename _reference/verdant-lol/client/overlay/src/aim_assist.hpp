#pragma once

#include <optional>

namespace verdant::aim {

struct Vec2 {
  float x = 0.0f;
  float y = 0.0f;

  Vec2& operator+=(Vec2 rhs);
  Vec2& operator-=(Vec2 rhs);
  Vec2& operator*=(float scalar);
  Vec2& operator/=(float scalar);
};

struct Vec3 {
  float x = 0.0f;
  float y = 0.0f;
  float z = 0.0f;

  Vec3& operator+=(Vec3 rhs);
  Vec3& operator-=(Vec3 rhs);
  Vec3& operator*=(float scalar);
  Vec3& operator/=(float scalar);
};

Vec2 operator+(Vec2 lhs, Vec2 rhs);
Vec2 operator-(Vec2 lhs, Vec2 rhs);
Vec2 operator*(Vec2 value, float scalar);
Vec2 operator*(float scalar, Vec2 value);
Vec2 operator/(Vec2 value, float scalar);

Vec3 operator+(Vec3 lhs, Vec3 rhs);
Vec3 operator-(Vec3 lhs, Vec3 rhs);
Vec3 operator*(Vec3 value, float scalar);
Vec3 operator*(float scalar, Vec3 value);
Vec3 operator/(Vec3 value, float scalar);

float length(Vec2 value);
float distance(Vec2 lhs, Vec2 rhs);
Vec2 clampLength(Vec2 value, float maxLength);
Vec3 lerp(Vec3 from, Vec3 to, float t);

enum class AimBone {
  Head,
  Neck,
  Chest,
  Pelvis,
  Custom,
};

struct BonePoint {
  AimBone bone = AimBone::Custom;
  Vec2 screenPos{};
  Vec2 screenVelocity{};
  bool hasVelocity = false;
  bool visible = false;
};

struct Target {
  Vec2 screenPos{};
  Vec2 screenVelocity{};
  bool hasVelocity = false;
  AimBone bone = AimBone::Custom;
};

struct AimTargetCandidate {
  BonePoint head{AimBone::Head};
  BonePoint neck{AimBone::Neck};
  BonePoint chest{AimBone::Chest};
  BonePoint pelvis{AimBone::Pelvis};

  float distanceToPlayer = 0.0f;
  bool hasDistanceToPlayer = false;
};

struct TargetSelectionConfig {
  // Bones outside this screen-space radius do not receive assist.
  float assistRadius = 140.0f;

  // Prefer chest for stability unless head is close enough and aim is steady.
  float headRadius = 70.0f;

  // Optional distance gate for close-range head preference.
  float closeRangeDistance = 10.0f;

  // Stick magnitude below this counts as steady aim for head bias.
  float stableInputThreshold = 0.28f;

  // Time needed before drifting from torso toward head.
  float stableTimeForHead = 0.12f;

  // Adds hysteresis so selected bone does not flicker every frame.
  float switchMargin = 14.0f;
};

struct TargetSelectionState {
  AimBone selectedBone = AimBone::Custom;
  bool hasSelectedBone = false;
  float stableAimSeconds = 0.0f;
};

struct Bones3D {
  Vec3 head{};
  Vec3 neck{};
  Vec3 chest{};
  Vec3 pelvis{};
};

struct BoneChoiceConfig {
  // Close + precise aim can move the assist point up to head.
  float closeHeadDistance = 12.0f;
  float headScreenDistance = 60.0f;

  // Medium range uses neck as a stable transition point.
  float neckDistance = 25.0f;

  // Smooth blend range for chest -> head. Set to 0 for hard choices only.
  float smoothBlendDistance = 30.0f;

  // Prevents the smooth blend from becoming a full head snap.
  float maxHeadBlend = 0.75f;

  // Used when close/precise but you want "a bit above chest", not head.
  float headBias = 0.35f;

  bool useSmoothBlend = true;
};

struct BoneChoiceResult {
  Vec3 worldPos{};
  AimBone bone = AimBone::Chest;
  float headBlend = 0.0f;
};

struct AimAssistConfig {
  // Stick input below this radial magnitude is treated as intentional rest.
  float deadzone = 0.08f;

  // 1.0 is linear. Higher values make small stick movements softer.
  float inputAcceleration = 1.35f;

  // Radius around the crosshair where slowdown and magnetism can engage.
  float radius = 140.0f;

  // Smallest input multiplier at the center of the assist radius.
  float minSlowdown = 0.35f;

  // Higher values keep normal speed longer and slow down more near center.
  float slowdownCurve = 1.6f;

  // Pull strength in adjusted stick-input units.
  float magnetStrength = 0.08f;

  // Higher values make magnetism fade in more gently near the radius edge.
  float magnetCurve = 1.3f;

  // Maximum target pull added to the adjusted stick input.
  float maxPull = 0.22f;

  // Adds a small predictive pull based on target screen velocity.
  float followStrength = 0.0f;

  // Exponential smoothing half-life in seconds. 0 disables smoothing.
  float smoothingHalfLife = 0.035f;

  // Max angular velocity after sensitivity is applied, in units per second.
  float maxAngularSpeed = 720.0f;

  // Converts adjusted stick input to angular velocity.
  float sensitivity = 360.0f;
};

struct AimAssistState {
  Vec2 smoothedInput{};
  bool hasSmoothedInput = false;
};

struct AimAssistResult {
  float yawDelta = 0.0f;
  float pitchDelta = 0.0f;

  Vec2 adjustedInput{};
  Vec2 assistPull{};
  float slowdown = 1.0f;
};

AimAssistResult applyAimAssist(Vec2 stickInput,
                               Vec2 crosshair,
                               std::optional<Target> target,
                               const AimAssistConfig& cfg,
                               AimAssistState* state = nullptr,
                               float dtSeconds = 1.0f / 60.0f);

AimAssistConfig makeControllerFeelAimAssistConfig();

std::optional<Target> selectAimTarget(const AimTargetCandidate& candidate,
                                      Vec2 crosshair,
                                      Vec2 stickInput,
                                      const TargetSelectionConfig& cfg,
                                      TargetSelectionState* state = nullptr,
                                      float dtSeconds = 1.0f / 60.0f);

BoneChoiceResult chooseTargetBone(const Bones3D& bones,
                                  float distanceToPlayer,
                                  float screenDistance,
                                  const BoneChoiceConfig& cfg);

void resetAimAssist(AimAssistState& state);
void resetTargetSelection(TargetSelectionState& state);

}  // namespace verdant::aim
