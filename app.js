/**
 * @fileoverview Main application logic for the XDJ-RR web DJ controller.
 * Contains the Deck class, AudioContext setup, UI wiring, and all event handlers.
 */

// ==================== AUDIO ENGINE ====================
/** @type {AudioContext} Global audio context */
const actx = new (window.AudioContext || window.webkitAudioContext)();

/** @type {GainNode} Master gain node */
const masterGain = actx.createGain();
masterGain.gain.value = 1;

/** @type {DynamicsCompressorNode} Master limiter */
const limiterNode = actx.createDynamicsCompressor();
limiterNode.threshold.value = -1;
limiterNode.knee.value = 0;
limiterNode.ratio.value = 20;
limiterNode.attack.value = 0.001;
limiterNode.release.value = 0.05;

masterGain.connect(limiterNode);
limiterNode.connect(actx.destination);

// ==================== VU METER INIT ====================
const VU_SEGMENTS = 16;
for (let d = 1; d <= 2; d++) {
  const row = document.getElementById('vu' + d);
  for (let i = 0; i < VU_SEGMENTS; i++) {
    const seg = document.createElement('div');
    seg.className = 'vu-segment';
    row.appendChild(seg);
  }
}

// ==================== KEY DETECTION ====================
const KEY_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

/**
 * Detects the musical key of a deck's loaded audio.
 * @param {Deck} deck - The deck to analyze
 * @returns {string} Detected key (e.g. 'Am', 'C')
 */
function detectKey(deck) {
  if (!deck.buffer) return 'N/A';
  const data = deck.buffer.getChannelData(0);
  const sampleRate = deck.buffer.sampleRate;
  const len = Math.min(data.length, sampleRate * 10);
  const chromaBins = new Float64Array(12);
  const sliceSize = 8192;
  const numSlices = Math.floor(len / sliceSize);
  for (let s = 0; s < Math.min(numSlices, 20); s++) {
    const offset = s * sliceSize;
    for (let note = 0; note < 12; note++) {
      for (let octave = 2; octave <= 5; octave++) {
        const freq = 440 * Math.pow(2, (note - 9) / 12 + (octave - 4));
        const period = sampleRate / freq;
        if (period > sliceSize / 2) continue;
        let correlation = 0;
        const samples = Math.min(Math.floor(sliceSize / 2), 2000);
        for (let i = 0; i < samples; i++) {
          correlation += data[offset + i] * data[offset + i + Math.round(period)];
        }
        chromaBins[note] += Math.max(0, correlation / samples);
      }
    }
  }
  let maxIdx = 0, maxVal = 0;
  for (let i = 0; i < 12; i++) {
    if (chromaBins[i] > maxVal) { maxVal = chromaBins[i]; maxIdx = i; }
  }
  const minorIdx = (maxIdx + 9) % 12;
  const isMajor = chromaBins[maxIdx] > chromaBins[minorIdx] * 1.2;
  return KEY_NAMES[maxIdx] + (isMajor ? '' : 'm');
}

// ==================== CAMELOT WHEEL ====================
const CAMELOT_MAP = {
  'C':  { code: '8B',  num: 8,  mode: 'B' }, 'Cm': { code: '5A',  num: 5,  mode: 'A' },
  'C#': { code: '3B',  num: 3,  mode: 'B' }, 'C#m':{ code: '12A', num: 12, mode: 'A' },
  'Db': { code: '3B',  num: 3,  mode: 'B' }, 'Dbm':{ code: '12A', num: 12, mode: 'A' },
  'D':  { code: '10B', num: 10, mode: 'B' }, 'Dm': { code: '7A',  num: 7,  mode: 'A' },
  'D#': { code: '5B',  num: 5,  mode: 'B' }, 'D#m':{ code: '2A',  num: 2,  mode: 'A' },
  'Eb': { code: '5B',  num: 5,  mode: 'B' }, 'Ebm':{ code: '2A',  num: 2,  mode: 'A' },
  'E':  { code: '12B', num: 12, mode: 'B' }, 'Em': { code: '9A',  num: 9,  mode: 'A' },
  'F':  { code: '7B',  num: 7,  mode: 'B' }, 'Fm': { code: '4A',  num: 4,  mode: 'A' },
  'F#': { code: '2B',  num: 2,  mode: 'B' }, 'F#m':{ code: '11A', num: 11, mode: 'A' },
  'Gb': { code: '2B',  num: 2,  mode: 'B' }, 'Gbm':{ code: '11A', num: 11, mode: 'A' },
  'G':  { code: '9B',  num: 9,  mode: 'B' }, 'Gm': { code: '6A',  num: 6,  mode: 'A' },
  'G#': { code: '4B',  num: 4,  mode: 'B' }, 'G#m':{ code: '1A',  num: 1,  mode: 'A' },
  'Ab': { code: '4B',  num: 4,  mode: 'B' }, 'Abm':{ code: '1A',  num: 1,  mode: 'A' },
  'A':  { code: '11B', num: 11, mode: 'B' }, 'Am': { code: '8A',  num: 8,  mode: 'A' },
  'A#': { code: '6B',  num: 6,  mode: 'B' }, 'A#m':{ code: '3A',  num: 3,  mode: 'A' },
  'Bb': { code: '6B',  num: 6,  mode: 'B' }, 'Bbm':{ code: '3A',  num: 3,  mode: 'A' },
  'B':  { code: '1B',  num: 1,  mode: 'B' }, 'Bm': { code: '10A', num: 10, mode: 'A' },
};

/** @param {string} keyStr @returns {object|null} */
function getCamelot(keyStr) { return (!keyStr || keyStr === 'N/A') ? null : CAMELOT_MAP[keyStr] || null; }

/** @param {object} cam1 @param {object} cam2 @returns {string|null} */
function harmonicCompatibility(cam1, cam2) {
  if (!cam1 || !cam2) return null;
  if (cam1.num === cam2.num && cam1.mode === cam2.mode) return 'compatible';
  if (cam1.num === cam2.num && cam1.mode !== cam2.mode) return 'compatible';
  if (cam1.mode === cam2.mode) {
    const diff = Math.abs(cam1.num - cam2.num);
    if (diff === 1 || diff === 11) return 'compatible';
    if (diff === 2 || diff === 10) return 'adjacent';
  }
  if (cam1.mode !== cam2.mode) {
    const diff = Math.abs(cam1.num - cam2.num);
    if (diff === 1 || diff === 11) return 'adjacent';
  }
  return 'clash';
}

/** @type {Array<string|null>} Detected keys per deck */
let deckKeys = [null, null];

/** Updates the harmonic mixing display between decks */
function updateHarmonicDisplay() {
  const cam1 = getCamelot(deckKeys[0]);
  const cam2 = getCamelot(deckKeys[1]);
  document.getElementById('camelot1').textContent = cam1 ? cam1.code : '—';
  document.getElementById('camelot2').textContent = cam2 ? cam2.code : '—';
  for (let i = 0; i < 2; i++) {
    const cam = getCamelot(deckKeys[i]);
    const keyEl = document.getElementById('key' + (i + 1));
    if (deckKeys[i] && cam) keyEl.textContent = deckKeys[i] + ' · ' + cam.code;
  }
  const badge = document.getElementById('harmonicBadge');
  if (cam1 && cam2) {
    const compat = harmonicCompatibility(cam1, cam2);
    badge.style.display = '';
    badge.className = 'harmonic-badge ' + compat;
    badge.textContent = compat === 'compatible' ? '✓ MATCH' : compat === 'adjacent' ? '~ CLOSE' : '✗ CLASH';
  } else {
    badge.style.display = 'none';
  }
}

// ==================== SILENCE DETECTION ====================
/**
 * Detects intro silence and outro silence boundaries.
 * @param {AudioBuffer} buffer
 * @returns {{intro: number, outro: number}} Times in seconds
 */
function detectSilenceBoundaries(buffer) {
  if (!buffer) return { intro: 0, outro: buffer ? buffer.duration : 0 };
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const threshold = 0.01;
  const windowSize = Math.floor(sr * 0.05);
  let introSample = 0;
  for (let i = 0; i < data.length - windowSize; i += windowSize) {
    let rms = 0;
    for (let j = i; j < i + windowSize; j++) rms += data[j] * data[j];
    rms = Math.sqrt(rms / windowSize);
    if (rms > threshold) { introSample = i; break; }
  }
  let outroSample = data.length;
  for (let i = data.length - windowSize; i >= 0; i -= windowSize) {
    let rms = 0;
    for (let j = i; j < Math.min(i + windowSize, data.length); j++) rms += data[j] * data[j];
    rms = Math.sqrt(rms / windowSize);
    if (rms > threshold) { outroSample = Math.min(i + windowSize, data.length); break; }
  }
  return { intro: introSample / sr, outro: outroSample / sr };
}

// ==================== AUTO-GAIN ====================
let autoGainEnabled = false;
const TARGET_RMS = 0.1;

function toggleAutoGain() {
  autoGainEnabled = !autoGainEnabled;
  document.getElementById('autoGainBtn').classList.toggle('active', autoGainEnabled);
  if (autoGainEnabled) {
    for (let i = 0; i < 2; i++) { if (decks[i].buffer) applyAutoGain(i); }
  } else {
    for (let i = 0; i < 2; i++) { decks[i].trimGain.gain.value = 1; document.getElementById('gainVal' + (i+1)).textContent = '0dB'; }
  }
}

function computeRMS(buffer) {
  const data = buffer.getChannelData(0);
  const len = Math.min(data.length, buffer.sampleRate * 30);
  let sum = 0;
  for (let i = 0; i < len; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / len);
}

function applyAutoGain(deckId) {
  const deck = decks[deckId];
  if (!deck.buffer) return;
  const rms = computeRMS(deck.buffer);
  if (rms < 0.0001) return;
  const gain = TARGET_RMS / rms;
  const clampedGain = Math.max(0.25, Math.min(4, gain));
  deck.trimGain.gain.value = clampedGain;
  const db = 20 * Math.log10(clampedGain);
  document.getElementById('gainVal' + (deckId + 1)).textContent = (db >= 0 ? '+' : '') + db.toFixed(1) + 'dB';
}

// ==================== DECK CLASS ====================
/**
 * Represents a DJ deck with audio playback, EQ, effects, and analysis.
 */
class Deck {
  /**
   * @param {number} id - Deck index (0 or 1)
   */
  constructor(id) {
    this.id = id;
    this.buffer = null;
    this.source = null;
    this.playing = false;
    this.startTime = 0;
    this.offset = 0;
    this.cuePoint = 0;
    this.bpm = 0;
    this.playbackRate = 1;
    this.trackName = '';
    this.hotCues = [null, null, null, null];
    this.loopActive = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.loopBeats = 0;
    this.headphoneCue = false;
    this.nudgeAmount = 0;
    this.wfFreqData = null;
    this.slipMode = false;
    this.slipPosition = 0;
    this.slipStartTime = 0;
    this.slipActive = false;
    this.quantize = false;
    this.introMarker = 0;
    this.outroMarker = 0;
    this._lastUrl = null;

    // Trim/Gain
    this.trimGain = actx.createGain();
    this.trimGain.gain.value = 1;

    // Channel gain (volume fader)
    this.gainNode = actx.createGain();
    this.gainNode.gain.value = 0.85;

    // EQ
    this.eqHi = actx.createBiquadFilter();
    this.eqHi.type = 'highshelf'; this.eqHi.frequency.value = 3200; this.eqHi.gain.value = 0;
    this.eqMid = actx.createBiquadFilter();
    this.eqMid.type = 'peaking'; this.eqMid.frequency.value = 1000; this.eqMid.Q.value = 0.7; this.eqMid.gain.value = 0;
    this.eqLo = actx.createBiquadFilter();
    this.eqLo.type = 'lowshelf'; this.eqLo.frequency.value = 250; this.eqLo.gain.value = 0;

    // Color filter
    this.colorFilter = actx.createBiquadFilter();
    this.colorFilter.type = 'allpass';
    this.colorFilter.frequency.value = 1000;
    this.colorFilter.Q.value = 0;
    this.colorValue = 0.5;

    // Channel output gain (for crossfader)
    this.channelGain = actx.createGain();
    this.channelGain.gain.value = 1;

    // Analyser
    this.analyser = actx.createAnalyser();
    this.analyser.fftSize = 2048;

    // Setup effects
    setupEffectsChain(actx, this);

    // Audio routing: trimGain -> gainNode -> EQ chain -> colorFilter -> [effects] -> channelGain -> analyser -> master
    this.trimGain.connect(this.gainNode);
    this.gainNode.connect(this.eqHi);
    this.eqHi.connect(this.eqMid);
    this.eqMid.connect(this.eqLo);
    this.eqLo.connect(this.colorFilter);
    connectEffectsChain(this);
    this.channelGain.connect(this.analyser);
    this.analyser.connect(masterGain);
  }

  /**
   * Loads an audio track from a URL.
   * Uses HTML5 Audio element for streaming playback (fast start),
   * and decodes full buffer in background for waveform/analysis.
   * @param {string} url - Track URL
   * @param {string} name - Display name
   */
  async loadTrack(url, name) {
    this.stop();
    this._lastUrl = url;
    this._streamAudio = null;
    this._streamSource = null;

    // Extract filename for cache lookup
    const filename = decodeURIComponent(url.split('/').pop());

    // Try to load cached server-side info (waveform peaks)
    let cachedInfo = null;
    try {
      const infoResp = await fetch('/api/tracks/' + encodeURIComponent(filename) + '/info');
      if (infoResp.ok) cachedInfo = await infoResp.json();
    } catch {}

    // Set up streaming audio element for fast playback start
    try {
      const audio = new Audio(url);
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      this._streamAudio = audio;

      // Create MediaElementAudioSourceNode
      this._streamSource = actx.createMediaElementSource(audio);
      this._streamSource.connect(this.trimGain);

      // Wait for enough data to play
      await new Promise((resolve, reject) => {
        const onCanPlay = () => { audio.removeEventListener('canplay', onCanPlay); audio.removeEventListener('error', onError); resolve(); };
        const onError = () => { audio.removeEventListener('canplay', onCanPlay); audio.removeEventListener('error', onError); reject(new Error('Stream load failed')); };
        audio.addEventListener('canplay', onCanPlay);
        audio.addEventListener('error', onError);
        // If already ready
        if (audio.readyState >= 3) resolve();
      });

      this._streamDuration = audio.duration || 0;
    } catch(e) {
      this._streamAudio = null;
      this._streamSource = null;
    }

    // Set initial state
    this.offset = 0;
    this.cuePoint = 0;
    this.trackName = name;
    this.hotCues = [null, null, null, null];
    this.loopActive = false;
    lastAutoLoggedTrack[this.id] = null;

    // If we have cached peaks, draw waveform immediately
    if (cachedInfo && cachedInfo.peaks && cachedInfo.peaks.length > 0) {
      this._serverPeaks = cachedInfo.peaks;
      drawOverviewWaveformFromPeaks(this, cachedInfo.peaks);
      drawStaticWaveformFromPeaks(this, cachedInfo.peaks);
    }

    // Use cached BPM/key if available
    if (cachedInfo && cachedInfo.bpm) {
      this.bpm = cachedInfo.bpm;
    }
    if (cachedInfo && cachedInfo.key) {
      deckKeys[this.id] = cachedInfo.key;
      const cam = getCamelot(cachedInfo.key);
      document.getElementById('key' + (this.id + 1)).textContent = cachedInfo.key + (cam ? ' · ' + cam.code : '');
    }
    if (cachedInfo && cachedInfo.duration) {
      this._streamDuration = cachedInfo.duration;
    }

    updateHotCueButtons(this.id);
    addToHistory(this.id, name);
    updateXfadeHint();
    updateMarquee(this.id);
    updateHarmonicDisplay();

    // If streaming failed entirely, try full buffer decode synchronously (will throw on failure)
    if (!this._streamAudio) {
      await this._decodeFullBuffer(url, filename, cachedInfo);
    } else {
      // Background: decode full buffer for analysis (BPM, key, detailed waveform)
      this._decodeFullBuffer(url, filename, cachedInfo);
    }
  }

  /**
   * Decodes full audio buffer in background for analysis.
   * @param {string} url - Track URL
   * @param {string} filename - Original filename
   * @param {object|null} cachedInfo - Previously cached info
   */
  async _decodeFullBuffer(url, filename, cachedInfo) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const arrayBuf = await resp.arrayBuffer();
      this.buffer = await actx.decodeAudioData(arrayBuf);

      // Only analyze if not cached
      const needsBPM = !cachedInfo || !cachedInfo.bpm;
      const needsKey = !cachedInfo || !cachedInfo.key;

      if (needsBPM) this.detectBPM();
      if (needsKey) {
        const key = detectKey(this);
        deckKeys[this.id] = key;
        document.getElementById('key' + (this.id + 1)).textContent = 'KEY: ' + key;
        updateHarmonicDisplay();
      }

      this.computeFrequencyColors();
      drawOverviewWaveform(this);
      drawStaticWaveform(this);

      if (autoGainEnabled) applyAutoGain(this.id);

      // Silence boundaries
      const bounds = detectSilenceBoundaries(this.buffer);
      this.introMarker = bounds.intro;
      this.outroMarker = bounds.outro;
      drawOverviewWaveform(this);

      // Cache analysis results back to server
      const cacheData = {
        bpm: this.bpm,
        key: deckKeys[this.id],
        duration: this.buffer.duration
      };
      fetch('/api/tracks/' + encodeURIComponent(filename) + '/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cacheData)
      }).catch(() => {});
    } catch(e) {
      // If streaming is working, this is non-fatal
      if (!this._streamAudio) {
        this.buffer = null;
        this.trackName = '';
        throw e;
      }
    }
  }

  /** Starts playback from current offset */
  play() {
    if (this.playing) return;
    if (!this.buffer && !this._streamAudio) return;
    actx.resume();

    if (this._streamAudio) {
      // Streaming playback via HTML5 Audio element
      this._streamAudio.currentTime = this.offset;
      this._streamAudio.playbackRate = this.playbackRate;
      this._streamAudio.play().catch(() => {});
      this.startTime = actx.currentTime - this.offset / this.playbackRate;
      this.playing = true;
      this._streamAudio.onended = () => { if (this.playing) { this.playing = false; this.offset = 0; updateUI(); } };
    } else if (this.buffer) {
      // Fallback: buffer source playback
      this.source = actx.createBufferSource();
      this.source.buffer = this.buffer;
      this.source.playbackRate.value = this.playbackRate;
      this.source.connect(this.trimGain);
      this.source.start(0, this.offset);
      this.startTime = actx.currentTime - this.offset / this.playbackRate;
      this.playing = true;
      this.source.onended = () => { if (this.playing) { this.playing = false; this.offset = 0; updateUI(); } };
    }
    updateUI();
    if (this.offset < 1) autoLogTrack(this.id);
  }

  /** Stops playback and saves current position */
  stop() {
    if (this._streamAudio && this.playing) {
      this.offset = this._streamAudio.currentTime;
      this._streamAudio.pause();
    } else if (this.source) {
      try { this.source.stop(); } catch(e){}
      this.source.disconnect();
      this.source = null;
      if (this.playing) { this.offset = (actx.currentTime - this.startTime) * this.playbackRate; }
    } else if (this.playing) {
      this.offset = (actx.currentTime - this.startTime) * this.playbackRate;
    }
    this.playing = false;
    updateUI();
  }

  /** Toggles play/pause */
  togglePlay() { if (this.playing) this.stop(); else this.play(); }

  /** Returns to the cue point */
  cue() { this.stop(); this.offset = this.cuePoint; }

  /**
   * Gets the current playback time in seconds.
   * @returns {number}
   */
  getCurrentTime() {
    if (this._streamAudio && this.playing) return this._streamAudio.currentTime;
    if (this.playing) return (actx.currentTime - this.startTime) * this.playbackRate;
    return this.offset;
  }

  /**
   * Gets the track duration.
   * @returns {number}
   */
  getDuration() {
    if (this.buffer) return this.buffer.duration;
    if (this._streamAudio) return this._streamAudio.duration || this._streamDuration || 0;
    return this._streamDuration || 0;
  }

  /**
   * Seeks to a specific time.
   * @param {number} time - Time in seconds
   */
  seekTo(time) {
    const wasPlaying = this.playing;
    if (wasPlaying) this.stop();
    this.offset = Math.max(0, Math.min(time, this.getDuration()));
    if (wasPlaying) this.play();
  }

  /**
   * Sets the tempo adjustment.
   * @param {number} percent - Tempo change in percent (-8 to +8)
   */
  setTempo(percent) {
    this.playbackRate = 1 + percent / 100;
    if (this.source) this.source.playbackRate.value = this.playbackRate + this.nudgeAmount;
    if (this._streamAudio) this._streamAudio.playbackRate = this.playbackRate + this.nudgeAmount;
  }

  /**
   * Sets the color/filter effect.
   * @param {number} val - 0 to 1, where 0.5 is neutral
   */
  setColorFilter(val) {
    this.colorValue = val;
    if (Math.abs(val - 0.5) < 0.03) {
      this.colorFilter.type = 'allpass'; this.colorFilter.Q.value = 0;
    } else if (val < 0.5) {
      this.colorFilter.type = 'lowpass';
      this.colorFilter.frequency.value = 200 + (val / 0.5) * 19800;
      this.colorFilter.Q.value = 1 + (0.5 - val) * 8;
    } else {
      this.colorFilter.type = 'highpass';
      this.colorFilter.frequency.value = 20 + ((val - 0.5) / 0.5) * 5000;
      this.colorFilter.Q.value = 1 + (val - 0.5) * 8;
    }
  }

  /**
   * Toggles an effect on this deck.
   * @param {string} type - Effect type
   */
  toggleFX(type) { toggleDeckFX(this, type); }

  /**
   * Detects BPM using autocorrelation of onset function.
   */
  detectBPM() {
    if (!this.buffer) return;
    const data = this.buffer.getChannelData(0);
    const sampleRate = this.buffer.sampleRate;
    const len = Math.min(data.length, sampleRate * 30);
    const windowSize = Math.floor(sampleRate * 0.01);
    const energies = [];
    for (let i = 0; i < len - windowSize; i += windowSize) {
      let sum = 0;
      for (let j = i; j < i + windowSize; j++) sum += data[j] * data[j];
      energies.push(sum / windowSize);
    }
    const onsets = new Float32Array(energies.length);
    for (let i = 1; i < energies.length; i++) {
      onsets[i] = Math.max(0, energies[i] - energies[i - 1]);
    }
    const minBPM = 60, maxBPM = 180;
    const windowMs = 10;
    const minLag = Math.floor(60000 / maxBPM / windowMs);
    const maxLag = Math.floor(60000 / minBPM / windowMs);
    const acLen = Math.min(onsets.length, 3000);
    let bestLag = minLag, bestCorr = -Infinity;
    for (let lag = minLag; lag <= Math.min(maxLag, acLen / 2); lag++) {
      let corr = 0, count = 0;
      for (let i = 0; i < acLen - lag; i++) { corr += onsets[i] * onsets[i + lag]; count++; }
      corr /= count;
      const doubleLag = lag * 2;
      if (doubleLag < acLen / 2) {
        let corr2 = 0, c2 = 0;
        for (let i = 0; i < acLen - doubleLag; i++) { corr2 += onsets[i] * onsets[i + doubleLag]; c2++; }
        corr2 /= c2;
        corr += corr2 * 0.5;
      }
      if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    let bpm = 60000 / (bestLag * windowMs);
    while (bpm > 180) bpm /= 2;
    while (bpm < 70) bpm *= 2;
    this.bpm = Math.round(bpm * 10) / 10;
  }

  /**
   * Syncs this deck's tempo to another deck.
   * @param {Deck} otherDeck
   */
  sync(otherDeck) {
    if (!otherDeck.bpm || !this.bpm) return;
    const ratio = otherDeck.bpm / this.bpm;
    const tempoPercent = (ratio - 1) * 100;
    this.setTempo(tempoPercent);
    const el = document.getElementById('tempo' + (this.id + 1));
    el.value = Math.max(-8, Math.min(8, tempoPercent));
    document.getElementById('tempoVal' + (this.id + 1)).textContent = tempoPercent.toFixed(1) + '%';
  }

  /** Computes frequency color data for waveform visualization */
  computeFrequencyColors() {
    if (!this.buffer) return;
    const sampleRate = this.buffer.sampleRate;
    const data = this.buffer.getChannelData(0);
    const fftSize = 2048;
    const numSlices = Math.ceil(data.length / fftSize);
    this.wfFreqData = new Array(numSlices);
    for (let s = 0; s < numSlices; s++) {
      const start = s * fftSize;
      const end = Math.min(start + fftSize, data.length);
      let total = 0;
      for (let i = start; i < end; i++) total += Math.abs(data[i]);
      let zeroCrossings = 0;
      for (let i = start + 1; i < end; i++) {
        if ((data[i] >= 0) !== (data[i-1] >= 0)) zeroCrossings++;
      }
      const zcr = zeroCrossings / (end - start);
      let lo = total * Math.max(0, 1 - zcr * 5);
      let hi = total * Math.max(0, zcr * 3 - 0.3);
      let mid = total - lo - hi;
      if (mid < 0) mid = 0;
      const max = Math.max(lo, mid, hi, 0.001);
      this.wfFreqData[s] = { lo: lo/max, mid: mid/max, hi: hi/max };
    }
  }
}

// ==================== DECK INSTANCES ====================
/** @type {Deck[]} The two decks */
const decks = [new Deck(0), new Deck(1)];

// Initialize sampler
initSampler(actx, masterGain);

// ==================== UI HELPERS ====================
/**
 * Shows an error toast notification.
 * @param {string} msg
 */
function showError(msg) {
  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function showLoadingSpinner(deckId) {
  const deckEl = document.getElementById('deckEl' + (deckId + 1));
  if (deckEl.querySelector('.loading-overlay')) return;
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = '<div style="text-align:center"><div class="spinner"></div><div class="load-text">Loading track...</div></div>';
  deckEl.style.position = 'relative';
  deckEl.appendChild(overlay);
}

function hideLoadingSpinner(deckId) {
  const deckEl = document.getElementById('deckEl' + (deckId + 1));
  const overlay = deckEl.querySelector('.loading-overlay');
  if (overlay) overlay.remove();
}

/**
 * Formats seconds to M:SS display.
 * @param {number} s - Seconds
 * @returns {string}
 */
function formatTime(s) {
  if (!s || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

/**
 * Cleans a filename for display.
 * @param {string} filename
 * @returns {string}
 */
function cleanTrackName(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/\s*\[\d{5,}\]\s*/g, ' ').replace(/\s*[\(\[].*?[\)\]]\s*/g, ' ').replace(/\s*-\s*NA\b/gi, '').replace(/\b(Official\s*(Music\s*)?Video|Official\s*Lyric\s*Video|Official\s*Visualizer|Official\s*Audio|LIVE\s*IN\s*STUDIO|Official|Video|Audio|Lyrics?|HD|HQ|ft\.?|feat\.?)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
}

// ==================== PERFORMANCE MODE ====================
let performanceMode = false;
function togglePerformanceMode() {
  performanceMode = !performanceMode;
  document.getElementById('perfToggle').classList.toggle('active', performanceMode);
  document.getElementById('browserPanel').classList.toggle('hidden', performanceMode);
  document.querySelector('.controller').classList.toggle('performance-mode', performanceMode);
}

// ==================== NUDGE ====================
function nudgeDeck(deckId, dir) {
  const deck = decks[deckId];
  deck.nudgeAmount = dir * 0.02;
  if (deck.source) deck.source.playbackRate.value = deck.playbackRate + deck.nudgeAmount;
  if (deck._streamAudio) deck._streamAudio.playbackRate = deck.playbackRate + deck.nudgeAmount;
}
function nudgeRelease(deckId) {
  const deck = decks[deckId];
  deck.nudgeAmount = 0;
  if (deck.source) deck.source.playbackRate.value = deck.playbackRate;
  if (deck._streamAudio) deck._streamAudio.playbackRate = deck.playbackRate;
}

// ==================== JOG MARKERS ====================
for (let d = 1; d <= 2; d++) {
  const container = document.getElementById('jogMarkers' + d);
  for (let i = 0; i < 24; i++) {
    const tick = document.createElement('div');
    tick.className = 'jog-tick' + (i % 6 === 0 ? ' major' : '');
    tick.style.transform = `rotate(${i * 15}deg)`;
    container.appendChild(tick);
  }
}

// ==================== SEEK ====================
function seekDeck(deckId, event) {
  const deck = decks[deckId];
  const dur = deck.getDuration();
  if (!dur) return;
  const bar = event.currentTarget;
  const rect = bar.getBoundingClientRect();
  const pct = (event.clientX - rect.left) / rect.width;
  deck.seekTo(pct * dur);
}
function seekDeckFromOverview(deckId, event) {
  const deck = decks[deckId];
  const dur = deck.getDuration();
  if (!dur) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const pct = ((event.touches ? event.touches[0].clientX : event.clientX) - rect.left) / rect.width;
  deck.seekTo(Math.max(0, Math.min(1, pct)) * dur);
}

// ==================== QUANTIZE ====================
function toggleQuantize(deckId) {
  decks[deckId].quantize = !decks[deckId].quantize;
  document.getElementById('quantize' + (deckId + 1)).classList.toggle('active', decks[deckId].quantize);
}

function snapToBeat(deck, time) {
  if (!deck.quantize || !deck.bpm) return time;
  const beatDur = 60 / deck.bpm;
  return Math.round(time / beatDur) * beatDur;
}

// ==================== HOT CUES ====================
function handleHotCue(deckId, cueIdx, event) {
  const deck = decks[deckId];
  if (!deck.buffer) return;
  if (event.shiftKey && deck.hotCues[cueIdx] !== null) {
    deck.hotCues[cueIdx] = null;
    updateHotCueButtons(deckId);
    return;
  }
  if (deck.hotCues[cueIdx] === null) {
    deck.hotCues[cueIdx] = snapToBeat(deck, deck.getCurrentTime());
    updateHotCueButtons(deckId);
  } else {
    deck.seekTo(snapToBeat(deck, deck.hotCues[cueIdx]));
  }
}

function updateHotCueButtons(deckId) {
  const deck = decks[deckId];
  document.querySelectorAll(`.hotcue-btn[data-deck="${deckId}"]`).forEach(btn => {
    const idx = parseInt(btn.dataset.cue);
    btn.classList.toggle('set', deck.hotCues[idx] !== null);
  });
}

// ==================== LOOPS ====================
function toggleLoop(deckId, beats, btn) {
  const deck = decks[deckId];
  if (!deck.buffer || !deck.bpm) return;
  if (deck.loopActive && deck.loopBeats === beats) {
    deck.loopActive = false; deck.loopBeats = 0; btn.classList.remove('active'); return;
  }
  document.querySelectorAll(`.loop-btn[data-deck="${deckId}"]`).forEach(b => b.classList.remove('active'));
  const beatDuration = 60 / deck.bpm;
  const currentTime = deck.getCurrentTime();
  deck.loopStart = snapToBeat(deck, currentTime);
  deck.loopEnd = deck.loopStart + beats * beatDuration;
  deck.loopActive = true; deck.loopBeats = beats; btn.classList.add('active');
}

// ==================== HEADPHONE ====================
function toggleHeadphone(deckId) {
  decks[deckId].headphoneCue = !decks[deckId].headphoneCue;
  document.getElementById('headphone' + (deckId + 1)).classList.toggle('active', decks[deckId].headphoneCue);
}

// ==================== NOISE ====================
let noiseOn = false, noiseSource = null;
const noiseGain = actx.createGain();
noiseGain.gain.value = 0; noiseGain.connect(masterGain);
function toggleNoise() {
  noiseOn = !noiseOn;
  if (noiseOn) {
    const bufSize = actx.sampleRate * 2;
    const buf = actx.createBuffer(1, bufSize, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    noiseSource = actx.createBufferSource();
    noiseSource.buffer = buf; noiseSource.loop = true;
    noiseSource.connect(noiseGain); noiseSource.start();
    noiseGain.gain.value = 0.08;
  } else {
    if (noiseSource) { noiseSource.stop(); noiseSource = null; }
    noiseGain.gain.value = 0;
  }
  document.getElementById('noiseToggle').textContent = 'NOISE: ' + (noiseOn ? 'ON' : 'OFF');
  document.getElementById('noiseToggle').classList.toggle('active', noiseOn);
}

// ==================== CROSSFADER ====================
let xfadeCurve = 'smooth';

function setXfadeCurve(curve) {
  xfadeCurve = curve;
  document.querySelectorAll('.xfade-curve-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('xfCurve' + curve.charAt(0).toUpperCase() + curve.slice(1)).classList.add('active');
  updateCrossfader();
}

function updateCrossfader() {
  const val = parseFloat(document.getElementById('crossfader').value);
  let gain1, gain2;
  switch(xfadeCurve) {
    case 'sharp':
      gain1 = val < 0.05 ? 1 : val > 0.95 ? 0 : 1 - val;
      gain2 = val > 0.95 ? 1 : val < 0.05 ? 0 : val;
      gain1 = Math.pow(gain1, 0.3);
      gain2 = Math.pow(gain2, 0.3);
      break;
    case 'power':
      gain1 = Math.cos(val * Math.PI / 2);
      gain2 = Math.sin(val * Math.PI / 2);
      const boost = 1 / Math.sqrt(gain1*gain1 + gain2*gain2 || 1);
      gain1 *= boost;
      gain2 *= boost;
      break;
    default:
      gain1 = Math.cos(val * Math.PI / 2);
      gain2 = Math.sin(val * Math.PI / 2);
      break;
  }
  decks[0].channelGain.gain.value = gain1;
  decks[1].channelGain.gain.value = gain2;
}

// ==================== PHASE METER ====================
function updatePhaseMeter() {
  if (!decks[0].bpm || !decks[1].bpm || !decks[0].playing || !decks[1].playing) {
    document.getElementById('phaseIndicator').style.left = '50%';
    document.getElementById('phaseIndicator').style.background = '#444';
    return;
  }
  const beat0 = 60 / decks[0].bpm;
  const beat1 = 60 / decks[1].bpm;
  const phase0 = (decks[0].getCurrentTime() % beat0) / beat0;
  const phase1 = (decks[1].getCurrentTime() % beat1) / beat1;
  let diff = phase0 - phase1;
  if (diff > 0.5) diff -= 1;
  if (diff < -0.5) diff += 1;
  const pct = 50 + diff * 100;
  const el = document.getElementById('phaseIndicator');
  el.style.left = Math.max(5, Math.min(95, pct)) + '%';
  el.style.background = Math.abs(diff) < 0.05 ? '#0f0' : Math.abs(diff) < 0.15 ? '#ff0' : '#f33';
}

// ==================== VU METERS ====================
function updateVUMeters() {
  for (let i = 0; i < 2; i++) {
    const data = new Uint8Array(decks[i].analyser.frequencyBinCount);
    decks[i].analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let j = 0; j < data.length; j++) sum += data[j];
    const avg = sum / data.length;
    const level = Math.min(1, avg / 100);
    const litCount = Math.floor(level * VU_SEGMENTS);
    const segs = document.getElementById('vu' + (i + 1)).children;
    for (let s = 0; s < VU_SEGMENTS; s++) {
      segs[s].className = 'vu-segment';
      if (s < litCount) {
        if (s >= VU_SEGMENTS * 0.85) segs[s].classList.add('lit-red');
        else if (s >= VU_SEGMENTS * 0.6) segs[s].classList.add('lit-yellow');
        else segs[s].classList.add('lit-green');
      }
    }
  }
}

function updateMeters() {
  for (let i = 0; i < 2; i++) {
    const data = new Uint8Array(decks[i].analyser.frequencyBinCount);
    decks[i].analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let j = 0; j < data.length; j++) sum += data[j];
    const avg = sum / data.length;
    const pct = Math.min(100, (avg / 128) * 100);
    document.getElementById('meter' + (i + 1)).style.height = pct + '%';
  }
}

// ==================== KNOB INTERACTION ====================
let activeKnob = null, knobStartY = 0, knobStartAngle = 0;
const knobAngles = new Map();
let cueMasterMix = 0.5;

document.querySelectorAll('.knob').forEach(knob => {
  knobAngles.set(knob, 0);
  const startHandler = e => {
    activeKnob = knob;
    knobStartY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    knobStartAngle = knobAngles.get(knob);
    e.preventDefault();
  };
  knob.addEventListener('mousedown', startHandler);
  knob.addEventListener('touchstart', startHandler, {passive: false});
});

function knobMove(y) {
  if (!activeKnob) return;
  const delta = (knobStartY - y);
  const currentAngle = knobAngles.get(activeKnob);
  const normalizedPos = Math.abs(currentAngle) / 135;
  const sensitivity = 1.2 + (1 - normalizedPos) * 0.8;
  let angle = Math.max(-135, Math.min(135, knobStartAngle + delta * sensitivity));
  knobAngles.set(activeKnob, angle);
  activeKnob.querySelector('.knob-indicator').style.transform = `translateX(-50%) rotate(${angle}deg)`;
  applyKnob(activeKnob, angle);
}

document.addEventListener('mousemove', e => knobMove(e.clientY));
document.addEventListener('touchmove', e => { if (activeKnob) knobMove(e.touches[0].clientY); }, {passive: true});
document.addEventListener('mouseup', () => { activeKnob = null; });
document.addEventListener('touchend', () => { activeKnob = null; });

function applyKnob(knob, angle) {
  const param = knob.dataset.param;
  const ch = parseInt(knob.dataset.ch);
  const val = angle / 135;
  const deck = decks[ch];

  if (param === 'gain') {
    const db = val * 12;
    deck.trimGain.gain.value = Math.pow(10, db / 20);
    document.getElementById('gainVal' + (ch + 1)).textContent = (db >= 0 ? '+' : '') + db.toFixed(1) + 'dB';
  } else if (param === 'cuemix') {
    cueMasterMix = (val + 1) / 2;
    const label = document.getElementById('cueMasterVal');
    if (cueMasterMix < 0.3) label.textContent = '◀ CUE';
    else if (cueMasterMix > 0.7) label.textContent = 'MST ▶';
    else label.textContent = 'CUE ◆ MST';
  } else if (param === 'fxwet') {
    fxWetDry[ch] = (val + 1) / 2;
    applyFxWetDry(ch);
  } else if (param === 'hi') { deck.eqHi.gain.value = val * 24; }
  else if (param === 'mid') { deck.eqMid.gain.value = val * 24; }
  else if (param === 'lo') { deck.eqLo.gain.value = val * 24; }
  else if (param === 'color') { deck.setColorFilter((val + 1) / 2); }
}

// ==================== JOG WHEELS ====================
let jogAngles = [0, 0];
let jogDragging = null, jogLastY = 0;
let jogLastTime = [0, 0], jogScratchRestore = [null, null];

for (let i = 0; i < 2; i++) {
  const jog = document.getElementById('jog' + (i + 1));
  const deckIdx = i;
  const startHandler = (e) => {
    jogDragging = deckIdx;
    jogLastY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    jog.style.cursor = 'grabbing';
    // Slip mode save
    if (decks[deckIdx].slipMode && decks[deckIdx].playing) {
      decks[deckIdx].slipPosition = decks[deckIdx].getCurrentTime();
      decks[deckIdx].slipStartTime = actx.currentTime;
      decks[deckIdx].slipActive = true;
    }
    e.preventDefault();
  };
  jog.addEventListener('mousedown', startHandler);
  jog.addEventListener('touchstart', startHandler, {passive: false});
}

function jogMove(y) {
  if (jogDragging === null) return;
  const now = performance.now();
  const dt = now - (jogLastTime[jogDragging] || now);
  jogLastTime[jogDragging] = now;
  const delta = (y - jogLastY);
  jogLastY = y;
  const deck = decks[jogDragging];
  if (!deck.playing || !deck.source) return;
  deck.startTime += delta * 0.002;
  const velocity = dt > 0 ? delta / dt : 0;
  const speedMod = velocity * 0.5;
  deck.source.playbackRate.value = Math.max(0, deck.playbackRate + speedMod);
  if (jogScratchRestore[jogDragging]) clearTimeout(jogScratchRestore[jogDragging]);
  jogScratchRestore[jogDragging] = setTimeout(() => {
    if (deck.source) deck.source.playbackRate.value = deck.playbackRate;
  }, 100);
}

document.addEventListener('mousemove', e => jogMove(e.clientY));
document.addEventListener('touchmove', e => { if (jogDragging !== null) jogMove(e.touches[0].clientY); }, {passive: true});

function jogRelease() {
  if (jogDragging !== null) {
    const deck = decks[jogDragging];
    // Slip mode restore
    if (deck.slipActive && deck.slipMode) {
      const elapsed = (actx.currentTime - deck.slipStartTime) * deck.playbackRate;
      deck.seekTo(deck.slipPosition + elapsed);
      deck.slipActive = false;
    }
    document.getElementById('jog' + (jogDragging + 1)).style.cursor = 'grab';
    jogDragging = null;
  }
}
document.addEventListener('mouseup', jogRelease);
document.addEventListener('touchend', jogRelease);

// ==================== FX BUTTON ====================
function toggleFX(btn) {
  const fx = btn.dataset.fx;
  const ch = parseInt(btn.dataset.ch);
  decks[ch].toggleFX(fx);
  btn.classList.toggle('active');
}

// ==================== SLIP MODE ====================
function toggleSlip(deckId) {
  decks[deckId].slipMode = !decks[deckId].slipMode;
  document.getElementById('slip' + (deckId + 1)).classList.toggle('active', decks[deckId].slipMode);
}

// ==================== BPM PULSE & BEAT VISUALS ====================
let lastBeatTime = [0, 0], lastBeatFlash = [0, 0], lastBeatCount = [0, 0];

function updateBPMPulse() {
  for (let i = 0; i < 2; i++) {
    const deck = decks[i];
    if (!deck.playing || !deck.bpm) continue;
    const beatDur = 60 / deck.bpm;
    const t = deck.getCurrentTime();
    const beatPos = t % beatDur;
    if (beatPos < 0.05 && t - lastBeatTime[i] > beatDur * 0.5) {
      lastBeatTime[i] = t;
      const el = document.getElementById('bpm' + (i + 1));
      el.classList.add('pulse');
      setTimeout(() => el.classList.remove('pulse'), 100);
    }
  }
}

function updateBeatFlash() {
  for (let i = 0; i < 2; i++) {
    const deck = decks[i];
    if (!deck.playing || !deck.bpm) continue;
    const beatDur = 60 / deck.bpm;
    const t = deck.getCurrentTime();
    const beatPos = t % beatDur;
    if (beatPos < 0.05 && t - lastBeatFlash[i] > beatDur * 0.5) {
      lastBeatFlash[i] = t;
      const el = document.getElementById('deckEl' + (i + 1));
      el.classList.add('beat-flash');
      setTimeout(() => el.classList.remove('beat-flash'), 80);
    }
  }
}

function updateBeatCounter() {
  for (let i = 0; i < 2; i++) {
    const deck = decks[i];
    if (!deck.playing || !deck.bpm) {
      document.querySelectorAll('#beatCounter' + (i + 1) + ' .beat-dot').forEach(d => d.classList.remove('active'));
      continue;
    }
    const beatDur = 60 / deck.bpm;
    const t = deck.getCurrentTime();
    const beatInBar = Math.floor((t / beatDur) % 4);
    if (beatInBar !== lastBeatCount[i]) {
      lastBeatCount[i] = beatInBar;
      const dots = document.querySelectorAll('#beatCounter' + (i + 1) + ' .beat-dot');
      dots.forEach((d, idx) => d.classList.toggle('active', idx === beatInBar));
    }
  }
}

function updateXfadeColor() {
  const region = document.getElementById('xfadeRegion');
  if (!region) return;
  const levels = [0, 0];
  for (let i = 0; i < 2; i++) {
    const data = new Uint8Array(decks[i].analyser.frequencyBinCount);
    decks[i].analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let j = 0; j < data.length; j++) sum += data[j];
    levels[i] = sum / data.length;
  }
  const total = levels[0] + levels[1];
  if (total < 1) { region.style.background = '#222'; return; }
  const ratio = levels[0] / total;
  region.style.background = `linear-gradient(90deg, rgba(0,170,255,${ratio}), rgba(255,136,0,${1 - ratio}))`;
}

// ==================== UI UPDATE ====================
function updateUI() {
  for (let i = 0; i < 2; i++) {
    const d = decks[i];
    const n = i + 1;
    document.getElementById('play' + n).classList.toggle('active', d.playing);
    document.getElementById('play' + n).textContent = d.playing ? '⏸ PAUSE' : '▶ PLAY';
    document.getElementById('bpm' + n).textContent = d.bpm ? d.bpm.toFixed(1) : '---.-';
    document.getElementById('wfTitle' + n).textContent = d.trackName || 'DECK ' + n;
    document.getElementById('deckEl' + n).classList.toggle('playing-glow', d.playing);
  }
}

function checkLoops() {
  for (const deck of decks) {
    if (deck.loopActive && deck.playing && deck.buffer) {
      if (deck.getCurrentTime() >= deck.loopEnd) deck.seekTo(deck.loopStart);
    }
  }
}

// ==================== TRACK HISTORY ====================
let trackHistory = [];
function addToHistory(deckIdx, trackName) {
  if (!trackName) return;
  const entry = { deck: deckIdx + 1, name: trackName, time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) };
  trackHistory.unshift(entry);
  if (trackHistory.length > 10) trackHistory.pop();
  renderHistory();
}
function renderHistory() {
  const el = document.getElementById('historyEntries');
  el.innerHTML = trackHistory.map(h =>
    `<div class="history-entry"><span class="h-deck ${h.deck===1?'d1':'d2'}">D${h.deck}</span><span class="h-name">${h.name}</span><span class="h-time">${h.time}</span></div>`
  ).join('');
}

// ==================== MARQUEE ====================
function updateMarquee(deckId) {
  const wrapper = document.getElementById('wfMarquee' + (deckId + 1));
  const title = document.getElementById('wfTitle' + (deckId + 1));
  if (!wrapper || !title) return;
  const textWidth = title.scrollWidth;
  const containerWidth = wrapper.offsetWidth || 180;
  wrapper.classList.toggle('scrolling', textWidth > containerWidth && decks[deckId].playing);
}

// ==================== AUTO-CROSSFADE ====================
let autoXfadeInterval = null;
function autoXfade(dir) {
  if (autoXfadeInterval) { clearInterval(autoXfadeInterval); autoXfadeInterval = null; document.getElementById('autoXfadeL').classList.remove('active'); document.getElementById('autoXfadeR').classList.remove('active'); return; }
  const target = dir === 'left' ? 0 : 1;
  const cf = document.getElementById('crossfader');
  const btn = dir === 'left' ? document.getElementById('autoXfadeL') : document.getElementById('autoXfadeR');
  btn.classList.add('active');
  const duration = 8000, steps = 160, stepMs = duration / steps;
  const startVal = parseFloat(cf.value);
  let step = 0;
  autoXfadeInterval = setInterval(() => {
    step++;
    cf.value = startVal + (target - startVal) * (step / steps);
    cf.dispatchEvent(new Event('input'));
    if (step >= steps) { clearInterval(autoXfadeInterval); autoXfadeInterval = null; btn.classList.remove('active'); }
  }, stepMs);
}

function updateXfadeHint() {
  const hint = document.getElementById('xfadeHint');
  if (decks[0].buffer && decks[1].buffer && decks[0].bpm && decks[1].bpm) {
    const bpmDiff = Math.abs(decks[0].bpm - decks[1].bpm);
    hint.textContent = bpmDiff < 3 ? '✓ BPMs close — good for crossfade' : '⚠ BPM gap: ' + bpmDiff.toFixed(1);
  } else {
    hint.textContent = '';
  }
}

// ==================== THEME ====================
let currentTheme = localStorage.getItem('xdj-theme') || 'dark';
function applyTheme() {
  document.body.classList.toggle('light-theme', currentTheme === 'light');
  document.getElementById('themeBtn').textContent = currentTheme === 'dark' ? '☀️ LIGHT' : '🌙 DARK';
}
function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('xdj-theme', currentTheme);
  applyTheme();
}
applyTheme();

// ==================== TRACK BROWSER ====================
let allTracks = [];
let currentSort = 'date';

function sortTracks(by, btn) {
  currentSort = by;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderTrackList();
}

function renderTrackList() {
  const sorted = [...allTracks];
  if (currentSort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
  else if (currentSort === 'size') sorted.sort((a, b) => b.size - a.size);
  else sorted.sort((a, b) => b.mtime - a.mtime);
  const list = document.getElementById('trackList');
  const query = (document.getElementById('trackSearch').value || '').toLowerCase();
  list.innerHTML = '';
  sorted.forEach(t => {
    const cn = cleanTrackName(t.name);
    if (query && !cn.toLowerCase().includes(query)) return;
    const div = document.createElement('div');
    div.className = 'track-item';
    div.draggable = true;
    div.dataset.trackName = encodeURIComponent(t.name);
    div.innerHTML = `<span class="name" title="${t.name}">${cn}</span><div class="load-btns"><button class="load-btn d1" onclick="event.stopPropagation();loadToDeck(0,'${encodeURIComponent(t.name)}')">D1</button><button class="load-btn d2" onclick="event.stopPropagation();loadToDeck(1,'${encodeURIComponent(t.name)}')">D2</button></div>`;
    div.ondblclick = () => { const freeDeck = !decks[0].buffer ? 0 : !decks[1].buffer ? 1 : 0; loadToDeck(freeDeck, encodeURIComponent(t.name)); };
    div.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', encodeURIComponent(t.name)); e.dataTransfer.effectAllowed = 'copy'; });
    list.appendChild(div);
  });
}

function filterTracks(query) { renderTrackList(); }

async function loadTracks() {
  try {
    const resp = await fetch('/api/tracks');
    allTracks = await resp.json();
    renderTrackList();
    document.getElementById('status').textContent = allTracks.length + ' tracks loaded';
  } catch(e) {
    showError('Failed to load track list');
    document.getElementById('status').textContent = 'Error loading tracks';
  }
}

async function loadToDeck(deckId, encodedName) {
  const name = decodeURIComponent(encodedName);
  showLoadingSpinner(deckId);
  document.getElementById('status').textContent = 'Loading: ' + cleanTrackName(name) + '...';
  try {
    await decks[deckId].loadTrack('/tracks/' + encodedName, cleanTrackName(name));
    document.getElementById('status').textContent = 'Loaded to Deck ' + (deckId + 1);
    saveDeckState();
    updateUI();
  } catch(e) {
    console.error('Load error:', e);
    showError('Failed to load: ' + cleanTrackName(name) + ' — ' + (e.message || 'Unknown error'));
    document.getElementById('status').textContent = 'Error loading track';
  } finally {
    hideLoadingSpinner(deckId);
  }
}

loadTracks();

// ==================== DRAG AND DROP ====================
for (let i = 0; i < 2; i++) {
  const deckEl = document.getElementById('deckEl' + (i + 1));
  deckEl.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; deckEl.classList.add('drag-over'); });
  deckEl.addEventListener('dragleave', () => deckEl.classList.remove('drag-over'));
  deckEl.addEventListener('drop', (e) => {
    e.preventDefault();
    deckEl.classList.remove('drag-over');
    const trackName = e.dataTransfer.getData('text/plain');
    if (trackName) loadToDeck(i, trackName);
  });
}

// ==================== DECK STATE PERSISTENCE ====================
function saveDeckState() {
  try {
    const state = {
      decks: decks.map((d, i) => ({
        trackUrl: d._lastUrl || null,
        trackName: d.trackName,
        offset: d.getCurrentTime(),
        volume: document.getElementById('vol' + (i + 1)).value,
        tempo: document.getElementById('tempo' + (i + 1)).value,
        crossfader: document.getElementById('crossfader').value,
        masterVol: document.getElementById('masterVol').value
      }))
    };
    localStorage.setItem('xdj-deck-state', JSON.stringify(state));
  } catch(e) {}
}

function restoreDeckState() {
  try {
    const raw = localStorage.getItem('xdj-deck-state');
    if (!raw) return;
    const state = JSON.parse(raw);
    if (!state.decks) return;
    state.decks.forEach((ds, i) => {
      if (ds.volume) { document.getElementById('vol' + (i + 1)).value = ds.volume; decks[i].gainNode.gain.value = parseFloat(ds.volume); }
      if (ds.tempo) { document.getElementById('tempo' + (i + 1)).value = ds.tempo; decks[i].setTempo(parseFloat(ds.tempo)); document.getElementById('tempoVal' + (i + 1)).textContent = parseFloat(ds.tempo).toFixed(1) + '%'; }
    });
    if (state.decks[0] && state.decks[0].crossfader) { document.getElementById('crossfader').value = state.decks[0].crossfader; updateCrossfader(); }
    if (state.decks[0] && state.decks[0].masterVol) { document.getElementById('masterVol').value = state.decks[0].masterVol; masterGain.gain.value = parseFloat(state.decks[0].masterVol); document.getElementById('masterVal').textContent = Math.round(parseFloat(state.decks[0].masterVol) * 100) + '%'; }
  } catch(e) {}
}
restoreDeckState();
setInterval(saveDeckState, 5000);
window.addEventListener('beforeunload', saveDeckState);

// ==================== SHORTCUTS ====================
function toggleShortcuts() { document.getElementById('shortcutsOverlay').classList.toggle('open'); }

// ==================== MIX RECORDING ====================
let mixRecording = false, mixMediaRecorder = null, mixChunks = [];

function toggleMixRecording() { if (!mixRecording) startMixRecording(); else stopMixRecording(); }

function startMixRecording() {
  try {
    const dest = actx.createMediaStreamDestination();
    limiterNode.connect(dest);
    const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : {};
    mixMediaRecorder = new MediaRecorder(dest.stream, options);
    mixChunks = [];
    mixMediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) mixChunks.push(e.data); };
    mixMediaRecorder.onstop = () => {
      const blob = new Blob(mixChunks, { type: mixMediaRecorder.mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = (mixMediaRecorder.mimeType || '').includes('webm') ? 'webm' : 'wav';
      a.download = 'dj-mix-' + new Date().toISOString().slice(0,19).replace(/:/g,'-') + '.' + ext;
      a.click();
      URL.revokeObjectURL(url);
      try { limiterNode.disconnect(dest); } catch(e) {}
    };
    mixMediaRecorder.start(1000);
    mixRecording = true;
    const btn = document.getElementById('recMixBtn');
    btn.classList.add('recording');
    btn.innerHTML = '<span class="rec-dot"></span> STOP MIX';
  } catch(e) { showError('Mix recording failed: ' + e.message); }
}

function stopMixRecording() {
  if (mixMediaRecorder && mixMediaRecorder.state !== 'inactive') mixMediaRecorder.stop();
  mixRecording = false;
  const btn = document.getElementById('recMixBtn');
  btn.classList.remove('recording');
  btn.innerHTML = '<span class="rec-dot"></span> REC MIX';
}

// ==================== PLAYLISTS ====================
let currentPlaylistId = null;
let currentPlaylistTracks = [];

async function loadPlaylists() {
  try {
    const r = await fetch('/api/playlists');
    const playlists = await r.json();
    const sel = document.getElementById('playlistSelect');
    const curVal = sel.value;
    sel.innerHTML = '<option value="">— select playlist —</option>';
    playlists.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name + ' (' + (p.tracks ? p.tracks.length : 0) + ')';
      sel.appendChild(o);
    });
    if (curVal) sel.value = curVal;
  } catch(e) { console.error('Failed to load playlists:', e); }
}

async function createPlaylist() {
  const nameInput = document.getElementById('newPlaylistName');
  const name = nameInput.value.trim();
  if (!name) { showError('Enter a playlist name'); return; }
  try {
    const r = await fetch('/api/playlists', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, tracks: [] }) });
    const data = await r.json();
    nameInput.value = '';
    await loadPlaylists();
    if (Array.isArray(data) && data[0]) {
      document.getElementById('playlistSelect').value = data[0].id;
      loadPlaylist(data[0].id);
    }
  } catch(e) { showError('Failed to create playlist: ' + e.message); }
}

async function loadPlaylist(id) {
  if (!id) { currentPlaylistId = null; currentPlaylistTracks = []; renderPlaylistEntries(); return; }
  try {
    const r = await fetch('/api/playlists');
    const playlists = await r.json();
    const pl = playlists.find(p => p.id == id);
    if (pl) { currentPlaylistId = pl.id; currentPlaylistTracks = pl.tracks || []; renderPlaylistEntries(); }
  } catch(e) { console.error(e); }
}

function renderPlaylistEntries() {
  const container = document.getElementById('playlistEntries');
  container.innerHTML = '';
  currentPlaylistTracks.forEach((track, idx) => {
    const div = document.createElement('div');
    div.className = 'pl-entry';
    div.draggable = true;
    div.dataset.idx = idx;
    div.innerHTML = `<span class="pl-num">${idx + 1}.</span><span class="pl-name" title="${track}">${cleanTrackName(track)}</span><div class="pl-actions"><button class="load-btn d1" onclick="event.stopPropagation();loadToDeck(0,'${encodeURIComponent(track)}')">D1</button><button class="load-btn d2" onclick="event.stopPropagation();loadToDeck(1,'${encodeURIComponent(track)}')">D2</button><button class="pl-remove" onclick="removeFromPlaylist(${idx})">✕</button></div>`;
    div.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/playlist-idx', idx.toString()); });
    div.addEventListener('dragover', (e) => { e.preventDefault(); });
    div.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIdx = parseInt(e.dataTransfer.getData('text/playlist-idx'));
      if (!isNaN(fromIdx) && fromIdx !== idx) {
        const item = currentPlaylistTracks.splice(fromIdx, 1)[0];
        currentPlaylistTracks.splice(idx, 0, item);
        savePlaylist();
        renderPlaylistEntries();
      }
    });
    container.appendChild(div);
  });
}

async function addTrackToPlaylist(deckIdx) {
  if (!currentPlaylistId) { showError('Select or create a playlist first'); return; }
  const deck = decks[deckIdx];
  const original = allTracks.find(t => cleanTrackName(t.name) === deck.trackName);
  const trackFile = original ? original.name : deck.trackName;
  if (!trackFile) { showError('No track loaded on Deck ' + (deckIdx + 1)); return; }
  currentPlaylistTracks.push(trackFile);
  await savePlaylist();
  renderPlaylistEntries();
}

async function removeFromPlaylist(idx) {
  currentPlaylistTracks.splice(idx, 1);
  await savePlaylist();
  renderPlaylistEntries();
}

async function savePlaylist() {
  if (!currentPlaylistId) return;
  try {
    await fetch('/api/playlists/' + currentPlaylistId, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ tracks: currentPlaylistTracks }) });
    loadPlaylists();
  } catch(e) { showError('Failed to save playlist'); }
}

async function deleteCurrentPlaylist() {
  if (!currentPlaylistId) return;
  if (!confirm('Delete this playlist?')) return;
  try {
    await fetch('/api/playlists/' + currentPlaylistId, { method: 'DELETE' });
    currentPlaylistId = null;
    currentPlaylistTracks = [];
    renderPlaylistEntries();
    await loadPlaylists();
  } catch(e) { showError('Failed to delete playlist'); }
}

loadPlaylists();

// ==================== TAP BPM ====================
const tapTimes = [[], []];

function tapBPM(deckId) {
  const now = performance.now();
  const taps = tapTimes[deckId];
  if (taps.length > 0 && now - taps[taps.length - 1] > 3000) taps.length = 0;
  taps.push(now);
  if (taps.length > 8) taps.shift();
  if (taps.length >= 2) {
    let totalInterval = 0;
    for (let i = 1; i < taps.length; i++) totalInterval += taps[i] - taps[i-1];
    const bpm = 60000 / (totalInterval / (taps.length - 1));
    decks[deckId].bpm = Math.round(bpm * 10) / 10;
    document.getElementById('bpm' + (deckId + 1)).textContent = decks[deckId].bpm.toFixed(1);
    document.getElementById('tapInfo' + (deckId + 1)).textContent = decks[deckId].bpm.toFixed(1) + ' BPM (' + taps.length + ' taps)';
  } else {
    document.getElementById('tapInfo' + (deckId + 1)).textContent = 'tap again...';
  }
  const btn = document.getElementById('tap' + (deckId + 1));
  btn.style.background = '#333';
  setTimeout(() => btn.style.background = '', 100);
}

// ==================== DECK SWAP ====================
function swapDecks() {
  const states = [];
  for (let i = 0; i < 2; i++) {
    const d = decks[i];
    states.push({
      buffer: d.buffer, trackName: d.trackName, offset: d.getCurrentTime(),
      playing: d.playing, bpm: d.bpm, hotCues: [...d.hotCues], cuePoint: d.cuePoint,
      loopActive: d.loopActive, loopStart: d.loopStart, loopEnd: d.loopEnd, loopBeats: d.loopBeats,
      playbackRate: d.playbackRate, wfFreqData: d.wfFreqData,
      introMarker: d.introMarker, outroMarker: d.outroMarker,
      _lastUrl: d._lastUrl, trimGainVal: d.trimGain ? d.trimGain.gain.value : 1
    });
    d.stop();
  }
  for (let i = 0; i < 2; i++) {
    const src = states[1 - i];
    const d = decks[i];
    Object.assign(d, { buffer: src.buffer, trackName: src.trackName, offset: src.offset,
      bpm: src.bpm, hotCues: src.hotCues, cuePoint: src.cuePoint,
      loopActive: src.loopActive, loopStart: src.loopStart, loopEnd: src.loopEnd, loopBeats: src.loopBeats,
      playbackRate: src.playbackRate, wfFreqData: src.wfFreqData,
      introMarker: src.introMarker, outroMarker: src.outroMarker, _lastUrl: src._lastUrl });
    if (d.trimGain) d.trimGain.gain.value = src.trimGainVal;
    if (d.buffer) { drawOverviewWaveform(d); drawStaticWaveform(d); }
    updateHotCueButtons(i);
    const tempoPercent = (src.playbackRate - 1) * 100;
    document.getElementById('tempo' + (i+1)).value = Math.max(-8, Math.min(8, tempoPercent));
    document.getElementById('tempoVal' + (i+1)).textContent = tempoPercent.toFixed(1) + '%';
    if (src.playing) d.play();
  }
  updateUI(); updateHarmonicDisplay();
  const btn = document.getElementById('swapBtn');
  btn.style.color = '#f0f'; btn.style.borderColor = '#f0f';
  setTimeout(() => { btn.style.color = ''; btn.style.borderColor = ''; }, 300);
}

// ==================== MINI-MIXER ====================
let miniMixerActive = false;
function toggleMiniMixer() {
  miniMixerActive = !miniMixerActive;
  document.body.classList.toggle('mini-mixer', miniMixerActive);
  document.getElementById('miniToggle').classList.toggle('active', miniMixerActive);
  setTimeout(() => { decks.forEach(d => { if (d.buffer) { drawOverviewWaveform(d); drawStaticWaveform(d); } }); }, 350);
}

// ==================== BEEP WARNING ====================
let beepWarningEnabled = false;
let lastBeepTime = [0, 0];
const beepBuffer = (function() {
  const sr = actx.sampleRate;
  const len = Math.floor(sr * 0.15);
  const buf = actx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const env = t < 0.01 ? t / 0.01 : t > 0.12 ? (0.15 - t) / 0.03 : 1;
    d[i] = Math.sin(2 * Math.PI * 1000 * t) * env * 0.3;
  }
  return buf;
})();

function toggleBeepWarning() {
  beepWarningEnabled = !beepWarningEnabled;
  document.getElementById('beepToggle').classList.toggle('active', beepWarningEnabled);
}

function checkTrackEndWarning() {
  for (let i = 0; i < 2; i++) {
    const deck = decks[i];
    if ((!deck.buffer && !deck._streamAudio) || !deck.playing) {
      document.getElementById('wfTime' + (i+1)).classList.remove('time-warning', 'time-critical');
      continue;
    }
    const remaining = deck.getDuration() - deck.getCurrentTime();
    const timeEl = document.getElementById('wfTime' + (i+1));
    if (remaining < 10) {
      timeEl.classList.remove('time-warning'); timeEl.classList.add('time-critical');
      if (beepWarningEnabled && performance.now() - lastBeepTime[i] > 2000) {
        lastBeepTime[i] = performance.now();
        const src = actx.createBufferSource(); src.buffer = beepBuffer; src.connect(actx.destination); src.start();
      }
    } else if (remaining < 30) {
      timeEl.classList.add('time-warning'); timeEl.classList.remove('time-critical');
    } else {
      timeEl.classList.remove('time-warning', 'time-critical');
    }
  }
}

// ==================== EVENT LISTENERS (consolidated) ====================
document.getElementById('play1').onclick = () => decks[0].togglePlay();
document.getElementById('play2').onclick = () => decks[1].togglePlay();
document.getElementById('cue1').onclick = () => decks[0].cue();
document.getElementById('cue2').onclick = () => decks[1].cue();
document.getElementById('sync1').onclick = () => { decks[0].sync(decks[1]); document.getElementById('sync1').classList.add('active'); setTimeout(() => document.getElementById('sync1').classList.remove('active'), 500); };
document.getElementById('sync2').onclick = () => { decks[1].sync(decks[0]); document.getElementById('sync2').classList.add('active'); setTimeout(() => document.getElementById('sync2').classList.remove('active'), 500); };
document.getElementById('tempo1').oninput = e => { decks[0].setTempo(parseFloat(e.target.value)); document.getElementById('tempoVal1').textContent = parseFloat(e.target.value).toFixed(1) + '%'; };
document.getElementById('tempo2').oninput = e => { decks[1].setTempo(parseFloat(e.target.value)); document.getElementById('tempoVal2').textContent = parseFloat(e.target.value).toFixed(1) + '%'; };
document.getElementById('vol1').oninput = e => decks[0].gainNode.gain.value = parseFloat(e.target.value);
document.getElementById('vol2').oninput = e => decks[1].gainNode.gain.value = parseFloat(e.target.value);
document.getElementById('crossfader').oninput = () => { updateCrossfader(); detectTransition(); };
document.getElementById('masterVol').oninput = e => {
  masterGain.gain.value = parseFloat(e.target.value);
  document.getElementById('masterVal').textContent = Math.round(parseFloat(e.target.value) * 100) + '%';
};

// Consolidated keyboard handler
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  switch(e.key) {
    case 'q': decks[0].togglePlay(); break;
    case 'w': decks[0].cue(); break;
    case 'p': decks[1].togglePlay(); break;
    case 'o': decks[1].cue(); break;
    case 'e': decks[0].sync(decks[1]); break;
    case 'i': decks[1].sync(decks[0]); break;
    case '1': handleHotCue(0,0,e); break;
    case '2': handleHotCue(0,1,e); break;
    case '3': handleHotCue(0,2,e); break;
    case '4': handleHotCue(0,3,e); break;
    case '7': handleHotCue(1,0,e); break;
    case '8': handleHotCue(1,1,e); break;
    case '9': handleHotCue(1,2,e); break;
    case '0': handleHotCue(1,3,e); break;
    case 'z': nudgeDeck(0,-1); setTimeout(()=>nudgeRelease(0),200); break;
    case 'x': nudgeDeck(0,1); setTimeout(()=>nudgeRelease(0),200); break;
    case ',': nudgeDeck(1,-1); setTimeout(()=>nudgeRelease(1),200); break;
    case '.': nudgeDeck(1,1); setTimeout(()=>nudgeRelease(1),200); break;
    case 'b': togglePerformanceMode(); break;
    case '?': toggleShortcuts(); break;
    case ' ':
      e.preventDefault();
      const cf = parseFloat(document.getElementById('crossfader').value);
      autoXfade(cf < 0.5 ? 'right' : 'left');
      break;
  }
});

// Waveform scroll zoom
for (let i = 0; i < 2; i++) {
  document.getElementById('wf' + (i + 1)).addEventListener('wheel', (e) => {
    e.preventDefault();
    wfZoom(i, e.deltaY < 0 ? 1 : -1);
  }, { passive: false });
}

// Window resize
window.addEventListener('resize', () => { decks.forEach(d => { if (d.buffer) { drawOverviewWaveform(d); drawStaticWaveform(d); } }); });

// ==================== EQ KILL SWITCHES ====================
const eqKillState = [{hi:false,mid:false,lo:false},{hi:false,mid:false,lo:false}];
const eqKillSavedGain = [{hi:0,mid:0,lo:0},{hi:0,mid:0,lo:0}];

function toggleEqKill(ch, band, btn) {
  const deck = decks[ch];
  const node = band === 'hi' ? deck.eqHi : band === 'mid' ? deck.eqMid : deck.eqLo;
  if (!eqKillState[ch][band]) {
    eqKillSavedGain[ch][band] = node.gain.value;
    node.gain.value = -60;
    eqKillState[ch][band] = true;
    btn.classList.add('active');
  } else {
    node.gain.value = eqKillSavedGain[ch][band];
    eqKillState[ch][band] = false;
    btn.classList.remove('active');
  }
}

// ==================== VINYL BRAKE ====================
const vinylBrakeEnabled = [false, false];

function toggleVinylBrake(deckId) {
  vinylBrakeEnabled[deckId] = !vinylBrakeEnabled[deckId];
  document.getElementById('vinyl' + (deckId + 1)).classList.toggle('active', vinylBrakeEnabled[deckId]);
}

// Override stop to support vinyl brake
const _originalStop = Deck.prototype.stop;
Deck.prototype.stop = function() {
  if (vinylBrakeEnabled[this.id] && this.playing) {
    // Vinyl brake: gradually slow down
    const deck = this;
    const audio = deck._streamAudio;
    const startRate = deck.playbackRate;
    const duration = 800; // ms
    const startTime = performance.now();
    deck._vinylBraking = true;

    function brakeStep() {
      if (!deck._vinylBraking) return;
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out curve for natural vinyl stop feel
      const rate = startRate * (1 - progress * progress);
      if (audio) {
        audio.playbackRate = Math.max(0.01, rate);
      } else if (deck.source) {
        deck.source.playbackRate.value = Math.max(0.01, rate);
      }
      if (progress >= 1) {
        deck._vinylBraking = false;
        _originalStop.call(deck);
        // Restore playback rate for next play
        if (audio) audio.playbackRate = deck.playbackRate;
        return;
      }
      requestAnimationFrame(brakeStep);
    }
    brakeStep();
  } else {
    _originalStop.call(this);
  }
};

// ==================== REVERSE PLAY ====================
function startReverse(deckId) {
  const deck = decks[deckId];
  if (!deck.playing || !deck._streamAudio) return;
  // Web Audio API doesn't support negative playbackRate on MediaElement
  // We'll simulate by rapidly seeking backwards
  deck._reversing = true;
  deck._reverseInterval = setInterval(() => {
    if (!deck._reversing || !deck.playing) { clearInterval(deck._reverseInterval); return; }
    const t = deck.getCurrentTime();
    const step = (1 / 30) * deck.playbackRate; // ~1 frame worth of audio backward
    deck.seekTo(Math.max(0, t - step * 2));
  }, 33);
  document.getElementById('reverse' + (deckId + 1)).classList.add('active');
}

function stopReverse(deckId) {
  const deck = decks[deckId];
  deck._reversing = false;
  if (deck._reverseInterval) clearInterval(deck._reverseInterval);
  document.getElementById('reverse' + (deckId + 1)).classList.remove('active');
}

// ==================== BEAT JUMP ====================
function beatJump(deckId, beats) {
  const deck = decks[deckId];
  if (!deck.bpm) return;
  const beatDur = 60 / deck.bpm;
  const jumpAmount = beats * beatDur;
  const newTime = deck.getCurrentTime() + jumpAmount;
  deck.seekTo(Math.max(0, Math.min(newTime, deck.getDuration())));
}

// ==================== PARALLEL WAVEFORMS ====================
let parallelWaveformsEnabled = false;

function toggleParallelWaveforms() {
  parallelWaveformsEnabled = !parallelWaveformsEnabled;
  document.getElementById('parallelWfBtn').classList.toggle('active', parallelWaveformsEnabled);
  document.getElementById('parallelWaveforms').style.display = parallelWaveformsEnabled ? '' : 'none';
  if (parallelWaveformsEnabled) {
    // Initial draw
    drawParallelWaveforms();
  }
}

function drawParallelWaveforms() {
  if (!parallelWaveformsEnabled) return;
  for (let i = 0; i < 2; i++) {
    const deck = decks[i];
    const canvas = document.getElementById('pwfCanvas' + (i + 1));
    if (!canvas) continue;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    const mid = canvas.height / 2;
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!deck.buffer) continue;

    const data = deck.buffer.getChannelData(0);
    const duration = deck.buffer.duration;
    const currentTime = deck.getCurrentTime();

    // Show 16 seconds centered on playhead
    const windowSec = 16;
    let startSec = currentTime - windowSec / 2;
    let endSec = currentTime + windowSec / 2;
    if (startSec < 0) { endSec -= startSec; startSec = 0; }
    if (endSec > duration) { startSec -= (endSec - duration); endSec = duration; startSec = Math.max(0, startSec); }

    const startSample = Math.floor((startSec / duration) * data.length);
    const endSample = Math.floor((endSec / duration) * data.length);
    const sampleRange = endSample - startSample;

    const color = i === 0 ? {r:0,g:170,b:255} : {r:255,g:136,b:0};

    for (let x = 0; x < canvas.width; x++) {
      const sStart = startSample + Math.floor(x * sampleRange / canvas.width);
      const sEnd = startSample + Math.floor((x + 1) * sampleRange / canvas.width);
      let min = 1, max = -1;
      for (let j = sStart; j < sEnd && j < data.length; j++) {
        if (data[j] < min) min = data[j];
        if (data[j] > max) max = data[j];
      }
      const amp = Math.abs(max - min);
      const alpha = 0.3 + amp * 0.7;
      ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${alpha})`;
      ctx.fillRect(x, mid + min * mid, 1, Math.max(1, (max - min) * mid));
    }

    // Beat grid
    if (deck.bpm > 0) {
      const beatDur = 60 / deck.bpm;
      const firstBeat = Math.ceil(startSec / beatDur);
      const lastBeat = Math.floor(endSec / beatDur);
      for (let bt = firstBeat; bt <= lastBeat; bt++) {
        const btTime = bt * beatDur;
        const bx = ((btTime - startSec) / (endSec - startSec)) * canvas.width;
        ctx.strokeStyle = bt % 4 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, canvas.height); ctx.stroke();
      }
    }

    // Playhead
    const phX = ((currentTime - startSec) / (endSec - startSec)) * canvas.width;
    ctx.fillStyle = '#fff';
    ctx.fillRect(phX, 0, 2, canvas.height);
  }
}

// ==================== AUTO-MIX TRANSITIONS ====================
let autoMixRunning = null;

function autoMixTransition(type) {
  if (autoMixRunning) { clearInterval(autoMixRunning); autoMixRunning = null; document.querySelectorAll('.automix-btn').forEach(b => b.classList.remove('running')); return; }

  const cf = document.getElementById('crossfader');
  const currentVal = parseFloat(cf.value);
  const fromDeck = currentVal < 0.5 ? 0 : 1;
  const toDeck = 1 - fromDeck;
  const targetVal = toDeck === 1 ? 1 : 0;
  const btn = event.target;
  btn.classList.add('running');

  if (type === 'cutSwap') {
    // Instant cut
    cf.value = targetVal;
    cf.dispatchEvent(new Event('input'));
    btn.classList.remove('running');
    return;
  }

  if (type === 'echoOut') {
    // Enable echo on outgoing deck, crossfade over 4 seconds
    const echoBtn = document.querySelector(`.fx-btn[data-fx="echo"][data-ch="${fromDeck}"]`);
    if (echoBtn && !echoBtn.classList.contains('active')) { echoBtn.click(); }
    const duration = 4000;
    const steps = 80;
    const stepMs = duration / steps;
    let step = 0;
    autoMixRunning = setInterval(() => {
      step++;
      cf.value = currentVal + (targetVal - currentVal) * (step / steps);
      cf.dispatchEvent(new Event('input'));
      // Fade volume of outgoing deck
      decks[fromDeck].gainNode.gain.value = 0.85 * (1 - step / steps);
      if (step >= steps) {
        clearInterval(autoMixRunning); autoMixRunning = null; btn.classList.remove('running');
        // Disable echo
        if (echoBtn && echoBtn.classList.contains('active')) echoBtn.click();
        decks[fromDeck].gainNode.gain.value = 0.85;
      }
    }, stepMs);
    return;
  }

  if (type === 'smooth16') {
    // 16-bar blend with EQ transition and visual progress
    const bpm = decks[toDeck].bpm || decks[fromDeck].bpm || 128;
    const barDuration = (60 / bpm) * 4;
    const duration = barDuration * 16 * 1000;
    const steps = 200;
    const stepMs = duration / steps;
    let step = 0;
    const progressEl = document.getElementById('automixProgress');
    const progressFill = document.getElementById('automixProgressFill');
    const progressText = document.getElementById('automixProgressText');
    progressEl.style.display = '';
    
    // Save original EQ values for incoming deck
    const savedEqHi = decks[toDeck].eqHi.gain.value;
    const savedEqMid = decks[toDeck].eqMid.gain.value;
    const savedEqLo = decks[toDeck].eqLo.gain.value;
    // Start with incoming deck EQ killed
    decks[toDeck].eqHi.gain.value = -24;
    decks[toDeck].eqMid.gain.value = -24;
    decks[toDeck].eqLo.gain.value = -24;
    
    autoMixRunning = setInterval(() => {
      step++;
      const progress = step / steps;
      const sCurve = progress * progress * (3 - 2 * progress);
      cf.value = currentVal + (targetVal - currentVal) * sCurve;
      cf.dispatchEvent(new Event('input'));
      
      // EQ transition phases: bass (0-33%), mids (33-66%), highs (66-100%)
      if (progress < 0.33) {
        const p = progress / 0.33;
        decks[toDeck].eqLo.gain.value = -24 + (savedEqLo + 24) * p;
      } else {
        decks[toDeck].eqLo.gain.value = savedEqLo;
      }
      if (progress >= 0.33 && progress < 0.66) {
        const p = (progress - 0.33) / 0.33;
        decks[toDeck].eqMid.gain.value = -24 + (savedEqMid + 24) * p;
      } else if (progress >= 0.66) {
        decks[toDeck].eqMid.gain.value = savedEqMid;
      }
      if (progress >= 0.66) {
        const p = (progress - 0.66) / 0.34;
        decks[toDeck].eqHi.gain.value = -24 + (savedEqHi + 24) * p;
      }
      
      // Cut outgoing deck EQ in reverse order
      if (progress >= 0.5) {
        const p = (progress - 0.5) / 0.5;
        decks[fromDeck].eqHi.gain.value = -24 * p;
        if (progress >= 0.7) decks[fromDeck].eqMid.gain.value = -24 * ((progress - 0.7) / 0.3);
        if (progress >= 0.85) decks[fromDeck].eqLo.gain.value = -24 * ((progress - 0.85) / 0.15);
      }
      
      // Update progress indicator
      const barsRemaining = Math.ceil((1 - progress) * 16);
      const phase = progress < 0.33 ? 'BASS' : progress < 0.66 ? 'MIDS' : 'HIGHS';
      progressFill.style.width = (progress * 100) + '%';
      progressText.textContent = phase + ' · ' + barsRemaining + ' bars';
      
      if (step >= steps) {
        clearInterval(autoMixRunning); autoMixRunning = null; btn.classList.remove('running');
        progressEl.style.display = 'none';
        // Restore EQ on both decks
        decks[toDeck].eqHi.gain.value = savedEqHi;
        decks[toDeck].eqMid.gain.value = savedEqMid;
        decks[toDeck].eqLo.gain.value = savedEqLo;
        decks[fromDeck].eqHi.gain.value = 0;
        decks[fromDeck].eqMid.gain.value = 0;
        decks[fromDeck].eqLo.gain.value = 0;
      }
    }, stepMs);
    return;
  }
}

// ==================== TRACK BPM DISPLAY IN BROWSER ====================
// Cache of track BPMs from server
const trackBPMCache = {};

async function loadTrackBPMs() {
  for (const t of allTracks) {
    try {
      const resp = await fetch('/api/tracks/' + encodeURIComponent(t.name) + '/info');
      if (resp.ok) {
        const info = await resp.json();
        if (info.bpm) trackBPMCache[t.name] = info.bpm;
      }
    } catch {}
  }
  renderTrackList();
}

// Override renderTrackList to include BPM
const _originalRenderTrackList = renderTrackList;
renderTrackList = function() {
  const sorted = [...allTracks];
  if (currentSort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
  else if (currentSort === 'size') sorted.sort((a, b) => b.size - a.size);
  else sorted.sort((a, b) => b.mtime - a.mtime);
  const list = document.getElementById('trackList');
  const query = (document.getElementById('trackSearch').value || '').toLowerCase();
  list.innerHTML = '';

  // Get reference BPM from playing deck
  let refBPM = null;
  for (let i = 0; i < 2; i++) {
    if (decks[i].playing && decks[i].bpm) { refBPM = decks[i].bpm; break; }
  }
  if (!refBPM) {
    for (let i = 0; i < 2; i++) { if (decks[i].bpm) { refBPM = decks[i].bpm; break; } }
  }

  sorted.forEach(t => {
    const cn = cleanTrackName(t.name);
    if (query && !cn.toLowerCase().includes(query)) return;
    const div = document.createElement('div');
    div.className = 'track-item';
    div.draggable = true;
    div.dataset.trackName = encodeURIComponent(t.name);

    // BPM indicator
    const bpm = trackBPMCache[t.name];
    let bpmHtml = '';
    if (bpm) {
      let colorClass = 'bpm-neutral';
      if (refBPM) {
        const diff = Math.abs(bpm - refBPM);
        if (diff < 3) colorClass = 'bpm-green';
        else if (diff < 8) colorClass = 'bpm-yellow';
        else colorClass = 'bpm-red';
      }
      bpmHtml = `<span class="track-bpm ${colorClass}">${bpm.toFixed(0)}</span>`;
    }

    div.innerHTML = `<span class="name" title="${t.name}">${cn}</span>${bpmHtml}<div class="load-btns"><button class="load-btn d1" onclick="event.stopPropagation();loadToDeck(0,'${encodeURIComponent(t.name)}')">D1</button><button class="load-btn d2" onclick="event.stopPropagation();loadToDeck(1,'${encodeURIComponent(t.name)}')">D2</button></div>`;
    div.ondblclick = () => { const freeDeck = !decks[0].buffer ? 0 : !decks[1].buffer ? 1 : 0; loadToDeck(freeDeck, encodeURIComponent(t.name)); };
    div.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', encodeURIComponent(t.name)); e.dataTransfer.effectAllowed = 'copy'; });
    list.appendChild(div);
  });
};

// Load BPMs after tracks load (with delay to not slow initial load)
setTimeout(() => { if (allTracks.length > 0) loadTrackBPMs(); }, 2000);

// ==================== SPECTRUM ANALYZERS ====================
const masterAnalyser = actx.createAnalyser();
masterAnalyser.fftSize = 128;
limiterNode.connect(masterAnalyser);

function drawSpectrumAnalyzers() {
  // Per-deck spectrum
  for (let i = 0; i < 2; i++) {
    const canvas = document.getElementById('spectrum' + (i + 1));
    if (!canvas) continue;
    const ctx = canvas.getContext('2d');
    if (canvas.width !== canvas.offsetWidth * 2) { canvas.width = canvas.offsetWidth * 2; canvas.height = canvas.offsetHeight * 2; }
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const analyser = decks[i].analyser;
    const bufLen = analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);
    analyser.getByteFrequencyData(data);
    const bars = 32;
    const barW = Math.floor(canvas.width / bars) - 1;
    for (let b = 0; b < bars; b++) {
      const startBin = Math.floor(b * bufLen / bars);
      const endBin = Math.floor((b + 1) * bufLen / bars);
      let sum = 0;
      for (let j = startBin; j < endBin; j++) sum += data[j];
      const avg = sum / (endBin - startBin);
      const h = (avg / 255) * canvas.height;
      // Color by frequency: low=red, mid=green, high=cyan
      const ratio = b / bars;
      const r = Math.floor(255 * Math.max(0, 1 - ratio * 3));
      const g = Math.floor(255 * (ratio < 0.5 ? ratio * 2 : 2 - ratio * 2));
      const bl = Math.floor(255 * Math.max(0, ratio * 2 - 1));
      ctx.fillStyle = `rgb(${r},${g},${bl})`;
      ctx.fillRect(b * (barW + 1), canvas.height - h, barW, h);
    }
  }
  // Master spectrum
  const mCanvas = document.getElementById('masterSpectrum');
  if (!mCanvas) return;
  const mCtx = mCanvas.getContext('2d');
  if (mCanvas.width !== mCanvas.offsetWidth * 2) { mCanvas.width = mCanvas.offsetWidth * 2; mCanvas.height = mCanvas.offsetHeight * 2; }
  mCtx.fillStyle = '#050508';
  mCtx.fillRect(0, 0, mCanvas.width, mCanvas.height);
  const mData = new Uint8Array(masterAnalyser.frequencyBinCount);
  masterAnalyser.getByteFrequencyData(mData);
  const mBars = 64;
  const mBarW = Math.floor(mCanvas.width / mBars) - 1;
  for (let b = 0; b < mBars; b++) {
    const startBin = Math.floor(b * masterAnalyser.frequencyBinCount / mBars);
    const endBin = Math.floor((b + 1) * masterAnalyser.frequencyBinCount / mBars);
    let sum = 0;
    for (let j = startBin; j < endBin; j++) sum += mData[j];
    const avg = sum / (endBin - startBin);
    const h = (avg / 255) * mCanvas.height;
    const ratio = b / mBars;
    const r = Math.floor(255 * Math.max(0, 1 - ratio * 3));
    const g = Math.floor(255 * (ratio < 0.5 ? ratio * 2 : 2 - ratio * 2));
    const bl = Math.floor(255 * Math.max(0, ratio * 2 - 1));
    mCtx.fillStyle = `rgb(${r},${g},${bl})`;
    mCtx.fillRect(b * (mBarW + 1), mCanvas.height - h, mBarW, h);
  }
}

// ==================== SLICER MODE ====================
const slicerState = [{ active: false, sliceIdx: -1, savedPosition: 0 }, { active: false, sliceIdx: -1, savedPosition: 0 }];

function slicerTrigger(deckId, sliceIdx) {
  const deck = decks[deckId];
  if (!deck.bpm || !deck.playing) return;
  const beatDur = 60 / deck.bpm;
  const sectionDur = beatDur * 8; // 8 beats = 2 bars for slicer domain
  const currentTime = deck.getCurrentTime();
  const sectionStart = Math.floor(currentTime / sectionDur) * sectionDur;
  const sliceDur = sectionDur / 8;
  const sliceStart = sectionStart + sliceIdx * sliceDur;
  
  if (!slicerState[deckId].active) {
    slicerState[deckId].savedPosition = currentTime;
  }
  slicerState[deckId].active = true;
  slicerState[deckId].sliceIdx = sliceIdx;
  
  // Set loop on this slice
  deck.loopStart = sliceStart;
  deck.loopEnd = sliceStart + sliceDur;
  deck.loopActive = true;
  deck.seekTo(sliceStart);
  
  // Highlight pad
  const pads = document.querySelectorAll('#slicerSection' + deckId + ' .slicer-pad');
  pads.forEach((p, idx) => p.classList.toggle('active', idx === sliceIdx));
}

function slicerRelease(deckId) {
  const deck = decks[deckId];
  if (!slicerState[deckId].active) return;
  deck.loopActive = false;
  // Return to saved position (slip-like behavior)
  const elapsed = deck.getCurrentTime() - slicerState[deckId].savedPosition;
  if (elapsed > 0) deck.seekTo(slicerState[deckId].savedPosition + elapsed);
  slicerState[deckId].active = false;
  slicerState[deckId].sliceIdx = -1;
  document.querySelectorAll('#slicerSection' + deckId + ' .slicer-pad').forEach(p => p.classList.remove('active'));
}

// ==================== ROLL EFFECT ====================
const rollState = [{ active: false, savedPosition: 0, savedTime: 0 }, { active: false, savedPosition: 0, savedTime: 0 }];

function rollStart(deckId, beats) {
  const deck = decks[deckId];
  if (!deck.bpm || !deck.playing) return;
  const beatDur = 60 / deck.bpm;
  const currentTime = deck.getCurrentTime();
  
  rollState[deckId].savedPosition = currentTime;
  rollState[deckId].savedTime = actx.currentTime;
  rollState[deckId].active = true;
  
  // Set a tight loop
  deck.loopStart = snapToBeat(deck, currentTime);
  deck.loopEnd = deck.loopStart + beats * beatDur;
  deck.loopActive = true;
}

function rollStop(deckId) {
  const deck = decks[deckId];
  if (!rollState[deckId].active) return;
  deck.loopActive = false;
  // Return to where playback would have been without the roll
  const elapsed = (actx.currentTime - rollState[deckId].savedTime) * deck.playbackRate;
  deck.seekTo(rollState[deckId].savedPosition + elapsed);
  rollState[deckId].active = false;
  // Clear loop button states
  document.querySelectorAll(`.loop-btn[data-deck="${deckId}"]`).forEach(b => b.classList.remove('active'));
}

// ==================== FX WET/DRY ====================
const fxWetDry = [0.5, 0.5]; // 0=dry, 1=full wet

function applyFxWetDry(ch) {
  const deck = decks[ch];
  const wet = fxWetDry[ch];
  // Apply wet level to all active effects
  if (deck.fx.echo) { deck.echoWet.gain.value = wet; deck.echoFeedback.gain.value = wet * 0.8; }
  if (deck.fx.reverb) deck.reverbWet.gain.value = wet;
  if (deck.fx.delay) deck.delayWet.gain.value = wet;
  if (deck.fx.flanger) { deck.flangerWet.gain.value = wet; deck.flangerLFOGain.gain.value = wet * 0.006; }
  if (deck.fx.phaser) deck.phaserWet.gain.value = wet;
  if (deck.fx.bitcrush) deck.bitcrushWet.gain.value = wet;
}

// ==================== MASTER CLOCK ====================
let masterClockStart = null;
let masterClockInterval = null;

function startMasterClock() {
  if (masterClockStart !== null) return;
  masterClockStart = Date.now();
  masterClockInterval = setInterval(updateMasterClock, 1000);
}

function updateMasterClock() {
  if (masterClockStart === null) return;
  const elapsed = Date.now() - masterClockStart;
  const h = Math.floor(elapsed / 3600000);
  const m = Math.floor((elapsed % 3600000) / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  document.getElementById('masterClock').textContent =
    h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

// Hook into play to start master clock
const _origPlay = Deck.prototype.play;
Deck.prototype.play = function() {
  startMasterClock();
  return _origPlay.call(this);
};

// ==================== DECK STATUS DOTS ====================
function updateDeckStatusDots() {
  for (let i = 0; i < 2; i++) {
    const dot = document.getElementById('deckDot' + (i + 1));
    const deck = decks[i];
    const hasTrack = deck.buffer || deck._streamAudio;
    const remaining = hasTrack ? deck.getDuration() - deck.getCurrentTime() : Infinity;
    dot.className = 'deck-status-dot';
    if (!hasTrack) {
      // gray (default)
    } else if (deck.playing && remaining < 30) {
      dot.classList.add('ending');
    } else if (deck.playing) {
      dot.classList.add(i === 0 ? 'playing-d1' : 'playing-d2');
    } else {
      dot.classList.add(i === 0 ? 'loaded-d1' : 'loaded-d2');
    }
  }
}

// ==================== PROCEDURAL ALBUM ART ====================
function generateProceduralArt(deckId) {
  const deck = decks[deckId];
  const canvas = document.getElementById('jogArtCanvas' + (deckId + 1));
  if (!canvas || !deck.buffer) return;
  const ctx = canvas.getContext('2d');
  const size = 100;
  canvas.width = size;
  canvas.height = size;
  const data = deck.buffer.getChannelData(0);
  const sr = deck.buffer.sampleRate;
  // Generate a unique pattern from waveform data
  // Sample 64 points spread across the track
  const samples = 64;
  const step = Math.floor(data.length / samples);
  const values = [];
  for (let i = 0; i < samples; i++) {
    const idx = i * step;
    values.push(Math.abs(data[Math.min(idx, data.length - 1)]));
  }
  // Create a seed from the values
  let seed = 0;
  for (let i = 0; i < values.length; i++) seed += values[i] * (i + 1) * 1000;
  seed = Math.floor(seed) % 10000;
  // Pseudo-random from seed
  const rng = (function(s) { return function() { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; }; })(seed || 1);
  // Draw concentric pattern
  const cx = size / 2, cy = size / 2;
  // Background
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, size, size);
  // Radial segments
  const numRings = 6;
  const numSegs = 12;
  for (let r = numRings; r >= 0; r--) {
    const radius = (r / numRings) * (size / 2 - 2);
    const nextRadius = ((r + 1) / numRings) * (size / 2 - 2);
    for (let s = 0; s < numSegs; s++) {
      const angle1 = (s / numSegs) * Math.PI * 2;
      const angle2 = ((s + 1) / numSegs) * Math.PI * 2;
      const vi = (r * numSegs + s) % values.length;
      const intensity = values[vi];
      const hue = (rng() * 360 + seed) % 360;
      const sat = 50 + intensity * 50;
      const light = 15 + intensity * 40;
      ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
      ctx.beginPath();
      ctx.arc(cx, cy, nextRadius, angle1, angle2);
      ctx.arc(cx, cy, radius, angle2, angle1, true);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Center hole
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#222';
  ctx.fill();
  document.getElementById('jogArt' + (deckId + 1)).style.display = '';
}

// ==================== SOUND QUALITY INDICATOR ====================
function updateQualityBadge(deckId) {
  const deck = decks[deckId];
  const badge = document.getElementById('quality' + (deckId + 1));
  if (!deck._lastUrl) { badge.style.display = 'none'; return; }
  const url = deck._lastUrl;
  const ext = url.split('.').pop().split('?')[0].toLowerCase();
  const formatMap = { mp3: 'MP3', wav: 'WAV', flac: 'FLAC', ogg: 'OGG', m4a: 'AAC', aac: 'AAC', opus: 'OPUS', webm: 'WEBM' };
  const format = formatMap[ext] || ext.toUpperCase();
  badge.textContent = format;
  badge.className = 'quality-badge ' + (ext === 'wav' ? 'wav' : ext === 'flac' ? 'flac' : ext === 'mp3' ? 'mp3' : 'ogg');
  badge.style.display = '';
}

// Hook quality badge + art into loadTrack
const _origLoadTrack = Deck.prototype.loadTrack;
Deck.prototype.loadTrack = async function(url, name) {
  const result = await _origLoadTrack.call(this, url, name);
  updateQualityBadge(this.id);
  // Generate art after buffer is ready (delay slightly for background decode)
  const self = this;
  const checkArt = setInterval(() => {
    if (self.buffer) { generateProceduralArt(self.id); clearInterval(checkArt); }
  }, 500);
  setTimeout(() => clearInterval(checkArt), 15000);
  return result;
};

// ==================== SMOOTH NUMBER ANIMATION ====================
const animatedValues = { bpm: [0, 0] };

function animateNumber(elementId, targetVal, decimals = 1) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const current = parseFloat(el.textContent) || 0;
  if (Math.abs(current - targetVal) < 0.05) {
    el.textContent = targetVal.toFixed(decimals);
    return;
  }
  const diff = targetVal - current;
  const step = diff * 0.3;
  const next = current + step;
  el.textContent = next.toFixed(decimals);
}

// ==================== TRANSITION TIMELINE ====================
let timelineEntries = [];

function addTimelineEntry(deckIdx, trackName) {
  if (!isRecording) return;
  timelineEntries.push({ deck: deckIdx, name: trackName, time: Date.now() });
  renderTransitionTimeline();
}

function renderTransitionTimeline() {
  const container = document.getElementById('transitionTimeline');
  if (!container || timelineEntries.length === 0) return;
  const totalDuration = Date.now() - timelineEntries[0].time;
  if (totalDuration < 1000) return;
  container.innerHTML = '';
  for (let i = 0; i < timelineEntries.length; i++) {
    const entry = timelineEntries[i];
    const nextTime = (i + 1 < timelineEntries.length) ? timelineEntries[i + 1].time : Date.now();
    const duration = nextTime - entry.time;
    const pct = (duration / totalDuration) * 100;
    const block = document.createElement('div');
    block.className = 'timeline-block ' + (entry.deck === 0 ? 'd1' : 'd2');
    block.style.width = Math.max(pct, 0.5) + '%';
    block.textContent = entry.name.substring(0, 20);
    block.title = entry.name;
    container.appendChild(block);
  }
}

// Hook timeline into autoLogTrack
const _origAutoLogTrack = autoLogTrack;
autoLogTrack = function(deckIdx) {
  const deck = decks[deckIdx];
  if (deck.trackName) addTimelineEntry(deckIdx, deck.trackName);
  return _origAutoLogTrack(deckIdx);
};

// ==================== TOOLTIPS FOR TRANSPORT BUTTONS ====================
function addTooltips() {
  const tooltips = {
    'play1': 'Play/Pause Deck 1 (Q)', 'play2': 'Play/Pause Deck 2 (P)',
    'cue1': 'Return to cue point Deck 1 (W)', 'cue2': 'Return to cue point Deck 2 (O)',
    'sync1': 'Sync BPM to Deck 2 (E)', 'sync2': 'Sync BPM to Deck 1 (I)',
    'vinyl1': 'Vinyl brake effect', 'vinyl2': 'Vinyl brake effect',
    'reverse1': 'Hold for reverse playback', 'reverse2': 'Hold for reverse playback',
    'headphone1': 'Headphone cue Deck 1', 'headphone2': 'Headphone cue Deck 2',
    'slip1': 'Slip mode — position continues while scratching', 'slip2': 'Slip mode — position continues while scratching',
    'quantize1': 'Quantize — snap to beat grid', 'quantize2': 'Quantize — snap to beat grid',
    'logBtn1': 'Log current track to tracklist', 'logBtn2': 'Log current track to tracklist',
    'tap1': 'Tap to set BPM manually', 'tap2': 'Tap to set BPM manually',
    'autoGainBtn': 'Auto-adjust gain to match loudness',
    'noiseToggle': 'Toggle white noise',
    'masterVol': 'Master volume output',
    'crossfader': 'Crossfade between Deck 1 and Deck 2',
  };
  for (const [id, tip] of Object.entries(tooltips)) {
    const el = document.getElementById(id);
    if (el) el.setAttribute('data-tooltip', tip);
  }
  // Sampler pads
  document.querySelectorAll('.sampler-pad').forEach(p => p.setAttribute('data-tooltip', 'Trigger sample'));
  // Hot cues
  document.querySelectorAll('.hotcue-btn').forEach(p => p.setAttribute('data-tooltip', 'Set/jump to hot cue (Shift+click to delete)'));
  // Loop buttons
  document.querySelectorAll('.loop-btn').forEach(p => p.setAttribute('data-tooltip', 'Toggle ' + p.textContent + ' beat loop'));
  // Beat jump
  document.querySelectorAll('.beat-jump-btn').forEach(p => p.setAttribute('data-tooltip', 'Jump ' + p.textContent + ' beats'));
  // Nudge
  document.querySelectorAll('.nudge-btn').forEach(p => p.setAttribute('data-tooltip', 'Nudge tempo'));
  // Slicer
  document.querySelectorAll('.slicer-pad').forEach(p => p.setAttribute('data-tooltip', 'Slicer pad — hold to loop slice'));
  // Roll
  document.querySelectorAll('.roll-pad').forEach(p => p.setAttribute('data-tooltip', 'Beat roll — hold to activate'));
  // FX
  document.querySelectorAll('.fx-btn').forEach(p => p.setAttribute('data-tooltip', 'Toggle ' + p.textContent + ' effect'));
  // Auto-crossfade
  const axl = document.getElementById('autoXfadeL');
  const axr = document.getElementById('autoXfadeR');
  if (axl) axl.setAttribute('data-tooltip', 'Auto-crossfade to Deck 1');
  if (axr) axr.setAttribute('data-tooltip', 'Auto-crossfade to Deck 2');
  // Automix
  document.querySelectorAll('.automix-btn').forEach(p => p.setAttribute('data-tooltip', p.title || 'Auto-mix transition'));
  // EQ kills
  document.querySelectorAll('.eq-kill-btn').forEach(p => p.setAttribute('data-tooltip', 'Kill ' + p.dataset.band.toUpperCase() + ' frequencies'));
  // Crossfader curve
  document.querySelectorAll('.xfade-curve-btn').forEach(p => p.setAttribute('data-tooltip', p.textContent + ' crossfader curve'));
}
addTooltips();

// ==================== ANIMATION LOOP ====================
function animate() {
  requestAnimationFrame(animate);
  for (let i = 0; i < 2; i++) {
    if (decks[i].playing) jogAngles[i] += 1.5 * decks[i].playbackRate;
    document.getElementById('jog' + (i + 1)).style.transform = `rotate(${jogAngles[i]}deg)`;
  }
  for (let i = 0; i < 2; i++) {
    const t = decks[i].getCurrentTime();
    const dur = decks[i].getDuration();
    if (dur > 0) {
      document.getElementById('wfTime' + (i + 1)).textContent = formatTime(t) + ' / ' + formatTime(dur);
      document.getElementById('progressFill' + (i + 1)).style.width = (t / dur) * 100 + '%';
    } else {
      document.getElementById('wfTime' + (i + 1)).textContent = formatTime(t);
    }
    // Smooth BPM animation
    if (decks[i].bpm) animateNumber('bpm' + (i + 1), decks[i].bpm, 1);
  }
  drawPlayhead();
  drawOverviewPlayhead();
  drawParallelWaveforms();
  drawSpectrumAnalyzers();
  updateMeters();
  updateVUMeters();
  updatePhaseMeter();
  updateBPMPulse();
  updateBeatFlash();
  updateXfadeColor();
  checkLoops();
  updateUI();
  updateDeckStatusDots();
  for (let i = 0; i < 2; i++) updateMarquee(i);
  // Update timeline periodically
  if (isRecording && timelineEntries.length > 0 && performance.now() % 60 < 17) renderTransitionTimeline();
}
animate();

// Periodic checks
setInterval(updateBeatCounter, 50);
setInterval(checkTrackEndWarning, 200);
setInterval(() => {
  const reduction = limiterNode.reduction;
  const indicator = document.getElementById('limiterIndicator');
  indicator.classList.toggle('engaged', reduction < -0.5);
}, 100);

// Load initial data
loadSessions();
