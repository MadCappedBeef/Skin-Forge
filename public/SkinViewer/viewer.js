import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PSKLoader } from './PSKLoader.mjs';

const catalogResponse = await fetch(new URL('./catalog.json', import.meta.url));
if (!catalogResponse.ok) throw new Error('Could not load the exported asset catalog.');
const { species } = await catalogResponse.json();
const stage = document.querySelector('#viewer-stage');
const status = document.querySelector('#viewer-status');
const note = document.querySelector('#viewer-note');
const releaseNotice = document.querySelector('#viewer-release-notice');
const select = document.querySelector('#viewer-species');
const reset = document.querySelector('#viewer-reset');
const rotate = document.querySelector('#viewer-rotate');
const age = document.querySelector('#viewer-age');
const brightness = document.querySelector('#viewer-brightness');
const brightnessValue = document.querySelector('#viewer-brightness-value');
document.querySelector('#viewer-count').textContent = `${species.filter(entry => entry.model).length} MODELS`;
for (const { id, name, model, releaseStatus } of species) {
  const label = releaseStatus === 'unreleased' ? ' — Unreleased' : '';
  const option = new Option(name + label + (!model ? ' — model missing' : ''), id);
  option.disabled = !model;
  select.add(option);
}
try { select.value = localStorage.getItem('skinforge.viewer.species') || 'carno'; } catch { select.value = 'carno'; }
if (!select.value || select.selectedOptions[0].disabled) select.value = 'carno';
function updateReleaseNotice() {
  const entry = species.find(entry => entry.id === select.value);
  releaseNotice.textContent = entry?.releaseStatus === 'unreleased'
    ? `${entry.name} is not yet released as a playable species in public Evrima. You can preview its assets here, but it cannot currently be selected in-game.`
    : '';
  releaseNotice.hidden = !releaseNotice.textContent;
}
updateReleaseNotice();
select.addEventListener('change', updateReleaseNotice);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
stage.prepend(renderer.domElement);
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('aria-label', 'Dinosaur model. Use arrow keys to orbit, plus and minus to zoom, and Home to reset.');
const scene = new THREE.Scene();
const ambient = new THREE.HemisphereLight(0xd9f5ff, 0x6e6558, 0.75);
scene.add(ambient);
const key = new THREE.DirectionalLight(0xffe9d2, 0.9);
key.position.set(3, 5, 4);
scene.add(key);
const rim = new THREE.DirectionalLight(0x72dbc9, 0.6);
rim.position.set(-3, 3, -4);
scene.add(rim);
// A new preference version resets older browsers once to the dimmer baseline.
const BRIGHTNESS_STORAGE_KEY = 'skinforge.viewer.brightness.v2';
brightness.value = '100';
try {
  const saved = localStorage.getItem(BRIGHTNESS_STORAGE_KEY);
  const value = Number(saved);
  if (saved !== null && Number.isFinite(value) && value >= 0 && value <= 120) brightness.value = String(value);
  localStorage.setItem(BRIGHTNESS_STORAGE_KEY, brightness.value);
} catch { /* Optional preference. */ }
function updateBrightness() {
  const percent = Number(brightness.value);
  const strength = percent / 100;
  ambient.intensity = 0.75 * strength;
  key.intensity = 0.9 * strength;
  rim.intensity = 0.6 * strength;
  brightnessValue.value = `${percent}%`;
  brightness.setAttribute('aria-valuetext', `${percent} percent`);
}
updateBrightness();
brightness.addEventListener('input', () => {
  updateBrightness();
  try { localStorage.setItem(BRIGHTNESS_STORAGE_KEY, brightness.value); } catch { /* Optional preference. */ }
});
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotateSpeed = 1;
controls.minDistance = 0.5;
controls.maxDistance = 15;
const loader = new PSKLoader();
const textures = new THREE.TextureLoader();
const assetURL = file => new URL('../' + file, import.meta.url).href;
async function loadTexture(file) {
  if (!file) return null;
  const texture = await textures.loadAsync(assetURL(file));
  // The exports include very large source PNGs. Bound GPU memory while retaining
  // their source files untouched for future high-resolution exports.
  const limit = Math.min(2048, renderer.capabilities.maxTextureSize);
  const { width, height } = texture.image;
  if (width > limit || height > limit) {
    const canvas = document.createElement('canvas');
    const ratio = limit / Math.max(width, height);
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    canvas.getContext('2d').drawImage(texture.image, 0, 0, canvas.width, canvas.height);
    texture.image = canvas;
  }
  texture.flipY = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}
let active = null;
let generation = 0;
let skin = window.skinforgePreviewSkin;
let visible = true;
let contextLost = false;

function resetView() {
  controls.target.set(0, 0, 0);
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const direction = new THREE.Vector3(1.8, 0.45, 1).normalize();
  const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right);
  let distance = 5;
  if (active) {
    const box = new THREE.Box3().setFromObject(active.root);
    distance = 0;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const corner = new THREE.Vector3(x, y, z);
      distance = Math.max(distance, corner.dot(direction) + 1.2 * Math.max(
        Math.abs(corner.dot(right)) / (Math.tan(halfFov) * camera.aspect),
        Math.abs(corner.dot(up)) / Math.tan(halfFov)
      ));
    }
  }
  camera.position.copy(direction).multiplyScalar(distance);
  controls.update();
}
new ResizeObserver(() => {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  if (active) resetView();
  renderer.render(scene, camera);
}).observe(stage);
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  if (visible && !contextLost) renderer.render(scene, camera);
}).observe(stage);
renderer.setAnimationLoop(() => {
  if (!visible || document.hidden || contextLost) return;
  controls.update();
  renderer.render(scene, camera);
});
renderer.domElement.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  contextLost = true;
  status.hidden = false;
  status.textContent = 'Graphics context lost. Reload the page to restore the viewer.';
});

const fields = ['BodyColor', 'FlankColor', 'MarkingsColor', 'UnderbellyColor', 'Detail1Color',
  'MaleDisplayColor', 'TeethColor', 'MouthColor', 'ClawsColor'];
function colour(field) {
  const value = skin[field];
  return new THREE.Color().setRGB(...['R', 'G', 'B'].map(c => THREE.MathUtils.clamp(value[c], 0, 1)));
}

// These textures are packed region masks, not colour photographs. The original
// game shader is not supplied; interpolate the RGB cube's region colours as an
// explicit approximation, preserving soft transitions in the compressed masks.
function bodyMaterial(pattern, normal, mask, packed, maskEncoding, colourMapping) {
  const material = new THREE.MeshStandardMaterial({ map: pattern, normalMap: normal, roughness: 0.82 });
  if (!packed) {
    if (pattern) pattern.colorSpace = THREE.SRGBColorSpace;
    material.userData.legacy = true;
    material.color.copy(colour('BodyColor'));
    return material;
  }
  material.normalScale.set(1, -1);
  const uniforms = Object.fromEntries(fields.map(field => [field, { value: colour(field) }]));
  uniforms.MaleDisplayColor.value.copy(colour(skin.bIsFemale ? 'BodyColor' : 'MaleDisplayColor'));
  uniforms.tmc = { value: mask || pattern };
  uniforms.hasTmc = { value: Boolean(mask) };
  uniforms.exclusiveTmc = { value: maskEncoding === 'rgb-regions' };
  uniforms.stegoPattern = { value: colourMapping === 'stegosaurus' };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = fields.map(f => `uniform vec3 ${f};`).join('\n') +
      '\nuniform sampler2D tmc;\nuniform bool hasTmc;\nuniform bool exclusiveTmc;\nuniform bool stegoPattern;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec3 p = texture2D(map, vMapUv).rgb;
      vec3 low = mix(mix(Detail1Color, MaleDisplayColor, p.r), mix(BodyColor, Detail1Color, p.r), p.g);
      vec3 high = mix(mix(MarkingsColor, FlankColor, p.r), mix(UnderbellyColor, Detail1Color, p.r), p.g);
      vec3 skinColour = mix(low, high, p.b);
      if (stegoPattern) {
        // Stego's reference: red display, green belly, blue flank,
        // cyan body, magenta markings, yellow detail. Darker mask pixels
        // retain surface shading instead of mixing unrelated colour layers.
        float shade = max(p.r, max(p.g, p.b));
        vec3 region = p / max(shade, 0.00001);
        vec3 lower = mix(mix(Detail1Color, MaleDisplayColor, region.r),
                         mix(UnderbellyColor, Detail1Color, region.r), region.g);
        vec3 upper = mix(mix(FlankColor, MarkingsColor, region.r),
                         mix(BodyColor, Detail1Color, region.r), region.g);
        skinColour = mix(lower, upper, region.b) * shade;
      }
      if (hasTmc) {
        vec3 m = texture2D(tmc, vMapUv).rgb;
        // Some species mark body regions magenta/cyan, alongside RGB teeth/mouth/claws.
        // Decode exclusive regions so overlapping channels do not overwrite skin.
        if (exclusiveTmc) m = vec3(m.r * (1.0 - m.g) * (1.0 - m.b),
                                 m.g * (1.0 - m.r) * (1.0 - m.b),
                                 m.b * (1.0 - m.r) * (1.0 - m.g));
        skinColour = mix(skinColour, TeethColor, m.r);
        skinColour = mix(skinColour, MouthColor, m.g);
        skinColour = mix(skinColour, ClawsColor, m.b);
      }
      diffuseColor.rgb *= skinColour;
    `);
  };
  material.userData.uniforms = uniforms;
  return material;
}

function updateSkin() {
  if (!active || !skin) return;
  for (const material of active.materials) {
    const uniforms = material.userData.uniforms;
    if (uniforms) {
      for (const field of fields) uniforms[field].value.copy(colour(field));
      uniforms.MaleDisplayColor.value.copy(colour(skin.bIsFemale ? 'BodyColor' : 'MaleDisplayColor'));
    } else material.color.copy(colour(material.userData.legacy ? 'BodyColor' : 'EyesColor'));
  }
  const unsupported = patternIndex(active.entry) !== skin.PatternIndex;
  const glitch = [...fields, 'EyesColor'].some(f => ['R', 'G', 'B'].some(c => skin[f][c] < 0 || skin[f][c] > 1));
  note.textContent = (age.value !== 'adult' ? `${age.selectedOptions[0].textContent} on adult geometry; growth proportions are unavailable. ` : '') +
    'Approximate colour preview. Skin variation and game glitch effects are not simulated.' +
    (unsupported ? ' This pattern index is unavailable; showing pattern 0.' : '') +
    (glitch ? ' Preview colours are clamped to 0–1; exported values are unchanged.' : '') +
    (!active.entry.mask ? ' This species has no teeth/mouth/claw mask.' : '') +
    (!active.entry.packed ? ' Legacy skin: only body tint and eye colour are previewed.' : '');
  const target = patternPath(active.entry);
  if (target === active.patternPath && active.pendingPattern !== undefined) {
    active.patternGeneration++;
    active.pendingPattern = undefined;
    stage.setAttribute('aria-busy', 'false');
  } else if (target !== active.patternPath && target !== active.pendingPattern) updatePattern(target);
}
function patternIndex(entry) {
  return Number.isInteger(skin.PatternIndex) && skin.PatternIndex >= 0 && skin.PatternIndex < entry.patterns.length ? skin.PatternIndex : 0;
}
function patternPath(entry) {
  return (age.value !== 'adult' && entry[age.value]) || entry.patterns[patternIndex(entry)] || null;
}
async function updatePattern(target) {
  const bundle = active;
  const request = ++bundle.patternGeneration;
  bundle.pendingPattern = target;
  stage.setAttribute('aria-busy', 'true');
  try {
    const texture = await loadTexture(target);
    if (active !== bundle || request !== bundle.patternGeneration) { texture?.dispose(); return; }
    bundle.body.map?.dispose();
    bundle.body.map = texture;
    if (!bundle.entry.packed && texture) texture.colorSpace = THREE.SRGBColorSpace;
    if (bundle.body.userData.uniforms && !bundle.entry.mask) bundle.body.userData.uniforms.tmc.value = texture;
    bundle.patternPath = target;
    bundle.pendingPattern = undefined;
    bundle.body.needsUpdate = true;
    status.hidden = true;
    stage.setAttribute('aria-busy', 'false');
    updateSkin();
  } catch (error) {
    if (active !== bundle || request !== bundle.patternGeneration) return;
    bundle.pendingPattern = undefined;
    stage.setAttribute('aria-busy', 'false');
    showFailure(`Could not load the selected skin texture.`, error);
  }
}
function disposeModel(root) {
  const materials = new Set();
  root.traverse(object => {
    object.geometry?.dispose();
    if (object.material) for (const material of [].concat(object.material)) materials.add(material);
  });
  materials.forEach(material => material.dispose());
}
function dispose(bundle) {
  scene.remove(bundle.root);
  disposeModel(bundle.root);
  bundle.patternGeneration++;
  bundle.body.map?.dispose();
  bundle.textures.filter(Boolean).forEach(texture => texture.dispose());
}
function showFailure(message, error) {
  console.error(message, error);
  status.hidden = false;
  status.textContent = message;
  const retry = document.createElement('button');
  retry.className = 'button button-quiet';
  retry.textContent = 'Retry';
  retry.onclick = loadSpecies;
  status.append(' ', retry);
}
async function loadSpecies() {
  const request = ++generation;
  const id = select.value;
  const entry = species.find(entry => entry.id === id);
  const name = entry.name;
  status.hidden = false;
  status.textContent = `Loading ${name}…`;
  stage.setAttribute('aria-busy', 'true');
  reset.disabled = rotate.disabled = true;
  if (active) { dispose(active); active = null; }
  for (const option of age.options) option.disabled = option.value !== 'adult' && !entry[option.value];
  if (age.selectedOptions[0].disabled) age.value = 'adult';
  age.disabled = true;
  const initialPattern = patternPath(entry);
  const results = await Promise.allSettled([
    loader.loadAsync(assetURL(entry.model)),
    ...[initialPattern, entry.normal, entry.mask].map(loadTexture)
  ]);
  if (request !== generation || results.some(result => result.status === 'rejected')) {
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        if (i === 0) disposeModel(result.value.scene); else result.value?.dispose();
      }
    });
    if (request === generation) {
      showFailure(`Could not load ${name}. Check the exported files, then choose another species or retry.`, results.find(result => result.status === 'rejected')?.reason);
      stage.setAttribute('aria-busy', 'false');
    }
    return;
  }
  const [gltf, ...maps] = results.map(result => result.value);
  const body = bodyMaterial(maps[0], maps[1], maps[2], entry.packed, entry.maskEncoding, entry.colourMapping);
  const eyes = new THREE.MeshStandardMaterial({ color: colour('EyesColor'), roughness: 0.3 });
  const originals = new Set();
  gltf.scene.traverse(object => {
    if (!object.isMesh) return;
    object.material = [].concat(object.material).map(original => {
      originals.add(original);
      return /eye/i.test(original.name) ? eyes : body;
    });
  });
  originals.forEach(material => material.dispose());
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const scale = 3 / Math.max(size.x, size.y, size.z);
  // Wrap the asset so its original node transforms stay intact.
  const root = new THREE.Group();
  root.add(gltf.scene);
  gltf.scene.position.sub(center);
  root.scale.setScalar(scale);
  active = { id, entry, root, body, textures: maps.slice(1), materials: [body, eyes],
    patternPath: initialPattern, patternGeneration: 0, pendingPattern: undefined };
  scene.add(root);
  updateSkin();
  resetView();
  status.hidden = true;
  stage.setAttribute('aria-busy', String(active.pendingPattern !== undefined));
  reset.disabled = rotate.disabled = false;
  age.disabled = false;
  try { localStorage.setItem('skinforge.viewer.species', id); } catch { /* Optional preference. */ }
}
window.addEventListener('skinforge:skin-change', event => { skin = event.detail; updateSkin(); });
select.disabled = false;
select.addEventListener('change', loadSpecies);
age.addEventListener('change', () => {
  if (active) {
    // Invalidate an in-flight pattern change even when returning to the current map.
    active.patternGeneration++;
    active.pendingPattern = undefined;
    stage.setAttribute('aria-busy', 'false');
    updateSkin();
  }
});
reset.addEventListener('click', resetView);
rotate.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  rotate.setAttribute('aria-pressed', String(controls.autoRotate));
});
renderer.domElement.addEventListener('keydown', event => {
  const delta = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(delta);
  switch (event.key) {
    case 'ArrowLeft': spherical.theta -= 0.12; break;
    case 'ArrowRight': spherical.theta += 0.12; break;
    case 'ArrowUp': spherical.phi -= 0.12; break;
    case 'ArrowDown': spherical.phi += 0.12; break;
    case '+': case '=': spherical.radius *= 0.9; break;
    case '-': spherical.radius *= 1.1; break;
    case 'Home': event.preventDefault(); resetView(); return;
    default: return;
  }
  event.preventDefault();
  spherical.makeSafe();
  spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
  controls.update();
});
await loadSpecies();
