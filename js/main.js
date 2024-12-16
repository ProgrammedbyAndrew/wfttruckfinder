// Target coordinates in decimal degrees
const TARGET_LAT = 28.3375;
const TARGET_LON = -81.4631;

// Threshold distance (in meters) at which the device will vibrate/notify.
const THRESHOLD_DISTANCE = 20; 

// DOM Elements
const distanceIndicator = document.getElementById('distance-indicator');
const videoEl = document.getElementById('camera-stream');
const canvasEl = document.getElementById('three-canvas');

let currentLatitude = null;
let currentLongitude = null;
let currentHeading = null;

if ('geolocation' in navigator && 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
  setupCamera().then(() => {
    watchPosition();
    watchHeading();
    setupThreeJS();
  });
} else {
  alert("Your browser does not support necessary APIs for this application.");
}

// THREE.js variables
let scene, camera, renderer;
let arrowObject;

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
      alert("Could not get your location. Ensure GPS is enabled.");
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
      currentHeading = event.alpha;
      updateDirection();
    }, true);
  } else {
    // If not available, we'll rely solely on bearing calculations.
  }
}

/**
 * Setup Three.js scene
 */
function setupThreeJS() {
  // Create renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Create scene
  scene = new THREE.Scene();

  // Create camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.z = 2; // Just so we can see the arrow in front of us.

  // Create a directional light
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(0, 1, 2).normalize();
  scene.add(light);

  // Create arrow object:
  // We'll make a simple arrow out of a cylinder (shaft) and a cone (tip).

  const shaftGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 32);
  const tipGeometry = new THREE.ConeGeometry(0.05, 0.2, 32);

  const redMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });

  const shaft = new THREE.Mesh(shaftGeometry, redMaterial);
  const tip = new THREE.Mesh(tipGeometry, redMaterial);

  // Position the shaft so its center is at the origin
  shaft.position.y = 0;
  // Position the tip at the top
  tip.position.y = 0.5; // half the shaft (0.4) + half the cone height (0.1) ~0.5 total

  arrowObject = new THREE.Object3D();
  arrowObject.add(shaft);
  arrowObject.add(tip);

  // By default, cylinders and cones point up the Y-axis. We want the arrow to point "forward" (Z-axis)
  // Rotate so that the arrow points "up" on our screen. The user orientation is tricky,
  // but let's have it initially point upward on the screen and rotate it based on bearing.
  arrowObject.rotation.x = Math.PI / 2; // Now arrow points along the Z-axis

  scene.add(arrowObject);

  window.addEventListener('resize', onWindowResize);

  animate();
}

/**
 * Animate Three.js scene
 */
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

/**
 * Handle window resize
 */
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

  // We previously rotated arrowObject so it points along the Z-axis.
  // We want arrowObject to rotate around Y-axis to point towards bearing.
  // Bearing = degrees clockwise from north. If arrow points along Z (north),
  // rotate by arrowRotation in Y to match bearing difference.

  arrowObject.rotation.y = THREE.MathUtils.degToRad(arrowRotation);

  // Update distance
  const dist = computeDistance(currentLatitude, currentLongitude, TARGET_LAT, TARGET_LON);
  distanceIndicator.textContent = `Distance: ${Math.round(dist)}m`;

  // If close enough, vibrate
  if (dist < THRESHOLD_DISTANCE) {
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