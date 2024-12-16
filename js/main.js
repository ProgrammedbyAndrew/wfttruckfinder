// Target coordinates in decimal degrees
const TARGET_LAT = 28.3375;
const TARGET_LON = -81.4631;

// Threshold distance (in meters) at which the device will vibrate/notify.
const THRESHOLD_DISTANCE = 20; 

// DOM Elements
const arrowEl = document.getElementById('arrow');
const distanceIndicator = document.getElementById('distance-indicator');
const videoEl = document.getElementById('camera-stream');

// State variables
let currentLatitude = null;
let currentLongitude = null;
let currentHeading = null;

// Check if device orientation and geolocation are supported
if ('geolocation' in navigator && 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
  setupCamera();
  watchPosition();
  watchHeading();
} else {
  alert("Your browser does not support necessary APIs for this application.");
}

/**
 * Setup the back-facing camera stream
 */
function setupCamera() {
  // Attempt to use rear camera if available
  const constraints = {
    video: { facingMode: { exact: "environment" } },
    audio: false
  };

  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      videoEl.srcObject = stream;
    })
    .catch(err => {
      console.error("Error accessing camera:", err);
      alert("Could not access the rear camera. Please check permissions.");
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
    {
      enableHighAccuracy: true,
      maximumAge: 1000
    }
  );
}

/**
 * For compass heading (if available):
 * Modern browsers might not support DeviceOrientationEvent without user gestures.
 * This is a simplified approach using the Geolocation API only. 
 * If you'd like to use compass bearing from device orientation:
 * - On iOS you need user gestures and permissions.
 * - For now, we’ll rely on calculating bearing from positions if device heading isn’t available.
 */
function watchHeading() {
  // Attempt to use device orientation if supported
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', event => {
      // alpha = 0 means the device is facing north
      // alpha: rotation around Z-axis
      currentHeading = event.alpha;
      updateDirection();
    }, true);
  } else {
    // If deviceorientation not available, we’ll rely on bearing calculation alone.
    // currentHeading might remain null; arrow direction will be less accurate.
  }
}

/**
 * Update the direction of the arrow based on current location and heading.
 */
function updateDirection() {
  if (currentLatitude === null || currentLongitude === null) return;

  // Calculate bearing from current location to the target
  const bearingToTarget = computeBearing(currentLatitude, currentLongitude, TARGET_LAT, TARGET_LON);

  // If we have a device heading (compass), adjust arrow angle accordingly.
  // If heading is unavailable, arrow just points to computed bearing relative to north.
  const heading = currentHeading !== null ? currentHeading : 0;
  
  // Convert device heading to degrees from north
  // Device heading alpha=0 = facing north, but can differ based on device orientation.
  // For simplicity, assume alpha=0 means north.
  // Arrow rotation = bearingToTarget - heading
  const arrowRotation = bearingToTarget - heading;
  
  arrowEl.style.transform = `translate(-50%, -50%) rotate(${arrowRotation}deg)`;

  // Update distance
  const dist = computeDistance(currentLatitude, currentLongitude, TARGET_LAT, TARGET_LON);
  distanceIndicator.textContent = `Distance: ${Math.round(dist)}m`;

  // If close enough, vibrate and maybe show an animation.
  if (dist < THRESHOLD_DISTANCE) {
    // Vibrate device if supported
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    // Optionally, change arrow color or add a CSS animation:
    arrowEl.style.filter = 'drop-shadow(0 0 10px #00ff00)';
  } else {
    arrowEl.style.filter = 'drop-shadow(0 0 5px #000)';
  }
}

/**
 * Calculate bearing between two coordinates
 * Formula Reference:
 * bearing = atan2( sin(Δlon)*cos(lat2),
 *                  cos(lat1)*sin(lat2)-sin(lat1)*cos(lat2)*cos(Δlon) )
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