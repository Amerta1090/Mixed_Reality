// === Setup Three.js ===
const canvas = document.getElementById('three-canvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

// Buat objek 3D (Kubus)
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshNormalMaterial();
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
camera.position.z = 5;

// === Animasi ===
let angleX = 0; // untuk rotasi objek
let angleY = 0;
function animate() {
  requestAnimationFrame(animate);

  // Rotasi objek secara dinamis
  cube.rotation.x = angleX;
  cube.rotation.y = angleY;

  renderer.render(scene, camera);
}
animate();

// === Inisialisasi MediaPipe Hands ===
const videoElement = document.getElementById('input-video');

// Set up MediaPipe Hands
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5
});

// Variabel untuk mendeteksi gerakan tangan
let prevPalmX = null;
let prevPalmY = null;
let prevAngleX = 0;
let prevAngleY = 0;

// Tempat untuk menampilkan indikator posisi jari
const indicators = [];

// Fungsi untuk menambahkan indikator
function updateIndicators(landmarks) {
  // Hapus indikator lama
  indicators.forEach(ind => ind.remove());
  indicators.length = 0;

  // Tambahkan indikator pada posisi jari
  for (let i = 0; i < landmarks.length; i++) {
    const landmark = landmarks[i];
    const indicator = document.createElement('div');
    indicator.classList.add('indicator');
    indicator.style.left = `${landmark.x * window.innerWidth}px`;
    indicator.style.top = `${landmark.y * window.innerHeight}px`;
    document.body.appendChild(indicator);
    indicators.push(indicator);
  }
}

hands.onResults((results) => {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];

    // Update indikator
    updateIndicators(landmarks);

    // Ambil posisi telapak tangan
    const palmX = landmarks[0].x;
    const palmY = landmarks[0].y;

    // Update gerakan objek berdasarkan perubahan posisi telapak tangan
    if (prevPalmX !== null && prevPalmY !== null) {
      const deltaX = palmX - prevPalmX;
      const deltaY = palmY - prevPalmY;

      // Gerakkan objek secara horizontal dan vertikal
      cube.position.x += deltaX * 10;
      cube.position.y -= deltaY * 10;

      // Rotasi objek horizontal dan vertikal
      angleX += deltaY * 2;
      angleY += deltaX * 2;
    }

    prevPalmX = palmX;
    prevPalmY = palmY;
  }
});

// === Kamera dan Webcam ===
const cam = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480
});
cam.start();
