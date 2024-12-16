// Target coordinates in decimal degrees
const TARGET_LAT = 28.3375;
const TARGET_LON = -81.4631;

// Threshold distance (in meters) to trigger vibrate
const THRESHOLD_DISTANCE = 20; 

const distanceIndicator = document.getElementById('distance-indicator');
const videoEl = document.getElementById('camera-stream');
const canvasEl = document.getElementById('three-canvas');
const startBtn = document.getElementById('start-btn');

let currentLatitude = null;
let currentLongitude = null;
let currentHeading = null; // in degrees from North

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
        alert("Orientation permission not granted. The arrow may not rotate with device orientation.");
      }
    } catch (err) {
      console.error("Error requesting orientation permission:", err);
    }
  }

  await setupCamera();
  setupThreeJS();
  watchPosition();
  watchHeading();
});

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

function watchPosition() {
  navigator.geolocation.watchPosition(
    pos => {
      currentLatitude = pos.coords.latitude;
      currentLongitude = pos.coords.longitude;
      updateDirection();
    },
    err => {
      console.error("Geolocation error:", err);
      alert("Could not get your location. Ensure GPS is enabled and permission granted.");
    },
    { enableHighAccuracy: true, maximumAge: 1000 }
  );
}

function watchHeading() {
  const handleOrientation = (event) => {
    // Use webkitCompassHeading if available (iOS)
    if (typeof event.webkitCompassHeading === "number") {
      currentHeading = event.webkitCompassHeading; 
    } else if (typeof event.alpha === "number") {
      // alpha is degrees clockwise from North (0 = North)
      // On some devices alpha=0 means facing North
      currentHeading = event.alpha;
    }
    updateDirection();
  };

  if ('ondeviceorientationabsolute' in window) {
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
  } else if ('ondeviceorientation' in window) {
    window.addEventListener('deviceorientation', handleOrientation, true);
  } else {
    // No orientation events available
    console.warn("No device orientation events available.");
  }
}

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

  // Create arrow object (make it slightly bigger)
  const shaftGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 32);
  const tipGeometry = new THREE.ConeGeometry(0.07, 0.2, 32);

  const redMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });

  const shaft = new THREE.Mesh(shaftGeometry, redMaterial);
  const tip = new THREE.Mesh(tipGeometry, redMaterial);

  shaft.position.y = 0;
  tip.position.y = 0.5;

  arrowObject = new THREE.Object3D();
  arrowObject.add(shaft);
  arrowObject.add(tip);

  // Arrow points along +Z after rotation
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

function updateDirection() {
  if (currentLatitude === null || currentLongitude === null || !arrowObject) return;

  const bearingToTarget = computeBearing(currentLatitude, currentLongitude, TARGET_LAT, TARGET_LON);
  
  // If we have heading data, rotate according to heading:
  // arrowRotation = how much to rotate arrow from device facing North to target bearing
  let arrowRotation;
  if (currentHeading !== null) {
    arrowRotation = bearingToTarget - currentHeading;
  } else {
    // No heading data, just point to the bearing from North
    arrowRotation = bearingToTarget;
  }

  arrowObject.rotation.y = THREE.MathUtils.degToRad(arrowRotation);

  // Update distance in feet
  const distMeters = computeDistance(currentLatitude, currentLongitude, TARGET_LAT, TARGET_LON);
  const distFeet = distMeters * 3.28084; 
  distanceIndicator.textContent = `Distance: ${Math.round(distFeet)} ft`;

  if (distMeters < THRESHOLD_DISTANCE) {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }
}

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