// Target coordinates in decimal degrees
const TARGET_LAT = 28.3375;
const TARGET_LON = -81.4631;

// Threshold distance (in meters) at which the device will vibrate/notify.
const THRESHOLD_DISTANCE = 20; 

// DOM Elements
const distanceIndicator = document.getElementById('distance-indicator');
const videoEl = document.getElementById('camera-stream');
const canvasEl = document.getElementById('three-canvas');
const startBtn = document.getElementById('start-btn');

let currentLatitude = null;
let currentLongitude = null;
let currentHeading = null;

// THREE.js variables
let scene, camera, renderer;
let arrowObject;

startBtn.addEventListener('click', async () => {
  startBtn.style.display = 'none'; // Hide the button

  // Request device orientation permission on iOS
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const response = await DeviceOrientationEvent.requestPermission();
      if (response !== 'granted') {
        alert("Device orientation permission not granted. The arrow may not rotate with your device orientation.");
      }
    } catch (err) {
      console.error("Error requesting device orientation permission:", err);
    }
  }

  // Now attempt to set up camera and geolocation
  await setupCamera();
  setupThreeJS();
  watchPosition();
  watchHeading();
});

/**
 * Setup the back-facing camera stream
 */
async function setupCamera() {
  const constraints = {
    video: { facingMode: { exact: "environment" } },
    audio: false
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoEl.srcObject = stream;

  return new Promise(resolve => {
    videoEl.onloadedmetadata = () => {
      videoEl.play();
      resolve();
    };
  });
}

/**
 * Watch the user's position (GPS)
 */
function watchPosition() {
  navigator.geolocation.watchPosition(
    pos => {
      currentLatitude = pos.coords.latitude;
      currentLongitude = pos.coords.longitude;
      updateDirection();
    },
    err => {
      console.error("Geolocation error:", err);
      alert("Could not get your location. Ensure GPS is enabled and grant permission.");
    },
    { enableHighAccuracy: true, maximumAge: 1000 }
  );
}

/**
 * Watch device orientation (if available)
 */
function watchHeading() {
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', event => {
      // iOS Safari may provide webkitCompassHeading:
      // webkitCompassHeading is degrees from North (0° = North)
      if (event.webkitCompassHeading !== undefined) {
        currentHeading = event.webkitCompassHeading;
      } else {
        // fallback to alpha if no webkitCompassHeading
        // alpha: 0 = device facing North
        currentHeading = event.alpha;
      }
      updateDirection();
    }, true);
  }
}

/**
 * Setup Three.js scene
 */
function setupThreeJS() {
  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.z = 2; 

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(0, 1, 2).normalize();
  scene.add(light);

  // Create arrow object
  const shaftGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 32);
  const tipGeometry = new THREE.ConeGeometry(0.05, 0.2, 32);

  const redMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });

  const shaft = new THREE.Mesh(shaftGeometry, redMaterial);
  const tip = new THREE.Mesh(tipGeometry, redMaterial);

  shaft.position.y = 0;
  tip.position.y = 0.5;

  arrowObject = new THREE.Object3D();
  arrowObject.add(shaft);
  arrowObject.add(tip);

  // Rotate to point along Z-axis
  arrowObject.rotation.x = Math.PI / 2; 
  scene.add(arrowObject);

  window.addEventListener('resize', onWindowResize);

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Update direction and distance UI
 */
function updateDirection() {
  if (currentLatitude === null || currentLongitude === null || !arrowObject) return;

  const bearingToTarget = computeBearing(currentLatitude, currentLongitude, TARGET_LAT, TARGET_LON);
  const heading = currentHeading !== null ? currentHeading : 0;
  const arrowRotation = bearingToTarget - heading;

  // Rotate arrow around Y-axis
  arrowObject.rotation.y = THREE.MathUtils.degToRad(arrowRotation);

  // Update distance in feet
  const distMeters = computeDistance(currentLatitude, currentLongitude, TARGET_LAT, TARGET_LON);
  const distFeet = distMeters * 3.28084; 
  distanceIndicator.textContent = `Distance: ${Math.round(distFeet)} ft`;

  // If close enough, vibrate
  if (distMeters < THRESHOLD_DISTANCE) {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }
}

/**
 * Calculate bearing between two coordinates
 */
function computeBearing(lat1, lon1, lat2, lon2) {
  const toRadians = deg => deg * Math.PI / 180;
  const dLon = toRadians(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRadians(lat2));
  const x = Math.cos(toRadians(lat1))*Math.sin(toRadians(lat2)) -
            Math.sin(toRadians(lat1))*Math.cos(toRadians(lat2))*Math.cos(dLon);
  const brng = Math.atan2(y, x);
  const brngDeg = (brng * 180 / Math.PI + 360) % 360;
  return brngDeg;
}

/**
 * Compute distance between two coords using Haversine formula (in meters)
 */
function computeDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // radius of Earth in meters
  const toRadians = deg => deg * Math.PI / 180;
  
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.cos(toRadians(lat1))*Math.cos(toRadians(lat2))*
            Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}