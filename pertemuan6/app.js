// Hapus atau abaikan videoScale, karena scaling sudah diatur di CSS
// const videoScale = 1.2;

let currentHatType = 0;
let hoveredButtonId = null;
let faceLandmarks = null;
let handIndexTip = null;

// Teks "OKE GAS!" akan muncul saat Hat 1 aktif
let showOkeGasText = false;

// Definisi warna dari Tailwind CSS untuk digunakan di Canvas
const CYBER_DARK = '#0A0A1F';
const NEON_PINK = '#FF00A2';
const NEON_GREEN = '#00FFC2';
const GLITCH_RED = '#FF003C';
const CYBER_MEDIUM = '#1A1A3A';

const buttons = [
    { id: 0, label: 'HAT_01', x: 20, y: 400, width: 150, height: 50 }, // Sesuaikan posisi untuk menghindari header
    { id: 1, label: 'HAT_02', x: 190, y: 400, width: 150, height: 50 },
    { id: 2, label: 'HAT_03', x: 360, y: 400, width: 150, height: 50 }
];

const hatImages = [];
for (let i = 0; i < 3; i++) {
    hatImages.push(new Image());
}
hatImages[0].src = 'assets/cap1.png'; // Pastikan path ini benar
hatImages[1].src = 'assets/cap2.png';
hatImages[2].src = 'assets/cap3.png';

const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');

// Hapus baris ini karena transform sudah diatur di CSS
// videoElement.style.transform = `scale(${videoScale})`;
// canvasElement.style.transform = `scale(${videoScale})`;

videoElement.addEventListener('loadedmetadata', () => {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
});

function drawOverlay() {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (faceLandmarks) {
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        faceLandmarks.forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y > maxY) maxY = pt.y;
        });
        const headCenterX = ((minX + maxX) / 2) * canvasElement.width;
        const headTopY = minY * canvasElement.height;
        const headWidth = (maxX - minX) * canvasElement.width;

        const leftEye = faceLandmarks[33]; // Titik mata kiri (untuk orientasi kepala)
        const rightEye = faceLandmarks[263]; // Titik mata kanan
        const dx = (rightEye.x - leftEye.x) * canvasElement.width;
        const dy = (rightEye.y - leftEye.y) * canvasElement.height;
        const angle = Math.atan2(dy, dx);

        drawHat(canvasCtx, headCenterX, headTopY, angle, currentHatType, headWidth);
    }

    // --- Menggambar Tombol dengan Gaya Glitch/Cyberpunk ---
    buttons.forEach(button => {
        const isHovered = hoveredButtonId === button.id;
        const isActive = currentHatType === button.id;

        // Latar belakang tombol
        canvasCtx.fillStyle = isHovered ? NEON_GREEN : NEON_PINK;
        canvasCtx.fillRect(button.x, button.y, button.width, button.height);

        // Border tombol
        canvasCtx.strokeStyle = isHovered ? NEON_PINK : NEON_GREEN;
        canvasCtx.lineWidth = 3; // Ketebalan border
        canvasCtx.strokeRect(button.x, button.y, button.width, button.height);

        // Efek glow/shadow tipis
        canvasCtx.shadowColor = isHovered ? NEON_GREEN : NEON_PINK;
        canvasCtx.shadowBlur = isHovered ? 15 : 8; // Efek glow lebih kuat saat di-hover

        // Teks tombol
        canvasCtx.fillStyle = CYBER_DARK; // Teks gelap di atas neon
        canvasCtx.font = "500 18px 'Press Start 2P', cursive"; // Font pixelated
        canvasCtx.textAlign = "center";
        canvasCtx.textBaseline = "middle";
        canvasCtx.fillText(button.label, button.x + button.width / 2, button.y + button.height / 2);

        // Reset shadow untuk elemen berikutnya
        canvasCtx.shadowBlur = 0;
    });

    // --- Menggambar Kursor Jari (Crosshair) ---
    if (handIndexTip) {
        const cursorSize = 15;
        const cursorThickness = 2;

        // Warna kursor (misal: NEON_GREEN)
        canvasCtx.strokeStyle = NEON_GREEN;
        canvasCtx.lineWidth = cursorThickness;

        // Gambar garis horizontal
        canvasCtx.beginPath();
        canvasCtx.moveTo(handIndexTip.x - cursorSize, handIndexTip.y);
        canvasCtx.lineTo(handIndexTip.x + cursorSize, handIndexTip.y);
        canvasCtx.stroke();

        // Gambar garis vertikal
        canvasCtx.beginPath();
        canvasCtx.moveTo(handIndexTip.x, handIndexTip.y - cursorSize);
        canvasCtx.lineTo(handIndexTip.x, handIndexTip.y + cursorSize);
        canvasCtx.stroke();

        // Titik tengah
        canvasCtx.beginPath();
        canvasCtx.arc(handIndexTip.x, handIndexTip.y, 3, 0, 2 * Math.PI);
        canvasCtx.fillStyle = NEON_PINK; // Titik tengah neon
        canvasCtx.fill();
    }

    // --- Menampilkan Teks "OKE GAS!" ---
    if (showOkeGasText) {
        canvasCtx.save();
        // Atur posisi teks di tengah layar
        const textX = canvasElement.width / 2;
        const textY = canvasElement.height / 2;

        // Efek glitch pada teks
        const offsetX = Math.random() * 10 - 5; // Geser X secara acak antara -5 dan 5
        const offsetY = Math.random() * 10 - 5; // Geser Y secara acak antara -5 dan 5

        canvasCtx.font = "bold 60px 'Press Start 2P', cursive"; // Font besar dan pixelated
        canvasCtx.textAlign = "center";
        canvasCtx.textBaseline = "middle";

        // Teks utama dengan glow neon
        canvasCtx.shadowColor = NEON_PINK;
        canvasCtx.shadowBlur = 20;
        canvasCtx.fillStyle = NEON_GREEN; // Warna utama teks
        canvasCtx.fillText("OKE GAS!", textX + offsetX, textY + offsetY);

        // Efek shadow / distorsi merah (lapisan bawah)
        canvasCtx.shadowColor = GLITCH_RED;
        canvasCtx.shadowBlur = 10;
        canvasCtx.fillStyle = "rgba(255, 0, 60, 0.5)"; // Merah transparan
        canvasCtx.fillText("OKE GAS!", textX + offsetX + 5, textY + offsetY + 5);

        // Efek shadow / distorsi biru (lapisan bawah)
        canvasCtx.shadowColor = GLITCH_RED; // Gunakan GLITCH_RED juga untuk bayangan biru
        canvasCtx.shadowBlur = 10;
        canvasCtx.fillStyle = "rgba(0, 60, 255, 0.5)"; // Biru transparan
        canvasCtx.fillText("OKE GAS!", textX + offsetX - 5, textY + offsetY - 5);

        canvasCtx.restore(); // Kembalikan pengaturan konteks
    }
}

function drawHat(ctx, x, y, angle, hatType, headWidth) {
    const img = hatImages[hatType];
    if (!img.complete) {
        return;
    }
    const hatWidth = headWidth;
    const aspectRatio = img.naturalHeight / img.naturalWidth;
    const hatHeight = hatWidth * aspectRatio;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(img, -hatWidth / 2, -hatHeight, hatWidth, hatHeight);
    ctx.restore();
}

function onFaceResults(results) {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        faceLandmarks = results.multiFaceLandmarks[0];
    } else {
        faceLandmarks = null;
    }
    drawOverlay();
}

function onHandsResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        handIndexTip = {
            x: landmarks[8].x * canvasElement.width,
            y: landmarks[8].y * canvasElement.height
        };

        // Deteksi hover dan perubahan currentHatType
        let buttonWasHovered = false;
        buttons.forEach(button => {
            if (
                handIndexTip.x >= button.x &&
                handIndexTip.x <= button.x + button.width &&
                handIndexTip.y >= button.y &&
                handIndexTip.y <= button.y + button.height
            ) {
                if (hoveredButtonId !== button.id) {
                    hoveredButtonId = button.id;
                    currentHatType = button.id; // Ganti topi saat tombol di-hover
                    // Atur showOkeGasText berdasarkan button.id
                    showOkeGasText = (button.id === 0);
                }
                buttonWasHovered = true;
            }
        });

        if (!buttonWasHovered) {
            if (hoveredButtonId !== null) {
                hoveredButtonId = null;
                // Jika tidak ada tombol yang di-hover, sembunyikan "OKE GAS!"
                showOkeGasText = false;
            }
        }

    } else {
        handIndexTip = null;
        hoveredButtonId = null;
        showOkeGasText = false; // Sembunyikan "OKE GAS!" jika tidak ada tangan
    }
    drawOverlay();
}

const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});
faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
faceMesh.onResults(onFaceResults);

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});
hands.onResults(onHandsResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await faceMesh.send({ image: videoElement });
        await hands.send({ image: videoElement });
    },
    width: 640,
    height: 480
});
camera.start();