const targetLat = 28.3372;
const targetLon = -81.4633;
const thresholdFeet = 10;

const arrowEl = document.querySelector('#arrow');
const hereTextEl = document.querySelector('#hereText');
const distanceEl = document.querySelector('#distance');
const loadingEl = document.querySelector('#loading');
const uiEl = document.querySelector('#ui');

let userLat = null;
let userLon = null;
let atLocation = false;

function toRad(deg) {
  return deg * Math.PI / 180;
}

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a = Math.sin(Δφ/2)**2 +
            Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function getBearing(lat1, lon1, lat2, lon2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const λ1 = toRad(lon1);
  const λ2 = toRad(lon2);

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1)*Math.sin(φ2) -
            Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2 - λ1);
  const θ = Math.atan2(y, x);
  return (θ * 180 / Math.PI + 360) % 360;
}

function updateDirection() {
  if (userLat === null || userLon === null) return;

  const distanceMeters = getDistanceMeters(userLat, userLon, targetLat, targetLon);
  const distanceFeet = distanceMeters * 3.28084;
  distanceEl.textContent = distanceFeet.toFixed(0);

  const bearing = getBearing(userLat, userLon, targetLat, targetLon);
  arrowEl.setAttribute('rotation', `0 ${bearing} 0`);

  if (!atLocation && distanceFeet < thresholdFeet) {
    atLocation = true;
    arrowEl.setAttribute('visible', 'false');
    hereTextEl.setAttribute('visible', 'true');
    if (navigator.vibrate) { navigator.vibrate(200); }
  } else if (atLocation && distanceFeet >= thresholdFeet) {
    atLocation = false;
    arrowEl.setAttribute('visible', 'true');
    hereTextEl.setAttribute('visible', 'false');
  }
}

function onSuccess(pos) {
  userLat = pos.coords.latitude;
  userLon = pos.coords.longitude;
  
  if (loadingEl) {
    loadingEl.style.display = 'none';
    uiEl.style.display = 'block';
  }
  
  updateDirection();
}

function onError(err) {
  console.warn('ERROR(' + err.code + '): ' + err.message);
  if (loadingEl) {
    loadingEl.innerText = 'Failed to get GPS. Check permissions.';
  }
}

if ('geolocation' in navigator) {
  navigator.geolocation.watchPosition(onSuccess, onError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  });
} else {
  if (loadingEl) {
    loadingEl.innerText = 'Geolocation not supported.';
  }
}