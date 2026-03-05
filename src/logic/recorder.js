import { headBone, updateModelMorphs, resetPose } from './avatar-control.js';

// ==========================================
// ESTADO INTERNO
// ==========================================
export let isRecording = false;
export let isPlaying = false;
export let currentRecordType = 'face'; // 'face' o 'body'

// Almacenamiento
let currentRecording = [];    
export let allTakes = [];     
export let activeTakeId = null; 

// Tiempos
let recordingStartTime = 0;
let playbackStartTime = 0;
let timerInterval = null;
let playbackAnimationId = null;

// Callbacks UI y Render
let onRecordStateChange = null;
let onPlayStateChange = null;
let onTimerUpdate = null;     
let onTakesUpdated = null;    
let onPlaybackFrame = null;   // NUEVO: Callback para enviar el frame a main.js

// ==========================================
// CONFIGURACIÓN
// ==========================================
export function initRecorderUI(callbacks) {
    onRecordStateChange = callbacks.onRecordStateChange;
    onPlayStateChange = callbacks.onPlayStateChange;
    onTimerUpdate = callbacks.onTimerUpdate;
    onTakesUpdated = callbacks.onTakesUpdated;
    onPlaybackFrame = callbacks.onPlaybackFrame; // Registramos el callback
}

// ==========================================
// GRABACIÓN
// ==========================================
// Añadimos el tipo de entorno actual para saber qué validar
export function startRecording(workspaceType = 'face') {
    if (workspaceType === 'face' && !headBone) {
        alert("Configura el esqueleto antes de grabar rostro.");
        return false;
    }
    
    currentRecordType = workspaceType;
    isRecording = true;
    currentRecording = []; 
    recordingStartTime = performance.now();
    
    startTimer();

    if (onRecordStateChange) onRecordStateChange(true);
    console.log(`⏺ Grabando [${currentRecordType.toUpperCase()}]...`);
    return true;
}

export function stopRecording() {
    isRecording = false;
    stopTimer();

    const duration = (performance.now() - recordingStartTime) / 1000;
    
    if (currentRecording.length > 0) {
        const newTake = {
            id: Date.now(), 
            name: `Toma ${currentRecordType.toUpperCase()} ${allTakes.length + 1}`,
            type: currentRecordType, // Guardamos el tipo de toma
            duration: duration,
            data: [...currentRecording], 
            timestamp: new Date().toLocaleTimeString()
        };
        
        allTakes.push(newTake);
        activeTakeId = newTake.id; 
        
        console.log(`⏹ Toma guardada: ${newTake.name} (${duration.toFixed(2)}s)`);
        if (onTakesUpdated) onTakesUpdated(allTakes, activeTakeId);
    }

    if (onRecordStateChange) onRecordStateChange(false, allTakes.length > 0);
    return true;
}

// CAPTURA DE ROSTRO (Mantiene la lógica original)
export function captureFaceFrame(results) {
    if (!headBone) return;
    const time = (performance.now() - recordingStartTime) / 1000;
    
    const rotation = headBone.quaternion.clone();
    const blendshapes = results.faceBlendshapes[0].categories.map(s => ({
        categoryName: s.categoryName,
        score: s.score
    }));

    currentRecording.push({ t: time, rot: rotation, bs: blendshapes });
}

// NUEVO: CAPTURA DE CUERPO Y MANOS
export function captureBodyFrame(poseResults, handResults) {
    const time = (performance.now() - recordingStartTime) / 1000;
    
    // Es CRÍTICO clonar (deep copy) los arrays de coordenadas, 
    // de lo contrario MediaPipe sobrescribirá el mismo array en el siguiente frame.
    const poseLandmarks = poseResults?.landmarks ? JSON.parse(JSON.stringify(poseResults.landmarks)) : null;
    const handLandmarks = handResults?.landmarks ? JSON.parse(JSON.stringify(handResults.landmarks)) : null;

    currentRecording.push({ 
        t: time, 
        pose: poseLandmarks, 
        hands: handLandmarks 
    });
}

// ==========================================
// GESTIÓN DE TOMAS
// ==========================================
export function setActiveTake(takeId) {
    const take = allTakes.find(t => t.id === takeId);
    if (take) {
        activeTakeId = takeId;
        resetPose();
        return true;
    }
    return false;
}

export function deleteTake(takeId) {
    allTakes = allTakes.filter(t => t.id !== takeId);
    if (activeTakeId === takeId) {
        activeTakeId = null;
        resetPose();
    }
    if (onTakesUpdated) onTakesUpdated(allTakes, activeTakeId);
}

// ==========================================
// REPRODUCCIÓN
// ==========================================
export function togglePlayback(takeId) {
    if (isPlaying) {
        stopPlayback();
        return;
    }

    const targetId = takeId || activeTakeId;
    const take = allTakes.find(t => t.id === targetId);
    
    if (!take) return console.warn("No hay toma seleccionada para reproducir.");

    activeTakeId = targetId;
    if (onTakesUpdated) onTakesUpdated(allTakes, activeTakeId); 

    isPlaying = true;
    playbackStartTime = performance.now();
    if (onPlayStateChange) onPlayStateChange(true);
    
    playbackLoop(take);
}

export function stopPlayback() {
    isPlaying = false;
    if (playbackAnimationId) {
        cancelAnimationFrame(playbackAnimationId);
    }
    if (onPlayStateChange) onPlayStateChange(false);
    resetPose();
}

function playbackLoop(take) {
    if (!isPlaying) return;

    const currentTime = (performance.now() - playbackStartTime) / 1000;
    const takeData = take.data;
    const lastFrame = takeData[takeData.length - 1];

    if (currentTime > lastFrame.t) {
        stopPlayback(); 
        return;
    }

    const frame = takeData.find(f => f.t >= currentTime);

    if (frame) {
        // Si es de cara, movemos el modelo 3D internamente como antes
        if (take.type === 'face') {
            if (headBone) headBone.quaternion.copy(frame.rot);
            updateModelMorphs(frame.bs);
        }
        
        // Emitimos el frame para que main.js lo dibuje en el canvas (necesario para el cuerpo)
        if (onPlaybackFrame) onPlaybackFrame(frame, take.type);
    }

    playbackAnimationId = requestAnimationFrame(() => playbackLoop(take));
}

// ==========================================
// CRONÓMETRO INTERNO
// ==========================================
function startTimer() {
    const start = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const formatted = formatTime(Date.now() - start);
        if (onTimerUpdate) onTimerUpdate(formatted);
    }, 50); 
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    if (onTimerUpdate) onTimerUpdate("00:00.00");
}

function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centis = Math.floor((ms % 1000) / 10);
    return `${pad(minutes)}:${pad(seconds)}.${pad(centis)}`;
}

function pad(num) {
    return num.toString().padStart(2, '0');
}