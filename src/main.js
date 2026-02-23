// 1. IMPORTACIONES DE THREE.JS Y MEDIAPIPE
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FaceLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

const demosSection = document.getElementById("demos");
const videoBlendShapes = document.getElementById("video-blend-shapes");
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const enableWebcamButton = document.getElementById("webcamButton");
const webcamLabel = document.getElementById("webcamLabel");

let faceLandmarker;
let webcamRunning = false;
let lastVideoTime = -1;
let results = undefined;
const drawingUtils = new DrawingUtils(canvasCtx);

// VARIABLES PARA EL HUESO DE LA CABEZA Y EL MODELO
let headBone = null;
let neckBone = null;
let avatarModel = null; // Lo subimos al scope global para acceder al cargarlo

// 1. Inicializar el modelo de MediaPipe
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
  
  if(demosSection) demosSection.classList.remove("invisible");
}
createFaceLandmarker();

// 2. Control de la cámara
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

if (hasGetUserMedia()) {
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("Tu navegador no soporta getUserMedia()");
}

function enableCam() {
  if (!faceLandmarker) {
    console.log("¡Espera! El modelo aún no ha cargado.");
    return;
  }

  if (webcamRunning === true) {
    webcamRunning = false;
    webcamLabel.innerText = "HABILITAR CÁMARA";
    video.srcObject.getTracks().forEach(track => track.stop());
  } else {
    webcamRunning = true;
    webcamLabel.innerText = "DESHABILITAR CÁMARA";
    
    const constraints = { video: true };
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      video.srcObject = stream;
      video.addEventListener("loadeddata", predictWebcam);
    });
  }
}

// 3. Bucle de predicción y dibujo
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
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#FF3030" });
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: "#FF3030" });
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#30FF30" });
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: "#30FF30" });
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: "#E0E0E0" });
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: "#E0E0E0" });
    }
  }

  if (results) {
    if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
      drawBlendShapes(videoBlendShapes, results.faceBlendshapes);
      applyBlendshapesToModel(results.faceBlendshapes);
    }
    
    if (results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0) {
      applyHeadPoseToModel(results.facialTransformationMatrixes[0].data);
    }
  }
  
  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

// 4. UI de Blendshapes
function drawBlendShapes(el, blendShapes) {
  if (!blendShapes || !blendShapes.length) return;
  
  let htmlMaker = "";
  blendShapes[0].categories.map((shape) => {
    const score = parseFloat(shape.score);
    htmlMaker += `
      <li class="blend-shapes-item">
        <span class="blend-shapes-label">${shape.categoryName}</span>
        <span class="blend-shapes-value" style="width: calc(${score * 100}% - 120px)">
          ${score.toFixed(4)}
        </span>
      </li>
    `;
  });
  if(el) el.innerHTML = htmlMaker;
}

// ==========================================
// CONFIGURACIÓN DEL VISOR 3D (THREE.JS)
// ==========================================
const threeContainer = document.getElementById('three-container');
let scene, camera, renderer;

function initThreeJS() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2a2a);

  camera = new THREE.PerspectiveCamera(45, threeContainer.clientWidth / threeContainer.clientHeight, 0.1, 100);
  camera.position.set(0, 1.5, 3);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
  threeContainer.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(0, 2, 2);
  scene.add(directionalLight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.5, 0);
  controls.update();

  function animate3D() {
    requestAnimationFrame(animate3D);
    renderer.render(scene, camera);
  }
  animate3D();

  window.addEventListener('resize', () => {
    camera.aspect = threeContainer.clientWidth / threeContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
  });
}

const blendshapeMap = {
  // ... (Mantenemos tu diccionario intacto) ...
  eyeBlinkLeft: "Eye_Blink_L", eyeLookDownLeft: "Eye_L_Look_Down", eyeLookInLeft: "Eye_L_Look_R", eyeLookOutLeft: "Eye_L_Look_L", eyeLookUpLeft: "Eye_L_Look_Up", eyeSquintLeft: "Eye_Squint_L", eyeWideLeft: "Eye_Wide_L", eyeBlinkRight: "Eye_Blink_R", eyeLookDownRight: "Eye_R_Look_Down", eyeLookInRight: "Eye_R_Look_L", eyeLookOutRight: "Eye_R_Look_R", eyeLookUpRight: "Eye_R_Look_Up", eyeSquintRight: "Eye_Squint_R", eyeWideRight: "Eye_Wide_R", jawForward: "Jaw_Forward", jawLeft: "Jaw_L", jawRight: "Jaw_R", jawOpen: "Jaw_Open", mouthClose: "Mouth_Close", mouthFunnel: "Mouth_Funnel", mouthPucker: "Mouth_Pucker", mouthLeft: "Mouth_L", mouthRight: "Mouth_R", mouthSmileLeft: "Mouth_Smile_L", mouthSmileRight: "Mouth_Smile_R", mouthFrownLeft: "Mouth_Frown_L", mouthFrownRight: "Mouth_Frown_R", mouthDimpleLeft: "Mouth_Dimple_L", mouthDimpleRight: "Mouth_Dimple_R", mouthStretchLeft: "Mouth_Stretch_L", mouthStretchRight: "Mouth_Stretch_R", mouthRollLower: "Mouth_Roll_In_Lower", mouthRollUpper: "Mouth_Roll_In_Upper", mouthShrugLower: "Mouth_Shrug_Lower", mouthShrugUpper: "Mouth_Shrug_Upper", mouthPressLeft: "Mouth_Press_L", mouthPressRight: "Mouth_Press_R", mouthLowerDownLeft: "Mouth_Down_Lower_L", mouthLowerDownRight: "Mouth_Down_Lower_R", mouthUpperUpLeft: "Mouth_Up_Upper_L", mouthUpperUpRight: "Mouth_Up_Upper_R", browDownLeft: "Brow_Drop_L", browDownRight: "Brow_Drop_R", browInnerUp: "Brow_Raise_Inner_L", browOuterUpLeft: "Brow_Raise_Outer_L", browOuterUpRight: "Brow_Raise_Outer_R", cheekPuff: "Cheek_Puff_L", cheekSquintLeft: "Cheek_Raise_L", cheekSquintRight: "Cheek_Raise_R", noseSneerLeft: "Nose_Sneer_L", noseSneerRight: "Nose_Sneer_R"
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
  
  const pitch = rotation.x; 
  const yaw = -rotation.y;  
  const roll = -rotation.z; 

  headBone.rotation.x = pitch;
  headBone.rotation.y = yaw;
  headBone.rotation.z = roll;
}

// ==========================================
// GESTOR DE RETARGETING Y DRAG & DROP
// ==========================================

const setupModal = document.getElementById('setup-modal');
const confirmBtn = document.getElementById('confirm-mapping-btn');
const headSelect = document.getElementById('head-bone-select');
const neckSelect = document.getElementById('neck-bone-select');
const activeBoneDisplay = document.getElementById('active-bone-display');
const placeholderText = document.querySelector('.preview-placeholder');

// 1. Lógica de Drag and Drop para cargar el archivo
window.addEventListener('dragover', (e) => {
  e.preventDefault(); // Necesario para permitir el "drop"
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  
  if (file && (file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf'))) {
    if(placeholderText) placeholderText.innerText = "Cargando modelo...";
    
    // Crear una URL temporal para el archivo arrastrado
    const fileURL = URL.createObjectURL(file);
    
    // Cargar el modelo en Three.js
    const loader = new GLTFLoader();
    loader.load(fileURL, (gltf) => {
      // Si ya había un modelo, lo eliminamos de la escena primero
      if (avatarModel) {
        scene.remove(avatarModel);
      }
      
      avatarModel = gltf.scene;
      scene.add(avatarModel);
      if(placeholderText) placeholderText.style.display = "none";
      console.log(`¡Modelo ${file.name} cargado exitosamente!`);

      // 2. Extraer los huesos reales del modelo cargado
      const detectedBones = [];
      avatarModel.traverse((node) => {
        if (node.isBone) {
          detectedBones.push(node.name);
        }
      });

      console.log(`Se encontraron ${detectedBones.length} huesos.`);
      populateBoneSelectors(detectedBones);

    }, undefined, (error) => {
      console.error("Error al cargar el modelo:", error);
      if(placeholderText) placeholderText.innerText = "Error al cargar el modelo.";
    });
  } else {
    alert("Por favor, arrastra un archivo válido en formato .glb o .gltf");
  }
});

// 3. Poblar los selectores limpiando las opciones previas
function populateBoneSelectors(bonesList) {
  // Limpiar opciones anteriores
  headSelect.innerHTML = '<option value="">-- Selecciona un hueso --</option>';
  neckSelect.innerHTML = '<option value="">-- Selecciona un hueso --</option>';

  // Agregar los huesos reales detectados
  bonesList.forEach(bone => {
    headSelect.add(new Option(bone, bone));
    neckSelect.add(new Option(bone, bone));
  });
}

// 4. Lógica de Feedback Visual en UI
function highlightBoneInUI(boneName) {
  if (boneName) {
    activeBoneDisplay.textContent = `🦴 ${boneName}`;
    activeBoneDisplay.className = 'active-bone-selected';
    console.log(`[Feedback 3D] Iluminando hueso: ${boneName} en el visor.`);
  } else {
    activeBoneDisplay.textContent = "Ninguno";
    activeBoneDisplay.className = 'active-bone-none';
  }
}

headSelect.addEventListener('change', (e) => highlightBoneInUI(e.target.value));
neckSelect.addEventListener('change', (e) => highlightBoneInUI(e.target.value));

// 5. Botón para confirmar y asignar los huesos reales
confirmBtn.addEventListener('click', () => {
  if (!avatarModel) {
    alert("¡Primero arrastra y suelta un modelo .glb en la pantalla!");
    return;
  }

  const selectedHead = headSelect.value;
  const selectedNeck = neckSelect.value;

  // Asignar los huesos seleccionados en la UI a las variables globales para la rotación
  if (selectedHead) {
    headBone = avatarModel.getObjectByName(selectedHead);
    console.log("Hueso de Cabeza asignado exitosamente:", headBone.name);
  } else {
    console.warn("No se seleccionó hueso para la cabeza. La rotación no funcionará.");
  }

  if (selectedNeck) {
    neckBone = avatarModel.getObjectByName(selectedNeck);
  }

  // Ocultar modal y habilitar la experiencia
  setupModal.style.display = 'none';
});

// Iniciar Escena
initThreeJS();