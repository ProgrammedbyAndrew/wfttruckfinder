const thresholdFeet = 10; // Distance threshold to say "YOU ARE HERE"
const distanceEl = document.querySelector('#distance');
const loadingEl = document.querySelector('#loading');
const uiEl = document.querySelector('#ui');
const hereTextEl = document.querySelector('#hereText');
const targetEl = document.querySelector('#target');

let atLocation = false;

// Poll every second to update distance and UI
const intervalId = setInterval(() => {
  // If AR.js hasn't placed the entity or got user location yet, distance might be null.
  const distanceMeters = targetEl.components['gps-entity-place'] && targetEl.components['gps-entity-place'].distance;

  if (!distanceMeters) {
    // Distance not yet available; could be because user denied permission or it's still loading.
    // If too long passes, consider showing a permission error.
    return;
  }

  // Once we have a distance, show UI, hide loading
  if (loadingEl) loadingEl.style.display = 'none';
  if (uiEl && uiEl.style.display === 'none') uiEl.style.display = 'block';

  const distanceFeet = distanceMeters * 3.28084;
  distanceEl.textContent = distanceFeet.toFixed(0);

  // Check if user is at the location
  if (!atLocation && distanceFeet <= thresholdFeet) {
    atLocation = true;
    targetEl.setAttribute('visible', 'false');
    hereTextEl.setAttribute('visible', 'true');

    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
  } else if (atLocation && distanceFeet > thresholdFeet) {
    // If user moves away again
    atLocation = false;
    targetEl.setAttribute('visible', 'true');
    hereTextEl.setAttribute('visible', 'false');
  }
}, 1000);

// Listen for geolocation errors from AR.js
document.addEventListener('gps-camera-error', (e) => {
  if (loadingEl) {
    loadingEl.textContent = 'Failed to get GPS or camera. Check permissions or try again.';
  }
});