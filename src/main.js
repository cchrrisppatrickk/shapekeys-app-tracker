// ==========================================
// ARCHIVO PRINCIPAL (main.js)
// Inicialización, bucles y conexión entre módulos
// ==========================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FaceLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

// Importar módulos de lógica
import { LIGHT_CONFIG } from './logic/constants.js';
import * as Avatar from './logic/avatar-control.js';
import * as Recorder from './logic/recorder.js';
import * as UI from './logic/ui-handler.js';
import { exportTakeToGLB } from './logic/exporter.js';

// ==========================================
// 1. REFERENCIAS DOM
// ==========================================
const dom = {
    // Panel Principal
    videoBlendShapes: document.getElementById("video-blend-shapes"),
    video: document.getElementById("webcam"),
    canvasElement: document.getElementById("output_canvas"),
    enableWebcamButton: document.getElementById("webcamButton"),
    recordButton: document.getElementById("recordButton"),
    
    // --- ELEMENTOS VIEJOS ELIMINADOS (PlayButton simple) ---
    // playButton: document.getElementById("playButton"), 
    
    // --- NUEVOS ELEMENTOS DE UI ---
    timerDisplay: document.getElementById("recording-timer"),
    clipsList: document.getElementById("clips-list"),
    takesCount: document.getElementById("takes-count"),
    exportButton: document.getElementById("exportButton"),
    // -----------------------------

    // Modal de Configuración (igual que antes)
    setupModal: document.getElementById('setup-modal'),
    previewContainer: document.getElementById('preview-three-container'),
    mainContainer: document.getElementById('three-container'),
    confirmBtn: document.getElementById('confirm-mapping-btn'),
    placeholderText: document.querySelector('.preview-placeholder'),
    headSelect: document.getElementById('head-bone-select'),
    neckSelect: document.getElementById('neck-bone-select'),
    headSearchInput: document.getElementById('head-bone-search'),
    neckSearchInput: document.getElementById('neck-bone-search'),
    activeBoneDisplay: document.getElementById('active-bone-display'),
    autoDetectBtn: document.getElementById('auto-detect-btn'),

    // --- NUEVAS REFERENCIAS PARA MODO VIDEO ---
    tabWebcam: document.getElementById("tab-webcam"),
    tabVideo: document.getElementById("tab-video"),
    dropZoneVideo: document.getElementById("drop-zone-video"),
    videoOverlayMsg: document.getElementById("video-overlay-msg"),
    videoFileInput: document.getElementById("videoFileInput"),
    uploadVideoButton: document.getElementById("uploadVideoButton"),
    // ------------------------------------------
};

// ==========================================
// 2. VARIABLES GLOBALES DEL SISTEMA
// ==========================================
let faceLandmarker;
let webcamRunning = false;
let videoTrackingActive = false; // NUEVO: Para saber si estamos trackeando un video local
let currentMode = 'webcam';      // NUEVO: 'webcam' o 'video'
let lastVideoTime = -1;
let results = undefined;

const canvasCtx = dom.canvasElement.getContext("2d");
const drawingUtils = new DrawingUtils(canvasCtx);

// Three.js
let scene, camera, renderer, controls;

// ==========================================
// 3. INICIALIZACIÓN
// ==========================================
async function init() {
    await createFaceLandmarker();
    initThreeJS();
    initUIHandlers();
    initEventListeners();
}

// Inicializar MediaPipe
async function createFaceLandmarker() {
    const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 1
    });
}

// Inicializar Three.js
function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    const width = dom.previewContainer.clientWidth;
    const height = dom.previewContainer.clientHeight;

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 1.2);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    dom.previewContainer.appendChild(renderer.domElement);

    // Luces
    const ambientLight = new THREE.AmbientLight(LIGHT_CONFIG.ambient.color, LIGHT_CONFIG.ambient.intensity);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(LIGHT_CONFIG.keyLight.color, LIGHT_CONFIG.keyLight.intensity);
    keyLight.position.set(...LIGHT_CONFIG.keyLight.position);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(LIGHT_CONFIG.fillLight.color, LIGHT_CONFIG.fillLight.intensity);
    fillLight.position.set(...LIGHT_CONFIG.fillLight.position);
    scene.add(fillLight);

    // Controles
    // Reemplaza la configuración actual de OrbitControls por esta:
controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.35, 0);

// Habilita el damping (inercia) para movimientos más suaves
controls.enableDamping = true;
controls.dampingFactor = 0.08; // Un valor más alto = más suavizado (0.01 es muy sensible, 0.1 es bastante lento)

// Ajusta la velocidad de rotación y desplazamiento
controls.rotateSpeed = 0.8;      // Disminuye si la rotación es demasiado rápida
controls.panSpeed = 0.8;          // Controla la velocidad del movimiento con clic derecho

// Configuración de zoom
controls.enableZoom = true;
controls.zoomSpeed = 1.0;

// Asegura que el clic derecho sea para panear (ya es el comportamiento por defecto)
controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
};

// Límites para evitar que la cámara se aleje o acerque demasiado
controls.minDistance = 0.5;
controls.maxDistance = 5.0;

// Opcional: restringir ángulos de rotación (por ejemplo, para no ver debajo del suelo)
controls.maxPolarAngle = Math.PI; // Limita a 90 grados hacia abajo

controls.update();

    animate3D();

    window.addEventListener('resize', onWindowResize);
}

function animate3D() {
    requestAnimationFrame(animate3D);
    if (controls) controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    const parent = renderer.domElement.parentNode;
    if (parent) {
        const width = parent.clientWidth;
        const height = parent.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }
}

// Inicializar manejadores de UI
function initUIHandlers() {
    // Pasar las nuevas referencias a UI
    UI.initUI({
        videoBlendShapes: dom.videoBlendShapes,
        headSelect: dom.headSelect,
        neckSelect: dom.neckSelect,
        headSearchInput: dom.headSearchInput,
        neckSearchInput: dom.neckSearchInput,
        activeBoneDisplay: dom.activeBoneDisplay,
        autoDetectBtn: dom.autoDetectBtn,
        
        // Nuevas referencias conectadas:
        timerDisplay: dom.timerDisplay,
        clipsList: dom.clipsList,
        takesCount: dom.takesCount,
        exportButton: dom.exportButton
    });

    Recorder.initRecorderUI({
        onRecordStateChange: (isRecording, hasData) => {
            dom.recordButton.classList.toggle("recording", isRecording);
            
            // Texto del botón REC
            const label = dom.recordButton.querySelector('.mdc-button__label');
            if(label) label.innerText = isRecording ? "PARAR" : "REC";
            
            // Activar visualmente el timer
            UI.setTimerActive(isRecording);
        },
        onPlayStateChange: (isPlaying) => {
            // Deshabilitar REC mientras se reproduce una toma
            dom.recordButton.disabled = isPlaying;
        },
        onTimerUpdate: (timeString) => {
            UI.updateTimerDisplay(timeString);
        },
        onTakesUpdated: (takes, activeId) => {
            UI.renderClipsList(takes, activeId);
        }
    });
}

// ==========================================
// 4. EVENTOS PRINCIPALES
// ==========================================
function initEventListeners() {
    // Drag & Drop
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', handleDrop);

    // --- NUEVO: PESTAÑAS (TABS) ---
    dom.tabWebcam.addEventListener("click", () => switchInputMode('webcam'));
    dom.tabVideo.addEventListener("click", () => switchInputMode('video'));

    // --- NUEVO: UPLOAD & DRAG & DROP DE VIDEO ---
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

    // Webcam
    dom.enableWebcamButton.addEventListener("click", toggleWebcam);

    // Grabación (El Play se maneja desde la lista ahora)
    dom.recordButton.addEventListener("click", toggleRecording);
    
    // Confirmación del modal
    dom.confirmBtn.addEventListener('click', confirmMapping);
    
    // Exportar (funcionalidad placeholder hasta el próximo paso)
    if (dom.exportButton) {
    dom.exportButton.addEventListener("click", () => {
        // 1. Verificar qué toma está activa
        const takeId = Recorder.activeTakeId;
        const take = Recorder.allTakes.find(t => t.id === takeId);
        
        if (!take) {
            alert("Selecciona una toma de la lista para exportar.");
            return;
        }

        // 2. Bloquear botón visualmente (feedback)
        const originalText = dom.exportButton.querySelector('.mdc-button__label').innerText;
        dom.exportButton.disabled = true;
        dom.exportButton.querySelector('.mdc-button__label').innerText = "PROCESANDO...";

        // 3. Ejecutar exportación
        // Necesitamos pasarle el modelo y el hueso actual para que sepa qué empaquetar
        try {
            exportTakeToGLB(take, Avatar.avatarModel, Avatar.headBone);
        } catch (e) {
            console.error(e);
            alert("Error crítico al exportar.");
        } finally {
            // Restaurar botón (un pequeño delay para que se sienta el proceso)
            setTimeout(() => {
                dom.exportButton.disabled = false;
                dom.exportButton.querySelector('.mdc-button__label').innerText = originalText;
            }, 1000);
        }
    });
}
}
// Manejar carga de modelo por drag & drop
function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf'))) {
        if (dom.placeholderText) dom.placeholderText.innerText = "Procesando...";

        const fileURL = URL.createObjectURL(file);
        const loader = new GLTFLoader();

        loader.load(fileURL, (gltf) => {
            if (Avatar.avatarModel) scene.remove(Avatar.avatarModel);
            
            const model = gltf.scene;
            scene.add(model);
            Avatar.setAvatarModel(model);

            if (dom.placeholderText) dom.placeholderText.style.display = "none";
            console.log(`¡Modelo ${file.name} cargado!`);

            const detectedBones = [];
            model.traverse((node) => {
                if (node.isBone) detectedBones.push(node.name);
            });

            UI.populateBoneSelectors(detectedBones);

        }, undefined, (error) => {
            console.error(error);
            if (dom.placeholderText) dom.placeholderText.innerText = "Error al cargar.";
        });
    }
}

// Activar/Desactivar webcam
function toggleWebcam() {
    if (!faceLandmarker) return;

    if (webcamRunning) {
        webcamRunning = false;
        dom.enableWebcamButton.classList.remove("accent-btn");
        dom.video.srcObject.getTracks().forEach(track => track.stop());
        dom.recordButton.disabled = true;
    } else {
        webcamRunning = true;
        dom.enableWebcamButton.classList.add("accent-btn");

        if (Recorder.isPlaying) Recorder.stopPlayback();

        const constraints = { video: { width: 1280, height: 720 } };
        navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
            dom.video.srcObject = stream;
            dom.video.addEventListener("loadeddata", () => {
                predictWebcam();
                dom.recordButton.disabled = false;
            });
        });
    }
}

// Confirmar mapeo de huesos y cerrar modal
function confirmMapping() {
    if (!Avatar.avatarModel) {
        alert("Arrastra un modelo .glb primero.");
        return;
    }
    
    const headName = dom.headSelect.value;
    const neckName = dom.neckSelect.value;
    
    const headBone = headName ? Avatar.avatarModel.getObjectByName(headName) : null;
    const neckBone = neckName ? Avatar.avatarModel.getObjectByName(neckName) : null;
    
    Avatar.setBones(headBone, neckBone);

    if (!headBone) {
        alert("Advertencia: No has seleccionado hueso de cabeza. La rotación no funcionará.");
    }

    // Mover el renderer al contenedor principal
    dom.mainContainer.appendChild(renderer.domElement);

    const newWidth = dom.mainContainer.clientWidth;
    const newHeight = dom.mainContainer.clientHeight;
    renderer.setSize(newWidth, newHeight);
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();

    scene.background = new THREE.Color(0x0a0a0a);
    dom.setupModal.style.display = 'none';
}

// ==========================================
// 5. BUCLE DE RASTREO (WEBCAM)
// ==========================================
async function predictWebcam() {
    dom.canvasElement.style.width = dom.video.clientWidth + "px";
    dom.canvasElement.style.height = dom.video.clientHeight + "px";
    dom.canvasElement.width = dom.video.videoWidth;
    dom.canvasElement.height = dom.video.videoHeight;

    let startTimeMs = performance.now();
    if (lastVideoTime !== dom.video.currentTime) {
        lastVideoTime = dom.video.currentTime;
        results = faceLandmarker.detectForVideo(dom.video, startTimeMs);
    }

    // Dibujar landmarks en el canvas
    canvasCtx.clearRect(0, 0, dom.canvasElement.width, dom.canvasElement.height);
    if (results && results.faceLandmarks) {
        for (const landmarks of results.faceLandmarks) {
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C040", lineWidth: 1 });
        }
    }

    // Actualizar avatar si no estamos reproduciendo
    if (!Recorder.isPlaying && results) {
        const hasBlendshapes = results.faceBlendshapes && results.faceBlendshapes.length > 0;
        const hasMatrices = results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0;

        if (hasBlendshapes) {
            const categories = results.faceBlendshapes[0].categories;
            Avatar.updateModelMorphs(categories);
            UI.drawBlendShapes(categories);
        }
        if (hasMatrices) {
            Avatar.applyHeadPoseToModel(results.facialTransformationMatrixes[0].data);
        }

        // Grabar frame si estamos grabando
        if (Recorder.isRecording && hasBlendshapes && hasMatrices) {
            Recorder.captureFrame(results);
        }

        
    }

    if (webcamRunning || videoTrackingActive) {
        window.requestAnimationFrame(predictWebcam);
    }
}

// ==========================================
// 6. CONTROL DE GRABACIÓN
// ==========================================
function toggleRecording() {
    if (Recorder.isRecording) {
        Recorder.stopRecording();
    } else {
        Recorder.startRecording();
    }
}

function togglePlayback() {
    if (Recorder.isPlaying) {
        Recorder.stopPlayback();
    } else {
        Recorder.startPlayback();
    }
}

// --- NUEVO: Cambiar entre Webcam y Archivo de Video ---
function switchInputMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;

    // Detener lo que esté sonando/grabando
    if (webcamRunning) toggleWebcam(); 
    if (videoTrackingActive) {
        videoTrackingActive = false;
        dom.video.pause();
        dom.video.src = ""; // Limpiar video local
    }
    if (Recorder.isRecording) Recorder.stopRecording();

    // Resetear UI
    dom.recordButton.disabled = true;

    if (mode === 'video') {
        dom.tabWebcam.classList.remove("active");
        dom.tabVideo.classList.add("active");
        
        dom.enableWebcamButton.classList.add("hidden");
        dom.uploadVideoButton.classList.remove("hidden");
        dom.videoOverlayMsg.classList.remove("hidden");
        
        // Quitar modo espejo para videos
        dom.video.classList.remove("mirrored");
        dom.canvasElement.classList.remove("mirrored");
    } else {
        dom.tabVideo.classList.remove("active");
        dom.tabWebcam.classList.add("active");
        
        dom.uploadVideoButton.classList.add("hidden");
        dom.enableWebcamButton.classList.remove("hidden");
        dom.videoOverlayMsg.classList.add("hidden");
        
        // Activar modo espejo para webcam
        dom.video.classList.add("mirrored");
        dom.canvasElement.classList.add("mirrored");
    }
    
    // Limpiar canvas
    canvasCtx.clearRect(0, 0, dom.canvasElement.width, dom.canvasElement.height);
}

// --- NUEVO: Procesar archivo de video cargado ---
function handleVideoFile(file) {
    if (!file || !file.type.startsWith('video/')) {
        alert('Por favor, sube un archivo de video válido (.mp4, .webm).');
        return;
    }

    // Ocultar overlay
    dom.videoOverlayMsg.classList.add("hidden");

    // Crear URL temporal para el video
    const fileURL = URL.createObjectURL(file);
    dom.video.srcObject = null; // Desvincular webcam si estuviera
    dom.video.src = fileURL;
    dom.video.loop = true; // Que el video se repita
    dom.video.muted = true; // Evitar problemas de autoplay con sonido

    dom.video.onloadeddata = () => {
        dom.video.play();
        videoTrackingActive = true;
        dom.recordButton.disabled = false;
        
        // Iniciar el bucle de predicción
        predictWebcam();
    };
}


// ==========================================
// 7. INICIAR TODO
// ==========================================
init();