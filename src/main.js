// ==========================================
// 1. IMPORTACIONES
// ==========================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FaceLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

// ==========================================
// 2. REFERENCIAS DOM
// ==========================================
// Panel Principal
const videoBlendShapes = document.getElementById("video-blend-shapes");
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const enableWebcamButton = document.getElementById("webcamButton");
const webcamLabel = document.getElementById("webcamLabel");
const recordButton = document.getElementById("recordButton");
const recordLabel = document.getElementById("recordLabel");
const recordingIndicator = document.getElementById("recording-indicator");

// Modal de Configuración
const setupModal = document.getElementById('setup-modal');
const previewContainer = document.getElementById('preview-three-container');
const mainContainer = document.getElementById('three-container');
const confirmBtn = document.getElementById('confirm-mapping-btn');
const placeholderText = document.querySelector('.preview-placeholder');
const headSelect = document.getElementById('head-bone-select');
const neckSelect = document.getElementById('neck-bone-select');
const headSearchInput = document.getElementById('head-bone-search');
const neckSearchInput = document.getElementById('neck-bone-search');
const activeBoneDisplay = document.getElementById('active-bone-display');
const autoDetectBtn = document.getElementById('auto-detect-btn');

// ==========================================
// 3. VARIABLES GLOBALES
// ==========================================
// MediaPipe & Video
let faceLandmarker;
let webcamRunning = false;
let lastVideoTime = -1;
let results = undefined;
const drawingUtils = new DrawingUtils(canvasCtx);

// Three.js
let scene, camera, renderer, controls;
let avatarModel = null;
let headBone = null;
let neckBone = null;
let allDetectedBones = []; // Lista maestra para el buscador

// Grabación
let isRecording = false;
let recordedData = []; 
let recordingStartTime = 0;

// ==========================================
// 4. INICIALIZACIÓN (MOTOR IA & 3D)
// ==========================================

// A. MediaPipe FaceLandmarker
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
createFaceLandmarker();

// B. Three.js Scene
function initThreeJS() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111); // Fondo oscuro inicial

  const width = previewContainer.clientWidth;
  const height = previewContainer.clientHeight;

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 1.4, 1.2); // Cámara centrada en la cara

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // Mejor color

  // Renderizar inicialmente en el Modal
  previewContainer.appendChild(renderer.domElement);

  // Iluminación de Estudio
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(-1, 2, 2);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
  fillLight.position.set(1, 1, 2);
  scene.add(fillLight);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.35, 0); // Apuntar a la altura de la cabeza
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.update();

  animate3D();
}

function animate3D() {
  requestAnimationFrame(animate3D);
  if(controls) controls.update();
  renderer.render(scene, camera);
}

// Redimensionado Inteligente (Funciona tanto en Modal como en Panel Principal)
window.addEventListener('resize', () => {
  const parent = renderer.domElement.parentNode;
  if (parent) {
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
});

initThreeJS();

// ==========================================
// 5. LÓGICA DE CARGA DE MODELO (DRAG & DROP)
// ==========================================
window.addEventListener('dragover', (e) => e.preventDefault());

window.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  
  if (file && (file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf'))) {
    if(placeholderText) placeholderText.innerText = "Procesando...";
    
    const fileURL = URL.createObjectURL(file);
    const loader = new GLTFLoader();
    
    loader.load(fileURL, (gltf) => {
      // Limpieza previa
      if (avatarModel) scene.remove(avatarModel);
      
      avatarModel = gltf.scene;
      scene.add(avatarModel);

      if(placeholderText) placeholderText.style.display = "none";
      console.log(`¡Modelo ${file.name} cargado!`);

      // Extraer huesos para poblar listas
      const detectedBones = [];
      avatarModel.traverse((node) => {
        if (node.isBone) detectedBones.push(node.name);
      });

      populateBoneSelectors(detectedBones);

      // (Opcional) Auto-detección silenciosa inicial
      // autoDetectBtn.click(); 

    }, undefined, (error) => {
      console.error(error);
      if(placeholderText) placeholderText.innerText = "Error al cargar.";
    });
  }
});

// ==========================================
// 6. GESTIÓN DE CÁMARA Y BUCLE PRINCIPAL
// ==========================================
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  enableWebcamButton.addEventListener("click", enableCam);
}

function enableCam() {
  if (!faceLandmarker) {
    console.warn("MediaPipe aún no ha cargado.");
    return;
  }

  if (webcamRunning === true) {
    // APAGAR CÁMARA
    webcamRunning = false;
    webcamLabel.innerText = "ACTIVAR CÁMARA";
    enableWebcamButton.classList.remove("accent-btn"); // Quitar estilo activo
    video.srcObject.getTracks().forEach(track => track.stop());
    recordButton.disabled = true; // Desactivar REC
  } else {
    // ENCENDER CÁMARA
    webcamRunning = true;
    webcamLabel.innerText = "DESACTIVAR";
    enableWebcamButton.classList.add("accent-btn");
    
    const constraints = { video: { width: 1280, height: 720 } }; // HD preferido
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      video.srcObject = stream;
      video.addEventListener("loadeddata", () => {
        predictWebcam();
        recordButton.disabled = false; // Activar REC cuando hay video
      });
    });
  }
}

async function predictWebcam() {
  // Ajuste de tamaño del canvas 2D
  canvasElement.style.width = video.clientWidth + "px";
  canvasElement.style.height = video.clientHeight + "px";
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

  // Detección con MediaPipe
  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = faceLandmarker.detectForVideo(video, startTimeMs);
  }

  // Dibujar malla 2D (Feedback visual en video)
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  if (results && results.faceLandmarks) {
    for (const landmarks of results.faceLandmarks) {
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C040", lineWidth: 1 });
    }
  }

  // PROCESAMIENTO DE DATOS 3D & GRABACIÓN
  if (results) {
    const hasBlendshapes = results.faceBlendshapes && results.faceBlendshapes.length > 0;
    const hasMatrices = results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0;

    // 1. Actualizar UI y Modelo 3D (Tiempo Real)
    if (hasBlendshapes) {
      drawBlendShapes(videoBlendShapes, results.faceBlendshapes);
      applyBlendshapesToModel(results.faceBlendshapes);
    }
    if (hasMatrices) {
      applyHeadPoseToModel(results.facialTransformationMatrixes[0].data);
    }

    // 2. GRABAR FRAME (Si el usuario presionó REC)
    if (isRecording && hasBlendshapes && hasMatrices) {
      captureFrame(results);
    }
  }
  
  // Bucle infinito
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

// ==========================================
// 7. LÓGICA DE MAPEO Y BLENDSHAPES
// ==========================================

// Diccionario ARKit (MediaPipe) -> Morph Targets
const blendshapeMap = {
  eyeBlinkLeft: "Eye_Blink_L", eyeLookDownLeft: "Eye_L_Look_Down", eyeLookInLeft: "Eye_L_Look_R", 
  eyeLookOutLeft: "Eye_L_Look_L", eyeLookUpLeft: "Eye_L_Look_Up", eyeSquintLeft: "Eye_Squint_L", 
  eyeWideLeft: "Eye_Wide_L", eyeBlinkRight: "Eye_Blink_R", eyeLookDownRight: "Eye_R_Look_Down", 
  eyeLookInRight: "Eye_R_Look_L", eyeLookOutRight: "Eye_R_Look_R", eyeLookUpRight: "Eye_R_Look_Up", 
  eyeSquintRight: "Eye_Squint_R", eyeWideRight: "Eye_Wide_R", jawForward: "Jaw_Forward", 
  jawLeft: "Jaw_L", jawRight: "Jaw_R", jawOpen: "Jaw_Open", mouthClose: "Mouth_Close", 
  mouthFunnel: "Mouth_Funnel", mouthPucker: "Mouth_Pucker", mouthLeft: "Mouth_L", 
  mouthRight: "Mouth_R", mouthSmileLeft: "Mouth_Smile_L", mouthSmileRight: "Mouth_Smile_R", 
  mouthFrownLeft: "Mouth_Frown_L", mouthFrownRight: "Mouth_Frown_R", mouthDimpleLeft: "Mouth_Dimple_L", 
  mouthDimpleRight: "Mouth_Dimple_R", mouthStretchLeft: "Mouth_Stretch_L", mouthStretchRight: "Mouth_Stretch_R", 
  mouthRollLower: "Mouth_Roll_In_Lower", mouthRollUpper: "Mouth_Roll_In_Upper", mouthShrugLower: "Mouth_Shrug_Lower", 
  mouthShrugUpper: "Mouth_Shrug_Upper", mouthPressLeft: "Mouth_Press_L", mouthPressRight: "Mouth_Press_R", 
  mouthLowerDownLeft: "Mouth_Down_Lower_L", mouthLowerDownRight: "Mouth_Down_Lower_R", mouthUpperUpLeft: "Mouth_Up_Upper_L", 
  mouthUpperUpRight: "Mouth_Up_Upper_R", browDownLeft: "Brow_Drop_L", browDownRight: "Brow_Drop_R", 
  browInnerUp: "Brow_Raise_Inner_L", browOuterUpLeft: "Brow_Raise_Outer_L", browOuterUpRight: "Brow_Raise_Outer_R", 
  cheekPuff: "Cheek_Puff_L", cheekSquintLeft: "Cheek_Raise_L", cheekSquintRight: "Cheek_Raise_R", 
  noseSneerLeft: "Nose_Sneer_L", noseSneerRight: "Nose_Sneer_R"
};

function applyBlendshapesToModel(mediaPipeBlendshapes) {
  if (!avatarModel || !mediaPipeBlendshapes || mediaPipeBlendshapes.length === 0) return;
  const shapes = mediaPipeBlendshapes[0].categories;
  
  shapes.forEach((shape) => {
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

function applyHeadPoseToModel(matrixData) {
  if (!headBone) return;
  
  const matrix = new THREE.Matrix4().fromArray(matrixData);
  const rotation = new THREE.Euler().setFromRotationMatrix(matrix);
  
  // Mapeo de Ejes (Ajustar según necesidad del Rig)
  headBone.rotation.x = rotation.x;  // Pitch (Arriba/Abajo)
  headBone.rotation.y = -rotation.y; // Yaw (Izquierda/Derecha - Invertido para espejo)
  headBone.rotation.z = -rotation.z; // Roll (Inclinación - Invertido)
}

function drawBlendShapes(el, blendShapes) {
  if (!blendShapes || !blendShapes.length) return;
  
  let htmlMaker = "";
  // Renderizamos solo los primeros 6-8 valores más activos para no saturar, o todos si prefieres
  blendShapes[0].categories.forEach((shape) => {
    const score = parseFloat(shape.score);
    // Solo mostrar si tiene actividad > 1% para mantener la lista limpia (opcional)
    // if (score > 0.01) { 
      htmlMaker += `
        <li class="blend-shapes-item">
          <span class="blend-shapes-label">${shape.categoryName}</span>
          <span class="blend-shapes-value" style="width: ${Math.min(score * 100, 100)}px"></span>
        </li>`;
    // }
  });
  if(el) el.innerHTML = htmlMaker;
}


// ==========================================
// 8. INTERFAZ DE USUARIO: MAPEO Y BÚSQUEDA
// ==========================================

// Poblar Selectores y Filtrado
function populateBoneSelectors(bonesList) {
  allDetectedBones = bonesList; 
  if(headSearchInput) headSearchInput.value = "";
  if(neckSearchInput) neckSearchInput.value = "";
  renderOptions(headSelect, allDetectedBones);
  renderOptions(neckSelect, allDetectedBones);
}

function renderOptions(selectElement, bones) {
  const currentVal = selectElement.value;
  selectElement.innerHTML = '<option value="">-- Selecciona --</option>';
  bones.forEach(bone => selectElement.add(new Option(bone, bone)));
  if (currentVal && bones.includes(currentVal)) selectElement.value = currentVal;
}

function filterBones(searchInput, selectElement) {
  const term = searchInput.value.toLowerCase();
  const filtered = allDetectedBones.filter(bone => bone.toLowerCase().includes(term));
  renderOptions(selectElement, filtered);
}

if(headSearchInput) headSearchInput.addEventListener('input', () => filterBones(headSearchInput, headSelect));
if(neckSearchInput) neckSearchInput.addEventListener('input', () => filterBones(neckSearchInput, neckSelect));

// Feedback Visual en Modal
function highlightBoneInUI(boneName) {
  if (!boneName) {
    activeBoneDisplay.textContent = "Ninguno";
    activeBoneDisplay.className = 'active-bone-none';
    return;
  }
  activeBoneDisplay.textContent = `🦴 ${boneName}`;
  activeBoneDisplay.className = 'active-bone-selected';
}

headSelect.addEventListener('change', (e) => highlightBoneInUI(e.target.value));
neckSelect.addEventListener('change', (e) => highlightBoneInUI(e.target.value));

// Botón Confirmar: Mover Escena y Cerrar Modal
confirmBtn.addEventListener('click', () => {
  if (!avatarModel) {
    alert("Arrastra un modelo .glb primero.");
    return;
  }

  const hName = headSelect.value;
  const nName = neckSelect.value;
  
  if (hName) headBone = avatarModel.getObjectByName(hName);
  if (nName) neckBone = avatarModel.getObjectByName(nName);

  if(!headBone) {
    alert("Advertencia: No has seleccionado hueso de cabeza. La rotación no funcionará.");
  }

  // Mover Canvas al contenedor principal
  mainContainer.appendChild(renderer.domElement);
  
  // Ajustar tamaño
  const newWidth = mainContainer.clientWidth;
  const newHeight = mainContainer.clientHeight;
  renderer.setSize(newWidth, newHeight);
  camera.aspect = newWidth / newHeight;
  camera.updateProjectionMatrix();

  // Cambiar estilo para App Principal
  scene.background = new THREE.Color(0x0a0a0a); 
  setupModal.style.display = 'none'; 
});


// ==========================================
// 9. AUTO-DETECCIÓN INTELIGENTE
// ==========================================
const RIG_PATTERNS = {
  head: [/c_headx/i, /headx/i, /mixamorig:Head/i, /DEF-spine\.006/i, /DEF-head/i, /^head$/i, /head/i],
  neck: [/c_neckx/i, /neckx/i, /mixamorig:Neck/i, /DEF-spine\.004/i, /DEF-neck/i, /^neck$/i, /neck/i]
};

function findBestMatch(availableBones, regexList) {
  for (const pattern of regexList) {
    const match = availableBones.find(bone => pattern.test(bone));
    if (match) return match; 
  }
  return null; 
}

autoDetectBtn.addEventListener('click', () => {
  if (allDetectedBones.length === 0) {
    alert("¡Primero carga un modelo!");
    return;
  }
  console.log("Iniciando auto-detección...");
  
  const foundHead = findBestMatch(allDetectedBones, RIG_PATTERNS.head);
  if (foundHead) {
    headSelect.value = foundHead;
    highlightBoneInUI(foundHead);
  }

  const foundNeck = findBestMatch(allDetectedBones, RIG_PATTERNS.neck);
  if (foundNeck) {
    neckSelect.value = foundNeck;
    highlightBoneInUI(foundNeck); 
  }

  if (foundHead || foundNeck) {
    const originalText = autoDetectBtn.innerHTML; // Guardar el HTML del icono
    autoDetectBtn.innerHTML = `<span class="mdc-button__label">¡ENCONTRADO! ✅</span>`;
    setTimeout(() => autoDetectBtn.innerHTML = originalText, 2000);
  } else {
    alert("No se detectaron nombres estándar. Selecciona manualmente.");
  }
});


// ==========================================
// 10. SISTEMA DE GRABACIÓN
// ==========================================

function toggleRecording() {
  if (!isRecording) startRecording();
  else stopRecording();
}

function startRecording() {
  if (!headBone) {
    alert("Configura el esqueleto antes de grabar.");
    return;
  }
  isRecording = true;
  recordedData = []; 
  recordingStartTime = performance.now();
  
  recordButton.classList.add("recording");
  recordLabel.innerText = "PARAR";
  recordingIndicator.classList.remove("hidden");
  console.log("⏺ Grabación iniciada...");
}

function stopRecording() {
  isRecording = false;
  
  recordButton.classList.remove("recording");
  recordLabel.innerText = "REC";
  recordingIndicator.classList.add("hidden");
  
  const duration = (performance.now() - recordingStartTime) / 1000;
  console.log(`⏹ Fin Grabación. Frames: ${recordedData.length}. Duración: ${duration.toFixed(2)}s`);
}

function captureFrame(results) {
  const time = (performance.now() - recordingStartTime) / 1000;

  // IMPORTANTE: Clonar el Quaternion
  const rotation = headBone.quaternion.clone(); 
  
  // Guardar scores crudos de blendshapes
  const blendshapesData = [];
  const shapes = results.faceBlendshapes[0].categories;
  for (let i = 0; i < shapes.length; i++) {
    blendshapesData.push(shapes[i].score);
  }

  recordedData.push({ t: time, rot: rotation, bs: blendshapesData });
}

recordButton.addEventListener("click", toggleRecording);