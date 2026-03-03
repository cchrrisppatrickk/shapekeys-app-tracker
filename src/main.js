// ==========================================
// ARCHIVO PRINCIPAL (main.js)
// Inicialización, bucles y conexión entre módulos
// ==========================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Importamos los Landmarkers de MediaPipe
import { FaceLandmarker, PoseLandmarker, HandLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

// Importar módulos de lógica
import { LIGHT_CONFIG } from './logic/constants.js';
import * as Avatar from './logic/avatar-control.js';
import * as Recorder from './logic/recorder.js';
import * as UI from './logic/ui-handler.js';
import * as MediaManager from './logic/media-manager.js';
import { exportTakeToGLB } from './logic/exporter.js';

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
    uploadVideoButton: document.getElementById("uploadVideoButton"),

    openSetupBtn: document.getElementById('open-setup-btn'),
    emptyWorkspaceState: document.getElementById('empty-workspace-state'),
    previewCanvas: document.getElementById("tracking-preview-canvas"),
};

// ==========================================
// 2. VARIABLES GLOBALES
// ==========================================
let faceLandmarker;
let poseLandmarker;
let handLandmarker;
let lastVideoTime = -1;
let faceResults = undefined;
let poseResults = undefined;
let handResults = undefined;

// Contextos 2D para Dibujo (Ambos canvas definidos aquí)
const canvasCtx = dom.canvasElement.getContext("2d");
const drawingUtils = new DrawingUtils(canvasCtx);

const previewCtx = dom.previewCanvas.getContext("2d");
const previewDrawingUtils = new DrawingUtils(previewCtx);

let scene, camera, renderer, controls, stats;

// ==========================================
// 3. INICIALIZACIÓN
// ==========================================
async function init() {
    await createFaceLandmarker();
    await createPoseLandmarker();
    await createHandLandmarker();
    initThreeJS();
    initUIHandlers();
    initEventListeners();
}

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

async function createPoseLandmarker() {
    const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numPoses: 1
    });
}

async function createHandLandmarker() {
    const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
    });
}

function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);

    const width = dom.previewContainer.clientWidth;
    const height = dom.previewContainer.clientHeight;

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 1.2);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

    stats = new Stats();
    stats.dom.style.position = 'absolute';
    stats.dom.style.top = '10px';
    stats.dom.style.left = '10px';
    dom.mainContainer.appendChild(stats.dom); 

    animate3D();
    window.addEventListener('resize', onWindowResize);
}

function animate3D() {
    requestAnimationFrame(animate3D);
    if (controls) controls.update();
    renderer.render(scene, camera);
    if (stats) stats.update();
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

    UI.initWorkspaceSwitcher();
}

function initEventListeners() {
    if (dom.openSetupBtn) {
        dom.openSetupBtn.addEventListener('click', () => {
            dom.setupModal.style.display = 'flex';
        });
    }

    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', handleDrop);

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

    if (dom.emptyWorkspaceState) {
        dom.emptyWorkspaceState.style.display = 'none';
    }

    dom.mainContainer.appendChild(renderer.domElement);
    const newWidth = dom.mainContainer.clientWidth;
    const newHeight = dom.mainContainer.clientHeight;
    renderer.setSize(newWidth, newHeight);
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
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
    canvasCtx.clearRect(0, 0, dom.canvasElement.width, dom.canvasElement.height);

    // ==========================================
    // MODO: FACE TRACKING
    // ==========================================
    if (UI.currentWorkspace === 'face') {
        if (lastVideoTime !== dom.video.currentTime) {
            lastVideoTime = dom.video.currentTime;
            faceResults = faceLandmarker.detectForVideo(dom.video, startTimeMs); // CORREGIDO: faceResults
        }

        if (faceResults && faceResults.faceLandmarks) {
            for (const landmarks of faceResults.faceLandmarks) {
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C040", lineWidth: 1 });
            }
        }

        if (!Recorder.isPlaying && faceResults) {
            const hasBlendshapes = faceResults.faceBlendshapes && faceResults.faceBlendshapes.length > 0;
            const hasMatrices = faceResults.facialTransformationMatrixes && faceResults.facialTransformationMatrixes.length > 0;

            if (hasBlendshapes) {
                Avatar.updateModelMorphs(faceResults.faceBlendshapes[0].categories);
                UI.drawBlendShapes(faceResults.faceBlendshapes[0].categories);
            }
            if (hasMatrices) Avatar.applyHeadPoseToModel(faceResults.facialTransformationMatrixes[0].data);
            
            // CORREGIDO: Se envía faceResults a Recorder
            if (Recorder.isRecording && hasBlendshapes && hasMatrices) Recorder.captureFrame(faceResults);
        }
    } 
    // ==========================================
    // MODO: BODY TRACKING (Cuerpo + Manos)
    // ==========================================
    else if (UI.currentWorkspace === 'body') {
        
        dom.previewCanvas.width = dom.video.videoWidth;
        dom.previewCanvas.height = dom.video.videoHeight;
        
        previewCtx.clearRect(0, 0, dom.previewCanvas.width, dom.previewCanvas.height);

        if (lastVideoTime !== dom.video.currentTime) {
            poseResults = poseLandmarker.detectForVideo(dom.video, startTimeMs);
            handResults = handLandmarker.detectForVideo(dom.video, startTimeMs);
            lastVideoTime = dom.video.currentTime;
        }

        if (poseResults && poseResults.landmarks) {
            for (const landmark of poseResults.landmarks) {
                previewDrawingUtils.drawLandmarks(landmark, { radius: 4, color: "#f85149" });
                previewDrawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, { color: "#2f81f7", lineWidth: 3 });
            }
        }

        if (handResults && handResults.landmarks) {
            for (const landmarks of handResults.landmarks) {
                previewDrawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#e3b341", lineWidth: 2 });
                previewDrawingUtils.drawLandmarks(landmarks, { color: "#ffffff", lineWidth: 1, radius: 2 });
            }
        }
    }

    if (MediaManager.webcamRunning || MediaManager.videoTrackingActive) {
        window.requestAnimationFrame(predictWebcam);
    }
}

// ==========================================
// 5. INICIAR
// ==========================================
init();