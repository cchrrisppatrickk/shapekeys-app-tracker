// ==========================================
// MANEJADOR DE ENTRADA MULTIMEDIA (media-manager.js)
// Controla la Webcam, el Video Local y la UI
// ==========================================

export let currentMode = 'webcam';
export let webcamRunning = false;
export let videoTrackingActive = false;

let dom = {};
let onMediaReadyCallback = null;

// Inicializa el manager con los elementos DOM y la función que iniciará el bucle (predictWebcam)
export function initMediaManager(domElements, onMediaReady) {
    dom = domElements;
    onMediaReadyCallback = onMediaReady;
    attachEvents();
}

function attachEvents() {
    // Pestañas
    dom.tabWebcam.addEventListener("click", () => switchInputMode('webcam'));
    dom.tabVideo.addEventListener("click", () => switchInputMode('video'));

    // Carga de Video
    dom.uploadVideoButton.addEventListener("click", () => dom.videoFileInput.click());
    dom.videoFileInput.addEventListener("change", (e) => handleVideoFile(e.target.files[0]));

    // Drag & Drop de Video
    dom.dropZoneVideo.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (currentMode === 'video') dom.videoOverlayMsg.classList.add("dragover");
    });
    dom.dropZoneVideo.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dom.videoOverlayMsg.classList.remove("dragover");
    });
    dom.dropZoneVideo.addEventListener("drop", (e) => {
        e.preventDefault();
        dom.videoOverlayMsg.classList.remove("dragover");
        if (currentMode === 'video' && e.dataTransfer.files.length > 0) {
            handleVideoFile(e.dataTransfer.files[0]);
        }
    });

    // Botón Webcam
    dom.enableWebcamButton.addEventListener("click", toggleWebcam);
}

export function switchInputMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;

    // Detener procesos
    if (webcamRunning) toggleWebcam(); 
    if (videoTrackingActive) {
        videoTrackingActive = false;
        dom.video.pause();
        dom.video.removeAttribute('src'); // Limpieza para no romper el srcObject
        dom.video.load();
    }

    dom.recordButton.disabled = true;

    if (mode === 'video') {
        dom.tabWebcam.classList.remove("active");
        dom.tabVideo.classList.add("active");
        dom.enableWebcamButton.classList.add("hidden");
        dom.uploadVideoButton.classList.remove("hidden");
        dom.videoOverlayMsg.classList.remove("hidden");
        dom.video.classList.remove("mirrored");
        dom.canvasElement.classList.remove("mirrored");
    } else {
        dom.tabVideo.classList.remove("active");
        dom.tabWebcam.classList.add("active");
        dom.uploadVideoButton.classList.add("hidden");
        dom.enableWebcamButton.classList.remove("hidden");
        dom.videoOverlayMsg.classList.add("hidden");
        dom.video.classList.add("mirrored");
        dom.canvasElement.classList.add("mirrored");
    }
    
    // Limpiar canvas
    const ctx = dom.canvasElement.getContext("2d");
    ctx.clearRect(0, 0, dom.canvasElement.width, dom.canvasElement.height);
}

export function toggleWebcam() {
    if (webcamRunning) {
        webcamRunning = false;
        dom.enableWebcamButton.classList.remove("accent-btn");
        if (dom.video.srcObject) {
            dom.video.srcObject.getTracks().forEach(track => track.stop());
            dom.video.srcObject = null;
        }
        dom.recordButton.disabled = true;
    } else {
        webcamRunning = true;
        dom.enableWebcamButton.classList.add("accent-btn");

        const constraints = { video: { width: 1280, height: 720 } };
        navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
            dom.video.removeAttribute('src'); // Asegurarnos de limpiar archivos previos
            dom.video.srcObject = stream;
            
            // Usar onloadeddata (evita el memory leak de addEventListener)
            dom.video.onloadeddata = () => {
                dom.video.play(); // Forzar play es crítico al cambiar de fuentes
                dom.recordButton.disabled = false;
                if (onMediaReadyCallback) onMediaReadyCallback(); // Dispara predictWebcam
            };
        });
    }
}

function handleVideoFile(file) {
    if (!file || !file.type.startsWith('video/')) {
        alert('Sube un archivo de video válido (.mp4, .webm).');
        return;
    }

    dom.videoOverlayMsg.classList.add("hidden");
    const fileURL = URL.createObjectURL(file);
    
    if (dom.video.srcObject) {
        dom.video.srcObject.getTracks().forEach(track => track.stop());
        dom.video.srcObject = null; 
    }
    
    dom.video.src = fileURL;
    dom.video.loop = true;
    dom.video.muted = true;

    dom.video.onloadeddata = () => {
        dom.video.play();
        videoTrackingActive = true;
        dom.recordButton.disabled = false;
        if (onMediaReadyCallback) onMediaReadyCallback(); // Dispara predictWebcam
    };
}