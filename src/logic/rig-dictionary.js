// ==========================================
// DICCIONARIO DE HUESOS (rig-dictionary.js)
// Mapeo estándar para Retargeting (Basado en jerarquía Mixamo)
// ==========================================

export const BODY_RIG_DICT = {
    // === TRONCO Y CABEZA ===
    hips: { label: "Caderas (Hips/Pelvis)", regex: [/mixamorig:Hips/i, /^hips$/i, /pelvis/i, /root/i] },
    spine: { label: "Columna Baja (Spine)", regex: [/mixamorig:Spine$/i, /^spine$/i, /spine_01/i] },
    chest: { label: "Pecho (Chest)", regex: [/mixamorig:Spine1/i, /^chest$/i, /spine_02/i] },
    upperChest: { label: "Pecho Superior", regex: [/mixamorig:Spine2/i, /^upperchest$/i, /spine_03/i] },
    neck: { label: "Cuello (Neck)", regex: [/mixamorig:Neck/i, /^neck$/i, /neck_01/i] },
    head: { label: "Cabeza (Head)", regex: [/mixamorig:Head/i, /^head$/i, /head/i] },

    // === BRAZO IZQUIERDO ===
    leftShoulder: { label: "Hombro Izq (L_Shoulder)", regex: [/mixamorig:LeftShoulder/i, /shoulder.*l/i, /clavicle.*l/i] },
    leftArm: { label: "Brazo Izq (L_Arm)", regex: [/mixamorig:LeftArm/i, /upperarm.*l/i, /^arm.*l/i] },
    leftForeArm: { label: "Antebrazo Izq (L_ForeArm)", regex: [/mixamorig:LeftForeArm/i, /lowerarm.*l/i, /^forearm.*l/i] },
    leftHand: { label: "Mano Izq (L_Hand)", regex: [/mixamorig:LeftHand/i, /^hand.*l/i] },

    // === BRAZO DERECHO ===
    rightShoulder: { label: "Hombro Der (R_Shoulder)", regex: [/mixamorig:RightShoulder/i, /shoulder.*r/i, /clavicle.*r/i] },
    rightArm: { label: "Brazo Der (R_Arm)", regex: [/mixamorig:RightArm/i, /upperarm.*r/i, /^arm.*r/i] },
    rightForeArm: { label: "Antebrazo Der (R_ForeArm)", regex: [/mixamorig:RightForeArm/i, /lowerarm.*r/i, /^forearm.*r/i] },
    rightHand: { label: "Mano Der (R_Hand)", regex: [/mixamorig:RightHand/i, /^hand.*r/i] },

    // === PIERNA IZQUIERDA ===
    leftUpLeg: { label: "Muslo Izq (L_UpLeg)", regex: [/mixamorig:LeftUpLeg/i, /thigh.*l/i, /^upleg.*l/i] },
    leftLeg: { label: "Pantorrilla Izq (L_Leg)", regex: [/mixamorig:LeftLeg/i, /calf.*l/i, /^leg.*l/i] },
    leftFoot: { label: "Pie Izq (L_Foot)", regex: [/mixamorig:LeftFoot/i, /^foot.*l/i] },
    leftToeBase: { label: "Punta Pie Izq (L_ToeBase)", regex: [/mixamorig:LeftToeBase/i, /^toe.*l/i] },

    // === PIERNA DERECHA ===
    rightUpLeg: { label: "Muslo Der (R_UpLeg)", regex: [/mixamorig:RightUpLeg/i, /thigh.*r/i, /^upleg.*r/i] },
    rightLeg: { label: "Pantorrilla Der (R_Leg)", regex: [/mixamorig:RightLeg/i, /calf.*r/i, /^leg.*r/i] },
    rightFoot: { label: "Pie Der (R_Foot)", regex: [/mixamorig:RightFoot/i, /^foot.*r/i] },
    rightToeBase: { label: "Punta Pie Der (R_ToeBase)", regex: [/mixamorig:RightToeBase/i, /^toe.*r/i] }
    
    // (Opcional por ahora: Los dedos de las manos los podemos mapear de la misma forma si son necesarios para el solver IK más adelante).
};