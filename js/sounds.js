let audio = null;

function tone(freq, start, dur, type = 'sine', vol = 0.08) {
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, audio.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + dur);
  o.connect(g).connect(audio.destination);
  o.start(audio.currentTime + start);
  o.stop(audio.currentTime + start + dur + 0.02);
}

export function play(kind, enabled) {
  if (!enabled) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    if (kind === 'ok') {
      tone(660, 0, 0.12);
      tone(880, 0.1, 0.16);
    } else if (kind === 'block') {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.18));
    } else if (kind === 'soft') {
      tone(330, 0, 0.18, 'triangle', 0.05);
    }
  } catch {
    // Audio no disponible: la app sigue funcionando en silencio.
  }
}
