// Get references to the video and canvas elements from the HTML
const video = document.getElementById('webcam');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');

// Variable to store the distance between index fingers for zoom calculations
let prevDistance = null;

// Array to hold overlay images and their properties (position, size)
const overlays = [
    { img: new Image(), x: 400, y: 100, width: 75, height: 75 },
    { img: new Image(), x: 300, y: 200, width: 75, height: 75 }
];

// Set the source for the overlay images
overlays[0].img.src = 'https://picsum.photos/200';
overlays[1].img.src = 'https://picsum.photos/id/17/200/300';

/**
 * Resizes the canvas to match the dimensions of the video element.
 * This ensures the overlay aligns correctly with the webcam feed.
 */
function resizeCanvas() {
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
}

// Event listeners to resize the canvas when the video metadata loads or the window is resized
video.addEventListener('loadedmetadata', resizeCanvas);
window.addEventListener('resize', resizeCanvas);

/**
 * Draws all currently defined overlay images onto the canvas.
 * Clears the canvas before redrawing to update positions/sizes.
 */
function drawOverlay() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the entire canvas
    overlays.forEach(item => {
        // Draw each overlay image with its current properties
        ctx.drawImage(item.img, item.x, item.y, item.width, item.height);
    });
}

/**
 * Checks if a hand's index finger is extended based on the ratio of distances
 * from the fingertip to the PIP joint and fingertip to the MCP joint.
 * @param {Array} hand - An array of hand landmark points from MediaPipe.
 * @returns {boolean} True if the index finger is considered extended, false otherwise.
 */
function isIndexFingerExtended(hand) {
    // MediaPipe landmark indices for index finger: MCP (5), PIP (6), TIP (8)
    const mcp = hand[5];
    const pip = hand[6];
    const tip = hand[8];

    // Calculate distances
    const tipToPip = Math.hypot(tip.x - pip.x, tip.y - pip.y);
    const tipToMcp = Math.hypot(tip.x - mcp.x, tip.y - mcp.y);

    // Prevent division by zero
    if (tipToMcp === 0) return false;

    // A smaller ratio indicates the finger is straighter (extended)
    const ratio = tipToPip / tipToMcp;
    return ratio < 0.7; // Threshold for "extended"
}

// Initialize MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

// Configure MediaPipe Hands options
hands.setOptions({
    maxNumHands: 2,               // Detect up to two hands
    modelComplexity: 1,           // Use a more complex model for better accuracy
    minDetectionConfidence: 0.7,  // Minimum confidence for hand detection
    minTrackingConfidence: 0.7    // Minimum confidence for hand tracking
});

// Callback function when MediaPipe Hands processes a frame
hands.onResults((results) => {
    drawOverlay(); // Always redraw overlays on each frame

    // Check if two hands are detected
    if (results.multiHandLandmarks && results.multiHandLandmarks.length >= 2) {
        let hand1 = results.multiHandLandmarks[0];
        let hand2 = results.multiHandLandmarks[1];
        let handedness1 = results.multiHandedness[0].label;
        let handedness2 = results.multiHandedness[1].label;

        let leftHand, rightHand;

        // Assign hands to left/right based on handedness labels
        if (handedness1 === 'Left' && handedness2 === 'Right') {
            leftHand = hand1;
            rightHand = hand2;
        } else if (handedness1 === 'Right' && handedness2 === 'Left') {
            leftHand = hand2;
            rightHand = hand1;
        } else {
            // Fallback if handedness is not clearly defined or only one hand is identified
            // For simplicity, we just assign them in order received, but this might not be robust
            leftHand = hand1;
            rightHand = hand2;
        }

        // Check if both index fingers are extended
        if (!isIndexFingerExtended(leftHand) || !isIndexFingerExtended(rightHand)) {
            prevDistance = null; // Reset distance if fingers are not extended
            return;
        }

        // Get normalized coordinates of the index fingertips
        const leftIndex = leftHand[8];
        const rightIndex = rightHand[8];

        // Convert normalized coordinates to canvas pixel coordinates
        const leftX = leftIndex.x * canvas.width;
        const leftY = leftIndex.y * canvas.height;
        const rightX = rightIndex.x * canvas.width;
        const rightY = rightIndex.y * canvas.height;

        // Draw circles at the index fingertips for visualization
        ctx.beginPath();
        ctx.arc(leftX, leftY, 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 0, 255, 0.6)'; // Blue for left index
        ctx.fill();

        ctx.beginPath();
        ctx.arc(rightX, rightY, 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.6)'; // Red for right index
        ctx.fill();

        // Calculate the center point between the two index fingers
        const pinchCenter = {
            x: (leftX + rightX) / 2,
            y: (leftY + rightY) / 2
        };

        // Draw a circle at the pinch center for visualization
        ctx.beginPath();
        ctx.arc(pinchCenter.x, pinchCenter.y, 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.6)'; // Green for pinch center
        ctx.fill();

        // Calculate the current distance between the two index fingers
        const currentDistance = Math.hypot(rightX - leftX, rightY - leftY);

        // Perform scaling if a previous distance exists
        if (prevDistance !== null) {
            const scaleFactor = currentDistance / prevDistance;

            // Apply scaling to overlays that are "under" the pinch center
            overlays.forEach(item => {
                // Check if the pinch center is within the bounds of the current overlay item
                if (
                    pinchCenter.x >= item.x &&
                    pinchCenter.x <= item.x + item.width &&
                    pinchCenter.y >= item.y &&
                    pinchCenter.y <= item.y + item.height
                ) {
                    const centerX = item.x + item.width / 2;
                    const centerY = item.y + item.height / 2;

                    item.width *= scaleFactor;
                    item.height *= scaleFactor;

                    // Adjust position to keep the center of the scaled item in place
                    item.x = centerX - item.width / 2;
                    item.y = centerY - item.height / 2;
                }
            });
        }
        // Store the current distance for the next frame
        prevDistance = currentDistance;
    } else {
        // If two hands are not detected, reset the previous distance
        prevDistance = null;
    }
});

// Request access to the user's webcam
navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
        video.play();

        // Start processing the video stream with MediaPipe Hands
        async function processVideo() {
            await hands.send({ image: video });
            requestAnimationFrame(processVideo); // Request next frame
        }
        processVideo(); // Initiate the processing loop
    })
    .catch(err => {
        console.error("Error accessing the webcam: " + err);
    });