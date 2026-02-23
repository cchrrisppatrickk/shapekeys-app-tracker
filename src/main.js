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
const webcamLabel = document.getElementById("webcamLabel"); // Nota: Si usas iconos, asegúrate de que este ID exista o ajusta el innerHTML
const recordButton = document.getElementById("recordButton");
const playButton = document.getElementById("playButton");
const playLabel = document.getElementById("playLabel");
const playIcon = document.getElementById("playIcon");
const exportButton = document.getElementById("exportButton");

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
// MediaPipe
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
let allDetectedBones = []; 

// Grabación y Reproducción
let isRecording = false;
let recordedData = []; 
let recordingStartTime = 0;
let isPlaying = false;
let playbackStartTime = 0;
let playbackAnimationId = null;

// ==========================================
// 4. MAPEO DE BLENDSHAPES (Diccionario)
// ==========================================
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

// ==========================================
// 5. INICIALIZACIÓN (MOTOR IA & 3D)
// ==========================================

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

function initThreeJS() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);

  const width = previewContainer.clientWidth;
  const height = previewContainer.clientHeight;

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 1.4, 1.2);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  previewContainer.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);
  
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(-1, 2, 2);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
  fillLight.position.set(1, 1, 2);
  scene.add(fillLight);

  // --- CONTROLES DE ÓRBITA CORREGIDOS ---
  controls = new OrbitControls(camera, renderer.domElement);
  controls.listenToKeyEvents(window); // Habilitar teclado
  controls.target.set(0, 1.35, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = true; // Habilitar paneo
  controls.screenSpacePanning = false;
  controls.minDistance = 0.5;
  controls.maxDistance = 5;
  controls.update();

  animate3D();
}

function animate3D() {
  requestAnimationFrame(animate3D);
  if(controls) controls.update();
  renderer.render(scene, camera);
}

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
// 6. CARGA DE MODELO (DRAG & DROP)
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
      if (avatarModel) scene.remove(avatarModel);
      avatarModel = gltf.scene;
      scene.add(avatarModel);

      if(placeholderText) placeholderText.style.display = "none";
      console.log(`¡Modelo ${file.name} cargado!`);

      const detectedBones = [];
      avatarModel.traverse((node) => {
        if (node.isBone) detectedBones.push(node.name);
      });

      populateBoneSelectors(detectedBones);

    }, undefined, (error) => {
      console.error(error);
      if(placeholderText) placeholderText.innerText = "Error al cargar.";
    });
  }
});

// ==========================================
// 7. GESTIÓN DE CÁMARA
// ==========================================
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  enableWebcamButton.addEventListener("click", enableCam);
}

function enableCam() {
  if (!faceLandmarker) return;

  if (webcamRunning === true) {
    webcamRunning = false;
    enableWebcamButton.classList.remove("accent-btn");
    video.srcObject.getTracks().forEach(track => track.stop());
    recordButton.disabled = true;
  } else {
    webcamRunning = true;
    enableWebcamButton.classList.add("accent-btn");
    
    if(isPlaying) stopPlayback(); // Detener si estaba reproduciendo

    const constraints = { video: { width: 1280, height: 720 } };
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      video.srcObject = stream;
      video.addEventListener("loadeddata", () => {
        predictWebcam();
        recordButton.disabled = false;
      });
    });
  }
}

// ==========================================
// 8. FUNCIONES DE ACTUALIZACIÓN DEL MODELO
// ==========================================

// Función Unificada: Recibe array de objetos {categoryName, score}
function updateModelMorphs(blendshapesArray) {
   if (!avatarModel || !blendshapesArray) return;

   blendshapesArray.forEach(shape => {
      const modelName = blendshapeMap[shape.categoryName];
      if(modelName) {
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
  
  headBone.rotation.x = rotation.x;  
  headBone.rotation.y = -rotation.y; 
  headBone.rotation.z = -rotation.z; 
}

function drawBlendShapes(el, categories) {
  if(!el || !categories) return;
  let html = "";
  categories.forEach(s => {
    html += `<li class="blend-shapes-item"><span class="blend-shapes-label">${s.categoryName}</span><span class="blend-shapes-value" style="width:${Math.min(s.score*100,100)}px"></span></li>`;
  });
  el.innerHTML = html;
}

// ==========================================
// 9. BUCLE DE RASTREO (WEBCAM)
// ==========================================
async function predictWebcam() {
  canvasElement.style.width = video.clientWidth + "px";
  canvasElement.style.height = video.clientHeight + "px";
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

  let startTimeMs = performance.now();
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    results = faceLandmarker.detectForVideo(video, startTimeMs);
  }

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  if (results && results.faceLandmarks) {
    for (const landmarks of results.faceLandmarks) {
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C040", lineWidth: 1 });
    }
  }

  // Si NO estamos reproduciendo, actualizamos con la webcam
  if (!isPlaying && results) {
    const hasBlendshapes = results.faceBlendshapes && results.faceBlendshapes.length > 0;
    const hasMatrices = results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0;

    if (hasBlendshapes) {
      const categories = results.faceBlendshapes[0].categories;
      updateModelMorphs(categories);
      drawBlendShapes(videoBlendShapes, categories);
    }
    if (hasMatrices) {
      applyHeadPoseToModel(results.facialTransformationMatrixes[0].data);
    }

    // GRABAR FRAME
    if (isRecording && hasBlendshapes && hasMatrices) {
      captureFrame(results);
    }
  }
  
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

// ==========================================
// 10. INTERFAZ DE USUARIO (Mapeo)
// ==========================================
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

  mainContainer.appendChild(renderer.domElement);
  
  const newWidth = mainContainer.clientWidth;
  const newHeight = mainContainer.clientHeight;
  renderer.setSize(newWidth, newHeight);
  camera.aspect = newWidth / newHeight;
  camera.updateProjectionMatrix();

  scene.background = new THREE.Color(0x0a0a0a); 
  setupModal.style.display = 'none'; 
});

// ==========================================
// 11. AUTO-DETECCIÓN INTELIGENTE
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
    const originalText = autoDetectBtn.innerHTML;
    autoDetectBtn.innerHTML = `<span class="mdc-button__label">¡ENCONTRADO! ✅</span>`;
    setTimeout(() => autoDetectBtn.innerHTML = originalText, 2000);
  } else {
    alert("No se detectaron nombres estándar. Selecciona manualmente.");
  }
});

// ==========================================
// 12. SISTEMA DE GRABACIÓN
// ==========================================
function toggleRecording() { isRecording ? stopRecording() : startRecording(); }

function startRecording() {
  if (!headBone) { alert("Configura el esqueleto."); return; }
  isRecording = true;
  recordedData = []; 
  recordingStartTime = performance.now();
  recordButton.classList.add("recording");
  playButton.disabled = true;
  exportButton.disabled = true;
  console.log("⏺ Grabando...");
}

function stopRecording() {
  isRecording = false;
  recordButton.classList.remove("recording");
  const duration = (performance.now() - recordingStartTime) / 1000;
  console.log(`⏹ Fin. Frames: ${recordedData.length}. Duración: ${duration.toFixed(2)}s`);
  
  if (recordedData.length > 0) {
    playButton.disabled = false;
    exportButton.disabled = false;
    alert("Grabación exitosa. Pulsa REVISAR para ver.");
  }
}

function captureFrame(results) {
  const time = (performance.now() - recordingStartTime) / 1000;
  const rotation = headBone.quaternion.clone(); 
  
  // Guardamos estructura completa para simplificar el playback
  const blendshapes = results.faceBlendshapes[0].categories.map(s => ({
      categoryName: s.categoryName,
      score: s.score
  }));

  recordedData.push({ t: time, rot: rotation, bs: blendshapes });
}

recordButton.addEventListener("click", toggleRecording);

// ==========================================
// 13. SISTEMA DE REPRODUCCIÓN (PLAYBACK)
// ==========================================
playButton.addEventListener("click", () => {
  if (isPlaying) stopPlayback();
  else startPlayback();
});

function startPlayback() {
  if (recordedData.length === 0) return;
  
  isPlaying = true;
  playLabel.innerText = "DETENER";
  if(playIcon) playIcon.innerText = "stop";
  playButton.classList.add("playing");
  
  playbackStartTime = performance.now();
  playbackLoop();
}

function stopPlayback() {
  isPlaying = false;
  playLabel.innerText = "REVISAR GRABACIÓN";
  if(playIcon) playIcon.innerText = "play_arrow";
  playButton.classList.remove("playing");
  cancelAnimationFrame(playbackAnimationId);
  
  // Opcional: Resetear modelo a pose neutral
  if(headBone) headBone.rotation.set(0,0,0);
}

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