// ==========================================
// SISTEMA DE GRABACIÓN Y REPRODUCCIÓN
// ==========================================
import { headBone, updateModelMorphs, resetPose } from './avatar-control.js';

// Estado de la grabación
export let isRecording = false;
export let recordedData = [];
let recordingStartTime = 0;

// Estado de la reproducción
export let isPlaying = false;
let playbackStartTime = 0;
let playbackAnimationId = null;

// Callbacks para actualizar la UI desde main.js
let onRecordStateChange = null;
let onPlayStateChange = null;

export function initRecorderUI(callbacks) {
    onRecordStateChange = callbacks.onRecordStateChange;
    onPlayStateChange = callbacks.onPlayStateChange;
}

// Iniciar grabación
export function startRecording() {
    if (!headBone) {
        alert("Configura el esqueleto.");
        return false;
    }
    isRecording = true;
    recordedData = [];
    recordingStartTime = performance.now();
    if (onRecordStateChange) onRecordStateChange(true);
    console.log("⏺ Grabando...");
    return true;
}

// Detener grabación
export function stopRecording() {
    isRecording = false;
    const duration = (performance.now() - recordingStartTime) / 1000;
    console.log(`⏹ Fin. Frames: ${recordedData.length}. Duración: ${duration.toFixed(2)}s`);
    
    const hasData = recordedData.length > 0;
    if (onRecordStateChange) onRecordStateChange(false, hasData);
    return hasData;
}

// Capturar un frame durante la grabación
export function captureFrame(results) {
    if (!headBone) return;
    
    const time = (performance.now() - recordingStartTime) / 1000;
    const rotation = headBone.quaternion.clone();

    const blendshapes = results.faceBlendshapes[0].categories.map(s => ({
        categoryName: s.categoryName,
        score: s.score
    }));

    recordedData.push({ t: time, rot: rotation, bs: blendshapes });
}

// Iniciar reproducción
export function startPlayback() {
    if (recordedData.length === 0) return false;

    isPlaying = true;
    playbackStartTime = performance.now();
    if (onPlayStateChange) onPlayStateChange(true);
    playbackLoop();
    return true;
}

// Detener reproducción
export function stopPlayback() {
    isPlaying = false;
    if (playbackAnimationId) {
        cancelAnimationFrame(playbackAnimationId);
    }
    if (onPlayStateChange) onPlayStateChange(false);
    resetPose(); // Resetear el modelo a la pose neutral al parar
}

// Bucle interno de reproducción
function playbackLoop() {
    if (!isPlaying) return;

    const currentTime = (performance.now() - playbackStartTime) / 1000;
    const lastFrame = recordedData[recordedData.length - 1];

    if (currentTime > lastFrame.t) {
        stopPlayback();
        return;
    }

    // Búsqueda simple del frame actual
    const frame = recordedData.find(f => f.t >= currentTime);

    if (frame) {
        if (headBone) headBone.quaternion.copy(frame.rot);
        updateModelMorphs(frame.bs);
    }

    playbackAnimationId = requestAnimationFrame(playbackLoop);
}