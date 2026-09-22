"use strict";

function generateEstimatedEgg(mother, father, motherChance, random = Math.random) {
  const sources = {};
  const pick = key => {
    const source = random() < motherChance ? "mother" : "father";
    sources[key] = source;
    return source === "mother" ? mother : father;
  };
  const patternParent = pick("pattern");
  const result = {
    bIsFemale: random() < 0.5,
    SkinVariation: patternParent.SkinVariation,
    PatternIndex: patternParent.PatternIndex
  };
  for (const { key } of COLOUR_FIELDS) {
    const colour = pick(key)[key];
    result[key] = { R: colour.R, G: colour.G, B: colour.B, A: 1 };
  }
  return { skin: result, sources };
}

function parseEggParent(text, label) {
  let value;
  try { value = JSON.parse(cleanPastedText(text)); }
  catch { throw new Error(`${label}: paste or open a valid skin JSON first.`); }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}: the skin JSON must be an object.`);
  }
  for (const key of ["SkinVariation", "PatternIndex"]) {
    if (!Number.isInteger(value[key]) || value[key] < 0) {
      throw new Error(`${label}: ${key} must be a non-negative whole number.`);
    }
  }
  for (const { key } of COLOUR_FIELDS) {
    for (const channel of CHANNELS) {
      if (typeof value[key]?.[channel] !== "number" || !Number.isFinite(value[key][channel])) {
        throw new Error(`${label}: ${key}.${channel} must be a finite number.`);
      }
    }
  }
  return value;
}

(() => {
  const status = document.querySelector("#egg-status");
  const results = document.querySelector("#egg-results");
  const influence = document.querySelector("#egg-influence");
  const clearResults = () => {
    results.replaceChildren();
    status.textContent = "Inputs updated. Generate eggs to see new estimates.";
  };
  for (const parent of ["mother", "father"]) {
    const textarea = document.querySelector(`#egg-${parent}`);
    const fileInput = document.querySelector(`#egg-${parent}-file`);
    textarea.addEventListener("input", clearResults);
    document.querySelector(`[data-egg-current="${parent}"]`).addEventListener("click", () => {
      textarea.value = formatJSON();
      clearResults();
      status.textContent = `Current skin copied into the ${parent}'s slot.`;
    });
    document.querySelector(`[data-egg-import="${parent}"]`).addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      try {
        const text = await file.text();
        parseEggParent(text, parent === "mother" ? "Mother" : "Father");
        textarea.value = text;
        clearResults();
        status.textContent = `${parent === "mother" ? "Mother" : "Father"}'s skin loaded.`;
      } catch (error) { status.textContent = error.message; }
    });
  }
  influence.addEventListener("input", () => {
    document.querySelector("#egg-influence-value").textContent = `Mother ${influence.value}% / Father ${100 - Number(influence.value)}%`;
    clearResults();
  });
  document.querySelector("#egg-generate").addEventListener("click", () => {
    results.replaceChildren();
    try {
      const mother = parseEggParent(document.querySelector("#egg-mother").value, "Mother");
      const father = parseEggParent(document.querySelector("#egg-father").value, "Father");
      const chance = Number(influence.value) / 100;
      for (let i = 1; i <= 6; i++) {
        const egg = generateEstimatedEgg(mother, father, chance);
        const card = document.createElement("article");
        card.className = "egg-card";
        const heading = document.createElement("h3");
        heading.textContent = `Estimated egg ${i} · ${egg.skin.bIsFemale ? "Female" : "Male"}`;
        const pattern = document.createElement("p");
        pattern.textContent = `Pattern ${egg.skin.PatternIndex} / variation ${egg.skin.SkinVariation} from ${egg.sources.pattern}`;
        const colours = document.createElement("div");
        colours.className = "egg-colours";
        for (const { key, label } of COLOUR_FIELDS) {
          const row = document.createElement("div");
          const swatch = document.createElement("span");
          swatch.className = "egg-swatch";
          swatch.setAttribute("aria-hidden", "true");
          const colour = egg.skin[key];
          swatch.style.backgroundColor = `rgb(${RGB_CHANNELS.map(channel => Math.round(Math.max(0, Math.min(1, colour[channel])) * 255)).join(",")})`;
          row.append(swatch, `${label}: ${egg.sources[key]}`);
          colours.append(row);
        }
        const actions = document.createElement("div");
        actions.className = "egg-actions";
        const preview = document.createElement("button");
        preview.type = "button";
        preview.className = "button button-quiet";
        preview.textContent = "Preview in editor";
        preview.addEventListener("click", () => {
          commit(egg.skin);
          status.textContent = `Estimated egg ${i} loaded into the editor. Undo restores your previous skin.`;
          document.querySelector(".viewer-panel").scrollIntoView({ behavior: "smooth", block: "start" });
        });
        const download = document.createElement("button");
        download.type = "button";
        download.className = "button button-quiet";
        download.textContent = "Download JSON";
        download.addEventListener("click", () => {
          const url = URL.createObjectURL(new Blob([formatJSON(egg.skin)], { type: "application/json" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = `experimental-egg-${i}.json`;
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        actions.append(preview, download);
        card.append(heading, pattern, colours, actions);
        results.append(card);
      }
      status.textContent = `6 experimental estimates generated with ${influence.value}% mother influence. Swatches clamp glitch values; use the editor to inspect exact values. Actual in-game offspring may differ.`;
    } catch (error) { status.textContent = error.message; }
  });
})();
