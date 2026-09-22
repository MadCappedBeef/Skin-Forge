"use strict";

const STORAGE_KEYS = {
  current: "skinforge.current.v1",
  presets: "skinforge.presets.v1",
  name: "skinforge.name.v1",
  locks: "skinforge.colour-locks.v1",
  theme: "skinforge.random-theme.v1"
};

const DEFAULT_SKIN = {
  bIsFemale: false,
  SkinVariation: 0,
  PatternIndex: 0,
  MaleDisplayColor: { R: 0.6, G: 0.6, B: 0.6, A: 1 },
  MarkingsColor: { R: 0.2, G: 0.2, B: 0.2, A: 1 },
  BodyColor: { R: 0.55, G: 0.4, B: 0.3, A: 1 },
  FlankColor: { R: 0.45, G: 0.35, B: 0.25, A: 1 },
  UnderbellyColor: { R: 0.75, G: 0.7, B: 0.6, A: 1 },
  Detail1Color: { R: 0.3, G: 0.2, B: 0.15, A: 1 },
  EyesColor: { R: 0.9, G: 0.8, B: 0.1, A: 1 },
  TeethColor: { R: 0.9, G: 0.88, B: 0.78, A: 1 },
  MouthColor: { R: 0.55, G: 0.25, B: 0.25, A: 1 },
  ClawsColor: { R: 0.25, G: 0.23, B: 0.2, A: 1 }
};

const COLOUR_FIELDS = [
  { key: "MaleDisplayColor", label: "Male display", code: "MD", group: "Surface" },
  { key: "MarkingsColor", label: "Markings", code: "M", group: "Surface" },
  { key: "BodyColor", label: "Body", code: "B", group: "Surface" },
  { key: "FlankColor", label: "Flank", code: "F", group: "Surface" },
  { key: "UnderbellyColor", label: "Underbelly", code: "U", group: "Surface" },
  { key: "Detail1Color", label: "Detail 1", code: "D1", group: "Surface" },
  { key: "EyesColor", label: "Eyes", code: "E", group: "Detail" },
  { key: "TeethColor", label: "Teeth", code: "T", group: "Detail" },
  { key: "MouthColor", label: "Mouth", code: "MO", group: "Detail" },
  { key: "ClawsColor", label: "Claws", code: "C", group: "Detail" }
];

const CHANNELS = ["R", "G", "B", "A"];
const RGB_CHANNELS = ["R", "G", "B"];

const RANDOM_THEMES = {
  any: { label: "Any colours", colours: [], description: "Unrestricted random RGB colours." },
  rock: { label: "Rock", colours: ["#252729", "#41413f", "#595851", "#747067", "#8c8a81"], description: "Slate, stone grey and weathered taupe." },
  bush: { label: "Bush", colours: ["#1e2a17", "#33421f", "#50572e", "#64633c", "#493b2a"], description: "Leaf green, olive and woody brown." },
  forest: { label: "Forest", colours: ["#121f1a", "#203123", "#37422b", "#322a1f", "#544b36"], description: "Deep greens, moss and dark bark." },
  desert: { label: "Desert", colours: ["#513b29", "#6f5436", "#856f4a", "#988560", "#a2967b"], description: "Sand, sandstone and dusty brown." },
  sand: { label: "Sand", colours: ["#71644f", "#86785e", "#968a6f", "#a29882", "#aba494"], description: "Soft beige, pale dunes and warm cream." },
  green: { label: "Green", colours: ["#1a351f", "#2c492e", "#3e5d36", "#526d40", "#6b7e52"], description: "A full palette of muted fresh greens." },
  jungle: { label: "Jungle", colours: ["#0e2119", "#1a361f", "#2c4b25", "#475c2c", "#363523"], description: "Dense tropical greens, shaded foliage and earthy olive." },
  highlands: { label: "Highlands", colours: ["#363630", "#4e4d41", "#605e4d", "#56513c", "#797463"], description: "Weathered stone, muted moss and dry upland grass." },
  plains: { label: "Plains", colours: ["#474127", "#605d36", "#766e41", "#847850", "#958b68"], description: "Grassland olive, golden grasses and straw." },
  swamp: { label: "Swamp", colours: ["#1d211a", "#333623", "#474730", "#544a36", "#685e4b"], description: "Murky olive, reeds and mud." },
  snow: { label: "Snow", colours: ["#474f56", "#656f73", "#848c8e", "#9aa1a1", "#abada9"], description: "Cool greys and snowy off-whites." },
  autumn: { label: "Autumn", colours: ["#35291d", "#523a29", "#6d472d", "#7f5e34", "#635d3c"], description: "Fallen leaves, rusty brown and muted ochre." }
};

function selectedRandomTheme() {
  return RANDOM_THEMES[document.querySelector("#random-theme").value] || RANDOM_THEMES.any;
}

function updateRandomTheme(value) {
  const key = Object.hasOwn(RANDOM_THEMES, value) ? value : "any";
  for (const select of document.querySelectorAll("[data-random-theme]")) select.value = key;
  const theme = RANDOM_THEMES[key];
  document.querySelector("#random-theme-description").textContent = `${theme.description} Both Random colours buttons use this theme. Changing the theme does not change your skin until you randomise.`;
  const swatches = document.querySelector("#random-theme-swatches");
  swatches.replaceChildren();
  for (const colour of theme.colours) {
    const swatch = document.createElement("span");
    swatch.style.backgroundColor = colour;
    swatches.append(swatch);
  }
}

function randomThemeColour(theme, random = Math.random) {
  if (!theme.colours.length) return Object.fromEntries(RGB_CHANNELS.map(channel => [channel, Math.floor(random() * 101) / 100]));
  const pick = () => theme.colours[Math.floor(random() * theme.colours.length)];
  const first = pick(), second = pick(), blend = random();
  return Object.fromEntries(RGB_CHANNELS.map((channel, index) => {
    const offset = 1 + index * 2;
    const a = parseInt(first.slice(offset, offset + 2), 16) / 255;
    const b = parseInt(second.slice(offset, offset + 2), 16) / 255;
    return [channel, Math.round((a + (b - a) * blend) * 10000) / 10000];
  }));
}

const GLITCH_MODES = {
  positive: { active: 100000, quiet: 10 },
  negative: { active: -10, quiet: -100000 },
  positiveBleed: { active: 1000000000000, quiet: 0 },
  negativeBleed: { active: -10, quiet: -1000000000000 },
  outline: { active: -1000, quiet: -1000 }
};

const GLITCH_COLOURS = {
  red: ["R"],
  green: ["G"],
  blue: ["B"],
  cyan: ["G", "B"],
  magenta: ["R", "B"],
  yellow: ["R", "G"],
  white: ["R", "G", "B"]
};

const elements = {
  viewerGlitchWarning: document.querySelector("#viewer-glitch-warning"),
  grid: document.querySelector("#colour-grid"),
  template: document.querySelector("#colour-card-template"),
  output: document.querySelector("#json-output"),
  validity: document.querySelector("#json-validity"),
  charCount: document.querySelector("#character-count"),
  sex: [...document.querySelectorAll('input[name="sex"]')],
  variation: document.querySelector("#skin-variation"),
  pattern: document.querySelector("#pattern-index"),
  skinName: document.querySelector("#skin-name"),
  saveStatus: document.querySelector("#save-status"),
  savedList: document.querySelector("#saved-list"),
  fileInput: document.querySelector("#file-input"),
  labTarget: document.querySelector("#lab-target"),
  labMode: document.querySelector("#lab-mode"),
  labColour: document.querySelector("#lab-colour"),
  labActive: document.querySelector("#lab-active"),
  labQuiet: document.querySelector("#lab-quiet"),
  dropZone: document.querySelector("#drop-zone"),
  toastRegion: document.querySelector("#toast-region"),
  undo: document.querySelector("#undo-button"),
  redo: document.querySelector("#redo-button")
};

let skin = loadStoredSkin();
let savedPresets = loadSavedPresets();
const lockedColours = loadColourLocks();
let history = [];
let future = [];
let saveTimer;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadStoredSkin() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.current);
    return stored ? normaliseSkin(JSON.parse(stored)) : deepClone(DEFAULT_SKIN);
  } catch {
    return deepClone(DEFAULT_SKIN);
  }
}

function loadSavedPresets() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.presets) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function loadColourLocks() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.locks) || "[]");
    return new Set(Array.isArray(stored) ? stored.filter(key => COLOUR_FIELDS.some(field => field.key === key)) : []);
  } catch {
    return new Set();
  }
}

function updateLockControls() {
  for (const field of COLOUR_FIELDS) {
    const button = elements.grid.querySelector(`.colour-lock[data-field="${field.key}"]`);
    const locked = lockedColours.has(field.key);
    button.setAttribute("aria-pressed", String(locked));
    button.textContent = locked ? "Locked" : "Lock";
    button.title = locked ? "Unlock to include in random colours" : "Lock to keep this colour when randomising";
  }
  const allLocked = lockedColours.size === COLOUR_FIELDS.length;
  for (const id of ["random-button", "random-output-button"]) {
    const button = document.getElementById(id);
    button.disabled = allLocked;
    button.title = allLocked ? "Unlock a skin colour to randomise" : "Randomise unlocked skin colours";
  }
}

function finiteNumber(value, fallback, label) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number.`);
  return parsed ?? fallback;
}

function normaliseSkin(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("The JSON root must be an object.");
  }
  const next = deepClone(input);
  next.bIsFemale = typeof input.bIsFemale === "boolean" ? input.bIsFemale : DEFAULT_SKIN.bIsFemale;
  next.SkinVariation = finiteNumber(input.SkinVariation ?? DEFAULT_SKIN.SkinVariation, 0, "SkinVariation");
  next.PatternIndex = finiteNumber(input.PatternIndex ?? DEFAULT_SKIN.PatternIndex, 0, "PatternIndex");
  for (const field of COLOUR_FIELDS) {
    const source = input[field.key] && typeof input[field.key] === "object" ? input[field.key] : {};
    next[field.key] = {};
    for (const channel of CHANNELS) {
      next[field.key][channel] = finiteNumber(
            source[channel] ?? DEFAULT_SKIN[field.key][channel],
            DEFAULT_SKIN[field.key][channel],
            `${field.key}.${channel}`
          );
    }
  }
  return next;
}

function canonicalSkin(value) {
  const ordered = {
    bIsFemale: value.bIsFemale,
    SkinVariation: value.SkinVariation,
    PatternIndex: value.PatternIndex
  };
  for (const field of COLOUR_FIELDS) ordered[field.key] = value[field.key];
  for (const [key, extra] of Object.entries(value)) {
    if (!(key in ordered)) ordered[key] = extra;
  }
  return ordered;
}

function formatJSON(value = skin) {
  return JSON.stringify(window.SkinForgeFormats.encode(canonicalSkin(value)), null, 2);
}

function cleanPastedText(text) {
  return text
    .replace(/&#x20;/gi, " ")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&amp;/gi, "&")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

function changeSkinServer(id) {
  const formats = window.SkinForgeFormats;
  if (id === formats.selected.id) return;
  const hasDraft = elements.output.value !== formatJSON();
  const next = hasDraft
    ? normaliseSkin(formats.decode(JSON.parse(cleanPastedText(elements.output.value))))
    : snapshot();
  const output = JSON.stringify(formats.encode(canonicalSkin(next), id), null, 2);
  if (typeof output !== 'string') throw Error('This server could not export the current skin.');
  formats.select(id);
  if (hasDraft) commit(next);
  elements.output.value = output;
  renderOutput();
  toast('Skin output converted for ' + formats.selected.name + '. Saved skins will use this format when loaded.');
}

function snapshot() {
  return deepClone(skin);
}

function commit(next, message) {
  history.push(snapshot());
  if (history.length > 60) history.shift();
  future = [];
  skin = normaliseSkin(next);
  syncAll();
  if (message) toast(message);
}

function softUpdate() {
  renderOutput();
  updateAllCardVisuals();
  scheduleSave();
}

function scheduleSave() {
  elements.saveStatus.textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEYS.current, JSON.stringify(skin));
    localStorage.setItem(STORAGE_KEYS.name, elements.skinName.value.trim() || "Untitled skin");
    elements.saveStatus.textContent = "Saved locally";
  }, 180);
}

function renderOutput() {
  elements.viewerGlitchWarning.hidden = !COLOUR_FIELDS.some(({ key }) =>
    CHANNELS.some(channel => skin[key][channel] < 0 || skin[key][channel] > 1)
  );
  document.querySelector("#unglitch-button").disabled = elements.viewerGlitchWarning.hidden;
  window.skinforgePreviewSkin = snapshot();
  window.dispatchEvent(new CustomEvent("skinforge:skin-change", { detail: window.skinforgePreviewSkin }));
  const value = formatJSON();
  if (document.activeElement !== elements.output) elements.output.value = value;
  validateOutput();
  updateHistoryButtons();
}

function setValidity(valid, message, detail = "") {
  elements.validity.className = `validity ${valid ? "valid" : "invalid"}`;
  elements.validity.innerHTML = `<i></i>${escapeHTML(message)}`;
  const explanation = document.querySelector("#json-error");
  explanation.textContent = detail;
  explanation.hidden = !detail;
  elements.output.setAttribute("aria-invalid", String(!valid));
}

function describeJSONError(error, text) {
  if (!cleanPastedText(text)) return "The JSON is empty. Paste a skin JSON object or open a JSON file.";
  if (!(error instanceof SyntaxError)) return error.message || "The skin could not be loaded.";
  let message = error.message;
  const position = message.match(/position\s+(\d+)/i);
  if (position && !/line\s+\d+/i.test(message)) {
    const before = cleanPastedText(text).slice(0, Number(position[1]));
    const lines = before.split("\n");
    message += ` (line ${lines.length}, column ${lines.at(-1).length + 1})`;
  }
  return `JSON syntax error: ${message}\nCheck for missing or extra commas, double quotes, and matching { } or [ ]. Locations refer to the JSON after removing pasted code fences or HTML escapes.`;
}

function validateOutput() {
  elements.charCount.textContent = `${elements.output.value.length.toLocaleString()} characters`;
  try {
    normaliseSkin(window.SkinForgeFormats.decode(JSON.parse(cleanPastedText(elements.output.value))));
    setValidity(true, "Valid");
  } catch (error) {
    setValidity(false, "Invalid", describeJSONError(error, elements.output.value));
  }
}

function renderColourCards() {
  elements.grid.replaceChildren();
  for (const field of COLOUR_FIELDS) {
    const fragment = elements.template.content.cloneNode(true);
    const card = fragment.querySelector(".colour-card");
    card.dataset.field = field.key;
    fragment.querySelector("h3").textContent = field.label;
    fragment.querySelector(".colour-title code").textContent = `${field.key} · ${field.code}`;
    const channelGrid = fragment.querySelector(".channel-grid");
    for (const channel of CHANNELS) {
      const label = document.createElement("label");
      label.className = "channel-input";
      label.innerHTML = `<span>${channel}</span><input type="number" step="any" data-field="${field.key}" data-channel="${channel}" aria-label="${field.label} ${channel}">`;
      channelGrid.append(label);
    }
    fragment.querySelector(".colour-picker").dataset.field = field.key;
    fragment.querySelector(".reset-colour").dataset.field = field.key;
    const lock = fragment.querySelector(".colour-lock");
    lock.dataset.field = field.key;
    lock.setAttribute("aria-label", `Lock ${field.label} colour during randomisation`);
    elements.grid.append(fragment);
  }
  updateLockControls();
}

function syncInputs() {
  elements.sex.find(input => input.value === (skin.bIsFemale ? "female" : "male")).checked = true;
  elements.variation.value = skin.SkinVariation;
  elements.pattern.value = skin.PatternIndex;
  for (const field of COLOUR_FIELDS) {
    for (const channel of CHANNELS) {
      const input = elements.grid.querySelector(`[data-field="${field.key}"][data-channel="${channel}"]`);
      input.value = skin[field.key][channel];
    }
  }
  updateAllCardVisuals();
}

function updateAllCardVisuals() {
  for (const field of COLOUR_FIELDS) updateCardVisual(field.key);
}

function updateCardVisual(key) {
  const card = elements.grid.querySelector(`.colour-card[data-field="${key}"]`);
  if (!card) return;
  const value = skin[key];
  const glitch = CHANNELS.some(channel => value[channel] < 0 || value[channel] > 1);
  const hex = rgbToHex(value.R, value.G, value.B);
  card.classList.toggle("is-glitch", glitch);
  card.querySelector(".value-state").textContent = glitch ? "GLITCH" : "NORMAL";
  card.querySelector(".swatch").style.backgroundColor = hex;
  card.querySelector(".colour-picker").value = hex;
  card.querySelector(".rgb-readout").textContent = `RGB ${numberLabel(value.R)} · ${numberLabel(value.G)} · ${numberLabel(value.B)}`;
}

function numberLabel(value) {
  if (Math.abs(value) >= 1000000) return value.toExponential(1);
  return String(value);
}

function rgbToHex(r, g, b) {
  const toHex = value => Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRGB(hex) {
  return {
    R: parseInt(hex.slice(1, 3), 16) / 255,
    G: parseInt(hex.slice(3, 5), 16) / 255,
    B: parseInt(hex.slice(5, 7), 16) / 255
  };
}

function renderSavedPresets() {
  elements.savedList.replaceChildren();
  if (!savedPresets.length) {
    const empty = document.createElement("div");
    empty.className = "empty-saved";
    empty.textContent = "No saved skins yet.";
    elements.savedList.append(empty);
    return;
  }
  for (const item of savedPresets) {
    const row = document.createElement("div");
    row.className = "saved-item";
    row.dataset.saved = item.id;
    const glitched = COLOUR_FIELDS.some(({ key }) => CHANNELS.some(channel => {
      const value = item.skin?.[key]?.[channel];
      return typeof value === "number" && (value < 0 || value > 1);
    }));
    row.tabIndex = 0;
    row.role = "button";
    row.innerHTML = `
      <span class="saved-glyph">S</span>
      <span><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.date || "Local preset")}</small>${glitched ? '<span class="community-glitch-badge saved-glitch-badge" title="Contains colour values outside 0-1. View in-game to see glitch effects.">Glitched</span>' : '<span class="community-glitch-badge saved-glitch-badge non-glitched-badge" title="All colour values are within 0-1.">Non-glitched</span>'}</span>
      <button class="delete-saved" type="button" data-delete="${escapeHTML(item.id)}" aria-label="Delete ${escapeHTML(item.name)}">×</button>`;
    elements.savedList.append(row);
  }
}

function saveCurrentPreset() {
  const fallback = elements.skinName.value.trim() || `Skin ${savedPresets.length + 1}`;
  const name = window.prompt("Name this saved skin:", fallback);
  if (!name || !name.trim()) return;
  savedPresets.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name.trim(),
    date: new Date().toLocaleDateString(),
    skin: snapshot()
  });
  localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(savedPresets));
  renderSavedPresets();
  toast(`Saved “${name.trim()}” to your library.`);
}

function deleteSaved(id) {
  savedPresets = savedPresets.filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(savedPresets));
  renderSavedPresets();
  toast("Saved skin removed.");
}

function renderLabTargets() {
  elements.labTarget.innerHTML = COLOUR_FIELDS
    .map(field => `<option value="${field.key}"${field.key === "FlankColor" ? " selected" : ""}>${field.label} (${field.code})</option>`)
    .join("");
}

function setLabDefaults() {
  const mode = GLITCH_MODES[elements.labMode.value];
  elements.labActive.value = mode.active;
  elements.labQuiet.value = mode.quiet;
  const outline = elements.labMode.value === "outline";
  elements.labColour.disabled = outline;
  elements.labActive.disabled = outline;
  elements.labQuiet.disabled = outline;
}

function applyLabGlitch() {
  const key = elements.labTarget.value;
  const modeName = elements.labMode.value;
  const active = modeName === "outline" ? -1000 : Number(elements.labActive.value);
  const quiet = modeName === "outline" ? -1000 : Number(elements.labQuiet.value);
  if (!Number.isFinite(active) || !Number.isFinite(quiet)) {
    toast("Active and quiet values must be valid numbers.", true);
    return;
  }
  const activeChannels = GLITCH_COLOURS[elements.labColour.value];
  const next = snapshot();
  for (const channel of RGB_CHANNELS) next[key][channel] = activeChannels.includes(channel) ? active : quiet;
  commit(next, `Custom glitch applied to ${key}.`);
}

function syncAll() {
  syncInputs();
  renderOutput();
  scheduleSave();
}

function parseAndLoad(text, source = "JSON") {
  try {
    const parsed = JSON.parse(cleanPastedText(text));
    const next = normaliseSkin(window.SkinForgeFormats.decode(parsed));
    commit(next, `${source} loaded.`);
    return true;
  } catch (error) {
    elements.output.value = text;
    elements.charCount.textContent = `${text.length.toLocaleString()} characters`;
    setValidity(false, "Invalid", `${source}: ${describeJSONError(error, text)}`);
    toast(error.message || "That JSON could not be loaded.", true);
    return false;
  }
}

async function readFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    if (!parseAndLoad(text, file.name)) return;
    elements.skinName.value = file.name.replace(/\.json$/i, "") || "Imported skin";
    scheduleSave();
  } catch {
    toast("The selected file could not be read.", true);
  }
}

async function readFiles(fileList) {
  const files = [...fileList].filter(file => file.name.toLowerCase().endsWith(".json") || file.type === "application/json");
  if (!files.length) {
    toast("Choose one or more JSON files.", true);
    return;
  }
  if (files.length === 1) {
    await readFile(files[0]);
    return;
  }

  const imported = [];
  const rejected = [];
  for (const file of files) {
    let text;
    try {
      text = await file.text();
      const parsed = JSON.parse(cleanPastedText(text));
      imported.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: file.name.replace(/\.json$/i, "") || "Imported skin",
        date: new Date().toLocaleDateString(),
        skin: normaliseSkin(window.SkinForgeFormats.decode(parsed))
      });
    } catch (error) {
      rejected.push(`${file.name}: ${text === undefined ? "The file could not be read." : describeJSONError(error, text)}`);
    }
  }
  if (!imported.length) {
    setValidity(elements.output.getAttribute("aria-invalid") !== "true", elements.validity.textContent.trim(), `Files not imported:\n${rejected.join("\n\n")}`);
    toast("None of those files contained valid skin JSON.", true);
    return;
  }
  savedPresets = [...imported, ...savedPresets];
  localStorage.setItem(STORAGE_KEYS.presets, JSON.stringify(savedPresets));
  renderSavedPresets();
  elements.skinName.value = imported[0].name;
  commit(imported[0].skin);
  if (rejected.length) setValidity(true, "Valid", `Files not imported:\n${rejected.join("\n\n")}`);
  toast(`Imported ${imported.length} skin${imported.length === 1 ? "" : "s"} to your library${rejected.length ? `; ${rejected.length} skipped` : ""}.`);
}

async function copyOutput() {
  const text = formatJSON();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    elements.output.value = text;
    elements.output.select();
    document.execCommand("copy");
    window.getSelection()?.removeAllRanges();
  }
  toast("Skin JSON copied to clipboard.");
}

function downloadOutput() {
  const blob = new Blob([formatJSON()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeName = (elements.skinName.value.trim() || "the-isle-skin")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  anchor.href = url;
  anchor.download = `${safeName || "the-isle-skin"}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("JSON file downloaded.");
}

function unglitchColours() {
  const next = snapshot();
  let changed = false;
  for (const { key } of COLOUR_FIELDS) {
    const rgb = RGB_CHANNELS.map(channel => next[key][channel]);
    if (rgb.some(value => value < 0 || value > 1)) {
      const maximum = Math.max(...rgb);
      const minimum = Math.min(...rgb);
      const mapped = maximum > 0
        ? rgb.map(value => Math.max(0, value) / Math.max(1, maximum))
        : rgb.map(value => maximum > minimum ? (value - minimum) / (maximum - minimum) : 0);
      RGB_CHANNELS.forEach((channel, i) => { next[key][channel] = mapped[i]; });
      changed = true;
    }
    if (next[key].A < 0 || next[key].A > 1) { next[key].A = 1; changed = true; }
  }
  if (changed) commit(next, 'Glitch values converted to approximate normal colours. Undo restores the original.');
}

function randomiseNormalColours() {
  if (lockedColours.size === COLOUR_FIELDS.length) return;
  const next = snapshot();
  const theme = selectedRandomTheme();
  for (const field of COLOUR_FIELDS) {
    if (lockedColours.has(field.key)) continue;
    Object.assign(next[field.key], randomThemeColour(theme));
    next[field.key].A = 1;
  }
  commit(next);
}

function undo() {
  if (!history.length) return;
  future.push(snapshot());
  skin = history.pop();
  syncAll();
  toast("Undid the last change.");
}

function redo() {
  if (!future.length) return;
  history.push(snapshot());
  skin = future.pop();
  syncAll();
  toast("Redid the change.");
}

function updateHistoryButtons() {
  elements.undo.disabled = history.length === 0;
  elements.redo.disabled = future.length === 0;
}

function toast(message, error = false) {
  const item = document.createElement("div");
  item.className = `toast${error ? " error" : ""}`;
  item.textContent = message;
  elements.toastRegion.append(item);
  setTimeout(() => item.remove(), 3300);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

elements.grid.addEventListener("focusin", event => {
  if (event.target.matches('input[type="number"]')) event.target.dataset.before = JSON.stringify(skin);
});

elements.grid.addEventListener("input", event => {
  const input = event.target;
  if (!input.matches('input[type="number"][data-channel]')) return;
  const value = Number(input.value);
  if (!Number.isFinite(value)) return;
  skin[input.dataset.field][input.dataset.channel] = value;
  softUpdate();
});

elements.grid.addEventListener("change", event => {
  const input = event.target;
  if (input.matches('input[type="number"][data-channel]') && input.dataset.before) {
    try { history.push(JSON.parse(input.dataset.before)); } catch {  }
    if (history.length > 60) history.shift();
    future = [];
    delete input.dataset.before;
    updateHistoryButtons();
  }
  if (input.matches(".colour-picker")) {
    const next = snapshot();
    const rgb = hexToRGB(input.value);
    Object.assign(next[input.dataset.field], rgb);
    commit(next, `${input.dataset.field} updated.`);
  }
});

elements.grid.addEventListener("click", event => {
  const lock = event.target.closest(".colour-lock");
  if (lock) {
    const key = lock.dataset.field;
    if (lockedColours.has(key)) lockedColours.delete(key);
    else lockedColours.add(key);
    try { localStorage.setItem(STORAGE_KEYS.locks, JSON.stringify([...lockedColours])); } catch {  }
    updateLockControls();
    return;
  }
  const button = event.target.closest(".reset-colour");
  if (!button) return;
  const next = snapshot();
  next[button.dataset.field] = deepClone(DEFAULT_SKIN[button.dataset.field]);
  commit(next, `${button.dataset.field} reset.`);
});

elements.sex.forEach(input => input.addEventListener("change", () => {
  const next = snapshot();
  next.bIsFemale = input.value === "female";
  commit(next);
}));

elements.variation.addEventListener("change", () => {
  const next = snapshot();
  next.SkinVariation = Number(elements.variation.value) || 0;
  commit(next);
});

elements.pattern.addEventListener("change", () => {
  const next = snapshot();
  next.PatternIndex = Number(elements.pattern.value) || 0;
  commit(next);
});

elements.skinName.addEventListener("input", scheduleSave);
elements.savedList.addEventListener("click", event => {
  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) {
    event.stopPropagation();
    deleteSaved(deleteButton.dataset.delete);
    return;
  }
  const row = event.target.closest("[data-saved]");
  if (!row) return;
  const item = savedPresets.find(entry => entry.id === row.dataset.saved);
  if (item) {
    elements.skinName.value = item.name;
    commit(item.skin, `Loaded “${item.name}”.`);
  }
});

elements.savedList.addEventListener("keydown", event => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-saved]")) event.target.click();
});

elements.output.addEventListener("input", validateOutput);

document.querySelector("#upload-button").addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", () => readFiles(elements.fileInput.files));
document.querySelector("#load-code-button").addEventListener("click", () => parseAndLoad(elements.output.value, "Pasted JSON"));
document.querySelector("#copy-button").addEventListener("click", copyOutput);
document.querySelector("#download-button").addEventListener("click", downloadOutput);
document.querySelector("#save-preset-button").addEventListener("click", saveCurrentPreset);
document.querySelector("#random-button").addEventListener("click", randomiseNormalColours);
document.querySelector("#random-output-button").addEventListener("click", randomiseNormalColours);
document.querySelector("#unglitch-button").addEventListener("click", unglitchColours);
document.querySelector("#reset-button").addEventListener("click", () => commit(deepClone(DEFAULT_SKIN), "Starter JSON restored."));
document.querySelector("#lab-apply").addEventListener("click", applyLabGlitch);
elements.labMode.addEventListener("change", setLabDefaults);
elements.undo.addEventListener("click", undo);
elements.redo.addEventListener("click", redo);

for (const eventName of ["dragenter", "dragover"]) {
  elements.dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    elements.dropZone.classList.add("is-dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  elements.dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-dragging");
  });
}
elements.dropZone.addEventListener("drop", event => readFiles(event.dataTransfer.files));

const guideDialog = document.querySelector("#guide-dialog");
document.querySelector("#guide-button").addEventListener("click", () => guideDialog.showModal());

document.addEventListener("keydown", event => {
  if (document.querySelector('dialog[open]')) return;
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    downloadOutput();
  } else if (event.key.toLowerCase() === "z" && !event.shiftKey) {
    event.preventDefault();
    undo();
  } else if (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey)) {
    event.preventDefault();
    redo();
  }
});

for (const select of document.querySelectorAll("[data-random-theme]")) {
  for (const [key, theme] of Object.entries(RANDOM_THEMES)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = theme.label;
    select.append(option);
  }
  select.addEventListener("change", () => {
    updateRandomTheme(select.value);
    try { localStorage.setItem(STORAGE_KEYS.theme, select.value); } catch {  }
  });
}
let storedRandomTheme = "any";
try { storedRandomTheme = localStorage.getItem(STORAGE_KEYS.theme) || "any"; } catch {  }
updateRandomTheme(storedRandomTheme);

renderColourCards();
renderSavedPresets();
renderLabTargets();
elements.skinName.value = localStorage.getItem(STORAGE_KEYS.name) || "Untitled skin";
setLabDefaults();
syncAll();
