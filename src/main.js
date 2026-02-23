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
    playButton: document.getElementById("playButton"),
    playLabel: document.getElementById("playLabel"),
    playIcon: document.getElementById("playIcon"),
    exportButton: document.getElementById("exportButton"),

    // Modal de Configuración
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
    autoDetectBtn: document.getElementById('auto-detect-btn')
};

// ==========================================
// 2. VARIABLES GLOBALES DEL SISTEMA
// ==========================================
let faceLandmarker;
let webcamRunning = false;
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
    controls = new OrbitControls(camera, renderer.domElement);
    controls.listenToKeyEvents(window);
    controls.target.set(0, 1.35, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.minDistance = 0.5;
    controls.maxDistance = 5;
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
    UI.initUI({
        videoBlendShapes: dom.videoBlendShapes,
        headSelect: dom.headSelect,
        neckSelect: dom.neckSelect,
        headSearchInput: dom.headSearchInput,
        neckSearchInput: dom.neckSearchInput,
        activeBoneDisplay: dom.activeBoneDisplay,
        autoDetectBtn: dom.autoDetectBtn
    });

    Recorder.initRecorderUI({
        onRecordStateChange: (isRecording, hasData) => {
            dom.recordButton.classList.toggle("recording", isRecording);
            dom.playButton.disabled = isRecording || !hasData;
            dom.exportButton.disabled = isRecording || !hasData;
        },
        onPlayStateChange: (isPlaying) => {
            dom.playLabel.innerText = isPlaying ? "DETENER" : "REVISAR GRABACIÓN";
            if (dom.playIcon) dom.playIcon.innerText = isPlaying ? "stop" : "play_arrow";
            dom.playButton.classList.toggle("playing", isPlaying);
            dom.recordButton.disabled = isPlaying;
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

    // Webcam
    dom.enableWebcamButton.addEventListener("click", toggleWebcam);

    // Grabación y Reproducción
    dom.recordButton.addEventListener("click", toggleRecording);
    dom.playButton.addEventListener("click", togglePlayback);

    // Confirmación del modal
    dom.confirmBtn.addEventListener('click', confirmMapping);
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

    if (webcamRunning) {
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

// ==========================================
// 7. INICIAR TODO
// ==========================================
init();