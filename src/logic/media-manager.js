// ==========================================
// MANEJADOR DE ENTRADA MULTIMEDIA (media-manager.js)
// Controla la Webcam, el Video Local y la UI
// ==========================================

export let currentMode = 'webcam';
export let webcamRunning = false;
export let videoTrackingActive = false;

let dom = {};
let onMediaReadyCallback = null;

export function initMediaManager(domElements, onMediaReady) {
    dom = domElements;
    onMediaReadyCallback = onMediaReady;
    attachEvents();
}

function attachEvents() {
    dom.tabWebcam.addEventListener("click", () => switchInputMode('webcam'));
    dom.tabVideo.addEventListener("click", () => switchInputMode('video'));

    dom.uploadVideoButton.addEventListener("click", () => dom.videoFileInput.click());
    dom.videoFileInput.addEventListener("change", (e) => handleVideoFile(e.target.files[0]));

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

    dom.enableWebcamButton.addEventListener("click", toggleWebcam);
}

export function switchInputMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;

    // LIMPIEZA TOTAL DE FUENTES AL CAMBIAR DE PESTAÑA
    if (webcamRunning) toggleWebcam(); 
    if (videoTrackingActive) {
        videoTrackingActive = false;
        dom.video.pause();
        dom.video.removeAttribute('src'); 
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
        if(dom.previewCanvas) dom.previewCanvas.classList.remove("mirrored");
    } else {
        dom.tabVideo.classList.remove("active");
        dom.tabWebcam.classList.add("active");
        dom.uploadVideoButton.classList.add("hidden");
        dom.enableWebcamButton.classList.remove("hidden");
        dom.videoOverlayMsg.classList.add("hidden");
        dom.video.classList.add("mirrored");
        dom.canvasElement.classList.add("mirrored");
        if(dom.previewCanvas) dom.previewCanvas.classList.add("mirrored");
    }
    
    // Limpiar canvas local
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

        const constraints = { video: { width: 640, height: 480 } }; 
        navigator.mediaDevices.getUserMedia(constraints).then((stream) =>{
            dom.video.removeAttribute('src'); // Limpiamos rastro de archivo
            dom.video.srcObject = stream;
            
            // onplaying asegura que el video realmente tiene datos fluyendo
            dom.video.onplaying = () => {
                dom.recordButton.disabled = false;
                if (onMediaReadyCallback) onMediaReadyCallback();
            };
            dom.video.play();
        }).catch(err => {
            console.error("Error webcam:", err);
            webcamRunning = false;
            dom.enableWebcamButton.classList.remove("accent-btn");
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
    dom.video.muted = true; // REQUISITO para reproducir sin interacción en algunos navegadores

    dom.video.onplaying = () => {
        videoTrackingActive = true;
        dom.recordButton.disabled = false;
        if (onMediaReadyCallback) onMediaReadyCallback();
    };
    
    dom.video.play();
}