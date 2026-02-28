// ==========================================
// CONSTANTES GLOBALES (Diccionarios y Regex)
// ==========================================

// Mapeo de Blendshapes de MediaPipe a nombres de Morph Targets del modelo
export const blendshapeMap = {
  eyeBlinkLeft: "Eye_Blink_L", eyeLookDownLeft: "Eye_L_Look_Down", eyeLookInLeft: "Eye_L_Look_R",
  eyeLookOutLeft: "Eye_L_Look_L", eyeLookUpLeft: "Eye_L_Look_Up", eyeSquintLeft: "Eye_Squint_L",
  eyeWideLeft: "Eye_Wide_L", eyeBlinkRight: "Eye_Blink_R", eyeLookDownRight: "Eye_R_Look_Down",
  eyeLookInRight: "Eye_R_Look_L", eyeLookOutRight: "Eye_R_Look_R", eyeLookUpRight: "Eye_R_Look_Up",
  eyeSquintRight: "Eye_Squint_R", eyeWideRight: "Eye_Wide_R", jawForward: "Jaw_Forward",
  jawLeft: "Jaw_L", jawRight: "Jaw_R", jawOpen: "Jaw_Open", mouthClose: "Mouth_Close",
  mouthFunnel: "Mouth_Funnel", mouthPucker: "Mouth_Pucker", mouthLeft: "Mouth_L",
  mouthRight: "Mouth_R", mouthSmileLeft: "Mouth_Smile_L", mouthSmileRight: "Mouth_Smile_R",
  mouthFrownLeft: "Mouth_Frown_L", mouthFrownRight: "Mouth_Frown_R", mouthDimpleLeft: "Mouth_Dimple_L",
  mouthDimpleRight: "Mouth_Dimple_R", mouthStretchLeft: "Mouth_Stretch_L", mouthStretchRight: "Mouth_Stretch_R",
  mouthRollLower: "Mouth_Roll_In_Lower", mouthRollUpper: "Mouth_Roll_In_Upper", mouthShrugLower: "Mouth_Shrug_Lower",
  mouthShrugUpper: "Mouth_Shrug_Upper", mouthPressLeft: "Mouth_Press_L", mouthPressRight: "Mouth_Press_R",
  mouthLowerDownLeft: "Mouth_Down_Lower_L", mouthLowerDownRight: "Mouth_Down_Lower_R", mouthUpperUpLeft: "Mouth_Up_Upper_L",
  mouthUpperUpRight: "Mouth_Up_Upper_R", browDownLeft: "Brow_Drop_L", browDownRight: "Brow_Drop_R",
  browInnerUp: "Brow_Raise_Inner_L", browOuterUpLeft: "Brow_Raise_Outer_L", browOuterUpRight: "Brow_Raise_Outer_R",
  cheekPuff: "Cheek_Puff_L", cheekSquintLeft: "Cheek_Raise_L", cheekSquintRight: "Cheek_Raise_R",
  noseSneerLeft: "Nose_Sneer_L", noseSneerRight: "Nose_Sneer_R"
};

// Patrones de expresiones regulares para auto-detección de huesos
// Patrones de expresiones regulares para auto-detección de huesos
export const RIG_PATTERNS = {
  // --- ROSTRO Y CUELLO ---
  head: [/c_headx/i, /headx/i, /mixamorig:Head/i, /DEF-head/i, /^head$/i],
  neck: [/c_neckx/i, /neckx/i, /mixamorig:Neck/i, /DEF-neck/i, /^neck$/i],
  
  // --- TORSO ---
  hips: [/c_rootx/i, /rootx/i, /mixamorig:Hips/i, /DEF-hips/i, /^hips$/i, /pelvis/i],
  spine: [/c_spine_01x/i, /spine_01x/i, /mixamorig:Spine$/i, /DEF-spine$/i, /^spine$/i],
  chest: [/c_spine_02x/i, /spine_02x/i, /mixamorig:Spine1/i, /chest/i],
  upperChest: [/c_spine_03x/i, /spine_03x/i, /mixamorig:Spine2/i, /upper_chest/i],

  // --- BRAZOS ---
  shoulderL: [/c_shoulderl/i, /shoulderl/i, /mixamorig:LeftShoulder/i, /shoulder\.L/i],
  shoulderR: [/c_shoulderr/i, /shoulderr/i, /mixamorig:RightShoulder/i, /shoulder\.R/i],
  armL: [/c_arm_fkl/i, /arm_fkl/i, /arml/i, /mixamorig:LeftArm/i, /upper_arm\.L/i],
  armR: [/c_arm_fkr/i, /arm_fkr/i, /armr/i, /mixamorig:RightArm/i, /upper_arm\.R/i],
  forearmL: [/c_forearm_fkl/i, /forearm_fkl/i, /forearml/i, /mixamorig:LeftForeArm/i, /forearm\.L/i],
  forearmR: [/c_forearm_fkr/i, /forearm_fkr/i, /forearmr/i, /mixamorig:RightForeArm/i, /forearm\.R/i],
  handL: [/c_hand_fkl/i, /handl/i, /mixamorig:LeftHand/i, /hand\.L/i],
  handR: [/c_hand_fkr/i, /handr/i, /mixamorig:RightHand/i, /hand\.R/i],

  // --- PIERNAS ---
  thighL: [/c_thigh_fkl/i, /thigh_fkl/i, /thighl/i, /mixamorig:LeftUpLeg/i, /thigh\.L/i],
  thighR: [/c_thigh_fkr/i, /thigh_fkr/i, /thighr/i, /mixamorig:RightUpLeg/i, /thigh\.R/i],
  legL: [/c_leg_fkl/i, /leg_fkl/i, /legl/i, /mixamorig:LeftLeg/i, /shin\.L/i],
  legR: [/c_leg_fkr/i, /leg_fkr/i, /legr/i, /mixamorig:RightLeg/i, /shin\.R/i],
  footL: [/c_foot_fkl/i, /footl/i, /mixamorig:LeftFoot/i, /foot\.L/i],
  footR: [/c_foot_fkr/i, /footr/i, /mixamorig:RightFoot/i, /foot\.R/i]
};
// Configuración de luces de Three.js (opcional, para centralizar)
export const LIGHT_CONFIG = {
  ambient: { color: 0xffffff, intensity: 0.8 },
  keyLight: { color: 0xffffff, intensity: 1.2, position: [-1, 2, 2] },
  fillLight: { color: 0xffffff, intensity: 0.5, position: [1, 1, 2] }
};