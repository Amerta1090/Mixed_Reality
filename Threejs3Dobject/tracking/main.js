import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

// --- Three.js Setup ---
let scene, camera, renderer, model; // 'model' sekarang akan menjadi objek kubus

// Global state for hand data
const detectedHands = new Map(); // Map untuk menyimpan data tangan: key = hand ID, value = { landmarks, handedness, previousX, previousY }

// UI Elements
const cameraStatusSpan = document.getElementById('camera-status');
const handCountSpan = document.getElementById('hand-count');
const gestureLSpan = document.getElementById('gesture-l');
const gestureRSpan = document.getElementById('gesture-r');
const threejsContainer = document.getElementById('threejs-container');

function initThreeJS() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, threejsContainer.clientWidth / threejsContainer.clientHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(threejsContainer.clientWidth, threejsContainer.clientHeight);
    threejsContainer.appendChild(renderer.domElement);

    // Add lights (penting untuk material non-Basic)
    const ambientLight = new THREE.AmbientLight(0x404040, 2); // soft white light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 10, 5);
    scene.add(directionalLight);
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(-10, -5, 10);
    scene.add(pointLight);

    camera.position.z = 3;

    // --- Buat Objek 3D Sederhana (Kubus) ---
    const geometry = new THREE.BoxGeometry(1, 1, 1); // Lebar, tinggi, kedalaman 1 unit
    const material = new THREE.MeshPhongMaterial({ color: 0x007bff }); // Biru cerah, bereaksi terhadap cahaya
    model = new THREE.Mesh(geometry, material);
    scene.add(model);
    console.log('Simple 3D Cube created:', model);

    // Set posisi awal jika diperlukan
    model.position.y = 0.5;

    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = threejsContainer.clientWidth / threejsContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(threejsContainer.clientWidth, threejsContainer.clientHeight);
    renderer.render(scene, camera);
}


// --- MediaPipe Hand Tracking Setup ---
const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    // Flip the video horizontally to match common webcam mirrors
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // Clear previous hand data
    detectedHands.clear();
    gestureLSpan.textContent = 'None';
    gestureRSpan.textContent = 'None';

    if (results.multiHandLandmarks && results.multiHandedness) {
        handCountSpan.textContent = results.multiHandedness.length; // Gunakan length dari multiHandedness

        results.multiHandedness.forEach((handednessResult, index) => {
            const handedness = handednessResult.label; // "Left" or "Right"
            const landmarks = results.multiHandLandmarks[index];

            // Use a unique key for each hand (e.g., its handedness)
            const handKey = handedness === 'Left' ? 'leftHand' : 'rightHand';
            const previousHandData = detectedHands.get(handKey) || {}; // Get previous data if exists

            detectedHands.set(handKey, {
                landmarks: landmarks,
                handedness: handedness,
                // Store previous wrist position for movement calculation
                previousX: previousHandData.landmarks ? previousHandData.landmarks[0].x : landmarks[0].x,
                previousY: previousHandData.landmarks ? previousHandData.landmarks[0].y : landmarks[0].y,
            });

            // Draw hand landmarks
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
            drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2 });

            // Apply 3D interactions
            if (model) {
                apply3DInteraction(landmarks, handedness, detectedHands.get(handKey).previousX, detectedHands.get(handKey).previousY);
            }
        });
    } else {
        handCountSpan.textContent = '0';
    }
    canvasCtx.restore();
}

const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

async function startCamera() {
    if (!videoElement) {
        console.error("Video element with class 'input_video' not found!");
        cameraStatusSpan.textContent = 'Error: Video element not found.';
        return;
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoElement.srcObject = stream;
            cameraStatusSpan.textContent = 'Streaming...';

            await new Promise((resolve) => {
                videoElement.onloadedmetadata = () => {
                    resolve();
                };
            });

            await videoElement.play();

            // Set canvas dimensions to match video
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;

            sendToMediaPipe();
        } catch (error) {
            console.error("Error accessing webcam:", error);
            if (error.name === 'NotAllowedError') {
                cameraStatusSpan.textContent = 'Denied (Permission needed)';
                alert("Webcam access denied. Please allow camera permissions in your browser settings and refresh.");
            } else if (error.name === 'NotFoundError') {
                cameraStatusSpan.textContent = 'No webcam found';
                alert("No webcam found. Please ensure a webcam is connected.");
            } else if (error.name === 'NotReadableError') {
                cameraStatusSpan.textContent = 'In use/Inaccessible';
                alert("Webcam is already in use or inaccessible. Close other apps.");
            } else {
                cameraStatusSpan.textContent = `Error: ${error.message}`;
                alert(`An error occurred: ${error.message}`);
            }
        }
    } else {
        cameraStatusSpan.textContent = 'Not supported';
        alert("Your browser does not support webcam access.");
    }
}

async function sendToMediaPipe() {
    if (!videoElement.paused && !videoElement.ended) {
        await hands.send({ image: videoElement });
    }
    requestAnimationFrame(sendToMediaPipe);
}

// --- Gesture Recognition and 3D Interaction Logic ---

// Helper function to calculate distance between two landmarks
function getDistance(landmark1, landmark2) {
    return Math.sqrt(
        Math.pow(landmark1.x - landmark2.x, 2) +
        Math.pow(landmark1.y - landmark2.y, 2) +
        Math.pow(landmark1.z - landmark2.z, 2)
    );
}

// Simple gesture detection (you can expand this!)
function detectGesture(landmarks, handedness) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const wrist = landmarks[0];

    // Check if fingers are extended (y-coordinate check for typical webcam orientation)
    // Lower y-value means higher on the screen.
    const indexExtended = indexTip.y < landmarks[6].y;
    const middleExtended = middleTip.y < landmarks[10].y;
    const ringExtended = ringTip.y < landmarks[14].y;
    const pinkyExtended = pinkyTip.y < landmarks[18].y;

    // Check if thumb is extended (more robust check needed for complex scenarios)
    const thumbExtended = getDistance(thumbTip, landmarks[2]) > getDistance(landmarks[3], landmarks[2]) * 0.8; // Adjusted threshold

    // Thumbs Up/Down (relative to wrist and palm orientation)
    // Check if thumb is generally above the base of the thumb and other fingers are bent
    const isThumbsUp = thumbExtended && thumbTip.y < landmarks[3].y &&
                       !indexExtended && !middleExtended && !ringExtended && !pinkyExtended;

    // Pinch gesture (thumb and index finger close)
    const pinchDistance = getDistance(thumbTip, indexTip);
    const isPinching = pinchDistance < 0.05; // Threshold, needs calibration based on your hand size and camera distance

    // Closed fist (all fingers bent significantly)
    // Check if tip of finger is below its knuckle
    const isClosedFist =
        indexTip.y > landmarks[6].y &&
        middleTip.y > landmarks[10].y &&
        ringTip.y > landmarks[14].y &&
        pinkyTip.y > landmarks[18].y &&
        getDistance(thumbTip, wrist) < 0.2; // Thumb also retracted

    // Open palm (all fingers extended)
    const isOpenPalm = indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtended && !isPinching;

    // Prioritize gestures
    if (isPinching) {
        return "Pinch";
    }
    if (isClosedFist) {
        return "Fist";
    }
    if (isThumbsUp) {
        return "Thumbs Up";
    }
    // Add Thumbs Down if needed
    // if (thumbDown) {
    //     return "Thumbs Down";
    // }
    if (isOpenPalm) {
        return "Open Palm";
    }

    return "None";
}

let lastColorChangeTime = 0;
const colorChangeCooldown = 1000; // 1 second cooldown

function apply3DInteraction(landmarks, handedness, previousX, previousY) {
    if (!model) return;

    const wrist = landmarks[0]; // Wrist landmark
    const centerX = 0.5; // Center of the screen (normalized)
    const centerY = 0.5;

    const currentGesture = detectGesture(landmarks, handedness);

    if (handedness === 'Left') {
        gestureLSpan.textContent = currentGesture;
    } else if (handedness === 'Right') {
        gestureRSpan.textContent = currentGesture;
    }

    // --- Translation (Move object with hand position) ---
    // Apply translation using the dominant hand (e.g., right hand)
    // Only translate if no hand is in "Fist" gesture (to avoid conflict with rotation)
    const leftHandGesture = detectedHands.get('leftHand')?.gesture;
    const rightHandGesture = detectedHands.get('rightHand')?.gesture;

    if (currentGesture !== "Fist" && leftHandGesture !== "Fist" && rightHandGesture !== "Fist") {
        const sensitivity = 5; // How much model moves for hand movement
        const targetX = (wrist.x - centerX) * sensitivity;
        const targetY = -(wrist.y - centerY) * sensitivity; // Y-axis inverted for screen vs 3D

        // Smooth movement
        model.position.x += (targetX - model.position.x) * 0.1;
        model.position.y += (targetY - model.position.y) * 0.1;
    }


    // --- Rotation (Based on Fist gesture or hand movement) ---
    // If a hand is in a "Fist" gesture, use its movement for rotation
    if (currentGesture === "Fist") {
        const deltaX = wrist.x - previousX;
        const deltaY = wrist.y - previousY;
        model.rotation.y -= deltaX * 5; // Rotate around Y-axis with horizontal movement
        model.rotation.x += deltaY * 5; // Rotate around X-axis with vertical movement
    }


    // --- Scaling (Pinch gesture with two hands) ---
    if (detectedHands.size === 2) {
        const leftHandData = detectedHands.get('leftHand');
        const rightHandData = detectedHands.get('rightHand');

        if (leftHandData && rightHandData) {
            const leftIndexTip = leftHandData.landmarks[8];
            const rightIndexTip = rightHandData.landmarks[8];

            // Use distance between index finger tips of both hands
            const distBetweenHands = getDistance(leftIndexTip, rightIndexTip);

            // Establish a base distance dynamically or use a known average
            // Store the initial distance when two hands are first detected for scaling
            if (model.userData.scalingInitialDistance === undefined) {
                model.userData.scalingInitialDistance = distBetweenHands;
                model.userData.scalingInitialScale = model.scale.x; // Store current scale
            }

            const scaleRatio = distBetweenHands / model.userData.scalingInitialDistance;
            let targetScale = model.userData.scalingInitialScale * scaleRatio;

            // Clamp scale to reasonable limits
            targetScale = Math.max(0.5, Math.min(3.0, targetScale)); // Scale between 0.5x and 3.0x

            model.scale.setScalar(targetScale);
        }
    } else {
        // Reset scaling state when only one hand or no hands are detected
        model.userData.scalingInitialDistance = undefined;
        model.userData.scalingInitialScale = undefined;
    }

    // --- Color/Material Change (Thumbs Up gesture) ---
    if (currentGesture === "Thumbs Up") {
        const currentTime = Date.now();
        if (currentTime - lastColorChangeTime > colorChangeCooldown) {
            // Langsung ubah warna material objek sederhana
            if (model.material) {
                model.material.color.set(new THREE.Color(Math.random(), Math.random(), Math.random()));
                model.material.needsUpdate = true; // Penting untuk memperbarui material
            }
            lastColorChangeTime = currentTime;
        }
    }
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    // Render Three.js scene
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// --- Initialization ---
initThreeJS();
startCamera();
animate();