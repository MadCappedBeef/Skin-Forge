"use strict";
if (location.protocol === "file:") {
  document.querySelector("#viewer-status").textContent = "Open the hosted website or run Start SkinForge.bat to use the local preview.";
} else {
  import("./viewer.js").catch(error => {
    console.error("3D viewer could not start:", error);
    document.querySelector("#viewer-status").textContent = "3D viewer could not start. Reload the page and check that your browser supports WebGL 2.";
  });
}
