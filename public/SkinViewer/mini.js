"use strict";
let started = false;
window.addEventListener('message', async event => {
  if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'skinforge:mini' || started) return;
  started = true;
  window.skinforgePreviewSkin = event.data.skin;
  window.skinforgePreviewSpecies = event.data.species;
  try {
    await import('./viewer.js');
  } catch {
    document.querySelector('#viewer-status').hidden = false;
    document.querySelector('#viewer-status').textContent = 'Preview unavailable. Try View / use skin to open the main viewer.';
  }
});
