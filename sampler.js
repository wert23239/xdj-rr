/**
 * @fileoverview Sampler pad logic for the XDJ-RR controller.
 * Generates and plays synthesized sample sounds (airhorn, siren, scratch, crowd).
 */

/** @type {AudioBuffer[]} Pre-generated sample buffers */
const samplerBuffers = [];

/** @type {AudioBufferSourceNode[]} Currently playing sampler sources */
let activeSamplerSources = [null, null, null, null];

/** @type {GainNode} Sampler output gain node (initialized in app.js) */
let samplerGain;

/**
 * Initializes the sampler gain node and generates all sample buffers.
 * @param {AudioContext} actx - The audio context
 * @param {GainNode} masterGain - The master gain node to connect to
 */
function initSampler(actx, masterGain) {
  samplerGain = actx.createGain();
  samplerGain.gain.value = 0.5;
  samplerGain.connect(masterGain);
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
}

/**
 * Plays or stops a sampler pad.
 * @param {number} idx - Sample index (0-3)
 */
function playSample(idx) {
  if (activeSamplerSources[idx]) {
    try { activeSamplerSources[idx].stop(); } catch(e) {}
    activeSamplerSources[idx] = null;
    document.getElementById('spad' + idx).classList.remove('playing');
    return;
  }
  actx.resume();
  const src = actx.createBufferSource();
  src.buffer = samplerBuffers[idx];
  src.connect(samplerGain);
  src.start();
  activeSamplerSources[idx] = src;
  document.getElementById('spad' + idx).classList.add('playing');
  src.onended = () => {
    activeSamplerSources[idx] = null;
    document.getElementById('spad' + idx).classList.remove('playing');
  };
}
