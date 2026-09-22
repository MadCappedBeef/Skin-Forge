"use strict";
window.SkinForgeFormats = (() => {
  const profiles = [{
    id: 'dino-den', name: 'Dino Den',
    description: 'Dino Den skin JSON: 10 RGBA colours, sex, skin variation and pattern index.',
    matches: value => value && typeof value === 'object' && !Array.isArray(value) &&
      ['bIsFemale', 'SkinVariation', 'PatternIndex', 'MaleDisplayColor', 'MarkingsColor', 'BodyColor', 'FlankColor', 'UnderbellyColor', 'Detail1Color', 'EyesColor', 'TeethColor', 'MouthColor', 'ClawsColor'].some(key => Object.hasOwn(value, key)),
    decode: value => structuredClone(value),
    encode: value => structuredClone(value)
  }];
  let selected = profiles[0];
  try { selected = profiles.find(profile => profile.id === localStorage.getItem('skinforge.server.v1')) || selected; } catch {}
  return {
    profiles,
    get selected() { return selected; },
    profile(id) {
      const result = profiles.find(profile => profile.id === id);
      if (!result) throw Error('This server format is not supported yet.');
      return result;
    },
    decode(value, preferredId = selected.id) {
      const preferred = this.profile(preferredId);
      const profile = preferred.matches(value) ? preferred : profiles.find(candidate => candidate.matches(value));
      if (!profile) throw Error('This JSON does not match a supported skin format. Request server support to add a new format.');
      return profile.decode(value);
    },
    encode(value, id = selected.id) { return this.profile(id).encode(structuredClone(value)); },
    select(id) {
      selected = this.profile(id);
      try { localStorage.setItem('skinforge.server.v1', id); } catch {}
    }
  };
})();
