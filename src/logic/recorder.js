import { headBone, updateModelMorphs, resetPose } from './avatar-control.js';

// ==========================================
// ESTADO INTERNO
// ==========================================
export let isRecording = false;
export let isPlaying = false;

// Almacenamiento
let currentRecording = [];    // Buffer temporal mientras se graba
export let allTakes = [];     // Lista de todas las tomas guardadas
export let activeTakeId = null; // ID de la toma seleccionada para playback/export

// Tiempos
let recordingStartTime = 0;
let playbackStartTime = 0;
let timerInterval = null;
let playbackAnimationId = null;

// Callbacks UI
let onRecordStateChange = null;
let onPlayStateChange = null;
let onTimerUpdate = null;     // Nuevo callback para el reloj
let onTakesUpdated = null;    // Nuevo callback para actualizar la lista

// ==========================================
// CONFIGURACIÓN
// ==========================================
export function initRecorderUI(callbacks) {
    onRecordStateChange = callbacks.onRecordStateChange;
    onPlayStateChange = callbacks.onPlayStateChange;
    onTimerUpdate = callbacks.onTimerUpdate;
    onTakesUpdated = callbacks.onTakesUpdated;
}

// ==========================================
// GRABACIÓN
// ==========================================
export function startRecording() {
    if (!headBone) {
        alert("Configura el esqueleto antes de grabar.");
        return false;
    }
    
    isRecording = true;
    currentRecording = []; // Limpiamos buffer
    recordingStartTime = performance.now();
    
    // Iniciar Cronómetro
    startTimer();

    if (onRecordStateChange) onRecordStateChange(true);
    console.log("⏺ Grabando...");
    return true;
}

export function stopRecording() {
    isRecording = false;
    stopTimer();

    const duration = (performance.now() - recordingStartTime) / 1000;
    
    // Guardar la toma si tiene datos
    if (currentRecording.length > 0) {
        const newTake = {
            id: Date.now(), // ID único
            name: `Toma ${allTakes.length + 1}`,
            duration: duration,
            data: [...currentRecording], // Copia del array
            timestamp: new Date().toLocaleTimeString()
        };
        
        allTakes.push(newTake);
        activeTakeId = newTake.id; // Seleccionar la nueva toma
        
        console.log(`⏹ Toma guardada: ${newTake.name} (${duration.toFixed(2)}s)`);
        if (onTakesUpdated) onTakesUpdated(allTakes, activeTakeId);
    }

    if (onRecordStateChange) onRecordStateChange(false, allTakes.length > 0);
    return true;
}

export function captureFrame(results) {
    if (!headBone) return;
    
    const time = (performance.now() - recordingStartTime) / 1000;
    
    // Clonamos datos para romper referencias de Three.js
    const rotation = headBone.quaternion.clone();
    const blendshapes = results.faceBlendshapes[0].categories.map(s => ({
        categoryName: s.categoryName,
        score: s.score
    }));

    currentRecording.push({ t: time, rot: rotation, bs: blendshapes });
}

// ==========================================
// GESTIÓN DE TOMAS (Nuevo)
// ==========================================
export function setActiveTake(takeId) {
    const take = allTakes.find(t => t.id === takeId);
    if (take) {
        activeTakeId = takeId;
        // Reiniciamos pose al cambiar de toma
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
    // Si ya está reproduciendo, paramos
    if (isPlaying) {
        stopPlayback();
        return;
    }

    // Si no, iniciamos la toma indicada (o la activa)
    const targetId = takeId || activeTakeId;
    const take = allTakes.find(t => t.id === targetId);
    
    if (!take) {
        console.warn("No hay toma seleccionada para reproducir.");
        return;
    }

    // Establecer como activa visualmente
    activeTakeId = targetId;
    if (onTakesUpdated) onTakesUpdated(allTakes, activeTakeId); // Para actualizar UI de selección

    isPlaying = true;
    playbackStartTime = performance.now();
    if (onPlayStateChange) onPlayStateChange(true);
    
    playbackLoop(take.data);
}

export function stopPlayback() {
    isPlaying = false;
    if (playbackAnimationId) {
        cancelAnimationFrame(playbackAnimationId);
    }
    if (onPlayStateChange) onPlayStateChange(false);
    resetPose();
}

function playbackLoop(takeData) {
    if (!isPlaying) return;

    const currentTime = (performance.now() - playbackStartTime) / 1000;
    const lastFrame = takeData[takeData.length - 1];

    if (currentTime > lastFrame.t) {
        stopPlayback(); // Fin de la toma
        return;
    }

    // Buscar frame más cercano (se puede optimizar, pero funciona para MVP)
    const frame = takeData.find(f => f.t >= currentTime);

    if (frame) {
        if (headBone) headBone.quaternion.copy(frame.rot);
        updateModelMorphs(frame.bs);
    }

    playbackAnimationId = requestAnimationFrame(() => playbackLoop(takeData));
}

// ==========================================
// CRONÓMETRO INTERNO
// ==========================================
function startTimer() {
    const start = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        const delta = Date.now() - start;
        const formatted = formatTime(delta);
        if (onTimerUpdate) onTimerUpdate(formatted);
    }, 50); // Actualizar cada 50ms
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    if (onTimerUpdate) onTimerUpdate("00:00.00"); // Reset o dejar el último valor
}

// Formato MM:SS.ms
function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centis = Math.floor((ms % 1000) / 10); // 2 dígitos

    return `${pad(minutes)}:${pad(seconds)}.${pad(centis)}`;
}

function pad(num) {
    return num.toString().padStart(2, '0');
}