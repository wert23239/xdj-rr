/**
 * @fileoverview Enhanced sampler pad logic for the XDJ-RR controller.
 * 8 pads with per-pad volume, one-shot vs loop toggle, and drag-to-load from browser.
 */

/** @type {AudioBuffer[]} Pre-generated or loaded sample buffers */
const samplerBuffers = [];

/** @type {AudioBufferSourceNode[]} Currently playing sampler sources */
let activeSamplerSources = [null, null, null, null, null, null, null, null];

/** @type {GainNode[]} Per-pad gain nodes */
const samplerPadGains = [];

/** @type {boolean[]} Per-pad loop mode (false=one-shot, true=loop) */
const samplerLoopMode = [false, false, false, false, false, false, false, false];

/** @type {GainNode} Sampler output gain node */
let samplerGain;

/** @type {string[]} Pad labels */
const samplerLabels = ['AIR\nHORN', 'SIREN', 'SCRATCH', 'CROWD', 'PAD 5', 'PAD 6', 'PAD 7', 'PAD 8'];

/**
 * Initializes the sampler gain node and generates all sample buffers.
 * @param {AudioContext} actx - The audio context
 * @param {GainNode} masterGain - The master gain node to connect to
 */
function initSampler(actx, masterGain) {
  samplerGain = actx.createGain();
  samplerGain.gain.value = 0.5;
  samplerGain.connect(masterGain);
  // Create per-pad gain nodes
  for (let i = 0; i < 8; i++) {
    const g = actx.createGain();
    g.gain.value = 0.8;
    g.connect(samplerGain);
    samplerPadGains[i] = g;
  }
  generateSamples(actx);
}

/**
 * Generates all synthesized sample buffers.
 * @param {AudioContext} actx - The audio context
 */
function generateSamples(actx) {
  const sr = actx.sampleRate;

  // 0: Air Horn
  const ahLen = sr * 1.2;
  const ahBuf = actx.createBuffer(1, ahLen, sr);
  const ahData = ahBuf.getChannelData(0);
  for (let i = 0; i < ahLen; i++) {
    const t = i / sr;
    const env = t < 0.05 ? t / 0.05 : t > 1.0 ? (1.2 - t) / 0.2 : 1;
    const freq = 440 + Math.sin(t * 3) * 30;
    const v = (Math.sin(2 * Math.PI * freq * t) * 0.4 +
               Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.25 +
               Math.sin(2 * Math.PI * freq * 2 * t) * 0.15 +
               Math.sin(2 * Math.PI * freq * 3 * t) * 0.1);
    ahData[i] = v * env * 0.6;
  }
  samplerBuffers[0] = ahBuf;

  // 1: Siren
  const siLen = sr * 2;
  const siBuf = actx.createBuffer(1, siLen, sr);
  const siData = siBuf.getChannelData(0);
  for (let i = 0; i < siLen; i++) {
    const t = i / sr;
    const env = Math.min(1, t / 0.1) * Math.min(1, (2 - t) / 0.3);
    const freq = 600 + Math.sin(2 * Math.PI * 2 * t) * 300;
    siData[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.5;
  }
  samplerBuffers[1] = siBuf;

  // 2: Record Scratch
  const scLen = sr * 0.6;
  const scBuf = actx.createBuffer(1, scLen, sr);
  const scData = scBuf.getChannelData(0);
  for (let i = 0; i < scLen; i++) {
    const t = i / sr;
    const env = t < 0.02 ? t / 0.02 : Math.exp(-t * 8);
    const freq = 800 * Math.exp(-t * 5);
    const noise = Math.random() * 2 - 1;
    const tone = Math.sin(2 * Math.PI * freq * t);
    scData[i] = (noise * 0.4 + tone * 0.6) * env * 0.7;
  }
  samplerBuffers[2] = scBuf;

  // 3: Crowd Cheer
  const ccLen = sr * 2.5;
  const ccBuf = actx.createBuffer(2, ccLen, sr);
  for (let ch = 0; ch < 2; ch++) {
    const ccData = ccBuf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < ccLen; i++) {
      const t = i / sr;
      const env = Math.min(1, t / 0.5) * Math.min(1, (2.5 - t) / 0.5);
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      const pink = (b0 + b1 + b2 + white * 0.1848) * 0.11;
      const mod = 1 + 0.3 * Math.sin(2 * Math.PI * 3 * t) * Math.sin(2 * Math.PI * 0.7 * t);
      ccData[i] = pink * env * mod * 0.5;
    }
  }
  samplerBuffers[3] = ccBuf;

  // 4: Clap
  const clLen = sr * 0.3;
  const clBuf = actx.createBuffer(1, clLen, sr);
  const clData = clBuf.getChannelData(0);
  for (let i = 0; i < clLen; i++) {
    const t = i / sr;
    const env = t < 0.005 ? t / 0.005 : Math.exp(-t * 25);
    const noise = Math.random() * 2 - 1;
    const bp = Math.sin(2 * Math.PI * 1200 * t);
    clData[i] = (noise * 0.7 + bp * 0.3) * env * 0.6;
  }
  samplerBuffers[4] = clBuf;

  // 5: Laser
  const laLen = sr * 0.5;
  const laBuf = actx.createBuffer(1, laLen, sr);
  const laData = laBuf.getChannelData(0);
  for (let i = 0; i < laLen; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 6);
    const freq = 3000 * Math.exp(-t * 8) + 200;
    laData[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.5;
  }
  samplerBuffers[5] = laBuf;

  // 6: Kick
  const kiLen = sr * 0.4;
  const kiBuf = actx.createBuffer(1, kiLen, sr);
  const kiData = kiBuf.getChannelData(0);
  for (let i = 0; i < kiLen; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 12);
    const freq = 150 * Math.exp(-t * 8) + 40;
    kiData[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.8;
  }
  samplerBuffers[6] = kiBuf;

  // 7: Hi-Hat
  const hhLen = sr * 0.15;
  const hhBuf = actx.createBuffer(1, hhLen, sr);
  const hhData = hhBuf.getChannelData(0);
  for (let i = 0; i < hhLen; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 40);
    const noise = Math.random() * 2 - 1;
    const hp = Math.sin(2 * Math.PI * 8000 * t) * 0.3;
    hhData[i] = (noise * 0.7 + hp) * env * 0.4;
  }
  samplerBuffers[7] = hhBuf;
}

/**
 * Plays or stops a sampler pad.
 * @param {number} idx - Sample index (0-7)
 */
function playSample(idx) {
  if (activeSamplerSources[idx]) {
    try { activeSamplerSources[idx].stop(); } catch(e) {}
    activeSamplerSources[idx] = null;
    const el = document.getElementById('spad' + idx);
    if (el) el.classList.remove('playing');
    return;
  }
  if (!samplerBuffers[idx]) return;
  actx.resume();
  const src = actx.createBufferSource();
  src.buffer = samplerBuffers[idx];
  src.loop = samplerLoopMode[idx];
  src.connect(samplerPadGains[idx]);
  src.start();
  activeSamplerSources[idx] = src;
  const el = document.getElementById('spad' + idx);
  if (el) el.classList.add('playing');
  src.onended = () => {
    activeSamplerSources[idx] = null;
    const el2 = document.getElementById('spad' + idx);
    if (el2) el2.classList.remove('playing');
  };
}

/**
 * Sets the volume for a sampler pad.
 * @param {number} idx - Pad index
 * @param {number} vol - Volume 0-1
 */
function setSamplerPadVolume(idx, vol) {
  if (samplerPadGains[idx]) {
    samplerPadGains[idx].gain.value = vol;
  }
}

/**
 * Toggles loop mode for a sampler pad.
 * @param {number} idx - Pad index
 */
function toggleSamplerLoop(idx) {
  samplerLoopMode[idx] = !samplerLoopMode[idx];
  const btn = document.getElementById('spadLoop' + idx);
  if (btn) {
    btn.classList.toggle('active', samplerLoopMode[idx]);
    btn.textContent = samplerLoopMode[idx] ? '∞' : '1×';
  }
  // Update currently playing source if any
  if (activeSamplerSources[idx]) {
    activeSamplerSources[idx].loop = samplerLoopMode[idx];
  }
}

/**
 * Loads an audio file as a sample into a pad.
 * @param {number} idx - Pad index
 * @param {string} url - Audio URL
 * @param {string} name - Display name
 */
async function loadSampleFromURL(idx, url, name) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const arrayBuf = await resp.arrayBuffer();
    const audioBuf = await actx.decodeAudioData(arrayBuf);
    samplerBuffers[idx] = audioBuf;
    const el = document.getElementById('spad' + idx);
    if (el) {
      // Truncate name for display
      const short = name.length > 8 ? name.substring(0, 7) + '…' : name;
      el.innerHTML = short;
      el.title = name;
      el.className = 'sampler-pad s-custom';
    }
  } catch(e) {
    console.error('Failed to load sample:', e);
  }
}
