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
    runningMode: "VIDEO",
    numFaces: 1
  });
  
  demosSection.classList.remove("invisible");
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
    video.srcObject.getTracks().forEach(track => track.stop()); // Detiene la cámara
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
  // Ajustar tamaño del canvas al video
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

  // Dibujar la malla oficial de MediaPipe
  if (results && results.faceLandmarks) {
    for (const landmarks of results.faceLandmarks) {
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#FF3030" });
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: "#FF3030" });
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#30FF30" });
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: "#30FF30" });
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: "#E0E0E0" });
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: "#E0E0E0" });
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, { color: "#FF3030" });
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, { color: "#30FF30" });
    }
  }

  // Pintar las barras de Blendshapes en el panel lateral
  if (results && results.faceBlendshapes) {
    drawBlendShapes(videoBlendShapes, results.faceBlendshapes);
  }

  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

// 4. Función para crear el HTML de las barras de valores
function drawBlendShapes(el, blendShapes) {
  if (!blendShapes.length) return;
  
  let htmlMaker = "";
  blendShapes[0].categories.map((shape) => {
    // MediaPipe devuelve un 'score' de 0 a 1. Lo pasamos a porcentaje para el ancho.
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
  el.innerHTML = htmlMaker;
}

// ==========================================
// CONFIGURACIÓN DEL VISOR 3D (THREE.JS)
// ==========================================
const threeContainer = document.getElementById('three-container');
let scene, camera, renderer, avatarModel;

function initThreeJS() {
  // 1. Crear la Escena y la Cámara
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2a2a); // Fondo gris oscuro

  camera = new THREE.PerspectiveCamera(45, threeContainer.clientWidth / threeContainer.clientHeight, 0.1, 100);
  camera.position.set(0, 1.5, 3); // Posicionar la cámara frente a la cara

  // 2. Crear el Renderizador
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
  threeContainer.appendChild(renderer.domElement);

  // 3. Añadir Luces (para que el modelo no se vea negro)
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(0, 2, 2);
  scene.add(directionalLight);

  // 4. Controles para rotar con el ratón (como en glTF Viewer)
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.5, 0); // Apuntar a la altura de la cabeza
  controls.update();

  // 5. Cargar el archivo .glb
  const loader = new GLTFLoader();
  // Asegúrate de que tu archivo se llame avatar.glb y esté en la carpeta /public
  loader.load('/avatar.glb', (gltf) => {
    avatarModel = gltf.scene;
    scene.add(avatarModel);
    console.log("¡Modelo 3D cargado exitosamente!");
  }, undefined, (error) => {
    console.error("Error al cargar el modelo 3D:", error);
  });

  // 6. Bucle de renderizado 3D
  function animate3D() {
    requestAnimationFrame(animate3D);
    renderer.render(scene, camera);
  }
  animate3D();

  // 7. Ajustar tamaño si cambias la ventana
  window.addEventListener('resize', () => {
    camera.aspect = threeContainer.clientWidth / threeContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(threeContainer.clientWidth, threeContainer.clientHeight);
  });
}

initThreeJS();