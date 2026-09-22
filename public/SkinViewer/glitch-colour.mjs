export function previewChannel(value, experimental = false, negativeStrength = 1) {
  if (!Number.isFinite(value)) return 0;
  if (!experimental) return Math.min(1, Math.max(0, value));
  if (value >= 0) return Math.min(1000000, value);
  const strength = Number.isFinite(negativeStrength) ? Math.min(2, Math.max(0, negativeStrength)) : 1;
  return -Math.log10(1 + Math.min(1000000, -value)) * strength;
}
