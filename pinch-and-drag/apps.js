const video = document.getElementById('webcam');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');

let draggingOverlay = null;

// Resize canvas when video metadata is loaded
video.addEventListener('loadedmetadata', () => {
    resizeCanvas();
});

// Resize canvas on window resize
window.addEventListener('resize', () => {
    resizeCanvas();
});

function resizeCanvas() {
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
}

// Overlay objects
const overlays = [
    { img: new Image(), x: 400, y: 100, width: 75, height: 75 },
    { img: new Image(), x: 300, y: 200, width: 75, height: 75 }
];

// Load overlay images
overlays[0].img.src = 'https://picsum.photos/200';
overlays[1].img.src = 'https://picsum.photos/id/17/200/300';

// Draw overlays on the canvas
function drawOverlay() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    overlays.forEach(item => {
        ctx.drawImage(item.img, item.x, item.y, item.width, item.height);
    });
}

// Setup hands detection with MediaPipe
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

hands.onResults((results) => {
    drawOverlay();

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];

        const thumbX = thumbTip.x * canvas.width;
        const thumbY = thumbTip.y * canvas.height;
        const indexX = indexTip.x * canvas.width;
        const indexY = indexTip.y * canvas.height;

        const distance = Math.hypot(thumbX - indexX, thumbY - indexY);
        const pinchCenter = { x: (thumbX + indexX) / 2, y: (thumbY + indexY) / 2 };

        ctx.beginPath();
        ctx.arc(pinchCenter.x, pinchCenter.y, 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
        ctx.fill();

        if (distance < 40) {
            if (!draggingOverlay) {
                for (let item of overlays) {
                    if (
                        pinchCenter.x >= item.x &&
                        pinchCenter.x <= item.x + item.width &&
                        pinchCenter.y >= item.y &&
                        pinchCenter.y <= item.y + item.height
                    ) {
                        draggingOverlay = item;
                        break;
                    }
                }
            }

            if (draggingOverlay) {
                draggingOverlay.x = pinchCenter.x - draggingOverlay.width / 2;
                draggingOverlay.y = pinchCenter.y - draggingOverlay.height / 2;
            }
        } else {
            draggingOverlay = null;
        }
    }
});

// Access webcam and start video processing
navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
        video.play();

        async function processVideo() {
            await hands.send({ image: video });
            requestAnimationFrame(processVideo);
        }
        processVideo();
    })
    .catch(err => {
        console.error("Error accessing the webcam: " + err);
    });
