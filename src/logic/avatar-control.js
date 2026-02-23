// ==========================================
// CONTROL DEL AVATAR 3D (Huesos y Blendshapes)
// ==========================================
import * as THREE from 'three';
import { blendshapeMap } from './constants.js';

// Variables de estado del modelo (se exportan para que main.js pueda acceder a ellas)
export let avatarModel = null;
export let headBone = null;
export let neckBone = null;

// Función para actualizar el modelo actual
export function setAvatarModel(model) {
    avatarModel = model;
}

// Función para asignar los huesos seleccionados
export function setBones(head, neck) {
    headBone = head;
    neckBone = neck;
}

// Función para actualizar los morph targets basados en los blendshapes de MediaPipe
export function updateModelMorphs(blendshapesArray) {
    if (!avatarModel || !blendshapesArray) return;

    blendshapesArray.forEach(shape => {
        const modelName = blendshapeMap[shape.categoryName];
        if (modelName) {
            avatarModel.traverse((child) => {
                if (child.isMesh && child.morphTargetDictionary && child.morphTargetDictionary[modelName] !== undefined) {
                    const index = child.morphTargetDictionary[modelName];
                    child.morphTargetInfluences[index] = shape.score;
                }
            });
        }
    });
}

// Función para aplicar la rotación de la cabeza a partir de la matriz de transformación
export function applyHeadPoseToModel(matrixData) {
    if (!headBone) return;
    const matrix = new THREE.Matrix4().fromArray(matrixData);
    const rotation = new THREE.Euler().setFromRotationMatrix(matrix);

    headBone.rotation.x = rotation.x;
    headBone.rotation.y = -rotation.y;
    headBone.rotation.z = -rotation.z;
}

// Función auxiliar para resetear la pose (útil para cuando se detiene la reproducción)
export function resetPose() {
    if (headBone) {
        headBone.rotation.set(0, 0, 0);
    }
    // Opcional: resetear morph targets a 0
    if (avatarModel) {
        avatarModel.traverse((child) => {
            if (child.isMesh && child.morphTargetInfluences) {
                for (let i = 0; i < child.morphTargetInfluences.length; i++) {
                    child.morphTargetInfluences[i] = 0;
                }
            }
        });
    }
}