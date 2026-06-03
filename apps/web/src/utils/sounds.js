// Web Audio API sound effects — no external files needed

function ctx() {
  try { return new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
}

function tone(freq, type = 'sine', duration = 0.1, gain = 0.08) {
  const c = ctx();
  if (!c) return;
  const osc = c.createOscillator();
  const g   = c.createGain();
  osc.connect(g);
  g.connect(c.destination);
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.start();
  osc.stop(c.currentTime + duration);
}

function melody(notes, delay = 0.08) {
  if (!getSoundEnabled()) return;
  notes.forEach(([freq, type, dur, gain], i) => {
    setTimeout(() => tone(freq, type, dur, gain), i * delay * 1000);
  });
}

export function getSoundEnabled() {
  try { return localStorage.getItem('soundEnabled') !== 'false'; } catch { return true; }
}

export function toggleSound(enabled) {
  try { localStorage.setItem('soundEnabled', String(enabled)); } catch {}
}

export function playClick() {
  if (!getSoundEnabled()) return;
  tone(600, 'sine', 0.12, 0.07);
}

export function playAddToCart() {
  melody([[800, 'sine', 0.1], [1200, 'sine', 0.15]]);
}

export function playWishlistAdd() {
  melody([[600, 'sine', 0.1], [800, 'sine', 0.12]]);
}

export function playCheckoutSuccess() {
  // C5 → E5 → G5 → C6 chime
  melody([[523, 'sine', 0.12], [659, 'sine', 0.12], [784, 'sine', 0.12], [1047, 'sine', 0.2]]);
}

export function playError() {
  melody([[300, 'square', 0.1, 0.05], [200, 'square', 0.15, 0.05]], 0.12);
}

export function playNewOrder() {
  melody([[1319, 'sine', 0.1], [1568, 'sine', 0.1], [2093, 'sine', 0.1], [2637, 'sine', 0.2]]);
}

export function playLowStockWarning() {
  melody([[800, 'square', 0.07, 0.05], [800, 'square', 0.07, 0.05], [800, 'square', 0.07, 0.05]], 0.15);
}

export function playNewMessage() {
  melody([[587, 'sine', 0.1], [880, 'sine', 0.15]]);
}

export function playPayoutReceived() {
  melody([[392, 'sine', 0.1], [523, 'sine', 0.1], [659, 'sine', 0.1], [784, 'sine', 0.2]]);
}

export function playStatusUpdate() {
  if (!getSoundEnabled()) return;
  tone(1000, 'sine', 0.12, 0.07);
}

export function playDelete() {
  if (!getSoundEnabled()) return;
  tone(200, 'sine', 0.2, 0.06);
}

export function playBadgeUpdate() {
  if (!getSoundEnabled()) return;
  tone(1200, 'sine', 0.08, 0.06);
}
