// Dapatkan elemen video dan canvas dari HTML
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('outputCanvas');
const canvasCtx = canvasElement.getContext('2d');

// Konfigurasi Canvas agar sesuai dengan resolusi video
const videoWidth = 640;
const videoHeight = 480;
canvasElement.width = videoWidth;
canvasElement.height = videoHeight;

// --- Muat Gambar Api ---
const fireImage = new Image();
fireImage.src = 'api.png'; // Pastikan file 'api.png' berada di folder yang sama
let fireImageLoaded = false; // Flag untuk menandai apakah gambar sudah dimuat

// Event listener saat gambar api berhasil dimuat
fireImage.onload = () => {
    fireImageLoaded = true;
    console.log("Gambar api.png berhasil dimuat.");
};

// Event listener jika ada error saat memuat gambar api
fireImage.onerror = () => {
    console.error("Gagal memuat gambar api.png. Pastikan file ada di folder yang sama dengan index.html dan script.js.");
};

// --- Inisialisasi MediaPipe Hands ---
const hands = new Hands({
    // Lokasi file model MediaPipe Hands. Menggunakan CDN.
    // Pastikan versi (@0.4) cocok dengan yang dimuat di <script> tag di HTML.
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`;
    }
});

// Mengatur opsi untuk deteksi tangan
hands.setOptions({
    maxNumHands: 2, // Maksimal 2 tangan yang dideteksi
    minDetectionConfidence: 0.7, // Ambang batas kepercayaan deteksi tangan
    minTrackingConfidence: 0.7 // Ambang batas kepercayaan pelacakan tangan
});

// Menetapkan callback function yang akan dipanggil setiap kali MediaPipe menghasilkan hasil deteksi
hands.onResults(onResults);

// --- Variabel untuk Animasi Api ---
// Map untuk menyimpan properti animasi unik untuk setiap api yang terdeteksi.
// Kunci Map adalah string unik (misal "0-8" untuk tangan pertama, jari telunjuk).
const activeFires = new Map(); // Format: Map<string, { scale: number, opacity: number, direction: number }>

// Fungsi untuk mengelola logika animasi skala dan opasitas api
function animateFire(fireData) {
    // Ubah skala dan opasitas berdasarkan arah animasi
    fireData.scale += fireData.direction * 0.005; // Kecepatan perubahan skala
    fireData.opacity += fireData.direction * 0.01; // Kecepatan perubahan opasitas

    // Balik arah animasi jika mencapai batas tertentu
    // Skala akan beranimasi antara 0.8x dan 1.2x dari ukuran aslinya
    if (fireData.scale > 1.2 || fireData.scale < 0.8) {
        fireData.direction *= -1; // Balik arah
    }
    // Opasitas akan beranimasi antara 0.6 (agak transparan) dan 1.0 (penuh)
    if (fireData.opacity > 1.0 || fireData.opacity < 0.6) {
        fireData.direction *= -1; // Balik arah
    }

    // Pastikan nilai tetap dalam batas yang ditentukan untuk menghindari "ledakan" atau "hilang"
    fireData.scale = Math.max(0.8, Math.min(1.2, fireData.scale));
    fireData.opacity = Math.max(0.6, Math.min(1.0, fireData.opacity));
}

// Fungsi utama yang dipanggil setiap kali MediaPipe memproses frame video
function onResults(results) {
    // Simpan status canvas saat ini sebelum menggambar
    canvasCtx.save();
    // Bersihkan seluruh area canvas untuk frame baru
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Gambar frame video dari kamera ke canvas.
    // `results.image` adalah Mat (OpenCV) yang dikonversi oleh MediaPipe.
    // `transform: scaleX(-1)` di CSS sudah membalik video secara horizontal.
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // Set untuk melacak ID api yang terdeteksi di frame saat ini
    const currentFrameFireIds = new Set();

    // Periksa apakah ada tangan yang terdeteksi
    if (results.multiHandLandmarks) {
        // Loop melalui setiap tangan yang terdeteksi (handIndex 0 untuk tangan pertama, 1 untuk tangan kedua, dst.)
        for (let handIndex = 0; handIndex < results.multiHandLandmarks.length; handIndex++) {
            const landmarks = results.multiHandLandmarks[handIndex];

            // --- Gambar Tracking Tangan (Landmark dan Koneksi) ---
            // Menggambar garis koneksi antar landmark tangan
            drawConnectors(canvasCtx, landmarks, Hands.HAND_CONNECTIONS, {
                color: '#00FF00', // Warna hijau untuk koneksi
                lineWidth: 5 // Ketebalan garis
            });
            // Menggambar setiap titik landmark tangan
            drawLandmarks(canvasCtx, landmarks, {
                color: '#FF0000', // Warna merah untuk titik landmark
                lineWidth: 2, // Ketebalan outline titik
                radius: 4 // Radius titik
            });

            // --- Dapatkan Koordinat Ujung Jari dan Gambar Api ---
            // Definisi indeks landmark untuk setiap ujung jari
            const fingertipIndices = [
                Hands.HandLandmark.THUMB_TIP,       // Ujung Jempol
                Hands.HandLandmark.INDEX_FINGER_TIP, // Ujung Jari Telunjuk
                Hands.HandLandmark.MIDDLE_FINGER_TIP, // Ujung Jari Tengah
                Hands.HandLandmark.RING_FINGER_TIP,   // Ujung Jari Manis
                Hands.HandLandmark.PINKY_TIP          // Ujung Jari Kelingking
            ];

            // Loop melalui setiap ujung jari yang ingin diberi api
            for (const index of fingertipIndices) {
                const fingertip = landmarks[index];
                // Konversi koordinat landmark yang dinormalisasi (0.0 - 1.0)
                // menjadi koordinat piksel sesuai ukuran canvas
                const x = fingertip.x * canvasElement.width;
                const y = fingertip.y * canvasElement.height;

                // Buat ID unik untuk api ini (misal "0-8" untuk tangan pertama, jari telunjuk)
                const fireId = `${handIndex}-${index}`;

                // Jika api ini belum ada dalam Map `activeFires`, inisialisasi properti animasinya
                if (!activeFires.has(fireId)) {
                    activeFires.set(fireId, {
                        scale: 1.0, // Skala awal
                        opacity: 1.0, // Opasitas awal
                        direction: (Math.random() > 0.5 ? 1 : -1) // Arah animasi awal (naik atau turun)
                    });
                }

                // Dapatkan data animasi untuk api ini
                const fireData = activeFires.get(fireId);
                // Lakukan animasi skala dan opasitas
                animateFire(fireData);

                // Gambar api HANYA jika gambar 'api.png' sudah berhasil dimuat
                if (fireImageLoaded) {
                    const baseFireWidth = 50;  // Ukuran dasar lebar gambar api
                    const baseFireHeight = 50; // Ukuran dasar tinggi gambar api

                    // Hitung ukuran gambar api yang akan digambar berdasarkan skala animasi
                    const animatedFireWidth = baseFireWidth * fireData.scale;
                    const animatedFireHeight = baseFireHeight * fireData.scale;

                    // Set globalAlpha canvas untuk mengontrol transparansi gambar api
                    canvasCtx.globalAlpha = fireData.opacity;

                    // Gambar gambar api di posisi ujung jari, dengan pusat gambar di ujung jari
                    canvasCtx.drawImage(
                        fireImage,
                        x - animatedFireWidth / 2,  // Koordinat X (tengah gambar)
                        y - animatedFireHeight / 2, // Koordinat Y (tengah gambar)
                        animatedFireWidth,
                        animatedFireHeight
                    );

                    // Penting: Reset globalAlpha ke 1.0 (penuh) agar tidak mempengaruhi gambar selanjutnya
                    canvasCtx.globalAlpha = 1.0;
                }
                // Tambahkan ID api ini ke set `currentFrameFireIds` karena terdeteksi di frame ini
                currentFrameFireIds.add(fireId);
            }
        }
    }

    // --- Pembersihan Api yang Tidak Lagi Terdeteksi ---
    // Loop melalui semua api yang ada di `activeFires`
    for (const fireId of activeFires.keys()) {
        // Jika api ini TIDAK ditemukan di `currentFrameFireIds` (artinya jari sudah tidak terdeteksi)
        if (!currentFrameFireIds.has(fireId)) {
            activeFires.delete(fireId); // Hapus api dari daftar aktif
        }
    }

    // Pulihkan status canvas ke sebelum menggambar (seperti globalAlpha)
    canvasCtx.restore();
}

// --- Inisialisasi Kamera Web ---
const camera = new Camera(videoElement, {
    // Callback yang akan dipanggil untuk setiap frame dari kamera
    onFrame: async () => {
        // Kirim frame video ke model MediaPipe Hands untuk diproses
        await hands.send({ image: videoElement });
    },
    width: videoWidth,
    height: videoHeight
});
// Memulai aliran video dari kamera
camera.start();

// Penanganan awal untuk akses kamera menggunakan `getUserMedia`
// Ini berguna untuk meminta izin kamera dan menampilkan error jika gagal
navigator.mediaDevices.getUserMedia({ video: true })
    .then(function(stream) {
        // Jika berhasil, atur aliran video ke elemen <video>
        videoElement.srcObject = stream;
    })
    .catch(function(err) {
        // Tangani error jika kamera tidak dapat diakses
        console.error("Error accessing camera: ", err);
        alert("Tidak dapat mengakses kamera. Pastikan Anda mengizinkan akses kamera dan tidak ada aplikasi lain yang menggunakannya.");
    });