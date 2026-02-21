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