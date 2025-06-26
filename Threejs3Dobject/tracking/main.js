import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

// --- Three.js Setup ---
let scene, camera, renderer, model; // 'model' sekarang akan menjadi objek kubus

// Global state for hand data
// Stores { landmarks, handedness, wristX (current), wristY (current), gesture }
const detectedHands = new Map();
let previousHandCount = 0; // To track hand count changes for scaling reset

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

    // Store the hand data from the previous frame before clearing for the current frame
    // This allows us to access previous positions for delta calculations in apply3DInteraction
    const prevDetectedHandsData = new Map(detectedHands);

    detectedHands.clear(); // Clear for current frame's new data
    gestureLSpan.textContent = 'None';
    gestureRSpan.textContent = 'None';

    const currentHandCount = results.multiHandedness ? results.multiHandedness.length : 0;
    handCountSpan.textContent = currentHandCount;

    // Reset scaling reference if hand count changes from 2 to anything else
    // Or if it changes from non-2 to 2 (to re-establish initial distance)
    if (model) {
        if (currentHandCount !== 2 && previousHandCount === 2) {
            // Just transitioned from 2 hands to less than 2, reset scaling data
            model.userData.scalingInitialDistance = undefined;
            model.userData.scalingInitialScale = undefined;
        } else if (currentHandCount === 2 && previousHandCount !== 2) {
            // Just transitioned to 2 hands from less than 2, reset scaling data to force re-initialization
            // The initialDistance will be set inside apply3DInteraction for the first frame it sees two hands.
            model.userData.scalingInitialDistance = undefined;
            model.userData.scalingInitialScale = undefined;
        }
    }
    previousHandCount = currentHandCount; // Update for the next frame


    if (results.multiHandLandmarks && results.multiHandedness) {
        results.multiHandedness.forEach((handednessResult, index) => {
            const handedness = handednessResult.label; // "Left" or "Right"
            const landmarks = results.multiHandLandmarks[index];
            const handKey = handedness === 'Left' ? 'leftHand' : 'rightHand';

            // Get previous frame's wrist position for this hand
            const prevHandState = prevDetectedHandsData.get(handKey);
            // Use current wrist position if no previous data (first frame) to avoid NaN
            const previousWristX = prevHandState ? prevHandState.wristX : landmarks[0].x;
            const previousWristY = prevHandState ? prevHandState.wristY : landmarks[0].y;

            // Detect gesture for THIS hand (current frame)
            const currentGesture = detectGesture(landmarks, handedness);

            // Store current frame's data in the map, ready for *next* frame's 'previous'
            detectedHands.set(handKey, {
                landmarks: landmarks,
                handedness: handedness,
                wristX: landmarks[0].x, // Store current wrist X
                wristY: landmarks[0].y, // Store current wrist Y
                gesture: currentGesture // Store detected gesture
            });

            // Update UI
            if (handedness === 'Left') {
                gestureLSpan.textContent = currentGesture;
            } else if (handedness === 'Right') {
                gestureRSpan.textContent = currentGesture;
            }

            // Draw hand landmarks
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
            drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2 });

            // Apply 3D interactions
            if (model) {
                // Pass current landmarks, handedness, and the PREVIOUS wrist positions for delta calculation
                apply3DInteraction(landmarks, handedness, previousWristX, previousWristY);
            }
        });
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
            let errorMessage = `Webcam Error: ${error.message}.`;
            if (error.name === 'NotAllowedError') {
                cameraStatusSpan.textContent = 'Denied (Permission needed)';
                errorMessage += " Please allow camera permissions in your browser settings and refresh the page.";
            } else if (error.name === 'NotFoundError') {
                cameraStatusSpan.textContent = 'No webcam found';
                errorMessage += " No webcam found. Please ensure a webcam is connected.";
            } else if (error.name === 'NotReadableError') {
                cameraStatusSpan.textContent = 'In use/Inaccessible';
                errorMessage += " Webcam is already in use or inaccessible. Close other applications that might be using it.";
            } else {
                cameraStatusSpan.textContent = `Error: ${error.message}`;
            }
            displayCustomMessage(errorMessage); // Use custom message box
        }
    } else {
        cameraStatusSpan.textContent = 'Not supported';
        displayCustomMessage("Your browser does not support webcam access. Please try a different browser (e.g., Chrome, Firefox).");
    }
}

async function sendToMediaPipe() {
    if (!videoElement.paused && !videoElement.ended) {
        await hands.send({ image: videoElement });
    }
    // Use requestAnimationFrame for continuous processing of video frames
    requestAnimationFrame(sendToMediaPipe);
}

// Custom message box function (replaces alert)
function displayCustomMessage(message) {
    const messageBox = document.createElement('div');
    messageBox.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: #333;
        color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        text-align: center;
        max-width: 80%;
        font-family: 'Inter', sans-serif;
    `;
    messageBox.innerHTML = `
        <p>${message}</p>
        <button style="margin-top: 15px; padding: 10px 20px; border: none; border-radius: 5px; background-color: #007bff; color: white; cursor: pointer; font-size: 1rem;">OK</button>
    `;
    document.body.appendChild(messageBox);

    messageBox.querySelector('button').onclick = () => {
        document.body.removeChild(messageBox);
    };
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
    // Compare distance from thumb tip to base with distance from base to second joint.
    const thumbExtended = getDistance(thumbTip, landmarks[2]) > getDistance(landmarks[3], landmarks[2]) * 0.8;

    // Thumbs Up gesture: thumb extended, other fingers bent, thumb tip above thumb base
    const isThumbsUp = thumbExtended && thumbTip.y < landmarks[3].y &&
                       !indexExtended && !middleExtended && !ringExtended && !pinkyExtended;

    // Pinch gesture (thumb and index finger close)
    const pinchDistance = getDistance(thumbTip, indexTip);
    const isPinching = pinchDistance < 0.05; // Threshold, needs calibration

    // Closed fist (all fingers bent significantly)
    // Check if tip of finger is below its knuckle, and thumb is also retracted
    const isClosedFist =
        indexTip.y > landmarks[6].y && // Index finger tip below its knuckle
        middleTip.y > landmarks[10].y &&
        ringTip.y > landmarks[14].y &&
        pinkyTip.y > landmarks[18].y &&
        getDistance(thumbTip, wrist) < 0.2; // Thumb is relatively close to wrist

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
    if (isOpenPalm) {
        return "Open Palm";
    }

    return "None";
}

let lastColorChangeTime = 0;
const colorChangeCooldown = 1000; // 1 second cooldown

function apply3DInteraction(landmarks, handedness, previousX, previousY) {
    if (!model) return;

    const wrist = landmarks[0]; // Current wrist landmark
    const centerX = 0.5; // Center of the screen (normalized)
    const centerY = 0.5;

    // Get the current gesture for this hand from the map (which was just updated in onResults)
    const currentHandData = detectedHands.get(handedness === 'Left' ? 'leftHand' : 'rightHand');
    const currentGesture = currentHandData ? currentHandData.gesture : "None";

    // --- Translation (Move object with hand position) ---
    // Translation is applied only if NEITHER hand is in a "Fist" gesture.
    const leftHandIsFist = detectedHands.get('leftHand')?.gesture === "Fist";
    const rightHandIsFist = detectedHands.get('rightHand')?.gesture === "Fist";

    if (!leftHandIsFist && !rightHandIsFist) {
        const sensitivity = 5; // How much model moves for hand movement
        const targetX = (wrist.x - centerX) * sensitivity;
        const targetY = -(wrist.y - centerY) * sensitivity; // Y-axis inverted for screen vs 3D

        // Smooth movement
        model.position.x += (targetX - model.position.x) * 0.1;
        model.position.y += (targetY - model.position.y) * 0.1;
    }


    // --- Rotation (Based on Fist gesture or hand movement) ---
    // Apply rotation only if the current hand (the one being processed by this call) is a "Fist"
    if (currentGesture === "Fist") {
        const deltaX = wrist.x - previousX;
        const deltaY = wrist.y - previousY;

        // Rotate around Y-axis with horizontal movement (positive deltaX moves right, rotates positive Y)
        model.rotation.y += deltaX * 5;
        // Rotate around X-axis with vertical movement (positive deltaY moves down, rotates positive X)
        model.rotation.x += deltaY * 5;
    }


    // --- Scaling (Pinch gesture with two hands) ---
    if (detectedHands.size === 2) {
        const leftHandData = detectedHands.get('leftHand');
        const rightHandData = detectedHands.get('rightHand');

        if (leftHandData && rightHandData) {
            const leftIndexTip = leftHandData.landmarks[8];
            const rightIndexTip = rightHandData.landmarks[8];

            const distBetweenHands = getDistance(leftIndexTip, rightIndexTip);

            // Set initial distance only if it's undefined (first time 2 hands are consistently seen)
            // This handles cases where hands briefly leave/re-enter
            if (model.userData.scalingInitialDistance === undefined || model.userData.scalingInitialScale === undefined) {
                model.userData.scalingInitialDistance = distBetweenHands;
                model.userData.scalingInitialScale = model.scale.x;
            }

            const scaleRatio = distBetweenHands / model.userData.scalingInitialDistance;
            let targetScale = model.userData.scalingInitialScale * scaleRatio;

            // Clamp scale to reasonable limits
            targetScale = Math.max(0.5, Math.min(3.0, targetScale)); // Scale between 0.5x and 3.0x

            model.scale.setScalar(targetScale);
        }
    } else {
        // If not exactly two hands, ensure scaling reference is cleared
        model.userData.scalingInitialDistance = undefined;
        model.userData.scalingInitialScale = undefined;
    }


    // --- Color/Material Change (Thumbs Up gesture) ---
    // This applies to the hand currently being processed by apply3DInteraction
    if (currentGesture === "Thumbs Up") {
        const currentTime = Date.now();
        if (currentTime - lastColorChangeTime > colorChangeCooldown) {
            if (model.material) {
                model.material.color.set(new THREE.Color(Math.random(), Math.random(), Math.random()));
                model.material.needsUpdate = true; // Important to update material
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
// Ensure the DOM is fully loaded before initializing
window.onload = function() {
    initThreeJS();
    startCamera();
    animate();
};
