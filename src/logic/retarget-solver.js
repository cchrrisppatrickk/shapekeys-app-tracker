// ==========================================
// SOLUCIONADOR DE RETARGETING (retarget-solver.js)
// Traduce landmarks de MediaPipe a rotaciones de Three.js
// ==========================================
import * as THREE from 'three';

// Índices de MediaPipe Pose
const MP = {
    NOSE: 0,
    LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
    LEFT_WRIST: 15, RIGHT_WRIST: 16,
    LEFT_HIP: 23, RIGHT_HIP: 24,
    LEFT_KNEE: 25, RIGHT_KNEE: 26,
    LEFT_ANKLE: 27, RIGHT_ANKLE: 28
};

// Función principal que se llamará en cada frame de reproducción
export function solveRetargeting(poseLandmarks, bodyBones) {
    if (!poseLandmarks || !bodyBones.hips) return;

    // 1. EXTRAER COORDENADAS (MediaPipe usa X, Y, Z pero con Y invertido respecto a Three.js)
    const getPoint = (index) => {
        const p = poseLandmarks[index];
        // Invertimos Y y multiplicamos por una escala para que coincida con el mundo 3D
        return new THREE.Vector3(p.x, -p.y, -p.z); 
    };

    const leftHip = getPoint(MP.LEFT_HIP);
    const rightHip = getPoint(MP.RIGHT_HIP);
    const leftShoulder = getPoint(MP.LEFT_SHOULDER);
    const rightShoulder = getPoint(MP.RIGHT_SHOULDER);

    // ==========================================
    // A. MOVIMIENTO DE CADERAS (Root / Hips)
    // ==========================================
    // Calculamos el centro de las caderas
    const centerHip = new THREE.Vector3().addVectors(leftHip, rightHip).multiplyScalar(0.5);
    
    // Aplicamos la posición (con un multiplicador de escala ajustable)
    // Asumimos que la T-Pose original tiene las caderas a cierta altura (ej. 1.0)
    bodyBones.hips.position.set(centerHip.x * 2, (centerHip.y * 2) + 1.0, centerHip.z * 2);

    // ==========================================
    // B. ROTACIÓN DEL TORSO (Spine)
    // ==========================================
    if (bodyBones.spine) {
        // Calculamos el centro de los hombros
        const centerShoulder = new THREE.Vector3().addVectors(leftShoulder, rightShoulder).multiplyScalar(0.5);
        
        // Vector que va de las caderas a los hombros en la cámara
        const spineDir = new THREE.Vector3().subVectors(centerShoulder, centerHip).normalize();
        
        // Vector "Arriba" por defecto de un hueso de columna en Mixamo
        const defaultUp = new THREE.Vector3(0, 1, 0); 
        
        // Calculamos la rotación necesaria para alinear el hueso
        const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultUp, spineDir);
        
        // Aplicamos la rotación global convirtiéndola al espacio local del hueso
        // (En un entorno de producción estricto, aquí se multiplica por el cuaternión inverso del padre)
        bodyBones.spine.quaternion.slerp(quaternion, 0.5); // Slerp suaviza el movimiento
    }

    // ==========================================
    // C. EJEMPLO: BRAZO IZQUIERDO (L_Arm)
    // ==========================================
    if (bodyBones.leftArm && bodyBones.leftForeArm) {
        const elbowL = getPoint(MP.LEFT_ELBOW);
        
        // Dirección del hombro al codo
        const armDir = new THREE.Vector3().subVectors(elbowL, leftShoulder).normalize();
        
        // Mixamo normalmente tiene los brazos extendidos en X en la T-Pose
        const defaultArmVector = new THREE.Vector3(1, 0, 0); 
        
        const armQuat = new THREE.Quaternion().setFromUnitVectors(defaultArmVector, armDir);
        bodyBones.leftArm.quaternion.slerp(armQuat, 0.8);
    }

    // Aquí irían el resto de extremidades siguiendo la misma lógica matemática...
}