// ==================== LEARN MODE: Level 1 — Your First Mix ====================

const actx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = actx.createGain();
masterGain.connect(actx.destination);

// ==================== SimpleDeck ====================
class SimpleDeck {
  constructor(id) {
    this.id = id;
    this.playing = false;
    this.audio = null;
    this.source = null;
    this.gainNode = actx.createGain();
    this.gainNode.gain.value = 0.85;
    this.eqHi = actx.createBiquadFilter(); this.eqHi.type = 'highshelf'; this.eqHi.frequency.value = 3200;
    this.eqMid = actx.createBiquadFilter(); this.eqMid.type = 'peaking'; this.eqMid.frequency.value = 1000; this.eqMid.Q.value = 1.8;
    this.eqLo = actx.createBiquadFilter(); this.eqLo.type = 'lowshelf'; this.eqLo.frequency.value = 250;
    this.channelGain = actx.createGain();
    this.channelGain.gain.value = 1;
    this.gainNode.connect(this.eqHi);
    this.eqHi.connect(this.eqMid);
    this.eqMid.connect(this.eqLo);
    this.eqLo.connect(this.channelGain);
    this.channelGain.connect(masterGain);
    this.peaks = null;
  }

  async loadTrack(url, name) {
    const n = this.id + 1;
    document.getElementById('track' + n + '-name').textContent = name;
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    this.audio = audio;
    this.source = actx.createMediaElementSource(audio);
    this.source.connect(this.gainNode);
    await new Promise((res, rej) => {
      audio.addEventListener('canplay', res, { once: true });
      audio.addEventListener('error', rej, { once: true });
      if (audio.readyState >= 3) res();
    });
    // Load waveform peaks from server
    try {
      const filename = decodeURIComponent(url.split('/').pop());
      const resp = await fetch('/api/tracks/' + encodeURIComponent(filename) + '/info');
      if (resp.ok) {
        const info = await resp.json();
        if (info.peaks && info.peaks.length) { this.peaks = info.peaks; this.drawWaveform(); }
      }
    } catch {}
  }

  play() {
    if (actx.state === 'suspended') actx.resume();
    if (this.audio && !this.playing) {
      this.audio.play();
      this.playing = true;
      document.getElementById('play' + (this.id + 1)).classList.add('active');
      document.getElementById('play' + (this.id + 1)).textContent = '⏸ PAUSE';
    }
  }

  pause() {
    if (this.audio && this.playing) {
      this.audio.pause();
      this.playing = false;
      document.getElementById('play' + (this.id + 1)).classList.remove('active');
      document.getElementById('play' + (this.id + 1)).textContent = '▶ PLAY';
    }
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  cue() {
    if (this.audio) { this.pause(); this.audio.currentTime = 0; }
  }

  drawWaveform() {
    if (!this.peaks) return;
    const canvas = document.getElementById('waveform' + (this.id + 1));
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const color = this.id === 0 ? '#0af' : '#f80';
    const barW = w / this.peaks.length;
    ctx.fillStyle = color;
    for (let i = 0; i < this.peaks.length; i++) {
      const barH = this.peaks[i] * h * 0.9;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(i * barW, (h - barH) / 2, Math.max(barW - 0.5, 0.5), barH);
    }
    ctx.globalAlpha = 1;
  }

  getCurrentTime() { return this.audio ? this.audio.currentTime : 0; }
  getDuration() { return this.audio ? this.audio.duration || 0 : 0; }
}

const deck1 = new SimpleDeck(0);
const deck2 = new SimpleDeck(1);

// ==================== CROSSFADER ====================
const crossfader = document.getElementById('crossfader');
function applyCrossfader() {
  const v = parseFloat(crossfader.value);
  deck1.channelGain.gain.value = Math.cos(v * Math.PI / 2);
  deck2.channelGain.gain.value = Math.sin(v * Math.PI / 2);
}
crossfader.addEventListener('input', () => { applyCrossfader(); checkStep(); });
applyCrossfader();

// ==================== EQ WIRING ====================
for (let d = 1; d <= 2; d++) {
  const deck = d === 1 ? deck1 : deck2;
  document.getElementById('eq' + d + '-hi').addEventListener('input', e => { deck.eqHi.gain.value = parseFloat(e.target.value); });
  document.getElementById('eq' + d + '-mid').addEventListener('input', e => { deck.eqMid.gain.value = parseFloat(e.target.value); });
  document.getElementById('eq' + d + '-lo').addEventListener('input', e => { deck.eqLo.gain.value = parseFloat(e.target.value); });
  document.getElementById('tempo' + d).addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    if (deck.audio) deck.audio.playbackRate = v;
    document.getElementById('tempo' + d + '-display').textContent = ((v - 1) * 100).toFixed(1) + '%';
  });
}

// ==================== TIME DISPLAY ====================
function formatTime(s) { if (!isFinite(s)) return '0:00'; const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }
setInterval(() => {
  document.getElementById('time1').textContent = formatTime(deck1.getCurrentTime());
  document.getElementById('time2').textContent = formatTime(deck2.getCurrentTime());
}, 250);

// ==================== TUTORIAL SYSTEM ====================
const TRACKS = [
  { url: '/tracks/Avicii%20vs%20Nicky%20Romero%20-%20I%20Could%20Be%20The%20One.wav', name: 'Avicii vs Nicky Romero - I Could Be The One' },
  { url: '/tracks/Michelle%20-%20Pulse.wav', name: 'Michelle - Pulse' }
];

const STEPS = [
  {
    text: "Welcome to DJ School! 🎧 Let's learn how to mix two songs together. Click <b>PLAY</b> on Deck 1 to start your first track.",
    highlight: ['play1'], enable: ['play1', 'deck1-panel']
  },
  {
    text: "Nice! You can hear the music. Now click <b>PLAY</b> on Deck 2 to start your second track.",
    highlight: ['play2'], enable: ['play2', 'deck2-panel']
  },
  {
    text: "Both tracks are playing! They're at the same BPM (128), so they should sound in sync. Try moving the <b>CROSSFADER</b> left and right to blend between them.",
    highlight: ['crossfader-panel'], enable: ['crossfader-panel']
  },
  {
    text: "You're mixing! The crossfader controls which deck you hear. Left = Deck 1, Right = Deck 2, Center = both. Try moving it <b>all the way to Deck 2</b> (right).",
    highlight: ['crossfader-panel'], enable: ['crossfader-panel']
  },
  {
    text: "That's a basic transition! You just faded from one song to another. Now try moving <b>back to center</b> to hear both songs together.",
    highlight: ['crossfader-panel'], enable: ['crossfader-panel']
  },
  {
    text: "🎉 <b>Congratulations!</b> You just did your first DJ mix! You learned: loading tracks, playing them, and using the crossfader to transition. More levels coming soon!",
    highlight: [], enable: ['play1', 'play2', 'crossfader-panel', 'deck1-panel', 'deck2-panel']
  }
];

let currentStep = 0;
let crossfaderMoved = false;

function showStep(idx) {
  currentStep = idx;
  const step = STEPS[idx];
  document.getElementById('tutorial-step').textContent = `Step ${idx + 1}/${STEPS.length}`;
  document.getElementById('tutorial-text').innerHTML = step.text;
  // Re-trigger animation
  const box = document.getElementById('tutorial-box');
  box.style.animation = 'none'; box.offsetHeight; box.style.animation = '';

  // Clear all highlights and disable all interactive controls
  document.querySelectorAll('.highlight-blue, .highlight-orange, .highlight-white').forEach(el => {
    el.classList.remove('highlight-blue', 'highlight-orange', 'highlight-white');
  });

  const allControls = ['play1', 'play2', 'cue1', 'cue2', 'crossfader-panel', 'deck1-panel', 'deck2-panel'];
  const interactiveElements = ['play1', 'play2', 'cue1', 'cue2', 'crossfader',
    'eq1-hi', 'eq1-mid', 'eq1-lo', 'eq2-hi', 'eq2-mid', 'eq2-lo', 'tempo1', 'tempo2'];

  // Disable everything first
  interactiveElements.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('disabled-control');
  });

  // Enable allowed controls
  const enableIds = step.enable || [];
  enableIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('disabled-control');
      // Also enable child inputs
      el.querySelectorAll('input, button').forEach(c => c.classList.remove('disabled-control'));
    }
  });

  // Add highlights
  step.highlight.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id.includes('1') || id.includes('deck1')) el.classList.add('highlight-blue');
    else if (id.includes('2') || id.includes('deck2')) el.classList.add('highlight-orange');
    else el.classList.add('highlight-white');
  });
}

function checkStep() {
  if (currentStep === 2 && !crossfaderMoved) {
    crossfaderMoved = true;
    showStep(3);
  } else if (currentStep === 3 && parseFloat(crossfader.value) > 0.8) {
    showStep(4);
  } else if (currentStep === 4) {
    const v = parseFloat(crossfader.value);
    if (v >= 0.3 && v <= 0.7) showStep(5);
  }
}

// Button wiring
document.getElementById('play1').addEventListener('click', () => {
  deck1.toggle();
  if (currentStep === 0 && deck1.playing) showStep(1);
});
document.getElementById('play2').addEventListener('click', () => {
  deck2.toggle();
  if (currentStep === 1 && deck2.playing) showStep(2);
});
document.getElementById('cue1').addEventListener('click', () => deck1.cue());
document.getElementById('cue2').addEventListener('click', () => deck2.cue());

// ==================== INIT ====================
async function init() {
  try {
    await Promise.all([
      deck1.loadTrack(TRACKS[0].url, TRACKS[0].name),
      deck2.loadTrack(TRACKS[1].url, TRACKS[1].name)
    ]);
    showStep(0);
  } catch (e) {
    document.getElementById('tutorial-text').textContent = 'Error loading tracks: ' + e.message;
  }
}
init();
