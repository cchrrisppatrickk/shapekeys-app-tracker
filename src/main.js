// 1. IMPORTACIONES DE THREE.JS Y MEDIAPIPE
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FaceLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

// REFERENCIAS DOM
const demosSection = document.getElementById("demos");
const videoBlendShapes = document.getElementById("video-blend-shapes");
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const enableWebcamButton = document.getElementById("webcamButton");
const webcamLabel = document.getElementById("webcamLabel");

// ELEMENTOS DEL MODAL Y CONTENEDORES 3D
const setupModal = document.getElementById('setup-modal');
const previewContainer = document.getElementById('preview-three-container'); // Contenedor del Modal
const mainContainer = document.getElementById('three-container');         // Contenedor Principal
const confirmBtn = document.getElementById('confirm-mapping-btn');
const headSelect = document.getElementById('head-bone-select');
const neckSelect = document.getElementById('neck-bone-select');
const activeBoneDisplay = document.getElementById('active-bone-display');
const placeholderText = document.querySelector('.preview-placeholder');

// VARIABLES GLOBALES
let faceLandmarker;
let webcamRunning = false;
let lastVideoTime = -1;
let results = undefined;
const drawingUtils = new DrawingUtils(canvasCtx);

let scene, camera, renderer, controls;
let avatarModel = null;
let headBone = null;
let neckBone = null;
let skeletonHelper = null; // Ayuda visual para ver los huesos en el modal

// ==========================================
// 1. INICIALIZACIÓN DE MEDIAPIPE
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

// ==========================================
// 2. INICIALIZACIÓN DE THREE.JS (EN EL MODAL)
// ==========================================
function initThreeJS() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x222222); // Gris oscuro para el modal

  // Configuración inicial usando el tamaño del PREVIEW CONTAINER (Modal)
  const width = previewContainer.clientWidth;
  const height = previewContainer.clientHeight;

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 1.3, 2.5); // Cámara un poco más cerca para ver la cara

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  
  // ¡AQUÍ ESTÁ EL CAMBIO CLAVE! 
  // Agregamos el canvas al contenedor del MODAL primero.
  previewContainer.appendChild(renderer.domElement);

  // Luces
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
  directionalLight.position.set(0, 2, 2);
  scene.add(directionalLight);

  // Controles
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.3, 0); // Apuntar a la altura de la cabeza aprox
  controls.enableDamping = true;
  controls.update();

  animate3D();
}

function animate3D() {
  requestAnimationFrame(animate3D);
  if(controls) controls.update();
  renderer.render(scene, camera);
}

// Función para manejar el redimensionado de ventana
window.addEventListener('resize', () => {
  // Verificamos dónde está el canvas actualmente (Modal o Principal)
  const parent = renderer.domElement.parentNode;
  if (parent) {
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
});

initThreeJS(); // Iniciar inmediatamente para ver el fondo en el modal

// ==========================================
// 3. LOGICA DE CARGA (DRAG & DROP)
// ==========================================
window.addEventListener('dragover', (e) => e.preventDefault());

window.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  
  if (file && (file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf'))) {
    if(placeholderText) placeholderText.innerText = "Procesando modelo...";
    
    const fileURL = URL.createObjectURL(file);
    const loader = new GLTFLoader();
    
    loader.load(fileURL, (gltf) => {
      // Limpieza previa
      if (avatarModel) scene.remove(avatarModel);
      if (skeletonHelper) scene.remove(skeletonHelper);
      
      avatarModel = gltf.scene;
      scene.add(avatarModel);
      
      // Añadir visualizador de esqueleto (SkeletonHelper)
      // Esto ayuda al usuario a ver los huesos en el modal
      skeletonHelper = new THREE.SkeletonHelper(avatarModel);
      skeletonHelper.visible = true;
      scene.add(skeletonHelper);

      if(placeholderText) placeholderText.style.display = "none";
      console.log(`¡Modelo ${file.name} cargado!`);

      // Extraer huesos para la UI
      const detectedBones = [];
      avatarModel.traverse((node) => {
        if (node.isBone) detectedBones.push(node.name);
      });

      populateBoneSelectors(detectedBones);

      // Intento de auto-detección simple (Fase preliminar)
      autoSelectBone(detectedBones, ['head', 'headx', 'c_head', 'mixamorig:head'], headSelect);
      autoSelectBone(detectedBones, ['neck', 'neckx', 'c_neck', 'mixamorig:neck'], neckSelect);

    }, undefined, (error) => {
      console.error(error);
      if(placeholderText) placeholderText.innerText = "Error al cargar.";
    });
  }
});

function populateBoneSelectors(bonesList) {
  headSelect.innerHTML = '<option value="">-- Selecciona --</option>';
  neckSelect.innerHTML = '<option value="">-- Selecciona --</option>';
  bonesList.forEach(bone => {
    headSelect.add(new Option(bone, bone));
    neckSelect.add(new Option(bone, bone));
  });
}

function autoSelectBone(availableBones, searchTerms, selectElement) {
  const found = availableBones.find(bone => 
    searchTerms.some(term => bone.toLowerCase().includes(term.toLowerCase()))
  );
  if (found) {
    selectElement.value = found;
    highlightBoneInUI(found); // Activar feedback visual
  }
}

// ==========================================
// 4. LÓGICA DE INTERACCIÓN Y CONFIRMACIÓN
// ==========================================

// Feedback Visual: Iluminar hueso seleccionado (Básico)
function highlightBoneInUI(boneName) {
  if (!boneName) {
    activeBoneDisplay.textContent = "Ninguno";
    activeBoneDisplay.className = 'active-bone-none';
    return;
  }
  
  activeBoneDisplay.textContent = `🦴 ${boneName}`;
  activeBoneDisplay.className = 'active-bone-selected';
  
  // Visualizar en el modelo 3D (Si existe el hueso)
  if (avatarModel) {
    const bone = avatarModel.getObjectByName(boneName);
    // Aquí podríamos poner lógica para resaltar el hueso específico en el SkeletonHelper
    // Por ahora, solo confirmamos que existe
    if(bone) console.log(`Hueso ${boneName} seleccionado.`);
  }
}

headSelect.addEventListener('change', (e) => highlightBoneInUI(e.target.value));
neckSelect.addEventListener('change', (e) => highlightBoneInUI(e.target.value));

// AL HACER CLIC EN CONFIRMAR
confirmBtn.addEventListener('click', () => {
  if (!avatarModel) {
    alert("Arrastra un modelo .glb primero.");
    return;
  }

  // 1. Guardar referencias a los huesos
  const hName = headSelect.value;
  const nName = neckSelect.value;
  
  if (hName) headBone = avatarModel.getObjectByName(hName);
  if (nName) neckBone = avatarModel.getObjectByName(nName);

  if(!headBone) {
    alert("Advertencia: No has seleccionado hueso de cabeza. La rotación no funcionará.");
  }

  // 2. MIGRACIÓN DEL CANVAS: Del Modal al Panel Principal
  // Esto "mueve" el visor 3D de un div a otro sin recargar
  mainContainer.appendChild(renderer.domElement);
  
  // Ajustar tamaño al nuevo contenedor
  const newWidth = mainContainer.clientWidth;
  const newHeight = mainContainer.clientHeight;
  renderer.setSize(newWidth, newHeight);
  camera.aspect = newWidth / newHeight;
  camera.updateProjectionMatrix();

  // 3. Limpieza Visual
  setupModal.style.display = 'none'; // Ocultar modal
  if(skeletonHelper) skeletonHelper.visible = false; // Ocultar las líneas de huesos para el modo final
  scene.background = new THREE.Color(0x1e1e1e); // Cambiar color de fondo para que coincida con la app

  // 4. Iniciar automáticamente la cámara (Opcional, mejora UX)
  // enableCam(); 
});


// ==========================================
// 5. LÓGICA DE RASTREO (Igual que antes)
// ==========================================
if (hasGetUserMedia()) {
  enableWebcamButton.addEventListener("click", enableCam);
}

function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function enableCam() {
  if (!faceLandmarker) return;

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

async function predictWebcam() {
  // Ajuste de canvas de video 2D
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

  // Dibujar landmarks 2D
  if (results && results.faceLandmarks) {
    for (const landmarks of results.faceLandmarks) {
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });
    }
  }

  // Actualizar Modelo 3D
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

// Blendshapes Mapping (Tu diccionario original)
const blendshapeMap = {
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
  
  // Mapeo simple de ejes (Puede requerir ajuste según el modelo)
  headBone.rotation.x = rotation.x;
  headBone.rotation.y = -rotation.y;
  headBone.rotation.z = -rotation.z;
}

// UI Auxiliar
function drawBlendShapes(el, blendShapes) {
  if (!blendShapes || !blendShapes.length) return;
  let htmlMaker = "";
  blendShapes[0].categories.map((shape) => {
    const score = parseFloat(shape.score);
    htmlMaker += `
      <li class="blend-shapes-item">
        <span class="blend-shapes-label">${shape.categoryName}</span>
        <span class="blend-shapes-value" style="width: calc(${score * 100}% - 120px)">${score.toFixed(4)}</span>
      </li>`;
  });
  if(el) el.innerHTML = htmlMaker;
}