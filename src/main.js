// ==========================================
// ARCHIVO PRINCIPAL (main.js)
// Inicialización, bucles y conexión entre módulos
// ==========================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Importar módulos de lógica
import { LIGHT_CONFIG } from './logic/constants.js';
import * as Avatar from './logic/avatar-control.js';
import * as Recorder from './logic/recorder.js';
import * as UI from './logic/ui-handler.js';
import * as MediaManager from './logic/media-manager.js';
import { exportTakeToGLB } from './logic/exporter.js';

import { FaceLandmarker, PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

import Stats from 'three/addons/libs/stats.module.js';

// ==========================================
// 1. REFERENCIAS DOM
// ==========================================
const dom = {
    videoBlendShapes: document.getElementById("video-blend-shapes"),
    video: document.getElementById("webcam"),
    canvasElement: document.getElementById("output_canvas"),
    enableWebcamButton: document.getElementById("webcamButton"),
    recordButton: document.getElementById("recordButton"),
    timerDisplay: document.getElementById("recording-timer"),
    clipsList: document.getElementById("clips-list"),
    takesCount: document.getElementById("takes-count"),
    exportButton: document.getElementById("exportButton"),
    
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

    tabWebcam: document.getElementById("tab-webcam"),
    tabVideo: document.getElementById("tab-video"),
    dropZoneVideo: document.getElementById("drop-zone-video"),
    videoOverlayMsg: document.getElementById("video-overlay-msg"),
    videoFileInput: document.getElementById("videoFileInput"),
    uploadVideoButton: document.getElementById("uploadVideoButton")

    
};

// ==========================================
// 2. VARIABLES GLOBALES
// ==========================================
let poseLandmarker;

let faceLandmarker;
let lastVideoTime = -1;
let results = undefined;
// Variables de estado
let currentTrackingMode = null; // 'face', 'body', o 'full'

// Referencias DOM
const modeCards = document.querySelectorAll('.mode-card');
const step1 = document.getElementById('wizard-step-1');
const step2 = document.getElementById('wizard-step-2');
const btnBack = document.getElementById('btn-back-step');
const btnConfirm = document.getElementById('confirm-mapping-btn');
const modalTitle = document.getElementById('modal-title');

const panelFace = document.getElementById('panel-face-config');
const panelBody = document.getElementById('panel-body-config');

// Lógica de las cartillas
modeCards.forEach(card => {
    card.addEventListener('click', () => {
        // Remover selección previa
        modeCards.forEach(c => c.classList.remove('selected'));
        // Seleccionar actual
        card.classList.add('selected');
        currentTrackingMode = card.getAttribute('data-mode');
        
        // Pasar al paso 2
        goToStep2();
    });
});

function goToStep2() {
    step1.classList.add('hidden-step');
    step2.classList.remove('hidden-step');
    btnBack.classList.remove('hidden');
    btnConfirm.classList.remove('hidden');
    modalTitle.innerText = "Configura tu Avatar";

    // Mostrar paneles según el modo
    panelFace.classList.toggle('hidden', currentTrackingMode === 'body');
    panelBody.classList.toggle('hidden', currentTrackingMode === 'face');
}

btnBack.addEventListener('click', () => {
    step2.classList.add('hidden-step');
    step1.classList.remove('hidden-step');
    btnBack.classList.add('hidden');
    btnConfirm.classList.add('hidden');
    modalTitle.innerText = "¿Qué deseas capturar hoy?";
    currentTrackingMode = null;
    modeCards.forEach(c => c.classList.remove('selected'));
});

const canvasCtx = dom.canvasElement.getContext("2d");
const drawingUtils = new DrawingUtils(canvasCtx);
let scene, camera, renderer, controls, stats;

// ==========================================
// 3. INICIALIZACIÓN
// ==========================================
async function init() {
    await createLandmarkers();
    initThreeJS();
    initUIHandlers();
    initEventListeners();
}

async function createLandmarkers() {
    const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    
    // 1. Iniciar Modelo Facial
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

    // 2. Iniciar Modelo Corporal (Pose)
    poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            // Usamos la versión 'full' para buen balance entre precisión y rendimiento
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numPoses: 1
    });
}

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

    const ambientLight = new THREE.AmbientLight(LIGHT_CONFIG.ambient.color, LIGHT_CONFIG.ambient.intensity);
    scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(LIGHT_CONFIG.keyLight.color, LIGHT_CONFIG.keyLight.intensity);
    keyLight.position.set(...LIGHT_CONFIG.keyLight.position);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(LIGHT_CONFIG.fillLight.color, LIGHT_CONFIG.fillLight.intensity);
    fillLight.position.set(...LIGHT_CONFIG.fillLight.position);
    scene.add(fillLight);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.35, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.8;
    controls.panSpeed = 0.8;
    controls.enableZoom = true;
    controls.minDistance = 0.5;
    controls.maxDistance = 5.0;
    controls.maxPolarAngle = Math.PI;
    controls.update();

    // NUEVO: Inicializar Stats (Monitor de FPS)
    stats = new Stats();
    // Lo posicionamos absoluto para que no rompa tu maquetación
    stats.dom.style.position = 'absolute';
    stats.dom.style.top = '10px';
    stats.dom.style.left = '10px';
    // Lo añadimos al contenedor principal (o al document.body)
    dom.mainContainer.appendChild(stats.dom); 

    // Optimización 1: Limitar el Pixel Ratio
    // Los monitores modernos (MacBooks, móviles) tienen Pixel Ratio de 2 o 3. 
    // Renderizar a esa escala mata el rendimiento. Lo limitamos a máximo 2.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    animate3D();
    window.addEventListener('resize', onWindowResize);
}

function animate3D() {
    requestAnimationFrame(animate3D);
    if (controls) controls.update();
    renderer.render(scene, camera);
    
    if (stats) stats.update(); // NUEVO: Actualizar el contador de FPS
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

function initUIHandlers() {
    UI.initUI(dom);
    
    // INICIALIZAMOS EL NUEVO GESTOR MULTIMEDIA
    // Le pasamos las referencias del DOM y le decimos qué función debe ejecutar cuando empiece a reproducirse un video/webcam
    MediaManager.initMediaManager(dom, predictWebcam);

    Recorder.initRecorderUI({
        onRecordStateChange: (isRecording, hasData) => {
            dom.recordButton.classList.toggle("recording", isRecording);
            const label = dom.recordButton.querySelector('.mdc-button__label');
            if(label) label.innerText = isRecording ? "PARAR" : "REC";
            UI.setTimerActive(isRecording);
        },
        onPlayStateChange: (isPlaying) => {
            dom.recordButton.disabled = isPlaying;
        },
        onTimerUpdate: (timeString) => UI.updateTimerDisplay(timeString),
        onTakesUpdated: (takes, activeId) => UI.renderClipsList(takes, activeId)
    });
}

function initEventListeners() {
    // Model Drop
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', handleDrop);

    // Controles Base
    dom.recordButton.addEventListener("click", () => Recorder.isRecording ? Recorder.stopRecording() : Recorder.startRecording());
    dom.confirmBtn.addEventListener('click', confirmMapping);
    
    if (dom.exportButton) {
        dom.exportButton.addEventListener("click", () => {
            const takeId = Recorder.activeTakeId;
            const take = Recorder.allTakes.find(t => t.id === takeId);
            if (!take) return alert("Selecciona una toma de la lista para exportar.");

            const originalText = dom.exportButton.querySelector('.mdc-button__label').innerText;
            dom.exportButton.disabled = true;
            dom.exportButton.querySelector('.mdc-button__label').innerText = "PROCESANDO...";

            try {
                exportTakeToGLB(take, Avatar.avatarModel, Avatar.headBone);
            } catch (e) {
                console.error(e);
                alert("Error crítico al exportar.");
            } finally {
                setTimeout(() => {
                    dom.exportButton.disabled = false;
                    dom.exportButton.querySelector('.mdc-button__label').innerText = originalText;
                }, 1000);
            }
        });
    }
}

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

            const detectedBones = [];
            model.traverse((node) => { if (node.isBone) detectedBones.push(node.name); });
            UI.populateBoneSelectors(detectedBones);

        }, undefined, (error) => {
            console.error(error);
            if (dom.placeholderText) dom.placeholderText.innerText = "Error al cargar.";
        });
    }
}

function confirmMapping() {
    if (!Avatar.avatarModel) return alert("Arrastra un modelo .glb primero.");
    const headName = dom.headSelect.value;
    const neckName = dom.neckSelect.value;
    const headBone = headName ? Avatar.avatarModel.getObjectByName(headName) : null;
    const neckBone = neckName ? Avatar.avatarModel.getObjectByName(neckName) : null;
    
    Avatar.setBones(headBone, neckBone);
    if (!headBone) alert("Advertencia: No has seleccionado hueso de cabeza.");

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
// 4. BUCLE DE RASTREO (AI)
// ==========================================
async function predictWebcam() {
    dom.canvasElement.style.width = dom.video.clientWidth + "px";
    dom.canvasElement.style.height = dom.video.clientHeight + "px";
    dom.canvasElement.width = dom.video.videoWidth;
    dom.canvasElement.height = dom.video.videoHeight;

    let startTimeMs = performance.now();
    let faceResults = null;
    let poseResults = null;

    // CONDICIONAL: Solo procesar los modelos seleccionados
    if (lastVideoTime !== dom.video.currentTime) {
        lastVideoTime = dom.video.currentTime;
        
        if (currentTrackingMode === 'face' || currentTrackingMode === 'full') {
            faceResults = faceLandmarker.detectForVideo(dom.video, startTimeMs);
        }
        
        if (currentTrackingMode === 'body' || currentTrackingMode === 'full') {
            poseResults = poseLandmarker.detectForVideo(dom.video, startTimeMs);
        }
    }

    canvasCtx.clearRect(0, 0, dom.canvasElement.width, dom.canvasElement.height);

    if (!Recorder.isPlaying) {
        
        // --- 1. PROCESAR ROSTRO ---
        if (faceResults && faceResults.faceLandmarks) {
            // Dibujar malla (Opcional, puedes comentarlo para más FPS)
            for (const landmarks of faceResults.faceLandmarks) {
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C040", lineWidth: 1 });
            }

            const hasBlendshapes = faceResults.faceBlendshapes && faceResults.faceBlendshapes.length > 0;
            const hasMatrices = faceResults.facialTransformationMatrixes && faceResults.facialTransformationMatrixes.length > 0;

            if (hasBlendshapes) {
                const categories = faceResults.faceBlendshapes[0].categories;
                Avatar.updateModelMorphs(categories);
                UI.drawBlendShapes(categories); // UI
            }
            if (hasMatrices) {
                Avatar.applyHeadPoseToModel(faceResults.facialTransformationMatrixes[0].data);
            }
        }

        // --- 2. PROCESAR CUERPO ---
        if (poseResults && poseResults.landmarks) {
            // Dibujar esqueleto 2D de MediaPipe
            for (const landmark of poseResults.landmarks) {
                drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, { color: "#FF3B30", lineWidth: 2 });
                drawingUtils.drawLandmarks(landmark, { color: "#FFFFFF", lineWidth: 1, radius: 2 });
            }
            
            // TODO: Avatar.applyBodyPoseToModel(poseResults); (Lo haremos en el próximo paso)
        }

        // --- 3. GRABACIÓN ---
        if (Recorder.isRecording) {
            // Guardamos el frame empacando ambos resultados
            Recorder.captureFrame({ face: faceResults, pose: poseResults });
        }
    }

    // Continuar el bucle si hay medio activo
    if (MediaManager.webcamRunning || MediaManager.videoTrackingActive) {
        window.requestAnimationFrame(predictWebcam);
    }
}

// ==========================================
// 5. INICIAR
// ==========================================
init();