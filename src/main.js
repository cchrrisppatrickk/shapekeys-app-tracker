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

// VARIABLES PARA EL HUESO DE LA CABEZA
let headBone = null;
let neckBone = null; // Opcional, para rotación más natural

// 1. Inicializar el modelo
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
    outputFacialTransformationMatrixes: true, // ¡CRUCIAL PARA LA ROTACIÓN!
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

  // Dibujar malla de MediaPipe
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

  // Actualizar UI y Modelo 3D (Expresiones y Rotación)
  if (results) {
    if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
      drawBlendShapes(videoBlendShapes, results.faceBlendshapes);
      applyBlendshapesToModel(results.faceBlendshapes);
    }
    
    // APLICAR ROTACIÓN AL HUESO
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
let scene, camera, renderer, avatarModel;

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

  const loader = new GLTFLoader();
  loader.load('/avatar.glb', (gltf) => {
    avatarModel = gltf.scene;
    scene.add(avatarModel);
    console.log("¡Modelo 3D cargado exitosamente!");

    // BUSCAR LOS HUESOS DE AUTO-RIG PRO
    // Usamos 'headx' como base. Si no funciona, prueba 'c_headx'
    headBone = avatarModel.getObjectByName("headx"); 
    neckBone = avatarModel.getObjectByName("neckx"); // Opcional

    if(headBone) {
      console.log("Hueso de la cabeza encontrado y vinculado:", headBone.name);
    } else {
      console.error("NO se encontró el hueso 'headx'. Verifica los nombres en Blender.");
    }

  }, undefined, (error) => {
    console.error("Error al cargar el modelo 3D:", error);
  });

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

// DICCIONARIO DE TRADUCCIÓN: MediaPipe -> Auto-Rig Pro
const blendshapeMap = {
  eyeBlinkLeft: "Eye_Blink_L",
  eyeLookDownLeft: "Eye_L_Look_Down",
  eyeLookInLeft: "Eye_L_Look_R",
  eyeLookOutLeft: "Eye_L_Look_L",
  eyeLookUpLeft: "Eye_L_Look_Up",
  eyeSquintLeft: "Eye_Squint_L",
  eyeWideLeft: "Eye_Wide_L",
  eyeBlinkRight: "Eye_Blink_R",
  eyeLookDownRight: "Eye_R_Look_Down",
  eyeLookInRight: "Eye_R_Look_L",
  eyeLookOutRight: "Eye_R_Look_R",
  eyeLookUpRight: "Eye_R_Look_Up",
  eyeSquintRight: "Eye_Squint_R",
  eyeWideRight: "Eye_Wide_R",
  jawForward: "Jaw_Forward",
  jawLeft: "Jaw_L",
  jawRight: "Jaw_R",
  jawOpen: "Jaw_Open",
  mouthClose: "Mouth_Close",
  mouthFunnel: "Mouth_Funnel",
  mouthPucker: "Mouth_Pucker",
  mouthLeft: "Mouth_L",
  mouthRight: "Mouth_R",
  mouthSmileLeft: "Mouth_Smile_L",
  mouthSmileRight: "Mouth_Smile_R",
  mouthFrownLeft: "Mouth_Frown_L",
  mouthFrownRight: "Mouth_Frown_R",
  mouthDimpleLeft: "Mouth_Dimple_L",
  mouthDimpleRight: "Mouth_Dimple_R",
  mouthStretchLeft: "Mouth_Stretch_L",
  mouthStretchRight: "Mouth_Stretch_R",
  mouthRollLower: "Mouth_Roll_In_Lower",
  mouthRollUpper: "Mouth_Roll_In_Upper",
  mouthShrugLower: "Mouth_Shrug_Lower",
  mouthShrugUpper: "Mouth_Shrug_Upper",
  mouthPressLeft: "Mouth_Press_L",
  mouthPressRight: "Mouth_Press_R",
  mouthLowerDownLeft: "Mouth_Down_Lower_L",
  mouthLowerDownRight: "Mouth_Down_Lower_R",
  mouthUpperUpLeft: "Mouth_Up_Upper_L",
  mouthUpperUpRight: "Mouth_Up_Upper_R",
  browDownLeft: "Brow_Drop_L",
  browDownRight: "Brow_Drop_R",
  browInnerUp: "Brow_Raise_Inner_L", 
  browOuterUpLeft: "Brow_Raise_Outer_L",
  browOuterUpRight: "Brow_Raise_Outer_R",
  cheekPuff: "Cheek_Puff_L",
  cheekSquintLeft: "Cheek_Raise_L",
  cheekSquintRight: "Cheek_Raise_R",
  noseSneerLeft: "Nose_Sneer_L",
  noseSneerRight: "Nose_Sneer_R"
};

function applyBlendshapesToModel(mediaPipeBlendshapes) {
  if (!avatarModel || !mediaPipeBlendshapes || mediaPipeBlendshapes.length === 0) return;

  const shapes = mediaPipeBlendshapes[0].categories;

  shapes.forEach((shape) => {
    const mediaPipeName = shape.categoryName; 
    const score = shape.score;
    const modelName = blendshapeMap[mediaPipeName];

    if (modelName) {
      avatarModel.traverse((child) => {
        if (child.isMesh && child.morphTargetDictionary && child.morphTargetDictionary[modelName] !== undefined) {
          const index = child.morphTargetDictionary[modelName];
          child.morphTargetInfluences[index] = score;
        }
      });
    }
  });
}

// NUEVA FUNCIÓN: APLICAR ROTACIÓN AL HUESO
function applyHeadPoseToModel(matrixData) {
  if (!headBone) return;

  // 1. Convertir la matriz de MediaPipe a Rotación (Euler)
  const matrix = new THREE.Matrix4().fromArray(matrixData);
  const rotation = new THREE.Euler().setFromRotationMatrix(matrix);

  // 2. CALIBRACIÓN DE EJES (Mapeo)
  // ¡ATENCIÓN! Aquí es donde probablemente debas hacer ajustes.
  // Blender (Auto-Rig Pro) suele tener orientaciones locales extrañas para los huesos.
  // Si al mover la cabeza arriba/abajo el modelo la mueve de lado a lado,
  // cambia la asignación de ejes a continuación.

  // Configuración de prueba inicial (Asume que Y local apunta hacia arriba en el hueso):
  const pitch = rotation.x; // Mirar arriba/abajo
  const yaw = -rotation.y;  // Girar izquierda/derecha (invertido para espejo)
  const roll = -rotation.z; // Inclinar cabeza a los hombros (invertido para espejo)

  // Asignación al hueso 'headx'
  // SI FUNCIONA MAL, PRUEBA COMBINACIONES COMO: 
  // headBone.rotation.x = yaw; 
  // headBone.rotation.y = pitch; etc...
  
  headBone.rotation.x = pitch;
  headBone.rotation.y = yaw;
  headBone.rotation.z = roll;

  // Opcional: Distribuir la rotación entre el cuello y la cabeza para mayor realismo
  /*
  if(neckBone) {
      headBone.rotation.x = pitch * 0.6; // La cabeza hace el 60% del movimiento
      headBone.rotation.y = yaw * 0.6;
      headBone.rotation.z = roll * 0.6;

      neckBone.rotation.x = pitch * 0.4; // El cuello hace el 40% restante
      neckBone.rotation.y = yaw * 0.4;
      neckBone.rotation.z = roll * 0.4;
  }
  */
}

initThreeJS();