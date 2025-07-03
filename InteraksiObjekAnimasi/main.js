// Impor pustaka yang diperlukan dari CDN
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

// Ambil elemen-elemen dari DOM yang sudah ada di index.html
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const webcamButton = document.getElementById("webcamButton");
const fireImage = document.getElementById("fireImage");
const loadingMessage = document.getElementById("loadingMessage");

let handLandmarker;
let runningMode = "VIDEO";
let webcamRunning = false;

// Indeks untuk ujung jari pada model HandLandmarker
const FINGER_TIPS = [4, 8, 12, 16, 20];

// Fungsi utama untuk menginisialisasi HandLandmarker
const createHandLandmarker = async () => {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
        },
        runningMode: runningMode,
        numHands: 2, // Mendeteksi hingga 2 tangan
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
    });
    console.log("HandLandmarker berhasil dimuat.");
};

// Panggil fungsi inisialisasi saat script dimuat
createHandLandmarker();

// Fungsi untuk mengaktifkan webcam
const enableCam = (event) => {
    if (!handLandmarker) {
        console.log("Tunggu! HandLandmarker belum siap.");
        alert("Model sedang dimuat, silakan coba lagi sesaat lagi.");
        return;
    }

    webcamRunning = !webcamRunning;
    webcamButton.innerText = webcamRunning ? "Hentikan Kamera" : "Mulai Kamera";
    webcamButton.classList.toggle('bg-red-600', webcamRunning);
    webcamButton.classList.toggle('hover:bg-red-700', webcamRunning);
    webcamButton.classList.toggle('bg-blue-600', !webcamRunning);
    webcamButton.classList.toggle('hover:bg-blue-700', !webcamRunning);

    if (webcamRunning) {
        loadingMessage.style.display = 'none';
        navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
            video.srcObject = stream;
            video.addEventListener("loadeddata", predictWebcam);
        }).catch(err => {
            console.error("Error mengakses webcam: ", err);
            alert("Tidak dapat mengakses kamera. Pastikan Anda memberikan izin.");
            webcamRunning = false;
            webcamButton.innerText = "Mulai Kamera";
        });
    } else {
        const stream = video.srcObject;
        const tracks = stream?.getTracks() || [];
        tracks.forEach(track => track.stop());
        video.srcObject = null;
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        loadingMessage.style.display = 'block';
    }
};

// Tambahkan event listener ke tombol
webcamButton.addEventListener("click", enableCam);

let lastVideoTime = -1;
async function predictWebcam() {
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;
    
    // Always clear and draw the video frame FIRST in every animation frame
    // This ensures a smooth video display without gaps.
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);

    const startTimeMs = performance.now();

    // Only perform hand detection and draw fire effects IF a new video frame is available
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        
        const results = handLandmarker.detectForVideo(video, startTimeMs);
        
        if (results.landmarks && fireImage.complete) {
            for (const landmarks of results.landmarks) {
                FINGER_TIPS.forEach(tipIndex => {
                    const landmark = landmarks[tipIndex];
                    if (landmark) {
                        const x = landmark.x * canvasElement.width;
                        const y = landmark.y * canvasElement.height;
                        const fireWidth = 60;
                        const fireHeight = 80;
                        canvasCtx.drawImage(fireImage, x - (fireWidth / 2), y - fireHeight, fireWidth, fireHeight);
                    }
                });
            }
        }
    }

    if (webcamRunning) {
        window.requestAnimationFrame(predictWebcam);
    }
}